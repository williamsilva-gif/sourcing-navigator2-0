import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Stethoscope,
  Target,
  FileText,
  BarChart3,
  Handshake,
  CheckSquare,
  Rocket,
  Activity,
  DollarSign,
  Hotel,
  Settings,
} from "lucide-react";
import { useAppConfigStore, useEnabledModules, type ModuleKey } from "@/lib/appConfigStore";

const modules: { to: string; label: string; icon: typeof LayoutDashboard; key: ModuleKey }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
  { to: "/diagnostico", label: "Diagnóstico", icon: Stethoscope, key: "diagnostico" },
  { to: "/hoteis", label: "Hotéis", icon: Hotel, key: "diagnostico" },
  { to: "/estrategia", label: "Estratégia", icon: Target, key: "estrategia" },
  { to: "/rfp", label: "RFP", icon: FileText, key: "rfp" },
  { to: "/analise", label: "Análise", icon: BarChart3, key: "analise" },
  { to: "/negociacao", label: "Negociação", icon: Handshake, key: "negociacao" },
  { to: "/selecao", label: "Seleção", icon: CheckSquare, key: "selecao" },
  { to: "/implementacao", label: "Implementação", icon: Rocket, key: "implementacao" },
  { to: "/monitoramento", label: "Monitoramento", icon: Activity, key: "monitoramento" },
  { to: "/monetizacao", label: "Monetização", icon: DollarSign, key: "monetizacao" },
  { to: "/admin", label: "Admin", icon: Settings, key: "admin" },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const enabledModules = useEnabledModules();
  const role = useAppConfigStore((s) => s.user.role);
  const visible = modules.filter((m) => {
    if (m.key === "admin") return enabledModules.admin && role === "admin";
    return enabledModules[m.key];
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-[70px] items-center gap-2.5 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Hotel className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">SourcingHub</p>
          <p className="text-[11px] text-muted-foreground">Hotel Sourcing</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Módulos
        </p>
        <ul className="space-y-0.5">
          {visible.map((m) => {
            const active = pathname === m.to;
            const Icon = m.icon;
            return (
              <li key={m.to}>
                <Link
                  to={m.to}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{m.label}</span>
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-md bg-primary-soft p-3">
          <p className="text-xs font-semibold text-primary">Plano Enterprise</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            12 clientes ativos
          </p>
        </div>
      </div>
    </aside>
  );
}