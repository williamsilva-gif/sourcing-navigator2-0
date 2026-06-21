import { Fragment, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useClientsStore } from "@/lib/clientsStore";
import { useAppConfigStore, TA_WORKSPACE_ID, type ModuleKey } from "@/lib/appConfigStore";
import { useAuth, getPrimaryRole } from "@/hooks/useAuth";
import {
  inviteTenantUserFn,
  listTenantUsersFn,
  removeTenantUserFn,
  resendInviteFn,
} from "@/lib/tenantUsers.functions";
import {
  getUserOverridesFn,
  setUserModuleFn,
  setUserFeatureFn,
  resetUserOverridesFn,
  resetAllTenantOverridesFn,
  listAccessAuditFn,
} from "@/lib/userAccess.functions";
import { FEATURE_CATALOG, featureLabel } from "@/lib/featureCatalog";
import { toast } from "sonner";
import {
  Loader2, UserPlus, Trash2, Mail, ChevronRight, ChevronDown,
  RotateCcw, AlertCircle, Send, History,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TenantUser {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  mustSetPassword?: boolean;
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

const ALL_MODULES: Array<{ key: ModuleKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "diagnostico", label: "Diagnóstico / Hotéis" },
  { key: "estrategia", label: "Estratégia" },
  { key: "rfp", label: "RFP" },
  { key: "analise", label: "Análise" },
  { key: "negociacao", label: "Negociação" },
  { key: "selecao", label: "Diretório de Hotéis" },
  { key: "implementacao", label: "Implementação" },
  { key: "monitoramento", label: "Monitoramento" },
  { key: "monetizacao", label: "Monetização" },
  { key: "admin", label: "Admin" },
];

export function TenantUsersPanel() {
  const { roles } = useAuth();
  const primary = getPrimaryRole(roles);
  const isTa = primary === "ta_master" || primary === "ta_staff";

  const clients = useClientsStore((s) => s.clients);
  const impersonating = useAppConfigStore((s) => s.impersonatingClientId);

  const [editId, setEditId] = useState<string>(
    impersonating && impersonating !== TA_WORKSPACE_ID ? impersonating : clients[0]?.id ?? "",
  );

  const client = clients.find((c) => c.id === editId);
  const tenantTemplate = useAppConfigStore((s) => s.configByClient[editId]);
  const roleOptions = client ? ROLE_OPTIONS_BY_TYPE[client.type] ?? [] : [];

  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(roleOptions[0]?.value ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const list = useServerFn(listTenantUsersFn);
  const invite = useServerFn(inviteTenantUserFn);
  const remove = useServerFn(removeTenantUserFn);

  useEffect(() => {
    if (!editId || !isTa) return;
    setLoading(true);
    setExpanded(null);
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
    if (!fullName.trim() || !email.trim() || !role || !editId) return;
    setSubmitting(true);
    try {
      await invite({
        data: { tenantId: editId, email: email.trim(), fullName: fullName.trim(), role: role as never },
      });
      toast.success(`Convite enviado para ${email}. O usuário definirá uma senha ao clicar no link.`);
      setEmail("");
      setFullName("");
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
            Convide usuários e configure módulos/funcionalidades por pessoa. O template do cliente é aplicado a novos
            usuários; overrides personalizam acesso individual.
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

      <form onSubmit={handleInvite} className="mt-5 grid grid-cols-1 gap-3 rounded-md border border-border bg-background p-4 md:grid-cols-[1fr_1fr_180px_auto]">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome completo</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Maria Souza"
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          />
        </div>
        <div>
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
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={submitting || !email || !fullName}
          className="mt-[18px] inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Convidar
        </button>
      </form>

      <div className="mt-5 overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-8 px-2"></th>
              <th className="px-4 py-2.5 font-medium">Usuário</th>
              <th className="px-4 py-2.5 font-medium">Papel</th>
              <th className="px-4 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                Nenhum usuário neste cliente ainda. Convide o primeiro acima.
              </td></tr>
            ) : users.map((u) => {
              const open = expanded === u.userId;
              return (
                <Fragment key={u.userId}>
                  <tr key={u.userId} className="border-t border-border">
                    <td className="px-2">
                      <button
                        onClick={() => setExpanded(open ? null : u.userId)}
                        className="rounded p-1 hover:bg-muted"
                        aria-label={open ? "Recolher" : "Expandir"}
                      >
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
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
                  {open && (
                    <tr key={`${u.userId}-detail`} className="bg-muted/30">
                      <td colSpan={4} className="px-4 py-4">
                        <UserAccessEditor
                          tenantId={editId}
                          userId={u.userId}
                          templateModules={tenantTemplate?.enabledModules}
                          templateFeatures={tenantTemplate?.features}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Configurando: <span className="font-semibold text-foreground">{editName}</span>
      </p>
    </section>
  );
}

interface AccessEditorProps {
  tenantId: string;
  userId: string;
  templateModules?: Record<string, boolean>;
  templateFeatures?: Record<string, boolean>;
}

function UserAccessEditor({ tenantId, userId, templateModules, templateFeatures }: AccessEditorProps) {
  const get = useServerFn(getUserOverridesFn);
  const setMod = useServerFn(setUserModuleFn);
  const setFeat = useServerFn(setUserFeatureFn);
  const reset = useServerFn(resetUserOverridesFn);

  const [modOverrides, setModOverrides] = useState<Record<string, boolean>>({});
  const [featOverrides, setFeatOverrides] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    get({ data: { tenantId, userId } })
      .then((r) => {
        const m: Record<string, boolean> = {};
        r.modules.forEach((x) => (m[x.module_key] = x.enabled));
        const f: Record<string, boolean> = {};
        r.features.forEach((x) => (f[x.feature_key] = x.enabled));
        setModOverrides(m);
        setFeatOverrides(f);
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [tenantId, userId, get]);

  function modEnabled(key: string): boolean {
    if (key in modOverrides) return modOverrides[key];
    if (templateModules && key in templateModules) return templateModules[key];
    return true;
  }
  function featEnabled(key: string): boolean {
    if (key in featOverrides) return featOverrides[key];
    if (templateFeatures && key in templateFeatures) return templateFeatures[key];
    return true;
  }

  async function toggleMod(key: ModuleKey) {
    const next = !modEnabled(key);
    setSaving(true);
    try {
      await setMod({ data: { tenantId, userId, moduleKey: key, enabled: next } });
      setModOverrides((p) => ({ ...p, [key]: next }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleFeat(key: string) {
    const next = !featEnabled(key);
    setSaving(true);
    try {
      await setFeat({ data: { tenantId, userId, featureKey: key, enabled: next } });
      setFeatOverrides((p) => ({ ...p, [key]: next }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Resetar overrides? O usuário voltará ao template do cliente.")) return;
    setSaving(true);
    try {
      await reset({ data: { tenantId, userId } });
      setModOverrides({});
      setFeatOverrides({});
      toast.success("Overrides removidos.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Acesso individual {saving && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
        </h3>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
        >
          <RotateCcw className="h-3 w-3" />
          Resetar para template do cliente
        </button>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Módulos habilitados
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {ALL_MODULES.map((m) => {
            const on = modEnabled(m.key);
            const overridden = m.key in modOverrides;
            return (
              <label
                key={m.key}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  {m.label}
                  {overridden && <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[9px] font-semibold text-primary">override</span>}
                </span>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleMod(m.key)}
                  className="h-4 w-4 cursor-pointer"
                />
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Funcionalidades por módulo
        </p>
        <div className="space-y-3">
          {Object.entries(FEATURE_CATALOG).map(([modKey, feats]) => {
            if (!feats.length) return null;
            const modOn = modEnabled(modKey);
            return (
              <div key={modKey} className={`rounded-md border border-border bg-background p-3 ${!modOn ? "opacity-50" : ""}`}>
                <p className="mb-2 text-xs font-semibold capitalize text-foreground">{modKey}</p>
                <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                  {feats.map((f) => {
                    const on = featEnabled(f.key);
                    const overridden = f.key in featOverrides;
                    return (
                      <label key={f.key} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5">
                          {f.label}
                          {overridden && <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[9px] font-semibold text-primary">override</span>}
                        </span>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleFeat(f.key)}
                          disabled={!modOn}
                          className="h-3.5 w-3.5 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
