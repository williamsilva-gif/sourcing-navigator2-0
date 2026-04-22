import { useNavigate } from "@tanstack/react-router";
import { Zap, ArrowRight } from "lucide-react";
import { useActionStore, type ActionKind } from "@/lib/actionStore";

interface Props {
  // Filter to only actions of these kinds (e.g., for /negociacao show only renegotiations)
  kinds: ActionKind[];
  title: string;
}

export function ActionInboxBanner({ kinds, title }: Props) {
  const navigate = useNavigate();
  const actions = useActionStore((s) =>
    s.actions.filter((a) => kinds.includes(a.kind) && a.status !== "completed")
  );

  if (actions.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-primary/30 bg-primary-soft/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {actions.length} {actions.length === 1 ? "ação enviada" : "ações enviadas"} pelo Decision Center · aguardando processamento
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate({ to: "/" })}
          className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover"
        >
          Ver no dashboard
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {actions.slice(0, 3).map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-xs"
          >
            <span className="truncate text-foreground">
              <strong>{a.city}</strong> · {a.label}
            </span>
            <span className="ml-3 shrink-0 rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-info">
              {a.status === "initiated" ? "Iniciada" : "Em andamento"}
            </span>
          </li>
        ))}
        {actions.length > 3 && (
          <li className="text-center text-[11px] text-muted-foreground">
            +{actions.length - 3} mais
          </li>
        )}
      </ul>
    </div>
  );
}
