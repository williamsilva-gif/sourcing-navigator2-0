export type RfpStatus = "approved" | "negotiation" | "rejected" | "pending";

export interface RfpRow {
  id: string;
  hotel: string;
  brand: string;
  city: string;
  tier: "Luxury" | "Upscale" | "Midscale" | "Economy";
  adr: number;
  cap: number;
  variation: number; // adr vs cap %
  roomNights: number;
  spend: number;
  breakfast: boolean;
  wifi: boolean;
  cancellation: number; // hours
  lra: boolean; // last room availability
  scoreCommercial: number; // 0-100
  scoreCompliance: number; // 0-100
  scoreLocation: number; // 0-100
  scoreTotal: number; // weighted
  status: RfpStatus;
  responseDate: string;
  contact: string;
  notes: string;
}

const HOTELS: Array<Omit<RfpRow, "id" | "scoreTotal" | "variation">> = [];

export const RFP_ROWS: RfpRow[] = HOTELS.map((h, i) => {
  const variation = ((h.adr - h.cap) / h.cap) * 100;
  const scoreTotal = Math.round(
    h.scoreCommercial * 0.5 + h.scoreCompliance * 0.3 + h.scoreLocation * 0.2,
  );
  return {
    ...h,
    id: `rfp-${String(i + 1).padStart(3, "0")}`,
    variation,
    scoreTotal,
  };
});