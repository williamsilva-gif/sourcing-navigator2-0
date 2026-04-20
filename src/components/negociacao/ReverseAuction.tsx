import { useEffect, useMemo, useState } from "react";
import { Gavel, Timer, Users, Activity, TrendingDown, Zap, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUCTIONS, type AuctionLot } from "./negotiationData";
import { CreateLotModal } from "./CreateLotModal";

const STATUS_STYLES: Record<AuctionLot["status"], { label: string; cls: string; pulse: boolean }> = {
  live: { label: "Ao vivo", cls: "bg-success-soft text-success", pulse: true },
  closing: { label: "Encerrando", cls: "bg-warning-soft text-warning-foreground", pulse: true },
  ended: { label: "Encerrado", cls: "bg-muted text-muted-foreground", pulse: false },
};

function fmtCurrency(n: number) {
  return `$${n.toLocaleString("en-US")}`;
}

function LotCard({ lot }: { lot: AuctionLot }) {
  const [remaining, setRemaining] = useState(lot.endsInMinutes * 60);

  useEffect(() => {
    if (lot.status === "ended") return;
    const id = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [lot.status]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const savings = lot.startingAdr - lot.currentBest;
  const savingsPct = ((savings / lot.startingAdr) * 100).toFixed(1);
  const totalSavings = savings * lot.roomNights;
  const status = STATUS_STYLES[lot.status];
  const overCap = lot.currentBest > lot.cap;

  return (
    <article className="flex flex-col rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="flex items-start justify-between border-b border-border p-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}
            >
              {status.pulse && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                </span>
              )}
              {status.label}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {lot.tier}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-foreground">{lot.city}</h3>
          <p className="text-xs text-muted-foreground">
            {lot.roomNights.toLocaleString("pt-BR")} room nights · cap {fmtCurrency(lot.cap)}
          </p>
        </div>

        {lot.status !== "ended" ? (
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Timer className="h-3 w-3" /> termina em
            </div>
            <p
              className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${
                lot.status === "closing" ? "text-warning-foreground" : "text-foreground"
              }`}
            >
              {mm}:{ss}
            </p>
          </div>
        ) : (
          <div className="rounded bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
            Adjudicado
          </div>
        )}
      </header>

      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        <div className="px-3 py-3 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Inicial</p>
          <p className="mt-0.5 text-sm font-semibold text-muted-foreground line-through">
            {fmtCurrency(lot.startingAdr)}
          </p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Melhor lance</p>
          <p
            className={`mt-0.5 text-base font-bold ${
              overCap ? "text-destructive" : "text-success"
            }`}
          >
            {fmtCurrency(lot.currentBest)}
          </p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Economia</p>
          <p className="mt-0.5 flex items-center justify-center gap-1 text-sm font-bold text-success">
            <TrendingDown className="h-3 w-3" />-{savingsPct}%
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2 text-[11px]">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Activity className="h-3 w-3" />
          <strong className="font-semibold text-foreground">{lot.bidsCount}</strong> lances
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Users className="h-3 w-3" />
          <strong className="font-semibold text-foreground">{lot.participants}</strong> hotéis
        </span>
        <span className="text-muted-foreground">
          Economia total{" "}
          <strong className="font-semibold text-success">
            {fmtCurrency(totalSavings)}
          </strong>
        </span>
      </div>

      <ul className="flex-1 divide-y divide-border">
        {lot.bids.map((b, i) => (
          <li
            key={`${lot.id}-${i}`}
            className={`flex items-center justify-between px-4 py-2 text-xs ${
              b.isLeader ? "bg-success-soft/40" : ""
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  b.isLeader
                    ? "bg-success text-success-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {b.isLeader ? <Trophy className="h-3 w-3" /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{b.hotel}</p>
                <p className="text-[10px] text-muted-foreground">
                  {b.brand} · {b.timestamp}
                </p>
              </div>
            </div>
            <span
              className={`font-mono font-semibold tabular-nums ${
                b.isLeader ? "text-success" : "text-foreground"
              }`}
            >
              {fmtCurrency(b.adr)}
            </span>
          </li>
        ))}
      </ul>

      <footer className="flex items-center justify-between gap-2 border-t border-border p-3">
        {lot.status === "ended" ? (
          <Button variant="outline" size="sm" className="w-full">
            Ver contrato adjudicado
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" className="flex-1">
              Acompanhar
            </Button>
            <Button size="sm" className="flex-1">
              <Zap className="h-3.5 w-3.5" />
              Encerrar agora
            </Button>
          </>
        )}
      </footer>
    </article>
  );
}

export function ReverseAuction() {
  const liveCount = AUCTIONS.filter((a) => a.status !== "ended").length;
  const totalSavings = AUCTIONS.reduce(
    (s, a) => s + (a.startingAdr - a.currentBest) * a.roomNights,
    0,
  );

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary">
            <Gavel className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Leilão reverso
            </h2>
            <p className="text-xs text-muted-foreground">
              {liveCount} lotes ativos · economia projetada{" "}
              <span className="font-semibold text-success">
                {fmtCurrency(totalSavings)}
              </span>
            </p>
          </div>
        </div>
        <Button size="sm">
          <Gavel className="h-3.5 w-3.5" />
          Criar novo lote
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {AUCTIONS.map((lot) => (
          <LotCard key={lot.id} lot={lot} />
        ))}
      </div>
    </section>
  );
}
