import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Send,
  XCircle,
  Check,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useBaselineStore } from "@/lib/baselineStore";
import { useClientsStore } from "@/lib/clientsStore";
import { useDecisionStore } from "@/lib/decisionStore";
import { filterByWindow, type PeriodWindow } from "@/lib/periodFilter";
import {
  computeRateLoading,
  rateLoadingSignature,
  type RateLoadingRow,
} from "@/lib/rateLoadingAnalysis";
import { fmtUsd } from "@/components/dashboard/decisionData";

interface Props {
  window: PeriodWindow | null;
}

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(v: number) {
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(1)}%`;
}

export function RateLoadingCard({ window }: Props) {
  const allBookings = useBaselineStore((s) => s.bookings);
  const contracts = useBaselineStore((s) => s.contracts);
  const clientTenantId = useClientsStore((s) => s.selectedClientId);

  const bookings = useMemo(
    () => (window ? filterByWindow(allBookings, window) : allBookings),
    [allBookings, window],
  );
  const summary = useMemo(() => computeRateLoading(bookings, contracts), [bookings, contracts]);

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

  const handleSend = async (row: RateLoadingRow) => {
    if (!clientTenantId) {
      toast.error("Selecione um cliente para enviar alertas.");
      return;
    }
    const sig = rateLoadingSignature(periodLabel, row);
    setBusySig(sig);
    try {
      await upsertDerivedAlerts(clientTenantId, [
        {
          signature: sig,
          type: "RATE_LOADING",
          severity: row.severity,
          title: `Falha de carregamento de tarifa — ${row.hotel}`,
          description: `${row.city} · ${row.affectedBookings}/${row.totalBookings} reservas acima do negociado · ${row.causeLabel}`,
          impactedCity: row.city,
          impactedHotel: row.hotel,
          financialImpact: row.estimatedLoss,
          metadata: {
            negotiatedAdr: row.negotiatedAdr,
            realizedAdr: row.realizedAdr,
            variancePct: row.variancePct,
            affectedBookings: row.affectedBookings,
            totalBookings: row.totalBookings,
            affectedRn: row.affectedRn,
            estimatedLoss: row.estimatedLoss,
            suspectedCause: row.suspectedCause,
            causeLabel: row.causeLabel,
            periodLabel,
          },
        },
      ]);
      const persisted = useDecisionStore.getState().alerts.find((a) => a.signature === sig);
      if (!persisted) {
        toast.error("Não foi possível registrar o alerta.");
        return;
      }
      await createAction({
        clientTenantId,
        alertId: persisted.id,
        type: "SEND_ALERT",
        status: "SENT",
        payload: {
          hotel: row.hotel,
          city: row.city,
          suspectedCause: row.suspectedCause,
          causeLabel: row.causeLabel,
          variancePct: row.variancePct,
          estimatedLoss: row.estimatedLoss,
          periodLabel,
          emailTemplate: {
            subject: `Verificação urgente — carregamento de tarifa ${row.hotel}`,
            body:
              `Olá,\n\nIdentificamos ${row.affectedBookings} de ${row.totalBookings} reservas em ${row.hotel} ` +
              `durante ${periodLabel} com ADR ${fmtPct(row.variancePct)} acima do valor contratado ` +
              `(negociado ${fmtBrl(row.negotiatedAdr)}, realizado ${fmtBrl(row.realizedAdr)}). ` +
              `Impacto estimado: ${fmtBrl(row.estimatedLoss)}.\n\n` +
              `Causa suspeita: ${row.causeLabel}.\n\n` +
              `Solicitamos:\n` +
              `1) Confirmar carregamento da tarifa negociada em todos os canais (GDS, direto, agências)\n` +
              `2) Validar se há blackout ativo ou LRA não respeitada\n` +
              `3) Revisar disponibilidade da tarifa nas datas afetadas\n\n` +
              `Use o link de resposta para confirmar a revisão e anexar evidências (screenshots de carregamento). ` +
              `A confirmação encerra o alerta automaticamente.\n\nObrigado.`,
          },
        },
      });
      toast.success(`Alerta enviado — ${row.hotel} na Watchlist`);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao enviar alerta.");
    } finally {
      setBusySig(null);
    }
  };

  const handleIgnore = async (row: RateLoadingRow) => {
    if (!clientTenantId) return;
    const sig = rateLoadingSignature(periodLabel, row);
    setBusySig(sig);
    try {
      await upsertDerivedAlerts(clientTenantId, [
        {
          signature: sig,
          type: "RATE_LOADING",
          severity: row.severity,
          title: `Falha de carregamento de tarifa — ${row.hotel}`,
          description: `${row.city} · ${row.affectedBookings}/${row.totalBookings} reservas acima do negociado · ${row.causeLabel}`,
          impactedCity: row.city,
          impactedHotel: row.hotel,
          financialImpact: row.estimatedLoss,
          metadata: {
            negotiatedAdr: row.negotiatedAdr,
            realizedAdr: row.realizedAdr,
            variancePct: row.variancePct,
            affectedBookings: row.affectedBookings,
            totalBookings: row.totalBookings,
            affectedRn: row.affectedRn,
            estimatedLoss: row.estimatedLoss,
            suspectedCause: row.suspectedCause,
            causeLabel: row.causeLabel,
            periodLabel,
          },
        },
      ]);
      const persisted = useDecisionStore.getState().alerts.find((a) => a.signature === sig);
      if (persisted) {
        await createAction({
          clientTenantId,
          alertId: persisted.id,
          type: "IGNORE",
          status: "IGNORED",
          payload: {
            hotel: row.hotel,
            city: row.city,
            estimatedLoss: row.estimatedLoss,
            periodLabel,
            reason: "Ignorado pelo usuário a partir do Decision Center",
          },
        });
        await setAlertStatus(persisted.id, "dismissed");
        toast.success("Ignorado — registrado na Watchlist para auditoria.");
      } else {
        toast.success("Linha ignorada.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Falha ao ignorar alerta.");
    } finally {
      setBusySig(null);
    }
  };

  const visibleRows = useMemo(() => {
    return summary.rows.filter((row) => {
      const sig = rateLoadingSignature(periodLabel, row);
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
            <Zap className="h-4 w-4 text-warning-foreground" />
            <h2 className="text-base font-semibold text-foreground">
              Falha de carregamento de tarifa
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
              <AlertTriangle className="h-3 w-3" />
              {summary.flaggedHotels} {summary.flaggedHotels === 1 ? "hotel" : "hotéis"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.affectedBookings} reservas com tarifa acima do contratado · perda estimada {fmtUsd(summary.totalLoss)}
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
                <th className="px-3 py-2 text-left font-semibold">Causa suspeita</th>
                <th className="px-3 py-2 text-right font-semibold">Reservas</th>
                <th className="px-3 py-2 text-right font-semibold">Variação</th>
                <th className="px-3 py-2 text-right font-semibold">Perda</th>
                <th className="px-3 py-2 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Sem falhas de carregamento ativas.
                  </td>
                </tr>
              )}
              {visibleRows.map((row) => {
                const sig = rateLoadingSignature(periodLabel, row);
                const persisted = persistedBySig.get(sig);
                const tracked = persisted ? openActionByAlert.has(persisted.id) : false;
                return (
                  <RateLoadingRowItem
                    key={sig}
                    row={row}
                    tracked={tracked}
                    busy={busySig === sig}
                    onSend={() => handleSend(row)}
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

function RateLoadingRowItem({
  row,
  tracked,
  busy,
  onSend,
  onIgnore,
}: {
  row: RateLoadingRow;
  tracked: boolean;
  busy: boolean;
  onSend: () => void;
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
        <td className="px-3 py-2 text-xs text-muted-foreground">{row.causeLabel}</td>
        <td className="px-3 py-2 text-right text-muted-foreground">
          {row.affectedBookings}/{row.totalBookings}
        </td>
        <td className={`px-3 py-2 text-right font-semibold ${tone}`}>{fmtPct(row.variancePct)}</td>
        <td className="px-3 py-2 text-right text-muted-foreground">{fmtUsd(row.estimatedLoss)}</td>
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
                  disabled={busy}
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
          <td colSpan={7} className="px-3 py-3">
            <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
              <div>
                <p className="font-semibold uppercase tracking-wider text-muted-foreground">
                  Comparativo de tarifa
                </p>
                <p className="mt-1 text-foreground">
                  Negociado <strong>{fmtBrl(row.negotiatedAdr)}</strong> · Realizado{" "}
                  <strong>{fmtBrl(row.realizedAdr)}</strong>
                </p>
                <p className="mt-1 text-muted-foreground">
                  {row.affectedRn.toLocaleString("pt-BR")} room nights afetados ·{" "}
                  <span className={`font-semibold ${tone}`}>{row.severity.toUpperCase()}</span>
                </p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wider text-muted-foreground">
                  Diagnóstico
                </p>
                <p className="mt-1 text-foreground">{row.causeLabel}</p>
                <p className="mt-1 text-muted-foreground">
                  Ao enviar o alerta, o hotel recebe um link para confirmar carregamento e anexar
                  evidências; o histórico fica disponível na Watchlist.
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
