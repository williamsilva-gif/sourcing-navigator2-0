import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  bookingSchema,
  hotelSchema,
  contractSchema,
  type Booking,
  type Hotel,
  type Contract,
  type DatasetType,
} from "./baselineSchemas";

export interface UploadRecord {
  id: string;
  type: DatasetType;
  filename: string;
  uploadedAt: string;
  rowCount: number;
  errorCount: number;
  status: "ok" | "partial" | "error";
  errors: string[];
}

interface BaselineState {
  bookings: Booking[];
  hotels: Hotel[];
  contracts: Contract[];
  uploads: UploadRecord[];
  useDemo: boolean;
  ingest: (type: DatasetType, filename: string, rows: unknown[]) => UploadRecord;
  removeUpload: (id: string) => void;
  reset: () => void;
  setUseDemo: (v: boolean) => void;
  upsertHotel: (hotel: Hotel) => void;
  upsertHotelsBulk: (hotels: Hotel[]) => { added: number; updated: number };
  deleteHotel: (code: string) => void;
}

function parseRows<T>(
  rows: unknown[],
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } } }
) {
  const ok: T[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const res = schema.safeParse(r);
    if (res.success) ok.push(res.data);
    else {
      const msg = res.error.issues
        .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
        .join("; ");
      errors.push(`Linha ${i + 2}: ${msg}`);
    }
  });
  return { ok, errors };
}

export const useBaselineStore = create<BaselineState>((set, get) => ({
  bookings: [],
  hotels: [],
  contracts: [],
  uploads: [],
  useDemo: false,
  ingest: (type, filename, rows) => {
    const schema = type === "bookings" ? bookingSchema : type === "hotels" ? hotelSchema : contractSchema;
    const { ok, errors } = parseRows(rows, schema as never);
    const status: UploadRecord["status"] = errors.length === 0 ? "ok" : ok.length === 0 ? "error" : "partial";
    const record: UploadRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      filename,
      uploadedAt: new Date().toISOString(),
      rowCount: ok.length,
      errorCount: errors.length,
      status,
      errors: errors.slice(0, 20),
    };
    set((s) => {
      const next: Partial<BaselineState> = { uploads: [record, ...s.uploads], useDemo: false };
      if (type === "bookings") next.bookings = [...s.bookings, ...(ok as Booking[])];
      if (type === "hotels") next.hotels = [...s.hotels, ...(ok as Hotel[])];
      if (type === "contracts") next.contracts = [...s.contracts, ...(ok as Contract[])];
      return next as BaselineState;
    });
    return record;
  },
  removeUpload: (id) => {
    const upload = get().uploads.find((u) => u.id === id);
    if (!upload) return;
    set((s) => ({
      uploads: s.uploads.filter((u) => u.id !== id),
      // Simplified: clear all rows of that type if upload removed.
      ...(upload.type === "bookings" ? { bookings: [] } : {}),
      ...(upload.type === "hotels" ? { hotels: [] } : {}),
      ...(upload.type === "contracts" ? { contracts: [] } : {}),
    }));
  },
  reset: () => set({ bookings: [], hotels: [], contracts: [], uploads: [], useDemo: false }),
  setUseDemo: (v) => set({ useDemo: v }),
  upsertHotel: (hotel) =>
    set((s) => {
      const idx = s.hotels.findIndex((h) => h.code === hotel.code);
      if (idx === -1) return { hotels: [...s.hotels, hotel] } as Partial<BaselineState> as BaselineState;
      const next = [...s.hotels];
      next[idx] = hotel;
      return { hotels: next } as Partial<BaselineState> as BaselineState;
    }),
  upsertHotelsBulk: (incoming) => {
    let added = 0;
    let updated = 0;
    set((s) => {
      const map = new Map(s.hotels.map((h) => [h.code, h] as const));
      for (const h of incoming) {
        if (map.has(h.code)) updated++;
        else added++;
        map.set(h.code, h);
      }
      return { hotels: Array.from(map.values()) } as Partial<BaselineState> as BaselineState;
    });
    return { added, updated };
  },
  deleteHotel: (code) =>
    set((s) => ({ hotels: s.hotels.filter((h) => h.code !== code) }) as Partial<BaselineState> as BaselineState),
}));

// Per-city ADR distribution + cap (cap = ceil of city ADR rounded to 5)
export function selectAdrDistributionByCity(bookings: Booking[], city: string): { buckets: AdrBucket[]; cap: number; total: number } {
  const filtered = city === "__all__" ? bookings : bookings.filter((b) => b.city === city);
  const ranges: { label: string; min: number; max: number; mid: number }[] = [
    { label: "120-150", min: 120, max: 150, mid: 135 },
    { label: "150-180", min: 150, max: 180, mid: 165 },
    { label: "180-210", min: 180, max: 210, mid: 195 },
    { label: "210-240", min: 210, max: 240, mid: 225 },
    { label: "240-270", min: 240, max: 270, mid: 255 },
    { label: "270-300", min: 270, max: 300, mid: 285 },
    { label: "300-330", min: 300, max: 330, mid: 315 },
    { label: "330-360", min: 330, max: 360, mid: 345 },
    { label: "360-390", min: 360, max: 390, mid: 375 },
    { label: "390+", min: 390, max: Infinity, mid: 405 },
  ];
  const buckets = ranges.map((r) => ({ bucket: r.label, mid: r.mid, count: filtered.filter((b) => b.adr >= r.min && b.adr < r.max).length }));
  const totalRn = filtered.reduce((s, b) => s + b.room_nights, 0);
  const totalSpend = filtered.reduce((s, b) => s + b.room_nights * b.adr, 0);
  const adr = totalRn > 0 ? totalSpend / totalRn : 0;
  const cap = Math.round((adr * 1.02) / 5) * 5;
  return { buckets, cap, total: filtered.length };
}

// ============== Selectors / derivations ==============

export interface CityAggregate {
  city: string;
  state: string;
  roomNights: number;
  spend: number;
  hotels: number;
  adr: number;
  marketShare: number;
}

export function selectCityAggregates(bookings: Booking[]): CityAggregate[] {
  const byCity = new Map<string, { state: string; rn: number; spend: number; hotels: Set<string> }>();
  bookings.forEach((b) => {
    const cur = byCity.get(b.city) ?? { state: b.state ?? "", rn: 0, spend: 0, hotels: new Set<string>() };
    cur.rn += b.room_nights;
    cur.spend += b.room_nights * b.adr;
    cur.hotels.add(b.hotel);
    if (!cur.state && b.state) cur.state = b.state;
    byCity.set(b.city, cur);
  });
  const totalRn = Array.from(byCity.values()).reduce((s, v) => s + v.rn, 0) || 1;
  return Array.from(byCity.entries())
    .map(([city, v]) => ({
      city,
      state: v.state,
      roomNights: v.rn,
      spend: v.spend,
      hotels: v.hotels.size,
      adr: v.rn > 0 ? v.spend / v.rn : 0,
      marketShare: (v.rn / totalRn) * 100,
    }))
    .sort((a, b) => b.roomNights - a.roomNights);
}

export function selectKpis(bookings: Booking[]) {
  const totalRn = bookings.reduce((s, b) => s + b.room_nights, 0);
  const totalSpend = bookings.reduce((s, b) => s + b.room_nights * b.adr, 0);
  const adr = totalRn > 0 ? totalSpend / totalRn : 0;
  const hotels = new Set(bookings.map((b) => b.hotel)).size;
  const cap = 280;
  const overCapSpend = bookings
    .filter((b) => b.adr > cap)
    .reduce((s, b) => s + b.room_nights * b.adr, 0);
  const leakagePct = totalSpend > 0 ? (overCapSpend / totalSpend) * 100 : 0;
  return { totalRn, totalSpend, adr, hotels, leakagePct };
}

export interface AdrBucket {
  bucket: string;
  count: number;
  mid: number;
}

export function selectAdrDistribution(bookings: Booking[]): AdrBucket[] {
  const ranges: { label: string; min: number; max: number; mid: number }[] = [
    { label: "120-150", min: 120, max: 150, mid: 135 },
    { label: "150-180", min: 150, max: 180, mid: 165 },
    { label: "180-210", min: 180, max: 210, mid: 195 },
    { label: "210-240", min: 210, max: 240, mid: 225 },
    { label: "240-270", min: 240, max: 270, mid: 255 },
    { label: "270-300", min: 270, max: 300, mid: 285 },
    { label: "300-330", min: 300, max: 330, mid: 315 },
    { label: "330-360", min: 330, max: 360, mid: 345 },
    { label: "360-390", min: 360, max: 390, mid: 375 },
    { label: "390+", min: 390, max: Infinity, mid: 405 },
  ];
  return ranges.map((r) => ({
    bucket: r.label,
    mid: r.mid,
    count: bookings.filter((b) => b.adr >= r.min && b.adr < r.max).length,
  }));
}

export interface DerivedCityStrategy {
  city: string;
  state: string;
  tier: "Luxury" | "Upscale" | "Midscale" | "Economy";
  roomNights: number;
  currentAdr: number;
  capAdr: number;
  hotels: number;
  priority: "Alta" | "Média" | "Baixa";
  marketShare: number;
}

export function suggestTier(adr: number): DerivedCityStrategy["tier"] {
  if (adr > 400) return "Luxury";
  if (adr >= 280) return "Upscale";
  if (adr >= 180) return "Midscale";
  return "Economy";
}

export function suggestPriority(share: number): DerivedCityStrategy["priority"] {
  if (share >= 10) return "Alta";
  if (share >= 5) return "Média";
  return "Baixa";
}

export function selectDerivedCityStrategy(bookings: Booking[]): DerivedCityStrategy[] {
  return selectCityAggregates(bookings).map((c) => ({
    city: c.city,
    state: c.state,
    tier: suggestTier(c.adr),
    roomNights: c.roomNights,
    currentAdr: Math.round(c.adr),
    // Suggest cap as +2% over current ADR rounded to nearest 5
    capAdr: Math.round((c.adr * 1.02) / 5) * 5,
    hotels: c.hotels,
    priority: suggestPriority(c.marketShare),
    marketShare: c.marketShare,
  }));
}

export function lastUploadAt(uploads: UploadRecord[]): string | null {
  if (uploads.length === 0) return null;
  return uploads[0].uploadedAt;
}