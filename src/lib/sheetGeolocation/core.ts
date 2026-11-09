import * as XLSX from "xlsx";
import {
  norm,
  stateCode,
  originalNumber,
  validateGeocode,
  validatePlace,
  type Entity,
  type Geo,
  type GoogleResult,
  type GooglePlace,
  type Kind,
} from "../proximity/core";
import { street } from "../proximity/catalog";
import { queryAddress } from "./selection";

export const fields = {
  name: "Nome (opcional para escritórios/lojas)",
  code: "Código (opcional)",
  address: "Logradouro / endereço completo",
  number: "Número",
  district: "Bairro",
  city: "Cidade",
  cep: "CEP",
  complement: "Complemento",
  uf: "UF / estado",
};
export type Mapping = Partial<Record<keyof typeof fields, number>>;
export type Row = {
  localizationVersion?: 2;
  index: number;
  entity: Entity;
  district: string;
  complement: string;
  status: "pending" | "high" | "review" | "error";
  precision?: string;
  geo?: Geo;
  notes: string[];
  attempts: number;
  nextRetry?: number;
  history: { at: string; status: string; notes: string[] }[];
};
export const extraHeaders = [
  "Latitude",
  "Longitude",
  "Status geocodificação",
  "Precisão/confiança",
  "Endereço Google",
  "Place ID",
  "Divergências/observações",
  "Origem/proveniência",
];
export function readWorkbook(bytes: Uint8Array) {
  if (bytes.length > 10 * 1024 * 1024) throw new Error("Limite 10 MB.");
  // CSV input remains text (including leading zeros); XLSX retains original cell values/formats/formulas.
  return XLSX.read(bytes, {
    type: "array",
    raw: true,
    cellText: true,
    cellNF: true,
    cellStyles: true,
  });
}
export function suggest(headers: string[]): Mapping {
  const aliases = {
    name: ["nome", "hotel", "nomefantasia"],
    code: ["codigo", "cod"],
    address: ["endereco", "enderecocompleto", "enderecooriginal", "logradouro", "rua"],
    number: ["numero", "num", "n"],
    district: ["bairro"],
    city: ["cidade", "municipio"],
    cep: ["ceporiginal", "cep", "cephotel", "cepimovel", "cepusadonalocalizacao"],
    complement: ["complemento"],
    uf: ["uf", "estado", "ufestado"],
  };
  return Object.fromEntries(
    Object.entries(aliases).flatMap(([key, list]) => {
      const i = list.map(alias => headers.findIndex(h => norm(h) === alias)).find(index => index >= 0) ?? -1;
      return i < 0 ? [] : [[key, i]];
    }),
  );
}
export function parseSheet(
  book: XLSX.WorkBook,
  sheet: string,
  header: number,
  mapping: Mapping,
  kind: Kind,
  filename: string,
): Row[] {
  const ws = book.Sheets[sheet];
  if (!ws?.["!ref"]) throw new Error("Aba vazia ou inexistente.");
  const range = XLSX.utils.decode_range(ws["!ref"]);
  if (header < 1 || header > range.e.r + 1) throw new Error("Cabeçalho inválido.");
  if (range.e.c > 300 || range.e.r + 1 - header > 2000)
    throw new Error("Limite: 2.000 linhas e 301 colunas por aba.");
  if ([mapping.address, mapping.city, mapping.uf].some((v) => v === undefined))
    throw new Error("Mapeie logradouro, cidade e UF.");
  const rows: Row[] = [];
  for (let index = header; index <= range.e.r; index++) {
    const value = (key: keyof Mapping) => {
      const c = mapping[key];
      if (c === undefined) return "";
      const cell = ws[XLSX.utils.encode_cell({ r: index, c })];
      return cell ? XLSX.utils.format_cell(cell).trim() : "";
    };
    const entity: Entity = {
      id: `row-${index}`,
      kind,
      name: value("name"),
      code: value("code"),
      address: value("address"),
      number: value("number"),
      city: value("city"),
      uf: value("uf"),
      cep: value("cep"),
      document: "",
      rn: null,
      block: false,
      active: true,
      eligible: true,
      original: {},
      source: { filename, sheet, row: index + 1 },
      issues: [],
    };
    const notes: string[] = [];
    if (!entity.address || !entity.city || !/^[a-z]{2}$/.test(stateCode(entity.uf)))
      notes.push("Logradouro/cidade/UF incompleto: revisão necessária");
    if (!originalNumber(entity)) notes.push("Número original ausente; não será inventado");
    if (kind === "hotel" && !entity.cep.trim())
      notes.push("CEP original vazio: será conferido por identidade e endereço no Google Places");
    else if (!/^\d{8}$/.test(entity.cep.replace(/\D/g, "")))
      notes.push("CEP ausente/inválido: revisão necessária");
    rows.push({
      localizationVersion: 2,
      index,
      entity,
      district: value("district"),
      complement: value("complement"),
      status: "pending",
      notes,
      attempts: 0,
      history: [],
    });
  }
  return rows;
}
export function query(row: Row) {
  const address = row.localizationVersion === 2 ? queryAddress(row) : { street: row.entity.address, number: row.entity.number };
  return [
    address.street,
    address.number,
    row.district,
    row.complement,
    row.entity.city,
    stateCode(row.entity.uf).toUpperCase(),
    row.entity.cep,
    "Brasil",
  ]
    .filter(Boolean)
    .join(", ");
}
export function cacheKey(row: Row) {
  return [row.entity.kind, norm(row.entity.name), norm(query(row))].join("|");
}
export function transientFailure(message: string) {
  return /429|HTTP 5\d\d|timeout|timed out|fetch failed|network|transiente|UNKNOWN_ERROR/i.test(
    message,
  );
}
export class SheetJobFatal extends Error {}
export function fatalFailure(message: string) {
  return /REQUEST_DENIED|OVER_QUERY_LIMIT|OVER_DAILY_LIMIT|HTTP 40[13]|\(403\)|Google 403|API_KEY|credencial|limite de consultas|lease|persistência|processamento pausado/i.test(
    message,
  );
}
export function completedJob(job: { status: string; checkpoint: number; rows: unknown }) {
  const rows = job.rows as Row[];
  return (
    job.status === "paused" &&
    Array.isArray(rows) &&
    rows.length > 0 &&
    job.checkpoint === rows.length &&
    counts(rows).pending === 0
  );
}
export function retryAt(message: string, attempts: number, now: number) {
  return transientFailure(message) && attempts < 3
    ? now + Math.min(60000, 2 ** attempts * 1000)
    : undefined;
}
export function validate(row: Row, result: GoogleResult) {
  const geo = validateGeocode(row.entity, result);
  const route = result.address_components?.find((c) => c.types.includes("route"))?.long_name;
  if (route && street(row.entity.address).includes(street(route)))
    geo.reasons = geo.reasons.filter((r) => r !== "Logradouro incoerente");
  if (result.geometry.location_type !== "ROOFTOP")
    geo.reasons.push("Ponto não ROOFTOP: revisão necessária");
  if (!result.place_id) geo.reasons.push("Place ID ausente");
  geo.reasons = [...new Set(geo.reasons)];
  geo.confidence = geo.reasons.length ? "review" : "high";
  return geo;
}
// Sheet-only exception: never relax legacy radius or unnamed-unit validation.
export function validateSheetPlace(entity: Entity, place: GooglePlace, unique = false): Geo {
  const geo = validatePlace(entity, place, !unique);
  if (entity.kind !== "hotel") return geo;
  const validPostal = (value: string) => /^(?:\d{8}|\d{5}-\d{3})$/.test(value.trim());
  const originalPostal = entity.cep.trim();
  const derivedPostal = geo.derivedPostalCode ?? "";
  if (!validPostal(derivedPostal)) geo.reasons.push("CEP Google ausente/inválido");
  if (originalPostal && !validPostal(originalPostal)) geo.reasons.push("CEP original malformado");
  if (
    !originalPostal &&
    unique &&
    validPostal(derivedPostal) &&
    originalNumber(entity) &&
    geo.reasons.every((reason) => reason === "CEP incoerente/ausente")
  ) {
    geo.reasons = [];
  }
  geo.reasons = [...new Set(geo.reasons)];
  geo.confidence = geo.reasons.length ? "review" : "high";
  if (geo.confidence === "high") geo.confirmation = "establishment";
  else delete geo.confirmation;
  return geo;
}
export function counts(rows: Row[]) {
  return {
    total: rows.length,
    high: rows.filter((r) => r.status === "high").length,
    review: rows.filter((r) => r.status === "review").length,
    error: rows.filter((r) => r.status === "error").length,
    pending: rows.filter((r) => r.status === "pending").length,
  };
}
export function resultCells(row?: Row) {
  return row
    ? [
        row.geo?.lat ?? "",
        row.geo?.lng ?? "",
        row.status,
        `${row.precision ?? ""} / ${row.geo?.confidence ?? "pendente"}`,
        row.geo?.formatted ?? "",
        row.geo?.placeId ?? "",
        row.notes.join("; "),
        row.geo ? `${row.geo.source} · ${row.geo.checkedAt}` : "Sem consulta Google",
      ]
    : Array(8).fill("");
}
export function enrich(book: XLSX.WorkBook, sheet: string, header: number, rows: Row[]) {
  const ws = book.Sheets[sheet];
  if (!ws?.["!ref"]) throw new Error("Aba inexistente.");
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const col = range.e.c + 1;
  const originalHeaders = Array.from({ length: col }, (_, c) => String(ws[XLSX.utils.encode_cell({ r: header - 1, c })]?.v ?? ""));
  const coordinateCols = ["latitude", "longitude"].map(name => originalHeaders.findIndex(h => norm(h) === name));
  const headers = extraHeaders.map((h, i) => i < 2 && coordinateCols[i] >= 0 ? `${h} Google` : h);
  XLSX.utils.sheet_add_aoa(ws, [headers], { origin: { r: header - 1, c: col } });
  for (const row of rows) {
    if (row.localizationVersion !== 2 || !row.geo) continue;
    [row.geo.lat, row.geo.lng].forEach((value, i) => {
      if (coordinateCols[i] < 0 || !Number.isFinite(value)) return;
      const address = XLSX.utils.encode_cell({ r: row.index, c: coordinateCols[i] });
      const cell = ws[address];
      if (!cell?.f && (cell?.v === undefined || cell.v === null || cell.v === "")) XLSX.utils.sheet_add_aoa(ws, [[value]], { origin: address });
    });
  }
  for (const row of rows)
    XLSX.utils.sheet_add_aoa(ws, [resultCells(row)], { origin: { r: row.index, c: col } });
  return book;
}
