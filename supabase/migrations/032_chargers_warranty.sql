-- Migration 032 : ajoute un champ `warranty` sur la table chargers.
-- Le commercial peut désormais saisir un texte de garantie spécifique par
-- modèle de borne depuis /admin/chargers (ex : "IP54 · IK10 · Garantie
-- constructeur 3 ans (extensible 6 ans)"). Ce texte alimente la ligne
-- "Qualité et Garantie" de la fiche produit dans le PDF site entreprise.
-- Si vide, fallback sur pdf_texts.site_product_warranty puis valeur par défaut.

ALTER TABLE chargers
  ADD COLUMN IF NOT EXISTS warranty TEXT;

COMMENT ON COLUMN chargers.warranty IS
  'Texte de garantie affiché sur la fiche produit PDF (site entreprise). Editable par le commercial dans /admin/chargers. Si vide, fallback sur pdf_texts.site_product_warranty.';

NOTIFY pgrst, 'reload schema';
