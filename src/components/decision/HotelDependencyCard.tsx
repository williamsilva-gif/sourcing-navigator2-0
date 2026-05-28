import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  XCircle,
  Check,
  AlertTriangle,
  Network,
  FileText,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useBaselineStore } from "@/lib/baselineStore";
import { useClientsStore } from "@/lib/clientsStore";
import { useDecisionStore } from "@/lib/decisionStore";
import { useActionStore } from "@/lib/actionStore";
import { filterByWindow, type PeriodWindow } from "@/lib/periodFilter";
import {
  computeHotelDependency,
  dependencySignature,
  type DependencyRow,
} from "@/lib/hotelDependencyAnalysis";

interface Props {
  window: PeriodWindow | null;
}

export function HotelDependencyCard({ window }: Props) {
  const allBookings = useBaselineStore((s) => s.bookings);
  const contracts = useBaselineStore((s) => s.contracts);
  const clientTenantId = useClientsStore((s) => s.selectedClientId);

  const bookings = useMemo(
    () => (window ? filterByWindow(allBookings, window) : allBookings),
    [allBookings, window],
  );
  const summary = useMemo(
    () => computeHotelDependency(bookings, contracts),
    [bookings, contracts],
  );

  const persistedAlerts = useDecisionStore((s) => s.alerts);
  const actions = useDecisionStore((s) => s.actions);
  const upsertDerivedAlerts = useDecisionStore((s) => s.upsertDerivedAlerts);
  const createAction = useDecisionStore((s) => s.createAction);
  const setAlertStatus = useDecisionStore((s) => s.setAlertStatus);
  const executeAction = useActionStore((s) => s.executeAction);

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

  const ensureAlert = async (row: DependencyRow) => {
    if (!clientTenantId) {
      toast.error("Selecione um cliente.");
      return null;
    }
    const sig = dependencySignature(periodLabel, row);
    await upsertDerivedAlerts(clientTenantId, [
      {
        signature: sig,
        type: "HOTEL_DEPENDENCY",
        severity: row.severity,
        title: `Dependência alta — ${row.topHotel} (${row.concentrationPct.toFixed(0)}% em ${row.city})`,
        description: `${row.topHotelRn.toLocaleString("pt-BR")} de ${row.totalCityRn.toLocaleString("pt-BR")} RN concentrados em 1 hotel · ${row.contractedAlternatives} alternativas contratadas`,
        impactedCity: row.city,
        impactedHotel: row.topHotel,
        financialImpact: 0,
        metadata: {
          concentrationPct: row.concentrationPct,
          topHotelRn: row.topHotelRn,
          totalCityRn: row.totalCityRn,
          contractedAlternatives: row.contractedAlternatives,
          topHotelIsContracted: row.topHotelIsContracted,
          riskNotes: row.riskNotes,
          periodLabel,
        },
      },
    ]);
    return useDecisionStore.getState().alerts.find((a) => a.signature === sig) ?? null;
  };

  const handleMiniRfp = async (row: DependencyRow) => {
    const sig = dependencySignature(periodLabel, row);
    setBusySig(sig);
    try {
      const persisted = await ensureAlert(row);
      if (!persisted || !clientTenantId) return;
      await createAction({
        clientTenantId,
        alertId: persisted.id,
        type: "OPEN_MINI_RFP",
        status: "SENT",
        payload: {
          city: row.city,
          incumbentHotel: row.topHotel,
          concentrationPct: row.concentrationPct,
          targetHotels: 4,
          periodLabel,
          emailTemplate: {
            subject: `Mini-RFP — diversificação em ${row.city}`,
            body:
              `Equipe,\n\nDetectamos concentração de ${row.concentrationPct.toFixed(0)}% das reservas de ${row.city} em ${row.topHotel}. ` +
              `Abrimos uma mini-RFP para expandir o diretório local com até 4 hotéis adicionais, reduzir leverage do incumbente e ` +
              `proteger a continuidade operacional em caso de sold out.\n\n` +
              `Use o link de resposta para revisar shortlist, propor RFP focal e comentar a estratégia.`,
          },
        },
      });
      // Also push into the operational pipeline (mini_rfp store)
      executeAction({
        opportunityId: persisted.id,
        label: `Mini-RFP ${row.city}`,
        payload: { kind: "mini_rfp", data: { city: row.city, hotels: 4 } },
        effort: "medium",
        savingsExpected: 0,
        adrBefore: 0,
        complianceBefore: 0,
      });
      toast.success(`Mini-RFP aberta para ${row.city} — Watchlist e Pipeline atualizados`);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao abrir mini-RFP.");
    } finally {
      setBusySig(null);
    }
  };

  const handleAddToPipeline = async (row: DependencyRow) => {
    const sig = dependencySignature(periodLabel, row);
    setBusySig(sig);
    try {
      const persisted = await ensureAlert(row);
      if (!persisted || !clientTenantId) return;
      await createAction({
        clientTenantId,
        alertId: persisted.id,
        type: "ADD_TO_PIPELINE",
        status: "PENDING",
        payload: {
          city: row.city,
          incumbentHotel: row.topHotel,
          concentrationPct: row.concentrationPct,
          notes: "Aguardando priorização do gestor antes de abrir mini-RFP.",
          periodLabel,
        },
      });
      toast.success(`${row.city} adicionada ao pipeline de diversificação`);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao adicionar ao pipeline.");
    } finally {
      setBusySig(null);
    }
  };

  const handleIgnore = async (row: DependencyRow) => {
    if (!clientTenantId) return;
    const sig = dependencySignature(periodLabel, row);
    setBusySig(sig);
    try {
      const persisted = await ensureAlert(row);
      if (persisted) {
        await createAction({
          clientTenantId,
          alertId: persisted.id,
          type: "IGNORE",
          status: "IGNORED",
          payload: {
            hotel: row.topHotel,
            city: row.city,
            concentrationPct: row.concentrationPct,
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
      const sig = dependencySignature(periodLabel, row);
      const persisted = persistedBySig.get(sig);
      return !persisted || persisted.status !== "dismissed";
    });
  }, [summary.rows, persistedBySig, periodLabel]);

  if (summary.flaggedCities === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-warning-foreground" />
            <h2 className="text-base font-semibold text-foreground">
              Dependência excessiva de hotel
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
              <AlertTriangle className="h-3 w-3" />
              {summary.flaggedCities} {summary.flaggedCities === 1 ? "cidade" : "cidades"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Concentração máxima {summary.worstConcentrationPct.toFixed(0)}%
            {summary.worstCity && ` · ${summary.worstCity}`}
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
                <th className="px-3 py-2 text-left font-semibold">Cidade</th>
                <th className="px-3 py-2 text-left font-semibold">Hotel dominante</th>
                <th className="px-3 py-2 text-right font-semibold">Concentração</th>
                <th className="px-3 py-2 text-right font-semibold">Alternativas</th>
                <th className="px-3 py-2 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Sem dependência ativa.
                  </td>
                </tr>
              )}
              {visibleRows.map((row) => {
                const sig = dependencySignature(periodLabel, row);
                const persisted = persistedBySig.get(sig);
                const tracked = persisted ? openActionByAlert.has(persisted.id) : false;
                return (
                  <DepRow
                    key={sig}
                    row={row}
                    tracked={tracked}
                    busy={busySig === sig}
                    onMiniRfp={() => handleMiniRfp(row)}
                    onAddToPipeline={() => handleAddToPipeline(row)}
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

function DepRow({
  row,
  tracked,
  busy,
  onMiniRfp,
  onAddToPipeline,
  onIgnore,
}: {
  row: DependencyRow;
  tracked: boolean;
  busy: boolean;
  onMiniRfp: () => void;
  onAddToPipeline: () => void;
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
            {row.city}
          </button>
        </td>
        <td className="px-3 py-2 text-muted-foreground">
          {row.topHotel}
          {!row.topHotelIsContracted && (
            <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] font-semibold text-muted-foreground">
              fora do diretório
            </span>
          )}
        </td>
        <td className={`px-3 py-2 text-right font-semibold ${tone}`}>
          {row.concentrationPct.toFixed(0)}%
        </td>
        <td className="px-3 py-2 text-right text-muted-foreground">
          {row.contractedAlternatives}
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
                  onClick={onMiniRfp}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-semibold text-foreground hover:border-primary/40 disabled:opacity-40"
                >
                  <FileText className="h-3 w-3" />
                  Abrir mini-RFP
                </button>
                <button
                  onClick={onAddToPipeline}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-semibold text-foreground hover:border-primary/40 disabled:opacity-40"
                >
                  <PlusCircle className="h-3 w-3" />
                  Pipeline
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
          <td colSpan={5} className="px-3 py-3">
            <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
              <div>
                <p className="font-semibold uppercase tracking-wider text-muted-foreground">
                  Volume
                </p>
                <p className="mt-1 text-foreground">
                  {row.topHotelRn.toLocaleString("pt-BR")} RN no hotel dominante de{" "}
                  {row.totalCityRn.toLocaleString("pt-BR")} RN totais na cidade
                </p>
                <p className="mt-1 text-muted-foreground">
                  {row.bookings.toLocaleString("pt-BR")} reservas analisadas ·{" "}
                  <span className={`font-semibold ${tone}`}>{row.severity.toUpperCase()}</span>
                </p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wider text-muted-foreground">
                  Risco operacional
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-foreground">
                  {row.riskNotes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
