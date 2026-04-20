import { createFileRoute } from "@tanstack/react-router";
import { DollarSign, TrendingUp, FileText, AlertTriangle, Calendar } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SavingsChart } from "@/components/dashboard/SavingsChart";
import { ComplianceGauge } from "@/components/dashboard/ComplianceGauge";
import { ActiveRfps } from "@/components/dashboard/ActiveRfps";
import { TopOpportunities } from "@/components/dashboard/TopOpportunities";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SourcingHub" },
      {
        name: "description",
        content:
          "Visão consolidada de savings, compliance e RFPs ativos do programa de hotel sourcing corporativo.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Dashboard Overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Bom dia, Marina
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aqui está o resumo do programa Acme Travel Corp · Ano fiscal 2025
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            YTD 2025
          </button>
          <button
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
          label="RFPs ativos"
          value="14"
          delta={-2.5}
          deltaLabel="vs trimestre anterior"
          icon={FileText}
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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SavingsChart />
        </div>
        <ComplianceGauge />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActiveRfps />
        <TopOpportunities />
      </div>
    </AppShell>
  );
}
