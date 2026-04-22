import { AlertTriangle, AlertCircle, Info, ArrowRight } from "lucide-react";
import { CRITICAL_ALERTS, type Severity } from "./decisionData";

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
  const sorted = [...CRITICAL_ALERTS].sort((a, b) => {
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
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {sorted.length} thresholds violados — ação recomendada
          </p>
        </div>
        <span className="rounded-full bg-destructive-soft px-2.5 py-1 text-xs font-semibold text-destructive">
          {sorted.filter((a) => a.severity === "high").length} críticos
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {sorted.map((alert) => {
          const cfg = severityConfig[alert.severity];
          const Icon = cfg.icon;
          return (
            <li
              key={alert.id}
              className={`flex flex-col gap-3 rounded-md border border-border border-l-4 bg-background p-4 ${cfg.ring}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Icon className={`mt-0.5 h-4 w-4 ${cfg.badge.split(" ")[1]}`} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{alert.title}</p>
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
    </section>
  );
}
