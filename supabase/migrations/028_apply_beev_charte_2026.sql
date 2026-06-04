-- Migration 028 : applique la charte graphique Beev 2026 officielle
-- (transmise dans le document interne "2026 - Beev Charte Graphique").
--
-- Avant : les valeurs par défaut étaient un mix non conforme à la charte
--   color_ink     = #111111 (au lieu de #1D1D1D)
--   color_bg      = #FAF8F4 (au lieu de #FCF9F2)
--   color_accent  = #35DA76 (vert qui n'existe PAS dans la charte)
--   color_lavender = #3809EA (lavande qui n'existe PAS dans la charte)
--
-- Après (charte 2026 officielle) :
--   color_ink     = #1D1D1D  Black (primaire)
--   color_bg      = #FCF9F2  Beige (primaire)
--   color_accent  = #F4B8AA  Rose (secondaire principal)
--   color_lavender = #F4B8AA  Rose (alias technique pour compat code)
--
-- Note : si l'admin a personnalisé via /admin/pdf > Apparence, ses valeurs
-- seront écrasées. Il pourra les re-customiser après.

UPDATE pdf_settings SET
  color_ink = '#1D1D1D',
  color_bg = '#FCF9F2',
  color_accent = '#F4B8AA',
  color_lavender = '#F4B8AA';

-- Met également à jour les DEFAULT de la table pour les futurs INSERT
ALTER TABLE pdf_settings ALTER COLUMN color_ink SET DEFAULT '#1D1D1D';
ALTER TABLE pdf_settings ALTER COLUMN color_bg SET DEFAULT '#FCF9F2';
ALTER TABLE pdf_settings ALTER COLUMN color_accent SET DEFAULT '#F4B8AA';
ALTER TABLE pdf_settings ALTER COLUMN color_lavender SET DEFAULT '#F4B8AA';

NOTIFY pgrst, 'reload schema';
