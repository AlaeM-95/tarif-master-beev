-- Migration 048 : logo Beev pour fond sombre (variante blanche/claire)
--
-- Contexte : pdf_settings.logo_url est utilisé comme "logo sur fond clair"
-- (couverture beige, en-tête admin) — voir pdf.ts drawCoverV2/HEADER_LOGO_DARK.
-- Mais ce même champ est aussi réutilisé sur des pages à fond noir plein
-- (couverture non-admin, bandeau des en-têtes internes non-admin), où un
-- logo sombre/couleur devient invisible. On ajoute une seconde colonne pour
-- la variante blanche/claire dédiée aux fonds sombres, sans toucher à
-- logo_url (qui reste "logo fond clair").

ALTER TABLE pdf_settings ADD COLUMN IF NOT EXISTS logo_dark_bg_url text;

NOTIFY pgrst, 'reload schema';
