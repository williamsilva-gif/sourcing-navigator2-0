import { useState, useMemo } from "react";
import { ArrowUpDown, Building2 } from "lucide-react";
import { CITY_STRATEGY, TIER_META, PRIORITY_META, type Tier, type CityStrategy } from "./strategyData";

const TIERS: Tier[] = ["Luxury", "Upscale", "Midscale", "Economy"];

function fmt$(n: number) { return `$${Math.round(n).toLocaleString("en-US")}`; }
function fmtN(n: number) { return n.toLocaleString("pt-BR"); }

export function TieringMatrix() {
  const [overrides, setOverrides] = useState<Record<string, Tier>>({});
  const [sortBy, setSortBy] = useState<keyof CityStrategy>("roomNights");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const merged = CITY_STRATEGY.map((c) => ({ ...c, tier: overrides[c.city] ?? c.tier }));
    return [...merged].sort((a, b) => {
      const av = a[sortBy] as number | string;
      const bv = b[sortBy] as number | string;
      const cmp = typeof av === "number" ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
      return dir === "asc" ? cmp : -cmp;
    });
  }, [overrides, sortBy, dir]);

  function toggleSort(col: keyof CityStrategy) {
    if (sortBy === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setDir("desc"); }
  }

  return (
    <section className="rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Tiering por cidade</h2>
            <p className="text-xs text-muted-foreground">{rows.length} cidades · clique no tier para reclassificar</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {TIERS.map((t) => (
            <span key={t} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium ${TIER_META[t].bg} ${TIER_META[t].fg}`}>
              {t} <span className="opacity-60">{TIER_META[t].rangeAdr}</span>
            </span>
          ))}
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Th label="Cidade" onClick={() => toggleSort("city")} />
              <Th label="UF" />
              <Th label="Tier sugerido" />
              <Th label="Room nights" align="right" onClick={() => toggleSort("roomNights")} />
              <Th label="ADR atual" align="right" onClick={() => toggleSort("currentAdr")} />
              <Th label="Cap" align="right" />
              <Th label="Hotéis" align="right" onClick={() => toggleSort("hotels")} />
              <Th label="Share" align="right" onClick={() => toggleSort("marketShare")} />
              <Th label="Prioridade" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.city} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-foreground">{r.city}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.state}</td>
                <td className="px-4 py-3">
                  <select
                    value={r.tier}
                    onChange={(e) => setOverrides((o) => ({ ...o, [r.city]: e.target.value as Tier }))}
                    className={`rounded-md border border-border px-2 py-1 text-xs font-semibold ${TIER_META[r.tier].bg} ${TIER_META[r.tier].fg} focus:outline-none focus:ring-2 focus:ring-primary/30`}
                  >
                    {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">{fmtN(r.roomNights)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">{fmt$(r.currentAdr)}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${r.currentAdr > r.capAdr ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                  {fmt$(r.capAdr)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.hotels}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.marketShare.toFixed(1)}%</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_META[r.priority].bg} ${PRIORITY_META[r.priority].fg}`}>
                    {r.priority}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ label, align = "left", onClick }: { label: string; align?: "left" | "right"; onClick?: () => void }) {
  return (
    <th className={`px-4 py-2 ${align === "right" ? "text-right" : "text-left"} ${onClick ? "cursor-pointer select-none hover:text-foreground" : ""}`} onClick={onClick}>
      <span className="inline-flex items-center gap-1">{label}{onClick && <ArrowUpDown className="h-3 w-3 opacity-50" />}</span>
    </th>
  );
}