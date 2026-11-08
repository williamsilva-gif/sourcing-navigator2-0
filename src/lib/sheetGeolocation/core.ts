import * as XLSX from "xlsx";
import {
  norm,
  stateCode,
  originalNumber,
  validateGeocode,
  type Entity,
  type Geo,
  type GoogleResult,
  type Kind,
} from "../proximity/core";
import { street } from "../proximity/catalog";

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
export function suggest(headers: string[]): Mapping {
  const aliases = {
    name: ["nome", "hotel", "nomefantasia"],
    code: ["codigo", "cod"],
    address: ["endereco", "enderecocompleto", "logradouro", "rua"],
    number: ["numero", "num", "n"],
    district: ["bairro"],
    city: ["cidade", "municipio"],
    cep: ["cep", "cephotel", "cepimovel"],
    complement: ["complemento"],
    uf: ["uf", "estado", "ufestado"],
  };
  return Object.fromEntries(
    Object.entries(aliases).flatMap(([key, list]) => {
      const i = headers.findIndex((h) => list.includes(norm(h)));
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
    if (!/^\d{8}$/.test(entity.cep.replace(/\D/g, "")))
      notes.push("CEP ausente/inválido: revisão necessária");
    rows.push({
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
  return [
    row.entity.address,
    row.entity.number,
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
  XLSX.utils.sheet_add_aoa(ws, [extraHeaders], { origin: { r: header - 1, c: col } });
  for (const row of rows)
    XLSX.utils.sheet_add_aoa(ws, [resultCells(row)], { origin: { r: row.index, c: col } });
  return book;
}
