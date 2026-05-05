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

const A: Omit<AwardedHotel, "id">[] = [];

export const AWARDED: AwardedHotel[] = A.map((h, i) => ({ ...h, id: `aw-${i + 1}` }));

export const DEMAND_TARGETS: Record<string, number> = {};

export const AMENITY_LABELS: Record<string, string> = {
  breakfast: "Café da manhã",
  wifi: "Wi-Fi",
  lra: "LRA",
  parking: "Estacionamento",
  gym: "Academia",
};
