-- Migration 042 : aligner les droits Ops sur Admin pour le catalogue
--
-- 1) L'Ops ne pouvait pas modifier l'image d'une fiche produit : les policies
--    du bucket Storage « vehicle-images » (migration 005) réservaient l'upload
--    au rôle admin uniquement. On les ré-ouvre à Ops + Admin via le helper
--    is_ops_or_admin() (migration 019), comme pour les écritures sur la table
--    vehicles. Toutes les images de l'app (véhicules, bornes, logos clients)
--    passent par ce bucket, donc ce correctif couvre l'ensemble.
--
-- 2) L'Ops ne doit PAS accéder à la configuration PDF : on bascule
--    backoffice_pdf à false pour le rôle ops. La page Utilisateurs & rôles est
--    déjà réservée à l'admin (garde isAdmin côté app), manage_users reste false.

-- === 1. Storage vehicle-images : upload/maj/suppression pour Ops + Admin ===
DROP POLICY IF EXISTS "Admin upload vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin update vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Ops upload vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Ops update vehicle-images" ON storage.objects;
DROP POLICY IF EXISTS "Ops delete vehicle-images" ON storage.objects;

CREATE POLICY "Ops upload vehicle-images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-images' AND is_ops_or_admin());

CREATE POLICY "Ops update vehicle-images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vehicle-images' AND is_ops_or_admin())
  WITH CHECK (bucket_id = 'vehicle-images' AND is_ops_or_admin());

CREATE POLICY "Ops delete vehicle-images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-images' AND is_ops_or_admin());

-- === 2. Permissions : Ops = Admin sauf PDF et utilisateurs ===
INSERT INTO public.role_permissions (role, backoffice_vehicles, backoffice_pdf, manage_users, edit_product_sheet)
VALUES ('ops', true, false, false, true)
ON CONFLICT (role) DO UPDATE SET
  backoffice_vehicles = true,
  backoffice_pdf = false,
  manage_users = false,
  edit_product_sheet = true,
  updated_at = now();

-- Vérification
SELECT polname FROM pg_policy WHERE polrelid = 'storage.objects'::regclass AND polname LIKE '%vehicle-images%';
SELECT role, backoffice_vehicles, backoffice_pdf, manage_users, edit_product_sheet FROM public.role_permissions WHERE role = 'ops';
