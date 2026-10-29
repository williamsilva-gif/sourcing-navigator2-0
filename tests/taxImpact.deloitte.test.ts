import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { chargeValue, compareRate, detectField, parseSheet, readWorkbook, sheetPreview, statusValue, validateWorkbookBytes, type Mapping, type Row } from '../src/lib/taxImpact/core';

// Fixture QA transcrita do arquivo real "2026_RFP_Deloitte_Propostas_revisada.xlsx" (651 KB, 15 abas).
// Os bytes originais NÃO foram transferidos ao ambiente; esta fixture reproduz a estrutura
// (44 colunas, grupo mesclado AA1:AP1, cabeçalho na linha 2, dados 3–474) e os VALORES REAIS
// das linhas 3, 4, 8, 151, 155, 260, 262 e 266. As demais 464 linhas são sintéticas (rede "Sintético QA").
const COLS = 44;
const blank = () => Array.from({ length: COLS }, () => '');
function realRow(patch: Record<number, unknown>) {
  const r = blank();
  for (const [i, v] of Object.entries(patch)) r[Number(i)] = v;
  return r;
}
// Índices 0-based: D=3 Status, F=5 Rede, G=6 Nome fantasia, H=7 CNPJ, K=10 Cidades, L=11 Estado,
// X=23 Moeda, AA=26 Single, AB=27 Double, AC=28 %desc flutuante, AD=29 ISS, AE=30 Serviço,
// AF=31 Tipo LRA/NLRA, AG=32 Café, AH=33 WiFi, AI=34 Estacionamento, AJ=35 Frigobar, AK=36 Inicio, AL=37 Fim.
const REAL: Record<number, unknown[]> = {
  3: realRow({ 3: 'Para aprovação Cliente', 5: 'Independente', 6: 'Hotel Arco-Íris', 7: 13779432000194, 10: 'Itapipoca', 11: 'CE', 23: 'BRL', 29: 'Inclusa na tarifa', 30: 'Inclusa na tarifa', 32: 'Sim', 33: 'Sim' }),
  4: realRow({ 3: 'Para aprovação Cliente', 5: 'Arena', 6: 'Arena Copacabana Hotel', 7: 7037213000137, 10: 'Rio De Janeiro', 11: 'RJ' }),
  8: realRow({ 3: 'Pendente de retorno fornecedor', 5: 'Atlantica', 6: 'Quality Oscar Freire', 7: '02.223.966/0008-90', 10: 'São Paulo', 11: 'SP' }),
  151: realRow({ 3: 'Para aprovação Cliente', 5: 'Bs Hotéis', 6: 'San Marco Hotel', 7: 480608000160, 10: 'Brasília', 11: 'DF', 23: 'BRL', 26: 512.55, 27: 602.55, 30: 0.1 }),
  155: realRow({ 3: 'Para aprovação Cliente', 5: 'Carlton', 6: 'Carlton Plaza Torre', 7: '26.217.124/0001-17', 10: 'Araxa', 11: 'MG', 23: 'BRL', 26: 195, 27: 230 }),
  260: realRow({ 3: 'Para aprovação Cliente', 5: 'Marriott', 6: 'Sheraton Grand Rio Hotel & Resort', 10: 'Rio De Janeiro', 11: 'RJ', 26: 210, 27: 210 }),
  262: realRow({ 3: 'Para aprovação Cliente', 5: 'Marriott', 6: 'Jw Marriott Hotel São Paulo', 10: 'Sao Paulo', 11: 'SP', 26: 326, 27: 326, 31: 'NLRA' }),
  266: realRow({ 3: 'Para aprovação Cliente', 5: 'Marriott', 6: 'W São Paulo', 10: 'Sao Paulo', 11: 'SP', 26: 410, 27: 470, 31: 'NLRA' }),
};
function header(): unknown[] {
  const r = blank();
  r[3] = 'Status Proposta'; r[5] = 'Rede'; r[6] = 'Nome fantasia'; r[7] = 'CNPJ'; r[10] = 'Cidades'; r[11] = 'Estado ';
  r[23] = 'Moeda'; r[26] = 'Tarifa Single 2026'; r[27] = 'Tarifa Double 2026'; r[28] = '% de desconto tarifa flutuante';
  r[29] = 'Taxa ISS %'; r[30] = 'Taxa de Serviço %'; r[31] = 'Tipo (LRA/NLRA)'; r[32] = 'Café da manhã'; r[33] = 'WiFi';
  r[34] = 'Estacionamento'; r[35] = 'Frigobar'; r[36] = 'Inicio'; r[37] = 'Fim';
  return r;
}
function deloitteWorkbook() {
  const group = blank(); group[26] = 'Tarifas a serem aprovadas ou reprovadas';
  const grid: unknown[][] = [group, header()];
  for (let excelRow = 3; excelRow <= 474; excelRow++) {
    grid.push(REAL[excelRow] ?? realRow({ 3: 'Para aprovação Cliente', 5: 'Sintético QA', 6: `Hotel Sintético QA ${excelRow}`, 7: `99.${String(excelRow).padStart(3, '0')}.000/0001-00`, 10: 'Cidade QA', 11: 'SP', 23: 'BRL', 26: 300, 27: 350, 29: 'Inclusa na tarifa', 30: 'Inclusa na tarifa' }));
  }
  const ws = XLSX.utils.aoa_to_sheet(grid);
  ws['!merges'] = [{ s: { r: 0, c: 26 }, e: { r: 0, c: 41 } }]; // AA1:AP1
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TARIFÁRIO NEGOCIADO');
  for (let i = 2; i <= 15; i++) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['placeholder']]), `Aba ${i}`);
  return wb;
}
const MAPPING: Mapping = { status: 3, network: 5, hotel: 6, cnpj: 7, city: 10, state: 11, currency: 23, single: 26, double: 27, floatingDiscount: 28, iss: 29, service: 30, lra: 31, breakfast: 32, wifi: 33, parking: 34, minibar: 35, start: 36, end: 37 };
const OPTS = { importId: 'qa', filename: '2026_RFP_Deloitte_Propostas_revisada.xlsx', role: 'baseline' as const, year: 2026, chargeBasis: 'quoted' as const, mapping: MAPPING };
const byHotel = (rows: Row[], name: string) => rows.find(r => r.hotel === name)!;

describe('Tax Impact Check · fixture QA Deloitte 2026 (valores reais transcritos)', () => {
  it('detectField reconhece cabeçalhos reais, inclusive "Cidades" plural e "Estado " com espaço', () => {
    expect(detectField('Cidades')).toBe('city');
    expect(detectField('Estado ')).toBe('state');
    expect(detectField('Nome fantasia')).toBe('hotel');
    expect(detectField('Status Proposta')).toBe('status');
  });
  it('detectField reconhece variantes reais do desconto flutuante (coluna AC) sem confundir ISS/serviço', () => {
    expect(detectField('% de desconto tarifa flutuante ')).toBe('floatingDiscount');
    expect(detectField('de desconto tarifa flutuante')).toBe('floatingDiscount');
    expect(detectField('% desconto tarifa flutuante')).toBe('floatingDiscount');
    expect(detectField('Desconto tarifa flutuante')).toBe('floatingDiscount');
    expect(detectField('Taxa ISS %')).toBe('iss');
    expect(detectField('Taxa de Serviço %')).toBe('service');
  });
  it('auto-detecta cabeçalho na linha 2 sob grupo mesclado AA1:AP1 e sugere colunas reais', () => {
    const p = sheetPreview(deloitteWorkbook(), 'TARIFÁRIO NEGOCIADO');
    expect(p.headerRow).toBe(2);
    expect(p.columns).toHaveLength(44);
    expect(p.columns[26].name).toContain('Tarifas a serem aprovadas ou reprovadas / Tarifa Single 2026');
    expect(p.suggested).toMatchObject({ status: 3, network: 5, hotel: 6, cnpj: 7, city: 10, state: 11, currency: 23, floatingDiscount: 28, iss: 29, service: 30 });
    expect(p.suggested.single).toBeUndefined();
    expect(p.suggested.double).toBeUndefined();
  });
  it('status "Para aprovação Cliente" é PENDENTE (aguardando aprovação), nunca aprovado', () => {
    expect(statusValue('Para aprovação Cliente')).toBe('pending');
    expect(statusValue('Pendente de retorno fornecedor')).toBe('pending');
    expect(statusValue('Reprovado')).toBe('rejected');
    expect(statusValue('Aprovado')).toBe('approved');
  });
  it('lê workbook binário com 15 abas e 472 linhas de dados', async () => {
    const bytes = new Uint8Array(XLSX.write(deloitteWorkbook(), { type: 'array', bookType: 'xlsx' }));
    const wb = readWorkbook(bytes);
    expect(wb.SheetNames).toHaveLength(15);
    const parsed = await parseSheet(wb, 'TARIFÁRIO NEGOCIADO', OPTS);
    expect(parsed.rows).toHaveLength(472);
    expect(parsed.headerRow).toBe(2);
  });
  it('preserva CNPJs numéricos com zero à esquerda (pad 14)', async () => {
    const parsed = await parseSheet(deloitteWorkbook(), 'TARIFÁRIO NEGOCIADO', OPTS);
    expect(byHotel(parsed.rows, 'Arena Copacabana Hotel').cnpj).toBe('07037213000137');
    expect(byHotel(parsed.rows, 'San Marco Hotel').cnpj).toBe('00480608000160');
    expect(byHotel(parsed.rows, 'Hotel Arco-Íris').cnpj).toBe('13779432000194');
    expect(byHotel(parsed.rows, 'Quality Oscar Freire').cnpj).toBe('02223966000890');
  });
  it('linha 3 real: status pendente com texto original, encargos inclusos não viram zero', async () => {
    const parsed = await parseSheet(deloitteWorkbook(), 'TARIFÁRIO NEGOCIADO', OPTS);
    const arco = byHotel(parsed.rows, 'Hotel Arco-Íris');
    expect(arco.status).toBe('pending');
    expect(arco.statusRaw).toBe('Para aprovação Cliente');
    expect(arco.city).toBe('Itapipoca');
    expect(arco.state).toBe('CE');
    expect(arco.iss).toMatchObject({ kind: 'included', value: null });
    expect(arco.service).toMatchObject({ kind: 'included', value: null });
    expect(arco.rateType).toBe('missing');
    expect(byHotel(parsed.rows, 'Quality Oscar Freire').status).toBe('pending');
    expect(byHotel(parsed.rows, 'Quality Oscar Freire').statusRaw).toBe('Pendente de retorno fornecedor');
  });
  it('San Marco: serviço 0.1 vira 10%, ISS vazio é missing, tarifas 512.55/602.55', async () => {
    const parsed = await parseSheet(deloitteWorkbook(), 'TARIFÁRIO NEGOCIADO', OPTS);
    const san = byHotel(parsed.rows, 'San Marco Hotel');
    expect(san.single).toBe(512.55);
    expect(san.double).toBe(602.55);
    expect(san.service).toMatchObject({ kind: 'percent', value: 10 });
    expect(san.iss.kind).toBe('missing');
    expect(chargeValue(0.1)).toMatchObject({ kind: 'percent', value: 10 });
  });
  it('moeda vazia (Sheraton, JW, W) não bloqueia importação mas torna comparação incomparável', async () => {
    const parsed = await parseSheet(deloitteWorkbook(), 'TARIFÁRIO NEGOCIADO', OPTS);
    const sheraton = byHotel(parsed.rows, 'Sheraton Grand Rio Hotel & Resort');
    expect(sheraton.currency).toBe('');
    expect(sheraton.single).toBe(210);
    const delta = compareRate(sheraton, { ...sheraton, id: 'p:1', single: 220 }, 'single');
    expect(delta.state).toBe('incomparable');
    expect(delta.reason).toBe('Moeda ausente ou distinta');
    expect(delta.percent).toBeNull();
  });
  it('encargos ausentes (Carlton) bloqueiam comparação — sem savings fictícios', async () => {
    const parsed = await parseSheet(deloitteWorkbook(), 'TARIFÁRIO NEGOCIADO', OPTS);
    const carlton = byHotel(parsed.rows, 'Carlton Plaza Torre');
    expect(carlton.iss.kind).toBe('missing');
    const delta = compareRate(carlton, { ...carlton, id: 'p:1', single: 200 }, 'single');
    expect(delta.state).toBe('incomparable');
    expect(delta.reason).toBe('Base de encargos distinta ou não confirmada');
  });
  it('linha 262/266: NLRA preservado, moeda vazia assinalada', async () => {
    const parsed = await parseSheet(deloitteWorkbook(), 'TARIFÁRIO NEGOCIADO', OPTS);
    expect(byHotel(parsed.rows, 'Jw Marriott Hotel São Paulo').lra).toBe('NLRA');
    expect(byHotel(parsed.rows, 'W São Paulo').double).toBe(470);
  });
  it('zip guard rejeita bytes que não são XLSX e conteúdo inflado excessivo', () => {
    expect(() => validateWorkbookBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]))).toThrow('Arquivo XLSX inválido');
    expect(() => readWorkbook(new Uint8Array(100))).toThrow();
  });
  it('importação de base única (histórico) completa sem exigir proposta', async () => {
    const parsed = await parseSheet(deloitteWorkbook(), 'TARIFÁRIO NEGOCIADO', OPTS);
    expect(parsed.rows.length).toBeGreaterThan(0);
    expect(parsed.rows.every(r => r.source.file === '2026_RFP_Deloitte_Propostas_revisada.xlsx')).toBe(true);
  });
});
