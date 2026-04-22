import { AlertTriangle, AlertCircle, Info, ArrowRight, Sparkles } from "lucide-react";
import { useDecisionData, type Severity, type CriticalAlert } from "./decisionData";
import { useSnapshotStore, deltaForAlert } from "@/lib/snapshotStore";

interface Props {
  onViewRecommendation: (opportunityId?: string) => void;
}

const severityConfig: Record<
  Severity,
  { label: string; icon: typeof AlertTriangle; badge: string; ring: string }
> = {
  high: {
    label: "Crítico",
    icon: AlertTriangle,
    badge: "bg-destructive-soft text-destructive",
    ring: "border-l-destructive",
  },
  medium: {
    label: "Atenção",
    icon: AlertCircle,
    badge: "bg-warning-soft text-warning-foreground",
    ring: "border-l-warning",
  },
  low: {
    label: "Informativo",
    icon: Info,
    badge: "bg-info-soft text-info",
    ring: "border-l-info",
  },
};

export function CriticalAlerts({ onViewRecommendation }: Props) {
  const { alerts, source } = useDecisionData();
  const current = useSnapshotStore((s) => s.current);
  const previous = useSnapshotStore((s) => s.previous);

  const sorted = [...alerts].sort((a: CriticalAlert, b: CriticalAlert) => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    return order[a.severity] - order[b.severity];
  });

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-destructive" />
            <h2 className="text-base font-semibold text-foreground">
              Alertas críticos
            </h2>
            {source === "baseline" && (
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                Live
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {sorted.length === 0
              ? "Nenhum threshold violado"
              : `${sorted.length} thresholds violados — ação recomendada`}
          </p>
        </div>
        {sorted.length > 0 && (
          <span className="rounded-full bg-destructive-soft px-2.5 py-1 text-xs font-semibold text-destructive">
            {sorted.filter((a) => a.severity === "high").length} críticos
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          Tudo dentro dos thresholds. Próxima reavaliação automática em até 7 dias.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {sorted.map((alert) => {
            const cfg = severityConfig[alert.severity];
            const Icon = cfg.icon;
            const delta = deltaForAlert(alert.id, current, previous);
            return (
              <li
                key={alert.id}
                className={`flex flex-col gap-3 rounded-md border border-border border-l-4 bg-background p-4 ${cfg.ring}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Icon className={`mt-0.5 h-4 w-4 ${cfg.badge.split(" ")[1]}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                        {delta.isNew && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                            <Sparkles className="h-2.5 w-2.5" />
                            Novo
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.badge}`}
                  >
                    {cfg.label}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs font-medium text-foreground">{alert.metric}</span>
                  <button
                    onClick={() => onViewRecommendation(alert.opportunityId)}
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover"
                  >
                    Ver recomendação
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
