-- Apply transactionally before frontend/API. Existing agreements are untouched.
ALTER TABLE public.assignments ADD COLUMN assignment_kind text NOT NULL DEFAULT 'physical_delivery'
  CHECK (assignment_kind IN ('physical_delivery','administrative'));
COMMENT ON COLUMN public.assignments.assignment_kind IS 'Administrative records do not attest physical delivery; legacy records retain original physical workflow classification.';

DROP FUNCTION public.create_assignment_complete(uuid,uuid,uuid,timestamptz,text,text,uuid,text,jsonb,text[]);
CREATE FUNCTION public.create_assignment_complete(
  p_id uuid, p_asset_id uuid, p_employee_id uuid, p_assigned_at timestamptz,
  p_delivery_condition text, p_notes text, p_template_id uuid, p_content text,
  p_items jsonb, p_photos text[], p_create_agreement boolean DEFAULT false,
  p_assignment_kind text DEFAULT 'physical_delivery'
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_operator(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores e TI podem registrar entregas.';
  END IF;
  PERFORM 1 FROM employees WHERE id = p_employee_id AND (status = 'ativo' OR (status = 'inativo' AND p_assignment_kind = 'administrative')) AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador indisponível ou arquivado.'; END IF;
  PERFORM 1 FROM assets WHERE id = p_asset_id AND status = 'disponivel' AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'O equipamento não está mais disponível.'; END IF;
  IF p_assigned_at IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Informe data e checklist.';
  END IF;
  IF p_create_agreement THEN
    IF NULLIF(trim(p_content), '') IS NULL THEN RAISE EXCEPTION 'Informe o conteúdo do termo.'; END IF;
    PERFORM 1 FROM agreement_templates WHERE id = p_template_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Modelo de termo não encontrado.'; END IF;
  END IF;
  INSERT INTO assignments(id,asset_id,employee_id,assigned_at,delivery_condition,notes,created_by,assignment_kind)
    VALUES(p_id,p_asset_id,p_employee_id,p_assigned_at,p_delivery_condition,p_notes,auth.uid(),p_assignment_kind);
  UPDATE assets SET status = 'em_uso' WHERE id = p_asset_id;
  IF p_create_agreement THEN
  INSERT INTO agreements(assignment_id,asset_id,employee_id,template_id,content,status)
    VALUES(p_id,p_asset_id,p_employee_id,p_template_id,p_content,'rascunho');
  END IF;
  INSERT INTO assignment_checklists(assignment_id,kind,items,photos,created_by)
    VALUES(p_id,'entrega',p_items,COALESCE(p_photos, ARRAY[]::text[]),auth.uid());
  INSERT INTO audit_log(actor_id,action,entity,entity_id,details)
    VALUES(auth.uid(),'vincular','assignments',p_id,jsonb_build_object('assignment_kind',p_assignment_kind,'create_agreement',COALESCE(p_create_agreement,false)));
  RETURN p_id;
END $$;

REVOKE ALL ON FUNCTION public.create_assignment_complete(uuid,uuid,uuid,timestamptz,text,text,uuid,text,jsonb,text[],boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_assignment_complete(uuid,uuid,uuid,timestamptz,text,text,uuid,text,jsonb,text[],boolean,text) TO authenticated;

-- Enforce eligibility for direct writes and reopening too, without rewriting history.
CREATE FUNCTION public.validate_assignment_policy() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.assignment_kind IS DISTINCT FROM OLD.assignment_kind THEN RAISE EXCEPTION 'O tipo do vínculo é imutável; encerre e crie outro.'; END IF;
   IF NEW.employee_id=OLD.employee_id AND NEW.status=OLD.status THEN RETURN NEW; END IF;
 END IF;
 IF NEW.status='ativo' THEN
   PERFORM 1 FROM employees WHERE id=NEW.employee_id AND archived_at IS NULL
     AND (status='ativo' OR (status='inativo' AND NEW.assignment_kind='administrative')) FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador indisponível ou arquivado para este tipo de vínculo.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_assignment_policy BEFORE INSERT OR UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.validate_assignment_policy();
CREATE FUNCTION public.validate_employee_archive() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NEW.archived_at IS NOT NULL AND EXISTS(SELECT 1 FROM assignments WHERE employee_id=NEW.id AND status='ativo') THEN
   RAISE EXCEPTION 'Encerre os vínculos antes de arquivar o colaborador.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_employee_archive BEFORE UPDATE OF archived_at ON public.employees FOR EACH ROW EXECUTE FUNCTION public.validate_employee_archive();

-- Forward explicit policy options inside the existing atomic transfer.
CREATE OR REPLACE FUNCTION public.qa_transaction(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
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
   rid:=create_assignment_complete((p_data->>'new_id')::uuid,prev.asset_id,eid,COALESCE((p_data->>'assigned_at')::timestamptz,now()),p_data->>'condition',p_data->>'notes',(p_data->>'template_id')::uuid,p_data->>'content',p_data->'items','{}',COALESCE((p_data->>'create_agreement')::boolean,false),COALESCE(p_data->>'assignment_kind','physical_delivery'));
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


CREATE OR REPLACE VIEW public.assignments_list WITH (security_invoker=true) AS
SELECT s.id, s.asset_id, s.employee_id, s.status, s.assigned_at, s.returned_at, s.delivery_condition, s.return_condition, s.notes, s.created_by, s.created_at, s.updated_at, s.is_test, jsonb_build_object('id',e.id,'full_name',e.full_name,'email',e.email) employee,
  jsonb_build_object('id',a.id,'serial_number',a.serial_number,'brand',a.brand,'model',a.model) asset,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',g.id,'status',g.status)) FROM public.agreements g WHERE g.assignment_id=s.id),'[]'::jsonb) agreements,
  e.full_name employee_name, concat_ws(' ',a.brand,a.model,a.serial_number) asset_name,
  lower(translate(concat_ws(' ',e.full_name,e.email,a.serial_number,a.brand,a.model),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) search_text, s.assignment_kind
FROM public.assignments s JOIN public.employees e ON e.id=s.employee_id JOIN public.assets a ON a.id=s.asset_id;
