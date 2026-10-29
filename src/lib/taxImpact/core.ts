import * as XLSX from 'xlsx';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 10000;
export const fields = {
  network: 'Rede', hotel: 'Hotel / Nome fantasia', cnpj: 'CNPJ', city: 'Cidade', state: 'Estado', currency: 'Moeda',
  single: 'Tarifa Single confirmada', double: 'Tarifa Double confirmada', status: 'Status Renegociação / Proposta',
  floatingDiscount: '% desconto tarifa flutuante', iss: 'Taxa ISS %', service: 'Taxa de Serviço %', lra: 'LRA / NLRA',
  breakfast: 'Café da manhã', wifi: 'WiFi', parking: 'Estacionamento', minibar: 'Frigobar', start: 'Início', end: 'Fim',
} as const;
export type Field = keyof typeof fields;
export type Mapping = Partial<Record<Field, number>>;
export type Role = 'baseline' | 'proposal';
export type Charge = { kind: 'missing' | 'included' | 'not_applicable' | 'percent' | 'unknown'; value: number | null; raw: string };
export type Row = {
  id: string; hash: string; network: string; hotel: string; cnpj: string; city: string; state: string; currency: string;
  single: number | null; double: number | null; floatingDiscount: Charge; iss: Charge; service: Charge;
  lra: string; breakfast: string; wifi: string; parking: string; minibar: string; start: string; end: string;
  status: 'renegotiated' | 'pending' | 'approved' | 'rejected' | 'absent'; statusRaw: string; rateType: 'fixed' | 'floating' | 'missing';
  chargeBasis: 'quoted' | 'net' | 'inclusive'; source: { file: string; sheet: string; row: number; columns: Partial<Record<Field, string>> };
};
export type SheetPreview = { name: string; headerRow: number; columns: { index: number; name: string; leaf: string }[]; suggested: Mapping; grid: unknown[][] };
export type RowError = { row: number; field: string; message: string };
export const clean = (v: unknown) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 2000);
export const normalize = (v: unknown) => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const aliases: Record<Field, string[]> = {
  network: ['rede', 'bandeira', 'brand', 'network'], hotel: ['hotel', 'nome fantasia', 'nome do hotel', 'hotel name'],
  cnpj: ['cnpj', 'cnpj hotel'], city: ['cidade', 'cidades', 'municipio', 'municipios', 'city'], state: ['estado', 'uf', 'state'], currency: ['moeda', 'currency'],
  single: ['tarifa single', 'single rate', 'tarifa single renegociada'], double: ['tarifa double', 'double rate', 'tarifa double renegociada'],
  status: ['status renegociacao', 'status proposta', 'status da proposta', 'status'], floatingDiscount: ['desconto tarifa flutuante', 'desconto flutuante', 'desconto bar'],
  iss: ['taxa iss', 'iss'], service: ['taxa de servico', 'taxa servico', 'service charge'], lra: ['tipo lra nlra', 'lra nlra', 'tipo lra', 'lra'],
  breakfast: ['cafe da manha', 'breakfast'], wifi: ['wifi', 'wi fi', 'internet'], parking: ['estacionamento', 'parking'],
  minibar: ['frigobar', 'minibar'], start: ['inicio', 'data inicio', 'valid from'], end: ['fim', 'data fim', 'valid to'],
};
export function detectField(header: unknown): Field | undefined {
  const text = normalize(header).replace(/\b20\d{2}\b/g, '').trim();
  return (Object.keys(aliases) as Field[]).find(f => aliases[f].some(a => text === a || text.startsWith(a + ' ')));
}
export function numberValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let t = clean(value);
  if (!t || /sem produ[cç][aã]o|inclus|n\/a/i.test(t)) return null;
  t = t.replace(/(?:R\$|US\$|BRL|USD|EUR|€|\$|%|\s)/gi, '');
  if (/^\(.*\)$/.test(t)) t = '-' + t.slice(1, -1);
  if (t.includes(',') && t.includes('.')) {
    t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (t.includes(',')) t = t.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t); return Number.isFinite(n) ? n : null;
}
export function chargeValue(v: unknown): Charge {
  const raw = clean(v); const n = normalize(raw);
  if (!raw) return { kind: 'missing', value: null, raw };
  if (/inclus/.test(n)) return { kind: 'included', value: null, raw };
  if (/nao se aplica|isento|n a/.test(n)) return { kind: 'not_applicable', value: null, raw };
  const num = numberValue(v);
  if (num === null || num < 0 || num > 100) return { kind: 'unknown', value: null, raw };
  return { kind: 'percent', value: raw.includes('%') ? num : num > 0 && num < 1 ? num * 100 : num, raw };
}
export function statusValue(v: unknown): Row['status'] {
  const n = normalize(v);
  if (!n) return 'absent';
  if (/reprov|rejeit|reject|nao aprovad/.test(n)) return 'rejected';
  // "Para aprovação Cliente" é proposta AGUARDANDO aprovação, não tarifa contratada.
  if (/para aprovacao|aguardando|pendente|em analise|awaiting/.test(n)) return 'pending';
  if (/aprov|aceit|approved/.test(n)) return 'approved';
  if (/renegociad/.test(n)) return 'renegotiated';
  return 'pending';
}
function dateValue(v: unknown): string {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : '';
  }
  const t = clean(v); const br = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
}
function benefit(v: unknown) {
  const n = normalize(v); if (!n) return '';
  if (/^nao$|nao inclus|a parte|pago|cobrad/.test(n)) return 'no';
  if (/^sim$|inclus|gratis|gratuito/.test(n)) return 'yes';
  return clean(v);
}
export async function sha256(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const owned = new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  const digest = await crypto.subtle.digest('SHA-256', owned);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}
// Bound inflated ZIP data before handing it to XLSX (zip-bomb protection).
export function validateWorkbookBytes(bytes: Uint8Array) {
  if (bytes.length < 22 || bytes.length > MAX_FILE_BYTES || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Arquivo XLSX inválido ou acima de 10 MB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('Estrutura XLSX inválida.');
  const count = view.getUint16(end + 10, true); let pos = view.getUint32(end + 16, true); let inflated = 0;
  if (count > 2000 || count === 0xffff) throw new Error('Planilha excede o limite de estrutura.');
  for (let i = 0; i < count; i++) {
    if (pos + 46 > bytes.length || view.getUint32(pos, true) !== 0x02014b50) throw new Error('Estrutura XLSX inválida.');
    inflated += view.getUint32(pos + 24, true);
    if (inflated > 50 * 1024 * 1024) throw new Error('Conteúdo expandido excede 50 MB.');
    pos += 46 + view.getUint16(pos + 28, true) + view.getUint16(pos + 30, true) + view.getUint16(pos + 32, true);
  }
}
export function readWorkbook(bytes: Uint8Array) {
  validateWorkbookBytes(bytes);
  const wb = XLSX.read(bytes, { type: 'array', cellDates: false, cellFormula: false, sheetRows: MAX_ROWS + 52 });
  if (wb.SheetNames.length > 50) throw new Error('Máximo de 50 abas por arquivo.');
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name]; const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1');
    if (range.e.r >= MAX_ROWS + 50 || range.e.c >= 200) throw new Error('Máximo de 10.000 linhas de dados e 200 colunas por aba.');
  }
  return wb;
}
export function sheetPreview(wb: XLSX.WorkBook, name: string, override?: number): SheetPreview {
  const sheet = wb.Sheets[name]; if (!sheet) throw new Error('Aba não encontrada.');
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', range: 0 });
  let header = 0; let best = -1;
  if (override !== undefined) header = override - 1;
  else grid.slice(0, 50).forEach((row, index) => {
    const matched = new Set(row.map(detectField).filter(Boolean));
    const score = matched.size + (matched.has('hotel') ? 3 : 0) + (matched.has('single') ? 2 : 0);
    if (score > best) { best = score; header = index; }
  });
  if (header < 0 || header >= grid.length) throw new Error('Linha de cabeçalho inválida.');
  const columns = Array.from({ length: range.e.c + 1 }, (_, index) => {
    const leaf = clean(grid[header]?.[index]); let group = '';
    if (header > 0) {
      const merge = sheet['!merges']?.find(m => m.s.r === header - 1 && m.e.r === header - 1 && m.s.c <= index && m.e.c >= index);
      if (merge) group = clean(grid[header - 1]?.[merge.s.c]);
    }
    return { index, leaf, name: [group, leaf || XLSX.utils.encode_col(index)].filter(Boolean).join(' / ') };
  });
  const suggested: Mapping = {};
  for (const field of Object.keys(fields) as Field[]) {
    // Rates ALWAYS need an explicit choice, regardless of the printed year.
    if (field === 'single' || field === 'double') continue;
    const candidates = columns.filter(c => detectField(c.leaf) === field);
    if (candidates.length === 1) suggested[field] = candidates[0].index;
  }
  return { name, headerRow: header + 1, columns, suggested, grid };
}
export type ImportOptions = { importId: string; filename: string; role: Role; year: number; chargeBasis: Row['chargeBasis']; mapping: Mapping; headerRow?: number };
export async function parseSheet(wb: XLSX.WorkBook, sheet: string, options: ImportOptions) {
  const preview = sheetPreview(wb, sheet, options.headerRow); const { mapping } = options;
  if (mapping.hotel === undefined) throw new Error('Mapeie Hotel / Nome fantasia.');
  if (mapping.single === undefined && mapping.double === undefined && mapping.floatingDiscount === undefined) throw new Error('Confirme ao menos uma tarifa ou desconto flutuante.');
  const used = Object.values(mapping);
  if (new Set(used).size !== used.length || used.some(c => !Number.isInteger(c) || c < 0 || c >= preview.columns.length)) throw new Error('Uma coluna não pode representar dois campos; revise o mapeamento.');
  const rows: Row[] = []; const errors: RowError[] = [];
  const sourceColumns = Object.fromEntries(Object.entries(mapping).map(([f, col]) => [f, preview.columns[col]?.name ?? '']));
  for (let i = preview.headerRow; i < preview.grid.length; i++) {
    const raw = preview.grid[i]; if (!raw.some(v => clean(v))) continue;
    const get = (field: Field) => mapping[field] === undefined ? '' : raw[mapping[field]];
    const hotel = clean(get('hotel'));
    if (!hotel) { errors.push({ row: i + 1, field: 'hotel', message: 'Hotel ausente; linha excluída.' }); continue; }
    let invalid = false;
    for (const field of ['single', 'double'] as const) {
      const value = get(field); const n = numberValue(value);
      if (clean(value) && !/sem produ[cç][aã]o/i.test(clean(value)) && (n === null || n < 0)) { errors.push({ row: i + 1, field, message: 'Tarifa inválida; linha excluída.' }); invalid = true; }
    }
    if (invalid) continue;
    let cnpj = clean(get('cnpj')).replace(/\D/g, '');
    if (cnpj) {
      // XLSX formatted text carries identifier leading zeroes; numeric IDs are padded to 14 digits.
      const col = mapping.cnpj; const cell = col === undefined ? undefined : wb.Sheets[sheet][XLSX.utils.encode_cell({ r: i, c: col })];
      if (cell?.w && /\d/.test(cell.w)) cnpj = cell.w.replace(/\D/g, '');
      cnpj = cnpj.padStart(14, '0');
      if (cnpj.length !== 14) { errors.push({ row: i + 1, field: 'cnpj', message: 'CNPJ deve conter 14 dígitos; linha excluída.' }); continue; }
    }
    const single = numberValue(get('single')); const double = numberValue(get('double'));
    const floatingDiscount = chargeValue(get('floatingDiscount')); const iss = chargeValue(get('iss')); const service = chargeValue(get('service'));
    for (const [f, charge] of [['iss', iss], ['service', service], ['floatingDiscount', floatingDiscount]] as const) if (charge.kind === 'unknown') errors.push({ row: i + 1, field: f, message: 'Valor não reconhecido; comparabilidade restrita.' });
    const start = dateValue(get('start')); const end = dateValue(get('end'));
    for (const [f, val] of [['start', start], ['end', end]] as const) if (clean(get(f)) && !val) errors.push({ row: i + 1, field: f, message: 'Data não reconhecida.' });
    const row: Row = {
      id: `${options.importId}:${i + 1}`, hash: '', hotel, cnpj, network: clean(get('network')), city: clean(get('city')), state: clean(get('state')).toUpperCase(),
      currency: clean(get('currency')).toUpperCase().replace(/^R\$$/, 'BRL').replace(/^US\$$/, 'USD'), single, double,
      floatingDiscount, iss, service, lra: normalize(get('lra')).includes('nlra') ? 'NLRA' : normalize(get('lra')).includes('lra') ? 'LRA' : clean(get('lra')),
      breakfast: benefit(get('breakfast')), wifi: benefit(get('wifi')), parking: benefit(get('parking')), minibar: benefit(get('minibar')),
      start, end, status: statusValue(get('status')), statusRaw: clean(get('status')), rateType: single !== null || double !== null ? 'fixed' : floatingDiscount.kind === 'percent' ? 'floating' : 'missing',
      chargeBasis: options.chargeBasis, source: { file: clean(options.filename), sheet, row: i + 1, columns: sourceColumns },
    };
    row.hash = await sha256(new TextEncoder().encode(JSON.stringify({ ...row, id: undefined, hash: undefined })));
    rows.push(row);
  }
  if (rows.length > MAX_ROWS) throw new Error('Máximo de 10.000 linhas por importação.');
  return { rows, errors, headerRow: preview.headerRow };
}
export type Delta = { state: 'comparable' | 'missing' | 'incomparable'; before: number | null; after: number | null; absolute: number | null; percent: number | null; reason: string };
export type Comparison = { id: string; match: 'matched' | 'manual' | 'new' | 'removed' | 'ambiguous'; baseline: Row | null; proposal: Row | null; candidates: string[]; single: Delta; double: Delta; changes: string[]; status: Row['status'] };
const chargeKey = (c: Charge) => `${c.kind}:${c.value}`;
export function compareRate(b: Row | null, p: Row | null, occupancy: 'single' | 'double'): Delta {
  const before = b?.[occupancy] ?? null; const after = p?.[occupancy] ?? null;
  const empty = { before, after, absolute: null, percent: null };
  if (before === null || after === null) return { ...empty, state: 'missing', reason: 'Tarifa ausente nesta ocupação' };
  if (before <= 0) return { ...empty, state: 'incomparable', reason: 'Base deve ser maior que zero' };
  if (!b || !p || !b.currency || b.currency !== p.currency) return { ...empty, state: 'incomparable', reason: 'Moeda ausente ou distinta' };
  if (b.rateType !== 'fixed' || p.rateType !== 'fixed') return { ...empty, state: 'incomparable', reason: 'Desconto flutuante não é tarifa fixa' };
  if (b.chargeBasis !== p.chargeBasis || ['iss', 'service'].some(f => {
    const bc = b[f as 'iss' | 'service']; const pc = p[f as 'iss' | 'service'];
    return ['missing', 'unknown'].includes(bc.kind) || ['missing', 'unknown'].includes(pc.kind) || chargeKey(bc) !== chargeKey(pc);
  })) return { ...empty, state: 'incomparable', reason: 'Base de encargos distinta ou não confirmada' };
  return { before, after, state: 'comparable', absolute: after - before, percent: (after - before) / before * 100, reason: '' };
}
export function comparePrograms(baseline: Row[], proposal: Row[], manual: Record<string, string> = {}): Comparison[] {
  const baseIds = new Set(baseline.map(b => b.id)); const proposalIds = new Set(proposal.map(p => p.id));
  if (Object.entries(manual).some(([p, b]) => !proposalIds.has(p) || !baseIds.has(b)) || new Set(Object.values(manual)).size !== Object.values(manual).length) throw new Error('Correspondências manuais inválidas ou repetidas.');
  const candidateMap = new Map<string, Row[]>();
  for (const p of proposal) {
    let candidates: Row[] = [];
    if (p.cnpj) {
      const cnpj = baseline.filter(b => b.cnpj === p.cnpj);
      const units = cnpj.filter(b => normalize(b.hotel) === normalize(p.hotel) && normalize(b.city) === normalize(p.city) && normalize(b.state) === normalize(p.state));
      candidates = units.length ? units : cnpj;
    }
    if (!candidates.length && p.hotel && p.city && p.state) candidates = baseline.filter(b => normalize(b.hotel) === normalize(p.hotel) && normalize(b.city) === normalize(p.city) && normalize(b.state) === normalize(p.state) && normalize(b.network) === normalize(p.network));
    candidateMap.set(p.id, candidates);
  }
  const used = new Set<string>(); const uncertain = new Set<string>();
  const results: Comparison[] = [];
  const make = (b: Row | null, p: Row | null, match: Comparison['match'], candidates: string[] = []): Comparison => {
    const changes: string[] = [];
    if (b && p) {
      for (const f of ['lra', 'breakfast', 'wifi', 'parking', 'minibar', 'start', 'end'] as const) if (b[f] !== p[f]) changes.push(`${fields[f]}: ${b[f] || 'ausente'} → ${p[f] || 'ausente'}${(b[f] === 'yes' && p[f] !== 'yes') || (b[f] === 'LRA' && p[f] === 'NLRA') ? ' · perda de benefício' : ''}`);
      for (const f of ['iss', 'service', 'floatingDiscount'] as const) if (chargeKey(b[f]) !== chargeKey(p[f])) changes.push(`${fields[f]}: ${b[f].raw || 'ausente'} → ${p[f].raw || 'ausente'}`);
    }
    return { id: `${b?.id ?? '-'}|${p?.id ?? '-'}`, match, baseline: b, proposal: p, candidates, single: compareRate(b, p, 'single'), double: compareRate(b, p, 'double'), changes, status: p?.status ?? 'absent' };
  };
  const manuallyReserved = new Set(Object.values(manual));
  for (const p of proposal) {
    const explicit = manual[p.id]; const candidates = candidateMap.get(p.id) ?? [];
    const b = explicit ? baseline.find(b => b.id === explicit) : candidates.length === 1 ? candidates[0] : undefined;
    const reverseCount = b ? proposal.filter(other => !manual[other.id] && candidateMap.get(other.id)?.some(c => c.id === b.id)).length : 0;
    const unitConfirmed = b && normalize(b.hotel) === normalize(p.hotel) && !!p.city && !!p.state && normalize(b.city) === normalize(p.city) && normalize(b.state) === normalize(p.state);
    if (b && (explicit || (unitConfirmed && !manuallyReserved.has(b.id) && reverseCount === 1)) && !used.has(b.id)) { used.add(b.id); results.push(make(b, p, explicit ? 'manual' : 'matched')); }
    else if (candidates.length || b) { candidates.forEach(c => uncertain.add(c.id)); results.push(make(null, p, 'ambiguous', candidates.map(c => c.id))); }
    else results.push(make(null, p, 'new'));
  }
  for (const b of baseline) if (!used.has(b.id)) results.push(make(b, null, uncertain.has(b.id) ? 'ambiguous' : 'removed'));
  return results;
}
export function indicators(results: Comparison[]) {
  const eligible = results.filter(r => ['matched', 'manual'].includes(r.match));
  return { matched: eligible.length, ambiguous: results.filter(r => r.match === 'ambiguous').length, new: results.filter(r => r.match === 'new').length, removed: results.filter(r => r.match === 'removed').length,
    singleComparable: eligible.filter(r => r.single.state === 'comparable').length, doubleComparable: eligible.filter(r => r.double.state === 'comparable').length,
    increases: eligible.filter(r => (r.single.absolute ?? 0) > 0 || (r.double.absolute ?? 0) > 0).length,
    decreases: eligible.filter(r => (r.single.absolute ?? 0) < 0 || (r.double.absolute ?? 0) < 0).length,
  };
}
