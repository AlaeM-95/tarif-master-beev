-- Migration 039 : nouvelles caractéristiques véhicule
-- Affichées sur la fiche produit PDF + le comparateur (UI et PDF).
--
-- trunk_litres        : volume de coffre VDA en litres
-- charge_dc_max_kw    : puissance de recharge DC max (kW)
-- charge_ac_max_kw    : puissance de recharge AC max (kW)
-- dimensions          : L × l × H texte libre
-- charge_time_2080_ac : durée recharge 20-80 % en AC (ex. "8h00")
-- charge_time_2080_dc : durée recharge 20-80 % en DC rapide (ex. "28 min")

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS trunk_litres        INTEGER,
  ADD COLUMN IF NOT EXISTS charge_dc_max_kw    NUMERIC,
  ADD COLUMN IF NOT EXISTS charge_ac_max_kw    NUMERIC,
  ADD COLUMN IF NOT EXISTS dimensions          TEXT,
  ADD COLUMN IF NOT EXISTS charge_time_2080_ac TEXT,
  ADD COLUMN IF NOT EXISTS charge_time_2080_dc TEXT;

NOTIFY pgrst, 'reload schema';
