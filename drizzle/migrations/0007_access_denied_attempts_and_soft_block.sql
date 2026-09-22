CREATE TABLE public.access_denied_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  reason text NOT NULL DEFAULT 'nao_liberado',
  attempts int NOT NULL DEFAULT 1,
  first_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (email)
);

GRANT SELECT ON public.access_denied_attempts TO authenticated;
GRANT ALL ON public.access_denied_attempts TO service_role;

ALTER TABLE public.access_denied_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins leem tentativas recusadas"
ON public.access_denied_attempts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_count int;
  v_email text;
  v_name text;
  v_allow public.access_allowlist;
  v_role public.app_role;
  v_blocked boolean := false;
BEGIN
  v_email := lower(coalesce(NEW.email, ''));
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.email
  );
  SELECT count(*) INTO existing_count FROM public.user_roles;

  IF existing_count > 0 THEN
    IF v_email NOT LIKE '%@origoenergia.com.br' THEN
      RAISE EXCEPTION 'Acesso permitido apenas para e-mails @origoenergia.com.br';
    END IF;

    SELECT * INTO v_allow FROM public.access_allowlist WHERE email = v_email;
    IF v_allow.id IS NULL THEN
      v_blocked := true;
      INSERT INTO public.access_denied_attempts (email, full_name, reason)
      VALUES (v_email, v_name, 'nao_liberado')
      ON CONFLICT (email) DO UPDATE
        SET attempts = public.access_denied_attempts.attempts + 1,
            last_attempt_at = now(),
            full_name = COALESCE(EXCLUDED.full_name, public.access_denied_attempts.full_name),
            resolved_at = NULL;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', v_allow.full_name, NEW.email),
    CASE WHEN v_blocked THEN 'desativado'::public.profile_status ELSE 'ativo'::public.profile_status END
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_blocked THEN
    RETURN NEW;
  END IF;

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
$function$;