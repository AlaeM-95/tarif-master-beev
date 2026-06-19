-- Migration 045 : champs « fiche produit » des bornes (caractéristiques clés)
--
-- Alimentent la page Fiche produit B2B2E (format fiche technique Beev) et le
-- comparateur. Tous optionnels : dégradation propre si absents (IP/IK extrait
-- de warranty, température par défaut, dimensions masquées si vides).
--   ip_rating  : indice de protection, ex. « IP55 · IK10 »
--   dimensions : dimensions hors-tout, ex. « 370×250×150 » (mm, H×L×P)
--   temp_range : plage de température d'usage, ex. « −25 à 50 °C »

ALTER TABLE public.chargers
  ADD COLUMN IF NOT EXISTS ip_rating text,
  ADD COLUMN IF NOT EXISTS dimensions text,
  ADD COLUMN IF NOT EXISTS temp_range text;

-- Vérification
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'chargers'
  AND column_name IN ('ip_rating', 'dimensions', 'temp_range');
