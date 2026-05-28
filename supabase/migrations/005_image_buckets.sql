-- ====== Bucket Storage pour les images véhicules/bornes ======
-- Idempotent : crée le bucket si absent, OK si déjà présent
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vehicle-images', 'vehicle-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Nettoie les anciennes policies (idempotent)
DROP POLICY IF EXISTS "Public read vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin update vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete vehicle-images" ON storage.objects;

-- Lecture publique
CREATE POLICY "Public read vehicle-images" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'vehicle-images');

-- Upload réservé aux admins
CREATE POLICY "Admin upload vehicle-images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin update vehicle-images" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vehicle-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin delete vehicle-images" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vehicle-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Vérifie que le bucket et les policies sont bien créés
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'vehicle-images';
SELECT polname FROM pg_policy WHERE polrelid = 'storage.objects'::regclass AND polname LIKE '%vehicle-images%';
