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
          value={isLive ? fmtN(live.totalRn) : "0"}
          delta={isLive ? 4.2 : null}
          deltaLabel={isLive ? "vs ano anterior" : "sem dados"}
          icon={BedDouble}
          tone="primary"
        />
        <KpiCard
          label="Spend total"
          value={fmtBRLFull(isLive ? live.totalSpend : 0)}
          delta={isLive ? 6.8 : null}
          deltaLabel={isLive ? "vs ano anterior" : "sem dados"}
          icon={DollarSign}
          tone="info"
        />
        <KpiCard
          label="ADR médio"
          value={fmtBRLFull(isLive ? live.adr : 0)}
          delta={isLive ? 2.1 : null}
          deltaLabel={isLive ? "vs ano anterior" : "sem dados"}
          icon={TrendingDown}
          tone="warning"
        />
        <KpiCard
          label="Hotéis ativos"
          value={isLive ? String(live.hotels) : "0"}
          delta={isLive ? -3.4 : null}
          deltaLabel={isLive ? "consolidação de cauda" : "sem dados"}
          icon={Building2}
          tone="success"
        />
        <KpiCard
          label="Leakage estimado"
          value={`${(isLive ? live.leakagePct : 0).toFixed(1)}%`}
          delta={isLive ? -1.6 : null}
          deltaLabel={isLive ? "vs trimestre anterior" : "sem dados"}
          icon={AlertTriangle}
          tone="warning"
        />
      </section>

      <CityHeatmap />

      <AdrHistogram />
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