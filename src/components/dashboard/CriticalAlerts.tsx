import { useMemo } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowRight,
  TrendingDown,
  MapPin,
  Wifi,
  Building2,
  Layers,
  Wallet,
} from "lucide-react";
import { useCockpitAlerts, type CockpitModule } from "@/lib/cockpitAlerts";
import type { PeriodWindow } from "@/lib/periodFilter";

interface Props {
  onViewRecommendation?: (opportunityId?: string) => void;
  window?: PeriodWindow | null;
}

type Severity = "high" | "medium" | "low";

const severityConfig: Record<
  Severity,
  { label: string; icon: typeof AlertTriangle; badge: string; ring: string; iconTone: string }
> = {
  high: {
    label: "Crítico",
    icon: AlertTriangle,
    badge: "bg-destructive-soft text-destructive",
    ring: "border-l-destructive",
    iconTone: "text-destructive",
  },
  medium: {
    label: "Atenção",
    icon: AlertCircle,
    badge: "bg-warning-soft text-warning-foreground",
    ring: "border-l-warning",
    iconTone: "text-warning-foreground",
  },
  low: {
    label: "Informativo",
    icon: Info,
    badge: "bg-info-soft text-info",
    ring: "border-l-info",
    iconTone: "text-info",
  },
};

const moduleConfig: Record<
  CockpitModule,
  { icon: typeof TrendingDown; tone: string; soft: string; shortTag: string }
> = {
  ADR_VARIANCE: {
    icon: TrendingDown,
    tone: "text-destructive",
    soft: "bg-destructive-soft text-destructive",
    shortTag: "Financeiro",
  },
  SMART_LEAKAGE: {
    icon: MapPin,
    tone: "text-warning-foreground",
    soft: "bg-warning-soft text-warning-foreground",
    shortTag: "Comportamental",
  },
  RATE_LOADING: {
    icon: Wifi,
    tone: "text-primary",
    soft: "bg-primary-soft text-primary",
    shortTag: "Operacional",
  },
  HOTEL_UNDERPERFORMANCE: {
    icon: Building2,
    tone: "text-warning-foreground",
    soft: "bg-warning-soft text-warning-foreground",
    shortTag: "Operacional",
  },
  HOTEL_DEPENDENCY: {
    icon: Layers,
    tone: "text-primary",
    soft: "bg-primary-soft text-primary",
    shortTag: "Estratégico",
  },
  SAVINGS_MISSED: {
    icon: Wallet,
    tone: "text-info",
    soft: "bg-info-soft text-info",
    shortTag: "Financeiro",
  },
};

function scrollToAnchor(anchorId: string) {
  const el = document.getElementById(anchorId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  // Brief highlight
  el.classList.add("ring-2", "ring-primary/40", "ring-offset-2");
  window.setTimeout(() => {
    el.classList.remove("ring-2", "ring-primary/40", "ring-offset-2");
  }, 1600);
}

export function CriticalAlerts({ window: periodWindow }: Props) {
  const alerts = useCockpitAlerts(periodWindow ?? null);

  const sorted = useMemo(() => alerts, [alerts]);
  const criticalCount = sorted.filter((a) => a.severity === "high").length;

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-destructive" />
            <h2 className="text-base font-semibold text-foreground">Alertas críticos</h2>
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
              Live · 6 engines
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {sorted.length === 0
              ? "Nenhum módulo operacional acionado no período"
              : `${sorted.length} módulos com sinal — clique para abrir o card operacional`}
          </p>
        </div>
        {criticalCount > 0 && (
          <span className="rounded-full bg-destructive-soft px-2.5 py-1 text-xs font-semibold text-destructive">
            {criticalCount} críticos
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          Tudo dentro dos thresholds operacionais. Os 6 módulos abaixo continuam monitorando em tempo real.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {sorted.map((alert) => {
            const sev = severityConfig[alert.severity];
            const mod = moduleConfig[alert.module];
            const ModuleIcon = mod.icon;
            return (
              <li
                key={alert.module}
                className={`flex flex-col gap-3 rounded-md border border-border border-l-4 bg-background p-4 ${sev.ring} transition-shadow`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${mod.soft}`}>
                      <ModuleIcon className={`h-4 w-4 ${mod.tone}`} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${mod.soft}`}>
                          {alert.moduleLabel}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {mod.shortTag}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-foreground">{alert.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sev.badge}`}
                  >
                    {sev.label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="truncate text-xs font-medium text-foreground">{alert.metric}</span>
                  <button
                    onClick={() => scrollToAnchor(alert.anchorId)}
                    className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover"
                  >
                    Abrir módulo
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
