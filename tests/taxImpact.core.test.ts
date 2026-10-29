import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { chargeValue, comparePrograms, compareRate, indicators, numberValue, parseSheet, readWorkbook, sheetPreview, statusValue, type Row } from '../src/lib/taxImpact/core';
const charge = chargeValue('Inclusa na tarifa');
const row = (changes: Partial<Row> = {}): Row => ({ id: 'b:3', hash: 'hash', network: 'Rede', hotel: 'Hotel X', cnpj: '01234567000189', city: 'São Paulo', state: 'SP', currency: 'BRL', single: 400, double: null, floatingDiscount: chargeValue(''), iss: charge, service: charge, lra: 'LRA', breakfast: 'yes', wifi: 'yes', parking: '', minibar: '', start: '', end: '', status: 'approved', rateType: 'fixed', chargeBasis: 'quoted', source: { file: 'b.xlsx', sheet: 'Tarifas', row: 3, columns: {} }, ...changes });
function workbook() {
 const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet([
  Array.from({length:44},(_,i)=>i===26?'Tarifas a serem aprovadas ou reprovadas':''),
  ['Hotel', 'CNPJ', 'Cidade', 'Estado', ...Array(22).fill(''), 'Tarifa Single 2026', 'Tarifa Single Renegociada 2026', 'Tarifa Double Renegociada 2026', 'Moeda', 'Taxa ISS %', 'Taxa de Serviço %'],
  ['Hotel X', '01234567000189', 'São Paulo', 'SP', ...Array(22).fill(''), 400, 448, '', 'BRL', 'Inclusa na tarifa', 'Inclusa na tarifa'],
 ]); ws['!merges']=[{s:{r:0,c:26},e:{r:0,c:43}}]; XLSX.utils.book_append_sheet(wb,ws,'TARIFÁRIO NEGOCIADO'); return wb;
}
describe('Tax Impact Check deterministic rules',()=>{
 it('detects specific titles on row 2 below AA:AR merged header',()=>{const p=sheetPreview(workbook(),'TARIFÁRIO NEGOCIADO');expect(p.headerRow).toBe(2);expect(p.columns[27].name).toContain('Tarifas a serem aprovadas ou reprovadas / Tarifa Single Renegociada 2026');expect(p.suggested.single).toBeUndefined();});
 it('explicitly maps Renegociada 2026 to the proposal for 2027 without inferring role/year',async()=>{const p=await parseSheet(workbook(),'TARIFÁRIO NEGOCIADO',{importId:'p',filename:'p.xlsx',role:'proposal',year:2027,chargeBasis:'quoted',mapping:{hotel:0,cnpj:1,single:27,double:28,currency:29,iss:30,service:31}});expect(p.rows[0].single).toBe(448);expect(p.rows[0].source.columns.single).toContain('Renegociada 2026');});
 it('preserves leading-zero CNPJ',async()=>{const p=await parseSheet(workbook(),'TARIFÁRIO NEGOCIADO',{importId:'p',filename:'p.xlsx',role:'baseline',year:2026,chargeBasis:'quoted',mapping:{hotel:0,cnpj:1,single:26}});expect(p.rows[0].cnpj).toBe('01234567000189');});
 it('compares 400 to 448 as 48 and 12%',()=>{expect(compareRate(row(),row({single:448}),'single')).toMatchObject({state:'comparable',absolute:48,percent:12});});
 it('keeps missing Double independent from Single',()=>{expect(compareRate(row(),row({single:448}),'double').state).toBe('missing');expect(compareRate(row(),row({single:448}),'single').percent).toBe(12);});
 it('reads BR and US numbers',()=>{expect(numberValue('R$ 1.234,56')).toBe(1234.56);expect(numberValue('US$ 1,234.56')).toBe(1234.56);expect(numberValue('Sem produção')).toBeNull();});
 it('normalizes 5%, 0.05, 5 but never turns included into zero',()=>{for(const v of ['5%',0.05,5])expect(chargeValue(v).value).toBe(5);expect(chargeValue('Inclusa na tarifa')).toMatchObject({kind:'included',value:null});expect(chargeValue('Não se aplica').kind).toBe('not_applicable');expect(chargeValue('0').kind).toBe('percent');});
 it('does not compare distinct currencies',()=>{expect(compareRate(row(),row({currency:'USD',single:448}),'single').state).toBe('incomparable');});
 it('does not calculate taxes or compare changed charge basis',()=>{expect(compareRate(row(),row({iss:chargeValue('5%')}),'single').state).toBe('incomparable');});
 it('separates approved and rejected',()=>{expect(statusValue('Aprovado')).toBe('approved');expect(statusValue('Reprovado')).toBe('rejected');expect(statusValue('Renegociado')).toBe('renegotiated');});
 it('never auto-matches ambiguous CNPJ duplicates or aggregates them',()=>{const r=comparePrograms([row(),row({id:'b:4'})],[row({id:'p:3',single:448})]);expect(r[0].match).toBe('ambiguous');expect(indicators(r).singleComparable).toBe(0);});
 it('rejects multiple proposal rows claiming one unit',()=>{const r=comparePrograms([row()],[row({id:'p:3'}),row({id:'p:4'})]);expect(r.filter(x=>x.match==='matched')).toHaveLength(0);});
 it('requires manual disambiguation when CNPJ matches but hotel unit differs',()=>{expect(comparePrograms([row()],[row({id:'p:3',hotel:'Other unit'})])[0].match).toBe('ambiguous');});
 it('allows reviewed manual matches and rejects duplicate selections',()=>{const b=[row(),row({id:'b:4'})],p=[row({id:'p:3'})];expect(comparePrograms(b,p,{'p:3':'b:4'})[0].match).toBe('manual');expect(()=>comparePrograms(b,[...p,row({id:'p:4'})],{'p:3':'b:4','p:4':'b:4'})).toThrow();});
 it('flags LRA to NLRA and loss of breakfast',()=>{const r=comparePrograms([row()],[row({id:'p:3',lra:'NLRA',breakfast:'no'})]);expect(r[0].changes).toEqual(expect.arrayContaining(['LRA / NLRA: LRA → NLRA · perda de benefício','Café da manhã: yes → no · perda de benefício']));});
 it('never produces annual impact/savings without volumes',()=>{const r=indicators(comparePrograms([row()],[row({id:'p:3',single:448})]));expect(r).not.toHaveProperty('annualImpact');expect(r).not.toHaveProperty('savings');});
 it('uses fallback name, city, state and network; labels new and removed',()=>{const r=comparePrograms([row({cnpj:''})],[row({id:'p:3',cnpj:''}),row({id:'p:4',hotel:'Other',cnpj:''})]);expect(r.map(x=>x.match)).toEqual(['matched','new']);expect(comparePrograms([row()],[])[0].match).toBe('removed');});
 it('reads real XLSX binary and Excel dates',async()=>{const wb=workbook();wb.Sheets['TARIFÁRIO NEGOCIADO']['AH2']={t:'s',v:'Inicio'};wb.Sheets['TARIFÁRIO NEGOCIADO']['AH3']={t:'n',v:46023};const bytes=new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'}));const parsed=await parseSheet(readWorkbook(bytes),'TARIFÁRIO NEGOCIADO',{importId:'i',filename:'i.xlsx',role:'baseline',year:2026,chargeBasis:'quoted',mapping:{hotel:0,single:26,start:33}});expect(parsed.rows[0].start).toMatch(/^2026-\d{2}-\d{2}$/);});
});
