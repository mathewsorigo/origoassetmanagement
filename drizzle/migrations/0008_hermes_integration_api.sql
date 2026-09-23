ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS entra_user_id text;
CREATE UNIQUE INDEX IF NOT EXISTS employees_entra_user_id_key ON public.employees(entra_user_id) WHERE entra_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS assets_intune_device_id_key ON public.assets(intune_device_id) WHERE intune_device_id IS NOT NULL;

CREATE TABLE public.hermes_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  correlation_id text NOT NULL,
  batch_id text,
  operation text NOT NULL,
  request_hash text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  response jsonb,
  status_code int NOT NULL DEFAULT 200,
  reverted_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hermes_operations_batch_idx ON public.hermes_operations(batch_id);
CREATE INDEX hermes_operations_corr_idx ON public.hermes_operations(correlation_id);
GRANT SELECT, INSERT, UPDATE ON public.hermes_operations TO authenticated;
GRANT ALL ON public.hermes_operations TO service_role;
ALTER TABLE public.hermes_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura operacoes hermes" ON public.hermes_operations FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "Insert operacoes hermes" ON public.hermes_operations FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "Update operacoes hermes" ON public.hermes_operations FOR UPDATE TO authenticated USING (public.is_operator(auth.uid()));