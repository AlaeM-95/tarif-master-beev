-- Migration 036 : nettoie les flèches Unicode → des pdf_texts
-- Roobert (police custom Beev) ne contient pas le glyphe → (U+2192).
-- Quand jsPDF le rencontre il bascule sur Helvetica pour ce segment, ce qui
-- casse l'espacement (« Distance TGBT !' Bornes » au lieu de « Distance
-- TGBT > Bornes »). On remplace toutes les flèches par « > » dans les
-- pdf_texts seedés par la migration 025.
--
-- Précédemment numérotée 034 puis revertée pendant un débug 500 (qui était
-- en fait dû aux fichiers Roobert.woff2 manquants, pas à cette migration).

UPDATE pdf_texts
   SET content_text = REPLACE(content_text, '→', '>')
 WHERE content_text LIKE '%→%';

NOTIFY pgrst, 'reload schema';
