import { useAppConfigStore, type ModuleKey } from "@/lib/appConfigStore";
import { Switch } from "@/components/ui/switch";

const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  diagnostico: "Diagnóstico",
  estrategia: "Estratégia",
  rfp: "RFP",
  analise: "Análise",
  negociacao: "Negociação",
  selecao: "Seleção",
  implementacao: "Implementação",
  monitoramento: "Monitoramento",
  monetizacao: "Monetização",
  admin: "Admin",
};

export function ModulesPanel() {
  const enabled = useAppConfigStore((s) => s.enabledModules);
  const toggle = useAppConfigStore((s) => s.toggleModule);

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-semibold text-foreground">Módulos habilitados</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Controle quais módulos aparecem no menu lateral. Útil para diferenciar ambientes (TMC, Corporate, Supplier).
      </p>

      <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((k) => (
          <li
            key={k}
            className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{MODULE_LABELS[k]}</p>
              <p className="text-[11px] text-muted-foreground">/{k === "dashboard" ? "" : k}</p>
            </div>
            <Switch checked={enabled[k]} onCheckedChange={() => toggle(k)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
