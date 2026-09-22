-- Sessões de inventário físico (conferência com QR Code)
CREATE TABLE public.inventory_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'aberta',
  created_by uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_sessions TO authenticated;
GRANT ALL ON public.inventory_sessions TO service_role;
ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura sessoes inventario" ON public.inventory_sessions FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "Gerir sessoes inventario" ON public.inventory_sessions FOR ALL TO authenticated USING (public.is_operator(auth.uid())) WITH CHECK (public.is_operator(auth.uid()));

-- Itens conferidos em uma sessão
CREATE TABLE public.inventory_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.inventory_sessions(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid,
  divergencia text,
  UNIQUE (session_id, asset_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_checks TO authenticated;
GRANT ALL ON public.inventory_checks TO service_role;
ALTER TABLE public.inventory_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura conferencias" ON public.inventory_checks FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "Registrar conferencias" ON public.inventory_checks FOR ALL TO authenticated USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));

-- Checklist de condição na entrega/devolução
CREATE TABLE public.assignment_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'entrega',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  photos text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_checklists TO authenticated;
GRANT ALL ON public.assignment_checklists TO service_role;
ALTER TABLE public.assignment_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura checklists" ON public.assignment_checklists FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "Escrita checklists" ON public.assignment_checklists FOR ALL TO authenticated USING (public.is_operator(auth.uid())) WITH CHECK (public.is_operator(auth.uid()));

-- Registro de cobranças de termos pendentes
CREATE TABLE public.agreement_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now(),
  note text
);
GRANT SELECT, INSERT, DELETE ON public.agreement_reminders TO authenticated;
GRANT ALL ON public.agreement_reminders TO service_role;
ALTER TABLE public.agreement_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura cobrancas" ON public.agreement_reminders FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "Registrar cobrancas" ON public.agreement_reminders FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
