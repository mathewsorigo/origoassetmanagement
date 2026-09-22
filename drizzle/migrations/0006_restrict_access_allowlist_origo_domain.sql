CREATE TABLE public.access_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text,
  roles public.app_role[] NOT NULL DEFAULT ARRAY['colaborador']::public.app_role[],
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_allowlist TO authenticated;
GRANT ALL ON public.access_allowlist TO service_role;

ALTER TABLE public.access_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin ve liberados" ON public.access_allowlist FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insere liberados" ON public.access_allowlist FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza liberados" ON public.access_allowlist FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin remove liberados" ON public.access_allowlist FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- quem ja tem acesso hoje continua liberado
INSERT INTO public.access_allowlist (email, full_name)
SELECT lower(p.email), p.full_name
FROM public.profiles p
WHERE p.email IS NOT NULL AND p.email <> ''
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  existing_count int;
  v_email text;
  v_allow public.access_allowlist;
  v_role public.app_role;
BEGIN
  v_email := lower(coalesce(NEW.email, ''));
  SELECT count(*) INTO existing_count FROM public.user_roles;

  IF existing_count > 0 THEN
    IF v_email NOT LIKE '%@origoenergia.com.br' THEN
      RAISE EXCEPTION 'Acesso permitido apenas para e-mails @origoenergia.com.br';
    END IF;

    SELECT * INTO v_allow FROM public.access_allowlist WHERE email = v_email;
    IF v_allow.id IS NULL THEN
      RAISE EXCEPTION 'Este e-mail nao esta liberado para acessar o sistema. Solicite a liberacao a um administrador.';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      v_allow.full_name,
      NEW.email
    )
  )
  ON CONFLICT (id) DO NOTHING;

  IF existing_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSIF v_allow.roles IS NOT NULL AND array_length(v_allow.roles, 1) > 0 THEN
    FOREACH v_role IN ARRAY v_allow.roles LOOP
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role) ON CONFLICT DO NOTHING;
    END LOOP;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'colaborador') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;