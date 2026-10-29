import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { Plus, ArrowLeft, FileSpreadsheet, GitCompareArrows, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveClientId } from '@/lib/appConfigStore';
import { compareTaxAnalysisFn, createTaxAnalysisFn, getTaxAnalysisFn, listTaxAnalysesFn, listTaxTenantsFn, taxOriginalUrlFn } from '@/lib/taxImpact.functions';
import type { Comparison, Row } from '@/lib/taxImpact/core';
import { ImportPanel } from './ImportPanel';
import { ResultsPanel } from './ResultsPanel';

export function TaxImpactPage() {
  const active = useActiveClientId();
  const listTenants = useServerFn(listTaxTenantsFn); const list = useServerFn(listTaxAnalysesFn); const create = useServerFn(createTaxAnalysisFn);
  const tenants = useQuery({ queryKey: ['tax-impact-tenants'], queryFn: () => listTenants(), retry: false });
  const [tenantId, setTenantId] = useState(''); const [analysisId, setAnalysisId] = useState(''); const [name, setName] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!tenantId && tenants.data?.some(t => t.id === active)) setTenantId(active); }, [active, tenants.data, tenantId]);
  const analyses = useQuery({ queryKey: ['tax-impact-analyses', tenantId], queryFn: () => list({ data: { tenantId } }), enabled: !!tenantId, retry: false });
  async function add() {
    if (!name.trim() || !tenantId) return; setBusy(true); setError('');
    try { const item = await create({ data: { tenantId, name } }); setAnalysisId(item.id); setName(''); await analyses.refetch(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Falha ao criar análise.'); } finally { setBusy(false); }
  }
  return <div className="overflow-x-clip"><AppShell><div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><FileSpreadsheet className="h-6 w-6 text-primary" />Tax Impact Check</h1><p className="mt-1 text-sm text-muted-foreground">Fase 1 · Programa anterior e propostas de hospedagem corporativa</p></div><label className="min-w-64 text-xs text-muted-foreground">Cliente / empresa<select aria-label="Cliente Tax Impact Check" className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={tenantId} onChange={e => { setTenantId(e.target.value); setAnalysisId(''); setError(''); }}><option value="">Selecionar cliente</option>{tenants.data?.map(t => <option key={t.id} value={t.id}>{t.name} · {t.type}</option>)}</select></label></header>
    {(tenants.error || analyses.error || error) && <p role="alert" className="rounded-md border border-destructive bg-destructive-soft p-3 text-sm text-destructive">{error || tenants.error?.message || analyses.error?.message}</p>}
    {tenants.isPending && <p className="text-sm text-muted-foreground">Verificando acesso…</p>}
    {!tenantId && !tenants.error && <p className="border-t border-border py-10 text-center text-sm text-muted-foreground">Selecione um cliente autorizado para acessar suas análises.</p>}
    {tenantId && !analysisId && !analyses.error && <>
      <form className="flex flex-wrap gap-3 border-y border-border py-5" onSubmit={e => { e.preventDefault(); void add(); }}><input className="h-10 min-w-64 flex-1 rounded-md border border-input bg-background px-3 text-sm" required maxLength={200} aria-label="Nome da análise" placeholder="Nome da análise" value={name} onChange={e => setName(e.target.value)} /><Button type="submit" disabled={busy}><Plus className="mr-2 h-4 w-4" />Criar análise</Button></form>
      <div className="divide-y divide-border">{analyses.data?.map(a => <div key={a.id} className="flex items-center justify-between gap-4 py-4"><div><h2 className="font-medium">{a.name}</h2><p className="text-xs text-muted-foreground">Criada em {new Date(a.created_at).toLocaleString('pt-BR')} · {a.id}</p></div><Button variant="outline" onClick={() => setAnalysisId(a.id)}>Abrir análise</Button></div>)}</div>
      {!analyses.isPending && analyses.data?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma análise salva para este cliente.</p>}
    </>}
    {analysisId && tenantId && <AnalysisDetail key={`${tenantId}/${analysisId}`} tenantId={tenantId} analysisId={analysisId} onBack={() => { setAnalysisId(''); void analyses.refetch(); }} />}
  </div></AppShell></div>;
}
function AnalysisDetail({ tenantId, analysisId, onBack }: { tenantId: string; analysisId: string; onBack: () => void }) {
  const get = useServerFn(getTaxAnalysisFn); const compare = useServerFn(compareTaxAnalysisFn); const original = useServerFn(taxOriginalUrlFn);
  const query = useQuery({ queryKey: ['tax-impact-analysis', tenantId, analysisId], queryFn: () => get({ data: { tenantId, analysisId } }), retry: false });
  const [baselineId, setBaselineId] = useState(''); const [proposalId, setProposalId] = useState(''); const [revisionId, setRevisionId] = useState(''); const [manual, setManual] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [warning, setWarning] = useState('');
  const data = query.data;
  useEffect(() => {
    if (!data) return;
    if (!baselineId) setBaselineId(data.imports.find(i => i.role === 'baseline')?.id ?? '');
    if (!proposalId) setProposalId(data.imports.find(i => i.role === 'proposal')?.id ?? '');
    if (initialized) return;
    if (!revisionId && data.revisions[0]) { setRevisionId(data.revisions[0].id); setBaselineId(data.revisions[0].baseline_import_id); setProposalId(data.revisions[0].proposal_import_id); setManual(data.revisions[0].manual_matches as Record<string, string>); }
    setInitialized(true);
  }, [data, baselineId, proposalId, revisionId, initialized]);
  const revision = data?.revisions.find(r => r.id === revisionId);
  const baseline = data?.imports.find(i => i.id === (revision?.baseline_import_id ?? baselineId));
  const proposal = data?.imports.find(i => i.id === (revision?.proposal_import_id ?? proposalId));
  async function run() {
    setBusy(true); setError('');
    try { const r = await compare({ data: { tenantId, analysisId, baselineId, proposalId, manualMatches: manual } }); setWarning((r as { warning?: string }).warning ?? ''); setRevisionId(r.id); await query.refetch(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Comparação não foi concluída.'); } finally { setBusy(false); }
  }
  async function openOriginal(importId: string) {
    setError('');
    try { const url = await original({ data: { tenantId, analysisId, importId } }); window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Original indisponível.'); }
  }
  if (query.isPending) return <p>Carregando análise…</p>;
  if (!data) return <p role="alert" className="text-destructive">{query.error?.message ?? 'Análise não encontrada.'}</p>;
  return <div className="space-y-5">
    <Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Análises</Button>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{data.analysis.name}</h2><p className="text-sm text-muted-foreground">{revision ? `Versão ${revision.version} · ${revision.status === 'needs_review' ? 'Revisão necessária' : 'Comparada'} · ${new Date(revision.created_at).toLocaleString('pt-BR')}` : 'Rascunho · aguardando importações'}</p></div>
    <ol className="flex flex-wrap gap-4 text-xs text-muted-foreground"><li>1. Upload e aba</li><li>2. Mapeamento e confirmação</li><li>3. Preview validado</li><li>4. Comparação e revisão</li></ol>
    <div className="grid gap-8 xl:grid-cols-2"><ImportPanel tenantId={tenantId} analysisId={analysisId} role="baseline" profiles={data.profiles} onSaved={() => void query.refetch()} /><ImportPanel tenantId={tenantId} analysisId={analysisId} role="proposal" profiles={data.profiles} onSaved={() => void query.refetch()} /></div>
    <section className="space-y-3 border-t border-border pt-5"><h3 className="font-semibold">Importações e originais privados</h3><div className="divide-y divide-border">{data.imports.map(i => <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><div>{i.role === 'baseline' ? 'Baseline' : 'Proposta'} {i.period_year} · {i.filename} · {i.sheet}<p className="text-xs text-muted-foreground">{Array.isArray(i.rows) ? i.rows.length : 0} linhas · {Array.isArray(i.errors) ? i.errors.length : 0} ocorrências · {new Date(i.created_at).toLocaleString('pt-BR')}</p><details className="text-xs"><summary className="cursor-pointer text-primary">Erros por linha / hash</summary><p className="break-all">{i.file_hash}</p>{Array.isArray(i.errors) && i.errors.map((e, n) => <p key={n}>{JSON.stringify(e)}</p>)}</details></div><Button size="sm" variant="outline" onClick={() => void openOriginal(i.id)}><Download className="mr-2 h-4 w-4" />Original</Button></div>)}</div>{!data.imports.length && <p className="text-sm text-muted-foreground">Nenhum arquivo importado.</p>}</section>
    <div className="flex flex-wrap gap-3"><label className="min-w-60 flex-1 text-xs">Baseline<select aria-label="Importação baseline" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={baselineId} onChange={e => { setBaselineId(e.target.value); setManual({}); setRevisionId(''); }}><option value="">Selecionar baseline</option>{data.imports.filter(i => i.role === 'baseline').map(i => <option key={i.id} value={i.id}>{i.period_year} · {i.filename} · {i.created_at}</option>)}</select></label><label className="min-w-60 flex-1 text-xs">Proposta<select aria-label="Importação proposta" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={proposalId} onChange={e => { setProposalId(e.target.value); setManual({}); setRevisionId(''); }}><option value="">Selecionar proposta</option>{data.imports.filter(i => i.role === 'proposal').map(i => <option key={i.id} value={i.id}>{i.period_year} · {i.filename} · {i.created_at}</option>)}</select></label><Button className="self-end" disabled={!baselineId || !proposalId || busy} onClick={() => void run()}><GitCompareArrows className="mr-2 h-4 w-4" />{busy ? 'Comparando…' : 'Executar comparação'}</Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {warning && <p role="status" className="rounded-md border border-warning bg-warning-soft p-3 text-sm text-warning-foreground">{warning}</p>}
    {(!baselineId || !proposalId) && !revision && <p className="text-xs text-muted-foreground">Uma única base fica salva e pode ser reaberta sem comparação. Para comparar, selecione uma importação baseline e uma proposta; bases do mesmo ano rodam apenas como smoke test, com aviso, e nunca como comparativo anual.</p>}
    {data.revisions.length > 0 && <label className="block max-w-lg text-sm">Histórico de versões<select aria-label="Versão da comparação" className="ml-3 h-9 rounded-md border border-input bg-background px-3 text-sm" value={revisionId} onChange={e => { const r = data.revisions.find(r => r.id === e.target.value); if (!r) return; setRevisionId(r.id); setBaselineId(r.baseline_import_id); setProposalId(r.proposal_import_id); setManual(r.manual_matches as Record<string, string>); }}><option value="">Selecionar versão</option>{data.revisions.map(r => <option key={r.id} value={r.id}>v{r.version} · {new Date(r.created_at).toLocaleString('pt-BR')}</option>)}</select></label>}
    {revision && baseline && proposal && <ResultsPanel key={revision.id} tenantId={tenantId} analysisId={analysisId} analysisName={data.analysis.name} results={revision.results as unknown as Comparison[]} baselineRows={baseline.rows as unknown as Row[]} baselineYear={baseline.period_year} proposalYear={proposal.period_year} manual={manual} onManual={setManual} onCompare={() => void run()} busy={busy} />}
    {!revision && <p className="text-xs text-muted-foreground">Salve uma comparação para acessar a simulação por diária e os relatórios.</p>}
  </div>;
}
