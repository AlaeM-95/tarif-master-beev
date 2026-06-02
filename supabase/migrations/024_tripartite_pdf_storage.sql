-- Migration 024 : ajoute un champ tripartite_pdf_url séparé du nom du contrat.
-- Le champ existant tripartite_contract reste un libellé textuel ; le nouveau
-- champ stocke l'URL du PDF uploadé via Supabase Storage.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tripartite_pdf_url TEXT;

-- Création du bucket Storage 'tripartite-contracts' si absent.
-- Les buckets ne se créent pas en SQL direct (API Supabase) ; ce SQL ne fait
-- que vérifier qu'il existe via le catalogue interne.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tripartite-contracts', 'tripartite-contracts', true, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS storage : ops/admin upload, tout authentifié peut lire
DROP POLICY IF EXISTS "Ops upload tripartite" ON storage.objects;
CREATE POLICY "Ops upload tripartite" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tripartite-contracts' AND is_ops_or_admin());

DROP POLICY IF EXISTS "Ops update tripartite" ON storage.objects;
CREATE POLICY "Ops update tripartite" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tripartite-contracts' AND is_ops_or_admin());

DROP POLICY IF EXISTS "Ops delete tripartite" ON storage.objects;
CREATE POLICY "Ops delete tripartite" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tripartite-contracts' AND is_ops_or_admin());

DROP POLICY IF EXISTS "Authenticated read tripartite" ON storage.objects;
CREATE POLICY "Authenticated read tripartite" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tripartite-contracts');

SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'tripartite_pdf_url') AS new_col,
  (SELECT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'tripartite-contracts')) AS bucket_existe;
