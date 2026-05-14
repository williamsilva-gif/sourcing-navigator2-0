import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  delta: number | null;
  deltaLabel?: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "info";
}

const toneMap = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-foreground",
  info: "bg-info-soft text-info",
} as const;

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel = "vs período anterior",
  icon: Icon,
  tone = "primary",
}: KpiCardProps) {
  const hasDelta = delta !== null && Number.isFinite(delta);
  const positive = hasDelta && (delta as number) >= 0;
  return (
    <div className="group rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {hasDelta ? (
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              positive ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"
            }`}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta as number).toFixed(1)}%
          </div>
        ) : (
          <div
            className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
            title="Sem histórico para comparar"
          >
            —
          </div>
        )}
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{deltaLabel}</p>
    </div>
  );
}