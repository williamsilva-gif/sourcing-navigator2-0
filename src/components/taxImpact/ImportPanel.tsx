import { useState } from 'react';
import type * as XLSX from 'xlsx';
import { useServerFn } from '@tanstack/react-start';
import { Upload, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { commitTaxImportFn } from '@/lib/taxImpact.functions';
import { fields, MAX_FILE_BYTES, parseSheet, readWorkbook, sheetPreview, type Field, type Mapping, type Role, type Row, type SheetPreview } from '@/lib/taxImpact/core';
import type { Json } from '@/integrations/supabase/types';

type Profile = { id: string; name: string; role: string; mapping: Json };
const inputClass = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground';
export function ImportPanel({ tenantId, analysisId, role, profiles, onSaved }: { tenantId: string; analysisId: string; role: Role; profiles: Profile[]; onSaved: () => void }) {
  const commit = useServerFn(commitTaxImportFn);
  const [file, setFile] = useState<File | null>(null);
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [year, setYear] = useState(role === 'baseline' ? 2026 : 2027);
  const [basis, setBasis] = useState<Row['chargeBasis']>('quoted');
  const [confirmed, setConfirmed] = useState(false);
  const [parsed, setParsed] = useState<Awaited<ReturnType<typeof parseSheet>> | null>(null);
  const [profileName, setProfileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [importId, setImportId] = useState('');
  function invalidate() { setParsed(null); setConfirmed(false); }
  async function loadFile(next: File | undefined) {
    setError(''); setParsed(null); setConfirmed(false); setFile(null); setWb(null); setPreview(null);
    if (!next) return;
    try {
      if (!/\.xlsx$/i.test(next.name) || next.size > MAX_FILE_BYTES) throw new Error('Selecione um XLSX de até 10 MB.');
      const book = readWorkbook(new Uint8Array(await next.arrayBuffer()));
      const view = sheetPreview(book, book.SheetNames[0]);
      setWb(book); setPreview(view); setMapping(view.suggested); setFile(next); setImportId(crypto.randomUUID());
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao ler arquivo.'); }
  }
  function chooseSheet(name: string, header?: number) {
    if (!wb) return;
    try { const p = sheetPreview(wb, name, header); setPreview(p); setMapping(p.suggested); invalidate(); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Cabeçalho inválido.'); }
  }
  async function validate() {
    if (!wb || !preview || !file) return;
    setBusy(true); setError('');
    try { setParsed(await parseSheet(wb, preview.name, { importId, filename: file.name, role, year, chargeBasis: basis, mapping, headerRow: preview.headerRow })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Falha ao validar.'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!file || !preview || !parsed || !confirmed) return;
    setBusy(true); setError('');
    const path = `${tenantId}/${analysisId}/${importId}.xlsx`;
    let uploaded = false;
    try {
      const result = await supabase.storage.from('tax-impact-originals').upload(path, file, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', upsert: false });
      if (result.error) throw new Error('Não foi possível armazenar o original privado.');
      uploaded = true;
      const outcome = await commit({ data: { tenantId, analysisId, importId, filename: file.name, sheet: preview.name, role, year, headerRow: preview.headerRow, mapping, chargeBasis: basis, confirmed: true, profileName: profileName || undefined } });
      if (outcome.warning) setError(outcome.warning);
      setFile(null); setWb(null); setPreview(null); setParsed(null); setConfirmed(false); onSaved();
    } catch (e) {
      if (uploaded) await supabase.storage.from('tax-impact-originals').remove([path]);
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally { setBusy(false); }
  }
  function useProfile(id: string) {
    const p = profiles.find(p => p.id === id); if (!p || !preview) return;
    const value = p.mapping as { columnsByName?: Partial<Record<Field, string>>; chargeBasis?: Row['chargeBasis'] };
    const next: Mapping = {};
    for (const [field, name] of Object.entries(value.columnsByName ?? {})) {
      const cols = preview.columns.filter(c => c.name === name);
      if (cols.length === 1) next[field as Field] = cols[0].index;
    }
    setMapping(next); if (value.chargeBasis) setBasis(value.chargeBasis); invalidate();
  }
  return <section className="min-w-0 space-y-4 border-t border-border pt-5">
    <h3 className="flex items-center gap-2 text-base font-semibold"><Upload className="h-4 w-4 text-primary" />{role === 'baseline' ? 'Programa anterior · baseline' : 'Programa novo · proposta'}</h3>
    <label className="block space-y-1 text-sm"><span>Arquivo XLSX</span><input aria-label={`Arquivo ${role}`} disabled={busy} type="file" accept=".xlsx" onChange={e => void loadFile(e.target.files?.[0])} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-2 file:text-secondary-foreground" /></label>
    {preview && wb && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Aba<select aria-label={`Aba ${role}`} className={inputClass} value={preview.name} onChange={e => chooseSheet(e.target.value)}>{wb.SheetNames.map(n => <option key={n}>{n}</option>)}</select></label>
        <label className="space-y-1 text-sm">Linha de cabeçalho<input aria-label={`Cabeçalho ${role}`} className={inputClass} type="number" min={1} max={50} value={preview.headerRow} onChange={e => chooseSheet(preview.name, Number(e.target.value))} /></label>
        <label className="space-y-1 text-sm">Ano confirmado<input aria-label={`Ano ${role}`} className={inputClass} type="number" min={2000} max={2200} value={year} onChange={e => { setYear(Number(e.target.value)); invalidate(); }} /></label>
        <label className="space-y-1 text-sm">Base das tarifas<select aria-label={`Base encargos ${role}`} className={inputClass} value={basis} onChange={e => { setBasis(e.target.value as Row['chargeBasis']); invalidate(); }}><option value="quoted">Valores cotados — encargos mapeados</option><option value="net">Líquida, sem encargos</option><option value="inclusive">Total inclusivo</option></select></label>
      </div>
      {profiles.some(p => p.role === role) && <label className="block space-y-1 text-sm">Perfil opcional<select className={inputClass} defaultValue="" onChange={e => useProfile(e.target.value)}><option value="">Selecionar perfil salvo</option>{profiles.filter(p => p.role === role).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {(Object.entries(fields) as [Field, string][]).map(([field, label]) => <label key={field} className="min-w-0 space-y-1 text-xs">{label}<select aria-label={`${label} ${role}`} className={inputClass} value={mapping[field] ?? ''} onChange={e => { const next = { ...mapping }; if (e.target.value === '') delete next[field]; else next[field] = Number(e.target.value); setMapping(next); invalidate(); }}><option value="">{field === 'single' || field === 'double' ? 'Confirmar coluna ou deixar ausente' : 'Não mapeado'}</option>{preview.columns.filter(c => c.leaf).map(c => <option value={c.index} key={c.index}>{c.index + 1}. {c.name}</option>)}</select></label>)}
      </div>
      <div className="max-h-44 overflow-auto border border-border"><table className="w-full text-xs"><thead className="bg-muted"><tr>{preview.columns.filter(c => c.leaf).map(c => <th className="min-w-32 border-r border-border p-2 text-left" key={c.index}>{c.name}</th>)}</tr></thead><tbody>{preview.grid.slice(preview.headerRow, preview.headerRow + 4).map((r, i) => <tr key={i}>{preview.columns.filter(c => c.leaf).map(c => <td key={c.index} className="border-t border-border p-2">{String(r[c.index] ?? '')}</td>)}</tr>)}</tbody></table></div>
      <Button variant="outline" disabled={busy} onClick={() => void validate()}><Check className="mr-2 h-4 w-4" />Validar preview</Button>
    </>}
    {parsed && <div className="space-y-3">
      <p className="text-sm font-medium">{parsed.rows.length} linhas válidas · {parsed.errors.length} ocorrências</p>
      <div className="max-h-56 overflow-auto border border-border"><table className="w-full text-xs"><thead className="bg-muted"><tr>{['Linha', 'Hotel', 'CNPJ', 'Single', 'Double', 'Moeda', 'ISS', 'Serviço'].map(s => <th key={s} className="p-2 text-left">{s}</th>)}</tr></thead><tbody>{parsed.rows.slice(0, 10).map(r => <tr key={r.id} className="border-t border-border"><td className="p-2">{r.source.row}</td><td className="p-2">{r.hotel}</td><td className="p-2">{r.cnpj}</td><td className="p-2">{r.single ?? '—'}</td><td className="p-2">{r.double ?? '—'}</td><td className="p-2">{r.currency || 'ausente'}</td><td className="p-2">{r.iss.raw || 'ausente'}</td><td className="p-2">{r.service.raw || 'ausente'}</td></tr>)}</tbody></table></div>
      {parsed.errors.length > 0 && <ul className="max-h-36 overflow-auto text-xs text-warning-foreground">{parsed.errors.map((e, i) => <li key={i}>Linha {e.row} · {e.field}: {e.message}</li>)}</ul>}
      <label className="flex items-start gap-2 text-sm"><Checkbox aria-label={`Confirmar ${role}`} checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} /><span>Confirmo o papel {role === 'baseline' ? 'baseline' : 'proposta'}, o ano {year}, as tarifas Single/Double selecionadas e as linhas válidas do preview.</span></label>
      <label className="block space-y-1 text-sm">Salvar perfil reutilizável (opcional)<input className={inputClass} maxLength={200} placeholder="Nome do perfil" value={profileName} onChange={e => setProfileName(e.target.value)} /></label>
      <Button disabled={busy || !confirmed || !parsed.rows.length} onClick={() => void save()}><Download className="mr-2 h-4 w-4" />{busy ? 'Salvando…' : 'Salvar importação'}</Button>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
