-- Table beev_pillars : 3 piliers d'engagement par type de projet, affichés
-- dans la section "Ce que Beev s'engage à tenir" du PDF.
-- Avant cette migration, les 9 piliers (3 × véhicules / domicile / site) étaient
-- hardcodés dans src/lib/pdf.ts. Cette table permet à l'admin de les modifier
-- sans toucher au code.

CREATE TABLE IF NOT EXISTS beev_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_type TEXT NOT NULL CHECK (project_type IN ('vehicles', 'home', 'site')),
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  metric TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_type, position)
);

CREATE INDEX IF NOT EXISTS idx_beev_pillars_type_pos ON beev_pillars(project_type, position);

ALTER TABLE beev_pillars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read beev_pillars" ON beev_pillars FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Admin write beev_pillars" ON beev_pillars FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER beev_pillars_updated_at BEFORE UPDATE ON beev_pillars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed des 9 piliers actuels depuis src/lib/pdf.ts (drawGuarantees)
INSERT INTO beev_pillars (project_type, position, title, metric, details) VALUES
  ('vehicles', 0, 'INTERLOCUTEUR UNIQUE', 'Réponse J+1', '["Un commercial grand compte dédié","Hotline gestion de flotte mutualisée","Coordination loueurs (Ayvens, Arval, Athlon, Leaseplan)","Suivi livraisons et incidents constructeurs"]'::jsonb),
  ('vehicles', 1, 'MAINTENANCE INCLUSE', 'Tous réseaux', '["Entretien constructeur tous réseaux","Assistance 24/24, dépannage routier","Véhicule de remplacement selon contrat","Garantie perte financière en cas de vol/sinistre"]'::jsonb),
  ('vehicles', 2, 'PILOTAGE FLEET MANAGER', 'Dashboard live', '["Accès Fleet Manager Beev multi-utilisateurs","Suivi des PV de livraison et restitutions","Mise à jour fiscalité applicable","Reporting consolidé sur demande"]'::jsonb),

  ('home', 0, 'POSE IRVE CERTIFIÉE', 'Partenaire Seris', '["Pose jusqu''à 10 m incluse, garantie 4 ans","Visite technique systématique","Mise en service le jour de la pose","Procès-verbal signé collaborateur"]'::jsonb),
  ('home', 1, 'SUPERVISION MARQUE BLANCHE', 'Temps réel', '["Visibilité par collaborateur, par site","Mesures conformes MID","Données disponibles sous 24h","API d''export pour SI RH si besoin"]'::jsonb),
  ('home', 2, 'REMBOURSEMENT AUTOMATISÉ', 'Sous 30 jours', '["Calcul mensuel des kWh professionnels","Virement automatique au collaborateur","Facturation employeur consolidée","Garantie de conformité fiscale"]'::jsonb),

  ('site', 0, 'GARANTIE MATÉRIEL', '3 ans (ext. 6)', '["Constructeurs premium : Alfen, Schneider, Hager, Wallbox","Garantie pièces et main d''œuvre 3 ans","Extension à 6 ans en option","SAV reconditionné en cas de panne hardware"]'::jsonb),
  ('site', 1, 'POSE IRVE CERTIFIÉE', 'OCPP-ready', '["Technicien IRVE certifié AFNOR","Paramétrage OCPP 1.6/2.0","Mise en service et formation utilisateurs","Signature PV de réception conjoint"]'::jsonb),
  ('site', 2, 'EXPLOITATION ET SAV', 'GTR contractuelle', '["Hotline utilisateurs 24/24","GTR rétablissement sous 24h ouvrées","Supervision multi-sites consolidée","Rapports d''usage trimestriels"]'::jsonb);

-- Vérification
SELECT project_type, position, title, metric, jsonb_array_length(details) AS nb_details
FROM beev_pillars ORDER BY project_type, position;
