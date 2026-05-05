import { create } from "zustand";

export type ClientType = "TMC" | "Corporate" | "Supplier";

export interface ClientRecord {
  id: string;
  name: string;
  type: ClientType;
}

interface ClientsState {
  clients: ClientRecord[];
  selectedClientId: string;
  selectClient: (id: string) => void;
  addClient: (c: Omit<ClientRecord, "id">) => void;
  updateClient: (id: string, patch: Partial<Omit<ClientRecord, "id">>) => void;
  removeClient: (id: string) => void;
}

export const useClientsStore = create<ClientsState>((set) => ({
  clients: [
    { id: "kontik", name: "Kontik", type: "TMC" },
    { id: "acme", name: "Acme Travel Corp", type: "Corporate" },
  ],
  selectedClientId: "acme",
  selectClient: (id) => set({ selectedClientId: id }),
  addClient: (c) =>
    set((s) => ({
      clients: [...s.clients, { ...c, id: c.name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now().toString(36) }],
    })),
  updateClient: (id, patch) =>
    set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  removeClient: (id) =>
    set((s) => ({
      clients: s.clients.filter((c) => c.id !== id),
      selectedClientId: s.selectedClientId === id ? s.clients[0]?.id ?? "" : s.selectedClientId,
    })),
}));
