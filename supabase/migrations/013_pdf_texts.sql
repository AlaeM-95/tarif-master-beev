-- Table pdf_texts : tous les textes du PDF qui étaient hardcodés dans
-- src/lib/pdf.ts, désormais éditables depuis /admin/pdf sans toucher au code.
-- Structure générique pour ne pas multiplier les colonnes spécifiques.
-- scope : 'common' (apparaît sur toutes les pages, indépendant du type projet)
--         'vehicles' / 'home' / 'site' (texte spécifique à un type)
-- kind  : 'text' (1 ligne court) / 'multiline' (paragraphe) / 'list' (1 item par ligne, stocké JSON)

CREATE TABLE IF NOT EXISTS pdf_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('common', 'vehicles', 'home', 'site')),
  slug TEXT NOT NULL,
  category TEXT NOT NULL, -- regroupement dans l'UI admin (couverture, page borne, etc.)
  label TEXT NOT NULL, -- libellé humain affiché à l'admin
  kind TEXT NOT NULL CHECK (kind IN ('text', 'multiline', 'list')),
  content_text TEXT,
  content_list JSONB,
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (scope, slug)
);

CREATE INDEX IF NOT EXISTS idx_pdf_texts_scope ON pdf_texts(scope);
CREATE INDEX IF NOT EXISTS idx_pdf_texts_category ON pdf_texts(category);

ALTER TABLE pdf_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read pdf_texts" ON pdf_texts FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Admin write pdf_texts" ON pdf_texts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER pdf_texts_updated_at BEFORE UPDATE ON pdf_texts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ====== SEED des textes actuels hardcodés ======

INSERT INTO pdf_texts (scope, slug, category, label, kind, content_text, content_list, position) VALUES
  -- Couverture (commun à tous les types de projet)
  ('common', 'cover_tagline', 'couverture', 'Tagline sous le logo Beev', 'text',
   'Le copilote de l''électrification des flottes · beev.co', NULL, 1),
  ('common', 'cover_validity', 'couverture', 'Mention de validité (sous le numéro de devis)', 'text',
   'Validité 30 jours · à compter de la date d''émission', NULL, 2),
  ('common', 'cover_perimeter_label', 'couverture', 'Libellé "PÉRIMÈTRE"', 'text',
   'PÉRIMÈTRE', NULL, 3),
  ('common', 'cover_prepared_for_label', 'couverture', 'Libellé "PRÉPARÉE POUR"', 'text',
   'PRÉPARÉE POUR', NULL, 4),
  ('common', 'cover_prepared_by_label', 'couverture', 'Libellé "PRÉPARÉE PAR"', 'text',
   'PRÉPARÉE PAR', NULL, 5),
  ('common', 'footer_confidential', 'pied de page', 'Mention pied de page (chaque page)', 'text',
   'DOCUMENT CONFIDENTIEL · USAGE INTERNE CLIENT', NULL, 6),

  -- Pourquoi Beev (titre par type — l'intro et bullets sont déjà dans pdf_settings)
  ('vehicles', 'why_beev_title', 'pourquoi beev', 'Titre de la page "Pourquoi Beev"', 'text',
   'Pourquoi confier vos véhicules à Beev.', NULL, 1),
  ('home', 'why_beev_title', 'pourquoi beev', 'Titre de la page "Pourquoi Beev"', 'text',
   'Le kit B2B2E clé en main pour vos collaborateurs.', NULL, 1),
  ('site', 'why_beev_title', 'pourquoi beev', 'Titre de la page "Pourquoi Beev"', 'text',
   'Un déploiement IRVE site entreprise sans friction.', NULL, 1),

  ('vehicles', 'why_beev_changes_header', 'pourquoi beev', 'Header "Concrètement, ce qui change..."', 'text',
   'Concrètement, ce qui change pour vous :', NULL, 2),
  ('home', 'why_beev_changes_header', 'pourquoi beev', 'Header "Concrètement, ce qui change..."', 'text',
   'Concrètement, ce qui change pour vous :', NULL, 2),
  ('site', 'why_beev_changes_header', 'pourquoi beev', 'Header "Concrètement, ce qui change..."', 'text',
   'Concrètement, ce qui change pour vous :', NULL, 2),

  -- Page borne — encart "Inclus dans la prestation"
  ('home', 'charger_inclusion_title', 'page borne', 'Titre de l''encart "Inclus" sur la page borne', 'text',
   'INCLUS DANS LE KIT INSTALLATION DOMICILE', NULL, 1),
  ('site', 'charger_inclusion_title', 'page borne', 'Titre de l''encart "Inclus" sur la page borne', 'text',
   'INCLUS DANS LA PRESTATION CLÉ EN MAIN', NULL, 1),

  ('home', 'charger_inclusion_items', 'page borne', 'Liste des inclusions sur la page borne (une par ligne)', 'list',
   NULL,
   '["Matériel et accessoires de raccordement","Pose et raccordement par technicien IRVE certifié","Câblage standard jusqu''à 10 m du tableau électrique","Supervision Beev en marque blanche","Remboursement automatisé de l''énergie consommée à titre professionnel","Garantie constructeur selon la gamme"]'::jsonb,
   2),
  ('site', 'charger_inclusion_items', 'page borne', 'Liste des inclusions sur la page borne (une par ligne)', 'list',
   NULL,
   '["Étude de site et chiffrage par technicien IRVE certifié","Pose, raccordement et mise en service","Paramétrage OCPP et configuration du superviseur","Formation des utilisateurs sur site","Gestion des déchets de chantier","Garantie constructeur 3 ans, extensible 6 ans"]'::jsonb,
   2),

  -- Page borne — libellés totaux
  ('home', 'charger_total_label', 'page borne', 'Libellé du total HT (pied du tableau)', 'text',
   'Total HT par collaborateur', NULL, 3),
  ('site', 'charger_total_label', 'page borne', 'Libellé du total HT (pied du tableau)', 'text',
   'Total HT par site', NULL, 3),

  ('home', 'charger_grand_total_unit_singular', 'page borne', 'Unité au singulier (encart "Pour N ...")', 'text',
   'collaborateur', NULL, 4),
  ('home', 'charger_grand_total_unit_plural', 'page borne', 'Unité au pluriel (encart "Pour N ...")', 'text',
   'collaborateurs', NULL, 5),
  ('site', 'charger_grand_total_unit_singular', 'page borne', 'Unité au singulier (encart "Pour N ...")', 'text',
   'borne', NULL, 4),
  ('site', 'charger_grand_total_unit_plural', 'page borne', 'Unité au pluriel (encart "Pour N ...")', 'text',
   'bornes', NULL, 5);

-- Vérification
SELECT scope, category, COUNT(*) AS nb FROM pdf_texts GROUP BY scope, category ORDER BY scope, category;
