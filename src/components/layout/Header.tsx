import { Search, Bell, ChevronDown, Building2, Database, LogOut, LogIn, Shield, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useBaselineStore } from "@/lib/baselineStore";
import { useClientsStore } from "@/lib/clientsStore";
import {
  useAppConfigStore,
  useEnvironment,
  useActiveClientId,
  TA_WORKSPACE_ID,
} from "@/lib/appConfigStore";
import { useAuth, getPrimaryRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function Header() {
  const navigate = useNavigate();
  const { user, roles, ready } = useAuth();
  const primaryRole = getPrimaryRole(roles);
  const isTa = ready && (primaryRole === "ta_master" || primaryRole === "ta_staff");

  const impersonating = useAppConfigStore((s) => s.impersonatingClientId);
  const enterClientMode = useAppConfigStore((s) => s.enterClientMode);
  const exitClientMode = useAppConfigStore((s) => s.exitClientMode);
  const activeId = useActiveClientId();

  // Quando o TA loga, fixa o contexto no workspace pessoal até ele explicitamente entrar em um cliente.
  useEffect(() => {
    if (isTa && impersonating === null) {
      enterClientMode(TA_WORKSPACE_ID);
    }
  }, [isTa, impersonating, enterClientMode]);

  async function handleLogout() {
    exitClientMode();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/login" });
  }

  const bookings = useBaselineStore((s) => s.bookings);
  const uploads = useBaselineStore((s) => s.uploads);
  const clients = useClientsStore((s) => s.clients);
  const selectClient = useClientsStore((s) => s.selectClient);
  const localUser = useAppConfigStore((s) => s.user);
  const env = useEnvironment();
  const isLive = bookings.length > 0;
  const last = uploads[0];

  const inTaWorkspace = isTa && activeId === TA_WORKSPACE_ID;
  const activeClient = clients.find((c) => c.id === activeId);
  const displayContextName = inTaWorkspace
    ? "Workspace TA"
    : activeClient?.name ?? clients.find((c) => c.id === activeId)?.name ?? "—";

  const displayName = ready ? (user?.email?.split("@")[0] ?? localUser.name) : localUser.name;
  const displayRole = ready ? (primaryRole ?? localUser.role) : localUser.role;
  const initials = displayName.split(/[.\s_-]+/).map((p: string) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U";

  function handlePickContext(id: string) {
    if (isTa) {
      enterClientMode(id);
      if (id !== TA_WORKSPACE_ID) selectClient(id);
    } else {
      selectClient(id);
    }
  }

  return (
    <>
      {isTa && !inTaWorkspace && activeClient && (
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-warning/30 bg-warning-soft px-6 py-2 text-xs font-medium text-warning-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Modo cliente: <span className="font-semibold">{activeClient.name}</span> — alterações afetam apenas este cliente.
          </div>
          <button
            onClick={() => {
              enterClientMode(TA_WORKSPACE_ID);
              toast.success("Voltou para o Workspace TA");
            }}
            className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-card px-2.5 py-1 hover:bg-background"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Sair do modo cliente
          </button>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-[70px] items-center gap-4 border-b border-border bg-card/80 px-6 backdrop-blur-sm">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar cliente, hotel, cidade..."
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div
          className={`hidden items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium md:inline-flex ${
            isLive
              ? "border-success/30 bg-success-soft text-success"
              : "border-border bg-muted text-muted-foreground"
          }`}
          title={last ? `Último upload: ${new Date(last.uploadedAt).toLocaleString("pt-BR")}` : "Sem dados carregados"}
        >
          <Database className="h-3.5 w-3.5" />
          {isLive
            ? `Baseline · ${bookings.length.toLocaleString("pt-BR")} bookings`
            : "Sem dados — modo demo"}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-10 items-center gap-2.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft">
            {inTaWorkspace ? <Shield className="h-4 w-4 text-primary" /> : <Building2 className="h-4 w-4 text-muted-foreground" />}
            <span>{displayContextName}</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              {inTaWorkspace ? "TA" : env}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {isTa && (
              <>
                <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => handlePickContext(TA_WORKSPACE_ID)}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    Workspace TA (pessoal)
                  </span>
                  {inTaWorkspace && <span className="text-[10px] text-success">ativo</span>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel>{isTa ? "Entrar como cliente" : "Clientes"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {clients.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => handlePickContext(c.id)}
                className="flex items-center justify-between"
              >
                <span>{c.name}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{c.type}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {isTa && (
          <Link
            to="/ta/clients"
            className="hidden h-10 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft md:inline-flex"
          >
            <Shield className="h-4 w-4 text-primary" />
            TA Console
          </Link>
        )}

        <button className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
        </button>

        <div className="flex items-center gap-2.5 border-l border-border pl-4" suppressHydrationWarning>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" suppressHydrationWarning>
            {initials}
          </div>
          <div className="hidden leading-tight sm:block" suppressHydrationWarning>
            <p className="text-sm font-semibold text-foreground">{displayName}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{displayRole}</p>
          </div>
          {ready && user ? (
            <button
              onClick={handleLogout}
              title="Sair"
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : ready ? (
            <Link
              to="/login"
              title="Entrar"
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogIn className="h-4 w-4" />
            </Link>
          ) : (
            <span className="ml-1 h-9 w-9" />
          )}
        </div>
      </header>
    </>
  );
}
