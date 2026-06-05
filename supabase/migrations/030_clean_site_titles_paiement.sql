-- Migration 030 : nettoyage textes PDF sur demande utilisateur
-- - Vide site_fin_title ("Votre budget projet") car titre redondant
--   avec l'eyebrow "6 · RÉCAPITULATIF FINANCIER"
-- - Conserve les autres textes site_fin_* éditables

UPDATE pdf_texts
   SET content_text = ''
 WHERE scope = 'site' AND slug = 'site_fin_title';

NOTIFY pgrst, 'reload schema';
