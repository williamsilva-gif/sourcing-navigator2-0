import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Activity,
  PlayCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { fmtUsd } from "./decisionData";
import {
  useActionStore,
  type ActionStatus,
  type ActionKind,
  type ExecutedAction,
} from "@/lib/actionStore";

const statusConfig: Record<
  ActionStatus,
  { label: string; icon: typeof Loader2; className: string; spin?: boolean }
> = {
  initiated: {
    label: "Iniciada",
    icon: PlayCircle,
    className: "bg-info-soft text-info",
  },
  in_progress: {
    label: "Em andamento",
    icon: Loader2,
    className: "bg-warning-soft text-warning-foreground",
    spin: true,
  },
  completed: {
    label: "Concluída",
    icon: CheckCircle2,
    className: "bg-success-soft text-success",
  },
};

const kindLabel: Record<ActionKind, string> = {
  renegotiation: "Renegociação",
  cap_adjustment: "Ajuste de cap",
  cluster_change: "Otimização de cluster",
  mini_rfp: "Mini-RFP",
  communication: "Comunicação",
};

const moduleRoutes = {
  negociacao: "/negociacao",
  estrategia: "/estrategia",
  rfp: "/rfp",
  selecao: "/selecao",
} as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function ActionRow({ action }: { action: ExecutedAction }) {
  const navigate = useNavigate();
  const cfg = statusConfig[action.status];
  const Icon = cfg.icon;

  const adrDelta = action.kpis.adrAfter - action.kpis.adrBefore;
  const compDelta = action.kpis.complianceAfter - action.kpis.complianceBefore;
  const realizedPct =
    action.kpis.savingsExpected > 0
      ? (action.kpis.savingsRealized / action.kpis.savingsExpected) * 100
      : 0;

  return (
    <li className="space-y-2.5 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{kindLabel[action.kind]}</p>
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.className}`}
            >
              <Icon className={`h-2.5 w-2.5 ${cfg.spin ? "animate-spin" : ""}`} />
              {cfg.label}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{action.label}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {action.city} · {timeAgo(action.createdAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-success">
            +{fmtUsd(action.kpis.savingsRealized)}
          </p>
          <p className="text-[10px] text-muted-foreground">de {fmtUsd(action.kpis.savingsExpected)}</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 px-3 py-2 text-[11px]">
        <KpiCell
          label="ADR"
          before={`$${action.kpis.adrBefore}`}
          after={`$${action.kpis.adrAfter}`}
          delta={adrDelta}
          invert
        />
        <KpiCell
          label="Compliance"
          before={`${action.kpis.complianceBefore.toFixed(0)}%`}
          after={`${action.kpis.complianceAfter.toFixed(0)}%`}
          delta={compDelta}
        />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Savings</p>
          <p className="font-semibold text-foreground">{realizedPct.toFixed(0)}%</p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${Math.min(100, realizedPct)}%` }}
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate({ to: moduleRoutes[action.module] })}
        className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover"
      >
        Abrir em {moduleRoutes[action.module]}
        <ArrowRight className="h-3 w-3" />
      </button>
    </li>
  );
}

function KpiCell({
  label,
  before,
  after,
  delta,
  invert = false, // for ADR, lower is better
}: {
  label: string;
  before: string;
  after: string;
  delta: number;
  invert?: boolean;
}) {
  const positive = invert ? delta < 0 : delta > 0;
  const neutral = Math.abs(delta) < 0.01;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">
        {before} → {after}
      </p>
      {neutral ? (
        <p className="text-[10px] text-muted-foreground">aguardando</p>
      ) : (
        <p
          className={`flex items-center gap-0.5 text-[10px] font-semibold ${
            positive ? "text-success" : "text-destructive"
          }`}
        >
          {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}
        </p>
      )}
    </div>
  );
}

export function ActiveActions() {
  const storeActions = useActionStore((s) => s.actions);
  // Defensive fallback: store may be undefined during SSR / first hydration
  const actions: ExecutedAction[] = Array.isArray(storeActions) ? storeActions : [];
  const hasActions = actions.length > 0;
  const inProgress = hasActions ? actions.filter((a) => a.status !== "completed").length : 0;
  const totalRealized = hasActions ? actions.reduce((s, a) => s + a.kpis.savingsRealized, 0) : 0;
  const totalExpected = hasActions ? actions.reduce((s, a) => s + a.kpis.savingsExpected, 0) : 0;

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Ações em execução</h2>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {actions.length === 0
              ? "Nenhuma ação iniciada — execute uma oportunidade acima"
              : `${inProgress} ativas · ${fmtUsd(totalRealized)} de ${fmtUsd(totalExpected)} realizado`}
          </p>
        </div>
      </div>

      {actions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-background py-10 text-center">
          <PlayCircle className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            As ações que você executar aparecerão aqui em tempo real.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {actions.map((action) => (
            <ActionRow key={action.id} action={action} />
          ))}
        </ul>
      )}
    </section>
  );
}
