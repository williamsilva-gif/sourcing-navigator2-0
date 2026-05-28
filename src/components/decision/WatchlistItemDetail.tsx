import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Bell,
  Send,
  CheckCircle2,
  MessageSquare,
  Paperclip,
  Calendar as CalendarIcon,
  Upload,
  Sparkles,
} from "lucide-react";
import { useDecisionStore, type ActionStatus } from "@/lib/decisionStore";
import { toast } from "sonner";

interface Props {
  actionId: string | null;
  onClose: () => void;
  clientTenantId: string | null;
}

const STATUS_FLOW: ActionStatus[] = [
  "PENDING",
  "SENT",
  "WAITING_RESPONSE",
  "RESPONDED",
  "COMPLETED",
];

const STATUS_LABEL: Record<ActionStatus, string> = {
  PENDING: "Pendente",
  SENT: "Alerta enviado",
  WAITING_RESPONSE: "Aguardando resposta",
  RESPONDED: "Respondido",
  COMPLETED: "Concluído",
  IGNORED: "Ignorado",
};

export function WatchlistItemDetail({ actionId, onClose, clientTenantId }: Props) {
  const action = useDecisionStore((s) => (actionId ? s.actions.find((a) => a.id === actionId) ?? null : null));
  const alert = useDecisionStore((s) =>
    action?.alert_id ? s.alerts.find((al) => al.id === action.alert_id) ?? null : null,
  );
  const followUps = useDecisionStore((s) => (actionId ? s.followUpsByAction[actionId] ?? [] : []));
  const comments = useDecisionStore((s) => (actionId ? s.commentsByAction[actionId] ?? [] : []));
  const attachments = useDecisionStore((s) => (actionId ? s.attachmentsByAction[actionId] ?? [] : []));

  const loadFollowUps = useDecisionStore((s) => s.loadFollowUps);
  const loadComments = useDecisionStore((s) => s.loadComments);
  const loadAttachments = useDecisionStore((s) => s.loadAttachments);
  const addFollowUp = useDecisionStore((s) => s.addFollowUp);
  const addComment = useDecisionStore((s) => s.addComment);
  const uploadAttachment = useDecisionStore((s) => s.uploadAttachment);
  const setActionStatus = useDecisionStore((s) => s.setActionStatus);

  const [commentText, setCommentText] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!actionId) return;
    void loadFollowUps(actionId);
    void loadComments({ actionId });
    void loadAttachments(actionId);
  }, [actionId, loadFollowUps, loadComments, loadAttachments]);

  const timeline = useMemo(() => {
    if (!action) return [] as Array<{ ts: string; label: string; kind: string }>;
    const events: Array<{ ts: string; label: string; kind: string }> = [];
    events.push({ ts: action.created_at, label: "Ação criada", kind: "created" });
    if (action.status === "SENT" || action.status === "WAITING_RESPONSE" || action.status === "RESPONDED" || action.status === "COMPLETED") {
      events.push({ ts: action.updated_at, label: "Alerta enviado", kind: "sent" });
    }
    for (const f of followUps) {
      events.push({
        ts: f.created_at,
        label: `Follow-up (${f.kind})${f.notes ? ` — ${f.notes}` : ""}`,
        kind: "followup",
      });
      if (f.executed_at) {
        events.push({ ts: f.executed_at, label: `Follow-up executado: ${f.outcome}`, kind: "followup_done" });
      }
    }
    if (action.completed_at) {
      events.push({
        ts: action.completed_at,
        label: action.status === "IGNORED" ? "Ignorado" : "Concluído",
        kind: "completed",
      });
    }
    return events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  }, [action, followUps]);

  if (!actionId || !action) return null;

  const handleAddComment = async () => {
    if (!commentText.trim() || !clientTenantId) return;
    setBusy(true);
    try {
      await addComment({ clientTenantId, actionId, body: commentText.trim() });
      setCommentText("");
    } catch {
      toast.error("Falha ao salvar comentário");
    } finally {
      setBusy(false);
    }
  };

  const handleAddFollowUp = async () => {
    if (!clientTenantId) return;
    setBusy(true);
    try {
      await addFollowUp({
        clientTenantId,
        actionId,
        kind: "email",
        notes: followUpNotes.trim() || "Follow-up enviado",
      });
      if (action.status !== "WAITING_RESPONSE") {
        await setActionStatus(actionId, "WAITING_RESPONSE");
      }
      setFollowUpNotes("");
      toast.success("Follow-up registrado");
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clientTenantId) return;
    setBusy(true);
    try {
      await uploadAttachment({ clientTenantId, actionId, file });
      toast.success(`${file.name} anexado`);
    } catch {
      toast.error("Falha no upload");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <Sheet open={!!actionId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-[560px] p-0 sm:max-w-[560px]">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            {alert?.title ?? action.type}
          </SheetTitle>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-[10px]">{action.type.replace(/_/g, " ")}</Badge>
            <span>·</span>
            <span>{STATUS_LABEL[action.status]}</span>
            {alert?.impacted_city && <span>· {alert.impacted_city}</span>}
            {alert?.impacted_hotel && <span>· {alert.impacted_hotel}</span>}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="p-5">
            {/* Status progression */}
            <div className="mb-5 flex items-center gap-1.5 overflow-x-auto pb-1">
              {STATUS_FLOW.map((s) => {
                const reached = STATUS_FLOW.indexOf(action.status as ActionStatus) >= STATUS_FLOW.indexOf(s);
                const active = action.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => clientTenantId && setActionStatus(actionId, s)}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : reached
                        ? "border-success/40 bg-success-soft text-success"
                        : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>

            <Tabs defaultValue="timeline" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="timeline" className="text-xs">
                  <Sparkles className="mr-1 h-3 w-3" /> Histórico
                </TabsTrigger>
                <TabsTrigger value="comments" className="text-xs">
                  <MessageSquare className="mr-1 h-3 w-3" /> Comentários
                </TabsTrigger>
                <TabsTrigger value="files" className="text-xs">
                  <Paperclip className="mr-1 h-3 w-3" /> Anexos
                </TabsTrigger>
              </TabsList>

              {/* Timeline + follow-up */}
              <TabsContent value="timeline" className="mt-4 space-y-4">
                <div className="rounded-md border border-border bg-card p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Novo follow-up
                  </p>
                  <Textarea
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    placeholder="Notas opcionais (ex.: cobrei taxa Hotel X via email)"
                    className="mb-2 min-h-[60px] text-xs"
                  />
                  <Button size="sm" onClick={handleAddFollowUp} disabled={busy} className="gap-1">
                    <Send className="h-3 w-3" /> Enviar follow-up
                  </Button>
                </div>

                <ol className="space-y-3 border-l-2 border-border pl-4">
                  {timeline.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sem eventos registrados.</p>
                  )}
                  {timeline.map((ev, i) => (
                    <li key={`${ev.kind}-${i}`} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                      <p className="text-xs font-medium text-foreground">{ev.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        <CalendarIcon className="mr-1 inline h-2.5 w-2.5" />
                        {new Date(ev.ts).toLocaleString("pt-BR")}
                      </p>
                    </li>
                  ))}
                </ol>

                {action.status !== "COMPLETED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => setActionStatus(actionId, "COMPLETED")}
                  >
                    <CheckCircle2 className="h-4 w-4 text-success" /> Marcar como concluído
                  </Button>
                )}
              </TabsContent>

              {/* Comments */}
              <TabsContent value="comments" className="mt-4 space-y-3">
                <div className="space-y-2">
                  {comments.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>
                  )}
                  {comments.map((c) => (
                    <div key={c.id} className="rounded-md border border-border bg-card p-3">
                      <p className="text-xs text-foreground">{c.body}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  ))}
                </div>
                <div>
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Adicionar comentário…"
                    className="mb-2 min-h-[60px] text-xs"
                  />
                  <Button size="sm" onClick={handleAddComment} disabled={busy || !commentText.trim()}>
                    Comentar
                  </Button>
                </div>
              </TabsContent>

              {/* Attachments */}
              <TabsContent value="files" className="mt-4 space-y-3">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background py-4 text-xs text-muted-foreground hover:border-primary/40">
                  <Upload className="h-4 w-4" /> Anexar arquivo
                  <input type="file" className="hidden" onChange={handleUpload} disabled={busy} />
                </label>
                {attachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {attachments.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs"
                      >
                        <Paperclip className="h-3 w-3 text-muted-foreground" />
                        <span className="flex-1 truncate">{f.filename}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {(f.size_bytes / 1024).toFixed(0)} KB
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
