import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  XCircle,
  Check,
  AlertTriangle,
  TrendingDown,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useBaselineStore } from "@/lib/baselineStore";
import { useClientsStore } from "@/lib/clientsStore";
import { useDecisionStore } from "@/lib/decisionStore";
import { filterByWindow, type PeriodWindow } from "@/lib/periodFilter";
import {
  computeHotelUnderperformance,
  underperformanceSignature,
  type UnderperformanceRow,
} from "@/lib/hotelUnderperformanceAnalysis";
import { fmtUsd } from "@/components/dashboard/decisionData";

interface Props {
  window: PeriodWindow | null;
}

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function HotelUnderperformanceCard({ window }: Props) {
  const allBookings = useBaselineStore((s) => s.bookings);
  const contracts = useBaselineStore((s) => s.contracts);
  const clientTenantId = useClientsStore((s) => s.selectedClientId);

  const bookings = useMemo(
    () => (window ? filterByWindow(allBookings, window) : allBookings),
    [allBookings, window],
  );
  const summary = useMemo(
    () => computeHotelUnderperformance(bookings, contracts),
    [bookings, contracts],
  );

  const persistedAlerts = useDecisionStore((s) => s.alerts);
  const actions = useDecisionStore((s) => s.actions);
  const upsertDerivedAlerts = useDecisionStore((s) => s.upsertDerivedAlerts);
  const createAction = useDecisionStore((s) => s.createAction);
  const setAlertStatus = useDecisionStore((s) => s.setAlertStatus);

  const periodLabel = window?.label ?? "all";

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

  const handleInvestigate = async (row: UnderperformanceRow) => {
    if (!clientTenantId) {
      toast.error("Selecione um cliente para iniciar investigação.");
      return;
    }
    const sig = underperformanceSignature(periodLabel, row);
    setBusySig(sig);
    try {
      await upsertDerivedAlerts(clientTenantId, [
        {
          signature: sig,
          type: "HOTEL_UNDERPERFORMANCE",
          severity: row.severity,
          title: `Underperformance — ${row.hotel} (${row.utilizationPct.toFixed(0)}% do esperado)`,
          description: `${row.city} · ${row.actualRn.toLocaleString("pt-BR")} de ${Math.round(row.expectedRn).toLocaleString("pt-BR")} RN · gap de ${fmtUsd(row.estimatedMissedSpend)}`,
          impactedCity: row.city,
          impactedHotel: row.hotel,
          financialImpact: row.estimatedMissedSpend,
          metadata: {
            expectedRn: row.expectedRn,
            actualRn: row.actualRn,
            gapRn: row.gapRn,
            utilizationPct: row.utilizationPct,
            bookings: row.bookings,
            negotiatedAdr: row.negotiatedAdr,
            estimatedMissedSpend: row.estimatedMissedSpend,
            suspectedCauses: row.suspectedCauses,
            expectedSource: row.expectedSource,
            periodLabel,
          },
        },
      ]);
      const persisted = useDecisionStore.getState().alerts.find((a) => a.signature === sig);
      if (!persisted) {
        toast.error("Não foi possível registrar o alerta.");
        return;
      }
      const causesText = row.suspectedCauses.map((c, i) => `${i + 1}) ${c.label}`).join("\n");
      await createAction({
        clientTenantId,
        alertId: persisted.id,
        type: "FOLLOW_UP",
        status: "SENT",
        payload: {
          hotel: row.hotel,
          city: row.city,
          expectedRn: row.expectedRn,
          actualRn: row.actualRn,
          utilizationPct: row.utilizationPct,
          estimatedMissedSpend: row.estimatedMissedSpend,
          periodLabel,
          emailTemplate: {
            subject: `Investigação de volume — ${row.hotel} (${periodLabel})`,
            body:
              `Olá,\n\n${row.hotel} foi contratado para o programa em ${row.city}, mas recebeu apenas ` +
              `${row.actualRn.toLocaleString("pt-BR")} room nights no período ${periodLabel}, ` +
              `versus volume esperado de ${Math.round(row.expectedRn).toLocaleString("pt-BR")} ` +
              `(${row.utilizationPct.toFixed(0)}% de utilização). Gap estimado: ${fmtBrl(row.estimatedMissedSpend)}.\n\n` +
              `Causas suspeitas em análise:\n${causesText}\n\n` +
              `Gostaríamos de entender:\n` +
              `1) A disponibilidade da tarifa negociada está estável?\n` +
              `2) Há restrições de booking ou min-stay aplicadas?\n` +
              `3) Existe feedback recente de viajantes (serviço, localização)?\n` +
              `4) Há ações comerciais ou de marketing que possamos coordenar?\n\n` +
              `Use o link de resposta para enviar contexto, anexos e propostas. ` +
              `O retorno encerra a investigação automaticamente.\n\nObrigado.`,
          },
        },
      });
      toast.success(`Investigação iniciada — ${row.hotel} na Watchlist`);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao iniciar investigação.");
    } finally {
      setBusySig(null);
    }
  };

  const handleIgnore = async (row: UnderperformanceRow) => {
    if (!clientTenantId) return;
    const sig = underperformanceSignature(periodLabel, row);
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

  const visibleRows = useMemo(() => {
    return summary.rows.filter((row) => {
      const sig = underperformanceSignature(periodLabel, row);
      const persisted = persistedBySig.get(sig);
      return !persisted || persisted.status !== "dismissed";
    });
  }, [summary.rows, persistedBySig, periodLabel]);

  if (bookings.length === 0 || contracts.length === 0 || summary.flaggedHotels === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-warning-foreground" />
            <h2 className="text-base font-semibold text-foreground">
              Hotéis com underperformance
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
              <AlertTriangle className="h-3 w-3" />
              {summary.flaggedHotels} {summary.flaggedHotels === 1 ? "hotel" : "hotéis"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {Math.round(summary.totalGapRn).toLocaleString("pt-BR")} room nights abaixo do esperado · gap estimado {fmtUsd(summary.totalMissedSpend)}
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

      {expanded && (
        <div className="mt-5 overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Hotel</th>
                <th className="px-3 py-2 text-left font-semibold">Cidade</th>
                <th className="px-3 py-2 text-right font-semibold">Esperado</th>
                <th className="px-3 py-2 text-right font-semibold">Realizado</th>
                <th className="px-3 py-2 text-right font-semibold">Utilização</th>
                <th className="px-3 py-2 text-right font-semibold">Gap</th>
                <th className="px-3 py-2 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Sem underperformance ativa.
                  </td>
                </tr>
              )}
              {visibleRows.map((row) => {
                const sig = underperformanceSignature(periodLabel, row);
                const persisted = persistedBySig.get(sig);
                const tracked = persisted ? openActionByAlert.has(persisted.id) : false;
                return (
                  <UnderperfRowItem
                    key={sig}
                    row={row}
                    tracked={tracked}
                    busy={busySig === sig}
                    onInvestigate={() => handleInvestigate(row)}
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

function UnderperfRowItem({
  row,
  tracked,
  busy,
  onInvestigate,
  onIgnore,
}: {
  row: UnderperformanceRow;
  tracked: boolean;
  busy: boolean;
  onInvestigate: () => void;
  onIgnore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const tone =
    row.severity === "high"
      ? "text-destructive"
      : row.severity === "medium"
        ? "text-warning-foreground"
        : "text-info";
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
        <td className="px-3 py-2 text-right text-muted-foreground">
          {Math.round(row.expectedRn).toLocaleString("pt-BR")}
        </td>
        <td className="px-3 py-2 text-right text-muted-foreground">
          {row.actualRn.toLocaleString("pt-BR")}
        </td>
        <td className={`px-3 py-2 text-right font-semibold ${tone}`}>
          {row.utilizationPct.toFixed(0)}%
        </td>
        <td className="px-3 py-2 text-right text-muted-foreground">
          {fmtUsd(row.estimatedMissedSpend)}
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
                  onClick={onInvestigate}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-semibold text-foreground hover:border-primary/40 disabled:opacity-40"
                >
                  <Search className="h-3 w-3" />
                  Investigar com hotel
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
          <td colSpan={7} className="px-3 py-3">
            <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
              <div>
                <p className="font-semibold uppercase tracking-wider text-muted-foreground">
                  Volume
                </p>
                <p className="mt-1 text-foreground">
                  Esperado <strong>{Math.round(row.expectedRn).toLocaleString("pt-BR")}</strong> RN ·{" "}
                  Realizado <strong>{row.actualRn.toLocaleString("pt-BR")}</strong> RN
                </p>
                <p className="mt-1 text-muted-foreground">
                  {row.bookings.toLocaleString("pt-BR")} reservas no período · base:{" "}
                  {row.expectedSource === "cap" ? "cap contratado" : "média dos pares na cidade"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  ADR negociado {fmtBrl(row.negotiatedAdr)} ·{" "}
                  <span className={`font-semibold ${tone}`}>{row.severity.toUpperCase()}</span>
                </p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wider text-muted-foreground">
                  Causas suspeitas
                </p>
                {row.suspectedCauses.length === 0 ? (
                  <p className="mt-1 text-muted-foreground">Sem causas identificadas.</p>
                ) : (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-foreground">
                    {row.suspectedCauses.map((c, i) => (
                      <li key={i}>{c.label}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-muted-foreground">
                  Ao investigar, o hotel recebe um link para responder, anexar contexto e propor
                  ações; o retorno encerra a investigação.
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
