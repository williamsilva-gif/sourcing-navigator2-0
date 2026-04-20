export interface AwardedHotel {
  id: string;
  hotel: string;
  brand: string;
  city: string;
  tier: "Luxury" | "Upscale" | "Midscale" | "Economy";
  finalAdr: number;
  cap: number;
  startingAdr: number;
  roomNights: number;
  qualityScore: number;
  compliance: number;
  amenities: string[];
  cancellationHours: number;
  contractStart: string;
  contractEnd: string;
  status: "primary" | "backup";
}

const A: Omit<AwardedHotel, "id">[] = [
  { hotel: "Marriott Paulista", brand: "Marriott", city: "São Paulo", tier: "Upscale", finalAdr: 285, cap: 290, startingAdr: 310, roomNights: 4820, qualityScore: 92, compliance: 98, amenities: ["breakfast", "wifi", "lra", "gym"], cancellationHours: 24, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "primary" },
  { hotel: "Pullman Vila Olímpia", brand: "Accor", city: "São Paulo", tier: "Upscale", finalAdr: 268, cap: 290, startingAdr: 295, roomNights: 3650, qualityScore: 89, compliance: 96, amenities: ["breakfast", "wifi", "lra", "parking"], cancellationHours: 24, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "primary" },
  { hotel: "Sheraton WTC", brand: "Marriott", city: "São Paulo", tier: "Upscale", finalAdr: 282, cap: 290, startingAdr: 305, roomNights: 1980, qualityScore: 87, compliance: 94, amenities: ["breakfast", "wifi", "gym"], cancellationHours: 48, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "backup" },
  { hotel: "Tivoli Mofarrej", brand: "Minor", city: "São Paulo", tier: "Luxury", finalAdr: 372, cap: 380, startingAdr: 395, roomNights: 890, qualityScore: 94, compliance: 97, amenities: ["breakfast", "wifi", "lra", "parking", "gym"], cancellationHours: 24, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "primary" },
  { hotel: "Grand Hyatt SP", brand: "Hyatt", city: "São Paulo", tier: "Luxury", finalAdr: 378, cap: 380, startingAdr: 410, roomNights: 980, qualityScore: 95, compliance: 95, amenities: ["breakfast", "wifi", "lra", "gym"], cancellationHours: 24, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "backup" },
  { hotel: "JW Marriott Copacabana", brand: "Marriott", city: "Rio de Janeiro", tier: "Luxury", finalAdr: 420, cap: 450, startingAdr: 445, roomNights: 1850, qualityScore: 93, compliance: 96, amenities: ["breakfast", "wifi", "lra", "gym"], cancellationHours: 24, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "primary" },
  { hotel: "Fairmont Copacabana", brand: "Accor", city: "Rio de Janeiro", tier: "Luxury", finalAdr: 478, cap: 480, startingAdr: 520, roomNights: 760, qualityScore: 96, compliance: 93, amenities: ["breakfast", "wifi", "parking", "gym"], cancellationHours: 48, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "backup" },
  { hotel: "InterContinental Rio", brand: "IHG", city: "Rio de Janeiro", tier: "Upscale", finalAdr: 295, cap: 310, startingAdr: 320, roomNights: 2240, qualityScore: 88, compliance: 95, amenities: ["breakfast", "wifi", "lra"], cancellationHours: 24, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "primary" },
  { hotel: "Royal Tulip Brasília", brand: "Louvre", city: "Brasília", tier: "Upscale", finalAdr: 295, cap: 320, startingAdr: 345, roomNights: 1800, qualityScore: 85, compliance: 92, amenities: ["breakfast", "wifi", "parking"], cancellationHours: 24, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "primary" },
  { hotel: "Meliá Brasil 21", brand: "Meliá", city: "Brasília", tier: "Upscale", finalAdr: 305, cap: 320, startingAdr: 335, roomNights: 1240, qualityScore: 84, compliance: 90, amenities: ["breakfast", "wifi", "gym"], cancellationHours: 48, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "backup" },
  { hotel: "Belmond Copacabana Palace", brand: "Belmond", city: "Rio de Janeiro", tier: "Luxury", finalAdr: 580, cap: 600, startingAdr: 680, roomNights: 420, qualityScore: 98, compliance: 91, amenities: ["breakfast", "wifi", "lra", "parking", "gym"], cancellationHours: 24, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "primary" },
  { hotel: "Ouro Minas BH", brand: "Independente", city: "Belo Horizonte", tier: "Upscale", finalAdr: 245, cap: 260, startingAdr: 275, roomNights: 1320, qualityScore: 82, compliance: 89, amenities: ["breakfast", "wifi", "parking"], cancellationHours: 24, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "primary" },
  { hotel: "Mercure BH Lourdes", brand: "Accor", city: "Belo Horizonte", tier: "Midscale", finalAdr: 198, cap: 220, startingAdr: 225, roomNights: 980, qualityScore: 79, compliance: 88, amenities: ["breakfast", "wifi"], cancellationHours: 24, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "primary" },
  { hotel: "Bourbon Curitiba Convention", brand: "Bourbon", city: "Curitiba", tier: "Upscale", finalAdr: 232, cap: 250, startingAdr: 260, roomNights: 1450, qualityScore: 86, compliance: 94, amenities: ["breakfast", "wifi", "parking", "gym"], cancellationHours: 24, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "primary" },
  { hotel: "Sheraton Porto Alegre", brand: "Marriott", city: "Porto Alegre", tier: "Upscale", finalAdr: 248, cap: 270, startingAdr: 285, roomNights: 1180, qualityScore: 88, compliance: 93, amenities: ["breakfast", "wifi", "lra", "gym"], cancellationHours: 24, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "primary" },
  { hotel: "Hilton Recife", brand: "Hilton", city: "Recife", tier: "Upscale", finalAdr: 268, cap: 290, startingAdr: 305, roomNights: 920, qualityScore: 90, compliance: 95, amenities: ["breakfast", "wifi", "lra", "parking"], cancellationHours: 24, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "primary" },
  { hotel: "Fera Palace Salvador", brand: "Independente", city: "Salvador", tier: "Luxury", finalAdr: 342, cap: 360, startingAdr: 385, roomNights: 580, qualityScore: 91, compliance: 92, amenities: ["breakfast", "wifi", "gym"], cancellationHours: 48, contractStart: "2025-06-01", contractEnd: "2026-05-31", status: "primary" },
];

export const AWARDED: AwardedHotel[] = A.map((h, i) => ({ ...h, id: `aw-${i + 1}` }));

export const DEMAND_TARGETS: Record<string, number> = {
  "São Paulo": 13000,
  "Rio de Janeiro": 5500,
  "Brasília": 3000,
  "Belo Horizonte": 2200,
  "Curitiba": 1500,
  "Porto Alegre": 1200,
  "Recife": 900,
  "Salvador": 600,
};

export const AMENITY_LABELS: Record<string, string> = {
  breakfast: "Café da manhã",
  wifi: "Wi-Fi",
  lra: "LRA",
  parking: "Estacionamento",
  gym: "Academia",
};
