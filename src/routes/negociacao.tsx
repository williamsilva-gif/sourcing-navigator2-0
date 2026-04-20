import { createFileRoute } from "@tanstack/react-router";
import { Filter, Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { NegotiationKanban } from "@/components/negociacao/NegotiationKanban";
import { ReverseAuction } from "@/components/negociacao/ReverseAuction";
import { NEGOTIATIONS } from "@/components/negociacao/negotiationData";

function NegociacaoPage() {
  const total = NEGOTIATIONS.length;
  const agreed = NEGOTIATIONS.filter((n) => n.stage === "agreed").length;
  const pending = total - agreed;
  const avgDiscount = (
    NEGOTIATIONS.reduce((s, n) => s + n.discount, 0) / total
  ).toFixed(1);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Módulo</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Negociação
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Acompanhe o pipeline de propostas em rodadas de negociação e leilões
            reversos ao vivo. Arraste cards entre as colunas para mover etapas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info("Filtros: aplicado priority=Alta")}>
            <Filter className="h-3.5 w-3.5" />
            Filtros
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.success("Pipeline exportado em CSV")}>
            <Download className="h-3.5 w-3.5" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Negociações ativas" value={String(total)} hint={`${pending} em aberto`} />
        <KpiTile label="Acordos fechados" value={String(agreed)} hint={`${((agreed / total) * 100).toFixed(0)}% conversão`} tone="success" />
        <KpiTile label="Desconto médio" value={`${avgDiscount}%`} hint="vs proposta inicial" tone="success" />
        <KpiTile label="Lotes em leilão" value="3" hint="2 ao vivo" tone="primary" />
      </div>

      <NegotiationKanban />
      <ReverseAuction />
    </AppShell>
  );
}

function KpiTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "success" | "primary";
}) {
  const valueCls =
    tone === "success"
      ? "text-success"
      : tone === "primary"
        ? "text-primary"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1.5 text-2xl font-semibold ${valueCls}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export const Route = createFileRoute("/negociacao")({
  head: () => ({
    meta: [
      { title: "Negociação — SourcingHub" },
      {
        name: "description",
        content:
          "Pipeline kanban de propostas de hotéis com rodadas de negociação e leilões reversos ao vivo.",
      },
    ],
  }),
  component: NegociacaoPage,
});