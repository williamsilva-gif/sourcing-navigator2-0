import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useClientsStore } from "@/lib/clientsStore";
import { useAppConfigStore, TA_WORKSPACE_ID } from "@/lib/appConfigStore";
import { useAuth, getPrimaryRole } from "@/hooks/useAuth";
import {
  inviteTenantUserFn,
  listTenantUsersFn,
  removeTenantUserFn,
} from "@/lib/tenantUsers.functions";
import { toast } from "sonner";
import { Loader2, UserPlus, Trash2, Mail } from "lucide-react";

interface TenantUser {
  userId: string;
  email: string;
  fullName: string;
  role: string;
}

const ROLE_OPTIONS_BY_TYPE: Record<string, Array<{ value: string; label: string }>> = {
  TMC: [
    { value: "tmc_admin", label: "TMC Admin" },
    { value: "tmc_user", label: "TMC User" },
  ],
  Corporate: [
    { value: "corp_admin", label: "Corp Admin" },
    { value: "corp_user", label: "Corp User" },
  ],
  Supplier: [
    { value: "hotel_admin", label: "Hotel Admin" },
    { value: "hotel_user", label: "Hotel User" },
  ],
};

export function TenantUsersPanel() {
  const { roles } = useAuth();
  const primary = getPrimaryRole(roles);
  const isTa = primary === "ta_master" || primary === "ta_staff";

  const clients = useClientsStore((s) => s.clients);
  const impersonating = useAppConfigStore((s) => s.impersonatingClientId);

  const [editId, setEditId] = useState<string>(
    impersonating && impersonating !== TA_WORKSPACE_ID ? impersonating : clients[0]?.id ?? ""
  );

  const client = clients.find((c) => c.id === editId);
  const roleOptions = client ? ROLE_OPTIONS_BY_TYPE[client.type] ?? [] : [];

  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(roleOptions[0]?.value ?? "");
  const [submitting, setSubmitting] = useState(false);

  const list = useServerFn(listTenantUsersFn);
  const invite = useServerFn(inviteTenantUserFn);
  const remove = useServerFn(removeTenantUserFn);

  useEffect(() => {
    if (!editId || !isTa) return;
    setLoading(true);
    list({ data: { tenantId: editId } })
      .then((r) => setUsers(r as TenantUser[]))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [editId, isTa, list]);

  useEffect(() => {
    setRole(roleOptions[0]?.value ?? "");
  }, [editId, roleOptions]);

  async function reload() {
    if (!editId) return;
    const r = await list({ data: { tenantId: editId } });
    setUsers(r as TenantUser[]);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !role || !editId) return;
    setSubmitting(true);
    try {
      await invite({ data: { tenantId: editId, email: email.trim(), role: role as never } });
      toast.success(`Convite enviado para ${email}`);
      setEmail("");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(uid: string) {
    if (!confirm("Remover acesso desse usuário ao cliente?")) return;
    try {
      await remove({ data: { tenantId: editId, userId: uid } });
      toast.success("Acesso removido");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const editName = useMemo(() => client?.name ?? "—", [client]);

  if (!isTa) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Somente TA master/staff pode gerenciar usuários de clientes.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Usuários do cliente</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Convide usuários para acessar a plataforma como esse cliente. Eles recebem um link de acesso por e-mail.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">Cliente</span>
          <select
            value={editId}
            onChange={(e) => setEditId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {c.type}</option>
            ))}
          </select>
        </label>
      </div>

      <form onSubmit={handleInvite} className="mt-5 flex flex-wrap items-end gap-3 rounded-md border border-border bg-background p-4">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@empresa.com"
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Papel</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 h-10 rounded-md border border-input bg-background px-2 text-sm"
          >
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={submitting || !email}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Convidar
        </button>
      </form>

      <div className="mt-5 overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Usuário</th>
              <th className="px-4 py-2.5 font-medium">Papel</th>
              <th className="px-4 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-xs text-muted-foreground">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-xs text-muted-foreground">
                Nenhum usuário neste cliente ainda. Convide o primeiro acima.
              </td></tr>
            ) : users.map((u) => (
              <tr key={u.userId} className="border-t border-border">
                <td className="px-4 py-2.5">
                  <p className="font-medium text-foreground">{u.fullName || u.email.split("@")[0]}</p>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {u.email}
                  </p>
                </td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleRemove(u.userId)}
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

      <p className="mt-4 text-[11px] text-muted-foreground">
        Configurando: <span className="font-semibold text-foreground">{editName}</span>
      </p>
    </section>
  );
}
