import { useMemo } from "react";
import { MapPin, TrendingUp, Sparkles } from "lucide-react";
import { useDecisionData, fmtUsd, type Opportunity, type Priority } from "./decisionData";
import { useSnapshotStore, isOpportunityNew } from "@/lib/snapshotStore";
import { useActionStore } from "@/lib/actionStore";
import { useCanExecute } from "@/lib/appConfigStore";

interface Props {
  onTakeAction: (opp: Opportunity) => void;
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  high: { label: "Alta", className: "bg-destructive-soft text-destructive" },
  medium: { label: "Média", className: "bg-warning-soft text-warning-foreground" },
  low: { label: "Baixa", className: "bg-info-soft text-info" },
};

export function OpportunitiesList({ onTakeAction }: Props) {
  const { opportunities } = useDecisionData();
  const current = useSnapshotStore((s) => s.current);
  const previous = useSnapshotStore((s) => s.previous);
  const executedActions = useActionStore((s) => s.actions);
  const canExecute = useCanExecute();

  const inExecutionByOpp = useMemo(
    () =>
      new Set(
        executedActions
          .filter((a) => a.status !== "completed")
          .map((a) => a.opportunityId),
      ),
    [executedActions],
  );

  const total = opportunities.reduce((s: number, o: Opportunity) => s + o.savings, 0);

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Oportunidades priorizadas</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {opportunities.length === 0
              ? "Sem oportunidades ativas neste momento"
              : "Ranking por savings potencial — clique para executar"}
          </p>
        </div>
        {opportunities.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
            <TrendingUp className="h-3 w-3" />
            {fmtUsd(total)} potencial
          </span>
        )}
      </div>

      {opportunities.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          Carregue um baseline no módulo Diagnóstico para gerar recomendações automáticas.
        </div>
      ) : (
        <ul className="space-y-3">
          {opportunities.map((opp: Opportunity, idx: number) => {
            const cfg = priorityConfig[opp.priority];
            const isNew = isOpportunityNew(opp.id, current, previous);
            const inExecution = inExecutionByOpp.has(opp.id);
            return (
              <li
                key={opp.id}
                className={`group flex items-center gap-4 rounded-md border border-border bg-background p-4 transition-colors hover:border-primary/40 ${
                  inExecution ? "opacity-70" : ""
                }`}
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
                    {isNew && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                        <Sparkles className="h-2.5 w-2.5" />
                        Nova
                      </span>
                    )}
                    {inExecution && (
                      <span className="rounded-full bg-info-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-info">
                        Em execução
                      </span>
                    )}
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
                  disabled={inExecution || !canExecute}
                  title={!canExecute ? "Viewer não pode executar ações" : undefined}
                  className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {inExecution ? "Em execução" : "Take action"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
