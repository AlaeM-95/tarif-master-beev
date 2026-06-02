-- Migration 021 : partage de propositions entre utilisateurs
--
-- Chaque commercial voit par défaut SES propositions (created_by = auth.uid()).
-- Ops/admin voient tout. Le sharing permet :
--   - Un sales partage une proposition avec un autre sales (shared_with)
--   - Un ops crée une proposition et l'assigne à un sales (assigned_to)
--
-- Avant : tous les sales voyaient toutes les propositions (RLS open).
-- Après : visibilité granulaire avec possibilité de partage explicite.

-- Colonnes
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS shared_with UUID[] DEFAULT '{}'::UUID[];

CREATE INDEX IF NOT EXISTS idx_proposals_assigned_to ON proposals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_proposals_created_by ON proposals(created_by);

-- Function d'accès : true si l'user peut voir une proposition donnée.
-- Vraie pour : created_by, assigned_to, dans shared_with, ou ops/admin.
CREATE OR REPLACE FUNCTION can_access_proposal(p_created_by UUID, p_assigned_to UUID, p_shared_with UUID[]) RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT
    auth.uid() = p_created_by
    OR auth.uid() = p_assigned_to
    OR auth.uid() = ANY(COALESCE(p_shared_with, '{}'::UUID[]))
    OR is_ops_or_admin();
$$;

-- Réécriture des policies
DROP POLICY IF EXISTS "Authenticated read proposals" ON proposals;
DROP POLICY IF EXISTS "Sales+Ops+Admin write proposals" ON proposals;

-- SELECT : voir ce qui m'est attribué/partagé OU ops+admin
CREATE POLICY "Read own or shared proposals" ON proposals FOR SELECT TO authenticated
  USING (can_access_proposal(created_by, assigned_to, shared_with));

-- INSERT : tout sales+ peut créer (created_by sera auth.uid() par défaut côté code)
CREATE POLICY "Sales+ create proposals" ON proposals FOR INSERT TO authenticated
  WITH CHECK (is_sales_or_above());

-- UPDATE : créateur + assigné + partagés + ops/admin
CREATE POLICY "Read/Update own or shared proposals" ON proposals FOR UPDATE TO authenticated
  USING (can_access_proposal(created_by, assigned_to, shared_with))
  WITH CHECK (can_access_proposal(created_by, assigned_to, shared_with));

-- DELETE : uniquement créateur ou ops/admin (pas les destinataires d'un partage)
CREATE POLICY "Owner or Ops+ delete proposals" ON proposals FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR is_ops_or_admin());

-- Vérification
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'proposals' AND column_name IN ('assigned_to','shared_with')) AS new_cols,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'proposals') AS nb_policies;
