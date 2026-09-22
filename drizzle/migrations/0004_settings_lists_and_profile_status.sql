DO $$ BEGIN
  CREATE TYPE public.profile_status AS ENUM ('ativo','convidado','desativado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status public.profile_status NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;

CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['locations','departments','vendors'] LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS "Leitura %1$s" ON public.%1$s;
      CREATE POLICY "Leitura %1$s" ON public.%1$s FOR SELECT TO authenticated
        USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));
      DROP POLICY IF EXISTS "Gerir %1$s" ON public.%1$s;
      CREATE POLICY "Gerir %1$s" ON public.%1$s FOR ALL TO authenticated
        USING (public.is_operator(auth.uid())) WITH CHECK (public.is_operator(auth.uid()));
    $f$, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Leitura configuracoes" ON public.app_settings;
CREATE POLICY "Leitura configuracoes" ON public.app_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));
DROP POLICY IF EXISTS "Gerir configuracoes" ON public.app_settings;
CREATE POLICY "Gerir configuracoes" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.app_settings (key, value) VALUES
  ('termos', '{"prazo_dias": 7, "email_assunto": "Termo de responsabilidade de equipamento", "email_mensagem": "Ola, {{colaborador_nome}}. Assine o termo de responsabilidade do equipamento entregue a voce.", "lembrete_dias": 3, "lembrete_ativo": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.locations (name)
  SELECT DISTINCT trim(location) FROM public.assets WHERE location IS NOT NULL AND trim(location) <> ''
ON CONFLICT (name) DO NOTHING;
INSERT INTO public.vendors (name)
  SELECT DISTINCT trim(supplier) FROM public.assets WHERE supplier IS NOT NULL AND trim(supplier) <> ''
ON CONFLICT (name) DO NOTHING;
INSERT INTO public.vendors (name) VALUES ('Simpress') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.departments (name)
  SELECT DISTINCT trim(department) FROM public.employees WHERE department IS NOT NULL AND trim(department) <> ''
ON CONFLICT (name) DO NOTHING;