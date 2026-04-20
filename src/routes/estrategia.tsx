import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Target, MapPin, Layers, ShieldCheck, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TieringMatrix } from "@/components/estrategia/TieringMatrix";
import { CityCapsTable } from "@/components/estrategia/CityCapsTable";
import { ClusterSegmentation } from "@/components/estrategia/ClusterSegmentation";
import { BusinessRulesPanel } from "@/components/estrategia/BusinessRulesPanel";
import { CITY_STRATEGY, CLUSTERS, BUSINESS_RULES } from "@/components/estrategia/strategyData";

function StrategiaPage() {
  const stats = useMemo(() => {
    const cities = CITY_STRATEGY.length;
    const overCap = CITY_STRATEGY.filter((c) => c.currentAdr > c.capAdr).length;
    const strategicHotels = CLUSTERS.find((c) => c.type === "Strategic")?.hotels ?? 0;
    const totalHotels = CLUSTERS.reduce((s, c) => s + c.hotels, 0);
    const activeRules = BUSINESS_RULES.filter((r) => r.active).length;
    return { cities, overCap, strategicHotels, totalHotels, activeRules };
  }, []);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Módulo</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Target className="h-6 w-6 text-primary" />
            Estratégia
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Definição de tiering por cidade, configuração de city caps e
            segmentação de clusters de hotéis com regras de sourcing automatizadas.
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={MapPin} label="Cidades estratégicas" value={String(stats.cities)} hint={`${stats.overCap} acima do cap`} tone={stats.overCap > 0 ? "warning" : "default"} />
        <Kpi icon={Layers} label="Hotéis no programa" value={String(stats.totalHotels)} hint={`${stats.strategicHotels} strategic`} tone="primary" />
        <Kpi icon={ShieldCheck} label="Regras ativas" value={String(stats.activeRules)} hint={`de ${BUSINESS_RULES.length} regras`} tone="success" />
        <Kpi icon={AlertTriangle} label="Caps em revisão" value={String(stats.overCap)} hint="cidades com ADR > cap" tone={stats.overCap > 0 ? "destructive" : "default"} />
      </div>

      <div className="space-y-6">
        <TieringMatrix />
        <CityCapsTable />
        <ClusterSegmentation />
        <BusinessRulesPanel />
      </div>
    </AppShell>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: typeof Target;
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "success" | "primary" | "warning" | "destructive";
}) {
  const valueCls =
    tone === "success" ? "text-success" :
    tone === "primary" ? "text-primary" :
    tone === "warning" ? "text-warning" :
    tone === "destructive" ? "text-destructive" :
    "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-1.5 text-2xl font-semibold ${valueCls}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export const Route = createFileRoute("/estrategia")({
  head: () => ({
    meta: [
      { title: "Estratégia — SourcingHub" },
      { name: "description", content: "Tiering por cidade, city caps configuráveis e segmentação de clusters de hotéis com regras de negócio automatizadas." },
    ],
  }),
  component: StrategiaPage,
});