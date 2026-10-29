import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {scenarioSchema} from './taxImpact/simulation';
import {volumeBook,parseVolume,volumeFields,type VolumeMapping} from './taxImpact/volume';
import {sha256} from './taxImpact/core';
import {fetchOfficialSources,saoPauloDay} from './taxImpact/sources';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database,Json} from '@/integrations/supabase/types';
const scope=z.object({tenantId:z.string().uuid(),analysisId:z.string().uuid()});
const json=(v:unknown):Json=>JSON.parse(JSON.stringify(v));
async function authorize(c:SupabaseClient<Database>,tenantId:string,analysisId:string){
 const access=await c.rpc('tax_impact_access',{_tenant_id:tenantId});if(access.error||!access.data)throw new Error('Acesso não autorizado.');
 const a=await c.from('tax_impact_analyses').select('id').eq('id',analysisId).eq('client_tenant_id',tenantId).single();if(a.error||!a.data)throw new Error('Análise não encontrada neste cliente.');
}
export const getTaxScenarioFn=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>scope.parse(v)).handler(async({data,context})=>{
 await authorize(context.supabase,data.tenantId,data.analysisId);
 const [scenario,volume]=await Promise.all([context.supabase.from('tax_impact_scenarios').select('*').eq('analysis_id',data.analysisId).eq('client_tenant_id',data.tenantId).maybeSingle(),context.supabase.from('tax_impact_volume_imports').select('*').eq('analysis_id',data.analysisId).eq('client_tenant_id',data.tenantId).order('created_at',{ascending:false})]);
 if(scenario.error||volume.error)throw new Error('Falha ao carregar premissas/volumetria.');
 return {scenario:scenario.data,volumes:volume.data??[]};
});
export const saveTaxScenarioFn=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>scope.extend({parameters:scenarioSchema}).parse(v)).handler(async({data,context})=>{
 await authorize(context.supabase,data.tenantId,data.analysisId);const saved=await context.supabase.from('tax_impact_scenarios').upsert({analysis_id:data.analysisId,client_tenant_id:data.tenantId,parameters:json(data.parameters),updated_by:context.userId,updated_at:new Date().toISOString()});if(saved.error)throw new Error('Premissas não foram salvas.');return {ok:true};
});
export const commitTaxVolumeFn=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>scope.extend({importId:z.string().uuid(),filename:z.string().min(1).max(250).regex(/\.(xlsx|csv)$/i),sheet:z.string().min(1).max(100),mapping:z.record(z.enum(Object.keys(volumeFields) as [keyof typeof volumeFields,...(keyof typeof volumeFields)[]]),z.number().int().min(0).max(199)),confirmed:z.literal(true)}).parse(v)).handler(async({data,context})=>{
 await authorize(context.supabase,data.tenantId,data.analysisId);const csv=/\.csv$/i.test(data.filename),path=`${data.tenantId}/${data.analysisId}/volume-${data.importId}.${csv?'csv':'xlsx'}`;
 const file=await context.supabase.storage.from('tax-impact-originals').download(path);if(file.error||!file.data)throw new Error('Original privado não disponível.');
 const bytes=new Uint8Array(await file.data.arrayBuffer()),wb=volumeBook(bytes,csv),parsed=parseVolume(wb,data.sheet,data.mapping as VolumeMapping);
 if(!parsed.rows.length)throw new Error('Sem linhas válidas.');
 const saved=await context.supabase.from('tax_impact_volume_imports').insert({id:data.importId,analysis_id:data.analysisId,client_tenant_id:data.tenantId,filename:data.filename,storage_path:path,file_hash:await sha256(bytes),sheet:data.sheet,mapping:json({columns:data.mapping,headerRow:parsed.headerRow}),rows:json(parsed.rows),errors:json(parsed.errors),created_by:context.userId});if(saved.error)throw new Error('Volumetria não foi salva.');return {rows:parsed.rows.length,errors:parsed.errors.length};
});
export const checkTaxSourcesFn=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>scope.parse(v)).handler(async({data,context})=>{
 await authorize(context.supabase,data.tenantId,data.analysisId);const day=saoPauloDay();
 // Verification-cache writes are privileged, unlike all ordinary analysis/volume operations.
 // Caller role and tenant access have already been verified through the caller's RLS client.
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const claim=await supabaseAdmin.rpc('claim_tax_impact_source_check',{_tenant_id:data.tenantId,_day:day});if(claim.error)throw new Error('Verificação indisponível; não verificado.');
 if(claim.data?.[0]){const token=claim.data[0].claim_token,result=await fetchOfficialSources();const saved=await supabaseAdmin.from('tax_impact_source_checks').update({result:json(result),state:result.tcu.status==='validated'?'checked':'failed',checked_at:result.checkedAt}).eq('client_tenant_id',data.tenantId).eq('day',day).eq('claim_token',token);if(saved.error)throw new Error('Consulta realizada mas registro indisponível; não verificado.');return {state:result.tcu.status==='validated'?'checked':'failed',result:json(result),lastValidated:null};}
 const [today,last]=await Promise.all([context.supabase.from('tax_impact_source_checks').select('state,result').eq('client_tenant_id',data.tenantId).eq('day',day).maybeSingle(),context.supabase.from('tax_impact_source_checks').select('result').eq('client_tenant_id',data.tenantId).eq('state','checked').lt('day',day).order('day',{ascending:false}).limit(1)]);
 return {state:today.data?.state??'failed',result:today.data?.result??null,lastValidated:last.data?.[0]?.result??null};
});
