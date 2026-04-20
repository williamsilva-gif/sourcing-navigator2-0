import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { FileText, Plus, Send, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { RfpProgramList } from "@/components/rfp/RfpProgramList";
import { HotelResponseTracker } from "@/components/rfp/HotelResponseTracker";
import { CreateRfpWizard } from "@/components/rfp/CreateRfpWizard";
import { RfpDetailModal } from "@/components/rfp/RfpDetailModal";
import { RFP_PROGRAMS, RFP_INVITED_HOTELS, type RfpProgram } from "@/components/rfp/rfpProgramData";

function RfpPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selected, setSelected] = useState<RfpProgram | null>(null);

  const stats = useMemo(() => {
    const active = RFP_PROGRAMS.filter(
      (r) => r.status !== "Encerrado" && r.status !== "Rascunho",
    ).length;
    const totalInvited = RFP_PROGRAMS.reduce((s, r) => s + r.invitedHotels, 0);
    const totalResponses = RFP_PROGRAMS.reduce((s, r) => s + r.responsesReceived, 0);
    const responseRate = totalInvited > 0 ? Math.round((totalResponses / totalInvited) * 100) : 0;
    const pending = RFP_INVITED_HOTELS.filter((h) => h.status === "Não respondeu").length;
    const upcoming = RFP_PROGRAMS.filter((r) => {
      const d = Math.ceil(
        (new Date(r.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      return d > 0 && d <= 14 && r.status !== "Encerrado";
    }).length;
    return { active, responseRate, pending, upcoming };
  }, []);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Módulo</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <FileText className="h-6 w-6 text-primary" />
            RFP
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Criação multi-etapa de RFPs, distribuição automatizada para hotéis e
            gestão centralizada de respostas com prazos e lembretes.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo RFP
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          icon={Send}
          label="RFPs ativos"
          value={String(stats.active)}
          hint={`de ${RFP_PROGRAMS.length} totais`}
          tone="primary"
        />
        <Kpi
          icon={CheckCircle2}
          label="Taxa de resposta"
          value={`${stats.responseRate}%`}
          hint="média ponderada"
          tone={stats.responseRate >= 70 ? "success" : "warning"}
        />
        <Kpi
          icon={AlertCircle}
          label="Hotéis pendentes"
          value={String(stats.pending)}
          hint="sem resposta"
          tone={stats.pending > 0 ? "destructive" : "default"}
        />
        <Kpi
          icon={Calendar}
          label="Prazos próximos"
          value={String(stats.upcoming)}
          hint="vencem em ≤14 dias"
          tone={stats.upcoming > 0 ? "warning" : "default"}
        />
      </div>

      <div className="space-y-6">
        <RfpProgramList onView={(r) => setSelected(r)} />
        <HotelResponseTracker />
      </div>

      <CreateRfpWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <RfpDetailModal rfp={selected} onClose={() => setSelected(null)} />

      {/* hidden helper to ensure toast is registered if needed elsewhere */}
      <span className="hidden" aria-hidden onClick={() => toast.info("")} />
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
  icon: typeof FileText;
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

export const Route = createFileRoute("/rfp")({
  head: () => ({
    meta: [
      { title: "RFP — SourcingHub" },
      { name: "description", content: "Criação multi-etapa de RFPs, distribuição para hotéis e gestão centralizada de respostas." },
    ],
  }),
  component: RfpPage,
});
