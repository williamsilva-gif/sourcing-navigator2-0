import { create } from "zustand";

export type Role = "admin" | "manager" | "viewer";

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

interface AppConfigState {
  user: { id: string; name: string; role: Role };
  enabledModules: Record<ModuleKey, boolean>;
  thresholds: Thresholds;
  defaultCap: number;

  setRole: (role: Role) => void;
  setUserName: (name: string) => void;
  toggleModule: (key: ModuleKey) => void;
  setThreshold: (key: keyof Thresholds, value: number) => void;
  setDefaultCap: (cap: number) => void;
}

const ALL_MODULES: ModuleKey[] = [
  "dashboard",
  "diagnostico",
  "estrategia",
  "rfp",
  "analise",
  "negociacao",
  "selecao",
  "implementacao",
  "monitoramento",
  "monetizacao",
  "admin",
];

export const useAppConfigStore = create<AppConfigState>((set) => ({
  user: { id: "u1", name: "Marina Reis", role: "admin" },
  enabledModules: ALL_MODULES.reduce(
    (acc, k) => ({ ...acc, [k]: true }),
    {} as Record<ModuleKey, boolean>,
  ),
  thresholds: {
    adrGapPct: 8,
    compliancePct: 75,
    leakagePct: 15,
    concentrationPct: 50,
  },
  defaultCap: 280,
  setRole: (role) => set((s) => ({ user: { ...s.user, role } })),
  setUserName: (name) => set((s) => ({ user: { ...s.user, name } })),
  toggleModule: (key) =>
    set((s) => ({ enabledModules: { ...s.enabledModules, [key]: !s.enabledModules[key] } })),
  setThreshold: (key, value) =>
    set((s) => ({ thresholds: { ...s.thresholds, [key]: value } })),
  setDefaultCap: (cap) => set({ defaultCap: cap }),
}));

export function useCanExecute(): boolean {
  return useAppConfigStore((s) => s.user.role !== "viewer");
}

export function useModuleEnabled(key: ModuleKey): boolean {
  return useAppConfigStore((s) => s.enabledModules[key]);
}
