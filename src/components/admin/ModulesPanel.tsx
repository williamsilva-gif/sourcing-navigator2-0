import { useClientsStore } from "@/lib/clientsStore";
import { useAppConfigStore, useEnabledModules, useEnvironment, useCanConfigure, type ModuleKey, type Environment } from "@/lib/appConfigStore";
import { Switch } from "@/components/ui/switch";

const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard", diagnostico: "Diagnóstico", estrategia: "Estratégia",
  rfp: "RFP", analise: "Análise", negociacao: "Negociação", selecao: "Seleção",
  implementacao: "Implementação", monitoramento: "Monitoramento", monetizacao: "Monetização", admin: "Admin",
};

export function ModulesPanel() {
  const clientId = useClientsStore((s) => s.selectedClientId);
  const enabled = useEnabledModules();
  const env = useEnvironment();
  const toggle = useAppConfigStore((s) => s.toggleModule);
  const setEnvironment = useAppConfigStore((s) => s.setEnvironment);
  const canEdit = useCanConfigure();

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Módulos & ambiente</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle por cliente. Trocar o ambiente reseta o conjunto padrão de módulos.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">Ambiente</span>
          <select
            value={env}
            disabled={!canEdit}
            onChange={(e) => setEnvironment(clientId, e.target.value as Environment)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
          >
            <option value="TMC">TMC</option>
            <option value="Corporate">Corporate</option>
            <option value="Supplier">Supplier</option>
          </select>
        </label>
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((k) => (
          <li key={k} className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{MODULE_LABELS[k]}</p>
              <p className="text-[11px] text-muted-foreground">/{k === "dashboard" ? "" : k}</p>
            </div>
            <Switch checked={enabled[k]} disabled={!canEdit} onCheckedChange={() => toggle(clientId, k)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
