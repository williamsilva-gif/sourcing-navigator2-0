import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Loader2, Activity } from "lucide-react";
import { ACTIVE_ACTIONS, fmtUsd, type ActionStatus } from "./decisionData";

const statusConfig: Record<
  ActionStatus,
  { label: string; icon: typeof Loader2; className: string }
> = {
  in_progress: {
    label: "Em andamento",
    icon: Loader2,
    className: "bg-info-soft text-info",
  },
  completed: {
    label: "Concluída",
    icon: CheckCircle2,
    className: "bg-success-soft text-success",
  },
};

const moduleRoutes = {
  negociacao: "/negociacao",
  estrategia: "/estrategia",
  rfp: "/rfp",
} as const;

export function ActiveActions() {
  const navigate = useNavigate();
  const inProgress = ACTIVE_ACTIONS.filter((a) => a.status === "in_progress").length;
  const totalExpected = ACTIVE_ACTIONS.reduce((s, a) => s + a.expectedSavings, 0);

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Ações em execução</h2>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {inProgress} ativas · {fmtUsd(totalExpected)} esperados
          </p>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {ACTIVE_ACTIONS.map((action) => {
          const cfg = statusConfig[action.status];
          const Icon = cfg.icon;
          return (
            <li
              key={action.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{action.type}</p>
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.className}`}
                  >
                    <Icon
                      className={`h-2.5 w-2.5 ${
                        action.status === "in_progress" ? "animate-spin" : ""
                      }`}
                    />
                    {cfg.label}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {action.city} · {action.startedAt}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-success">
                  +{fmtUsd(action.expectedSavings)}
                </p>
                <button
                  onClick={() => navigate({ to: moduleRoutes[action.module] })}
                  className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-medium text-primary hover:text-primary-hover"
                >
                  Abrir módulo
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
