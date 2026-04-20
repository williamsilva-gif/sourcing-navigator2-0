const value = 87;
const radius = 70;
const circ = 2 * Math.PI * radius;
const dash = (value / 100) * circ * 0.75; // 3/4 arc

export function ComplianceGauge() {
  const tone =
    value >= 90 ? "text-success" : value >= 70 ? "text-warning-foreground" : "text-destructive";
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Compliance Rate</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">Aderência ao programa</p>
      </div>

      <div className="relative flex items-center justify-center py-2">
        <svg width="180" height="160" viewBox="0 0 180 160">
          <g transform="rotate(135 90 90)">
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="oklch(0.93 0.01 247)"
              strokeWidth="12"
              strokeDasharray={`${circ * 0.75} ${circ}`}
              strokeLinecap="round"
            />
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="oklch(0.62 0.17 148)"
              strokeWidth="12"
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
          <span className={`text-4xl font-semibold tracking-tight ${tone}`}>{value}%</span>
          <span className="mt-0.5 text-xs text-muted-foreground">Meta: 90%</span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Tier 1</p>
          <p className="mt-0.5 text-sm font-semibold text-success">94%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tier 2</p>
          <p className="mt-0.5 text-sm font-semibold text-warning-foreground">82%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tier 3</p>
          <p className="mt-0.5 text-sm font-semibold text-destructive">68%</p>
        </div>
      </div>
    </div>
  );
}