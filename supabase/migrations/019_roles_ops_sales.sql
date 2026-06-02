-- Migration 019 : extension des rôles 'ops' et 'sales' pour permissions granulaires.
--
-- Avant : 2 rôles (admin / visitor). Tous ceux qui n'étaient pas admin n'avaient
-- aucun droit d'écriture, et tous les droits étaient cumulés côté admin.
--
-- Après :
--   - admin  : super-administrateur. Tout. Peut assigner des rôles.
--   - ops    : opérations / pricing. Peut modifier le catalogue véhicules,
--              bornes, matériel, BPU, offres loueurs, templates PDF.
--              NE PEUT PAS gérer les utilisateurs.
--   - sales  : commercial. Peut construire des propositions, les sauvegarder,
--              générer des PDF, lire le catalogue. Lecture seule sur tout
--              ce qui touche au catalogue / pricing / PDF.
--   - visitor: aucun droit d'écriture. Lecture seule (compatibilité historique).

-- === 1. Étendre la contrainte CHECK sur profiles.role ===
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'ops', 'sales', 'visitor'));

-- === 2. Mettre à jour les RLS pour ouvrir l'écriture à 'ops' partout où
-- 'admin' avait l'accès, sauf table profiles (admin seul peut gérer les
-- utilisateurs). ===

-- Helper IS_OPS : centralise la vérification. Recrée à chaque migration au cas où.
CREATE OR REPLACE FUNCTION is_ops_or_admin() RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ops'));
$$;

CREATE OR REPLACE FUNCTION is_admin_only() RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION is_sales_or_above() RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ops', 'sales'));
$$;

-- Vehicles
DROP POLICY IF EXISTS "Admin write vehicles" ON vehicles;
CREATE POLICY "Ops+Admin write vehicles" ON vehicles FOR ALL TO authenticated
  USING (is_ops_or_admin()) WITH CHECK (is_ops_or_admin());

-- Chargers
DROP POLICY IF EXISTS "Admin write chargers" ON chargers;
CREATE POLICY "Ops+Admin write chargers" ON chargers FOR ALL TO authenticated
  USING (is_ops_or_admin()) WITH CHECK (is_ops_or_admin());

-- Materials
DROP POLICY IF EXISTS "Admin write materials" ON materials;
CREATE POLICY "Ops+Admin write materials" ON materials FOR ALL TO authenticated
  USING (is_ops_or_admin()) WITH CHECK (is_ops_or_admin());

-- BPU forfaits
DROP POLICY IF EXISTS "Admin write bpu_forfaits" ON bpu_forfaits;
CREATE POLICY "Ops+Admin write bpu_forfaits" ON bpu_forfaits FOR ALL TO authenticated
  USING (is_ops_or_admin()) WITH CHECK (is_ops_or_admin());

-- Beev pillars
DROP POLICY IF EXISTS "Admin write beev_pillars" ON beev_pillars;
CREATE POLICY "Ops+Admin write beev_pillars" ON beev_pillars FOR ALL TO authenticated
  USING (is_ops_or_admin()) WITH CHECK (is_ops_or_admin());

-- PDF settings + journey steps + texts
DROP POLICY IF EXISTS "Admin write pdf_settings" ON pdf_settings;
CREATE POLICY "Ops+Admin write pdf_settings" ON pdf_settings FOR ALL TO authenticated
  USING (is_ops_or_admin()) WITH CHECK (is_ops_or_admin());

DROP POLICY IF EXISTS "Admin write journey_steps" ON journey_steps;
CREATE POLICY "Ops+Admin write journey_steps" ON journey_steps FOR ALL TO authenticated
  USING (is_ops_or_admin()) WITH CHECK (is_ops_or_admin());

DROP POLICY IF EXISTS "Admin write pdf_texts" ON pdf_texts;
CREATE POLICY "Ops+Admin write pdf_texts" ON pdf_texts FOR ALL TO authenticated
  USING (is_ops_or_admin()) WITH CHECK (is_ops_or_admin());

-- Leaser offers
DROP POLICY IF EXISTS "Admin write leaser_offers" ON leaser_offers;
CREATE POLICY "Ops+Admin write leaser_offers" ON leaser_offers FOR ALL TO authenticated
  USING (is_ops_or_admin()) WITH CHECK (is_ops_or_admin());

-- Proposal templates (l'ops peut créer des templates de propositions à
-- proposer aux sales)
DROP POLICY IF EXISTS "Admin write templates" ON proposal_templates;
CREATE POLICY "Ops+Admin write templates" ON proposal_templates FOR ALL TO authenticated
  USING (is_ops_or_admin()) WITH CHECK (is_ops_or_admin());

-- Proposals : ouverture aux sales (chaque sales peut créer/modifier ses
-- propositions). Admin et ops peuvent voir/modifier toutes les propositions.
DROP POLICY IF EXISTS "Admin read proposals" ON proposals;
DROP POLICY IF EXISTS "Admin write proposals" ON proposals;
CREATE POLICY "Authenticated read proposals" ON proposals FOR SELECT TO authenticated
  USING (is_sales_or_above());
CREATE POLICY "Sales+Ops+Admin write proposals" ON proposals FOR ALL TO authenticated
  USING (is_sales_or_above()) WITH CHECK (is_sales_or_above());

-- === 3. Profiles reste admin-only (gestion utilisateurs) ===
-- (Pas de modification ici car les policies existantes n'autorisent que admin)

-- Vérification
SELECT
  (SELECT COUNT(*) FROM pg_constraint WHERE conname = 'profiles_role_check') AS constraint_role_existe,
  (SELECT proname FROM pg_proc WHERE proname = 'is_ops_or_admin' LIMIT 1) AS function_is_ops_existe,
  (SELECT COUNT(*) FROM pg_policies WHERE policyname LIKE 'Ops+Admin%' OR policyname LIKE 'Sales+Ops+Admin%') AS nouvelles_policies;
