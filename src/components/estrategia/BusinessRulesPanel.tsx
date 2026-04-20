import { useState } from "react";
import { toast } from "sonner";
import { ScrollText, Plus, Zap, ZapOff } from "lucide-react";
import { BUSINESS_RULES, type BusinessRule } from "./strategyData";

const CAT_TONE: Record<BusinessRule["category"], string> = {
  Cap: "bg-primary-soft text-primary",
  Tier: "bg-info-soft text-info",
  Cluster: "bg-warning-soft text-warning",
  Compliance: "bg-destructive-soft text-destructive",
};

export function BusinessRulesPanel() {
  const [rules, setRules] = useState(BUSINESS_RULES);

  function toggle(id: string) {
    setRules((rs) => rs.map((r) => r.id === id ? { ...r, active: !r.active } : r));
    const r = rules.find((x) => x.id === id);
    toast.info(`Regra ${id} ${r?.active ? "desativada" : "ativada"}`);
  }

  const active = rules.filter((r) => r.active).length;

  return (
    <section className="rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
            <ScrollText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Regras de negócio</h2>
            <p className="text-xs text-muted-foreground">{active} de {rules.length} regras ativas no programa</p>
          </div>
        </div>
        <button
          onClick={() => toast.info("Editor de regras avançadas em breve")}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" />Nova regra
        </button>
      </header>
      <ul className="divide-y divide-border">
        {rules.map((r) => (
          <li key={r.id} className="grid grid-cols-12 items-start gap-3 px-5 py-4 hover:bg-muted/30">
            <div className="col-span-12 sm:col-span-2 flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold text-muted-foreground">{r.id}</span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CAT_TONE[r.category]}`}>
                {r.category}
              </span>
            </div>
            <div className="col-span-12 sm:col-span-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Se</p>
              <p className="text-sm text-foreground">{r.trigger}</p>
            </div>
            <div className="col-span-12 sm:col-span-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Então</p>
              <p className="text-sm text-foreground">{r.action}</p>
            </div>
            <div className="col-span-12 sm:col-span-1 flex justify-end">
              <button
                onClick={() => toggle(r.id)}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  r.active ? "bg-success-soft text-success hover:bg-success/20" : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
                title={r.active ? "Ativa — clique para desativar" : "Inativa — clique para ativar"}
              >
                {r.active ? <Zap className="h-3.5 w-3.5" /> : <ZapOff className="h-3.5 w-3.5" />}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}