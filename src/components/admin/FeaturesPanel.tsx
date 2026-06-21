import { useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useClientsStore } from "@/lib/clientsStore";
import { useAppConfigStore, TA_WORKSPACE_ID } from "@/lib/appConfigStore";
import { useAuth, getPrimaryRole } from "@/hooks/useAuth";
import { FEATURE_CATALOG, defaultFeatures } from "@/lib/featureCatalog";
import type { ModuleKey } from "@/lib/appConfigStore";
import { Shield } from "lucide-react";

const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard", diagnostico: "Diagnóstico", estrategia: "Estratégia",
  rfp: "RFP", analise: "Análise", negociacao: "Negociação", selecao: "Seleção",
  implementacao: "Implementação", monitoramento: "Monitoramento", monetizacao: "Monetização", admin: "Admin",
};

/**
 * Permite ao TA (ou admin do cliente) ligar/desligar cada funcionalidade dentro
 * de cada módulo, por cliente. Inclui um seletor explícito de qual cliente está
 * sendo configurado, separado do cliente "ativo" na navegação.
 */
export function FeaturesPanel() {
  const { roles } = useAuth();
  const primary = getPrimaryRole(roles);
  const isTa = primary === "ta_master" || primary === "ta_staff";

  const clients = useClientsStore((s) => s.clients);
  const configByClient = useAppConfigStore((s) => s.configByClient);
  const setFeature = useAppConfigStore((s) => s.setFeature);
  const impersonating = useAppConfigStore((s) => s.impersonatingClientId);

  // Default: cliente que o TA está visualizando, ou primeiro cliente disponível.
  const initialEditId = impersonating && impersonating !== TA_WORKSPACE_ID
    ? impersonating
    : (isTa ? TA_WORKSPACE_ID : clients[0]?.id ?? "");
  const [editId, setEditId] = useState<string>(initialEditId);

  const cfg = configByClient[editId];
  const features = cfg?.features ?? defaultFeatures();

  const editName = useMemo(() => {
    if (editId === TA_WORKSPACE_ID) return "Workspace TA";
    return clients.find((c) => c.id === editId)?.name ?? "—";
  }, [editId, clients]);

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Funcionalidades por módulo — template do cliente</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Define o <strong>padrão</strong> aplicado a novos usuários deste cliente (ex.: "Novo RFP" desligado para todos).
            Para sobrescrever por pessoa, use <em>Usuários do cliente</em>.
          </p>
        </div>
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
      </div>

      {editId === TA_WORKSPACE_ID && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-primary/30 bg-primary-soft/40 p-3 text-xs text-foreground">
          <Shield className="h-4 w-4 text-primary" />
          Você está editando o <strong className="ml-1">seu</strong> workspace TA. Estas configurações não afetam clientes.
        </div>
      )}

      <div className="mt-6 space-y-6">
        {(Object.keys(FEATURE_CATALOG) as ModuleKey[]).map((mod) => (
          <div key={mod}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {MODULE_LABELS[mod]} <span className="ml-1 text-muted-foreground/60">· /{mod === "dashboard" ? "" : mod}</span>
            </h3>
            <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FEATURE_CATALOG[mod].map((f) => {
                const enabled = features[f.key] ?? true;
                return (
                  <li
                    key={f.key}
                    className="flex items-start justify-between gap-3 rounded-md border border-border bg-background px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{f.label}</p>
                      {f.description && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{f.description}</p>
                      )}
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">{f.key}</p>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) => setFeature(editId, f.key, v)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[11px] text-muted-foreground">
        Aplicando para: <span className="font-semibold text-foreground">{editName}</span>
      </p>
    </section>
  );
}
