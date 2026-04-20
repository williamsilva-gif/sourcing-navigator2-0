import { useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Repeat,
  GripVertical,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NEGOTIATIONS,
  STAGES,
  type NegotiationCard,
  type NegotiationStage,
} from "./negotiationData";
import { NegotiationDetailModal } from "./NegotiationDetailModal";

const PRIORITY_STYLES: Record<NegotiationCard["priority"], { label: string; cls: string }> = {
  high: { label: "Alta", cls: "bg-destructive-soft text-destructive" },
  medium: { label: "Média", cls: "bg-warning-soft text-warning-foreground" },
  low: { label: "Baixa", cls: "bg-muted text-muted-foreground" },
};

function daysUntil(iso: string) {
  const target = new Date(iso).getTime();
  const today = new Date("2025-04-20").getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function NegotiationKanban() {
  const [cards, setCards] = useState<NegotiationCard[]>(NEGOTIATIONS);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<NegotiationStage | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<NegotiationStage, NegotiationCard[]> = {
      received: [], review: [], counter: [], agreed: [],
    };
    for (const c of cards) map[c.stage].push(c);
    return map;
  }, [cards]);

  function onDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDragOverStage(null);
  }

  function onDragOver(e: React.DragEvent, stage: NegotiationStage) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stage) setDragOverStage(stage);
  }

  function onDrop(e: React.DragEvent, stage: NegotiationStage) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    if (!id) return;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, stage } : c)));
    setDraggingId(null);
    setDragOverStage(null);
  }

  const detailCard = detailId ? cards.find((c) => c.id === detailId) ?? null : null;

  function handleCounter(cardId: string, adr: number) {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              adrCurrent: adr,
              discount: Number((((c.adrInitial - adr) / c.adrInitial) * 100).toFixed(1)),
              rounds: c.rounds + 1,
              lastUpdate: new Date().toISOString().slice(0, 10),
              stage: c.stage === "received" || c.stage === "review" ? "counter" : c.stage,
            }
          : c,
      ),
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {STAGES.map((stage) => {
        const items = grouped[stage.key];
        const totalRN = items.reduce((s, c) => s + c.roomNights, 0);
        const isOver = dragOverStage === stage.key;
        return (
          <div
            key={stage.key}
            onDragOver={(e) => onDragOver(e, stage.key)}
            onDrop={(e) => onDrop(e, stage.key)}
            onDragLeave={() => setDragOverStage((s) => (s === stage.key ? null : s))}
            className={`flex h-full flex-col rounded-lg border bg-card transition-colors ${
              isOver ? "border-primary ring-2 ring-primary/20" : "border-border"
            }`}
          >
            <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                <h3 className={`text-sm font-semibold ${stage.accent}`}>{stage.label}</h3>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {totalRN.toLocaleString("pt-BR")} RN
              </span>
            </header>

            <div className="flex flex-1 flex-col gap-2 p-2">
              {items.length === 0 && (
                <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border py-8 text-[11px] text-muted-foreground">
                  Solte cards aqui
                </div>
              )}
              {items.map((c) => {
                const days = daysUntil(c.deadline);
                const overCap = c.adrCurrent > c.cap;
                const variation = ((c.adrCurrent - c.cap) / c.cap) * 100;
                const isDragging = draggingId === c.id;
                return (
                  <article
                    key={c.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, c.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => setDetailId(c.id)}
                    className={`group cursor-grab rounded-md border border-border bg-card p-3 shadow-[var(--shadow-card)] transition-all hover:border-primary/40 hover:shadow-[var(--shadow-elevated)] active:cursor-grabbing ${
                      isDragging ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{c.hotel}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {c.brand} · {c.city}
                        </p>
                      </div>
                      <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <div className="rounded bg-muted/60 px-2 py-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">ADR atual</p>
                        <p className="mt-0.5 flex items-baseline gap-1 text-sm font-semibold text-foreground">
                          ${c.adrCurrent}
                          <span
                            className={`text-[10px] font-medium ${
                              overCap ? "text-destructive" : "text-success"
                            }`}
                          >
                            {variation > 0 ? "+" : ""}
                            {variation.toFixed(1)}%
                          </span>
                        </p>
                      </div>
                      <div className="rounded bg-muted/60 px-2 py-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Desconto</p>
                        <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-success">
                          <TrendingDown className="h-3 w-3" />
                          {c.discount}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {fmtDate(c.deadline)}
                        {days <= 7 && days > 0 && (
                          <span className="ml-1 rounded bg-warning-soft px-1 py-0.5 font-medium text-warning-foreground">
                            {days}d
                          </span>
                        )}
                        {days <= 0 && c.stage !== "agreed" && (
                          <span className="ml-1 flex items-center gap-0.5 rounded bg-destructive-soft px-1 py-0.5 font-medium text-destructive">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            atrasada
                          </span>
                        )}
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[c.priority].cls}`}
                      >
                        {PRIORITY_STYLES[c.priority].label}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Repeat className="h-3 w-3" />
                        {c.rounds} {c.rounds === 1 ? "rodada" : "rodadas"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {fmtDate(c.lastUpdate)}
                      </span>
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary">
                        {c.owner}
                      </div>
                    </div>

                    {c.stage === "agreed" && (
                      <div className="mt-2 flex items-center gap-1 rounded bg-success-soft px-2 py-1 text-[11px] font-medium text-success">
                        <CheckCircle2 className="h-3 w-3" />
                        Acordo fechado
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <footer className="border-t border-border p-2">
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                Adicionar proposta
              </Button>
            </footer>
          </div>
        );
      })}
    </div>
    <NegotiationDetailModal
      card={detailCard}
      onClose={() => setDetailId(null)}
      onSubmitCounter={handleCounter}
    />
    </>
  );
}
