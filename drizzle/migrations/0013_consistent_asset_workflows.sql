-- Apply before deploying the corresponding frontend. Never deletes existing records.
ALTER TABLE public.assets ADD COLUMN archived_at timestamptz;
ALTER TABLE public.employees ADD COLUMN archived_at timestamptz;

CREATE UNIQUE INDEX assignments_one_active_per_asset
  ON public.assignments(asset_id) WHERE status = 'ativo';

CREATE FUNCTION public.create_assignment_complete(
  p_id uuid, p_asset_id uuid, p_employee_id uuid, p_assigned_at timestamptz,
  p_delivery_condition text, p_notes text, p_template_id uuid, p_content text,
  p_items jsonb, p_photos text[]
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_operator(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores e TI podem registrar entregas.';
  END IF;
  PERFORM 1 FROM employees WHERE id = p_employee_id AND status = 'ativo' AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador indisponível ou arquivado.'; END IF;
  PERFORM 1 FROM assets WHERE id = p_asset_id AND status = 'disponivel' AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'O equipamento não está mais disponível.'; END IF;
  IF p_assigned_at IS NULL OR p_template_id IS NULL OR NULLIF(trim(p_content), '') IS NULL
     OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Informe data, modelo de termo, conteúdo e checklist.';
  END IF;
  PERFORM 1 FROM agreement_templates WHERE id = p_template_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Modelo de termo não encontrado.'; END IF;
  INSERT INTO assignments(id,asset_id,employee_id,assigned_at,delivery_condition,notes,created_by)
    VALUES(p_id,p_asset_id,p_employee_id,p_assigned_at,p_delivery_condition,p_notes,auth.uid());
  UPDATE assets SET status = 'em_uso' WHERE id = p_asset_id;
  INSERT INTO agreements(assignment_id,asset_id,employee_id,template_id,content,status)
    VALUES(p_id,p_asset_id,p_employee_id,p_template_id,p_content,'rascunho');
  INSERT INTO assignment_checklists(assignment_id,kind,items,photos,created_by)
    VALUES(p_id,'entrega',p_items,COALESCE(p_photos, ARRAY[]::text[]),auth.uid());
  INSERT INTO audit_log(actor_id,action,entity,entity_id)
    VALUES(auth.uid(),'vincular','assignments',p_id);
  RETURN p_id;
END $$;

CREATE FUNCTION public.close_assignment_complete(p_id uuid, p_condition text, p_items jsonb, p_photos text[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_asset uuid; v_employee uuid; v_assignment assignments;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_operator(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores e TI podem registrar devoluções.';
  END IF;
  SELECT asset_id,employee_id INTO v_asset,v_employee FROM assignments WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vínculo não encontrado.'; END IF;
  PERFORM 1 FROM employees WHERE id = v_employee FOR UPDATE;
  PERFORM 1 FROM assets WHERE id = v_asset FOR UPDATE;
  SELECT * INTO v_assignment FROM assignments WHERE id = p_id FOR UPDATE;
  IF v_assignment.status <> 'ativo' THEN RAISE EXCEPTION 'Este vínculo já foi encerrado.'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Informe o checklist.'; END IF;
  UPDATE assignments SET status='encerrado', returned_at=now(), return_condition=p_condition WHERE id=p_id;
  UPDATE assets SET status='disponivel' WHERE id=v_asset;
  INSERT INTO assignment_checklists(assignment_id,kind,items,photos,created_by)
    VALUES(p_id,'devolucao',p_items,COALESCE(p_photos, ARRAY[]::text[]),auth.uid());
  INSERT INTO audit_log(actor_id,action,entity,entity_id)
    VALUES(auth.uid(),'devolver','assignments',p_id);
END $$;

CREATE FUNCTION public.archive_entities(p_entity text, p_ids uuid[], p_restore boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_operator(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores e TI podem arquivar cadastros.';
  END IF;
  IF p_entity NOT IN ('assets','employees') OR p_entity IS NULL OR COALESCE(cardinality(p_ids),0)=0 THEN
    RAISE EXCEPTION 'Selecione os cadastros.';
  END IF;
  FOR v_id IN SELECT DISTINCT unnest(p_ids) ORDER BY 1 LOOP
    IF p_entity='employees' THEN
      PERFORM 1 FROM employees WHERE id=v_id FOR UPDATE;
    ELSE
      PERFORM 1 FROM assets WHERE id=v_id FOR UPDATE;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado ou sem permissão.'; END IF;
    IF NOT p_restore AND EXISTS(SELECT 1 FROM assignments WHERE status='ativo' AND
      ((p_entity='assets' AND asset_id=v_id) OR (p_entity='employees' AND employee_id=v_id))) THEN
      RAISE EXCEPTION 'Registre a devolução dos equipamentos antes de arquivar.';
    END IF;
    IF p_entity='employees' THEN
      UPDATE employees SET archived_at=CASE WHEN p_restore THEN NULL ELSE now() END WHERE id=v_id;
    ELSE
      UPDATE assets SET archived_at=CASE WHEN p_restore THEN NULL ELSE now() END WHERE id=v_id;
    END IF;
    INSERT INTO audit_log(actor_id,action,entity,entity_id)
      VALUES(auth.uid(),CASE WHEN p_restore THEN 'restaurar' ELSE 'arquivar' END,p_entity,v_id);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.create_assignment_complete(uuid,uuid,uuid,timestamptz,text,text,uuid,text,jsonb,text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_assignment_complete(uuid,text,jsonb,text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_entities(text,uuid[],boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_assignment_complete(uuid,uuid,uuid,timestamptz,text,text,uuid,text,jsonb,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_assignment_complete(uuid,text,jsonb,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_entities(text,uuid[],boolean) TO authenticated;

-- Prevent old clients from deleting the history after this migration.
REVOKE DELETE ON public.assets, public.employees FROM authenticated;

CREATE VIEW public.assets_list WITH (security_invoker=true) AS
SELECT a.*, COALESCE(x.assignments,'[]'::jsonb) assignments, x.holder_name,
  COALESCE(t.tag_ids,ARRAY[]::uuid[]) tag_ids,
  lower(translate(concat_ws(' ',a.serial_number,a.brand,a.model,a.patrimony,a.imei,a.location,a.last_seen_location,x.holder_name),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) search_text
FROM public.assets a
LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object('id',s.id,'status',s.status,'employee',jsonb_build_object('id',e.id,'full_name',e.full_name))) assignments,
    max(e.full_name) FILTER(WHERE s.status='ativo') holder_name
  FROM public.assignments s LEFT JOIN public.employees e ON e.id=s.employee_id WHERE s.asset_id=a.id
) x ON true
LEFT JOIN LATERAL (SELECT array_agg(tag_id) tag_ids FROM public.asset_tags WHERE asset_id=a.id) t ON true;

CREATE VIEW public.employees_list WITH (security_invoker=true) AS
SELECT e.*, COALESCE(x.assignments,'[]'::jsonb) assignments, x.active_count,
  lower(translate(concat_ws(' ',e.full_name,e.email,e.department,e.job_title,e.unit),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) search_text
FROM public.employees e LEFT JOIN LATERAL (
 SELECT count(*) FILTER(WHERE s.status='ativo') active_count,
 jsonb_agg(jsonb_build_object('id',s.id,'status',s.status,'asset',jsonb_build_object('serial_number',a.serial_number,'brand',a.brand,'model',a.model))) assignments
 FROM public.assignments s LEFT JOIN public.assets a ON a.id=s.asset_id WHERE s.employee_id=e.id
) x ON true;

CREATE VIEW public.assignments_list WITH (security_invoker=true) AS
SELECT s.*, jsonb_build_object('id',e.id,'full_name',e.full_name,'email',e.email) employee,
  jsonb_build_object('id',a.id,'serial_number',a.serial_number,'brand',a.brand,'model',a.model) asset,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',g.id,'status',g.status)) FROM public.agreements g WHERE g.assignment_id=s.id),'[]'::jsonb) agreements,
  e.full_name employee_name, concat_ws(' ',a.brand,a.model,a.serial_number) asset_name,
  lower(translate(concat_ws(' ',e.full_name,e.email,a.serial_number,a.brand,a.model),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) search_text
FROM public.assignments s JOIN public.employees e ON e.id=s.employee_id JOIN public.assets a ON a.id=s.asset_id;
GRANT SELECT ON public.assets_list,public.employees_list,public.assignments_list TO authenticated;
