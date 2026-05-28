import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { DollarSign, TrendingUp, Activity, Percent, RefreshCw, Loader2, Bell } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useDecisionData } from "@/components/dashboard/decisionData";
import { useSnapshotStore, timeAgo, daysUntilNextEval } from "@/lib/snapshotStore";
import { useAuth, getPrimaryRole, landingForRole } from "@/hooks/useAuth";
import { PeriodSelector } from "@/components/common/PeriodSelector";
import { useBaselineStore, selectKpis } from "@/lib/baselineStore";
import { useClientsStore } from "@/lib/clientsStore";
import { WatchlistPanel } from "@/components/decision/WatchlistPanel";
import { CriticalAlerts } from "@/components/dashboard/CriticalAlerts";
import { AdrVarianceCard } from "@/components/decision/AdrVarianceCard";
import { SmartLeakageCard } from "@/components/decision/SmartLeakageCard";
import { RateLoadingCard } from "@/components/decision/RateLoadingCard";
import { HotelUnderperformanceCard } from "@/components/decision/HotelUnderperformanceCard";
import { HotelDependencyCard } from "@/components/decision/HotelDependencyCard";
import { SavingsMissedCard } from "@/components/decision/SavingsMissedCard";
import { useDecisionHydration } from "@/hooks/useDecisionHydration";
import { useDecisionStore } from "@/lib/decisionStore";
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
          "Centro de decisão contínua: alertas operacionais, Watchlist persistente e acompanhamento de impacto do programa de hotel sourcing.",
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

  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const { alerts: derivedAlerts, opportunities, source } = useDecisionData(currentWindow);
  const evaluate = useSnapshotStore((s) => s.evaluate);
  const evaluatedAt = useSnapshotStore((s) => s.evaluatedAt);
  const current = useSnapshotStore((s) => s.current);

  const clientTenantId = useClientsStore((s) => s.selectedClientId) || null;
  useDecisionHydration(clientTenantId, derivedAlerts);
  const openWatchlistCount = useDecisionStore((s) => {
    const openActionIds = new Set(
      s.actions.filter((a) => a.status !== "COMPLETED" && a.status !== "IGNORED").map((a) => a.id),
    );
    return s.watchlist.filter((w) => openActionIds.has(w.action_id)).length;
  });

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

  const handleReevaluate = () => {
    evaluate();
    const next = useSnapshotStore.getState().current;
    const prev = useSnapshotStore.getState().previous;
    const newAlerts = next && prev ? next.alerts.filter((a) => !prev.alerts.some((p) => p.id === a.id)).length : next?.alerts.length ?? 0;
    const newOpps = next && prev ? next.opportunities.filter((o) => !prev.opportunities.some((p) => p.id === o.id)).length : next?.opportunities.length ?? 0;
    toast.success(`Recomendações atualizadas · ${newAlerts} novos alertas · ${newOpps} oportunidades`);
  };

  const daysNext = daysUntilNextEval(evaluatedAt);

  const spendDelta = previousHasData ? safeDelta(currentKpis.totalSpend, previousKpis.totalSpend) : null;
  const adrDelta = previousHasData ? safeDelta(currentKpis.adr, previousKpis.adr) : null;
  const rnDelta = previousHasData ? safeDelta(currentKpis.totalRn, previousKpis.totalRn) : null;
  // Savings YoY = (previousADR - currentADR) / previousADR * 100
  // Positive = economia (ADR caiu). Negativo = ADR subiu.
  const savingsYoYPct =
    previousHasData && previousKpis.adr > 0
      ? ((previousKpis.adr - currentKpis.adr) / previousKpis.adr) * 100
      : null;

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Decision Center</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Bom dia, Marina
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {opportunities.length} oportunidades · fonte: {source === "baseline" ? "baseline carregado" : source === "demo" ? "demo" : "vazio"} · última avaliação {timeAgo(evaluatedAt)}
            {evaluatedAt && ` · próxima em ${daysNext}d`}
          </p>
          <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs">
            <span className="font-semibold text-foreground">Atual:</span>
            <span className="rounded bg-primary-soft px-1.5 py-0.5 font-medium text-primary">
              {currentWindow?.label ?? "—"}
            </span>
            <span className="text-muted-foreground">
              {currentBookings.length.toLocaleString("pt-BR")} bookings
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-semibold text-foreground">Comparando com:</span>
            {previousHasData && prevWindow ? (
              <>
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                  {prevWindow.label}
                </span>
                <span className="text-muted-foreground">
                  {previousBookings.length.toLocaleString("pt-BR")} bookings
                </span>
              </>
            ) : (
              <span className="rounded bg-muted px-1.5 py-0.5 italic text-muted-foreground">
                sem histórico
              </span>
            )}
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {contracts.length} contratos vigentes
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector
            grain={grain}
            period={period}
            availableYears={availableYears}
            onChange={(next) => navigate({ search: () => ({ grain: next.grain, period: next.period }) })}
          />
          <button
            onClick={() => setWatchlistOpen(true)}
            className="relative flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
          >
            <Bell className="h-4 w-4 text-muted-foreground" />
            Watchlist
            {openWatchlistCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {openWatchlistCount}
              </span>
            )}
          </button>
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
          label="Savings YoY"
          value={savingsYoYPct === null ? "—" : `${savingsYoYPct.toFixed(1)}%`}
          delta={savingsYoYPct}
          deltaLabel={
            savingsYoYPct === null
              ? "sem histórico"
              : `ADR anterior ${fmtBrl(previousKpis.adr)} → atual ${fmtBrl(currentKpis.adr)}`
          }
          icon={Percent}
          tone={savingsYoYPct === null ? "primary" : savingsYoYPct >= 0 ? "success" : "warning"}
        />
      </div>

      <div className="mt-6 space-y-6">
        <CriticalAlerts alerts={derivedAlerts} />
        <AdrVarianceCard window={currentWindow} />
        <SmartLeakageCard window={currentWindow} />
        <RateLoadingCard window={currentWindow} />
        <HotelUnderperformanceCard window={currentWindow} />
        <HotelDependencyCard window={currentWindow} />
        <SavingsMissedCard window={currentWindow} />
      </div>

      <WatchlistPanel
        open={watchlistOpen}
        onOpenChange={setWatchlistOpen}
        clientTenantId={clientTenantId}
      />
    </AppShell>
  );
}
