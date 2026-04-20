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

const RAW: Array<Omit<NegotiationCard, "id" | "discount">> = [
  { hotel: "Marriott Paulista", brand: "Marriott", city: "São Paulo", tier: "Upscale", adrInitial: 310, adrCurrent: 285, cap: 290, roomNights: 4820, deadline: "2025-04-28", lastUpdate: "2025-04-18", rounds: 3, owner: "RM", priority: "high", stage: "agreed", notes: "Café da manhã + upgrade incluído. Contrato em assinatura." },
  { hotel: "Hilton Morumbi", brand: "Hilton", city: "São Paulo", tier: "Luxury", adrInitial: 365, adrCurrent: 342, cap: 320, roomNights: 2140, deadline: "2025-04-30", lastUpdate: "2025-04-19", rounds: 2, owner: "RM", priority: "high", stage: "counter", notes: "ADR ainda 6.8% acima do cap. Contraproposta de $315 enviada." },
  { hotel: "Pullman Vila Olímpia", brand: "Accor", city: "São Paulo", tier: "Upscale", adrInitial: 295, adrCurrent: 268, cap: 290, roomNights: 3650, deadline: "2025-05-02", lastUpdate: "2025-04-17", rounds: 2, owner: "JS", priority: "medium", stage: "agreed", notes: "Melhor ADR vs cap (-7.6%). Acordo fechado." },
  { hotel: "Sheraton WTC", brand: "Marriott", city: "São Paulo", tier: "Upscale", adrInitial: 305, adrCurrent: 298, cap: 290, roomNights: 1980, deadline: "2025-04-25", lastUpdate: "2025-04-19", rounds: 1, owner: "JS", priority: "medium", stage: "review", notes: "Validando políticas de cancelamento (48h vs 24h padrão)." },
  { hotel: "Renaissance Faria Lima", brand: "Marriott", city: "São Paulo", tier: "Luxury", adrInitial: 355, adrCurrent: 340, cap: 320, roomNights: 1420, deadline: "2025-05-05", lastUpdate: "2025-04-19", rounds: 1, owner: "AL", priority: "low", stage: "received", notes: "Primeira proposta recebida hoje. ADR alto vs cap." },
  { hotel: "Grand Hyatt SP", brand: "Hyatt", city: "São Paulo", tier: "Luxury", adrInitial: 410, adrCurrent: 395, cap: 380, roomNights: 980, deadline: "2025-05-08", lastUpdate: "2025-04-18", rounds: 2, owner: "RM", priority: "medium", stage: "counter", notes: "Segundo round. Pedimos $370 + LRA garantido." },
  { hotel: "Fairmont Copacabana", brand: "Accor", city: "Rio de Janeiro", tier: "Luxury", adrInitial: 520, adrCurrent: 495, cap: 480, roomNights: 760, deadline: "2025-05-10", lastUpdate: "2025-04-16", rounds: 2, owner: "AL", priority: "high", stage: "review", notes: "ADR 3.1% acima do cap. Avaliando custo-benefício." },
  { hotel: "Belmond Copacabana Palace", brand: "Belmond", city: "Rio de Janeiro", tier: "Luxury", adrInitial: 680, adrCurrent: 680, cap: 600, roomNights: 420, deadline: "2025-04-29", lastUpdate: "2025-04-15", rounds: 1, owner: "RM", priority: "low", stage: "received", notes: "Proposta muito acima do cap. Difícil acordo." },
  { hotel: "JW Marriott Copacabana", brand: "Marriott", city: "Rio de Janeiro", tier: "Luxury", adrInitial: 445, adrCurrent: 420, cap: 450, roomNights: 1850, deadline: "2025-05-01", lastUpdate: "2025-04-19", rounds: 2, owner: "JS", priority: "high", stage: "agreed", notes: "Excelente acordo. ADR 6.7% abaixo do cap." },
  { hotel: "InterContinental Rio", brand: "IHG", city: "Rio de Janeiro", tier: "Upscale", adrInitial: 320, adrCurrent: 298, cap: 310, roomNights: 2240, deadline: "2025-05-03", lastUpdate: "2025-04-19", rounds: 2, owner: "AL", priority: "medium", stage: "counter", notes: "Aguardando retorno sobre breakfast incluso." },
  { hotel: "Windsor Atlântica", brand: "Windsor", city: "Rio de Janeiro", tier: "Upscale", adrInitial: 285, adrCurrent: 265, cap: 290, roomNights: 1620, deadline: "2025-05-06", lastUpdate: "2025-04-18", rounds: 1, owner: "JS", priority: "low", stage: "review", notes: "Boa proposta inicial. Validando políticas." },
  { hotel: "Tivoli Mofarrej", brand: "Minor", city: "São Paulo", tier: "Luxury", adrInitial: 395, adrCurrent: 372, cap: 380, roomNights: 890, deadline: "2025-05-04", lastUpdate: "2025-04-17", rounds: 2, owner: "RM", priority: "medium", stage: "agreed", notes: "Acordo fechado com early check-in incluso." },
];

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

export const AUCTIONS: AuctionLot[] = [
  {
    id: "lot-1", city: "São Paulo", tier: "Upscale", roomNights: 3500, cap: 290,
    startingAdr: 310, currentBest: 268, bidsCount: 14, participants: 6,
    endsInMinutes: 12, status: "closing",
    bids: [
      { hotel: "Pullman Vila Olímpia", brand: "Accor", adr: 268, timestamp: "há 2 min", isLeader: true },
      { hotel: "Marriott Paulista", brand: "Marriott", adr: 272, timestamp: "há 4 min" },
      { hotel: "Sheraton WTC", brand: "Marriott", adr: 278, timestamp: "há 7 min" },
      { hotel: "Novotel Center Norte", brand: "Accor", adr: 282, timestamp: "há 11 min" },
      { hotel: "Mercure Pinheiros", brand: "Accor", adr: 285, timestamp: "há 18 min" },
    ],
  },
  {
    id: "lot-2", city: "Rio de Janeiro", tier: "Luxury", roomNights: 1200, cap: 480,
    startingAdr: 540, currentBest: 462, bidsCount: 9, participants: 4,
    endsInMinutes: 47, status: "live",
    bids: [
      { hotel: "JW Marriott Copacabana", brand: "Marriott", adr: 462, timestamp: "há 5 min", isLeader: true },
      { hotel: "Fairmont Copacabana", brand: "Accor", adr: 475, timestamp: "há 12 min" },
      { hotel: "Hilton Copacabana", brand: "Hilton", adr: 488, timestamp: "há 24 min" },
      { hotel: "Belmond Copa Palace", brand: "Belmond", adr: 510, timestamp: "há 38 min" },
    ],
  },
  {
    id: "lot-3", city: "Brasília", tier: "Upscale", roomNights: 1800, cap: 320,
    startingAdr: 345, currentBest: 295, bidsCount: 11, participants: 5,
    endsInMinutes: 0, status: "ended",
    bids: [
      { hotel: "Royal Tulip Brasília", brand: "Louvre", adr: 295, timestamp: "encerrado", isLeader: true },
      { hotel: "Meliá Brasil 21", brand: "Meliá", adr: 305, timestamp: "encerrado" },
      { hotel: "Kubitschek Plaza", brand: "Independente", adr: 312, timestamp: "encerrado" },
    ],
  },
];
