import { useState } from "react";
import { useClientsStore } from "@/lib/clientsStore";
import {
  useAppConfigStore,
  TA_WORKSPACE_ID,
  type ModuleKey,
  type Environment,
} from "@/lib/appConfigStore";
import { useAuth, getPrimaryRole } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import { Shield } from "lucide-react";

const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard", diagnostico: "Diagnóstico", estrategia: "Estratégia",
  rfp: "RFP", analise: "Análise", negociacao: "Negociação", selecao: "Seleção",
  implementacao: "Implementação", monitoramento: "Monitoramento", monetizacao: "Monetização", admin: "Admin",
};

export function ModulesPanel() {
  const { roles } = useAuth();
  const primary = getPrimaryRole(roles);
  const isTa = primary === "ta_master" || primary === "ta_staff";

  const clients = useClientsStore((s) => s.clients);
  const configByClient = useAppConfigStore((s) => s.configByClient);
  const toggle = useAppConfigStore((s) => s.toggleModule);
  const setEnvironment = useAppConfigStore((s) => s.setEnvironment);
  const impersonating = useAppConfigStore((s) => s.impersonatingClientId);

  const initial = impersonating ?? (isTa ? TA_WORKSPACE_ID : clients[0]?.id ?? "");
  const [editId, setEditId] = useState<string>(initial);

  const cfg = configByClient[editId];
  const enabled = cfg?.enabledModules ?? ({} as Record<ModuleKey, boolean>);
  const env = cfg?.environment ?? "TMC";
  const isTaWorkspace = editId === TA_WORKSPACE_ID;

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Módulos & ambiente</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecione qual cliente está sendo configurado. As alterações afetam apenas esse cliente.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-xs">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">Configurando</span>
            <select
              value={editId}
              onChange={(e) => setEditId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {isTa && <option value={TA_WORKSPACE_ID}>Workspace TA (meu)</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.type}</option>
              ))}
            </select>
          </label>
          {!isTaWorkspace && (
            <label className="flex items-center gap-2 text-xs">
              <span className="font-semibold uppercase tracking-wider text-muted-foreground">Ambiente</span>
              <select
                value={env}
                onChange={(e) => setEnvironment(editId, e.target.value as Environment)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="TMC">TMC</option>
                <option value="Corporate">Corporate</option>
                <option value="Supplier">Supplier</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {isTaWorkspace && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-primary/30 bg-primary-soft/40 p-3 text-xs text-foreground">
          <Shield className="h-4 w-4 text-primary" />
          Editando seu workspace pessoal TA. Por padrão você vê Admin, Hotéis e Documentação — ative outros módulos se quiser usá-los.
        </div>
      )}

      <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((k) => (
          <li key={k} className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{MODULE_LABELS[k]}</p>
              <p className="text-[11px] text-muted-foreground">/{k === "dashboard" ? "" : k}</p>
            </div>
            <Switch checked={!!enabled[k]} onCheckedChange={() => toggle(editId, k)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
