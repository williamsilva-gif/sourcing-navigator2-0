import { TrendingUp, MapPin } from "lucide-react";

const items = [
  { city: "São Paulo, BR", current: 248, target: 195, savings: 142 },
  { city: "Mexico City, MX", current: 189, target: 158, savings: 96 },
  { city: "Bogotá, CO", current: 165, target: 132, savings: 78 },
  { city: "Buenos Aires, AR", current: 218, target: 178, savings: 64 },
];

export function TopOpportunities() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Top oportunidades</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Maior potencial de savings (k BRL)
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
          <TrendingUp className="h-3 w-3" />
          $380k total
        </span>
      </div>

      <ul className="space-y-4">
        {items.map((it) => {
          const pct = ((it.current - it.target) / it.current) * 100;
          return (
            <li key={it.city}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {it.city}
                </p>
                <p className="text-sm font-semibold text-success">+${it.savings}k</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(pct * 3, 100)}%` }}
                  />
                </div>
                <p className="w-32 text-right text-xs text-muted-foreground">
                  ${it.current} → <span className="font-medium text-foreground">${it.target}</span> ADR
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <button className="mt-5 w-full rounded-md border border-primary/20 bg-primary-soft py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
        Iniciar ação rápida
      </button>
    </div>
  );
}