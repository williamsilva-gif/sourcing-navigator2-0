import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";

// Distribution of bookings by ADR bucket (USD), with city cap reference at $280
const cap = 280;
const data = [
  { bucket: "120-150", count: 412, mid: 135 },
  { bucket: "150-180", count: 689, mid: 165 },
  { bucket: "180-210", count: 1240, mid: 195 },
  { bucket: "210-240", count: 1820, mid: 225 },
  { bucket: "240-270", count: 2130, mid: 255 },
  { bucket: "270-300", count: 1640, mid: 285 },
  { bucket: "300-330", count: 980, mid: 315 },
  { bucket: "330-360", count: 520, mid: 345 },
  { bucket: "360-390", count: 240, mid: 375 },
  { bucket: "390+", count: 110, mid: 405 },
];

const total = data.reduce((s, d) => s + d.count, 0);
const overCap = data.filter((d) => d.mid > cap).reduce((s, d) => s + d.count, 0);
const overCapPct = ((overCap / total) * 100).toFixed(1);

export function AdrHistogram() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Distribuição de ADR vs city cap
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Reservas por faixa de ADR (USD) — cap médio do programa: ${cap}
          </p>
        </div>
        <div className="shrink-0 self-start rounded-md bg-destructive-soft px-3 py-1.5 text-right">
          <p className="text-[10px] font-medium uppercase tracking-wider text-destructive">
            Acima do cap
          </p>
          <p className="font-mono text-sm font-semibold text-destructive">
            {overCapPct}% · {overCap.toLocaleString("pt-BR")} reservas
          </p>
        </div>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.01 247)" vertical={false} />
            <XAxis
              dataKey="bucket"
              stroke="oklch(0.45 0.03 254)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="oklch(0.45 0.03 254)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
            />
            <Tooltip
              cursor={{ fill: "oklch(0.96 0.005 247)" }}
              contentStyle={{
                backgroundColor: "oklch(1 0 0)",
                border: "1px solid oklch(0.91 0.01 247)",
                borderRadius: "6px",
                fontSize: "12px",
                boxShadow: "0 4px 12px -2px oklch(0 0 0 / 0.08)",
              }}
              formatter={(v: number) => [`${v.toLocaleString("pt-BR")} reservas`, "Volume"]}
            />
            <ReferenceLine
              x="270-300"
              stroke="oklch(0.58 0.22 25)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Cap $${cap}`,
                position: "top",
                fill: "oklch(0.58 0.22 25)",
                fontSize: 11,
                fontWeight: 600,
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell
                  key={d.bucket}
                  fill={d.mid > cap ? "oklch(0.58 0.22 25)" : "oklch(0.49 0.18 258)"}
                  fillOpacity={d.mid > cap ? 0.85 : 0.9}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
          Dentro do cap
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-destructive" />
          Acima do cap (leakage)
        </div>
        <div className="ml-auto font-mono tabular-nums text-foreground">
          Total: {total.toLocaleString("pt-BR")} reservas
        </div>
      </div>
    </div>
  );
}