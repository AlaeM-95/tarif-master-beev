-- Migration 051 : page DESIGN du catalogue (image lifestyle + accents design)
--
-- Deux nouvelles colonnes véhicule, alimentées depuis /admin/vehicles et
-- utilisées par l'export « Catalogue » (src/lib/catalogue.ts) pour la 2e page
-- de chaque véhicule (grande image pleine page + accents design) :
--   - design_image_url  : URL du visuel lifestyle pleine page (brochure). Si
--                         vide, le catalogue retombe sur gallery[0], sinon sur
--                         un fond charte + silhouette.
--   - design_highlights : accents design curatés (3-4 punchlines). Si vide, le
--                         catalogue dérive des accents depuis les specs
--                         (autonomie, recharge, puissance, batterie).

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS design_image_url text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS design_highlights text[];

NOTIFY pgrst, 'reload schema';
