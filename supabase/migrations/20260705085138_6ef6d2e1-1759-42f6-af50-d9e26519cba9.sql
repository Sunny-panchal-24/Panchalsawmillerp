
CREATE POLICY "recovery own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recovery' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid())));
CREATE POLICY "recovery own write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recovery' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid())));
CREATE POLICY "recovery own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'recovery' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid())));
