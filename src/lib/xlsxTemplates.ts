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
    {
      code: "H-001",
      name: "Grand Hyatt São Paulo",
      address: "Av. das Nações Unidas, 13301",
      postal_code: "04578-000",
      city: "São Paulo",
      state_province: "SP",
      country_code: "BR",
      phone_number: "+55 11 2838-1234",
      Contact: "sales@hyatt.com",
      latitude: -23.6066,
      longitude: -46.6979,
      star_rating: 5,
      category_id: "UPSCALE",
    },
    {
      code: "H-002",
      name: "Belmond Copacabana Palace",
      address: "Av. Atlântica, 1702",
      postal_code: "22021-001",
      city: "Rio de Janeiro",
      state_province: "RJ",
      country_code: "BR",
      phone_number: "+55 21 2548-7070",
      Contact: "reservas@belmond.com",
      latitude: -22.9676,
      longitude: -43.1786,
      star_rating: 5,
      category_id: "LUXURY",
    },
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