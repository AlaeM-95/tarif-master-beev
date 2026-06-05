-- Migration 029 : active Supabase Realtime sur les tables catalogue
-- partagées entre commerciaux.
--
-- Effet attendu : quand un ops modifie un prix, une image, une offre
-- loueur ou un texte PDF via /admin, tous les autres commerciaux
-- connectés voient la mise à jour en ~1 seconde sans F5.
--
-- Tables incluses :
--   - vehicles        (catalogue véhicules)
--   - chargers        (catalogue bornes)
--   - leaser_offers   (offres loueurs par véhicule)
--   - pdf_settings    (charte couleurs admin)
--   - pdf_texts       (textes éditables admin)
--   - beev_pillars    (engagements éditables admin)
--   - journey_steps   (étapes parcours client admin)
--
-- La publication `supabase_realtime` est la convention Supabase pour
-- exposer une table aux clients via les websockets.

ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE chargers;
ALTER PUBLICATION supabase_realtime ADD TABLE leaser_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE pdf_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE pdf_texts;
ALTER PUBLICATION supabase_realtime ADD TABLE beev_pillars;
ALTER PUBLICATION supabase_realtime ADD TABLE journey_steps;

NOTIFY pgrst, 'reload schema';
