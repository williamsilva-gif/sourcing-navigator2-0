import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Send,
  XCircle,
  Check,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useBaselineStore } from "@/lib/baselineStore";
import { useClientsStore } from "@/lib/clientsStore";
import { useDecisionStore } from "@/lib/decisionStore";
import { filterByWindow, type PeriodWindow } from "@/lib/periodFilter";
import {
  computeAdrVariance,
  adrVarianceSignature,
  type AdrVarianceRow,
} from "@/lib/adrVarianceAnalysis";
import { fmtUsd } from "@/components/dashboard/decisionData";

interface Props {
  window: PeriodWindow | null;
}

const sevBadge: Record<AdrVarianceRow["severity"], string> = {
  high: "bg-destructive-soft text-destructive",
  medium: "bg-warning-soft text-warning-foreground",
  low: "bg-info-soft text-info",
  ok: "bg-muted text-muted-foreground",
};

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPctSigned(v: number) {
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(1)}%`;
}

export function AdrVarianceCard({ window }: Props) {
  const allBookings = useBaselineStore((s) => s.bookings);
  const contracts = useBaselineStore((s) => s.contracts);
  const clientTenantId = useClientsStore((s) => s.selectedClientId);

  const bookings = useMemo(
    () => (window ? filterByWindow(allBookings, window) : allBookings),
    [allBookings, window],
  );

  const summary = useMemo(() => computeAdrVariance(bookings, contracts), [bookings, contracts]);

  const persistedAlerts = useDecisionStore((s) => s.alerts);
  const actions = useDecisionStore((s) => s.actions);
  const upsertDerivedAlerts = useDecisionStore((s) => s.upsertDerivedAlerts);
  const createAction = useDecisionStore((s) => s.createAction);
  const setAlertStatus = useDecisionStore((s) => s.setAlertStatus);

  const periodLabel = window?.label ?? "all";

  // signature → persisted alert
  const persistedBySig = useMemo(() => {
    const m = new Map<string, (typeof persistedAlerts)[number]>();
    persistedAlerts.forEach((a) => m.set(a.signature, a));
    return m;
  }, [persistedAlerts]);

  const openActionByAlert = useMemo(() => {
    const m = new Map<string, (typeof actions)[number]>();
    actions.forEach((a) => {
      if (a.alert_id && a.status !== "COMPLETED" && a.status !== "IGNORED") m.set(a.alert_id, a);
    });
    return m;
  }, [actions]);

  const [expanded, setExpanded] = useState(false);
  const [busySig, setBusySig] = useState<string | null>(null);

  const handleSendAlert = async (row: AdrVarianceRow) => {
    if (!clientTenantId) {
      toast.error("Selecione um cliente para enviar alertas.");
      return;
    }
    const sig = adrVarianceSignature(periodLabel, row);
    setBusySig(sig);
    try {
      // 1. Ensure the alert is persisted (idempotent via signature)
      await upsertDerivedAlerts(clientTenantId, [
        {
          signature: sig,
          type: "ADR_VARIANCE",
          severity: row.severity === "ok" ? "low" : row.severity,
          title: `ADR realizado ${fmtPctSigned(row.variancePct)} vs negociado — ${row.hotel}`,
          description: `${row.city} · Negociado ${fmtBrl(row.negotiatedAdr)} · Realizado ${fmtBrl(
            row.realizedAdr,
          )} · ${row.roomNights.toLocaleString("pt-BR")} room nights`,
          impactedCity: row.city,
          impactedHotel: row.hotel,
          financialImpact: row.leakage,
          metadata: {
            negotiatedAdr: row.negotiatedAdr,
            realizedAdr: row.realizedAdr,
            variancePct: row.variancePct,
            roomNights: row.roomNights,
            bookings: row.bookings,
            inferredCauses: row.inferredCauses,
            periodLabel,
          },
        },
      ]);

      // 2. Look up the persisted id (store was refreshed by upsertDerivedAlerts)
      const persisted = useDecisionStore.getState().alerts.find((a) => a.signature === sig);
      if (!persisted) {
        toast.error("Não foi possível registrar o alerta.");
        return;
      }

      // 3. Create the operational action — trigger creates the Watchlist row.
      await createAction({
        clientTenantId,
        alertId: persisted.id,
        type: "SEND_ALERT",
        status: "SENT",
        payload: {
          hotel: row.hotel,
          city: row.city,
          negotiatedAdr: row.negotiatedAdr,
          realizedAdr: row.realizedAdr,
          variancePct: row.variancePct,
          leakage: row.leakage,
          roomNights: row.roomNights,
          inferredCauses: row.inferredCauses,
          periodLabel,
          emailTemplate: {
            subject: `Revisão urgente de ADR — ${row.hotel} (${periodLabel})`,
            body:
              `Olá,\n\nIdentificamos um desvio de ${fmtPctSigned(row.variancePct)} entre o ADR negociado ` +
              `(${fmtBrl(row.negotiatedAdr)}) e o ADR realizado (${fmtBrl(row.realizedAdr)}) em ${row.hotel} ` +
              `durante ${periodLabel}, com impacto estimado de ${fmtBrl(row.leakage)} sobre ${row.roomNights.toLocaleString("pt-BR")} room nights.\n\n` +
              `Solicitamos:\n` +
              `1) Confirmação de que a tarifa contratada está carregada em todos os canais\n` +
              `2) Confirmação de disponibilidade (LRA) nas datas-chave\n` +
              `3) Revisão urgente das reservas afetadas\n\n` +
              `Use o link de resposta para comentar, anexar prints e confirmar a revisão. ` +
              `A confirmação marca a ação como concluída automaticamente.\n\n` +
              `Obrigado.`,
          },
        },
      });
      toast.success(`Alerta enviado — ${row.hotel} agora está na Watchlist`);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao enviar alerta.");
    } finally {
      setBusySig(null);
    }
  };

  const handleIgnore = async (row: AdrVarianceRow) => {
    if (!clientTenantId) return;
    const sig = adrVarianceSignature(periodLabel, row);
    const persisted = persistedBySig.get(sig);
    if (!persisted) {
      toast.success("Linha ignorada.");
      return;
    }
    setBusySig(sig);
    try {
      await setAlertStatus(persisted.id, "dismissed");
      toast.success("Alerta arquivado.");
    } finally {
      setBusySig(null);
    }
  };

  // Hide rows that have been dismissed in DB
  const visibleRows = useMemo(() => {
    return summary.rows.filter((row) => {
      const sig = adrVarianceSignature(periodLabel, row);
      const persisted = persistedBySig.get(sig);
      return !persisted || persisted.status !== "dismissed";
    });
  }, [summary.rows, persistedBySig, periodLabel]);

  if (bookings.length === 0 || contracts.length === 0 || summary.hotelCount === 0) {
    return null;
  }

  const above = summary.variancePct > 0;
  const TrendIcon = above ? TrendingUp : TrendingDown;
  const trendTone = above ? "text-destructive" : "text-success";

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">ADR realizado vs ADR esperado</h2>
            {summary.flaggedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
                <AlertTriangle className="h-3 w-3" />
                {summary.flaggedCount} {summary.flaggedCount === 1 ? "hotel" : "hotéis"} fora do esperado
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.flaggedCount === 0
              ? "ADR realizado em linha com o negociado no período selecionado."
              : `O ADR realizado está ${fmtPctSigned(summary.variancePct)} ${above ? "acima" : "abaixo"} do esperado no período selecionado.`}
          </p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex h-8 items-center gap-1 rounded-md border border-input bg-card px-2.5 text-xs font-semibold text-foreground hover:border-primary/40"
        >
          {expanded ? "Recolher" : "Detalhes"}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCell label="ADR negociado médio" value={fmtBrl(summary.weightedNegotiated)} />
        <SummaryCell label="ADR realizado médio" value={fmtBrl(summary.weightedRealized)} />
        <SummaryCell
          label="Variação"
          value={
            <span className={`inline-flex items-center gap-1 ${trendTone}`}>
              <TrendIcon className="h-4 w-4" />
              {fmtPctSigned(summary.variancePct)}
            </span>
          }
        />
        <SummaryCell label="Impacto financeiro" value={fmtUsd(summary.totalLeakage)} />
      </div>

      {expanded && (
        <div className="mt-5 overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Hotel</th>
                <th className="px-3 py-2 text-left font-semibold">Cidade</th>
                <th className="px-3 py-2 text-right font-semibold">Negociado</th>
                <th className="px-3 py-2 text-right font-semibold">Realizado</th>
                <th className="px-3 py-2 text-right font-semibold">Variação</th>
                <th className="px-3 py-2 text-right font-semibold">Leakage</th>
                <th className="px-3 py-2 text-right font-semibold">RN</th>
                <th className="px-3 py-2 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Sem hotéis com desvio relevante.
                  </td>
                </tr>
              )}
              {visibleRows.map((row) => {
                const sig = adrVarianceSignature(periodLabel, row);
                const persisted = persistedBySig.get(sig);
                const tracked = persisted ? openActionByAlert.has(persisted.id) : false;
                return (
                  <RowItem
                    key={sig}
                    row={row}
                    tracked={tracked}
                    busy={busySig === sig}
                    onSend={() => handleSendAlert(row)}
                    onIgnore={() => handleIgnore(row)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SummaryCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function RowItem({
  row,
  tracked,
  busy,
  onSend,
  onIgnore,
}: {
  row: AdrVarianceRow;
  tracked: boolean;
  busy: boolean;
  onSend: () => void;
  onIgnore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const varianceTone =
    row.severity === "high"
      ? "text-destructive"
      : row.severity === "medium"
        ? "text-warning-foreground"
        : row.severity === "low"
          ? "text-info"
          : "text-muted-foreground";
  return (
    <>
      <tr className="border-t border-border hover:bg-muted/20">
        <td className="px-3 py-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-left font-medium text-foreground hover:text-primary"
          >
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {row.hotel}
          </button>
        </td>
        <td className="px-3 py-2 text-muted-foreground">{row.city}</td>
        <td className="px-3 py-2 text-right">{fmtBrl(row.negotiatedAdr)}</td>
        <td className="px-3 py-2 text-right">{fmtBrl(row.realizedAdr)}</td>
        <td className={`px-3 py-2 text-right font-semibold ${varianceTone}`}>
          {fmtPctSigned(row.variancePct)}
        </td>
        <td className="px-3 py-2 text-right text-muted-foreground">{fmtUsd(row.leakage)}</td>
        <td className="px-3 py-2 text-right text-muted-foreground">
          {row.roomNights.toLocaleString("pt-BR")}
        </td>
        <td className="px-3 py-2 text-right">
          <div className="inline-flex items-center gap-1.5">
            {tracked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
                <Check className="h-3 w-3" /> Na Watchlist
              </span>
            ) : (
              <>
                <button
                  onClick={onSend}
                  disabled={busy || row.severity === "ok"}
                  className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-semibold text-foreground hover:border-primary/40 disabled:opacity-40"
                >
                  <Send className="h-3 w-3" />
                  Enviar alerta
                </button>
                <button
                  onClick={onIgnore}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  <XCircle className="h-3 w-3" />
                  Ignorar
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-border bg-muted/10">
          <td colSpan={8} className="px-3 py-3">
            <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
              <div>
                <p className="font-semibold uppercase tracking-wider text-muted-foreground">
                  Inferência de causas
                </p>
                {row.inferredCauses.length === 0 ? (
                  <p className="mt-1 text-muted-foreground">
                    Variação dentro do esperado — sem ação recomendada.
                  </p>
                ) : (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-foreground">
                    {row.inferredCauses.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wider text-muted-foreground">
                  Detalhes
                </p>
                <p className="mt-1 text-muted-foreground">
                  {row.bookings.toLocaleString("pt-BR")} reservas analisadas ·{" "}
                  <span className={`font-semibold ${varianceTone}`}>
                    {row.severity === "ok" ? "Em linha" : row.severity.toUpperCase()}
                  </span>
                </p>
                <p className="mt-1 text-muted-foreground">
                  Ao enviar alerta, o histórico, comentários e anexos ficam disponíveis na Watchlist
                  para acompanhamento até a confirmação do hotel/account manager.
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
