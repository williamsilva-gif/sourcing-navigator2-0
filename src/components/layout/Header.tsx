import { Search, Bell, ChevronDown, Building2, Database, LogOut, LogIn, Shield } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useBaselineStore } from "@/lib/baselineStore";
import { useClientsStore } from "@/lib/clientsStore";
import { useAppConfigStore, useEnvironment } from "@/lib/appConfigStore";
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
  const { user, roles } = useAuth();
  const primaryRole = getPrimaryRole(roles);
  const isTa = primaryRole === "ta_master" || primaryRole === "ta_staff";

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/login" });
  }

  const bookings = useBaselineStore((s) => s.bookings);
  const uploads = useBaselineStore((s) => s.uploads);
  const clients = useClientsStore((s) => s.clients);
  const selectedId = useClientsStore((s) => s.selectedClientId);
  const selectClient = useClientsStore((s) => s.selectClient);
  const user = useAppConfigStore((s) => s.user);
  const env = useEnvironment();
  const isLive = bookings.length > 0;
  const last = uploads[0];
  const selected = clients.find((c) => c.id === selectedId) ?? clients[0];
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
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
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span>{selected?.name ?? "—"}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
            {env}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Clientes</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {clients.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onClick={() => selectClient(c.id)}
              className="flex items-center justify-between"
            >
              <span>{c.name}</span>
              <span className="text-[10px] uppercase text-muted-foreground">{c.type}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <button className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
        <Bell className="h-5 w-5" />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
      </button>

      <div className="flex items-center gap-2.5 border-l border-border pl-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initials}
        </div>
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-semibold text-foreground">{user.name}</p>
          <p className="text-[11px] text-muted-foreground capitalize">{user.role}</p>
        </div>
      </div>
    </header>
  );
}
