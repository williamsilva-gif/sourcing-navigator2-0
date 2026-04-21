import { Search, Bell, ChevronDown, Building2, Database } from "lucide-react";
import { useBaselineStore } from "@/lib/baselineStore";

export function Header() {
  const bookings = useBaselineStore((s) => s.bookings);
  const uploads = useBaselineStore((s) => s.uploads);
  const isLive = bookings.length > 0;
  const last = uploads[0];

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

      <button className="flex h-10 items-center gap-2.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span>Acme Travel Corp</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      <button className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
        <Bell className="h-5 w-5" />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
      </button>

      <div className="flex items-center gap-2.5 border-l border-border pl-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          MR
        </div>
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-semibold text-foreground">Marina Reis</p>
          <p className="text-[11px] text-muted-foreground">Sourcing Manager</p>
        </div>
      </div>
    </header>
  );
}