import { useEffect, useMemo, useState } from "react";
import { useClientsStore, type ClientType } from "@/lib/clientsStore";
import { useAppConfigStore } from "@/lib/appConfigStore";
import { Trash2, Plus, Check, DatabaseZap, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { listVisibleTenants, migrateLocalClients } from "@/lib/tenantsRepo";

export function ClientsPanel() {
  const clients = useClientsStore((s) => s.clients);
  const selectedId = useClientsStore((s) => s.selectedClientId);
  const selectClient = useClientsStore((s) => s.selectClient);
  const addClient = useClientsStore((s) => s.addClient);
  const ensureConfig = useAppConfigStore((s) => s.ensureClientConfig);
  const removeClient = useClientsStore((s) => s.removeClient);
  const updateClient = useClientsStore((s) => s.updateClient);
  const syncFromDb = useClientsStore((s) => s.syncFromDb);
  const loaded = useClientsStore((s) => s.loaded);

  const [name, setName] = useState("");
  const [type, setType] = useState<ClientType>("Corporate");
  const [submitting, setSubmitting] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dbNames, setDbNames] = useState<Set<string> | null>(null);

  // Detect which local clients aren't in the DB yet (case-insensitive name match).
  useEffect(() => {
    let mounted = true;
    listVisibleTenants()
      .then((rows) => {
        if (mounted) setDbNames(new Set(rows.map((r) => r.name.toLowerCase())));
      })
      .catch((e) => console.error("listVisibleTenants failed", e));
    return () => {
      mounted = false;
    };
  }, [loaded]);

  const localOnly = useMemo(() => {
    if (!dbNames) return [];
    return clients.filter((c) => !dbNames.has(c.name.toLowerCase()));
  }, [clients, dbNames]);

  async function handleMigrate() {
    if (localOnly.length === 0) return;
    setMigrating(true);
    try {
      const result = await migrateLocalClients(localOnly.map((c) => ({ name: c.name, type: c.type })));
      toast.success(`Migrados: ${result.added} novos · ${result.skipped} já existiam`, {
        description: result.failed
          ? `${result.failed} falharam — ${result.firstError ?? "verifique permissões (precisa ser TA master)"}`
          : "Lista sincronizada com o banco.",
      });
      await syncFromDb();
      const fresh = await listVisibleTenants();
      setDbNames(new Set(fresh.map((r) => r.name.toLowerCase())));
    } catch (e) {
      toast.error(`Falha ao migrar: ${(e as Error).message}`);
    } finally {
      setMigrating(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await syncFromDb();
      const fresh = await listVisibleTenants();
      setDbNames(new Set(fresh.map((r) => r.name.toLowerCase())));
      toast.success("Lista atualizada do banco");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Clientes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sincronizado com o banco. Crie, selecione e remova clientes — o cliente ativo define o contexto global.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </button>
      </div>

      {localOnly.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-soft/50 p-4">
          <div className="flex items-start gap-3">
            <DatabaseZap className="mt-0.5 h-5 w-5 text-warning-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {localOnly.length} cliente(s) salvo(s) apenas no navegador
              </p>
              <p className="text-xs text-muted-foreground">
                Migre para o banco: {localOnly.map((c) => c.name).join(", ")}.
              </p>
            </div>
          </div>
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {migrating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DatabaseZap className="h-3.5 w-3.5" />}
            {migrating ? "Migrando…" : "Migrar para o banco"}
          </button>
        </div>
      )}

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
            {clients.map((c) => {
              const inDb = dbNames?.has(c.name.toLowerCase()) ?? true;
              return (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        defaultValue={c.name}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== c.name) updateClient(c.id, { name: v });
                        }}
                        className="w-full bg-transparent font-medium text-foreground outline-none"
                      />
                      {!inDb && (
                        <span
                          className="rounded-full border border-warning/40 bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning-foreground"
                          title="Existe apenas no navegador"
                        >
                          local
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      defaultValue={c.type}
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
              );
            })}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || submitting) return;
          setSubmitting(true);
          const created = await addClient({ name: name.trim(), type });
          if (created) {
            ensureConfig(created.id, type);
            toast.success(`${created.name} criado no banco`);
            setName("");
            setDbNames((prev) => {
              const next = new Set(prev ?? []);
              next.add(created.name.toLowerCase());
              return next;
            });
          } else {
            toast.error("Falha ao criar cliente — verifique se você tem permissão de TA master");
          }
          setSubmitting(false);
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
          disabled={submitting}
          className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {submitting ? "Salvando…" : "Adicionar"}
        </button>
      </form>
    </section>
  );
}
