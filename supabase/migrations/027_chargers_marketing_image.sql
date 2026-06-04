-- Migration 027 : ajoute un champ marketing_image_url sur la table chargers.
-- Cette image (haute résolution, rendu produit pro) est utilisée à la place
-- de l'image standard sur la page "Fiche produit" du PDF site entreprise.
-- Si null, le PDF retombe sur la colonne image existante.

ALTER TABLE chargers
  ADD COLUMN IF NOT EXISTS marketing_image_url TEXT;

COMMENT ON COLUMN chargers.marketing_image_url IS
  'URL Storage d''une image marketing haute résolution affichée grande sur la page Fiche produit du PDF site entreprise. Fallback : colonne image.';

NOTIFY pgrst, 'reload schema';
