import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DollarSign, TrendingUp, Activity, AlertTriangle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { CriticalAlerts } from "@/components/dashboard/CriticalAlerts";
import { OpportunitiesList } from "@/components/dashboard/OpportunitiesList";
import { RecommendedActionsModal } from "@/components/dashboard/RecommendedActionsModal";
import { ActiveActions } from "@/components/dashboard/ActiveActions";
import { ImpactTracking } from "@/components/dashboard/ImpactTracking";
import { OPPORTUNITIES, type Opportunity } from "@/components/dashboard/decisionData";

export const Route = createFileRoute("/")({
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

function DashboardPage() {
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openOpportunity = (opp: Opportunity) => {
    setSelectedOpp(opp);
    setModalOpen(true);
  };

  const openByOpportunityId = (id?: string) => {
    const opp = OPPORTUNITIES.find((o) => o.id === id) ?? OPPORTUNITIES[0];
    if (opp) openOpportunity(opp);
  };

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Decision Center</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Bom dia, Marina
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            5 oportunidades pendentes · 3 ações em execução · US$ 412k em jogo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.info("Período YTD 2025 selecionado")}
            className="flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
          >
            <Calendar className="h-4 w-4 text-muted-foreground" />
            YTD 2025
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
          label="Savings YTD"
          value="$2.41M"
          delta={18.4}
          icon={DollarSign}
          tone="success"
        />
        <KpiCard
          label="Compliance médio"
          value="87.2%"
          delta={3.1}
          icon={TrendingUp}
          tone="primary"
        />
        <KpiCard
          label="Ações em execução"
          value="3"
          delta={50}
          deltaLabel="vs semana anterior"
          icon={Activity}
          tone="info"
        />
        <KpiCard
          label="Leakage detectado"
          value="$184k"
          delta={-12.7}
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
