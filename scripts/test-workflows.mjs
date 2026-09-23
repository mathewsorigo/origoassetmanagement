// Run against the disposable local test database only, never the cloud database.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const sql = postgres({ host: "127.0.0.1", port: 54330, database: "origo_workflow_test", username: "postgres",
  password: fs.readFileSync(path.join(process.env.LOCALAPPDATA, "origoassetmanagement-local/admin-password.local"), "utf8") });
const operator = randomUUID(), viewer = randomUUID(), employee = randomUUID(), asset = randomUUID(), spare = randomUUID(), template = randomUUID();
const asUser = (user, fn) => sql.begin(async tx => {
  await tx`select set_config('request.jwt.claim.sub', ${user ?? ""}, true)`;
  await tx`set local role authenticated`;
  return fn(tx);
});
const create = (tx, id = randomUUID(), templateId = template) => tx`select public.create_assignment_complete(${id},${asset},${employee},now(),'Bom','',${templateId},'Termo de teste','[{"label":"Conferido","ok":true}]'::jsonb,ARRAY[]::text[]) as id`;
try {
  assert.equal((await sql`select current_database() as name`)[0].name, "origo_workflow_test");
  // Auth and grants omitted from the application's read-only local restore.
  await sql.unsafe(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    CREATE OR REPLACE FUNCTION public.is_operator(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS 'SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=u AND role IN (''admin'',''ti''))';
    GRANT USAGE ON SCHEMA auth,public TO authenticated;
    GRANT EXECUTE ON FUNCTION public.is_operator(uuid) TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT INSERT,UPDATE ON assets,employees,assignments,agreements,assignment_checklists,audit_log TO authenticated;`);
  await sql`insert into user_roles(user_id,role) values(${operator},'ti'),(${viewer},'colaborador')`;
  await sql`insert into employees(id,full_name,email) values(${employee},'Teste de workflow',${employee + '@example.test'})`;
  await sql`insert into assets(id,serial_number) values(${asset},${asset}),(${spare},${spare})`;
  await sql`insert into agreement_templates(id,name,body) values(${template},'Teste','Termo de teste')`;
  await assert.rejects(asUser(null, tx => create(tx)), /Apenas/);
  await assert.rejects(asUser(viewer, tx => create(tx)), /Apenas/);
  await assert.rejects(asUser(operator, tx => create(tx, randomUUID(), randomUUID())), /Modelo/);
  assert.equal((await sql`select count(*)::int n from assignments where asset_id=${asset}`)[0].n,0);
  // Force the last write to fail: the earlier assignment, status and term must roll back.
  await sql`revoke insert on audit_log from authenticated`;
  await assert.rejects(asUser(operator, tx => create(tx)), /permission denied/);
  assert.equal((await sql`select status from assets where id=${asset}`)[0].status,'disponivel');
  assert.equal((await sql`select count(*)::int n from agreements where asset_id=${asset}`)[0].n,0);
  await sql`grant insert on audit_log to authenticated`;
  const concurrent = await Promise.allSettled([asUser(operator,tx=>create(tx)),asUser(operator,tx=>create(tx))]);
  assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
  const [{id}] = await sql`select id from assignments where asset_id=${asset}`;
  assert.equal((await sql`select count(*)::int n from agreements where assignment_id=${id}`)[0].n,1);
  assert.equal((await sql`select count(*)::int n from assignment_checklists where assignment_id=${id}`)[0].n,1);
  await assert.rejects(asUser(operator,tx=>tx`select archive_entities('assets',${sql.array([spare,asset])}::uuid[],false)`),/devolução/);
  assert.equal((await sql`select archived_at from assets where id=${spare}`)[0].archived_at,null);
  await asUser(operator,tx=>tx`select close_assignment_complete(${id},'Bom','[{"label":"Conferido","ok":true}]'::jsonb,ARRAY[]::text[])`);
  await assert.rejects(asUser(operator,tx=>tx`select close_assignment_complete(${id},'Bom','[{"label":"Conferido","ok":true}]'::jsonb,ARRAY[]::text[])`),/encerrado/);
  await asUser(operator,tx=>tx`select archive_entities('assets',${sql.array([asset])}::uuid[],false)`);
  assert.notEqual((await sql`select archived_at from assets where id=${asset}`)[0].archived_at,null);
  assert.equal((await sql`select count(*)::int n from agreements where assignment_id=${id}`)[0].n,1);
  await asUser(operator,tx=>tx`select archive_entities('assets',${sql.array([asset])}::uuid[],true)`);
  assert.equal((await sql`select archived_at from assets where id=${asset}`)[0].archived_at,null);
  await assert.rejects(asUser(operator,tx=>tx`delete from assets where id=${spare}`),/permission denied/);
  console.log('PASS: authorization, missing template, transaction rollback, concurrent delivery, return, atomic archive, restoration and preserved history.');
} finally {
  await sql`grant insert on audit_log to authenticated`;
  await sql`delete from assets where id in (${asset},${spare})`;
  await sql`delete from employees where id=${employee}`;
  await sql`delete from agreement_templates where id=${template}`;
  await sql`delete from user_roles where user_id in (${operator},${viewer})`;
  await sql`delete from audit_log where actor_id=${operator}`;
  await sql.end();
}
