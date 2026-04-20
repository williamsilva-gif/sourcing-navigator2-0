import { useState } from "react";
import { toast } from "sonner";
import { Sliders, RotateCcw, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { CITY_STRATEGY } from "./strategyData";

function fmt$(n: number) { return `$${Math.round(n).toLocaleString("en-US")}`; }

export function CityCapsTable() {
  const [caps, setCaps] = useState<Record<string, number>>(
    () => Object.fromEntries(CITY_STRATEGY.map((c) => [c.city, c.capAdr]))
  );

  function reset() {
    setCaps(Object.fromEntries(CITY_STRATEGY.map((c) => [c.city, c.capAdr])));
    toast.info("Caps restaurados aos valores baseline");
  }

  function save() {
    const changed = CITY_STRATEGY.filter((c) => caps[c.city] !== c.capAdr).length;
    toast.success(`${changed} caps atualizados e enviados ao próximo ciclo de RFP`);
  }

  return (
    <section className="rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Configuração de city caps</h2>
            <p className="text-xs text-muted-foreground">Ajuste o teto de ADR negociado por cidade · valores em USD</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">
            <RotateCcw className="h-3.5 w-3.5" />Restaurar
          </button>
          <button onClick={save} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
            <Save className="h-3.5 w-3.5" />Aplicar caps
          </button>
        </div>
      </header>
      <div className="divide-y divide-border">
        {CITY_STRATEGY.map((c) => {
          const cap = caps[c.city];
          const within = c.currentAdr <= cap;
          const delta = ((c.currentAdr - cap) / cap) * 100;
          // visual range for slider — anchor between 70%-130% of baseline cap
          const min = Math.round(c.capAdr * 0.7);
          const max = Math.round(c.capAdr * 1.3);
          const pct = ((cap - min) / (max - min)) * 100;
          return (
            <div key={c.city} className="grid grid-cols-12 items-center gap-3 px-5 py-3 hover:bg-muted/30">
              <div className="col-span-12 sm:col-span-3">
                <p className="text-sm font-medium text-foreground">{c.city}</p>
                <p className="text-[11px] text-muted-foreground">{c.state} · ADR atual {fmt$(c.currentAdr)}</p>
              </div>
              <div className="col-span-8 sm:col-span-5">
                <div className="relative h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${within ? "bg-success" : "bg-destructive"}`}
                    style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                  />
                  {/* current ADR marker */}
                  <div
                    className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-foreground/50"
                    style={{ left: `${Math.max(0, Math.min(100, ((c.currentAdr - min) / (max - min)) * 100))}%` }}
                    title={`ADR atual ${fmt$(c.currentAdr)}`}
                  />
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={5}
                  value={cap}
                  onChange={(e) => setCaps((s) => ({ ...s, [c.city]: Number(e.target.value) }))}
                  className="mt-1 w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{fmt$(min)}</span><span>{fmt$(max)}</span>
                </div>
              </div>
              <div className="col-span-2 sm:col-span-2 text-right">
                <input
                  type="number"
                  value={cap}
                  onChange={(e) => setCaps((s) => ({ ...s, [c.city]: Number(e.target.value) || 0 }))}
                  className="w-20 rounded-md border border-input bg-background px-2 py-1 text-right text-sm font-semibold tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="col-span-2 text-right">
                {within ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                    <CheckCircle2 className="h-3 w-3" />Em compliance
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                    <AlertTriangle className="h-3 w-3" />+{delta.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}