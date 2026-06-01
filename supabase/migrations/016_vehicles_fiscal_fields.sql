-- Ajoute les champs fiscaux nécessaires au calcul TCO complet (TVS, malus,
-- AEN, AND) porté depuis beev-tco-2026. Sans ces champs, le calculateur TCO
-- de tarif-master ne prenait en compte que loyer + énergie.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS prix_batterie NUMERIC DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS poids_vide NUMERIC DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS eco_score_bool BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS remise NUMERIC DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS carburant_inclus BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS conso_min_thermique NUMERIC DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS conso_max_thermique NUMERIC DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS conso_min_elec NUMERIC DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS conso_max_elec NUMERIC DEFAULT 0;

-- Pour les véhicules existants, on initialise les bornes de consommation
-- à partir du champ consumption unique déjà présent (consoMin = consoMax = consumption).
UPDATE vehicles
SET
  conso_min_elec = CASE WHEN energy = 'Électrique' OR energy = 'Hybride Rechargeable' THEN consumption ELSE 0 END,
  conso_max_elec = CASE WHEN energy = 'Électrique' OR energy = 'Hybride Rechargeable' THEN consumption ELSE 0 END,
  conso_min_thermique = CASE WHEN energy IN ('Essence', 'Diesel', 'Hybride', 'Mild Hybrid', 'Hybride Rechargeable') THEN consumption ELSE 0 END,
  conso_max_thermique = CASE WHEN energy IN ('Essence', 'Diesel', 'Hybride', 'Mild Hybrid', 'Hybride Rechargeable') THEN consumption ELSE 0 END
WHERE conso_min_elec = 0 AND conso_max_elec = 0 AND conso_min_thermique = 0 AND conso_max_thermique = 0;

-- Vérification
SELECT COUNT(*) AS total_vehicles, COUNT(*) FILTER (WHERE prix_batterie > 0) AS with_prix_batterie, COUNT(*) FILTER (WHERE poids_vide > 0) AS with_poids
FROM vehicles;
