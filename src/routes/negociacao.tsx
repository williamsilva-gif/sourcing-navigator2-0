import { createFileRoute } from "@tanstack/react-router";
import { Filter, Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { NegotiationKanban } from "@/components/negociacao/NegotiationKanban";
import { ActionInboxBanner } from "@/components/layout/ActionInboxBanner";
import { useClientsStore } from "@/lib/clientsStore";
import { useNegotiationLots, useNegotiationThreads } from "@/lib/demoRepos";

function NegociacaoPage() {
  const tenantId = useClientsStore((s) => s.selectedClientId);
  const { data: lots = [] } = useNegotiationLots(tenantId);
  const { data: threads = [] } = useNegotiationThreads(tenantId);

  const total = threads.length;
  const agreed = threads.filter((t) => t.status === "agreed").length;
  const pending = total - agreed;
  const avgDiscount = total
    ? (
        threads.reduce((s, t) => {
          const start = Number(t.starting_adr) || 0;
          const cur = Number(t.current_offer) || start;
          return s + (start > 0 ? ((start - cur) / start) * 100 : 0);
        }, 0) / total
      ).toFixed(1)
    : "0.0";
  const activeLots = lots.filter((l) => l.status !== "closed").length;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Módulo</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Negociação
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pipeline de propostas em rodadas de negociação organizadas por lote.
            Arraste cards entre as colunas para mover etapas.
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
        <KpiTile label="Threads ativas" value={String(total)} hint={`${pending} em aberto`} />
        <KpiTile label="Acordos fechados" value={String(agreed)} hint={total ? `${((agreed / total) * 100).toFixed(0)}% conversão` : "—"} tone="success" />
        <KpiTile label="Desconto médio" value={`${avgDiscount}%`} hint="vs proposta inicial" tone="success" />
        <KpiTile label="Lotes ativos" value={String(activeLots)} hint={`${lots.length} no total`} tone="primary" />
      </div>

      <ActionInboxBanner
        kinds={["renegotiation"]}
        title="Renegociações iniciadas pelo Decision Center"
      />

      <NegotiationKanban />
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