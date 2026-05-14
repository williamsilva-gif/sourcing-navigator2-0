import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getPrimaryRole } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Building2, Plus, Loader2, ShieldAlert, Database, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { generateDemoBookings } from "@/lib/demoData";

type TenantRow = {
  id: string;
  type: "TA" | "TMC" | "CORP" | "HOTEL";
  name: string;
  parent_tenant_id: string | null;
  billing_status: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/ta/clients")({
  head: () => ({ meta: [{ title: "TA · Clientes — Navigator" }] }),
  component: TaClientsPage,
});

function TaClientsPage() {
  const { roles, loading } = useAuth();
  const primary = getPrimaryRole(roles);
  const isTaMaster = primary === "ta_master" || primary === "ta_staff";

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Form state
  const [type, setType] = useState<"TMC" | "CORP">("TMC");
  const [name, setName] = useState("");
  const [parent, setParent] = useState<string>("");

  // TA staff invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!isTaMaster) return;
    (async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, type, name, parent_tenant_id, billing_status, created_at")
        .order("type")
        .order("name");
      if (error) toast.error(error.message);
      else setTenants((data ?? []) as TenantRow[]);
    })();
  }, [isTaMaster, refreshKey]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const payload: { type: "TMC" | "CORP"; name: string; parent_tenant_id: string | null } = {
      type,
      name: name.trim(),
      parent_tenant_id: type === "CORP" && parent ? parent : null,
    };
    const { error } = await supabase.from("tenants").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${type} "${payload.name}" criado`);
    setName("");
    setParent("");
    setRefreshKey((k) => k + 1);
  }

  async function handleSeedAcme() {
    const acme = tenants.find((t) => t.name === "Acme Travel Corp" && t.type === "CORP");
    if (!acme) {
      toast.error("Tenant Acme não encontrado");
      return;
    }
    setBusy(true);
    try {
      // Idempotency: skip if already seeded
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("client_tenant_id", acme.id);
      if ((count ?? 0) > 0) {
        toast.info(`Acme já possui ${count} bookings — seed ignorado`);
        setBusy(false);
        return;
      }
      const bookings = generateDemoBookings(500);
      const rows = bookings.map((b) => ({
        client_tenant_id: acme.id,
        booking_external_id: b.booking_id,
        hotel_name: b.hotel,
        city: b.city,
        state: b.state ?? null,
        checkin: b.checkin,
        room_nights: b.room_nights,
        adr: b.adr,
        channel: b.channel ?? null,
      }));
      // Insert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const slice = rows.slice(i, i + 100);
        const { error } = await supabase.from("bookings").insert(slice);
        if (error) throw error;
      }
      toast.success(`500 bookings importados para Acme`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no seed");
    } finally {
      setBusy(false);
    }
  }

  async function handleInviteTaStaff(e: FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviting(true);
    try {
      const taTenant = tenants.find((t) => t.type === "TA");
      if (!taTenant) throw new Error("Tenant TA raiz não encontrado");

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", email)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile) {
        throw new Error(
          "Usuário não encontrado. Peça para a pessoa se cadastrar primeiro (qualquer tipo) e tente novamente.",
        );
      }

      const { error: rErr } = await supabase
        .from("user_roles")
        .insert({ user_id: profile.id, tenant_id: taTenant.id, role: "ta_staff" });
      if (rErr && !rErr.message.includes("duplicate")) throw rErr;

      toast.success(`${email} promovido a TA staff`);
      setInviteEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao conceder acesso");
    } finally {
      setInviting(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
        </div>
      </AppShell>
    );
  }

  if (!isTaMaster) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <ShieldAlert className="mx-auto h-10 w-10 text-warning" />
          <h2 className="mt-3 text-lg font-semibold text-foreground">Acesso restrito</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Apenas o Travel Academy pode acessar este console.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">
            Voltar para o início
          </Link>
        </div>
      </AppShell>
    );
  }

  const tmcs = tenants.filter((t) => t.type === "TMC");
  const corps = tenants.filter((t) => t.type === "CORP");

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Clientes da plataforma</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie TMCs e clientes corporativos diretos do Travel Academy.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSeedAcme}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-primary-soft disabled:opacity-50"
            title="Importa 500 bookings demo no tenant Acme (idempotente)"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Carregar dados demo Acme
          </button>
        </header>

        {/* Create form */}
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]"
        >
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Plus className="h-4 w-4" /> Novo cliente
          </h2>
          <div className="grid gap-3 sm:grid-cols-[120px_1fr_1fr_auto]">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "TMC" | "CORP")}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="TMC">TMC</option>
              <option value="CORP">Corporativo</option>
            </select>
            <input
              required
              placeholder="Nome do cliente"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <select
              value={parent}
              onChange={(e) => setParent(e.target.value)}
              disabled={type !== "CORP"}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            >
              <option value="">{type === "CORP" ? "TMC pai (opcional)" : "—"}</option>
              {tmcs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar
            </button>
          </div>
        </form>

        {/* TA staff invite */}
        <form
          onSubmit={handleInviteTaStaff}
          className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]"
        >
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <UserPlus className="h-4 w-4" /> Conceder acesso TA staff
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            O cadastro público não permite criar contas Travel Academy. Para adicionar um membro
            interno, peça para a pessoa se cadastrar como Hotel/TMC/Corporativo (será descartado) e
            promova abaixo pelo email.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="email"
              required
              placeholder="email@travelacademy.com.br"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Promover
            </button>
          </div>
        </form>

        {/* Lists */}
        <section className="grid gap-6 lg:grid-cols-2">
          <TenantList title="TMCs" rows={tmcs} />
          <TenantList title="Clientes Corporativos" rows={corps} tenants={tenants} />
        </section>
      </div>
    </AppShell>
  );
}

function TenantList({
  title,
  rows,
  tenants,
}: {
  title: string;
  rows: TenantRow[];
  tenants?: TenantRow[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum registro ainda.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const parentName =
              r.parent_tenant_id && tenants
                ? tenants.find((t) => t.id === r.parent_tenant_id)?.name
                : null;
            return (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{r.name}</span>
                  {parentName && (
                    <span className="text-xs text-muted-foreground">via {parentName}</span>
                  )}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {r.billing_status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
