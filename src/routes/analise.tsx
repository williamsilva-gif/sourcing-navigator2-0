import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { RfpComparisonTable } from "@/components/analise/RfpComparisonTable";

export const Route = createFileRoute("/analise")({
  head: () => ({
    meta: [
      { title: "Análise — SourcingHub" },
      {
        name: "description",
        content:
          "Análise comparativa de respostas de RFP por hotel: scoring, ADR, compliance e drill-down.",
      },
    ],
  }),
  component: AnalisePage,
});

function AnalisePage() {
  return (
    <AppShell>
      <div className="space-y-6">
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Análise comparativa de RFP
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Scoring ponderado · 30 respostas recebidas · ciclo Q1 2025
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.success("Análise exportada em PDF")}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar análise
          </button>
        </div>
      </header>

      <RfpComparisonTable />
      </div>
    </AppShell>
  );
}