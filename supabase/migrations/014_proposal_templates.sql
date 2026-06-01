-- Table proposal_templates : modèles de propositions réutilisables que le
-- commercial peut charger en un clic pour démarrer une nouvelle offre sans
-- repartir de zéro. Cas typique : "Starter PME 10 VE", "Flotte 50 VE",
-- "Audit IRVE multi-sites", etc.
-- Le template stocke un snapshot des sélections + paramètres énergie. Les
-- infos client (société, contact, email) sont volontairement EXCLUES :
-- chaque proposition créée depuis un template a son propre client.

CREATE TABLE IF NOT EXISTS proposal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT NOT NULL CHECK (project_type IN ('vehicles', 'home', 'site')),
  selected_vehicles JSONB DEFAULT '[]'::jsonb,
  selected_chargers JSONB DEFAULT '[]'::jsonb,
  energy_params JSONB,
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_project_type ON proposal_templates(project_type);
CREATE INDEX IF NOT EXISTS idx_templates_position ON proposal_templates(position);

ALTER TABLE proposal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read templates" ON proposal_templates FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Admin write templates" ON proposal_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER proposal_templates_updated_at BEFORE UPDATE ON proposal_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT 'Table proposal_templates créée. Aucun seed : les admins créent leurs propres templates depuis l''accueil.' AS info;
