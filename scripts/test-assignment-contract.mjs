// Offline contract tests: execute actual schemas and openAssignment with an in-memory DB adapter.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
import vm from 'node:vm';
const source = fs.readFileSync('src/lib/hermes-v1.server.ts', 'utf8');
const slice = source.slice(source.indexOf('const assignmentCreate ='), source.indexOf('const assignments ='));
const js = ts.transpileModule(slice + '\n globalThis.subject = { assignmentCreate, openAssignment };', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const context = vm.createContext({ z, uuid:z.string().uuid(), optStr:n=>z.string().max(n).optional(), randomUUID:()=> 'new-id', run:async x=>x, getRow:async()=>({id:'new-id'}), renderAgreement:()=> 'draft', fail:(status,code,message)=>Object.assign(new Error(message),{status,code}) });
vm.runInContext(js, context);
const { assignmentCreate, openAssignment } = context.subject;
const ids={asset_id:'00000000-0000-0000-0000-000000000001',employee_id:'00000000-0000-0000-0000-000000000002'};
const defaults=assignmentCreate.parse(ids);
assert.equal(defaults.create_agreement,false);
assert.equal(defaults.assignment_kind,'physical_delivery');
assert.equal(assignmentCreate.parse({...ids,assignment_kind:'administrative'}).assignment_kind,'administrative');
assert.equal(assignmentCreate.safeParse({...ids,assignment_kind:'invented'}).success,false);
let calls=[];
const db={rpc:async(name,args)=>{calls.push({name,args});return {};},from:table=>{
 if(table==='agreement_templates') {calls.push({template:true}); return {select:()=>({eq:()=>({single:async()=>({id:'template',body:'body'})})})};}
 assert.equal(table,'agreements');return {select:()=>({eq:()=>({maybeSingle:async()=>null})})};
}};
for(const kind of ['physical_delivery','administrative']) {
 calls=[];
 const result=await openAssignment({db},{id:ids.asset_id,is_test:false},{id:ids.employee_id,is_test:false},assignmentCreate.parse({...ids,assignment_kind:kind}));
 assert.equal(calls.some(c=>c.template),false);
 assert.equal(calls[0].args.p_create_agreement,false);
 assert.equal(calls[0].args.p_assignment_kind,kind);
 assert.equal(calls[0].args.p_template_id,null);
 assert.equal(result.agreement,null);
}
calls=[];
await openAssignment({db},{id:ids.asset_id,is_test:false},{id:ids.employee_id,is_test:false},assignmentCreate.parse({...ids,create_agreement:true}));
assert.equal(calls.filter(c=>c.template).length,1);
assert.equal(calls.find(c=>c.args).args.p_create_agreement,true);
assert.equal(calls.find(c=>c.args).args.p_content,'draft');
await assert.rejects(openAssignment({db},{is_test:true},{is_test:false},defaults),/teste/);
console.log('PASS: actual create schema defaults/validation, physical + administrative without template, explicit draft, test isolation');

for (const path of ['src/routes/_authenticated/vinculos.tsx','src/components/asset-detail-panel.tsx']) {
 const ui=fs.readFileSync(path,'utf8');
 assert.match(ui,/create_agreement: false/);
 assert.match(ui,/p_assignment_kind:/);
 assert.match(ui,/p_create_agreement:/);
 assert.match(ui,/administrative/);
 assert.doesNotMatch(ui,/gerado automaticamente/);
}
console.log('PASS: both UI entry points explicitly forward policy options (source wiring check)');

for(const path of ['src/routes/_authenticated/vinculos.tsx','src/components/asset-detail-panel.tsx']) {
 const ui=fs.readFileSync(path,'utf8');
 assert.match(ui,/filter\(\(e\) => .*assignment_kind === "administrative" \|\| e.status === "ativo"\)/);
}
