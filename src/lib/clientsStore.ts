import { create } from "zustand";
import {
  listVisibleTenants,
  createTenant,
  updateTenant,
  archiveTenant,
  clientTypeToTenantType,
  tenantTypeToClientType,
  type ClientType,
} from "./tenantsRepo";

/**
 * IMPORTANTE: clientes vivem no banco (tabela `tenants`).
 * NÃO reintroduzir middleware `persist`/localStorage aqui — fonte da verdade
 * é o DB. O id selecionado é persistido por aba em sessionStorage para
 * conveniência da UI, mas não é dado de negócio.
 */

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
  addClient: (c: Omit<ClientRecord, "id">) => Promise<ClientRecord | null>;
  updateClient: (id: string, patch: Partial<Omit<ClientRecord, "id">>) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  syncFromDb: () => Promise<void>;
}

const SELECTED_KEY = "sourcinghub.selectedClientId";

function readInitialSelection(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(SELECTED_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeSelection(id: string) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.sessionStorage.setItem(SELECTED_KEY, id);
    else window.sessionStorage.removeItem(SELECTED_KEY);
  } catch {
    /* ignore */
  }
}

export const useClientsStore = create<ClientsState>()((set, get) => ({
  clients: [],
  selectedClientId: readInitialSelection(),
  loading: false,
  loaded: false,

  selectClient: (id) => {
    writeSelection(id);
    set({ selectedClientId: id });
  },

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
      const fallback = get().clients.find((c) => c.id !== id)?.id ?? "";
      const newSelected = get().selectedClientId === id ? fallback : get().selectedClientId;
      writeSelection(newSelected);
      set((s) => ({
        clients: s.clients.filter((c) => c.id !== id),
        selectedClientId: newSelected,
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
      const nextSelected = selectedStillValid ? cur : clients[0]?.id ?? "";
      if (nextSelected !== cur) writeSelection(nextSelected);
      set({
        clients,
        loading: false,
        loaded: true,
        selectedClientId: nextSelected,
      });
    } catch (e) {
      console.error("syncFromDb failed", e);
      set({ loading: false });
    }
  },
}));
