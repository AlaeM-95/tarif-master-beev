-- ====== Bucket Storage pour les devis techniciens (PDF) ======
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', true, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- Lecture publique (les URLs sont obscures, contiennent un timestamp + random)
CREATE POLICY "Public read documents" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'documents');

-- Upload réservé aux admins
CREATE POLICY "Admin upload documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin update documents" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin delete documents" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
