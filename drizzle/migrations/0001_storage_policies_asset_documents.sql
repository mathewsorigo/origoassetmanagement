CREATE POLICY "Leitura documentos ativos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'asset-documents' AND public.is_manager(auth.uid()));

CREATE POLICY "Upload documentos ativos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'asset-documents' AND public.is_operator(auth.uid()));

CREATE POLICY "Atualiza documentos ativos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'asset-documents' AND public.is_operator(auth.uid()));

CREATE POLICY "Remove documentos ativos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'asset-documents' AND public.is_operator(auth.uid()));