ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.inventory_sessions ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE TABLE public.hermes_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method text NOT NULL,
  path text NOT NULL,
  status_code integer,
  correlation_id text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hermes_request_log_created_idx ON public.hermes_request_log (created_at DESC);
GRANT SELECT, INSERT ON public.hermes_request_log TO authenticated;
GRANT ALL ON public.hermes_request_log TO service_role;
ALTER TABLE public.hermes_request_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura log hermes" ON public.hermes_request_log FOR SELECT TO authenticated USING (public.is_operator(auth.uid()));
CREATE POLICY "Insert log hermes" ON public.hermes_request_log FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));