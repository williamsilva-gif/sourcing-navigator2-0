import { create } from "zustand";
import { useClientsStore } from "./clientsStore";
import { defaultFeatures } from "./featureCatalog";
import {
  getTenantConfigFn,
  setTenantModuleFn,
  setTenantFeatureFn,
  setTenantThresholdFn,
  setTenantSettingsFn,
} from "./tenantConfig.functions";

/**
 * IMPORTANTE: dados de negócio (módulos, features, thresholds, ambiente)
 * são persistidos no banco (tabelas tenant_modules, tenant_features,
 * tenant_thresholds e colunas environment/default_cap em tenants).
 * NÃO reintroduzir middleware `persist` / localStorage aqui — fonte da
 * verdade é o DB; trocar de máquina/navegador não pode perder configuração.
 */

/** ID virtual do workspace pessoal do TA (William). Não é um tenant real no DB. */
export const TA_WORKSPACE_ID = "__ta_workspace__";

export type Role = "admin" | "manager" | "viewer";

export type Environment = "TMC" | "Corporate" | "Supplier";

export type ModuleKey =
  | "dashboard"
  | "diagnostico"
  | "estrategia"
  | "rfp"
  | "analise"
  | "negociacao"
  | "selecao"
  | "implementacao"
  | "monitoramento"
  | "monetizacao"
  | "admin";

export interface Thresholds {
  adrGapPct: number;
  compliancePct: number;
  leakagePct: number;
  concentrationPct: number;
}

export interface ClientConfig {
  thresholds: Thresholds;
  defaultCap: number;
  enabledModules: Record<ModuleKey, boolean>;
  environment: Environment;
  features: Record<string, boolean>;
}

interface AppConfigState {
  user: { id: string; name: string; role: Role };
  configByClient: Record<string, ClientConfig>;
  /** clientId em hidratação no momento */
  hydrating: Record<string, boolean>;
  /** clientIds que já foram hidratados do DB nesta sessão */
  hydrated: Record<string, boolean>;
  impersonatingClientId: string | null;

  setRole: (role: Role) => void;
  setUserName: (name: string) => void;

  toggleModule: (clientId: string, key: ModuleKey) => void;
  setThreshold: (clientId: string, key: keyof Thresholds, value: number) => void;
  setDefaultCap: (clientId: string, cap: number) => void;
  setEnvironment: (clientId: string, env: Environment) => void;
  ensureClientConfig: (clientId: string, env?: Environment) => void;
  setFeature: (clientId: string, key: string, enabled: boolean) => void;

  enterClientMode: (clientId: string) => void;
  exitClientMode: () => void;

  hydrateFromDb: (clientId: string) => Promise<void>;
}

const ALL_MODULES: ModuleKey[] = [
  "dashboard", "diagnostico", "estrategia", "rfp", "analise",
  "negociacao", "selecao", "implementacao", "monitoramento", "monetizacao", "admin",
];

const FULL_MODULES: Record<ModuleKey, boolean> = ALL_MODULES.reduce(
  (acc, k) => ({ ...acc, [k]: true }),
  {} as Record<ModuleKey, boolean>,
);

/** Workspace TA: só Admin + Hotéis. Tudo mais desligado. */
const TA_WORKSPACE_MODULES: Record<ModuleKey, boolean> = {
  dashboard: false,
  diagnostico: true,
  estrategia: false,
  rfp: false,
  analise: false,
  negociacao: false,
  selecao: false,
  implementacao: false,
  monitoramento: false,
  monetizacao: false,
  admin: true,
};

const DEFAULT_THRESHOLDS: Thresholds = {
  adrGapPct: 8,
  compliancePct: 75,
  leakagePct: 15,
  concentrationPct: 50,
};

function defaultModulesForEnv(env: Environment): Record<ModuleKey, boolean> {
  if (env === "Corporate") return { ...FULL_MODULES, rfp: false, selecao: false, monetizacao: false };
  if (env === "Supplier") return { ...FULL_MODULES, estrategia: false, negociacao: false, selecao: false, implementacao: false };
  return { ...FULL_MODULES };
}

export function makeDefaultClientConfig(env: Environment = "TMC"): ClientConfig {
  return {
    thresholds: { ...DEFAULT_THRESHOLDS },
    defaultCap: 280,
    enabledModules: defaultModulesForEnv(env),
    environment: env,
    features: defaultFeatures(),
  };
}

export function makeTaWorkspaceConfig(): ClientConfig {
  return {
    thresholds: { ...DEFAULT_THRESHOLDS },
    defaultCap: 280,
    enabledModules: { ...TA_WORKSPACE_MODULES },
    environment: "TMC",
    features: defaultFeatures(),
  };
}

function isRealTenant(id: string): boolean {
  return Boolean(id) && id !== TA_WORKSPACE_ID;
}

export const useAppConfigStore = create<AppConfigState>()((set, get) => ({
  user: { id: "u1", name: "Marina Reis", role: "admin" },
  configByClient: {
    [TA_WORKSPACE_ID]: makeTaWorkspaceConfig(),
  },
  hydrating: {},
  hydrated: { [TA_WORKSPACE_ID]: true },
  impersonatingClientId: null,

  setRole: (role) => set((s) => ({ user: { ...s.user, role } })),
  setUserName: (name) => set((s) => ({ user: { ...s.user, name } })),

  ensureClientConfig: (clientId, env = "TMC") =>
    set((s) =>
      s.configByClient[clientId]
        ? s
        : { configByClient: { ...s.configByClient, [clientId]: makeDefaultClientConfig(env) } },
    ),

  toggleModule: (clientId, key) => {
    const cfg = get().configByClient[clientId] ?? makeDefaultClientConfig();
    const nextEnabled = !cfg.enabledModules[key];
    set((s) => ({
      configByClient: {
        ...s.configByClient,
        [clientId]: { ...cfg, enabledModules: { ...cfg.enabledModules, [key]: nextEnabled } },
      },
    }));
    if (isRealTenant(clientId)) {
      setTenantModuleFn({ data: { tenantId: clientId, key, enabled: nextEnabled } }).catch((e) => {
        console.error("[appConfigStore] setTenantModuleFn failed", e);
        // rollback
        set((s) => {
          const c = s.configByClient[clientId];
          if (!c) return s;
          return {
            configByClient: {
              ...s.configByClient,
              [clientId]: { ...c, enabledModules: { ...c.enabledModules, [key]: !nextEnabled } },
            },
          };
        });
      });
    }
  },

  setThreshold: (clientId, key, value) => {
    const prev = get().configByClient[clientId]?.thresholds[key];
    set((s) => {
      const cfg = s.configByClient[clientId] ?? makeDefaultClientConfig();
      return {
        configByClient: {
          ...s.configByClient,
          [clientId]: { ...cfg, thresholds: { ...cfg.thresholds, [key]: value } },
        },
      };
    });
    if (isRealTenant(clientId)) {
      setTenantThresholdFn({ data: { tenantId: clientId, key, value } }).catch((e) => {
        console.error("[appConfigStore] setTenantThresholdFn failed", e);
        if (prev !== undefined) {
          set((s) => {
            const cfg = s.configByClient[clientId];
            if (!cfg) return s;
            return {
              configByClient: {
                ...s.configByClient,
                [clientId]: { ...cfg, thresholds: { ...cfg.thresholds, [key]: prev } },
              },
            };
          });
        }
      });
    }
  },

  setDefaultCap: (clientId, cap) => {
    set((s) => {
      const cfg = s.configByClient[clientId] ?? makeDefaultClientConfig();
      return { configByClient: { ...s.configByClient, [clientId]: { ...cfg, defaultCap: cap } } };
    });
    if (isRealTenant(clientId)) {
      setTenantSettingsFn({ data: { tenantId: clientId, defaultCap: cap } }).catch((e) =>
        console.error("[appConfigStore] setTenantSettingsFn(defaultCap) failed", e),
      );
    }
  },

  setEnvironment: (clientId, env) => {
    set((s) => {
      const cfg = s.configByClient[clientId] ?? makeDefaultClientConfig(env);
      return { configByClient: { ...s.configByClient, [clientId]: { ...cfg, environment: env } } };
    });
    if (isRealTenant(clientId)) {
      setTenantSettingsFn({ data: { tenantId: clientId, environment: env } }).catch((e) =>
        console.error("[appConfigStore] setTenantSettingsFn(environment) failed", e),
      );
    }
  },

  setFeature: (clientId, key, enabled) => {
    set((s) => {
      const cfg = s.configByClient[clientId] ?? makeDefaultClientConfig();
      return {
        configByClient: {
          ...s.configByClient,
          [clientId]: { ...cfg, features: { ...(cfg.features ?? {}), [key]: enabled } },
        },
      };
    });
    if (isRealTenant(clientId)) {
      setTenantFeatureFn({ data: { tenantId: clientId, key, enabled } }).catch((e) => {
        console.error("[appConfigStore] setTenantFeatureFn failed", e);
        set((s) => {
          const cfg = s.configByClient[clientId];
          if (!cfg) return s;
          return {
            configByClient: {
              ...s.configByClient,
              [clientId]: { ...cfg, features: { ...cfg.features, [key]: !enabled } },
            },
          };
        });
      });
    }
  },

  enterClientMode: (clientId) => set({ impersonatingClientId: clientId }),
  exitClientMode: () => set({ impersonatingClientId: null }),

  hydrateFromDb: async (clientId) => {
    if (!isRealTenant(clientId)) return;
    if (get().hydrating[clientId]) return;
    if (get().hydrated[clientId]) return;
    set((s) => ({ hydrating: { ...s.hydrating, [clientId]: true } }));
    try {
      const dto = await getTenantConfigFn({ data: { tenantId: clientId } });
      const base = makeDefaultClientConfig(dto.environment);
      const enabledModules: Record<ModuleKey, boolean> = { ...base.enabledModules };
      for (const k of Object.keys(dto.modules) as ModuleKey[]) {
        if (k in enabledModules) enabledModules[k] = dto.modules[k];
      }
      const features: Record<string, boolean> = { ...base.features, ...dto.features };
      const thresholds: Thresholds = {
        adrGapPct: dto.thresholds.adrGapPct ?? base.thresholds.adrGapPct,
        compliancePct: dto.thresholds.compliancePct ?? base.thresholds.compliancePct,
        leakagePct: dto.thresholds.leakagePct ?? base.thresholds.leakagePct,
        concentrationPct: dto.thresholds.concentrationPct ?? base.thresholds.concentrationPct,
      };
      const cfg: ClientConfig = {
        environment: dto.environment,
        defaultCap: dto.defaultCap,
        enabledModules,
        features,
        thresholds,
      };
      set((s) => ({
        configByClient: { ...s.configByClient, [clientId]: cfg },
        hydrating: { ...s.hydrating, [clientId]: false },
        hydrated: { ...s.hydrated, [clientId]: true },
      }));
    } catch (e) {
      console.error("[appConfigStore] hydrateFromDb failed", e);
      set((s) => ({ hydrating: { ...s.hydrating, [clientId]: false } }));
    }
  },
}));

// ============== Helpers — sempre via cliente ativo ==============

export function useActiveClientId(): string {
  const imp = useAppConfigStore((s) => s.impersonatingClientId);
  const sel = useClientsStore((s) => s.selectedClientId);
  return imp ?? sel;
}

export function getActiveClientId(): string {
  const imp = useAppConfigStore.getState().impersonatingClientId;
  const sel = useClientsStore.getState().selectedClientId;
  return imp ?? sel;
}

export function getActiveClientConfig(): ClientConfig {
  const id = getActiveClientId();
  return useAppConfigStore.getState().configByClient[id] ?? makeDefaultClientConfig();
}

export function useActiveClientConfig(): ClientConfig {
  const id = useActiveClientId();
  const cfg = useAppConfigStore((s) => s.configByClient[id]);
  return cfg ?? makeDefaultClientConfig();
}

export function useThresholds(): Thresholds {
  return useActiveClientConfig().thresholds;
}

export function useDefaultCap(): number {
  return useActiveClientConfig().defaultCap;
}

export function useEnabledModules(): Record<ModuleKey, boolean> {
  return useActiveClientConfig().enabledModules;
}

export function useEnvironment(): Environment {
  return useActiveClientConfig().environment;
}

export function useCanExecute(): boolean {
  return useAppConfigStore((s) => s.user.role !== "viewer");
}

export function useCanConfigure(): boolean {
  return useAppConfigStore((s) => s.user.role === "admin");
}

export function useModuleEnabled(key: ModuleKey): boolean {
  return useEnabledModules()[key];
}

export function useIsTaWorkspace(): boolean {
  return useActiveClientId() === TA_WORKSPACE_ID;
}
