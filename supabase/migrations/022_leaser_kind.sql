-- Migration 022 : ajoute le champ 'kind' sur leaser_offers pour distinguer
-- les loueurs multi-marques (Ayvens, Arval, Alphabet, BPCE) des captives
-- constructeurs (DIAC, VW Bank, BMW Finance, etc.). Permet à l'ops de
-- typer chaque offre quand il saisit un loueur personnalisé.

ALTER TABLE leaser_offers ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'loueur';

-- Contrainte CHECK
ALTER TABLE leaser_offers DROP CONSTRAINT IF EXISTS leaser_offers_kind_check;
ALTER TABLE leaser_offers ADD CONSTRAINT leaser_offers_kind_check
  CHECK (kind IN ('loueur', 'captive'));

-- Vérification
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'leaser_offers' AND column_name = 'kind') AS col_kind,
  (SELECT COUNT(*) FROM leaser_offers) AS total_offres;
