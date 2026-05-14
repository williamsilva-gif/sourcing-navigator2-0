import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { DollarSign, TrendingUp, Activity, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { CriticalAlerts } from "@/components/dashboard/CriticalAlerts";
import { OpportunitiesList } from "@/components/dashboard/OpportunitiesList";
import { RecommendedActionsModal } from "@/components/dashboard/RecommendedActionsModal";
import { ActiveActions } from "@/components/dashboard/ActiveActions";
import { ImpactTracking } from "@/components/dashboard/ImpactTracking";
import { useDecisionData, type Opportunity } from "@/components/dashboard/decisionData";
import { useSnapshotStore, timeAgo, daysUntilNextEval } from "@/lib/snapshotStore";
import { useAuth, getPrimaryRole, landingForRole } from "@/hooks/useAuth";
import { PeriodSelector } from "@/components/common/PeriodSelector";
import { Rfp2026Plan } from "@/components/dashboard/Rfp2026Plan";
import { useBaselineStore, selectKpis } from "@/lib/baselineStore";
import {
  defaultPeriod,
  filterByWindow,
  previousWindow,
  safeDelta,
  windowFor,
  type Granularity,
} from "@/lib/periodFilter";

const periodSearchSchema = z.object({
  grain: fallback(z.enum(["year", "quarter", "month", "custom"]), "year").default("year"),
  period: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(periodSearchSchema),
  head: () => ({
    meta: [
      { title: "Decision Center — SourcingHub" },
      {
        name: "description",
        content:
          "Centro de decisão contínua: alertas, oportunidades priorizadas e acompanhamento de impacto do programa de hotel sourcing.",
      },
    ],
  }),
  component: DashboardPage,
});

function fmtBrl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function DashboardPage() {
  const navigate = useNavigate({ from: "/" });
  const search = Route.useSearch();
  const { ready, user, roles } = useAuth();
  const allBookings = useBaselineStore((s) => s.bookings);
  const contracts = useBaselineStore((s) => s.contracts);

  // Resolve period: search params take priority, otherwise default from data.
  const fallbackPeriod = useMemo(() => defaultPeriod(allBookings), [allBookings]);
  const grain: Granularity = search.grain;
  const period = search.period || fallbackPeriod.period;

  const currentWindow = useMemo(() => windowFor(grain, period), [grain, period]);
  const prevWindow = useMemo(() => (currentWindow ? previousWindow(currentWindow) : null), [currentWindow]);

  const currentBookings = useMemo(() => filterByWindow(allBookings, currentWindow), [allBookings, currentWindow]);
  const previousBookings = useMemo(() => filterByWindow(allBookings, prevWindow), [allBookings, prevWindow]);

  const currentKpis = useMemo(() => selectKpis(currentBookings, contracts), [currentBookings, contracts]);
  const previousKpis = useMemo(() => selectKpis(previousBookings, contracts), [previousBookings, contracts]);
  const previousHasData = previousBookings.length > 0;

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const b of allBookings) {
      const y = Number(b.checkin?.slice(0, 4));
      if (Number.isFinite(y)) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [allBookings]);

  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { opportunities, source } = useDecisionData(currentWindow);
  const evaluate = useSnapshotStore((s) => s.evaluate);
  const evaluatedAt = useSnapshotStore((s) => s.evaluatedAt);
  const current = useSnapshotStore((s) => s.current);

  // Route guard: redirect by role once session is restored.
  useEffect(() => {
    if (!ready) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    const primary = getPrimaryRole(roles);
    if (primary && primary.startsWith("hotel_")) {
      navigate({ to: landingForRole(primary) });
    }
  }, [ready, user, roles, navigate]);

  // Initial evaluation on mount so deltas have a baseline to compare against.
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current && !current) {
      didInit.current = true;
      evaluate();
    }
  }, [current, evaluate]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const openOpportunity = (opp: Opportunity) => {
    setSelectedOpp(opp);
    setModalOpen(true);
  };

  const openByOpportunityId = (id?: string) => {
    const opp = opportunities.find((o: Opportunity) => o.id === id) ?? opportunities[0];
    if (opp) openOpportunity(opp);
  };

  const handleReevaluate = () => {
    evaluate();
    const next = useSnapshotStore.getState().current;
    const prev = useSnapshotStore.getState().previous;
    const newAlerts = next && prev ? next.alerts.filter((a) => !prev.alerts.some((p) => p.id === a.id)).length : next?.alerts.length ?? 0;
    const newOpps = next && prev ? next.opportunities.filter((o) => !prev.opportunities.some((p) => p.id === o.id)).length : next?.opportunities.length ?? 0;
    toast.success(`Recomendações atualizadas · ${newAlerts} novos alertas · ${newOpps} oportunidades`);
  };

  const daysNext = daysUntilNextEval(evaluatedAt);

  // Deltas — null when previous window has no bookings.
  const spendDelta = previousHasData ? safeDelta(currentKpis.totalSpend, previousKpis.totalSpend) : null;
  const adrDelta = previousHasData ? safeDelta(currentKpis.adr, previousKpis.adr) : null;
  const rnDelta = previousHasData ? safeDelta(currentKpis.totalRn, previousKpis.totalRn) : null;
  // For leakage we want delta in pp (percentage points), not relative.
  const leakageDelta = previousHasData ? currentKpis.leakagePct - previousKpis.leakagePct : null;

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Decision Center</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Bom dia, Marina
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {opportunities.length} oportunidades · fonte: {source === "baseline" ? "baseline carregado" : source === "demo" ? "demo" : "vazio"} · janela: {currentWindow?.label ?? "—"} · última avaliação {timeAgo(evaluatedAt)}
            {evaluatedAt && ` · próxima em ${daysNext}d`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector
            grain={grain}
            period={period}
            availableYears={availableYears}
            onChange={(next) => navigate({ search: () => ({ grain: next.grain, period: next.period }) })}
          />
          <button
            onClick={handleReevaluate}
            className="flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            Reavaliar
          </button>
          <button
            onClick={() => toast.success("Relatório executivo gerado em PDF")}
            className="h-10 rounded-md px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--gradient-primary)" }}
          >
            Exportar relatório
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Spend no período"
          value={fmtBrl(currentKpis.totalSpend)}
          delta={spendDelta}
          icon={DollarSign}
          tone="success"
        />
        <KpiCard
          label="ADR médio"
          value={fmtBrl(currentKpis.adr)}
          delta={adrDelta}
          icon={TrendingUp}
          tone="primary"
        />
        <KpiCard
          label="Room nights"
          value={currentKpis.totalRn.toLocaleString("pt-BR")}
          delta={rnDelta}
          icon={Activity}
          tone="info"
        />
        <KpiCard
          label="Leakage detectado"
          value={`${currentKpis.leakagePct.toFixed(1)}%`}
          delta={leakageDelta}
          deltaLabel={leakageDelta === null ? "sem histórico" : "vs período anterior (pp)"}
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <div className="mt-6 space-y-6">
        <CriticalAlerts onViewRecommendation={openByOpportunityId} />

        <OpportunitiesList onTakeAction={openOpportunity} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <ActiveActions />
          </div>
          <div className="lg:col-span-3">
            <ImpactTracking />
          </div>
        </div>
      </div>

      <RecommendedActionsModal
        opportunity={selectedOpp}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </AppShell>
  );
}
