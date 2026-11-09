import * as XLSX from "xlsx";
import { readWorkbook } from "../sheetGeolocation/core";
import { type Point, type Result, type Supplement, band } from "./core";
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function parseSupplement(bytes: Uint8Array, filename: string): Supplement[] {
  const book = readWorkbook(bytes),
    ws = book.Sheets[book.SheetNames[0]];
  if (!ws?.["!ref"]) throw new Error("Suplemento vazio.");
  const range = XLSX.utils.decode_range(ws["!ref"]);
  if (range.e.r > 2000 || range.e.c > 300)
    throw new Error("Suplemento excede 2.000 linhas ou 301 colunas.");
  const cell = (r: number, c: number) =>
    c < 0
      ? ""
      : XLSX.utils.format_cell(ws[XLSX.utils.encode_cell({ r, c })] ?? { t: "s", v: "" }).trim();
  const headers = Array.from({ length: range.e.c + 1 }, (_, c) => norm(cell(0, c)));
  const find = (aliases: string[]) => headers.findIndex((h) => aliases.includes(h));
  const code = find(["codigo", "code", "cnpj", "codigoesc", "codigodoescritorio", "esc"]);
  const lat = find(["latitude", "lat"]),
    lng = find(["longitude", "lng", "long"]);
  if (code < 0 || lat < 0 || lng < 0)
    throw new Error("São necessárias colunas Código/CNPJ, Latitude e Longitude na primeira linha.");
  const precision = find(["tipodelocalizacao", "precisao", "precisaoconfianca", "tipo"]),
    url = find(["fonteurl", "url", "fonte"]),
    notes = find(["observacoes", "observacao", "notas"]);
  return Array.from({ length: range.e.r }, (_, i) => ({
    code: cell(i + 1, code),
    lat: cell(i + 1, lat),
    lng: cell(i + 1, lng),
    precision: cell(i + 1, precision),
    url: cell(i + 1, url),
    notes: cell(i + 1, notes),
    source: filename,
  })).filter((r) => r.code || r.lat || r.lng);
}
function entity(p: Point, prefix: string) {
  return Object.fromEntries(
    Object.entries({
      Nome: p.name,
      Código: p.code,
      Endereço: p.address,
      Número: p.number,
      Cidade: p.city,
      UF: p.uf,
      Latitude: p.lat ?? "",
      Longitude: p.lng ?? "",
      Status: p.status,
      Precisão: p.precision,
      Fonte: p.source,
      URL: p.url,
      Observações: p.notes,
    }).map(([k, v]) => [`${prefix} ${k}`, v]),
  );
}
export function exportWorkbook(r: Result) {
  const book = XLSX.utils.book_new();
  const add = (name: string, rows: Record<string, unknown>[], headers: string[]) =>
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(rows.length ? rows : [], {
        header: rows.length ? undefined : headers,
      }),
      name,
    );
  add(
    "Pares ate 10km",
    r.pairs.map((p) => ({
      ...entity(p.office, "Escritório"),
      ...entity(p.hotel, "Hotel"),
      "Hotel CNPJ": p.hotel.code,
      "Distância reta km": p.km,
      Faixa: p.band,
      Conclusão: "INDICATIVA — não viária",
    })),
    ["Escritório Código", "Hotel CNPJ", "Distância reta km"],
  );
  add(
    "Escritorios resumo",
    r.officeSummary.map((o) => ({
      ...entity(o.office, "Escritório"),
      "Hotéis até 10 km": o.count,
    })),
    ["Escritório Código", "Hotéis até 10 km"],
  );
  add(
    "Hoteis resumo",
    r.hotelSummary.map((h) => ({
      ...entity(h.hotel, "Hotel"),
      "Hotel CNPJ": h.hotel.code,
      "Escritórios até 10 km": h.count,
      "Escritório mais próximo global": h.nearest?.code ?? "",
      ...(h.nearest ? entity(h.nearest, "Mais próximo") : {}),
      "Distância reta km": h.km ?? "",
      Faixa: h.km === null ? "Sem coordenadas aptas" : band(h.km),
    })),
    ["Hotel CNPJ", "Escritórios até 10 km", "Escritório mais próximo global"],
  );
  add(
    "Auditoria",
    [
      {
        Regra:
          "Haversine em coordenadas WGS84; raio terrestre médio 6371,0088 km; linha reta, não viária. Comparação <=10 sem arredondar. Sem filtro cidade/UF; review/aproximadas incluídas igualmente. Não garante entrada/edificação nem acesso viário. Sem consultas externas. Suplementos temporários: somente campos ausentes. Coordenadas Brasil: lat -34..6, lng -74..-30; 16/16 rejeitado.",
        Hotéis: r.hotels.length,
        Escritórios: r.offices.length,
        Pares: r.pairs.length,
      },
      ...r.audit.map((a) => ({
        Código: a.code,
        Tipo: a.kind,
        Motivo: a.reason,
        Fonte: a.source,
        Precisão: a.precision,
        URL: a.url,
        Observações: a.notes,
      })),
    ],
    ["Regra"],
  );
  return book;
}
