import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BedDouble,
  DollarSign,
  Building2,
  TrendingDown,
  AlertTriangle,
  Stethoscope,
  Download,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { CityHeatmap } from "@/components/diagnostico/CityHeatmap";
import { AdrHistogram } from "@/components/diagnostico/AdrHistogram";
import { DataIngestionPanel } from "@/components/diagnostico/DataIngestionPanel";
import { useBaselineStore, selectKpis } from "@/lib/baselineStore";

export const Route = createFileRoute("/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico — SourcingHub" },
      { name: "description", content: "Diagnóstico do programa de hotelaria corporativa." },
    ],
  }),
  component: DiagnosticoPage,
});

function DiagnosticoPage() {
  const [period, setPeriod] = useState<"30D" | "Trim" | "12M" | "YTD">("12M");
  const bookings = useBaselineStore((s) => s.bookings);
  const isLive = bookings.length > 0;
  const live = selectKpis(bookings);

  const fmtBRLFull = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const fmtN = (n: number) =>
    new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

  return (
    <AppShell>
      <div className="space-y-6">
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Diagnóstico do programa
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isLive
                ? `Baseline real · ${bookings.length.toLocaleString("pt-BR")} bookings carregados · período ${period}`
                : `Sem baseline · carregue um arquivo abaixo`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-md border border-border bg-secondary p-0.5 text-xs font-medium">
            {(["30D", "Trim", "12M", "YTD"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded px-2.5 py-1 transition-colors ${
                  p === period
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={() => toast.success(`Baseline ${period} exportado em PDF`)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar baseline
          </button>
        </div>
      </header>

      <DataIngestionPanel />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Room nights"
          value={isLive ? fmtN(live.totalRn) : "53.6k"}
          delta={4.2}
          deltaLabel="vs ano anterior"
          icon={BedDouble}
          tone="primary"
        />
        <KpiCard
          label="Spend total"
          value={isLive ? fmtBRLFull(live.totalSpend) : "R$ 15.700.000,00"}
          delta={6.8}
          deltaLabel="vs ano anterior"
          icon={DollarSign}
          tone="info"
        />
        <KpiCard
          label="ADR médio"
          value={isLive ? fmtBRLFull(live.adr) : "R$ 293,00"}
          delta={2.1}
          deltaLabel="vs ano anterior"
          icon={TrendingDown}
          tone="warning"
        />
        <KpiCard
          label="Hotéis ativos"
          value={isLive ? String(live.hotels) : "156"}
          delta={-3.4}
          deltaLabel="consolidação de cauda"
          icon={Building2}
          tone="success"
        />
        <KpiCard
          label="Leakage estimado"
          value={isLive ? `${live.leakagePct.toFixed(1)}%` : "18.4%"}
          delta={-1.6}
          deltaLabel="vs trimestre anterior"
          icon={AlertTriangle}
          tone="warning"
        />
      </section>

      <CityHeatmap />

      <AdrHistogram />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InsightCard
          tone="destructive"
          title="Concentração geográfica elevada"
          body="São Paulo e Rio concentram 53% do room nights. Considere diversificar fornecedores secundários para reduzir dependência."
        />
        <InsightCard
          tone="warning"
          title="34% das reservas acima do cap"
          body="Faixas R$ 300+ representam leakage potencial de R$ 1,9 mi/ano. Revisão de city caps recomendada para Q2."
        />
        <InsightCard
          tone="info"
          title="Cauda longa de fornecedores"
          body="42 hotéis representam menos de 0.5% do volume cada. Oportunidade de consolidação para ganhar volume em parceiros estratégicos."
        />
      </section>
      </div>
    </AppShell>
  );
}

function InsightCard({
  tone,
  title,
  body,
}: {
  tone: "destructive" | "warning" | "info";
  title: string;
  body: string;
}) {
  const map = {
    destructive: "border-l-destructive bg-destructive-soft/40",
    warning: "border-l-warning bg-warning-soft/40",
    info: "border-l-info bg-info-soft/40",
  } as const;
  return (
    <div
      className={`rounded-lg border border-border border-l-4 bg-card p-5 shadow-[var(--shadow-card)] ${map[tone]}`}
    >
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}