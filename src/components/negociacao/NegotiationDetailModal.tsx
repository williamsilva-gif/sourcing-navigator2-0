import { useEffect, useMemo, useState } from "react";
import {
  X,
  Building2,
  MapPin,
  Calendar,
  Clock,
  TrendingDown,
  TrendingUp,
  Send,
  CheckCircle2,
  AlertTriangle,
  Repeat,
  User,
  DollarSign,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildTimeline,
  type NegotiationCard,
  type NegotiationRound,
} from "./negotiationData";

interface Props {
  card: NegotiationCard | null;
  onClose: () => void;
  onSubmitCounter: (cardId: string, adr: number, message: string) => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function NegotiationDetailModal({ card, onClose, onSubmitCounter }: Props) {
  const [adr, setAdr] = useState("");
  const [message, setMessage] = useState("");
  const [extraRounds, setExtraRounds] = useState<NegotiationRound[]>([]);

  useEffect(() => {
    if (card) {
      setAdr(String(Math.max(card.cap, card.adrCurrent - 10)));
      setMessage("");
      setExtraRounds([]);
    }
  }, [card?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const timeline = useMemo(() => {
    if (!card) return [];
    return [...buildTimeline(card), ...extraRounds];
  }, [card, extraRounds]);

  if (!card) return null;

  const overCap = card.adrCurrent > card.cap;
  const variation = ((card.adrCurrent - card.cap) / card.cap) * 100;
  const adrNum = Number(adr);
  const adrValid = adrNum > 0 && adrNum < card.adrInitial * 1.5;
  const messageValid = message.trim().length >= 5 && message.trim().length <= 500;
  const canSubmit = adrValid && messageValid && card.stage !== "agreed";
  const proposedVariation = adrValid ? ((adrNum - card.cap) / card.cap) * 100 : 0;
  const proposedDiscount = adrValid
    ? ((card.adrInitial - adrNum) / card.adrInitial) * 100
    : 0;

  function handleSubmit() {
    if (!canSubmit) return;
    const next: NegotiationRound = {
      round: timeline.length,
      date: new Date().toISOString().slice(0, 10),
      author: card!.owner,
      side: "buyer",
      adr: adrNum,
      message: message.trim(),
    };
    setExtraRounds((r) => [...r, next]);
    onSubmitCounter(card!.id, adrNum, message.trim());
    setMessage("");
    setAdr(String(Math.max(card!.cap, adrNum - 5)));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-elevated)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border bg-muted/30 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {card.brand}
              <span>·</span>
              <MapPin className="h-3 w-3" />
              {card.city}
              <span>·</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {card.tier}
              </span>
            </div>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground">
              {card.hotel}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {card.roomNights.toLocaleString("pt-BR")} room nights · prazo{" "}
              {fmtDate(card.deadline)} · responsável {card.owner}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
          <Stat label="ADR inicial" value={`$${card.adrInitial}`} muted />
          <Stat
            label="ADR atual"
            value={`$${card.adrCurrent}`}
            tone={overCap ? "destructive" : "success"}
            hint={`${variation > 0 ? "+" : ""}${variation.toFixed(1)}% vs cap`}
          />
          <Stat label="City cap" value={`$${card.cap}`} muted />
          <Stat
            label="Desconto"
            value={`${card.discount}%`}
            tone="success"
            hint={`${card.rounds} ${card.rounds === 1 ? "rodada" : "rodadas"}`}
          />
        </div>

        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1.4fr_1fr]">
          <section className="overflow-y-auto border-b border-border p-5 md:border-b-0 md:border-r">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Repeat className="h-4 w-4 text-primary" />
                Timeline de rodadas
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {timeline.length} {timeline.length === 1 ? "evento" : "eventos"}
              </span>
            </div>

            <ol className="relative space-y-4 border-l-2 border-border pl-5">
              {timeline.map((r, i) => {
                const isLast = i === timeline.length - 1;
                const isBuyer = r.side === "buyer";
                const adrDelta = i === 0 ? 0 : r.adr - timeline[i - 1].adr;
                return (
                  <li key={`${r.round}-${i}`} className="relative">
                    <span
                      className={`absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-card ${
                        isBuyer ? "bg-primary" : "bg-warning"
                      }`}
                    >
                      {isLast && (
                        <span className="absolute h-4 w-4 animate-ping rounded-full bg-current opacity-40" />
                      )}
                    </span>
                    <div
                      className={`rounded-md border p-3 ${
                        isBuyer
                          ? "border-primary/30 bg-primary-soft/40"
                          : "border-warning/30 bg-warning-soft/40"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span
                            className={`rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide ${
                              isBuyer
                                ? "bg-primary text-primary-foreground"
                                : "bg-warning text-warning-foreground"
                            }`}
                          >
                            {isBuyer ? "Comprador" : "Hotel"}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <User className="h-3 w-3" />
                            {r.author}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {fmtDate(r.date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                            ${r.adr}
                          </span>
                          {adrDelta !== 0 && (
                            <span
                              className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                adrDelta < 0
                                  ? "bg-success-soft text-success"
                                  : "bg-destructive-soft text-destructive"
                              }`}
                            >
                              {adrDelta < 0 ? (
                                <TrendingDown className="h-2.5 w-2.5" />
                              ) : (
                                <TrendingUp className="h-2.5 w-2.5" />
                              )}
                              {adrDelta > 0 ? "+" : ""}
                              {adrDelta}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {r.message}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {card.notes && (
              <div className="mt-5 rounded-md border border-border bg-muted/40 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  Observações
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-foreground">
                  {card.notes}
                </p>
              </div>
            )}
          </section>

          <section className="flex flex-col overflow-y-auto bg-muted/20 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Send className="h-4 w-4 text-primary" />
              Nova contraproposta
            </h3>

            {card.stage === "agreed" ? (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-success/30 bg-success-soft p-3 text-xs text-success">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Acordo já fechado</p>
                  <p className="mt-0.5 text-success/80">
                    Esta negociação foi acordada em {fmtDate(card.lastUpdate)}. Para
                    abrir nova rodada, mova o card de volta para Em análise.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        ADR proposto
                      </span>
                      <span className="text-[10px] normal-case text-muted-foreground">
                        cap ${card.cap}
                      </span>
                    </span>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        $
                      </span>
                      <input
                        type="number"
                        value={adr}
                        onChange={(e) => setAdr(e.target.value)}
                        min={1}
                        max={card.adrInitial * 1.5}
                        className="h-10 w-full rounded-md border border-border bg-card pl-7 pr-3 text-sm font-mono font-semibold tabular-nums text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    {adrValid && (
                      <div className="mt-1.5 flex items-center justify-between text-[11px]">
                        <span
                          className={`flex items-center gap-1 ${
                            proposedVariation > 0 ? "text-destructive" : "text-success"
                          }`}
                        >
                          {proposedVariation > 0 ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          {proposedVariation > 0 ? "+" : ""}
                          {proposedVariation.toFixed(1)}% vs cap
                        </span>
                        <span className="text-success">
                          desconto {proposedDiscount.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </label>

                  <label className="block">
                    <span className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <span>Mensagem</span>
                      <span
                        className={`text-[10px] normal-case ${
                          message.length > 500
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {message.length}/500
                      </span>
                    </span>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                      rows={5}
                      maxLength={500}
                      placeholder="Ex: Aceitamos $268 com café da manhã incluso e LRA garantido para os meses de alta temporada..."
                      className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    {message.length > 0 && message.trim().length < 5 && (
                      <p className="mt-1 text-[10px] text-destructive">
                        Mensagem muito curta (mín. 5 caracteres).
                      </p>
                    )}
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
                    <Send className="h-3.5 w-3.5" />
                    Enviar
                  </Button>
                </div>

                <div className="mt-4 rounded-md border border-border bg-card p-3 text-[11px] text-muted-foreground">
                  <p className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Clock className="h-3 w-3" />
                    Próximos passos
                  </p>
                  <ul className="mt-1.5 space-y-0.5 pl-4 leading-relaxed">
                    <li className="list-disc">Hotel responde em até 48h</li>
                    <li className="list-disc">Card move automático para Contraproposta</li>
                    <li className="list-disc">Notificação enviada ao gestor</li>
                  </ul>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
  muted = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "destructive";
  muted?: boolean;
}) {
  const cls =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : muted
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-bold ${cls}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}