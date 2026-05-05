export type RfpProgramStatus = "Rascunho" | "Em distribuição" | "Coletando respostas" | "Em análise" | "Encerrado";
export type HotelResponseStatus = "Não respondeu" | "Em preenchimento" | "Submetido" | "Recusado";

export interface RfpProgram {
  id: string;
  name: string;
  client: string;
  cycle: string;
  status: RfpProgramStatus;
  createdAt: string;
  deadline: string;
  invitedHotels: number;
  responsesReceived: number;
  cities: string[];
  estimatedSpend: number;
  owner: string;
  progress: number;
}

export interface RfpInvitedHotel {
  id: string;
  rfpId: string;
  hotel: string;
  brand: string;
  city: string;
  contact: string;
  status: HotelResponseStatus;
  sentAt: string;
  respondedAt: string | null;
  remindersSent: number;
  notes: string;
}

export const RFP_PROGRAMS: RfpProgram[] = [];

const HOTEL_POOL: Array<{ hotel: string; brand: string; city: string; contact: string }> = [];

const STATUSES: HotelResponseStatus[] = [];

export const RFP_INVITED_HOTELS: RfpInvitedHotel[] = HOTEL_POOL.map((h, i) => {
  const programs = ["rfp-2026-global", "rfp-2026-latam", "rfp-2026-luxury"];
  const rfpId = programs[i % programs.length];
  const status = STATUSES[i % Math.max(1, STATUSES.length)] ?? "Não respondeu";
  return {
    id: `inv-${String(i + 1).padStart(3, "0")}`,
    rfpId,
    hotel: h.hotel,
    brand: h.brand,
    city: h.city,
    contact: h.contact,
    status,
    sentAt: "2025-09-20",
    respondedAt: null,
    remindersSent: 0,
    notes: "",
  };
});

export const RFP_REQUIREMENT_TEMPLATES = [
  { id: "req-1", label: "Café da manhã incluso na tarifa", required: true },
  { id: "req-2", label: "Wi-Fi gratuito em quartos e áreas comuns", required: true },
  { id: "req-3", label: "Cancelamento até 24h antes do check-in", required: true },
  { id: "req-4", label: "Last Room Availability (LRA)", required: false },
  { id: "req-5", label: "Upgrade gratuito para diretores e C-level", required: false },
  { id: "req-6", label: "Crédito de F&B de US$ 25 por estadia", required: false },
  { id: "req-7", label: "Faturamento centralizado (Central Billing)", required: true },
  { id: "req-8", label: "Comissionamento via GDS (10%)", required: false },
];
