-- Apply transactionally after 0013. RLS remains enforced (SECURITY INVOKER).
CREATE FUNCTION public.qa_assert_operator() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_operator(auth.uid()) THEN RAISE EXCEPTION 'Operação restrita à equipe de TI.'; END IF;
END $$;

CREATE FUNCTION public.qa_audit_actor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.actor_id IS NOT NULL AND NEW.actor_email IS NULL THEN
   SELECT email INTO NEW.actor_email FROM profiles WHERE id=NEW.actor_id;
   NEW.actor_email := COALESCE(NEW.actor_email, 'Conta ' || NEW.actor_id::text);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER qa_audit_actor BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.qa_audit_actor();
UPDATE public.audit_log a SET actor_email=p.email FROM public.profiles p WHERE a.actor_id=p.id AND a.actor_email IS NULL;

CREATE FUNCTION public.qa_asset_consistency() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE aid uuid; a assets;
BEGIN
 IF TG_TABLE_NAME='assets' THEN aid:=COALESCE(NEW.id,OLD.id);
 ELSE aid:=COALESCE(NEW.asset_id,OLD.asset_id); END IF;
 SELECT * INTO a FROM assets WHERE id=aid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM assignments WHERE asset_id=aid AND status='ativo') THEN
   IF a.status<>'em_uso' OR a.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Registre a devolução antes de alterar a situação ou arquivar o ativo.'; END IF;
   IF EXISTS(SELECT 1 FROM assignments s JOIN employees e ON e.id=s.employee_id WHERE s.asset_id=aid AND s.status='ativo' AND e.archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Colaborador arquivado não pode ter vínculo ativo.'; END IF;
 ELSIF a.status='em_uso' THEN RAISE EXCEPTION 'A situação Em uso exige um vínculo ativo.'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER qa_assets_consistent AFTER INSERT OR UPDATE ON public.assets DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.qa_asset_consistency();
CREATE CONSTRAINT TRIGGER qa_assignments_consistent AFTER INSERT OR UPDATE OR DELETE ON public.assignments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.qa_asset_consistency();

CREATE FUNCTION public.qa_validate_asset() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.monthly_cost<0 THEN RAISE EXCEPTION 'O custo não pode ser negativo.'; END IF;
 IF NEW.lease_start>NEW.lease_end THEN RAISE EXCEPTION 'O fim da locação deve ser posterior ao início.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER qa_validate_asset BEFORE INSERT OR UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.qa_validate_asset();

CREATE FUNCTION public.qa_checklist() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF jsonb_typeof(NEW.items)<>'array' OR jsonb_array_length(NEW.items)=0 THEN RAISE EXCEPTION 'Preencha o checklist ou registre o motivo da dispensa.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.items) i WHERE COALESCE(trim(i->>'label'),'')='' OR (jsonb_typeof(i->'ok') IS DISTINCT FROM 'boolean' AND COALESCE(trim(i->>'reason'),'')='')) THEN
   RAISE EXCEPTION 'Confirme cada item do checklist.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER qa_checklist BEFORE INSERT OR UPDATE ON public.assignment_checklists FOR EACH ROW EXECUTE FUNCTION public.qa_checklist();

ALTER TABLE public.inventory_sessions ADD COLUMN snapshot jsonb, ADD COLUMN snapshot_at timestamptz;
CREATE FUNCTION public.qa_inventory_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 NEW.snapshot := COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM assets a WHERE archived_at IS NULL
   AND (COALESCE(NEW.scope->>'location','')='' OR a.location=NEW.scope->>'location')
   AND (COALESCE(NEW.scope->>'asset_type','')='' OR a.asset_type::text=NEW.scope->>'asset_type')),'[]');
 NEW.snapshot_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER qa_inventory_snapshot BEFORE INSERT ON public.inventory_sessions FOR EACH ROW EXECUTE FUNCTION public.qa_inventory_snapshot();
-- Legacy sessions receive a clearly dated baseline; past membership cannot be reconstructed.
UPDATE public.inventory_sessions s SET snapshot=COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM public.assets a WHERE a.archived_at IS NULL AND (COALESCE(s.scope->>'location','')='' OR a.location=s.scope->>'location') AND (COALESCE(s.scope->>'asset_type','')='' OR a.asset_type::text=s.scope->>'asset_type')),'[]'), snapshot_at=now();
ALTER TABLE public.inventory_checks ADD COLUMN asset_snapshot jsonb;
UPDATE public.inventory_checks c SET asset_snapshot=to_jsonb(a) FROM public.assets a WHERE a.id=c.asset_id;
CREATE FUNCTION public.qa_inventory_check() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s inventory_sessions;
BEGIN
 SELECT * INTO s FROM inventory_sessions WHERE id=COALESCE(NEW.session_id,OLD.session_id) FOR UPDATE;
 IF FOUND AND s.status<>'aberta' THEN RAISE EXCEPTION 'Conferência encerrada não pode ser alterada.'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF EXISTS(SELECT 1 FROM assets WHERE id=NEW.asset_id AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Ativo arquivado não pode ser conferido.'; END IF;
 IF TG_OP='INSERT' THEN SELECT to_jsonb(a) INTO NEW.asset_snapshot FROM assets a WHERE a.id=NEW.asset_id;
 ELSE NEW.asset_snapshot:=OLD.asset_snapshot; END IF;
 NEW.divergencia:=CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(s.snapshot) a WHERE a->>'id'=NEW.asset_id::text) THEN NULL ELSE 'Fora do escopo' END;
 RETURN NEW;
END $$;
CREATE TRIGGER qa_inventory_check BEFORE INSERT OR UPDATE OR DELETE ON public.inventory_checks FOR EACH ROW EXECUTE FUNCTION public.qa_inventory_check();
CREATE FUNCTION public.qa_inventory_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.scope IS DISTINCT FROM OLD.scope THEN RAISE EXCEPTION 'O escopo da conferência é fixo. Crie uma nova conferência.'; END IF;
 IF OLD.status='encerrada' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Conferência encerrada não pode ser alterada.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER qa_inventory_immutable BEFORE UPDATE ON public.inventory_sessions FOR EACH ROW EXECUTE FUNCTION public.qa_inventory_immutable();

CREATE FUNCTION public.qa_transaction(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE aid uuid; eid uuid; sid uuid; rid uuid; prev assignments; a assets; item jsonb; s inventory_sessions; n integer:=0; before_row jsonb; patch jsonb; result jsonb; ids uuid[];
BEGIN
 PERFORM qa_assert_operator();
 IF p_action='transfer' THEN
   SELECT * INTO prev FROM assignments WHERE id=(p_data->>'id')::uuid;
   IF NOT FOUND THEN RAISE EXCEPTION 'Vínculo não encontrado.'; END IF;
   eid:=(p_data->>'employee_id')::uuid;
   PERFORM 1 FROM employees WHERE id IN (prev.employee_id,eid) ORDER BY id FOR UPDATE;
   PERFORM 1 FROM assets WHERE id=prev.asset_id FOR UPDATE;
   PERFORM close_assignment_complete(prev.id,'Transferência', '[{"label":"Conferência pela integração","ok":null,"reason":"Transferência registrada via API"}]','{}');
   rid:=create_assignment_complete((p_data->>'new_id')::uuid,prev.asset_id,eid,COALESCE((p_data->>'assigned_at')::timestamptz,now()),p_data->>'condition',p_data->>'notes',(p_data->>'template_id')::uuid,p_data->>'content',p_data->'items','{}');
   RETURN jsonb_build_object('id',rid);
 ELSIF p_action='return' THEN
   PERFORM close_assignment_complete((p_data->>'id')::uuid,p_data->>'condition',p_data->'items',ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_data->'photos','[]'))));
   SELECT asset_id INTO aid FROM assignments WHERE id=(p_data->>'id')::uuid;
   IF p_data->>'returned_at' IS NOT NULL THEN
     IF (p_data->>'returned_at')::timestamptz>now() OR (p_data->>'returned_at')::timestamptz<(SELECT assigned_at FROM assignments WHERE id=(p_data->>'id')::uuid) THEN RAISE EXCEPTION 'Data de devolução deve estar entre a entrega e o momento atual.'; END IF;
     UPDATE assignments SET returned_at=(p_data->>'returned_at')::timestamptz WHERE id=(p_data->>'id')::uuid;
   END IF;
   IF p_data->>'asset_status' IS NOT NULL THEN UPDATE assets SET status=(p_data->>'asset_status')::asset_status WHERE id=aid; END IF;
   RETURN '{}'::jsonb;
 ELSIF p_action='undo_return' THEN
   SELECT * INTO prev FROM assignments WHERE id=(p_data->>'id')::uuid;
   PERFORM 1 FROM employees WHERE id=prev.employee_id FOR UPDATE;
   PERFORM 1 FROM assets WHERE id=prev.asset_id FOR UPDATE;
   SELECT * INTO prev FROM assignments WHERE id=prev.id FOR UPDATE;
   IF prev.status<>'encerrado' OR prev.returned_at<now()-interval '30 seconds' THEN RAISE EXCEPTION 'O prazo para desfazer terminou.'; END IF;
   IF EXISTS(SELECT 1 FROM assets WHERE id=prev.asset_id AND archived_at IS NOT NULL) OR EXISTS(SELECT 1 FROM employees WHERE id=prev.employee_id AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Cadastro arquivado.'; END IF;
   UPDATE assignments SET status='ativo',returned_at=NULL,return_condition=NULL WHERE id=prev.id;
   UPDATE assets SET status='em_uso' WHERE id=prev.asset_id;
   INSERT INTO audit_log(actor_id,action,entity,entity_id,details) VALUES(auth.uid(),'desfazer_devolucao','assignments',prev.id,to_jsonb(prev));
   RETURN '{}'::jsonb;
 ELSIF p_action='contract' THEN
   ids:=ARRAY(SELECT jsonb_array_elements_text(p_data->'ids')::uuid);
   IF cardinality(ids)=0 THEN RAISE EXCEPTION 'Selecione ao menos um equipamento.'; END IF;
   patch:=p_data->'patch';
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN ('contract_number','supplier','lease_start','lease_end','monthly_cost')) THEN RAISE EXCEPTION 'Campo inválido.'; END IF;
   FOR aid IN SELECT DISTINCT x FROM unnest(ids || ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_data->'removed','[]'))::uuid)) x ORDER BY x LOOP
     SELECT to_jsonb(t) INTO before_row FROM assets t WHERE id=aid AND archived_at IS NULL FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'Ativo indisponível.'; END IF;
     IF aid=ANY(ids) THEN
       a:=jsonb_populate_record(NULL::assets,before_row || patch);
     ELSE a:=jsonb_populate_record(NULL::assets,before_row || '{"contract_number":null,"lease_start":null,"lease_end":null,"monthly_cost":null}'); END IF;
     UPDATE assets SET contract_number=a.contract_number,supplier=a.supplier,lease_start=a.lease_start,lease_end=a.lease_end,monthly_cost=a.monthly_cost WHERE id=aid;
     INSERT INTO audit_log(actor_id,action,entity,entity_id,details) VALUES(auth.uid(),'alterar_contrato','assets',aid,jsonb_build_object('antes',before_row,'depois',to_jsonb(a)));
   END LOOP;
   RETURN '{}'::jsonb;
 ELSIF p_action='inventory_missing' THEN
   sid:=(p_data->>'id')::uuid;
   SELECT * INTO s FROM inventory_sessions WHERE id=sid FOR UPDATE;
   IF s.status IS DISTINCT FROM 'encerrada' THEN RAISE EXCEPTION 'Encerre a conferência antes de registrar extravios.'; END IF;
   FOR aid IN SELECT (x->>'id')::uuid FROM jsonb_array_elements(s.snapshot) x WHERE NOT EXISTS(SELECT 1 FROM inventory_checks c WHERE c.session_id=sid AND c.asset_id=(x->>'id')::uuid) ORDER BY 1 LOOP
     SELECT * INTO a FROM assets WHERE id=aid FOR UPDATE;
     IF NOT FOUND OR a.archived_at IS NOT NULL THEN CONTINUE; END IF;
     IF a.status='em_uso' THEN RAISE EXCEPTION 'Há equipamento pendente com vínculo ativo. Registre a devolução ou resolva a ocorrência antes do extravio em lote.'; END IF;
     UPDATE assets SET status='extraviado' WHERE id=aid;
     n:=n+1;
     INSERT INTO audit_log(actor_id,action,entity,entity_id,details) VALUES(auth.uid(),'extravio_inventario','assets',aid,jsonb_build_object('session_id',sid,'antes',to_jsonb(a)));
   END LOOP;
   RETURN jsonb_build_object('count',n);
 ELSIF p_action='dispatch_finish' THEN
   aid:=(p_data->>'id')::uuid;
   PERFORM 1 FROM agreements WHERE id=aid AND dispatch_key=(p_data->>'key')::uuid FOR UPDATE;
   IF NOT FOUND OR COALESCE(trim(p_data->>'envelope_id'),'')='' THEN RAISE EXCEPTION 'Envio ou envelope inválido.'; END IF;
   UPDATE agreements SET status=CASE WHEN status='rascunho' THEN 'enviado'::agreement_status ELSE status END,sent_at=COALESCE(sent_at,now()),external_envelope_id=p_data->>'envelope_id',dispatch_state='enviado',dispatch_error=NULL WHERE id=aid;
   INSERT INTO integration_runs(provider,action,status,message,payload) VALUES('hermes','enviar_termo','sucesso','Envio confirmado',jsonb_build_object('agreement_id',aid,'envelope_id',p_data->>'envelope_id'));
   INSERT INTO audit_log(actor_id,action,entity,entity_id,details) VALUES(auth.uid(),'confirmar_envio','agreements',aid,p_data);
   RETURN '{}'::jsonb;
 ELSIF p_action='attach_signed' THEN
   aid:=(p_data->>'id')::uuid;
   PERFORM 1 FROM agreements WHERE id=aid FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Termo não encontrado.'; END IF;
   IF EXISTS(SELECT 1 FROM agreements WHERE id=aid AND signed_document_path=p_data->>'path') THEN RETURN '{}'::jsonb; END IF;
   IF EXISTS(SELECT 1 FROM agreements WHERE id=aid AND status='assinado') THEN RAISE EXCEPTION 'Este termo já possui assinatura. Atualize a tela.'; END IF;
   INSERT INTO documents(agreement_id,employee_id,asset_id,kind,file_name,storage_path,uploaded_by)
     SELECT id,employee_id,asset_id,'termo_assinado',p_data->>'name',p_data->>'path',auth.uid() FROM agreements WHERE id=aid;
   UPDATE agreements SET status='assinado',signed_at=now(),signed_document_path=p_data->>'path' WHERE id=aid;
   INSERT INTO audit_log(actor_id,action,entity,entity_id) VALUES(auth.uid(),'anexar_termo_assinado','agreements',aid);
   RETURN '{}'::jsonb;
 END IF;
 RAISE EXCEPTION 'Operação desconhecida.';
END $$;
REVOKE ALL ON FUNCTION public.qa_transaction(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qa_transaction(text,jsonb) TO authenticated;

CREATE FUNCTION public.set_access_roles_atomic(p_user uuid,p_roles text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Somente administradores.'; END IF;
 IF p_user=auth.uid() AND NOT ('admin'=ANY(p_roles)) THEN RAISE EXCEPTION 'Não remova seu próprio acesso de administrador.'; END IF;
 IF cardinality(p_roles)=0 OR EXISTS(SELECT 1 FROM unnest(p_roles) r WHERE r NOT IN ('admin','ti','gestor','colaborador')) THEN RAISE EXCEPTION 'Selecione papéis válidos.'; END IF;
 PERFORM 1 FROM profiles WHERE id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada.'; END IF;
 DELETE FROM user_roles WHERE user_id=p_user;
 INSERT INTO user_roles(user_id,role) SELECT p_user,r::app_role FROM (SELECT DISTINCT unnest(p_roles) r) x;
 INSERT INTO audit_log(actor_id,action,entity,entity_id,details) VALUES(auth.uid(),'atualizar_papeis','acessos',p_user,jsonb_build_object('roles',p_roles));
END $$;
REVOKE ALL ON FUNCTION public.set_access_roles_atomic(uuid,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_access_roles_atomic(uuid,text[]) TO authenticated;

ALTER TABLE public.agreements ADD COLUMN dispatch_key uuid, ADD COLUMN dispatch_state text, ADD COLUMN dispatch_error text;
CREATE FUNCTION public.claim_agreement_dispatch(p_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a agreements; k uuid;
BEGIN
 PERFORM qa_assert_operator();
 SELECT * INTO a FROM agreements WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Termo não encontrado.'; END IF;
 IF a.status<>'rascunho' OR a.dispatch_state IN ('processando','incerto','enviado') THEN RAISE EXCEPTION 'Envio já solicitado. Verifique o histórico e reconcilie com o agente antes de tentar novamente.'; END IF;
 k:=COALESCE(a.dispatch_key,gen_random_uuid());
 UPDATE agreements SET dispatch_key=k,dispatch_state='processando',dispatch_error=NULL WHERE id=p_id;
 RETURN k;
END $$;
REVOKE ALL ON FUNCTION public.claim_agreement_dispatch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_agreement_dispatch(uuid) TO authenticated;

ALTER TABLE public.import_batches ADD COLUMN status text NOT NULL DEFAULT 'concluido';
CREATE UNIQUE INDEX import_rows_batch_line ON public.import_rows(batch_id,row_number);
GRANT UPDATE ON public.import_rows TO authenticated;
CREATE POLICY "Atualizar lote QA" ON public.import_batches FOR UPDATE TO authenticated USING(public.is_operator(auth.uid())) WITH CHECK(public.is_operator(auth.uid()));
CREATE POLICY "Atualizar linha QA" ON public.import_rows FOR UPDATE TO authenticated USING(public.is_operator(auth.uid())) WITH CHECK(public.is_operator(auth.uid()));
CREATE FUNCTION public.prepare_import(p_id uuid,p_kind text,p_name text,p_rows jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 PERFORM qa_assert_operator();
 IF p_kind NOT IN ('ativos','colaboradores') OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)=0 THEN RAISE EXCEPTION 'Planilha inválida.'; END IF;
 INSERT INTO import_batches(id,kind,file_name,total_rows,created_by,status) VALUES(p_id,p_kind,p_name,jsonb_array_length(p_rows),auth.uid(),'preparado') ON CONFLICT(id) DO NOTHING;
 INSERT INTO import_rows(batch_id,row_number,payload,result) SELECT p_id,ordinality+1,value,'pendente' FROM jsonb_array_elements(p_rows) WITH ORDINALITY ON CONFLICT(batch_id,row_number) DO NOTHING;
 RETURN p_id;
END $$;
CREATE FUNCTION public.apply_import_row(p_batch uuid,p_line integer) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE b import_batches; r import_rows; t text; key text; cols text; allowed text[]; old_row jsonb; new_row jsonb; outcome text; msg text; target uuid;
BEGIN
 PERFORM qa_assert_operator();
 SELECT * INTO b FROM import_batches WHERE id=p_batch FOR UPDATE;
 SELECT * INTO r FROM import_rows WHERE batch_id=p_batch AND row_number=p_line FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Linha não encontrada.'; END IF;
 IF r.result IN ('criado','atualizado') THEN RETURN to_jsonb(r); END IF;
 UPDATE import_batches SET status='em_andamento' WHERE id=p_batch;
 BEGIN
   t:=CASE WHEN b.kind='ativos' THEN 'assets' ELSE 'employees' END;
   key:=CASE WHEN b.kind='ativos' THEN 'serial_number' ELSE 'email' END;
   allowed:=CASE WHEN b.kind='ativos' THEN ARRAY['serial_number','asset_type','brand','model','patrimony','imei','supplier','contract_number','location','last_seen_location','bitdefender_installed','monthly_cost','lease_start','lease_end'] ELSE ARRAY['full_name','email','cpf','phone','job_title','department','unit','manager_name'] END;
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(r.payload) k WHERE NOT(k=ANY(allowed))) OR COALESCE(r.payload->>key,'')='' THEN RAISE EXCEPTION 'Colunas ou identificador inválidos.'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(t || ':' || (r.payload->>key),0));
   EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE %I=$1 FOR UPDATE',t,key) INTO old_row USING r.payload->>key;
   IF old_row->>'archived_at' IS NOT NULL THEN RAISE EXCEPTION 'Cadastro arquivado. Restaure antes de importar.'; END IF;
   SELECT string_agg(format('%I',k),',') INTO cols FROM jsonb_object_keys(r.payload) k;
   IF old_row IS NULL THEN
     EXECUTE format('INSERT INTO %1$I (%2$s) SELECT %2$s FROM jsonb_populate_record(NULL::%1$I,$1) RETURNING to_jsonb(%1$I.*)',t,cols) INTO new_row USING r.payload;
     outcome:='criado';
   ELSE
     EXECUTE format('UPDATE %1$I SET (%2$s)=(SELECT %2$s FROM jsonb_populate_record(NULL::%1$I,$1)) WHERE id=$2 RETURNING to_jsonb(%1$I.*)',t,cols) INTO new_row USING r.payload,(old_row->>'id')::uuid;
     outcome:='atualizado';
   END IF;
   INSERT INTO audit_log(actor_id,action,entity,entity_id,details) VALUES(auth.uid(),'importar_linha',t,(new_row->>'id')::uuid,jsonb_build_object('batch_id',p_batch,'linha',p_line,'antes',old_row,'depois',new_row));
 EXCEPTION WHEN OTHERS THEN outcome:='erro'; msg:=SQLERRM;
 END;
 UPDATE import_rows SET result=outcome,message=msg WHERE id=r.id RETURNING * INTO r;
 UPDATE import_batches SET created_rows=(SELECT count(*) FROM import_rows WHERE batch_id=p_batch AND result='criado'),updated_rows=(SELECT count(*) FROM import_rows WHERE batch_id=p_batch AND result='atualizado'),failed_rows=(SELECT count(*) FROM import_rows WHERE batch_id=p_batch AND result='erro') WHERE id=p_batch;
 RETURN to_jsonb(r);
END $$;
CREATE FUNCTION public.finish_import(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 PERFORM qa_assert_operator();
 UPDATE import_batches SET status=CASE WHEN EXISTS(SELECT 1 FROM import_rows WHERE batch_id=p_id AND result='pendente') THEN 'interrompido' WHEN EXISTS(SELECT 1 FROM import_rows WHERE batch_id=p_id AND result='erro') THEN 'com_erros' ELSE 'concluido' END WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.prepare_import(uuid,text,text,jsonb),public.apply_import_row(uuid,integer),public.finish_import(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_import(uuid,text,text,jsonb),public.apply_import_row(uuid,integer),public.finish_import(uuid) TO authenticated;

CREATE VIEW public.agreements_list WITH (security_invoker=true) AS
 SELECT a.*,to_jsonb(e) employee,to_jsonb(t) asset,e.full_name employee_name,concat_ws(' ',t.brand,t.model,t.serial_number) asset_name,
 lower(translate(concat_ws(' ',e.full_name,e.email,t.serial_number,t.model),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')) search_text
 FROM public.agreements a LEFT JOIN public.employees e ON e.id=a.employee_id LEFT JOIN public.assets t ON t.id=a.asset_id;
CREATE VIEW public.inventory_sessions_list WITH (security_invoker=true) AS
 SELECT s.*,jsonb_build_array(jsonb_build_object('count',(SELECT count(*) FROM public.inventory_checks c WHERE c.session_id=s.id))) inventory_checks,
 lower(translate(s.name,'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')) search_text,(SELECT count(*) FROM public.inventory_checks c WHERE c.session_id=s.id) checks_count,COALESCE(s.scope->>'location','') || ' ' || COALESCE(s.scope->>'asset_type','') scope_text FROM public.inventory_sessions s;
CREATE VIEW public.audit_list WITH (security_invoker=true) AS
 SELECT a.*,lower(concat_ws(' ',a.actor_email,a.actor_id,a.action,a.entity,a.entity_id,a.details)) search_text FROM public.audit_log a;
CREATE VIEW public.agreement_statistics WITH (security_invoker=true) AS
 SELECT (SELECT count(*) FROM public.agreements WHERE status='assinado') signed,
 (SELECT count(*) FROM public.agreements WHERE status IN ('rascunho','enviado','visualizado')) pending,
 (SELECT count(*) FROM public.assignments WHERE status='ativo') active,
 (SELECT count(*) FROM public.assignments s WHERE s.status='ativo' AND EXISTS(SELECT 1 FROM public.agreements a WHERE a.assignment_id=s.id)) covered;
GRANT SELECT ON public.agreements_list,public.inventory_sessions_list,public.audit_list,public.agreement_statistics TO authenticated;

CREATE FUNCTION public.qa_assignment_metadata() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE atest boolean; etest boolean;
BEGIN
 SELECT is_test INTO atest FROM assets WHERE id=NEW.asset_id;
 SELECT is_test INTO etest FROM employees WHERE id=NEW.employee_id;
 IF atest IS DISTINCT FROM etest THEN RAISE EXCEPTION 'Registros de teste precisam corresponder.'; END IF;
 NEW.is_test:=COALESCE(atest,false); RETURN NEW;
END $$;
CREATE TRIGGER qa_assignment_metadata BEFORE INSERT ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.qa_assignment_metadata();
CREATE FUNCTION public.qa_agreement_metadata() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 SELECT is_test INTO NEW.is_test FROM assignments WHERE id=NEW.assignment_id; RETURN NEW;
END $$;
CREATE TRIGGER qa_agreement_metadata BEFORE INSERT ON public.agreements FOR EACH ROW EXECUTE FUNCTION public.qa_agreement_metadata();

CREATE FUNCTION public.finalize_access_invite(p_user uuid,p_email text,p_name text,p_roles text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Somente administradores.'; END IF;
 INSERT INTO profiles(id,email,full_name,status,invited_at) VALUES(p_user,p_email,p_name,'convidado',now()) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,full_name=EXCLUDED.full_name,status='convidado',invited_at=now();
 PERFORM set_access_roles_atomic(p_user,p_roles);
 INSERT INTO audit_log(actor_id,action,entity,entity_id,details) VALUES(auth.uid(),'convidar_acesso','acessos',p_user,jsonb_build_object('email',p_email));
END $$;
CREATE FUNCTION public.allow_email_atomic(p_email text,p_name text,p_roles text[],p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Somente administradores.'; END IF;
 IF p_email NOT LIKE '%@origoenergia.com.br' OR cardinality(p_roles)=0 OR EXISTS(SELECT 1 FROM unnest(p_roles) r WHERE r NOT IN ('admin','ti','gestor','colaborador')) THEN RAISE EXCEPTION 'E-mail ou papéis inválidos.'; END IF;
 INSERT INTO access_allowlist(email,full_name,roles,note,created_by) VALUES(p_email,nullif(p_name,''),p_roles::app_role[],nullif(p_note,''),auth.uid()) ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,roles=EXCLUDED.roles,note=EXCLUDED.note;
 SELECT id INTO target FROM profiles WHERE email=p_email FOR UPDATE;
 IF target IS NOT NULL THEN
   -- Auth may be banned: allowlisting does not imply reactivation.
   INSERT INTO user_roles(user_id,role) SELECT target,r::app_role FROM unnest(p_roles) r ON CONFLICT(user_id,role) DO NOTHING;
 END IF;
 UPDATE access_denied_attempts SET resolved_at=now() WHERE email=p_email;
 INSERT INTO audit_log(actor_id,action,entity,entity_id,details) VALUES(auth.uid(),'liberar_email','acessos',target,jsonb_build_object('email',p_email,'roles',p_roles));
END $$;
REVOKE ALL ON FUNCTION public.finalize_access_invite(uuid,text,text,text[]),public.allow_email_atomic(text,text,text[],text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_access_invite(uuid,text,text,text[]),public.allow_email_atomic(text,text,text[],text) TO authenticated;

-- The webhook runs as service_role after the HTTP shared secret is verified.
CREATE FUNCTION public.apply_signature_webhook(p_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a agreements; incoming text:=p_data->>'status'; new_path text:=p_data->>'path';
BEGIN
 SELECT * INTO a FROM agreements WHERE id=(p_data->>'id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Termo não encontrado.'; END IF;
 IF incoming NOT IN ('enviado','visualizado','assinado','recusado','expirado') THEN RAISE EXCEPTION 'Situação inválida.'; END IF;
 IF a.external_envelope_id IS NOT NULL AND p_data->>'envelope_id' IS NOT NULL AND a.external_envelope_id<>p_data->>'envelope_id' THEN RAISE EXCEPTION 'Envelope não corresponde ao termo.'; END IF;
 IF a.status='assinado' AND incoming<>'assinado' THEN RETURN; END IF;
 IF a.status IN ('recusado','expirado','visualizado') AND incoming='enviado' THEN RETURN; END IF;
 IF a.status IN ('recusado','expirado') AND incoming='visualizado' THEN RETURN; END IF;
 IF new_path IS NOT NULL THEN
   IF a.signed_document_path IS NOT NULL AND a.signed_document_path<>new_path THEN RAISE EXCEPTION 'Documento assinado já registrado; concilie antes de substituir.'; END IF;
   IF NOT EXISTS(SELECT 1 FROM documents WHERE agreement_id=a.id AND storage_path=new_path) THEN
     INSERT INTO documents(agreement_id,asset_id,employee_id,kind,file_name,storage_path,is_test) VALUES(a.id,a.asset_id,a.employee_id,'termo_assinado',p_data->>'name',new_path,a.is_test);
   END IF;
 END IF;
 IF a.status::text=incoming AND a.signed_document_path IS NOT DISTINCT FROM COALESCE(new_path,a.signed_document_path) AND a.external_envelope_id IS NOT DISTINCT FROM COALESCE(p_data->>'envelope_id',a.external_envelope_id) THEN RETURN; END IF;
 UPDATE agreements SET status=incoming::agreement_status,external_envelope_id=COALESCE(p_data->>'envelope_id',external_envelope_id),declined_reason=COALESCE(p_data->>'declined_reason',declined_reason),viewed_at=CASE WHEN incoming='visualizado' THEN COALESCE(viewed_at,now()) ELSE viewed_at END,signed_at=CASE WHEN incoming='assinado' THEN COALESCE(signed_at,now()) ELSE signed_at END,signed_document_path=COALESCE(new_path,signed_document_path),dispatch_state=CASE WHEN dispatch_key IS NOT NULL THEN 'enviado' ELSE dispatch_state END,dispatch_error=NULL WHERE id=a.id;
 INSERT INTO integration_runs(provider,action,status,message) VALUES('hermes','webhook_assinatura','sucesso','Retorno de assinatura registrado: '||a.id);
 INSERT INTO audit_log(action,entity,entity_id,details) VALUES('retorno_assinatura','agreements',a.id,jsonb_build_object('antes',a.status,'depois',incoming,'envelope_id',p_data->>'envelope_id'));
END $$;
REVOKE ALL ON FUNCTION public.apply_signature_webhook(jsonb) FROM PUBLIC;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN GRANT EXECUTE ON FUNCTION public.apply_signature_webhook(jsonb) TO service_role; END IF; END $$;
