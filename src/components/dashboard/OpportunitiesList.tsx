import { MapPin, TrendingUp } from "lucide-react";
import { OPPORTUNITIES, fmtUsd, type Opportunity, type Priority } from "./decisionData";

interface Props {
  onTakeAction: (opp: Opportunity) => void;
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  high: { label: "Alta", className: "bg-destructive-soft text-destructive" },
  medium: { label: "Média", className: "bg-warning-soft text-warning-foreground" },
  low: { label: "Baixa", className: "bg-info-soft text-info" },
};

export function OpportunitiesList({ onTakeAction }: Props) {
  const total = OPPORTUNITIES.reduce((s, o) => s + o.savings, 0);

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Oportunidades priorizadas</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ranking por savings potencial — clique para executar
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
          <TrendingUp className="h-3 w-3" />
          {fmtUsd(total)} potencial
        </span>
      </div>

      <ul className="space-y-3">
        {OPPORTUNITIES.map((opp, idx) => {
          const cfg = priorityConfig[opp.priority];
          return (
            <li
              key={opp.id}
              className="group flex items-center gap-4 rounded-md border border-border bg-background p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-sm font-semibold text-primary">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {opp.scope}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.className}`}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{opp.region}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{opp.reason}</p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-success">+{fmtUsd(opp.savings)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {opp.actions.length} ações sugeridas
                </p>
              </div>
              <button
                onClick={() => onTakeAction(opp)}
                className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
              >
                Take action
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
