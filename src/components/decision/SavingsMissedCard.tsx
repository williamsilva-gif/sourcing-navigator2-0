import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  XCircle,
  Check,
  Wallet,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { useBaselineStore } from "@/lib/baselineStore";
import { useClientsStore } from "@/lib/clientsStore";
import { useDecisionStore } from "@/lib/decisionStore";
import { filterByWindow, type PeriodWindow } from "@/lib/periodFilter";
import {
  computeSavingsMissed,
  savingsMissedSignature,
} from "@/lib/savingsMissedAnalysis";
import { computeHotelUnderperformance } from "@/lib/hotelUnderperformanceAnalysis";
import { fmtUsd } from "@/components/dashboard/decisionData";

interface Props {
  window: PeriodWindow | null;
}

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function SavingsMissedCard({ window }: Props) {
  const allBookings = useBaselineStore((s) => s.bookings);
  const contracts = useBaselineStore((s) => s.contracts);
  const clientTenantId = useClientsStore((s) => s.selectedClientId);

  const bookings = useMemo(
    () => (window ? filterByWindow(allBookings, window) : allBookings),
    [allBookings, window],
  );

  const underperf = useMemo(
    () => computeHotelUnderperformance(bookings, contracts),
    [bookings, contracts],
  );

  const summary = useMemo(
    () =>
      computeSavingsMissed(
        bookings,
        contracts,
        underperf.totalMissedSpend,
        underperf.totalGapRn,
      ),
    [bookings, contracts, underperf],
  );

  const persistedAlerts = useDecisionStore((s) => s.alerts);
  const actions = useDecisionStore((s) => s.actions);
  const upsertDerivedAlerts = useDecisionStore((s) => s.upsertDerivedAlerts);
  const createAction = useDecisionStore((s) => s.createAction);
  const setAlertStatus = useDecisionStore((s) => s.setAlertStatus);

  const periodLabel = window?.label ?? "all";
  const sig = savingsMissedSignature(periodLabel);
  const persisted = useMemo(
    () => persistedAlerts.find((a) => a.signature === sig) ?? null,
    [persistedAlerts, sig],
  );
  const tracked = useMemo(() => {
    if (!persisted) return false;
    return actions.some(
      (a) =>
        a.alert_id === persisted.id && a.status !== "COMPLETED" && a.status !== "IGNORED",
    );
  }, [persisted, actions]);

  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  if (bookings.length === 0 || summary.totalMissed <= 0) return null;
  if (persisted && persisted.status === "dismissed") return null;

  const ensureAlert = async () => {
    if (!clientTenantId) {
      toast.error("Selecione um cliente.");
      return null;
    }
    await upsertDerivedAlerts(clientTenantId, [
      {
        signature: sig,
        type: "SAVINGS_MISSED",
        severity: summary.totalMissed > 100_000 ? "high" : summary.totalMissed > 25_000 ? "medium" : "low",
        title: `Savings não capturados — ${fmtUsd(summary.totalMissed)}`,
        description: `${fmtUsd(summary.outOfDirectoryAmount)} fora do diretório · ${fmtUsd(summary.underperformanceAmount)} de subutilização`,
        impactedCity: summary.topCity,
        impactedHotel: null,
        financialImpact: summary.totalMissed,
        metadata: {
          breakdown: summary.breakdown,
          outOfDirectoryBookings: summary.outOfDirectoryBookings,
          outOfDirectoryRn: summary.outOfDirectoryRn,
          underperformanceRn: summary.underperformanceRn,
          periodLabel,
        },
      },
    ]);
    return useDecisionStore.getState().alerts.find((a) => a.signature === sig) ?? null;
  };

  const handleAlertAM = async () => {
    setBusy(true);
    try {
      const p = await ensureAlert();
      if (!p || !clientTenantId) return;
      await createAction({
        clientTenantId,
        alertId: p.id,
        type: "SEND_ALERT",
        status: "SENT",
        payload: {
          totalMissed: summary.totalMissed,
          breakdown: summary.breakdown,
          topCity: summary.topCity,
          periodLabel,
          emailTemplate: {
            subject: `Savings não capturados — ${periodLabel} (${fmtUsd(summary.totalMissed)})`,
            body:
              `Equipe Account Management,\n\nO programa deixou de capturar ${fmtUsd(summary.totalMissed)} no período ${periodLabel}.\n\n` +
              `Composição:\n` +
              `· Fora do diretório: ${fmtUsd(summary.outOfDirectoryAmount)} ` +
              `(${summary.outOfDirectoryBookings.toLocaleString("pt-BR")} reservas · ${summary.outOfDirectoryRn.toLocaleString("pt-BR")} RN)\n` +
              `· Underperformance de hotéis contratados: ${fmtUsd(summary.underperformanceAmount)} ` +
              `(${Math.round(summary.underperformanceRn).toLocaleString("pt-BR")} RN abaixo do esperado)\n\n` +
              (summary.topCity ? `Cidade de maior impacto: ${summary.topCity}.\n\n` : "") +
              `Sugestão: priorizar reforço de adoção e revisão do diretório nas cidades de maior leakage.\n\n` +
              `Use o link de resposta para anexar plano de ação.`,
          },
        },
      });
      toast.success("Account Manager alertado — adicionado à Watchlist");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao enviar alerta.");
    } finally {
      setBusy(false);
    }
  };

  const handleIgnore = async () => {
    setBusy(true);
    try {
      const p = persisted ?? (await ensureAlert());
      if (!p || !clientTenantId) {
        toast.success("Card arquivado.");
        return;
      }
      await createAction({
        clientTenantId,
        alertId: p.id,
        type: "IGNORE",
        status: "IGNORED",
        payload: {
          totalMissed: summary.totalMissed,
          topCity: summary.topCity,
          periodLabel,
          reason: "Ignorado pelo usuário a partir do Decision Center",
        },
      });
      await setAlertStatus(p.id, "dismissed");
      toast.success("Ignorado — registrado na Watchlist para auditoria.");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao ignorar alerta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="module-savings-missed" className="scroll-mt-24 rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-shadow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-info" />
            <h2 className="text-base font-semibold text-foreground">Savings não capturados</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-semibold text-info">
              informativo
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Estimativa total {fmtUsd(summary.totalMissed)}
            {summary.topCity && ` · principal cidade: ${summary.topCity}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tracked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-semibold text-success">
              <Check className="h-3 w-3" /> Na Watchlist
            </span>
          ) : (
            <>
              <button
                onClick={handleAlertAM}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-card px-2.5 text-xs font-semibold text-foreground hover:border-primary/40 disabled:opacity-40"
              >
                <Mail className="h-3 w-3" /> Alertar Account Manager
              </button>
              <button
                onClick={handleIgnore}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <XCircle className="h-3 w-3" /> Ignorar
              </button>
            </>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-8 items-center gap-1 rounded-md border border-input bg-card px-2.5 text-xs font-semibold text-foreground hover:border-primary/40"
          >
            {expanded ? "Recolher" : "Detalhes"}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          {summary.breakdown.map((b) => (
            <div
              key={b.source}
              className="rounded-md border border-border bg-muted/20 p-3 text-xs"
            >
              <p className="font-semibold uppercase tracking-wider text-muted-foreground">
                {b.label}
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {fmtBrl(b.amount)}
              </p>
              <p className="mt-1 text-muted-foreground">{b.detail}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
