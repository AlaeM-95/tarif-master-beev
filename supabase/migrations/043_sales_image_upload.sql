-- Migration 043 : autoriser le rôle Sales à modifier les photos
--
-- Les policies du bucket Storage « vehicle-images » étaient réservées à
-- Ops + Admin (migration 042 via is_ops_or_admin()). Le commercial ne pouvait
-- donc pas uploader d'image (logo client sur une proposition, photo de fiche,
-- etc.) et recevait « Permissions insuffisantes ».
--
-- On ré-ouvre upload / mise à jour / suppression à Sales + Ops + Admin via le
-- helper is_sales_or_above() (migration 019 : role IN admin, ops, sales).
-- Toutes les images de l'app passent par ce bucket, donc ce correctif couvre
-- l'ensemble des uploads côté commercial.

DROP POLICY IF EXISTS "Admin upload vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin update vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Ops upload vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Ops update vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Ops delete vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Sales upload vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Sales update vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Sales delete vehicle-images" ON storage.objects;

CREATE POLICY "Sales upload vehicle-images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-images' AND is_sales_or_above());

CREATE POLICY "Sales update vehicle-images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vehicle-images' AND is_sales_or_above())
  WITH CHECK (bucket_id = 'vehicle-images' AND is_sales_or_above());

CREATE POLICY "Sales delete vehicle-images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-images' AND is_sales_or_above());

-- Vérification
SELECT polname FROM pg_policy WHERE polrelid = 'storage.objects'::regclass AND polname LIKE '%vehicle-images%';
