import { AppShell } from "./AppShell";
import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

interface Props {
  module: string;
  description: string;
  icon: LucideIcon;
}

export function ModulePlaceholder({ module, description, icon: Icon }: Props) {
  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">Módulo</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {module}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-12 text-center shadow-[var(--shadow-card)]">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Módulo em construção
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Esta área será detalhada nas próximas iterações com fluxos completos,
          tabelas avançadas, gráficos específicos e ações em lote.
        </p>
        <div className="mt-6 flex items-center gap-2 rounded-full bg-warning-soft px-3 py-1 text-xs font-medium text-warning-foreground">
          <Construction className="h-3.5 w-3.5" />
          Em desenvolvimento
        </div>
      </div>
    </AppShell>
  );
}