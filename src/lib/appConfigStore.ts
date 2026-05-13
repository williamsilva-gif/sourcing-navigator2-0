import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useClientsStore } from "./clientsStore";

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
}

interface AppConfigState {
  user: { id: string; name: string; role: Role };
  // Config por cliente — chave é clientId do useClientsStore
  configByClient: Record<string, ClientConfig>;

  setRole: (role: Role) => void;
  setUserName: (name: string) => void;

  toggleModule: (clientId: string, key: ModuleKey) => void;
  setThreshold: (clientId: string, key: keyof Thresholds, value: number) => void;
  setDefaultCap: (clientId: string, cap: number) => void;
  setEnvironment: (clientId: string, env: Environment) => void;
  ensureClientConfig: (clientId: string, env?: Environment) => void;
}

const ALL_MODULES: ModuleKey[] = [
  "dashboard", "diagnostico", "estrategia", "rfp", "analise",
  "negociacao", "selecao", "implementacao", "monitoramento", "monetizacao", "admin",
];

const FULL_MODULES: Record<ModuleKey, boolean> = ALL_MODULES.reduce(
  (acc, k) => ({ ...acc, [k]: true }),
  {} as Record<ModuleKey, boolean>,
);

const DEFAULT_THRESHOLDS: Thresholds = {
  adrGapPct: 8,
  compliancePct: 75,
  leakagePct: 15,
  concentrationPct: 50,
};

// Defaults por environment — esconde módulos que não fazem sentido naquele contexto
function defaultModulesForEnv(env: Environment): Record<ModuleKey, boolean> {
  if (env === "Corporate") return { ...FULL_MODULES, rfp: false, selecao: false, monetizacao: false };
  if (env === "Supplier") return { ...FULL_MODULES, estrategia: false, negociacao: false, selecao: false, implementacao: false };
  return { ...FULL_MODULES }; // TMC = tudo
}

export function makeDefaultClientConfig(env: Environment = "TMC"): ClientConfig {
  return {
    thresholds: { ...DEFAULT_THRESHOLDS },
    defaultCap: 280,
    enabledModules: defaultModulesForEnv(env),
    environment: env,
  };
}

export const useAppConfigStore = create<AppConfigState>()(
  persist(
    (set) => ({
  user: { id: "u1", name: "Marina Reis", role: "admin" },
  configByClient: {
    kontik: makeDefaultClientConfig("TMC"),
    acme: makeDefaultClientConfig("Corporate"),
  },

  setRole: (role) => set((s) => ({ user: { ...s.user, role } })),
  setUserName: (name) => set((s) => ({ user: { ...s.user, name } })),

  ensureClientConfig: (clientId, env = "TMC") =>
    set((s) =>
      s.configByClient[clientId]
        ? s
        : { configByClient: { ...s.configByClient, [clientId]: makeDefaultClientConfig(env) } },
    ),

  toggleModule: (clientId, key) =>
    set((s) => {
      const cfg = s.configByClient[clientId] ?? makeDefaultClientConfig();
      return {
        configByClient: {
          ...s.configByClient,
          [clientId]: { ...cfg, enabledModules: { ...cfg.enabledModules, [key]: !cfg.enabledModules[key] } },
        },
      };
    }),

  setThreshold: (clientId, key, value) =>
    set((s) => {
      const cfg = s.configByClient[clientId] ?? makeDefaultClientConfig();
      return {
        configByClient: {
          ...s.configByClient,
          [clientId]: { ...cfg, thresholds: { ...cfg.thresholds, [key]: value } },
        },
      };
    }),

  setDefaultCap: (clientId, cap) =>
    set((s) => {
      const cfg = s.configByClient[clientId] ?? makeDefaultClientConfig();
      return { configByClient: { ...s.configByClient, [clientId]: { ...cfg, defaultCap: cap } } };
    }),

  setEnvironment: (clientId, env) =>
    set((s) => {
      const cfg = s.configByClient[clientId] ?? makeDefaultClientConfig(env);
      return { configByClient: { ...s.configByClient, [clientId]: { ...cfg, environment: env } } };
    }),
}),
    {
      name: "sourcinghub.appconfig.v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? (({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown) as Storage)
          : localStorage,
      ),
    },
  ),
);

// ============== Helpers — sempre via cliente ativo ==============

export function getActiveClientConfig(): ClientConfig {
  const id = useClientsStore.getState().selectedClientId;
  return useAppConfigStore.getState().configByClient[id] ?? makeDefaultClientConfig();
}

export function useActiveClientConfig(): ClientConfig {
  const id = useClientsStore((s) => s.selectedClientId);
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
