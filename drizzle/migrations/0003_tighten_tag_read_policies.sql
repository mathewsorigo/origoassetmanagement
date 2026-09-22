DROP POLICY IF EXISTS "Leitura etiquetas" ON public.tags;
CREATE POLICY "Leitura etiquetas" ON public.tags
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

DROP POLICY IF EXISTS "Leitura etiquetas do ativo" ON public.asset_tags;
CREATE POLICY "Leitura etiquetas do ativo" ON public.asset_tags
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));