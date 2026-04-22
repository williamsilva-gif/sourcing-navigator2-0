import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtUsd, type Opportunity, type Effort } from "./decisionData";

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

const moduleRoutes = {
  negociacao: "/negociacao",
  estrategia: "/estrategia",
  rfp: "/rfp",
  selecao: "/selecao",
} as const;

export function RecommendedActionsModal({ opportunity, open, onOpenChange }: Props) {
  const navigate = useNavigate();

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
            return (
              <li
                key={action.id}
                className="flex flex-col gap-3 rounded-md border border-border bg-background p-4 sm:flex-row sm:items-center"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{action.label}</p>
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
                <button
                  onClick={() => {
                    toast.success("Ação executada", {
                      description: `Encaminhado para ${moduleRoutes[action.module]}`,
                    });
                    onOpenChange(false);
                    navigate({ to: moduleRoutes[action.module] });
                  }}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Executar
                </button>
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
