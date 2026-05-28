import { useMemo, useState } from "react";
import {
  Bell,
  Pin,
  PinOff,
  CheckCircle2,
  Clock,
  Send,
  MessageSquare,
  Filter,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDecisionStore, type DecisionAction, type WatchlistItem, type ActionStatus } from "@/lib/decisionStore";
import { WatchlistItemDetail } from "./WatchlistItemDetail";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientTenantId: string | null;
}

const STATUS_LABEL: Record<ActionStatus, string> = {
  PENDING: "Pendente",
  SENT: "Alerta enviado",
  WAITING_RESPONSE: "Aguardando resposta",
  RESPONDED: "Respondido",
  COMPLETED: "Concluído",
  IGNORED: "Ignorado",
};

const STATUS_TONE: Record<ActionStatus, string> = {
  PENDING: "bg-muted text-foreground",
  SENT: "bg-info-soft text-info",
  WAITING_RESPONSE: "bg-warning-soft text-warning-foreground",
  RESPONDED: "bg-primary-soft text-primary",
  COMPLETED: "bg-success-soft text-success",
  IGNORED: "bg-muted text-muted-foreground",
};

type FilterKey = "all" | "open" | "waiting" | "done";

export function WatchlistPanel({ open, onOpenChange, clientTenantId }: Props) {
  const watchlist = useDecisionStore((s) => s.watchlist);
  const actions = useDecisionStore((s) => s.actions);
  const alerts = useDecisionStore((s) => s.alerts);
  const setWatchlistPinned = useDecisionStore((s) => s.setWatchlistPinned);
  const setActionStatus = useDecisionStore((s) => s.setActionStatus);
  const addFollowUp = useDecisionStore((s) => s.addFollowUp);

  const [filter, setFilter] = useState<FilterKey>("open");
  const [detailActionId, setDetailActionId] = useState<string | null>(null);

  const actionById = useMemo(() => {
    const m = new Map<string, DecisionAction>();
    actions.forEach((a) => m.set(a.id, a));
    return m;
  }, [actions]);

  const alertById = useMemo(() => {
    const m = new Map<string, (typeof alerts)[number]>();
    alerts.forEach((a) => m.set(a.id, a));
    return m;
  }, [alerts]);

  const items = useMemo(() => {
    const rows = watchlist
      .map((w) => ({ w, a: actionById.get(w.action_id) }))
      .filter((r): r is { w: WatchlistItem; a: DecisionAction } => !!r.a);

    const filtered = rows.filter(({ a }) => {
      if (filter === "all") return true;
      if (filter === "open") return a.status === "PENDING" || a.status === "SENT" || a.status === "WAITING_RESPONSE";
      if (filter === "waiting") return a.status === "WAITING_RESPONSE";
      if (filter === "done") return a.status === "COMPLETED" || a.status === "IGNORED" || a.status === "RESPONDED";
      return true;
    });

    return filtered.sort((x, y) => {
      if (x.w.pinned !== y.w.pinned) return x.w.pinned ? -1 : 1;
      return new Date(y.w.last_activity_at).getTime() - new Date(x.w.last_activity_at).getTime();
    });
  }, [watchlist, actionById, filter]);

  const counts = useMemo(() => {
    let open = 0;
    let waiting = 0;
    let done = 0;
    for (const w of watchlist) {
      const a = actionById.get(w.action_id);
      if (!a) continue;
      if (a.status === "PENDING" || a.status === "SENT") open += 1;
      if (a.status === "WAITING_RESPONSE") waiting += 1;
      if (a.status === "COMPLETED" || a.status === "IGNORED" || a.status === "RESPONDED") done += 1;
    }
    return { open, waiting, done, total: watchlist.length };
  }, [watchlist, actionById]);

  const handleFollowUp = async (action: DecisionAction) => {
    if (!clientTenantId) return;
    await addFollowUp({
      clientTenantId,
      actionId: action.id,
      kind: "email",
      notes: "Follow-up enviado",
    });
    if (action.status !== "WAITING_RESPONSE") {
      await setActionStatus(action.id, "WAITING_RESPONSE");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full max-w-[480px] p-0 sm:max-w-[480px]">
          <SheetHeader className="border-b border-border px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-primary" />
                Watchlist operacional
              </SheetTitle>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                {counts.total} itens
              </Badge>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs">
              <Filter className="mr-1 h-3 w-3 text-muted-foreground" />
              {(
                [
                  { k: "open", label: `Abertos · ${counts.open}` },
                  { k: "waiting", label: `Aguardando · ${counts.waiting}` },
                  { k: "done", label: `Concluídos · ${counts.done}` },
                  { k: "all", label: "Todos" },
                ] as Array<{ k: FilterKey; label: string }>
              ).map((f) => (
                <button
                  key={f.k}
                  onClick={() => setFilter(f.k)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    filter === f.k
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="space-y-2 p-4">
              {items.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
                  Nenhum item nesta visão. Quando um alerta gerar uma ação, ela aparece aqui.
                </div>
              ) : (
                items.map(({ w, a }) => {
                  const alert = a.alert_id ? alertById.get(a.alert_id) : null;
                  const title = alert?.title ?? w.summary ?? a.type;
                  const city = alert?.impacted_city ?? null;
                  const hotel = alert?.impacted_hotel ?? null;
                  return (
                    <article
                      key={w.id}
                      className="rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
                            {w.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="rounded bg-muted px-1.5 py-0.5 font-medium uppercase tracking-wider">
                              {a.type.replace(/_/g, " ").toLowerCase()}
                            </span>
                            {city && <span>· {city}</span>}
                            {hotel && <span>· {hotel}</span>}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_TONE[a.status]}`}
                        >
                          {STATUS_LABEL[a.status]}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(w.last_activity_at).toLocaleDateString("pt-BR")}
                        </span>
                        {a.assigned_to && <span>· responsável definido</span>}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-[11px]"
                          onClick={() => handleFollowUp(a)}
                          disabled={a.status === "COMPLETED" || a.status === "IGNORED"}
                        >
                          <Send className="h-3 w-3" />
                          Follow-up
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-[11px]"
                          onClick={() => setDetailActionId(a.id)}
                        >
                          <MessageSquare className="h-3 w-3" />
                          Detalhes
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-[11px]"
                          onClick={() => setWatchlistPinned(w.id, !w.pinned)}
                        >
                          {w.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                        </Button>
                        <div className="ml-auto flex items-center gap-1">
                          {a.status !== "COMPLETED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 px-2 text-[11px] text-success hover:text-success"
                              onClick={() => setActionStatus(a.id, "COMPLETED")}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Concluir
                            </Button>
                          )}
                          {a.status !== "IGNORED" && a.status !== "COMPLETED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px] text-muted-foreground"
                              onClick={() => setActionStatus(a.id, "IGNORED")}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <WatchlistItemDetail
        actionId={detailActionId}
        onClose={() => setDetailActionId(null)}
        clientTenantId={clientTenantId}
      />
    </>
  );
}
