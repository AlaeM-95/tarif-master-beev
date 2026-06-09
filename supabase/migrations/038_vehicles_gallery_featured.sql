-- Migration 038 : galerie photos + flag featured sur vehicles
-- - gallery JSONB : tableau d'URLs (photos additionnelles affichées dans
--   l'encart "Véhicule du moment" et le comparateur)
-- - featured BOOLEAN : si true, ce véhicule est mis en avant sur la home

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]'::jsonb;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN vehicles.gallery IS 'Galerie photos additionnelles (URLs). Affichées dans encart véhicule du moment et comparateur.';
COMMENT ON COLUMN vehicles.featured IS 'Si true, ce véhicule est mis en avant dans encart Véhicule du moment sur la home commerciale.';

NOTIFY pgrst, 'reload schema';
