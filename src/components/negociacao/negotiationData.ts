export type NegotiationStage = "received" | "review" | "counter" | "agreed";

export interface NegotiationCard {
  id: string;
  hotel: string;
  brand: string;
  city: string;
  tier: "Luxury" | "Upscale" | "Midscale" | "Economy";
  adrInitial: number;
  adrCurrent: number;
  cap: number;
  discount: number;
  roomNights: number;
  deadline: string;
  lastUpdate: string;
  rounds: number;
  owner: string;
  priority: "high" | "medium" | "low";
  stage: NegotiationStage;
  notes: string;
}

export interface NegotiationRound {
  round: number;
  date: string;
  author: string;
  side: "hotel" | "buyer";
  adr: number;
  message: string;
}

export function buildTimeline(card: {
  adrInitial: number;
  adrCurrent: number;
  rounds: number;
  lastUpdate: string;
  owner: string;
  hotel: string;
}): NegotiationRound[] {
  const total = Math.max(1, card.rounds);
  const step = (card.adrInitial - card.adrCurrent) / total;
  const baseDate = new Date(card.lastUpdate).getTime();
  const dayMs = 1000 * 60 * 60 * 24;
  const rounds: NegotiationRound[] = [];
  for (let i = 0; i <= total; i++) {
    const isHotel = i % 2 === 0;
    const adr = i === 0 ? card.adrInitial : i === total ? card.adrCurrent : Math.round(card.adrInitial - step * i);
    const date = new Date(baseDate - (total - i) * dayMs * 2).toISOString().slice(0, 10);
    rounds.push({
      round: i,
      date,
      author: isHotel ? card.hotel.split(" ")[0] : card.owner,
      side: isHotel ? "hotel" : "buyer",
      adr,
      message: i === 0
        ? `Proposta inicial enviada com ADR de $${adr}.`
        : isHotel
          ? `Hotel revisou ADR para $${adr} mantendo café da manhã.`
          : `Contraproposta enviada: $${adr} com LRA garantido e cancelamento 24h.`,
    });
  }
  return rounds;
}

export const STAGES: Array<{
  key: NegotiationStage;
  label: string;
  description: string;
  accent: string;
  dot: string;
}> = [
  { key: "received", label: "Recebida", description: "Proposta inicial enviada pelo hotel", accent: "text-info", dot: "bg-info" },
  { key: "review", label: "Em análise", description: "Validando ADR vs city cap e compliance", accent: "text-warning-foreground", dot: "bg-warning" },
  { key: "counter", label: "Contraproposta", description: "Aguardando retorno do hotel", accent: "text-primary", dot: "bg-primary" },
  { key: "agreed", label: "Acordada", description: "Tarifa final fechada e contrato gerado", accent: "text-success", dot: "bg-success" },
];

const RAW: Array<Omit<NegotiationCard, "id" | "discount">> = [];

export const NEGOTIATIONS: NegotiationCard[] = RAW.map((n, i) => ({
  ...n,
  id: `neg-${i + 1}`,
  discount: Number((((n.adrInitial - n.adrCurrent) / n.adrInitial) * 100).toFixed(1)),
}));

export interface AuctionBid {
  hotel: string;
  brand: string;
  adr: number;
  timestamp: string;
  isLeader?: boolean;
}

export interface AuctionLot {
  id: string;
  city: string;
  tier: "Luxury" | "Upscale" | "Midscale";
  roomNights: number;
  cap: number;
  startingAdr: number;
  currentBest: number;
  bidsCount: number;
  participants: number;
  endsInMinutes: number;
  status: "live" | "closing" | "ended";
  bids: AuctionBid[];
}

export const AUCTIONS: AuctionLot[] = [];
