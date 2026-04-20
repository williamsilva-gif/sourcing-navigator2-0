import { Network, Crown, Star, Activity, XCircle } from "lucide-react";
import { CLUSTERS, type ClusterDefinition } from "./strategyData";

const ICONS: Record<ClusterDefinition["type"], typeof Crown> = {
  Strategic: Crown,
  Preferred: Star,
  Tactical: Activity,
  Drop: XCircle,
};

const TONE: Record<ClusterDefinition["color"], { card: string; bar: string; chip: string }> = {
  primary: { card: "border-primary/30 bg-primary-soft/40", bar: "bg-primary", chip: "bg-primary text-primary-foreground" },
  info: { card: "border-info/30 bg-info-soft/40", bar: "bg-info", chip: "bg-info text-info-foreground" },
  warning: { card: "border-warning/30 bg-warning-soft/40", bar: "bg-warning", chip: "bg-warning text-warning-foreground" },
  destructive: { card: "border-destructive/30 bg-destructive-soft/40", bar: "bg-destructive", chip: "bg-destructive text-destructive-foreground" },
};

export function ClusterSegmentation() {
  const total = CLUSTERS.reduce((s, c) => s + c.hotels, 0);
  return (
    <section className="rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Segmentação de clusters de hotéis</h2>
            <p className="text-xs text-muted-foreground">{total} hotéis classificados em 4 clusters de sourcing</p>
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
        {CLUSTERS.map((c) => {
          const Icon = ICONS[c.type];
          const tone = TONE[c.color as keyof typeof TONE];
          return (
            <article key={c.type} className={`flex flex-col gap-3 rounded-lg border p-4 ${tone.card}`}>
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${tone.chip}`}>
                  <Icon className="h-3.5 w-3.5" />{c.type}
                </span>
                <span className="text-2xl font-semibold tabular-nums text-foreground">{c.hotels}</span>
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">{c.rule}</p>
              <div className="space-y-2">
                <Bar label="Room nights" value={c.rnShare} tone={tone.bar} />
                <Bar label="Spend" value={c.spendShare} tone={tone.bar} />
              </div>
              <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-[11px]">
                <div>
                  <p className="text-muted-foreground">RFP</p>
                  <p className="font-semibold text-foreground">{c.rfpFrequency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Negociação</p>
                  <p className="font-semibold text-foreground">{c.negotiationDepth}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Bar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}