-- Migration 037 : autorise le rôle 'sales' à modifier les fiches produit
-- du catalogue (vehicles + chargers).
-- Demande user : le commercial doit pouvoir éditer une fiche produit
-- directement, sans dépendre d'un admin/ops. La duplication s'appuie
-- aussi sur ce droit (INSERT).
--
-- Reste réservé à ops/admin : suppressions massives (removeAll), édition
-- des prix internes (pricing_internal), gestion users.

-- Vehicles : remplace la policy ops+admin par sales+ops+admin
DROP POLICY IF EXISTS "Ops+Admin write vehicles" ON vehicles;
CREATE POLICY "Sales+Ops+Admin write vehicles" ON vehicles FOR ALL TO authenticated
  USING (is_sales_or_above()) WITH CHECK (is_sales_or_above());

-- Chargers : idem
DROP POLICY IF EXISTS "Ops+Admin write chargers" ON chargers;
CREATE POLICY "Sales+Ops+Admin write chargers" ON chargers FOR ALL TO authenticated
  USING (is_sales_or_above()) WITH CHECK (is_sales_or_above());

NOTIFY pgrst, 'reload schema';
