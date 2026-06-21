-- Migration 046 : rang « top du mois » des véhicules (Mode Flotte v2)
--
-- top_rank : classement du véhicule dans sa catégorie (1 = n°1 recommandé du
-- mois, 2, 3…). Alimente l'auto-association du Mode Flotte : pour un véhicule
-- thermique de la car policy client, on propose les EV les mieux classés du
-- même segment. NULL / 0 = non classé.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS top_rank integer;

-- Vérification
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'top_rank';
