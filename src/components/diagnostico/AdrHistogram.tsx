import { useMemo, useState } from "react";
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
import { useBaselineStore, selectAdrDistributionByCity, selectCityAggregates } from "@/lib/baselineStore";
import { formatBRL } from "@/lib/utils";

export function AdrHistogram() {
  const bookings = useBaselineStore((s) => s.bookings);
  const isLive = bookings.length > 0;

  // Cities sorted by RNs desc — top one is the default selection.
  const cityOptions = useMemo(() => selectCityAggregates(bookings), [bookings]);
  const defaultCity = cityOptions[0]?.city ?? "__all__";
  const [city, setCity] = useState<string>(defaultCity);

  // Reset to default when baseline changes
  useMemo(() => {
    if (city !== defaultCity && !cityOptions.find((c) => c.city === city)) {
      setCity(defaultCity);
    }
  }, [defaultCity, city, cityOptions]);

  if (!isLive) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Sem dados de bookings — carregue um arquivo no painel de ingestão.
      </div>
    );
  }

  const { buckets: data, cap, total } = selectAdrDistributionByCity(bookings, city);
  const overCap = data.filter((d) => d.mid > cap).reduce((s, d) => s + d.count, 0);
  const overCapPct = total > 0 ? ((overCap / total) * 100).toFixed(1) : "0.0";

  const capBucket =
    data.find((d) => cap >= parseInt(d.bucket.split("-")[0], 10) && cap < parseInt(d.bucket.split("-")[1] ?? "9999", 10))
      ?.bucket ?? data[Math.min(data.length - 1, Math.floor((cap - 120) / 30))]?.bucket;

  const cityLabel = city === "__all__" ? "Todas as cidades" : city;

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">
            Distribuição de ADR vs city cap
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Reservas por faixa de ADR (BRL) — {cityLabel} · cap calculado: {formatBRL(cap)} · baseline carregado
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs">
            <span className="font-medium text-muted-foreground">Cidade</span>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {cityOptions.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city} · {c.roomNights.toLocaleString("pt-BR")} RN
                </option>
              ))}
              <option value="__all__">— Todas as cidades —</option>
            </select>
          </label>
          <div className="shrink-0 self-start rounded-md bg-destructive-soft px-3 py-1.5 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-destructive">
              Acima do cap
            </p>
            <p className="font-mono text-sm font-semibold text-destructive">
              {overCapPct}% · {overCap.toLocaleString("pt-BR")} reservas
            </p>
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
          Sem reservas para {cityLabel} no baseline.
        </div>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.01 247)" vertical={false} />
              <XAxis dataKey="bucket" stroke="oklch(0.45 0.03 254)" fontSize={11} tickLine={false} axisLine={false} />
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
              {capBucket && (
                <ReferenceLine
                  x={capBucket}
                  stroke="oklch(0.58 0.22 25)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Cap ${formatBRL(cap)}`,
                    position: "top",
                    fill: "oklch(0.58 0.22 25)",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
              )}
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
      )}

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
