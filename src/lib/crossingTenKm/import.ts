import * as XLSX from "xlsx";
import { readWorkbook } from "../sheetGeolocation/core";
import { coords, key, type Point } from "./core";
export const importFields = {
  code: "Código / CNPJ", name: "Nome", city: "Cidade", uf: "UF", address: "Endereço / logradouro",
  number: "Número", lat: "Latitude", lng: "Longitude", precision: "Precisão / tipo de localização",
  source: "Fonte", url: "Fonte URL", notes: "Observações", status: "Status",
};
export type ImportMapping = Partial<Record<keyof typeof importFields, number>>;
export const loadImport = readWorkbook;
export function importHeaders(book: XLSX.WorkBook, sheet: string, header: number) {
  const ws = book.Sheets[sheet];
  if (!ws?.["!ref"]) return [];
  const range = XLSX.utils.decode_range(ws["!ref"]);
  return Array.from({length: range.e.c + 1}, (_, c) => XLSX.utils.format_cell(ws[XLSX.utils.encode_cell({r:header-1,c})] ?? {t:"s",v:""}));
}
export function suggestImport(headers: string[]): ImportMapping {
  const aliases: Record<keyof typeof importFields, string[]> = {
    code:["codigo","codigoesc","cnpj","cod","code"], name:["nome","hotel","nomefantasia"], city:["cidade","municipio"], uf:["uf","estado"], address:["endereco","logradouro","enderecocompleto"], number:["numero","num"], lat:["latitude","lat"], lng:["longitude","lng","long"], precision:["precisao","tipodelocalizacao","precisaoconfianca"], source:["fonte","origemproveniencia"], url:["fonteurl","url"], notes:["observacoes","observacao","notas"], status:["status","statusgeocodificacao"],
  };
  const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  return Object.fromEntries(Object.entries(aliases).flatMap(([k,a])=>{const c=headers.findIndex(h=>a.includes(normalize(h)));return c<0?[]:[[k,c]];}));
}
export function parseImport(book:XLSX.WorkBook, sheet:string, header:number, mapping:ImportMapping, kind:Point["kind"], filename:string) {
  const ws=book.Sheets[sheet];
  if(!ws?.["!ref"]) throw new Error("Aba vazia.");
  const range=XLSX.utils.decode_range(ws["!ref"]);
  if(!Number.isInteger(header)||header<1||header>range.e.r+1) throw new Error("Cabeçalho inválido.");
  if(range.e.r-header+1>2000||range.e.c>300) throw new Error("Limite de 2.000 linhas e 301 colunas.");
  if(["code","city","uf","lat","lng"].some(k=>mapping[k as keyof ImportMapping]===undefined)) throw new Error("Mapeie Código/CNPJ, Cidade, UF, Latitude e Longitude.");
  const rows:Point[]=[];
  for(let r=header;r<=range.e.r;r++) {
    const value=(k:keyof ImportMapping)=>{const c=mapping[k];return c===undefined?"":XLSX.utils.format_cell(ws[XLSX.utils.encode_cell({r,c})] ?? {t:"s",v:""}).trim();};
    if(!Array.from({length:range.e.c+1},(_,c)=>ws[XLSX.utils.encode_cell({r,c})]?.v).some(v=>v!==undefined&&v!==null&&v!==""))continue;
    rows.push({id:`${kind}-upload-${r}`,kind,code:value("code"),name:value("name"),city:value("city"),uf:value("uf"),address:value("address"),number:value("number"),lat:value("lat"),lng:value("lng"),precision:value("precision")||"Não informada",status:value("status")||"Importado",source:`${filename} · aba ${sheet}, linha ${r+1}${value("source")?` · ${value("source")}`:""}`,url:value("url"),notes:value("notes")});
  }
  const counts=new Map<string,number>();
  rows.forEach(p=>counts.set(key(p.code,kind),(counts.get(key(p.code,kind))??0)+1));
  const duplicates=[...counts].filter(([k,n])=>!!k&&n>1).map(([k])=>k);
  const missingCodes=rows.filter(p=>!p.code).length;
  const invalid=rows.filter(p=>!coords(p)).length;
  return {points:rows,duplicates,missingCodes,invalid,count:rows.length,expected:kind==="office"?631:393,countValid:kind!=="office"||rows.length===631,canConfirm:rows.length>0&&missingCodes===0&&duplicates.length===0&&(kind!=="office"||rows.length===631)};
}