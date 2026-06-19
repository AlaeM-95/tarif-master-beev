-- Migration 044 : champs comparateur / catalogue B2B2E sur les bornes
--
-- Alimente la grille comparative et le catalogue des bornes domicile
-- (projets B2B2E). Tous optionnels : l'app dégrade proprement si absents.
--   casawatt_eligible    : éligible prime Casawatt (oui/non)
--   other_supervision    : compatible autre supervision que Beev (oui/non)
--   install_price_5m_ht  : forfait pose 5 m HT
--   install_price_10m_ht : forfait pose 10 m HT
--   comparator_badge     : 'premium' | 'value' (badge mis en avant)

ALTER TABLE public.chargers
  ADD COLUMN IF NOT EXISTS casawatt_eligible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS other_supervision boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS install_price_5m_ht numeric,
  ADD COLUMN IF NOT EXISTS install_price_10m_ht numeric,
  ADD COLUMN IF NOT EXISTS comparator_badge text;

-- Vérification
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'chargers'
  AND column_name IN ('casawatt_eligible','other_supervision','install_price_5m_ht','install_price_10m_ht','comparator_badge');
