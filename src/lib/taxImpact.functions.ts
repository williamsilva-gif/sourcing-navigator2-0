import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { comparePrograms, fields, parseSheet, readWorkbook, sha256, type Mapping, type Row, type Role } from './taxImpact/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';

const scope = z.object({ tenantId: z.string().uuid() });
const analysisScope = scope.extend({ analysisId: z.string().uuid() });
const mappingSchema = z.record(z.enum(Object.keys(fields) as [keyof typeof fields, ...(keyof typeof fields)[]]), z.number().int().min(0).max(199));
async function authorize(client: SupabaseClient<Database>, tenantId: string) {
  const { data, error } = await client.rpc('tax_impact_access', { _tenant_id: tenantId });
  if (error || !data) throw new Error('Acesso restrito a TA autorizado para este cliente.');
}
const json = (v: unknown): Json => JSON.parse(JSON.stringify(v));
export const listTaxTenantsFn = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: ta, error: roleError } = await context.supabase.rpc('is_ta_master', { _user_id: context.userId });
  if (roleError || !ta) throw new Error('Acesso restrito a TA master/staff.');
  const { data, error } = await context.supabase.from('tenants').select('id,name,type').order('name');
  if (error) throw new Error('Não foi possível listar clientes.');
  return data ?? [];
});
export const listTaxAnalysesFn = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => scope.parse(d)).handler(async ({ data, context }) => {
  await authorize(context.supabase, data.tenantId);
  const { data: analyses, error } = await context.supabase.from('tax_impact_analyses').select('*').eq('client_tenant_id', data.tenantId).order('created_at', { ascending: false });
  if (error) throw new Error('Não foi possível carregar análises.');
  return analyses ?? [];
});
export const createTaxAnalysisFn = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => scope.extend({ name: z.string().trim().min(1).max(200) }).parse(d)).handler(async ({ data, context }) => {
  await authorize(context.supabase, data.tenantId);
  const { data: analysis, error } = await context.supabase.from('tax_impact_analyses').insert({ client_tenant_id: data.tenantId, name: data.name, created_by: context.userId }).select().single();
  if (error) throw new Error('Não foi possível criar análise.');
  return analysis;
});
export const getTaxAnalysisFn = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => analysisScope.parse(d)).handler(async ({ data, context }) => {
  await authorize(context.supabase, data.tenantId);
  const { data: analysis, error } = await context.supabase.from('tax_impact_analyses').select('*').eq('id', data.analysisId).eq('client_tenant_id', data.tenantId).single();
  if (error || !analysis) throw new Error('Análise não encontrada neste cliente.');
  const [imports, revisions, profiles] = await Promise.all([
    context.supabase.from('tax_impact_imports').select('*').eq('analysis_id', data.analysisId).eq('client_tenant_id', data.tenantId).order('created_at', { ascending: false }),
    context.supabase.from('tax_impact_revisions').select('*').eq('analysis_id', data.analysisId).eq('client_tenant_id', data.tenantId).order('version', { ascending: false }),
    context.supabase.from('tax_impact_mapping_profiles').select('*').eq('client_tenant_id', data.tenantId).order('created_at', { ascending: false }),
  ]);
  if (imports.error || revisions.error || profiles.error) throw new Error('Falha ao carregar histórico.');
  return { analysis, imports: imports.data ?? [], revisions: revisions.data ?? [], profiles: profiles.data ?? [] };
});
const importSchema = analysisScope.extend({ importId: z.string().uuid(), filename: z.string().min(1).max(250).regex(/\.xlsx$/i), sheet: z.string().min(1).max(100), role: z.enum(['baseline', 'proposal']), year: z.number().int().min(2000).max(2200), headerRow: z.number().int().min(1).max(50), mapping: mappingSchema, chargeBasis: z.enum(['quoted', 'net', 'inclusive']), confirmed: z.literal(true), profileName: z.string().trim().max(200).optional() });
export const commitTaxImportFn = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => importSchema.parse(d)).handler(async ({ data, context }) => {
  await authorize(context.supabase, data.tenantId);
  const { data: analysis } = await context.supabase.from('tax_impact_analyses').select('id').eq('id', data.analysisId).eq('client_tenant_id', data.tenantId).single();
  if (!analysis) throw new Error('Análise não encontrada neste cliente.');
  const path = `${data.tenantId}/${data.analysisId}/${data.importId}.xlsx`;
  const download = await context.supabase.storage.from('tax-impact-originals').download(path);
  if (download.error || !download.data) throw new Error('Arquivo privado não disponível.');
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  const workbook = readWorkbook(bytes);
  const parsed = await parseSheet(workbook, data.sheet, { importId: data.importId, filename: data.filename, role: data.role as Role, year: data.year, mapping: data.mapping as Mapping, chargeBasis: data.chargeBasis, headerRow: data.headerRow });
  if (!parsed.rows.length) throw new Error('Nenhuma linha válida. Revise o preview.');
  const { error } = await context.supabase.from('tax_impact_imports').insert({ id: data.importId, analysis_id: data.analysisId, client_tenant_id: data.tenantId, role: data.role, filename: data.filename, storage_path: path, file_hash: await sha256(bytes), sheet: data.sheet, header_row: parsed.headerRow, mapping: json({ columns: data.mapping, chargeBasis: data.chargeBasis, confirmed: true }), period_year: data.year, rows: json(parsed.rows), errors: json(parsed.errors), created_by: context.userId });
  if (error) throw new Error('Importação não foi salva.');
  if (data.profileName) {
    const saved = await context.supabase.from('tax_impact_mapping_profiles').insert({ client_tenant_id: data.tenantId, name: data.profileName, role: data.role, mapping: json({ columnsByName: Object.fromEntries(Object.entries(data.mapping).map(([field, index]) => [field, parsed.rows[0].source.columns[field as keyof Mapping]])), chargeBasis: data.chargeBasis }), created_by: context.userId });
    if (saved.error) return { ok: true, warning: 'Importação salva; perfil não pôde ser salvo.' };
  }
  return { ok: true, warning: '' };
});
export const compareTaxAnalysisFn = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => analysisScope.extend({ baselineId: z.string().uuid(), proposalId: z.string().uuid(), manualMatches: z.record(z.string(), z.string()).default({}) }).parse(d)).handler(async ({ data, context }) => {
  await authorize(context.supabase, data.tenantId);
  const { data: imports, error } = await context.supabase.from('tax_impact_imports').select('*').eq('client_tenant_id', data.tenantId).eq('analysis_id', data.analysisId).in('id', [data.baselineId, data.proposalId]);
  if (error) throw new Error('Não foi possível carregar bases.');
  const baseline = imports?.find(i => i.id === data.baselineId && i.role === 'baseline');
  const proposal = imports?.find(i => i.id === data.proposalId && i.role === 'proposal');
  if (!baseline || !proposal) throw new Error('Selecione importações válidas deste cliente e análise.');
  const results = comparePrograms(baseline.rows as unknown as Row[], proposal.rows as unknown as Row[], data.manualMatches);
  const { data: latest, error: versionError } = await context.supabase.from('tax_impact_revisions').select('version').eq('analysis_id', data.analysisId).eq('client_tenant_id', data.tenantId).order('version', { ascending: false }).limit(1);
  if (versionError) throw new Error('Falha ao obter versão.');
  const { data: revision, error: insertError } = await context.supabase.from('tax_impact_revisions').insert({ analysis_id: data.analysisId, client_tenant_id: data.tenantId, version: (latest?.[0]?.version ?? 0) + 1, baseline_import_id: baseline.id, proposal_import_id: proposal.id, manual_matches: json(data.manualMatches), results: json(results), status: results.some(r => r.match === 'ambiguous') ? 'needs_review' : 'compared', created_by: context.userId }).select().single();
  if (insertError) throw new Error('Não foi possível salvar versão; atualize e tente novamente.');
  const warning = baseline.period_year === proposal.period_year ? 'As duas bases têm o mesmo ano: isto é apenas um smoke test, não um comparativo anual verdadeiro.' : '';
  return { ...revision, warning };
});
export const taxOriginalUrlFn = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => analysisScope.extend({ importId: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  await authorize(context.supabase, data.tenantId);
  const { data: item } = await context.supabase.from('tax_impact_imports').select('storage_path').eq('id', data.importId).eq('analysis_id', data.analysisId).eq('client_tenant_id', data.tenantId).single();
  if (!item) throw new Error('Arquivo não encontrado neste cliente.');
  const { data: signed, error } = await context.supabase.storage.from('tax-impact-originals').createSignedUrl(item.storage_path, 60);
  if (error || !signed) throw new Error('Não foi possível abrir o original.');
  return signed.signedUrl;
});
