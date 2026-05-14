import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  listVisibleTenants,
  createTenant,
  updateTenant,
  archiveTenant,
  clientTypeToTenantType,
  tenantTypeToClientType,
  type ClientType,
} from "./tenantsRepo";

export type { ClientType };

export interface ClientRecord {
  id: string;
  name: string;
  type: ClientType;
}

interface ClientsState {
  clients: ClientRecord[];
  selectedClientId: string;
  loading: boolean;
  loaded: boolean;
  selectClient: (id: string) => void;
  // DB-backed mutations (async). Components await these for error handling.
  addClient: (c: Omit<ClientRecord, "id">) => Promise<ClientRecord | null>;
  updateClient: (id: string, patch: Partial<Omit<ClientRecord, "id">>) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  // Refresh from DB. Called once on auth.
  syncFromDb: () => Promise<void>;
}

// Default seed list — used only as a placeholder before the first DB sync,
// to avoid an empty header dropdown on first paint.
const SEED: ClientRecord[] = [
  { id: "kontik", name: "Kontik", type: "TMC" },
  { id: "acme", name: "Acme Travel Corp", type: "Corporate" },
];

export const useClientsStore = create<ClientsState>()(
  persist(
    (set, get) => ({
      clients: SEED,
      selectedClientId: "acme",
      loading: false,
      loaded: false,

      selectClient: (id) => set({ selectedClientId: id }),

      addClient: async (c) => {
        try {
          const row = await createTenant({ name: c.name, type: clientTypeToTenantType(c.type) });
          const rec: ClientRecord = { id: row.id, name: row.name, type: tenantTypeToClientType(row.type) };
          set((s) => ({ clients: [...s.clients, rec] }));
          return rec;
        } catch (e) {
          console.error("addClient failed", e);
          return null;
        }
      },

      updateClient: async (id, patch) => {
        try {
          const dbPatch: { name?: string; type?: ReturnType<typeof clientTypeToTenantType> } = {};
          if (patch.name !== undefined) dbPatch.name = patch.name;
          if (patch.type !== undefined) dbPatch.type = clientTypeToTenantType(patch.type);
          await updateTenant(id, dbPatch);
          set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
        } catch (e) {
          console.error("updateClient failed", e);
        }
      },

      removeClient: async (id) => {
        try {
          await archiveTenant(id);
          set((s) => ({
            clients: s.clients.filter((c) => c.id !== id),
            selectedClientId:
              s.selectedClientId === id ? s.clients.find((c) => c.id !== id)?.id ?? "" : s.selectedClientId,
          }));
        } catch (e) {
          console.error("removeClient failed", e);
        }
      },

      syncFromDb: async () => {
        if (get().loading) return;
        set({ loading: true });
        try {
          const rows = await listVisibleTenants();
          if (rows.length === 0) {
            set({ loading: false, loaded: true });
            return;
          }
          const clients: ClientRecord[] = rows.map((r) => ({
            id: r.id,
            name: r.name,
            type: tenantTypeToClientType(r.type),
          }));
          const cur = get().selectedClientId;
          const selectedStillValid = clients.some((c) => c.id === cur);
          set({
            clients,
            loading: false,
            loaded: true,
            selectedClientId: selectedStillValid ? cur : clients[0]?.id ?? "",
          });
        } catch (e) {
          console.error("syncFromDb failed", e);
          set({ loading: false });
        }
      },
    }),
    {
      name: "sourcinghub.clients.v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? (({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown) as Storage)
          : localStorage,
      ),
      // Don't persist transient flags
      partialize: (s) => ({ clients: s.clients, selectedClientId: s.selectedClientId }) as ClientsState,
    },
  ),
);
