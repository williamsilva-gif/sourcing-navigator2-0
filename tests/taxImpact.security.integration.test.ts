import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
const url = process.env['SUPABASE_URL']; const service = process.env['SUPABASE_SERVICE_ROLE_KEY']; const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
const suite = url && service && key ? describe : describe.skip;
function client(apiKey: string): SupabaseClient {
 return createClient(url || 'http://127.0.0.1:54321',apiKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const h=new Headers(init?.headers);if(apiKey.startsWith('sb_')&&h.get('Authorization')===`Bearer ${apiKey}`)h.delete('Authorization');h.set('apikey',apiKey);return fetch(input,{...init,headers:h});}}});
}
const admin=client(service || 'missing'); const users:string[]=[]; const tenants:string[]=[]; let ta:SupabaseClient;let corp:SupabaseClient;let anon:SupabaseClient;let tenantA='';let tenantB='';let analysisA='';let analysisB='';let path='';
const password='Integration-test-'+crypto.randomUUID(); const stamp=crypto.randomUUID();
suite('Tax Impact private tenancy and roles',()=>{
 beforeAll(async()=>{
  const inserted=await admin.from('tenants').insert([{name:`Tax Impact security A ${stamp}`,type:'CORP'},{name:`Tax Impact security B ${stamp}`,type:'CORP'}]).select('id');if(inserted.error)throw inserted.error;
  [tenantA,tenantB]=(inserted.data??[]).map(t=>t.id);tenants.push(tenantA,tenantB);
  const {data:root}=await admin.from('tenants').select('id').eq('type','TA').limit(1).single();if(!root)throw new Error('TA tenant required');
  async function user(label:string){const email=`taximpact-test+${label}-${stamp}@example.com`;const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error||!created.data.user)throw new Error('Cannot create temporary test user');users.push(created.data.user.id);const c=client(key||'missing');const signed=await c.auth.signInWithPassword({email,password});if(signed.error)throw signed.error;return {c,id:created.data.user.id};}
  const staff=await user('staff');ta=staff.c;const ordinary=await user('corp');corp=ordinary.c;anon=client(key||'missing');
  const roles=await admin.from('user_roles').insert([{user_id:staff.id,tenant_id:root.id,role:'ta_staff'},{user_id:ordinary.id,tenant_id:tenantA,role:'corp_admin'}]);if(roles.error)throw roles.error;
  const override=await admin.from('user_module_overrides').insert({user_id:staff.id,tenant_id:tenantB,module_key:'tax_impact_check',enabled:false});if(override.error)throw override.error;
  const analyses=await admin.from('tax_impact_analyses').insert([{client_tenant_id:tenantA,name:'Security A',created_by:staff.id},{client_tenant_id:tenantB,name:'Security B',created_by:staff.id}]).select('id,client_tenant_id');if(analyses.error)throw analyses.error;
  analysisA=analyses.data.find(a=>a.client_tenant_id===tenantA)?.id??'';analysisB=analyses.data.find(a=>a.client_tenant_id===tenantB)?.id??'';
 },60000);
 afterAll(async()=>{
  if(path)await admin.storage.from('tax-impact-originals').remove([path]);
  if(tenants.length){await admin.from('tax_impact_revisions').delete().in('client_tenant_id',tenants);await admin.from('tax_impact_imports').delete().in('client_tenant_id',tenants);await admin.from('tax_impact_mapping_profiles').delete().in('client_tenant_id',tenants);await admin.from('tax_impact_analyses').delete().in('client_tenant_id',tenants);await admin.from('user_module_overrides').delete().in('tenant_id',tenants);}
  for(const id of users)await admin.auth.admin.deleteUser(id);
  if(tenants.length)await admin.from('tenants').delete().in('id',tenants);
 },60000);
 it('allows authorized TA staff but filters disabled tenant rows',async()=>{const r=await ta.from('tax_impact_analyses').select('id').in('id',[analysisA,analysisB]);expect(r.error).toBeNull();expect(r.data?.map(a=>a.id)).toEqual([analysisA]);});
 it('denies ordinary tenant admins even in their own tenant',async()=>{const r=await corp.from('tax_impact_analyses').select('id').eq('id',analysisA);expect(r.error).toBeNull();expect(r.data).toEqual([]);const insert=await corp.from('tax_impact_analyses').insert({client_tenant_id:tenantA,name:'Forbidden'});expect(insert.error).not.toBeNull();});
 it('denies anonymous table access',async()=>{const r=await anon.from('tax_impact_analyses').select('id');expect(r.data ?? []).toEqual([]);});
 it('blocks import linked to another tenant analysis',async()=>{const id=crypto.randomUUID();const r=await ta.from('tax_impact_imports').insert({id,analysis_id:analysisB,client_tenant_id:tenantA,role:'baseline',filename:'a.xlsx',storage_path:`${tenantA}/${analysisB}/${id}.xlsx`,file_hash:'hash',sheet:'sheet',header_row:1,mapping:{},period_year:2026,rows:[]});expect(r.error).not.toBeNull();});
 it('stores originals privately; refuses ordinary and disabled-tenant downloads/uploads',async()=>{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Hotel'],['Test']]),'Sheet');const bytes=new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'}));path=`${tenantA}/${analysisA}/${crypto.randomUUID()}.xlsx`;const put=await ta.storage.from('tax-impact-originals').upload(path,bytes,{contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});expect(put.error).toBeNull();expect((await ta.storage.from('tax-impact-originals').download(path)).error).toBeNull();expect((await corp.storage.from('tax-impact-originals').download(path)).error).not.toBeNull();expect((await anon.storage.from('tax-impact-originals').download(path)).error).not.toBeNull();const bad=await ta.storage.from('tax-impact-originals').upload(`${tenantB}/${analysisB}/${crypto.randomUUID()}.xlsx`,bytes);expect(bad.error).not.toBeNull();const info=await admin.storage.getBucket('tax-impact-originals');expect(info.data?.public).toBe(false);});
 it('does not allow mutation of saved analysis rows',async()=>{await ta.from('tax_impact_analyses').update({name:'Changed'}).eq('id',analysisA);const r=await ta.from('tax_impact_analyses').select('name').eq('id',analysisA).single();expect(r.data?.name).toBe('Security A');});
});
