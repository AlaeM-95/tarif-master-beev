-- Migration 034 : nettoie les flèches Unicode → des pdf_texts
-- Roobert (police custom Beev) ne contient pas le glyphe → (U+2192) ; jsPDF
-- tombe alors sur un fallback bizarre qui casse l'espacement (« Distance
-- TGBT !' Bornes » au lieu de « Distance TGBT > Bornes »). On remplace
-- toutes les flèches par « > » dans le contenu texte des pdf_texts.

UPDATE pdf_texts
   SET content_text = REPLACE(content_text, '→', '>')
 WHERE content_text LIKE '%→%';

NOTIFY pgrst, 'reload schema';
