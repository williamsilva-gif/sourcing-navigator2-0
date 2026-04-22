import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { IMPACT_TIMELINE } from "./decisionData";

export function ImpactTracking() {
  const last = IMPACT_TIMELINE[IMPACT_TIMELINE.length - 1];
  const variance = last.actual - last.expected;
  const variancePct = last.expected > 0 ? (variance / last.expected) * 100 : 0;
  const positive = variance >= 0;

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Impact tracking</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Savings esperados vs realizados após execução das ações
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-md border border-border bg-background px-3 py-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Esperado
            </p>
            <p className="text-sm font-semibold text-foreground">US$ {last.expected}k</p>
          </div>
          <div className="rounded-md border border-border bg-background px-3 py-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Realizado
            </p>
            <p className="text-sm font-semibold text-success">US$ {last.actual}k</p>
          </div>
          <div
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              positive ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"
            }`}
          >
            <TrendingUp className={`h-3 w-3 ${positive ? "" : "rotate-180"}`} />
            {positive ? "+" : ""}
            {variancePct.toFixed(1)}% vs esperado
          </div>
        </div>
      </div>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={IMPACT_TIMELINE} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
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
              formatter={(v: number, name: string) => [
                `$${v}k`,
                name === "expected" ? "Esperado" : "Realizado",
              ]}
            />
            <Legend
              verticalAlign="top"
              height={28}
              iconType="circle"
              wrapperStyle={{ fontSize: "12px" }}
              formatter={(v) => (v === "expected" ? "Esperado" : "Realizado")}
            />
            <Line
              type="monotone"
              dataKey="expected"
              stroke="oklch(0.7 0.02 254)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="oklch(0.62 0.17 148)"
              strokeWidth={2.5}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Ações concluídas
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">7</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Em execução
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">3</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Hit-rate forecast
          </p>
          <p className="mt-1 text-sm font-semibold text-success">105.7%</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Tempo médio
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">14 dias</p>
        </div>
      </div>
    </section>
  );
}
