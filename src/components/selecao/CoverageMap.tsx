import { useMemo } from "react";
import { MapPin, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { AWARDED, DEMAND_TARGETS } from "./selectionData";

interface CityRow {
  city: string;
  hotels: number;
  primaries: number;
  nights: number;
  target: number;
  coverage: number;
  weightedAdr: number;
  spend: number;
  tiers: Set<string>;
}

function fmt$(n: number) { return `$${Math.round(n).toLocaleString("en-US")}`; }

export function CoverageMap() {
  const rows: CityRow[] = useMemo(() => {
    const map = new Map<string, CityRow>();
    AWARDED.forEach((h) => {
      const r = map.get(h.city) ?? {
        city: h.city, hotels: 0, primaries: 0, nights: 0, target: DEMAND_TARGETS[h.city] ?? 0,
        coverage: 0, weightedAdr: 0, spend: 0, tiers: new Set<string>(),
      };
      r.hotels += 1;
      if (h.status === "primary") r.primaries += 1;
      r.nights += h.roomNights;
      r.spend += h.roomNights * h.finalAdr;
      r.tiers.add(h.tier);
      map.set(h.city, r);
    });
    return Array.from(map.values()).map((r) => ({
      ...r,
      coverage: r.target ? (r.nights / r.target) * 100 : 100,
      weightedAdr: r.spend / r.nights,
    })).sort((a, b) => b.nights - a.nights);
  }, []);

  const maxCoverage = Math.max(...rows.map((r) => r.coverage), 100);

  return (
    <section className="rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-3 border-b border-border p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary">
          <MapPin className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">Cobertura geográfica por cidade</h2>
          <p className="text-xs text-muted-foreground">{rows.length} mercados ativos · meta de room nights vs adjudicado</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
        {rows.map((r) => {
          const status = r.coverage >= 95 ? "ok" : r.coverage >= 80 ? "warn" : "low";
          const barW = Math.min(100, (r.coverage / maxCoverage) * 100);
          const targetMark = (r.target ? Math.min(100, (r.target / (r.target * (maxCoverage / 100))) * 100) : 100);
          return (
            <article key={r.city} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {r.city}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.hotels} hotéis · {r.primaries} primários · {Array.from(r.tiers).join(", ")}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  status === "ok" ? "bg-success-soft text-success" :
                  status === "warn" ? "bg-warning-soft text-warning-foreground" :
                  "bg-destructive/10 text-destructive"
                }`}>
                  {status === "ok" ? <CheckCircle2 className="h-3 w-3" /> :
                    status === "warn" ? <TrendingUp className="h-3 w-3" /> :
                    <AlertTriangle className="h-3 w-3" />}
                  {r.coverage.toFixed(0)}%
                </span>
              </div>

              <div className="mt-3">
                <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full transition-all ${
                    status === "ok" ? "bg-success" : status === "warn" ? "bg-warning" : "bg-destructive"
                  }`} style={{ width: `${barW}%` }} />
                  {r.target > 0 && (
                    <div className="absolute top-0 h-full w-px bg-foreground/40"
                      style={{ left: `${(targetMark / maxCoverage) * 100}%` }} />
                  )}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{r.nights.toLocaleString("pt-BR")} nights</span>
                  <span>meta {r.target.toLocaleString("pt-BR")}</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-2 text-[11px]">
                <div>
                  <p className="text-muted-foreground">ADR ponderado</p>
                  <p className="font-mono font-semibold text-foreground">{fmt$(r.weightedAdr)}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Spend anual</p>
                  <p className="font-mono font-semibold text-foreground">{fmt$(r.spend)}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
