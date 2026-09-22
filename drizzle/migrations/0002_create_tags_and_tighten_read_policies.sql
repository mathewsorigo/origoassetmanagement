-- Etiquetas (tags) para equipamentos
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT 'turquesa',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura etiquetas" ON public.tags
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escrita etiquetas" ON public.tags
  FOR ALL TO authenticated
  USING (public.is_operator(auth.uid()))
  WITH CHECK (public.is_operator(auth.uid()));

CREATE TABLE public.asset_tags (
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, tag_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_tags TO authenticated;
GRANT ALL ON public.asset_tags TO service_role;

ALTER TABLE public.asset_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura etiquetas do ativo" ON public.asset_tags
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escrita etiquetas do ativo" ON public.asset_tags
  FOR ALL TO authenticated
  USING (public.is_operator(auth.uid()))
  WITH CHECK (public.is_operator(auth.uid()));

-- Fechar leitura irrestrita: apenas usuarios com papel atribuido podem ler o inventario e os modelos
DROP POLICY IF EXISTS "Leitura ativos" ON public.assets;
CREATE POLICY "Leitura ativos" ON public.assets
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Leitura modelos" ON public.agreement_templates;
CREATE POLICY "Leitura modelos" ON public.agreement_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  );