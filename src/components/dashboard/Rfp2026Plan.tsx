// "Plano para a RFP 2026" — decision engine view.
// Shows ADR real vs CAP negociado vs CAP sugerido per city, plus status badge,
// priority, justification, operational impact and clickable actions that
// either navigate to the right module or queue an action in the pipeline.

import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, Target, Send, FileSearch, ListPlus } from "lucide-react";
import { useBaselineStore } from "@/lib/baselineStore";
import {
  buildCityRecommendations,
  STATUS_META,
  type CityRecommendation,
  type CityStatus,
} from "@/lib/rfpPlanModel";
import { useActionStore } from "@/lib/actionStore";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function fmtBrl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const TONE_BADGE: Record<string, string> = {
  destructive: "bg-destructive/15 text-destructive border-destructive/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  success: "bg-success/15 text-success border-success/30",
  muted: "bg-muted text-muted-foreground border-border",
};

const PRIO_BADGE: Record<string, string> = {
  Alta: "bg-destructive/15 text-destructive",
  "Média": "bg-warning/15 text-warning",
  Baixa: "bg-muted text-muted-foreground",
};

export function Rfp2026Plan() {
  const allBookings = useBaselineStore((s) => s.bookings);
  const contracts = useBaselineStore((s) => s.contracts);
  const executeAction = useActionStore((s) => s.executeAction);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<CityStatus | "all">("all");

  const recs = useMemo<CityRecommendation[]>(
    () => buildCityRecommendations(allBookings, contracts, "2025"),
    [allBookings, contracts],
  );

  if (recs.length === 0) return null;

  const totalSavings = recs.reduce((s, r) => s + r.estimatedSavings, 0);
  const counts: Record<CityStatus, number> = {
    leakage_critico: 0,
    acima_cap: 0,
    alta_concentracao: 0,
    sem_cobertura: 0,
    dentro_cap: 0,
  };
  recs.forEach((r) => (counts[r.status] += 1));

  const visible = filter === "all" ? recs : recs.filter((r) => r.status === filter);

  function queueRenegotiation(r: CityRecommendation) {
    executeAction({
      opportunityId: `rfp2026-${r.city}`,
      label: `Renegociar ${r.city} → cap ${fmtBrl(r.suggestedCap2026)}`,
      payload: {
        kind: "renegotiation",
        data: {
          city: r.city,
          hotels: Math.max(1, r.hotelsOverCap),
          targetAdrReduction: Math.max(3, Math.round(r.gapPct)),
        },
      },
      effort: r.hotelsOverCap > 5 ? "high" : "medium",
      savingsExpected: r.estimatedSavings,
      adrBefore: Math.round(r.adr),
      complianceBefore: Math.round(100 - r.overCapPct),
    });
    toast.success(`${r.city} adicionada ao pipeline`, {
      description: `Renegociação com ${r.hotelsOverCap} hotéis · meta cap ${fmtBrl(r.suggestedCap2026)}`,
    });
  }

  function goToRfp(r: CityRecommendation) {
    navigate({
      to: "/rfp",
      search: { city: r.city, suggestedCap: r.suggestedCap2026 } as never,
    });
  }

  function goToNeg(r: CityRecommendation) {
    navigate({ to: "/negociacao", search: { city: r.city } as never });
  }

  return (
    <TooltipProvider delayDuration={150}>
      <section className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Plano para a RFP 2026
              </h2>
              <p className="text-xs text-muted-foreground">
                Comparativo 2024 → 2025 + contratos vigentes · economia estimada{" "}
                <span className="font-semibold text-foreground">{fmtBrl(totalSavings)}/ano</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              label={`Todas · ${recs.length}`}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            {(Object.keys(counts) as CityStatus[])
              .filter((k) => counts[k] > 0)
              .map((k) => (
                <FilterChip
                  key={k}
                  label={`${STATUS_META[k].label} · ${counts[k]}`}
                  tone={STATUS_META[k].tone}
                  active={filter === k}
                  onClick={() => setFilter(k)}
                />
              ))}
          </div>
        </header>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Cidade</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Prio</th>
                <th className="px-3 py-2 text-right">ADR 2025</th>
                <th className="px-3 py-2 text-right">CAP atual</th>
                <th className="px-3 py-2 text-right">CAP sugerido 2026</th>
                <th className="px-3 py-2 text-right">Leakage 2025</th>
                <th className="px-3 py-2 text-right">Economia est.</th>
                <th className="px-3 py-2 text-left">Impacto</th>
                <th className="px-3 py-2 text-left">Ação</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const tone = STATUS_META[r.status].tone;
                const primary = primaryActionFor(r.status);
                return (
                  <tr key={r.city} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium text-foreground">{r.city}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${TONE_BADGE[tone]}`}>
                        {STATUS_META[r.status].label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${PRIO_BADGE[r.priority]}`}>
                        {r.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {fmtBrl(r.adr)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {r.currentCap != null ? fmtBrl(r.currentCap) : <span className="text-[11px] italic">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                          <Target className="h-3 w-3" />
                          {fmtBrl(r.suggestedCap2026)}
                        </span>
                        {r.reasons.length > 0 && (
                          <span className="text-[10px] leading-tight text-muted-foreground">
                            {r.reasons.join(" · ")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-warning">
                      {fmtBrl(r.leakageSpend)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-success">
                      {fmtBrl(r.estimatedSavings)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help text-muted-foreground underline decoration-dotted">
                            {r.hotelsOverCap} de {r.hotelsInvolved} hotéis
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs">
                            <p className="font-medium">Hotéis envolvidos</p>
                            <p className="text-muted-foreground">
                              {r.hotelsOverCap} acima do cap / {r.hotelsInvolved} ativos em 2025
                            </p>
                            {r.hotelsToRenegotiate.length > 0 && (
                              <p className="mt-1 text-muted-foreground">
                                Top: {r.hotelsToRenegotiate.slice(0, 3).join(", ")}
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {primary === "rfp" && (
                          <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={() => goToRfp(r)}>
                            <FileSearch className="mr-1 h-3 w-3" />
                            {r.status === "sem_cobertura" ? "Abrir RFP" : "Mini-RFP"}
                          </Button>
                        )}
                        {primary === "neg" && (
                          <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={() => goToNeg(r)}>
                            <Send className="mr-1 h-3 w-3" />
                            Negociar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => queueRenegotiation(r)}
                        >
                          <ListPlus className="mr-1 h-3 w-3" />
                          Pipeline
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </TooltipProvider>
  );
}

function primaryActionFor(status: CityStatus): "rfp" | "neg" | "none" {
  if (status === "leakage_critico" || status === "acima_cap") return "neg";
  if (status === "alta_concentracao" || status === "sem_cobertura") return "rfp";
  return "none";
}

function FilterChip({
  label,
  active,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: string;
}) {
  const base = "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition";
  const activeCls = "bg-foreground text-background border-foreground";
  const inactiveCls = tone
    ? `${TONE_BADGE[tone]} hover:opacity-80`
    : "bg-card text-muted-foreground border-border hover:bg-muted";
  return (
    <button type="button" onClick={onClick} className={`${base} ${active ? activeCls : inactiveCls}`}>
      {label}
    </button>
  );
}
