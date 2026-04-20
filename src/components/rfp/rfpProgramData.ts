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

export const RFP_PROGRAMS: RfpProgram[] = [
  {
    id: "rfp-2026-global",
    name: "RFP Global 2026 — Programa Corporativo",
    client: "Acme Holdings",
    cycle: "2026",
    status: "Coletando respostas",
    createdAt: "2025-09-15",
    deadline: "2025-11-30",
    invitedHotels: 142,
    responsesReceived: 96,
    cities: ["São Paulo", "Rio de Janeiro", "Buenos Aires", "Cidade do México", "Miami", "Bogotá"],
    estimatedSpend: 18420000,
    owner: "Carla Mendes",
    progress: 67,
  },
  {
    id: "rfp-2026-latam",
    name: "RFP LATAM 2026 — Hotéis Tier 2",
    client: "Acme Holdings",
    cycle: "2026",
    status: "Em análise",
    createdAt: "2025-08-20",
    deadline: "2025-10-31",
    invitedHotels: 64,
    responsesReceived: 58,
    cities: ["Santiago", "Lima", "Bogotá", "Curitiba", "Porto Alegre", "Recife"],
    estimatedSpend: 4200000,
    owner: "Diego Herrera",
    progress: 91,
  },
  {
    id: "rfp-2026-luxury",
    name: "RFP Premium 2026 — C-Level",
    client: "Acme Holdings",
    cycle: "2026",
    status: "Em distribuição",
    createdAt: "2025-10-02",
    deadline: "2025-12-15",
    invitedHotels: 28,
    responsesReceived: 12,
    cities: ["Paris", "Londres", "Nova York", "Buenos Aires", "São Paulo"],
    estimatedSpend: 2800000,
    owner: "Patricia Vieira",
    progress: 43,
  },
  {
    id: "rfp-2026-event",
    name: "RFP MICE 2026 — Eventos Corporativos",
    client: "Globex Pharma",
    cycle: "2026",
    status: "Rascunho",
    createdAt: "2025-10-18",
    deadline: "2026-01-15",
    invitedHotels: 0,
    responsesReceived: 0,
    cities: ["São Paulo", "Rio de Janeiro", "Foz do Iguaçu", "Brasília"],
    estimatedSpend: 3200000,
    owner: "Rafael Costa",
    progress: 8,
  },
  {
    id: "rfp-2025-renewal",
    name: "RFP Renovação Q4 2025 — Tier Estratégico",
    client: "Initech Industries",
    cycle: "2025",
    status: "Encerrado",
    createdAt: "2025-06-10",
    deadline: "2025-08-30",
    invitedHotels: 38,
    responsesReceived: 38,
    cities: ["São Paulo", "Rio de Janeiro", "Belo Horizonte"],
    estimatedSpend: 5680000,
    owner: "Marina Alves",
    progress: 100,
  },
];

const HOTEL_POOL = [
  { hotel: "Marriott Paulista", brand: "Marriott", city: "São Paulo", contact: "carla.silva@marriott.com" },
  { hotel: "Hilton Morumbi", brand: "Hilton", city: "São Paulo", contact: "rafael.costa@hilton.com" },
  { hotel: "Pullman Vila Olímpia", brand: "Accor", city: "São Paulo", contact: "marina.alves@accor.com" },
  { hotel: "Sheraton WTC", brand: "Marriott", city: "São Paulo", contact: "thiago.melo@marriott.com" },
  { hotel: "Grand Hyatt SP", brand: "Hyatt", city: "São Paulo", contact: "ricardo.tanaka@hyatt.com" },
  { hotel: "Tryp Higienópolis", brand: "Meliá", city: "São Paulo", contact: "paulo.henrique@melia.com" },
  { hotel: "Holiday Inn Express SP", brand: "IHG", city: "São Paulo", contact: "felipe.nogueira@ihg.com" },
  { hotel: "Fairmont Copacabana", brand: "Accor", city: "Rio de Janeiro", contact: "patricia.vieira@accor.com" },
  { hotel: "Windsor Atlântica", brand: "Windsor", city: "Rio de Janeiro", contact: "leonardo.santos@windsor.com" },
  { hotel: "Ibis Santos Dumont", brand: "Accor", city: "Rio de Janeiro", contact: "bruno.lima@accor.com" },
  { hotel: "Belmond Copacabana Palace", brand: "Belmond", city: "Rio de Janeiro", contact: "isabela.duarte@belmond.com" },
  { hotel: "Wyndham Rio Barra", brand: "Wyndham", city: "Rio de Janeiro", contact: "carolina.dias@wyndham.com" },
  { hotel: "Hyatt Centric Brickell", brand: "Hyatt", city: "Miami", contact: "sofia.martinez@hyatt.com" },
  { hotel: "Four Seasons Buenos Aires", brand: "Four Seasons", city: "Buenos Aires", contact: "mariana.lopez@fourseasons.com" },
  { hotel: "Park Hyatt Buenos Aires", brand: "Hyatt", city: "Buenos Aires", contact: "lucia.fernandez@hyatt.com" },
  { hotel: "InterContinental Bogotá", brand: "IHG", city: "Bogotá", contact: "diego.herrera@ihg.com" },
  { hotel: "JW Marriott Bogotá", brand: "Marriott", city: "Bogotá", contact: "elena.ramirez@marriott.com" },
  { hotel: "Hyatt Place Bogotá", brand: "Hyatt", city: "Bogotá", contact: "manuel.vega@hyatt.com" },
  { hotel: "Renaissance Polanco", brand: "Marriott", city: "Cidade do México", contact: "valentina.cruz@marriott.com" },
  { hotel: "Meliá Cidade do México", brand: "Meliá", city: "Cidade do México", contact: "alejandra.morales@melia.com" },
  { hotel: "Holiday Inn Santiago", brand: "IHG", city: "Santiago", contact: "andres.rojas@ihg.com" },
  { hotel: "Novotel Lima", brand: "Accor", city: "Lima", contact: "camila.gomez@accor.com" },
  { hotel: "Mercure Curitiba Centro", brand: "Accor", city: "Curitiba", contact: "fernanda.borges@accor.com" },
  { hotel: "Pestana Curitiba", brand: "Pestana", city: "Curitiba", contact: "vanessa.machado@pestana.com" },
  { hotel: "AC Hotel Porto Alegre", brand: "Marriott", city: "Porto Alegre", contact: "gustavo.pereira@marriott.com" },
  { hotel: "Sofitel Recife", brand: "Accor", city: "Recife", contact: "renata.albuquerque@accor.com" },
  { hotel: "Radisson Brasília", brand: "Radisson", city: "Brasília", contact: "juliana.ferreira@radisson.com" },
  { hotel: "Bourbon Convention", brand: "Bourbon", city: "Foz do Iguaçu", contact: "marcelo.kowalski@bourbon.com" },
  { hotel: "Ibis Budget Confins", brand: "Accor", city: "Belo Horizonte", contact: "tatiana.rocha@accor.com" },
];

const STATUSES: HotelResponseStatus[] = ["Submetido", "Submetido", "Submetido", "Em preenchimento", "Em preenchimento", "Não respondeu", "Recusado"];

export const RFP_INVITED_HOTELS: RfpInvitedHotel[] = HOTEL_POOL.map((h, i) => {
  const programs = ["rfp-2026-global", "rfp-2026-latam", "rfp-2026-luxury"];
  const rfpId = programs[i % programs.length];
  const status = STATUSES[i % STATUSES.length];
  return {
    id: `inv-${String(i + 1).padStart(3, "0")}`,
    rfpId,
    hotel: h.hotel,
    brand: h.brand,
    city: h.city,
    contact: h.contact,
    status,
    sentAt: "2025-09-20",
    respondedAt: status === "Submetido" ? "2025-10-08" : status === "Em preenchimento" ? "2025-10-15" : null,
    remindersSent: status === "Não respondeu" ? 3 : status === "Em preenchimento" ? 1 : 0,
    notes:
      status === "Submetido" ? "Resposta completa, aguardando análise comercial." :
      status === "Em preenchimento" ? "Hotel acessou o portal, preenchimento em andamento." :
      status === "Recusado" ? "Hotel declinou participar deste ciclo." :
      "Sem resposta após 3 lembretes. Escalar para account manager.",
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
