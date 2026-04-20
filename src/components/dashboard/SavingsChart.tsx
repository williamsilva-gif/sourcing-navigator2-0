import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const data = [
  { month: "Jan", actual: 142, target: 120 },
  { month: "Fev", actual: 168, target: 140 },
  { month: "Mar", actual: 195, target: 160 },
  { month: "Abr", actual: 178, target: 180 },
  { month: "Mai", actual: 224, target: 200 },
  { month: "Jun", actual: 261, target: 220 },
  { month: "Jul", actual: 248, target: 240 },
  { month: "Ago", actual: 295, target: 260 },
  { month: "Set", actual: 312, target: 280 },
];

export function SavingsChart() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Savings acumulados vs meta
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Evolução mensal em milhares de USD
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-secondary p-0.5 text-xs font-medium">
          {["7D", "30D", "Trim", "Anual"].map((p) => (
            <button
              key={p}
              className={`rounded px-2.5 py-1 transition-colors ${
                p === "Anual"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.49 0.18 258)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="oklch(0.49 0.18 258)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.01 247)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="oklch(0.45 0.03 254)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="oklch(0.45 0.03 254)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(1 0 0)",
                border: "1px solid oklch(0.91 0.01 247)",
                borderRadius: "6px",
                fontSize: "12px",
                boxShadow: "0 4px 12px -2px oklch(0 0 0 / 0.08)",
              }}
              formatter={(v: number) => [`$${v}k`, ""]}
            />
            <Area
              type="monotone"
              dataKey="target"
              stroke="oklch(0.7 0.02 254)"
              strokeDasharray="4 4"
              fill="none"
              strokeWidth={1.5}
              name="Meta"
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="oklch(0.49 0.18 258)"
              strokeWidth={2.5}
              fill="url(#actualGrad)"
              name="Realizado"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}