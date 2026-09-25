"""Disposable LOCAL PostgreSQL only; never uses application credentials or remote DBs.
Run as root with local postgres installed: python3 scripts/test-assignment-policy.py
"""
import pathlib
import subprocess
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = 'assignment_policy_' + uuid.uuid4().hex[:12]

def sql(text):
    result = subprocess.run(['runuser', '-u', 'postgres', '--', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-d', DB], input=text, text=True, capture_output=True)
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout

subprocess.run(['runuser', '-u', 'postgres', '--', 'createdb', DB], check=True)
try:
    sql("""
    DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF; END $$;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO authenticated;
    CREATE TABLE storage.objects(id uuid,bucket_id text);
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
    CREATE PUBLICATION supabase_realtime;
    """)
    for migration in sorted((ROOT / 'drizzle/migrations').glob('*.sql')):
        sql(migration.read_text())
    sql("""
    INSERT INTO profiles(id,email) VALUES('00000000-0000-0000-0000-000000000001','operator@example.test');
    INSERT INTO user_roles(user_id,role) VALUES('00000000-0000-0000-0000-000000000001','ti');
    INSERT INTO employees(id,full_name,email) VALUES('00000000-0000-0000-0000-000000000002','Active','active@example.test');
    INSERT INTO assets(id,serial_number) VALUES('00000000-0000-0000-0000-000000000003','LOCAL-TEST');
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
    SELECT create_assignment_complete('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',now(),'','',NULL,NULL,'[{"label":"Not inspected","ok":null,"reason":"Local test"}]','{}');
    DO $$ BEGIN IF EXISTS(SELECT 1 FROM agreements) THEN RAISE EXCEPTION 'Unexpected agreement'; END IF; END $$;
    COMMIT;
    """)
    print('PASS: active employee physical assignment without agreement or template')
    sql("""
    UPDATE employees SET status='inativo' WHERE id='00000000-0000-0000-0000-000000000002';
    INSERT INTO assets(id,serial_number) VALUES('00000000-0000-0000-0000-000000000005','LOCAL-ADMIN');
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
    SELECT create_assignment_complete('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002',now(),'','',NULL,NULL,'[{"label":"Not inspected","ok":null,"reason":"Administrative only"}]','{}',false,'administrative');
    COMMIT;
    """)
    print('PASS: inactive employee administrative assignment')
    sql("""
    INSERT INTO employees(id,full_name,email,status) VALUES('00000000-0000-0000-0000-000000000007','Other inactive','other@example.test','inativo');
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
    SELECT qa_transaction('transfer','{"id":"00000000-0000-0000-0000-000000000006","new_id":"00000000-0000-0000-0000-000000000008","employee_id":"00000000-0000-0000-0000-000000000007","assignment_kind":"administrative","create_agreement":false,"items":[{"label":"Administrative","ok":null,"reason":"No physical evidence"}]}');
    COMMIT;
    """)
    print('PASS: transfer to inactive employee, administrative without agreement')

    import json
    from concurrent.futures import ThreadPoolExecutor
    def uid(n): return str(uuid.UUID(int=n))
    auth = "SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='" + uid(1) + "';"
    def op(q): return sql('BEGIN;'+auth+q+'COMMIT;')
    def denied(q, message):
        try: op(q)
        except AssertionError as e:
            assert message in str(e), str(e)
        else: raise AssertionError('Expected rejection: '+q)
    def check(expr): sql("DO $$ BEGIN IF NOT ("+expr+") THEN RAISE EXCEPTION 'Assertion failed'; END IF; END $$;")
    items=json.dumps([dict(label='Not physically inspected',ok=None,reason='Administrative fixture')])
    def create(n, employee=2, kind='physical_delivery', agreement=False, template='NULL'):
        return f"SELECT create_assignment_complete('{uid(n)}','{uid(n+1)}','{uid(employee)}',now(),'','',{template},'draft','{items}','{{}}',{str(agreement).lower()},'{kind}');"
    def asset(n): sql(f"INSERT INTO assets(id,serial_number) VALUES('{uid(n+1)}','FIXTURE-{n}');")
    def transaction(action,data): return "SELECT qa_transaction('"+action+"','"+json.dumps(data)+"');"
    asset(20);denied(create(20),'Colaborador indisponível')
    sql(f"INSERT INTO employees(id,full_name,email,archived_at) VALUES('{uid(9)}','Archived','archived@example.test',now());")
    for kind in ['physical_delivery','administrative']:
        denied(create(20,9,kind),'Colaborador indisponível')
    denied(create(20,2,'administrative',True),'Modelo de termo')
    check(f"NOT EXISTS(SELECT 1 FROM assignments WHERE id='{uid(20)}')")
    sql(f"INSERT INTO agreement_templates(id,name,body) VALUES('{uid(10)}','Local','draft');")
    op(create(20,2,'administrative',True,"'"+uid(10)+"'"))
    check(f"(SELECT status='rascunho' AND sent_at IS NULL FROM agreements WHERE assignment_id='{uid(20)}')")
    check(f"(SELECT status='inativo' FROM employees WHERE id='{uid(2)}')")
    sql(f"INSERT INTO employees(id,full_name,email) VALUES('{uid(11)}','Active 2','active2@example.test');")
    asset(22);op(create(22,11,'physical_delivery',True,"'"+uid(10)+"'"))
    asset(24);op(create(24,11,'administrative'))
    denied(f"UPDATE assignments SET assignment_kind='physical_delivery' WHERE id='{uid(20)}';",'imutável')
    denied(f"UPDATE employees SET archived_at=now() WHERE id='{uid(2)}';",'Encerre')
    denied(transaction('transfer',dict(id=uid(8),new_id=uid(26),employee_id=uid(2),items=json.loads(items))),'Colaborador indisponível')
    check(f"(SELECT status='ativo' FROM assignments WHERE id='{uid(8)}')")
    op(transaction('return',dict(id=uid(8),items=json.loads(items))))
    op(transaction('undo_return',dict(id=uid(8))))
    check(f"(SELECT status='ativo' AND assignment_kind='administrative' FROM assignments WHERE id='{uid(8)}')")
    op(transaction('return',dict(id=uid(4),items=json.loads(items))))
    denied(transaction('undo_return',dict(id=uid(4))),'Colaborador indisponível')
    op(transaction('return',dict(id=uid(8),items=json.loads(items))))
    sql(f"UPDATE employees SET archived_at=now() WHERE id='{uid(7)}';")
    denied(transaction('undo_return',dict(id=uid(8))),'Cadastro arquivado')
    asset(30)
    denied(f"INSERT INTO assignments(id,asset_id,employee_id) VALUES('{uid(30)}','{uid(31)}','{uid(2)}');",'Colaborador indisponível')
    def contender(n):
        try: op(create(30,11).replace(uid(30),uid(n))); return True
        except AssertionError: return False
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sum(pool.map(contender,[32,34]))==1
    check(f"(SELECT count(*)=1 FROM assignments WHERE asset_id='{uid(31)}' AND status='ativo')")
    check("EXISTS(SELECT 1 FROM audit_log WHERE details->>'assignment_kind'='administrative' AND details->>'create_agreement'='false')")
    check("EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='assignments_list' AND column_name='assignment_kind')")
    print('PASS: inactive physical / archived rejected; no reactivation; both kinds explicit draft; rollback on invalid template and transfer; immutable kind; direct writes; return/reopen; concurrent asset exclusivity; audit')

    asset(40)
    for caller in ['', uid(999)]:
        try: sql("BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='"+caller+"';"+create(40,11)+'COMMIT;')
        except AssertionError as e: assert 'Apenas' in str(e)
        else: raise AssertionError('Unauthorized RPC accepted')
    sql('REVOKE INSERT ON audit_log FROM authenticated;')
    denied(create(40,11), 'permission denied')
    sql('GRANT INSERT ON audit_log TO authenticated;')
    check(f"NOT EXISTS(SELECT 1 FROM assignments WHERE id='{uid(40)}') AND (SELECT status='disponivel' FROM assets WHERE id='{uid(41)}') AND NOT EXISTS(SELECT 1 FROM assignment_checklists WHERE assignment_id='{uid(40)}')")
    print('PASS: unauthenticated/non-operator RPC denied; audit failure rolls back assignment/asset/checklist')

    # Conservative down migration: refusal must leave exact history/schema intact.
    rollback = (ROOT / 'scripts/rollback-0015-assignment-policy.sql').read_text()
    def snapshot():
        return sql("SELECT jsonb_build_object(" + ','.join("'"+t+"',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM "+t+" x)" for t in ['assignments','agreements','assignment_checklists','audit_log','assets','employees']) + ");")
    before = snapshot()
    try: sql(rollback)
    except AssertionError as e: assert 'ROLLBACK_REFUSED' in str(e)
    else: raise AssertionError('Unsafe rollback accepted')
    assert snapshot() == before
    check("EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='assignments_list' AND column_name='assignment_kind')")
    print('PASS: rollback refuses incompatible history and preserves exact records/schema')

    # Separate empty disposable database: no fixture deletion or production cleanup.
    original_db = DB
    DB = 'assignment_policy_' + uuid.uuid4().hex[:12]
    subprocess.run(['runuser', '-u', 'postgres', '--', 'createdb', '-T', original_db, DB], check=True)
    try:
        # A fresh compatible fixture is built from the schema only, in a NEW database.
        sql('DROP SCHEMA public CASCADE; DROP SCHEMA storage CASCADE; CREATE SCHEMA public; CREATE SCHEMA storage; GRANT USAGE ON SCHEMA public TO authenticated; CREATE TABLE storage.objects(id uuid,bucket_id text); CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);')
        for migration in sorted((ROOT / 'drizzle/migrations').glob('*.sql')):
            sql(migration.read_text())
        sql(f"INSERT INTO profiles(id,email) VALUES('{uid(1)}','operator@example.test'); INSERT INTO user_roles(user_id,role) VALUES('{uid(1)}','ti'); INSERT INTO employees(id,full_name,email) VALUES('{uid(11)}','Compatible','compatible@example.test'); INSERT INTO agreement_templates(id,name,body) VALUES('{uid(10)}','Local','draft');")
        asset(50)
        op(create(50,11,'physical_delivery',True,"'"+uid(10)+"'"))
        preserved = sql("SELECT (SELECT jsonb_agg(to_jsonb(x)) FROM agreements x), (SELECT jsonb_agg(to_jsonb(x)) FROM assignment_checklists x), (SELECT jsonb_agg(to_jsonb(x)) FROM audit_log x);")
        sql(rollback)
        assert preserved == sql("SELECT (SELECT jsonb_agg(to_jsonb(x)) FROM agreements x), (SELECT jsonb_agg(to_jsonb(x)) FROM assignment_checklists x), (SELECT jsonb_agg(to_jsonb(x)) FROM audit_log x);")
        check(f"EXISTS(SELECT 1 FROM assignments WHERE id='{uid(50)}' AND status='ativo')")
        check("NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='assignments' AND column_name='assignment_kind')")
        check("to_regprocedure('public.create_assignment_complete(uuid,uuid,uuid,timestamptz,text,text,uuid,text,jsonb,text[])') IS NOT NULL")
        check("has_function_privilege('authenticated','public.create_assignment_complete(uuid,uuid,uuid,timestamptz,text,text,uuid,text,jsonb,text[])','EXECUTE')")
        sql((ROOT / 'drizzle/migrations/0015_assignment_policy.sql').read_text())
        check("EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='assignments_list' AND column_name='assignment_kind')")
        print('PASS: compatible rollback preserves agreement/checklist/audit history, restores old RPC/view; forward reapply succeeds')
    finally:
        subprocess.run(['runuser', '-u', 'postgres', '--', 'dropdb', DB], check=True)
        DB = original_db

finally:
    subprocess.run(['runuser', '-u', 'postgres', '--', 'dropdb', DB], check=True)
