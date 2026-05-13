import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckSquare, FileSpreadsheet, FileDown, TrendingDown, Building2, MapPin, Calendar } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { AwardedMatrix } from "@/components/selecao/AwardedMatrix";
import { CoverageMap } from "@/components/selecao/CoverageMap";
import { AWARDED } from "@/components/selecao/selectionData";
import { exportPdf, exportXlsx } from "@/components/selecao/exportProgram";

function fmt$(n: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0); }

function SelecaoPage() {
  const stats = useMemo(() => {
    const total = AWARDED.length;
    const primaries = AWARDED.filter((h) => h.status === "primary").length;
    const cities = new Set(AWARDED.map((h) => h.city)).size;
    const nights = AWARDED.reduce((s, h) => s + h.roomNights, 0);
    const spend = AWARDED.reduce((s, h) => s + h.roomNights * h.finalAdr, 0);
    const baseline = AWARDED.reduce((s, h) => s + h.roomNights * h.startingAdr, 0);
    const savings = baseline - spend;
    const savingsPct = (savings / baseline) * 100;
    const weightedAdr = spend / nights;
    return { total, primaries, cities, nights, spend, savings, savingsPct, weightedAdr };
  }, []);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Módulo</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <CheckSquare className="h-6 w-6 text-primary" />
            Seleção
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Programa anual consolidado: hotéis selecionados, cobertura geográfica
            por cidade e exportação para PDF e Excel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportXlsx}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Exportar Excel
          </Button>
          <Button size="sm" onClick={exportPdf}>
            <FileDown className="h-3.5 w-3.5" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={Building2} label="Hotéis selecionados" value={String(stats.total)} hint={`${stats.primaries} primários`} />
        <Kpi icon={MapPin} label="Cidades cobertas" value={String(stats.cities)} hint="programa nacional" tone="primary" />
        <Kpi icon={Calendar} label="Room nights/ano" value={stats.nights.toLocaleString("pt-BR")} hint={`ADR ${fmt$(stats.weightedAdr)}`} />
        <Kpi icon={TrendingDown} label="Economia anual" value={fmt$(stats.savings)} hint={`${stats.savingsPct.toFixed(1)}% vs baseline`} tone="success" />
      </div>

      <div className="space-y-6">
        <AwardedMatrix />
        <CoverageMap />
      </div>
    </AppShell>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone = "default" }: { icon: typeof Building2; label: string; value: string; hint: string; tone?: "default" | "success" | "primary" }) {
  const valueCls = tone === "success" ? "text-success" : tone === "primary" ? "text-primary" : "text-foreground";
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

export const Route = createFileRoute("/selecao")({
  head: () => ({
    meta: [
      { title: "Seleção — SourcingHub" },
      { name: "description", content: "Programa anual consolidado com matriz de hotéis selecionados, cobertura geográfica e exportação para PDF/Excel." },
    ],
  }),
  component: SelecaoPage,
});
