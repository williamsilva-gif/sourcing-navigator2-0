import * as XLSX from "xlsx";
import { SCHEMA_HEADERS, type DatasetType } from "./baselineSchemas";

const SAMPLE_ROWS: Record<DatasetType, Record<string, string | number>[]> = {
  bookings: [
    {
      booking_id: "BK-0001",
      hotel: "Grand Hyatt São Paulo",
      city: "São Paulo",
      state: "SP",
      checkin: "2025-01-15",
      room_nights: 2,
      adr: 320,
      channel: "GDS",
    },
    {
      booking_id: "BK-0002",
      hotel: "Belmond Copacabana Palace",
      city: "Rio de Janeiro",
      state: "RJ",
      checkin: "2025-01-18",
      room_nights: 1,
      adr: 410,
      channel: "OBT",
    },
  ],
  hotels: [
    { hotel_id: "H-001", name: "Grand Hyatt São Paulo", city: "São Paulo", category: "5*", suggested_tier: "Upscale" },
    { hotel_id: "H-002", name: "Belmond Copacabana Palace", city: "Rio de Janeiro", category: "5*L", suggested_tier: "Luxury" },
  ],
  contracts: [
    { hotel: "Grand Hyatt São Paulo", negotiated_adr: 295, cap: 320, valid_until: "2025-12-31" },
    { hotel: "Belmond Copacabana Palace", negotiated_adr: 380, cap: 420, valid_until: "2025-12-31" },
  ],
};

export function downloadTemplate(type: DatasetType) {
  const headers = SCHEMA_HEADERS[type];
  const rows = SAMPLE_ROWS[type];
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, type);
  XLSX.writeFile(wb, `template_${type}.xlsx`);
}

export async function readSpreadsheet(file: File): Promise<unknown[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const sheet = wb.Sheets[firstSheet];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}