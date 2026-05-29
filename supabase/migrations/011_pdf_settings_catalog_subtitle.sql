-- Ajoute un sous-titre éditable par type de projet pour la section catalogue
-- (bornes domicile, bornes site, véhicules) affichée dans l'interface
-- commerciale. Permet de modifier la phrase de positionnement sans toucher
-- au code.

ALTER TABLE pdf_settings ADD COLUMN IF NOT EXISTS catalog_subtitle TEXT;

-- Valeurs par défaut alignées sur le texte actuel hardcodé dans src/routes/index.tsx.
UPDATE pdf_settings SET catalog_subtitle = 'Catalogue synchronisé avec le calculateur TCO Beev. Loyers exprimés en TTC.'
  WHERE project_type = 'vehicles' AND catalog_subtitle IS NULL;
UPDATE pdf_settings SET catalog_subtitle = 'Kit B2B2E clé en main · pose jusqu''à 10 m incluse · supervision et remboursement automatisé.'
  WHERE project_type = 'home' AND catalog_subtitle IS NULL;
UPDATE pdf_settings SET catalog_subtitle = 'Devis détaillé site par site (matériel + IRVE + génie civil).'
  WHERE project_type = 'site' AND catalog_subtitle IS NULL;

-- Vérification
SELECT project_type, catalog_subtitle FROM pdf_settings ORDER BY project_type;
