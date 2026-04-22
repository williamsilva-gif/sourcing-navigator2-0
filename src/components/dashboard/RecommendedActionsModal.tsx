import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, Zap, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtUsd, type Opportunity, type Effort } from "./decisionData";
import { useActionStore, type ActionKind } from "@/lib/actionStore";

interface Props {
  opportunity: Opportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const effortConfig: Record<Effort, { label: string; className: string }> = {
  low: { label: "Esforço baixo", className: "bg-success-soft text-success" },
  medium: { label: "Esforço médio", className: "bg-warning-soft text-warning-foreground" },
  high: { label: "Esforço alto", className: "bg-destructive-soft text-destructive" },
};

const kindLabel: Record<ActionKind, string> = {
  renegotiation: "Renegociação",
  cap_adjustment: "Ajuste de cap",
  cluster_change: "Otimização de cluster",
  mini_rfp: "Mini-RFP",
  communication: "Comunicação",
};

const moduleRoutes = {
  negociacao: "/negociacao",
  estrategia: "/estrategia",
  rfp: "/rfp",
  selecao: "/selecao",
} as const;

const moduleForKind: Record<ActionKind, keyof typeof moduleRoutes> = {
  renegotiation: "negociacao",
  cap_adjustment: "estrategia",
  cluster_change: "estrategia",
  mini_rfp: "rfp",
  communication: "estrategia",
};

export function RecommendedActionsModal({ opportunity, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const executeAction = useActionStore((s) => s.executeAction);
  const executedActionIds = useActionStore((s) =>
    new Set(s.actions.map((a) => `${a.opportunityId}::${a.label}`))
  );

  if (!opportunity) return null;

  const totalImpact = opportunity.actions.reduce((s, a) => s + a.impact, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wider text-primary">
              Ações recomendadas
            </span>
          </div>
          <DialogTitle>{opportunity.scope}</DialogTitle>
          <DialogDescription>
            {opportunity.reason} · Potencial total: {fmtUsd(opportunity.savings)}
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-2 space-y-3">
          {opportunity.actions.map((action) => {
            const cfg = effortConfig[action.effort];
            const kind = action.payload.kind;
            const targetModule = moduleForKind[kind];
            const alreadyExecuted = executedActionIds.has(
              `${opportunity.id}::${action.label}`
            );

            const handleExecute = () => {
              const executed = executeAction({
                opportunityId: opportunity.id,
                label: action.label,
                payload: action.payload,
                effort: action.effort,
                savingsExpected: action.impact,
                adrBefore: opportunity.adrBefore,
                complianceBefore: opportunity.complianceBefore,
              });

              const sideEffectMsg: Record<ActionKind, string> = {
                renegotiation: `Batch criado em /negociacao com ${
                  action.payload.kind === "renegotiation" ? action.payload.data.hotels : 0
                } hotéis`,
                cap_adjustment: `Cap atualizado em /estrategia para ${
                  action.payload.kind === "cap_adjustment"
                    ? `US$ ${action.payload.data.toCap}`
                    : ""
                }`,
                cluster_change: `Cluster reorganizado em /estrategia`,
                mini_rfp: `Mini-RFP iniciado em /rfp`,
                communication: `Campanha de comunicação ativada`,
              };

              toast.success(`${kindLabel[kind]} iniciada`, {
                description: sideEffectMsg[kind],
                action: {
                  label: "Abrir módulo",
                  onClick: () => navigate({ to: moduleRoutes[targetModule] }),
                },
              });

              // Don't navigate away — let user execute multiple actions, monitor in dashboard
              void executed;
            };

            return (
              <li
                key={action.id}
                className="flex flex-col gap-3 rounded-md border border-border bg-background p-4 sm:flex-row sm:items-center"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {kindLabel[kind]}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      → {moduleRoutes[targetModule]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-foreground">{action.label}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
                      +{fmtUsd(action.impact)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.className}`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </div>
                {alreadyExecuted ? (
                  <span className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-success-soft px-3 py-2 text-xs font-semibold text-success">
                    <Sparkles className="h-3.5 w-3.5" />
                    Executada
                  </span>
                ) : (
                  <button
                    onClick={handleExecute}
                    className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Executar ação
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Soma das ações: <span className="font-semibold text-foreground">{fmtUsd(totalImpact)}</span>
          </p>
          <button
            onClick={() => onOpenChange(false)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
