-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'ti', 'gestor', 'colaborador');
CREATE TYPE public.asset_type AS ENUM ('notebook', 'celular', 'monitor', 'acessorio', 'outro');
CREATE TYPE public.asset_status AS ENUM ('disponivel', 'em_uso', 'manutencao', 'devolvido', 'extraviado');
CREATE TYPE public.assignment_status AS ENUM ('ativo', 'encerrado');
CREATE TYPE public.agreement_status AS ENUM ('rascunho', 'enviado', 'visualizado', 'assinado', 'recusado', 'expirado');
CREATE TYPE public.employee_status AS ENUM ('ativo', 'inativo', 'afastado');

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','ti','gestor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_operator(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','ti')
  );
$$;

-- Auto profile on signup + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  existing_count int;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO existing_count FROM public.user_roles;
  IF existing_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'colaborador') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "Ver proprio perfil" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_manager(auth.uid()));
CREATE POLICY "Atualizar proprio perfil" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_operator(auth.uid()));
CREATE POLICY "Admin insere perfil" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid() OR public.is_operator(auth.uid()));

CREATE POLICY "Ver proprios papeis" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_manager(auth.uid()));

-- Employees (colaboradores)
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  cpf text,
  job_title text,
  department text,
  unit text,
  manager_name text,
  phone text,
  status public.employee_status NOT NULL DEFAULT 'ativo',
  intune_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura colaboradores" ON public.employees FOR SELECT TO authenticated
USING (public.is_manager(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Escrita colaboradores" ON public.employees FOR INSERT TO authenticated
WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "Update colaboradores" ON public.employees FOR UPDATE TO authenticated
USING (public.is_operator(auth.uid()));
CREATE POLICY "Delete colaboradores" ON public.employees FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Assets
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type public.asset_type NOT NULL DEFAULT 'notebook',
  brand text,
  model text,
  serial_number text NOT NULL UNIQUE,
  patrimony text,
  imei text,
  supplier text DEFAULT 'Simpress',
  contract_number text,
  lease_start date,
  lease_end date,
  monthly_cost numeric(12,2),
  condition text,
  location text,
  status public.asset_status NOT NULL DEFAULT 'disponivel',
  intune_device_id text,
  intune_last_sync timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura ativos" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert ativos" ON public.assets FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "Update ativos" ON public.assets FOR UPDATE TO authenticated USING (public.is_operator(auth.uid()));
CREATE POLICY "Delete ativos" ON public.assets FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Agreement templates
CREATE TABLE public.agreement_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agreement_templates TO authenticated;
GRANT ALL ON public.agreement_templates TO service_role;
ALTER TABLE public.agreement_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura modelos" ON public.agreement_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escrita modelos" ON public.agreement_templates FOR ALL TO authenticated
USING (public.is_operator(auth.uid())) WITH CHECK (public.is_operator(auth.uid()));

-- Assignments
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status public.assignment_status NOT NULL DEFAULT 'ativo',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz,
  delivery_condition text,
  return_condition text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura vinculos" ON public.assignments FOR SELECT TO authenticated
USING (public.is_manager(auth.uid()) OR EXISTS (
  SELECT 1 FROM public.employees e WHERE e.id = assignments.employee_id AND e.user_id = auth.uid()
));
CREATE POLICY "Insert vinculos" ON public.assignments FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "Update vinculos" ON public.assignments FOR UPDATE TO authenticated USING (public.is_operator(auth.uid()));
CREATE POLICY "Delete vinculos" ON public.assignments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Agreements (termos de uso)
CREATE TABLE public.agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.agreement_templates(id),
  status public.agreement_status NOT NULL DEFAULT 'rascunho',
  content text NOT NULL,
  provider text NOT NULL DEFAULT 'docusign',
  external_envelope_id text,
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_reason text,
  signed_document_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agreements TO authenticated;
GRANT ALL ON public.agreements TO service_role;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura termos" ON public.agreements FOR SELECT TO authenticated
USING (public.is_manager(auth.uid()) OR EXISTS (
  SELECT 1 FROM public.employees e WHERE e.id = agreements.employee_id AND e.user_id = auth.uid()
));
CREATE POLICY "Insert termos" ON public.agreements FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "Update termos" ON public.agreements FOR UPDATE TO authenticated USING (public.is_operator(auth.uid()));
CREATE POLICY "Delete termos" ON public.agreements FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Documents
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid REFERENCES public.agreements(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  kind text NOT NULL DEFAULT 'termo_assinado',
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura documentos" ON public.documents FOR SELECT TO authenticated
USING (public.is_manager(auth.uid()) OR EXISTS (
  SELECT 1 FROM public.employees e WHERE e.id = documents.employee_id AND e.user_id = auth.uid()
));
CREATE POLICY "Insert documentos" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "Delete documentos" ON public.documents FOR DELETE TO authenticated USING (public.is_operator(auth.uid()));

-- Imports
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  file_name text,
  total_rows int NOT NULL DEFAULT 0,
  created_rows int NOT NULL DEFAULT 0,
  updated_rows int NOT NULL DEFAULT 0,
  failed_rows int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura importacoes" ON public.import_batches FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "Insert importacoes" ON public.import_batches FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));

CREATE TABLE public.import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number int NOT NULL,
  payload jsonb NOT NULL,
  result text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.import_rows TO authenticated;
GRANT ALL ON public.import_rows TO service_role;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura linhas importacao" ON public.import_rows FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "Insert linhas importacao" ON public.import_rows FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));

-- Integrations
CREATE TABLE public.integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  base_url text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  last_status text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.integration_settings TO authenticated;
GRANT ALL ON public.integration_settings TO service_role;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura integracoes" ON public.integration_settings FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "Escrita integracoes" ON public.integration_settings FOR ALL TO authenticated
USING (public.is_operator(auth.uid())) WITH CHECK (public.is_operator(auth.uid()));

CREATE TABLE public.integration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  action text NOT NULL,
  status text NOT NULL,
  message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.integration_runs TO authenticated;
GRANT ALL ON public.integration_runs TO service_role;
ALTER TABLE public.integration_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura execucoes" ON public.integration_runs FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "Insert execucoes" ON public.integration_runs FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));

-- Audit log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura auditoria" ON public.audit_log FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "Insert auditoria" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_employees_upd BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_assets_upd BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_assignments_upd BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_agreements_upd BEFORE UPDATE ON public.agreements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_templates_upd BEFORE UPDATE ON public.agreement_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed template + integrations
INSERT INTO public.agreement_templates (name, body, is_default) VALUES (
'Termo de Responsabilidade de Uso de Equipamento',
'TERMO DE RESPONSABILIDADE DE USO DE EQUIPAMENTO

Eu, {{colaborador_nome}}, CPF {{colaborador_cpf}}, e-mail {{colaborador_email}}, ocupante do cargo de {{colaborador_cargo}} na area {{colaborador_area}} da ORIGO ENERGIA, declaro ter recebido em {{data_entrega}} o equipamento abaixo descrito, locado junto ao fornecedor {{fornecedor}}:

Tipo: {{ativo_tipo}}
Marca/Modelo: {{ativo_marca}} {{ativo_modelo}}
Numero de serie: {{ativo_serie}}
Patrimonio: {{ativo_patrimonio}}
IMEI: {{ativo_imei}}
Condicao de entrega: {{condicao_entrega}}

Declaro que:
1. O equipamento e de propriedade/locacao da Origo Energia e destina-se exclusivamente ao uso profissional.
2. Comprometo-me a zelar pela guarda e conservacao do equipamento, comunicando imediatamente qualquer dano, furto, roubo ou perda.
3. Autorizo o gerenciamento do dispositivo pelas ferramentas corporativas de seguranca e inventario.
4. Devolverei o equipamento em perfeito estado de funcionamento ao termino do vinculo ou quando solicitado.

{{data_hoje}}

{{colaborador_nome}}', true);

INSERT INTO public.integration_settings (provider, label, enabled) VALUES
('hermes','Hermes Agent', false),
('docusign','Docusign', false),
('intune','Microsoft Intune', false),
('simpress','Simpress', false);