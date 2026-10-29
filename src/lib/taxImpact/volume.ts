import * as XLSX from "xlsx";
import { clean, normalize, numberValue, validateWorkbookBytes, type Row } from "./core";
export const volumeFields = {
  month: "Mês check in",
  year: "Ano check in",
  network: "Grupo Fornecedor",
  hotel: "Fornecedor",
  cnpj: "CNPJ",
  city: "Cidade",
  state: "Estado",
  checkin: "Data in",
  nights: "Diárias",
  amount: "Tarifa",
};
export type VolumeField = keyof typeof volumeFields;
export type VolumeMapping = Partial<Record<VolumeField, number>>;
export type VolumeRow = {
  row: number;
  month: number;
  year: number;
  network: string;
  hotel: string;
  cnpj: string;
  city: string;
  state: string;
  nights: number;
  amount: number;
};
export function volumeProvenance(imported?: { filename: string; mapping: unknown } | null) {
  const mapping = imported?.mapping && typeof imported.mapping === "object" && !Array.isArray(imported.mapping)
    ? imported.mapping as Record<string, unknown> : {};
  const monthly = mapping.kind === "real_monthly_rollup";
  const synthetic = !monthly && /simulad|sint[eé]tic/i.test(imported?.filename ?? "");
  return {
    kind: monthly ? "real_monthly_rollup" : synthetic ? "synthetic" : imported ? "uploaded" : "missing",
    originalInStorage: imported ? mapping.original_in_storage !== false : false,
    sourceRecords: monthly && typeof mapping.source_records === "number" ? mapping.source_records : null,
    filename: imported?.filename ?? "",
  };
}
export type VolumeProvenance = ReturnType<typeof volumeProvenance>;
export function volumeProvenanceLabel(provenance: VolumeProvenance) {
  if (provenance.kind === "real_monthly_rollup") {
    const count = provenance.sourceRecords?.toLocaleString("pt-BR") ?? "quantidade não informada de";
    return `Volumetria REAL Deloitte, agregada mensalmente de ${count} transações; ${provenance.originalInStorage ? "arquivo original indicado como armazenado no cofre" : "arquivo XLSX original ainda NÃO armazenado no cofre"}. Tarifas RFP fictícias de demo; totais e ADR de volume históricos reais.`;
  }
  if (provenance.kind === "synthetic") return "VOLUMETRIA SINTÉTICA — valores históricos demonstrativos, não dados Deloitte reais.";
  if (provenance.kind === "uploaded") return "Volumetria importada — origem e valores conforme arquivo fornecido; autenticidade não verificada automaticamente.";
  return "Sem volumetria importada; indicadores históricos e projeções sem base.";
}
export function volumeBook(bytes: Uint8Array, csv = false) {
  if (bytes.length > 10 * 1024 * 1024) throw new Error("Arquivo acima de 10 MB.");
  if (!csv) validateWorkbookBytes(bytes);
  const wb = XLSX.read(csv ? new TextDecoder().decode(bytes) : bytes, {
    type: csv ? "string" : "array",
    cellFormula: false,
    sheetRows: 20052,
  });
  for (const sheet of Object.values(wb.Sheets)) {
    const r = XLSX.utils.decode_range(sheet["!fullref"] || sheet["!ref"] || "A1");
    if (r.e.r > 20050 || r.e.c >= 200) throw new Error("Máximo de 20.000 linhas e 200 colunas.");
  }
  return wb;
}
export function volumePreview(wb: XLSX.WorkBook, sheet: string) {
  const ws = wb.Sheets[sheet];
  if (!ws) throw new Error("Aba não encontrada.");
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
  let header = 0,
    best = -1;
  const aliases: Record<VolumeField, string[]> = {
    month: ["mes check in"],
    year: ["ano check in"],
    network: ["grupo fornecedor", "rede"],
    hotel: ["fornecedor", "hotel", "nome fantasia"],
    cnpj: ["cnpj"],
    city: ["cidade", "cidades"],
    state: ["estado", "uf"],
    checkin: ["data in", "check in", "checkin"],
    nights: ["diarias", "room nights"],
    amount: ["tarifa", "valor transacionado", "valor"],
  };
  const detect = (v: unknown) =>
    (Object.keys(aliases) as VolumeField[]).find((f) => aliases[f].includes(normalize(v)));
  grid.slice(0, 50).forEach((r, i) => {
    const score = r.map(detect).filter(Boolean).length;
    if (score > best) {
      best = score;
      header = i;
    }
  });
  const columns = (grid[header] ?? []).map((v, index) => ({ index, name: clean(v) }));
  const mapping: VolumeMapping = {};
  for (const f of Object.keys(volumeFields) as VolumeField[]) {
    const candidates = columns.filter((c) => detect(c.name) === f);
    if (candidates.length === 1) mapping[f] = candidates[0].index;
  }
  return { grid, headerRow: header + 1, columns, mapping };
}
export function parseVolume(wb: XLSX.WorkBook, sheet: string, mapping: VolumeMapping) {
  const p = volumePreview(wb, sheet);
  const rows: VolumeRow[] = [],
    errors: { row: number; message: string }[] = [];
  if (
    mapping.hotel === undefined ||
    mapping.nights === undefined ||
    mapping.amount === undefined ||
    (mapping.checkin === undefined && (mapping.year === undefined || mapping.month === undefined))
  )
    throw new Error("Mapeie hotel, diárias, valor e check-in ou mês/ano.");
  const cols = Object.values(mapping);
  if (
    new Set(cols).size !== cols.length ||
    cols.some((c) => !Number.isInteger(c) || c < 0 || c >= p.columns.length)
  )
    throw new Error("Mapeamento repetido ou inválido.");
  for (let i = p.headerRow; i < p.grid.length; i++) {
    const raw = p.grid[i];
    if (!raw.some((v) => clean(v))) continue;
    const get = (f: VolumeField) => (mapping[f] === undefined ? "" : raw[mapping[f]]);
    let year = numberValue(get("year")),
      month = numberValue(get("month"));
    if (mapping.checkin !== undefined && clean(get("checkin"))) {
      const v = get("checkin");
      let d: { y: number; m: number } | null = null;
      if (typeof v === "number") d = XLSX.SSF.parse_date_code(v);
      else {
        const t = clean(v),
          iso = /^(\d{4})-(\d{2})-\d{2}/.exec(t),
          br = /^\d{1,2}[/-](\d{1,2})[/-](\d{4})/.exec(t);
        if (iso) d = { y: Number(iso[1]), m: Number(iso[2]) };
        else if (br) d = { y: Number(br[2]), m: Number(br[1]) };
      }
      year = d?.y ?? null;
      month = d?.m ?? null;
    }
    const nights = numberValue(get("nights")),
      amount = numberValue(get("amount")),
      hotel = clean(get("hotel")),
      cnpj = clean(get("cnpj")).replace(/\D/g, "");
    if (
      !hotel ||
      year === null ||
      month === null ||
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      nights === null ||
      amount === null ||
      nights <= 0 ||
      amount <= 0 ||
      (cnpj && cnpj.length > 14)
    ) {
      errors.push({
        row: i + 1,
        message: "Hotel/data/diárias/valor inválido, zero ou negativo; excluído dos indicadores.",
      });
      continue;
    }
    rows.push({
      row: i + 1,
      year,
      month,
      nights,
      amount,
      hotel,
      cnpj: cnpj ? cnpj.padStart(14, "0") : "",
      network: clean(get("network")),
      city: clean(get("city")),
      state: clean(get("state")).toUpperCase(),
    });
  }
  if (rows.length > 20000) throw new Error("Máximo de 20.000 linhas.");
  return { rows, errors, headerRow: p.headerRow };
}
export function volumeStats(rows: VolumeRow[], growth = 0, fallback?: number) {
  const fy = rows.filter((r) => r.year === 2025),
    jm25 = fy.filter((r) => r.month <= 5),
    jm26 = rows.filter((r) => r.year === 2026 && r.month <= 5);
  const sum = (r: VolumeRow[], f: "nights" | "amount") => r.reduce((a, v) => a + v[f], 0);
  const fy25 = sum(fy, "nights"),
    n25 = sum(jm25, "nights"),
    n26 = sum(jm26, "nights"),
    ratio = fy25 > 0 ? n25 / fy25 : null;
  const own = fy25 >= 30 && n25 >= 12 && ratio !== null && ratio >= 0.15 && ratio <= 0.85;
  const seasonality = fallback === undefined ? ratio : own ? ratio : fallback;
  const projected = n26 > 0 && seasonality !== null && seasonality > 0 ? n26 / seasonality : null;
  const adr = (r: VolumeRow[]) =>
    sum(r, "nights") > 0 ? sum(r, "amount") / sum(r, "nights") : null;
  return {
    fy25,
    n25,
    n26,
    spend25: sum(fy, "amount"),
    spend26: sum(jm26, "amount"),
    adr25: adr(fy),
    adr26: adr(jm26),
    seasonality,
    method: fallback === undefined ? "portfolio" : own ? "hotel" : "fallback portfolio",
    projected26: projected,
    projected27: projected === null ? null : projected * (1 + growth / 100),
    quality:
      n26 === 0 ? "sem base 2026" : own ? "sazonalidade própria" : "fallback / cobertura limitada",
  };
}
export function matchVolumes(program: Row[], volume: VolumeRow[]) {
  const assignments = new Map<string, VolumeRow[]>();
  const ambiguous: VolumeRow[] = [],
    unmatched: VolumeRow[] = [];
  for (const v of volume) {
    const c = v.cnpj ? program.filter((p) => p.cnpj === v.cnpj) : [];
    // A shared fiscal identifier is never distributed automatically, even when names look similar.
    const candidates = c.length
      ? c
      : program.filter(
          (p) =>
            normalize(p.hotel) === normalize(v.hotel) &&
            normalize(p.city) === normalize(v.city) &&
            normalize(p.state) === normalize(v.state) &&
            normalize(p.network) === normalize(v.network),
        );
    if (candidates.length === 1) {
      const id = candidates[0].id;
      const assigned = assignments.get(id);
      if (assigned) assigned.push(v);
      else assignments.set(id, [v]);
    } else if (candidates.length > 1) ambiguous.push(v);
    else unmatched.push(v);
  }
  return { assignments, ambiguous, unmatched };
}
