import { useState } from "react";
import { useClientsStore, type ClientType } from "@/lib/clientsStore";
import { Trash2, Plus, Check } from "lucide-react";

export function ClientsPanel() {
  const clients = useClientsStore((s) => s.clients);
  const selectedId = useClientsStore((s) => s.selectedClientId);
  const selectClient = useClientsStore((s) => s.selectClient);
  const addClient = useClientsStore((s) => s.addClient);
  const removeClient = useClientsStore((s) => s.removeClient);
  const updateClient = useClientsStore((s) => s.updateClient);

  const [name, setName] = useState("");
  const [type, setType] = useState<ClientType>("Corporate");

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-semibold text-foreground">Clientes</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Crie, selecione e remova clientes. O cliente ativo define o contexto global do app.
      </p>

      <div className="mt-5 overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Nome</th>
              <th className="px-4 py-2.5 font-medium">Tipo</th>
              <th className="px-4 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-2.5">
                  <input
                    value={c.name}
                    onChange={(e) => updateClient(c.id, { name: e.target.value })}
                    className="w-full bg-transparent font-medium text-foreground outline-none"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={c.type}
                    onChange={(e) => updateClient(c.id, { type: e.target.value as ClientType })}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="TMC">TMC</option>
                    <option value="Corporate">Corporate</option>
                    <option value="Supplier">Supplier</option>
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => selectClient(c.id)}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                        selectedId === c.id
                          ? "bg-success-soft text-success"
                          : "border border-input text-foreground hover:bg-muted"
                      }`}
                    >
                      {selectedId === c.id && <Check className="h-3 w-3" />}
                      {selectedId === c.id ? "Ativo" : "Selecionar"}
                    </button>
                    <button
                      onClick={() => removeClient(c.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addClient({ name: name.trim(), type });
          setName("");
        }}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Novo cliente
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do cliente"
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ClientType)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="TMC">TMC</option>
          <option value="Corporate">Corporate</option>
          <option value="Supplier">Supplier</option>
        </select>
        <button
          type="submit"
          className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </form>
    </section>
  );
}
