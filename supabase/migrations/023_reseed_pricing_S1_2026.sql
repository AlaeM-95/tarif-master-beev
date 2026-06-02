-- Migration 023 (corrigée) : RE-SEED pricing S1 2026
-- Idempotente : ON CONFLICT DO UPDATE véhicules, DELETE puis INSERT offres.
-- Colonnes NOT NULL (price_ttc, monthly_lld) reçoivent 0 par défaut si la
-- cellule Excel est vide pour ne pas violer la contrainte.


INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('audi-a6-sportback-e-tron-design', 'AUDI', 'A6 Sportback E-TRON DESIGN', '', 'Berline', 'Électrique', 64950.0, 0, NULL, FALSE, 18.5, FALSE, 1.0, 1000.0, 'AUDI BAUER', 'BYMYCAR', FALSE, NULL, 'VOLKSWAGEN GROUP-Contrat Grand Compte 2026-N 1-NKIEYOQ VERSION 2-BEEV_1-NL87JZA_1-NL8WRMA.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'audi-a6-sportback-e-tron-design';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('audi-a6-sportback-e-tron-design', 'AYVENS', 'loueur', 49, 40000, 769.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('audi-a6-sportback-e-tron-design', 'ALPHABET', 'loueur', 37, 90000, 959.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('bmw-i4-edrive35', 'BMW', 'i4 eDrive35', '', 'Berline', 'Électrique', 57850.0, 0, 514.0, TRUE, 20.0, TRUE, 2.0, 1000.0, 'NEUBAUER', 'BYMYCAR', TRUE, '4 mois', 'Accord Grands Comptes BMW France 2026 - BEEV - (851682807) - 12_02_2026.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'bmw-i4-edrive35';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('bmw-i4-edrive35', 'AYVENS', 'loueur', 49, 40000, 649.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('bmw-i4-edrive35', 'AYVENS', 'loueur', 37, 90000, 869.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('audi-q6-e-tron-100kwh-performance-design', 'AUDI', 'Q6 E-TRON 100kwh Performance DESIGN', '', 'SUV', 'Électrique', 70900.0, 0, NULL, FALSE, 20.5, FALSE, 1.0, 1000.0, 'AUDI BAUER', 'BYMYCAR', FALSE, NULL, 'VOLKSWAGEN GROUP-Contrat Grand Compte 2026-N 1-NKIEYOQ VERSION 2-BEEV_1-NL87JZA_1-NL8WRMA.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'audi-q6-e-tron-100kwh-performance-design';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('audi-q6-e-tron-100kwh-performance-design', 'AYVENS', 'loueur', 49, 40000, 759.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('audi-q6-e-tron-100kwh-performance-design', 'AYVENS', 'loueur', 37, 90000, 939.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('mercedes-cla-85kwh-250-eq-business-edition', 'MERCEDES', 'CLA 85kWh 250+ EQ Business Edition', '', 'Berline', 'Électrique', 55500.0, 0, 792.0, TRUE, 12.5, TRUE, 1.5, 1000.0, 'BPM', 'BPM', TRUE, '4 mois', 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'mercedes-cla-85kwh-250-eq-business-edition';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('mercedes-cla-85kwh-250-eq-business-edition', 'AYVENS', 'loueur', 49, 40000, 699.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('mercedes-cla-85kwh-250-eq-business-edition', 'ARVAL', 'loueur', 37, 90000, 879.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('bmw-i4-edrive40', 'BMW', 'i4 eDrive40', '', 'Berline', 'Électrique', 64250.0, 0, NULL, TRUE, 20.0, FALSE, 2.0, 1000.0, 'NEUBAUER', 'SELLENS', FALSE, NULL, 'Accord Grands Comptes BMW France 2026 - BEEV - (851682807) - 12_02_2026.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'bmw-i4-edrive40';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('bmw-i4-edrive40', 'AYVENS', 'loueur', 49, 40000, 590.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('bmw-i4-edrive40', 'AYVENS', 'loueur', 37, 90000, 790.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('bmw-ix2-edrvie-20', 'BMW', 'iX2 eDrvie 20', '', 'SUV', 'Électrique', 46990.0, 0, NULL, TRUE, 16.0, FALSE, 2.0, 1000.0, 'NEUBAUER', 'GRIM', FALSE, NULL, 'Accord Grands Comptes BMW France 2026 - BEEV - (851682807) - 12_02_2026.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'bmw-ix2-edrvie-20';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('bmw-ix2-edrvie-20', 'AYVENS', 'loueur', 49, 40000, 519.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('bmw-ix2-edrvie-20', 'AYVENS', 'loueur', 37, 90000, 679.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('bmw-i5e-edrive40', 'BMW', 'i5e eDrive40', '', 'Berline', 'Électrique', 76250.0, 0, NULL, FALSE, 20.0, FALSE, 2.0, 1000.0, 'NEUBAUER', 'SELLENS', FALSE, NULL, 'Accord Grands Comptes BMW France 2026 - BEEV - (851682807) - 12_02_2026.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'bmw-i5e-edrive40';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('bmw-i5e-edrive40', 'AYVENS', 'loueur', 49, 40000, 790.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('bmw-i5e-edrive40', 'AYVENS', 'loueur', 37, 90000, 1050.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('bmw-i5e-touring-edrive40', 'BMW', 'i5e TOURING eDrive40', '', 'Break', 'Électrique', 77750.0, 0, NULL, FALSE, 20.0, FALSE, 2.0, 1000.0, 'NEUBAUER', 'SELLENS', FALSE, NULL, 'Accord Grands Comptes BMW France 2026 - BEEV - (851682807) - 12_02_2026.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'bmw-i5e-touring-edrive40';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('bmw-i5e-touring-edrive40', 'AYVENS', 'loueur', 49, 40000, 799.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('bmw-i5e-touring-edrive40', 'AYVENS', 'loueur', 37, 90000, 1090.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('mercedes-cla-85kwh-shooting-brake-250-eq-business-line', 'MERCEDES', 'CLA 85kWh Shooting Brake 250+ EQ Business Line', '', 'Berline', 'Électrique', 56900.0, 0, NULL, TRUE, 12.5, FALSE, 1.5, 1000.0, 'BPM', 'BPM', FALSE, NULL, 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'mercedes-cla-85kwh-shooting-brake-250-eq-business-line';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('mercedes-cla-85kwh-shooting-brake-250-eq-business-line', 'ARVAL', 'loueur', 49, 40000, 689.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('mercedes-cla-85kwh-shooting-brake-250-eq-business-line', 'ALPHABET', 'loueur', 37, 90000, 869.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('polestar-polestar-2-lr-rwd', 'POLESTAR', 'POLESTAR 2 LR RWD', '', 'Berline', 'Électrique', 49800.0, 0, NULL, FALSE, 18.0, FALSE, 1.0, 1000.0, 'ABVV', 'ABVV', TRUE, NULL, 'CRA LOCAL BEEV 2026   (1).pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'polestar-polestar-2-lr-rwd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('polestar-polestar-2-lr-rwd', 'AYVENS', 'loueur', 49, 40000, 589.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('polestar-polestar-2-lr-rwd', 'AYVENS', 'loueur', 37, 90000, 779.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('byd-dolphin-surf-boost', 'BYD', 'DOLPHIN SURF BOOST', '', 'Citadine', 'Électrique', 23990.0, 0, NULL, FALSE, 12.5, FALSE, 1.0, 750.0, 'BPM', 'BYMYCAR', FALSE, NULL, 'Tripartite 2026 - BYD FRANCE - BEEV.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'byd-dolphin-surf-boost';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-dolphin-surf-boost', 'AYVENS', 'loueur', 49, 40000, 339.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-dolphin-surf-boost', 'AYVENS', 'loueur', 37, 90000, 449.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('polestar-polestar-4-lr-single', 'POLESTAR', 'POLESTAR 4 LR SINGLE', '', 'Berline', 'Électrique', 61800.0, 0, 620.0, FALSE, 24.0, TRUE, 1.0, 1000.0, 'ABVV', 'ABVV', TRUE, '4 mois', 'CRA LOCAL BEEV 2026   (1).pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'polestar-polestar-4-lr-single';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('polestar-polestar-4-lr-single', 'AYVENS', 'loueur', 49, 40000, 579.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('polestar-polestar-4-lr-single', 'AYVENS', 'loueur', 37, 90000, 800.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('byd-dolphin-comfort', 'BYD', 'DOLPHIN COMFORT', '', 'Citadine', 'Électrique', 34990.0, 0, NULL, FALSE, 18.0, FALSE, 1.0, 750.0, 'BPM', 'BYMYCAR', FALSE, NULL, 'Tripartite 2026 - BYD FRANCE - BEEV.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'byd-dolphin-comfort';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-dolphin-comfort', 'AYVENS', 'loueur', 49, 40000, 449.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-dolphin-comfort', 'AYVENS', 'loueur', 37, 90000, 589.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('byd-atto2-comfort', 'BYD', 'ATTO2 COMFORT', '', 'Compacte', 'Électrique', 35990.0, 0, NULL, FALSE, 15.0, FALSE, 1.0, 1000.0, 'BPM', 'BYMYCAR', FALSE, NULL, 'Tripartite 2026 - BYD FRANCE - BEEV.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'byd-atto2-comfort';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-atto2-comfort', 'AYVENS', 'loueur', 49, 40000, 439.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-atto2-comfort', 'AYVENS', 'loueur', 37, 90000, 589.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('tesla-model-3-standard-rwd', 'TESLA', 'MODEL 3 STANDARD RWD', '', 'Berline', 'Électrique', 36990.0, 0, NULL, FALSE, 11.0, FALSE, 0.0, 1000.0, 'TESLA', 'TESLA', TRUE, NULL, 'BPOEM_EMEA_491787 (2).pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'tesla-model-3-standard-rwd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('tesla-model-3-standard-rwd', 'AYVENS', 'loueur', 49, 40000, 449.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('tesla-model-3-standard-rwd', 'AYVENS', 'loueur', 37, 90000, 589.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('byd-seal-design-rwd', 'BYD', 'SEAL DESIGN RWD', '', 'Berline', 'Électrique', 46990.0, 0, NULL, FALSE, 17.0, FALSE, 1.0, 1000.0, 'BPM', 'BYMYCAR', FALSE, NULL, 'Tripartite 2026 - BYD FRANCE - BEEV.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'byd-seal-design-rwd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-seal-design-rwd', 'AYVENS', 'loueur', 49, 40000, 569.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-seal-design-rwd', 'AYVENS', 'loueur', 37, 90000, 749.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('tesla-model-3-premium-lr-rwd', 'TESLA', 'MODEL 3 PREMIUM LR RWD', '', 'Berline', 'Électrique', 44990.0, 0, 750.0, FALSE, 14.000000000000002, TRUE, 0.0, 1000.0, 'TESLA', 'TESLA', TRUE, '3 mois', 'BPOEM_EMEA_491787 (2).pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'tesla-model-3-premium-lr-rwd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('tesla-model-3-premium-lr-rwd', 'AYVENS', 'loueur', 49, 40000, 549.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('tesla-model-3-premium-lr-rwd', 'AYVENS', 'loueur', 37, 90000, 729.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('byd-tang-flagship', 'BYD', 'TANG Flagship', '', 'SUV', 'Électrique', 72000.0, 0, NULL, FALSE, 21.0, FALSE, 1.0, 1000.0, 'BPM', 'BYMYCAR', FALSE, NULL, 'Tripartite 2026 - BYD FRANCE - BEEV.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'byd-tang-flagship';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-tang-flagship', 'AYVENS', 'loueur', 49, 40000, 749.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-tang-flagship', 'AYVENS', 'loueur', 37, 90000, 1019.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('volkswagen-id-7-86kwh-pro-s-life-max', 'VOLKSWAGEN', 'ID.7 86kWh Pro S Life Max', '', 'Berline', 'Électrique', 62690.0, 0, 703.0, TRUE, 18.5, TRUE, 1.0, 1000.0, 'NEUBAUER', 'BYMYCAR', TRUE, '3 mois', 'VOLKSWAGEN GROUP-Contrat Grand Compte 2026-N 1-NKIEYOQ VERSION 2-BEEV_1-NL87JZA_1-NL8WRMA.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'volkswagen-id-7-86kwh-pro-s-life-max';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volkswagen-id-7-86kwh-pro-s-life-max', 'AYVENS', 'loueur', 49, 40000, 719.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volkswagen-id-7-86kwh-pro-s-life-max', 'ARVAL', 'loueur', 37, 90000, 919.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('xpeng-p7-lr-fwd', 'XPENG', 'P7+ LR FWD', '', 'Berline', 'Électrique', 49990.0, 0, 530.0, FALSE, 18.0, TRUE, 0.5, 1000.0, 'BPM', 'BPM', FALSE, '3 mois', 'Accord tripartie Xpeng Motors France X Beev.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'xpeng-p7-lr-fwd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('xpeng-p7-lr-fwd', 'AYVENS', 'loueur', 49, 40000, 639.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('xpeng-p7-lr-fwd', 'AYVENS', 'loueur', 37, 90000, 859.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('ford-puma-gen-e-43kwh-standard-range', 'FORD', 'PUMA GEN-E 43kWh Standard Range', '', 'Citadine', 'Électrique', 33990.0, 0, 417.0, TRUE, 20.0, TRUE, 2.0, 750.0, 'NEUBAUER', 'NEUBAUER', TRUE, '3 mois', 'BEEV LLD 2026.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'ford-puma-gen-e-43kwh-standard-range';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('ford-puma-gen-e-43kwh-standard-range', 'AYVENS', 'loueur', 49, 40000, 379.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('ford-puma-gen-e-43kwh-standard-range', 'AYVENS', 'loueur', 37, 90000, 519.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('kia-kia-ev2-air-61kwh', 'KIA', 'KIA EV2 AIR 61kWh', '', 'Citadine', 'Électrique', 33320.0, 0, 453.0, TRUE, 15.0, TRUE, 1.0, 750.0, 'NEUBAUER', 'NEUBAUER', TRUE, '3 mois', 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'kia-kia-ev2-air-61kwh';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('kia-kia-ev2-air-61kwh', 'AYVENS', 'loueur', 49, 40000, 429.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('kia-kia-ev2-air-61kwh', 'AYVENS', 'loueur', 37, 90000, 569.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('mg-mg4-ev-urban-54-kwh-comfort', 'MG', 'MG4 EV Urban 54 kWh Comfort', '', 'Citadine', 'Électrique', 27495.0, 0, 416.0, FALSE, 21.0, TRUE, 1.0, 750.0, 'JEANNIN', 'JEANNIN', TRUE, '3 mois', '?', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'mg-mg4-ev-urban-54-kwh-comfort';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('mg-mg4-ev-urban-54-kwh-comfort', 'AYVENS', 'loueur', 49, 40000, 339.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('mg-mg4-ev-urban-54-kwh-comfort', 'AYVENS', 'loueur', 37, 90000, 449.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('byd-atto3-evo-design', 'BYD', 'ATTO3 EVO DESIGN', '', 'Compacte', 'Électrique', 38990.0, 0, NULL, FALSE, 21.0, FALSE, 1.0, 1000.0, 'BPM', 'BYMYCAR', FALSE, NULL, 'Tripartite 2026 - BYD FRANCE - BEEV.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'byd-atto3-evo-design';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-atto3-evo-design', 'AYVENS', 'loueur', 49, 40000, 409.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-atto3-evo-design', 'AYVENS', 'loueur', 37, 90000, 559.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('hyundai-inster-49kwh-intuitive-5p', 'HYUNDAI', 'INSTER 49kWh INTUITIVE 5P', '', 'Citadine', 'Électrique', 28600.0, 0, NULL, TRUE, 21.0, FALSE, 1.0, 750.0, 'BPM', 'SELLENS', FALSE, NULL, 'BEEV FAST START BROOKER S1 2026_V1.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'hyundai-inster-49kwh-intuitive-5p';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('hyundai-inster-49kwh-intuitive-5p', 'AYVENS', 'loueur', 49, 40000, 329.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('hyundai-inster-49kwh-intuitive-5p', 'AYVENS', 'loueur', 37, 90000, 449.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('hyundai-ioniq-9-110kwh-creative-7p', 'HYUNDAI', 'IONIQ 9 110kWh CREATIVE 7P', '', 'SUV', 'Électrique', 69990.0, 0, NULL, FALSE, 24.0, FALSE, 1.0, 1000.0, 'BPM', 'SELLENS', FALSE, NULL, 'BEEV FAST START BROOKER S1 2026_V1.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'hyundai-ioniq-9-110kwh-creative-7p';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('hyundai-ioniq-9-110kwh-creative-7p', 'AYVENS', 'loueur', 49, 40000, 609.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('hyundai-ioniq-9-110kwh-creative-7p', 'AYVENS', 'loueur', 37, 90000, 839.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('volkswagen-id-polo-life', 'VOLKSWAGEN', 'ID. POLO LIFE', '', 'Citadine', 'Électrique', 35820.0, 0, 454.0, TRUE, 19.0, TRUE, 1.0, 750.0, 'NEUBAUER', 'BYMYCAR', FALSE, '4 mois', 'VOLKSWAGEN GROUP-Contrat Grand Compte 2026-N 1-NKIEYOQ VERSION 2-BEEV_1-NL87JZA_1-NL8WRMA.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'volkswagen-id-polo-life';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volkswagen-id-polo-life', 'ALPHABET', 'loueur', 49, 40000, 445.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volkswagen-id-polo-life', 'ALPHABET', 'loueur', 37, 90000, 557.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('ford-capri-extended-range-79kwh-select', 'FORD', 'CAPRI Extended Range 79kWh Select', '', 'SUV', 'Électrique', 48490.0, 0, NULL, TRUE, 24.0, FALSE, 1.0, 1000.0, 'NEUBAUER', 'NEUBAUER', FALSE, NULL, 'BEEV LLD 2026.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'ford-capri-extended-range-79kwh-select';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('ford-capri-extended-range-79kwh-select', 'AYVENS', 'loueur', 49, 40000, 469.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('ford-capri-extended-range-79kwh-select', 'AYVENS', 'loueur', 37, 90000, 649.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('kia-ev9-100kwh-air', 'KIA', 'EV9 100kWh AIR', '', 'SUV', 'Électrique', 71400.0, 0, NULL, FALSE, 20.0, FALSE, 1.0, 1000.0, 'NEUBAUER', 'SELLENS', FALSE, NULL, 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'kia-ev9-100kwh-air';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('kia-ev9-100kwh-air', 'AYVENS', 'loueur', 49, 40000, 689.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('kia-ev9-100kwh-air', 'AYVENS', 'loueur', 37, 90000, 939.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('cupra-new-born-business-79-kwh', 'CUPRA', 'NEW BORN BUSINESS 79 KWH', '', 'Compacte', 'Électrique', 44670.0, 0, 627.0, TRUE, 17.0, TRUE, 1.5, 1000.0, 'ABVV', 'BYMYCAR', FALSE, '3 mois', 'VOLKSWAGEN GROUP-Contrat Grand Compte 2026-N 1-NKIEYOQ VERSION 2-BEEV_1-NL87JZA_1-NL8WRMA.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'cupra-new-born-business-79-kwh';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('cupra-new-born-business-79-kwh', 'ARVAL', 'loueur', 49, 40000, 569.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('cupra-new-born-business-79-kwh', 'ARVAL', 'loueur', 37, 90000, 709.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('kia-ev3-81-4kwh-204ch-air', 'KIA', 'EV3 81.4kWh 204ch AIR', '', 'Compacte', 'Électrique', 41490.0, 0, NULL, FALSE, 14.000000000000002, FALSE, 1.0, 1000.0, 'NEUBAUER', 'SELLENS', FALSE, NULL, 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'kia-ev3-81-4kwh-204ch-air';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('kia-ev3-81-4kwh-204ch-air', 'AYVENS', 'loueur', 49, 40000, 489.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('kia-ev3-81-4kwh-204ch-air', 'AYVENS', 'loueur', 37, 90000, 659.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('kia-ev6-84kwh-air', 'KIA', 'EV6 84kWh AIR', '', 'SUV', 'Électrique', 48250.0, 0, NULL, FALSE, 15.0, FALSE, 1.0, 1000.0, 'NEUBAUER', 'SELLENS', FALSE, NULL, 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'kia-ev6-84kwh-air';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('kia-ev6-84kwh-air', 'AYVENS', 'loueur', 49, 40000, 559.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('kia-ev6-84kwh-air', 'AYVENS', 'loueur', 37, 90000, 749.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('hyundai-kona-ev-65kwh-intuitive', 'HYUNDAI', 'KONA EV 65kWh INTUITIVE', '', 'Compacte', 'Électrique', 40250.0, 0, 514.0, TRUE, 25.0, TRUE, 1.0, 1000.0, 'BPM', 'BPM', TRUE, '4 mois', 'BEEV FAST START BROOKER S1 2026_V1.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'hyundai-kona-ev-65kwh-intuitive';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('hyundai-kona-ev-65kwh-intuitive', 'ARVAL', 'loueur', 49, 40000, 429.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('hyundai-kona-ev-65kwh-intuitive', 'ARVAL', 'loueur', 37, 90000, 539.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('mercedes-eqa-250', 'MERCEDES', 'EQA 250+', '', 'SUV', 'Électrique', 46950.0, 0, NULL, TRUE, 12.5, FALSE, 1.5, 1000.0, 'BPM', 'BPM', FALSE, NULL, 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'mercedes-eqa-250';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('mercedes-eqa-250', 'ARVAL', 'loueur', 49, 40000, 579.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('mercedes-eqa-250', 'ARVAL', 'loueur', 37, 90000, 739.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('renault-megane-e-tech-autonomie-confort-techno', 'RENAULT', 'MEGANE E-TECH Autonomie Confort Techno', '', 'Compacte', 'Électrique', 39500.0, 0, NULL, TRUE, 5.0, FALSE, 1.0, 1000.0, 'RRG', 'RRG', FALSE, NULL, 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'renault-megane-e-tech-autonomie-confort-techno';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('renault-megane-e-tech-autonomie-confort-techno', 'ALPHABET', 'loueur', 49, 40000, 529.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('renault-megane-e-tech-autonomie-confort-techno', 'ALPHABET', 'loueur', 37, 90000, 659.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('mercedes-glb-250-progressive-line', 'MERCEDES', 'GLB 250+ Progressive Line', '', 'SUV', 'Électrique', 55900.0, 0, NULL, FALSE, 12.5, FALSE, 1.5, 1000.0, 'BPM', 'BPM', FALSE, NULL, 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'mercedes-glb-250-progressive-line';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('mercedes-glb-250-progressive-line', 'AYVENS', 'loueur', 49, 40000, 669.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('mercedes-glb-250-progressive-line', 'ARVAL', 'loueur', 37, 90000, 879.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('kia-ev4-81-4kwh-204ch-air', 'KIA', 'EV4 81.4kWh 204ch AIR', '', 'Compacte', 'Électrique', 42890.0, 0, 625.0, TRUE, 20.0, TRUE, 1.0, 1000.0, 'NEUBAUER', 'NEUBAUER', TRUE, '3 mois', 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'kia-ev4-81-4kwh-204ch-air';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('kia-ev4-81-4kwh-204ch-air', 'AYVENS', 'loueur', 49, 40000, 499.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('kia-ev4-81-4kwh-204ch-air', 'ALPHABET', 'loueur', 37, 90000, 639.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('nissan-micra-52kwh-advance', 'NISSAN', 'MICRA 52kWh ADVANCE', '', 'Citadine', 'Électrique', 33500.0, 0, NULL, TRUE, 13.0, FALSE, 1.0, 750.0, 'NEUBAUER', 'NEUBAUER', FALSE, NULL, 'Beev - Accord NISSAN AYVENS FY2026.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'nissan-micra-52kwh-advance';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('nissan-micra-52kwh-advance', 'AYVENS', 'loueur', 49, 40000, 449.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('nissan-micra-52kwh-advance', 'ALPHABET', 'loueur', 37, 90000, 589.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('nissan-leaf-75kwh-engage', 'NISSAN', 'LEAF 75kWh ENGAGE', '', 'Compacte', 'Électrique', 40300.0, 0, NULL, TRUE, 13.0, FALSE, 1.0, 1000.0, 'NEUBAUER', 'NEUBAUER', FALSE, NULL, 'Beev - Accord NISSAN AYVENS FY2026.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'nissan-leaf-75kwh-engage';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('nissan-leaf-75kwh-engage', 'ALPHABET', 'loueur', 49, 40000, 519.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('nissan-leaf-75kwh-engage', 'ALPHABET', 'loueur', 37, 90000, 669.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('nissan-ariya-87kwh-engage', 'NISSAN', 'ARIYA 87kWh ENGAGE', '', 'SUV', 'Électrique', 45800.0, 0, NULL, FALSE, 16.0, FALSE, 1.0, 1000.0, 'NEUBAUER', 'NEUBAUER', FALSE, NULL, 'Beev - Accord NISSAN AYVENS FY2026.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'nissan-ariya-87kwh-engage';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('nissan-ariya-87kwh-engage', 'ARVAL', 'loueur', 49, 40000, 559.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('nissan-ariya-87kwh-engage', 'ALPHABET', 'loueur', 37, 90000, 709.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('mg-mg4-premium-77-kwh', 'MG', 'MG4 Premium 77 kWh', '', 'Compacte', 'Électrique', 36990.0, 0, 545.0, FALSE, 21.0, TRUE, 1.0, 750.0, 'JEANNIN', 'JEANNIN', TRUE, '3 mois', '?', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'mg-mg4-premium-77-kwh';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('mg-mg4-premium-77-kwh', 'AYVENS', 'loueur', 49, 40000, 429.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('mg-mg4-premium-77-kwh', 'AYVENS', 'loueur', 37, 90000, 569.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('volkswagen-id-3-neo-life-79kwh-2026', 'VOLKSWAGEN', 'ID.3 NEO LIFE 79kWh 2026', '', 'Compacte', 'Électrique', 45900.0, 0, 630.0, TRUE, 18.5, TRUE, 1.0, 1000.0, 'NEUBAUER', 'BYMYCAR', FALSE, '2 mois', 'VOLKSWAGEN GROUP-Contrat Grand Compte 2026-N 1-NKIEYOQ VERSION 2-BEEV_1-NL87JZA_1-NL8WRMA.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'volkswagen-id-3-neo-life-79kwh-2026';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volkswagen-id-3-neo-life-79kwh-2026', 'AYVENS', 'loueur', 49, 40000, 599.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volkswagen-id-3-neo-life-79kwh-2026', 'ARVAL', 'loueur', 37, 90000, 769.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('volvo-ex30-start-single-extended-range-start', 'VOLVO', 'EX30 START SINGLE EXTENDED RANGE START', '', 'Compacte', 'Électrique', 43300.0, 0, 476.0, TRUE, 18.0, TRUE, 1.0, 1000.0, 'ABVV', 'ABVV', TRUE, '3 mois', 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'volvo-ex30-start-single-extended-range-start';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volvo-ex30-start-single-extended-range-start', 'AYVENS', 'loueur', 49, 40000, 509.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volvo-ex30-start-single-extended-range-start', 'AYVENS', 'loueur', 37, 90000, 699.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('audi-new-q4-e-tron-45-82kwh', 'AUDI', 'NEW Q4 E-TRON 45 82kWh', '', 'SUV', 'Électrique', 46990.0, 0, 563.0, TRUE, 17.5, TRUE, 1.0, 1000.0, 'BYMYCAR', 'BYMYCAR', FALSE, '3 mois', 'VOLKSWAGEN GROUP-Contrat Grand Compte 2026-N 1-NKIEYOQ VERSION 2-BEEV_1-NL87JZA_1-NL8WRMA.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'audi-new-q4-e-tron-45-82kwh';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('audi-new-q4-e-tron-45-82kwh', 'ALPHABET', 'loueur', 49, 40000, 579.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('audi-new-q4-e-tron-45-82kwh', 'ALPHABET', 'loueur', 37, 90000, 709.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('polestar-polestar-2-standard', 'POLESTAR', 'POLESTAR 2 STANDARD', '', 'Berline', 'Électrique', 46800.0, 0, NULL, FALSE, 18.0, FALSE, 1.0, 1000.0, 'ABVV', 'ABVV', TRUE, NULL, 'CRA LOCAL BEEV 2026   (1).pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'polestar-polestar-2-standard';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('polestar-polestar-2-standard', 'AYVENS', 'loueur', 49, 40000, 559.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('polestar-polestar-2-standard', 'AYVENS', 'loueur', 37, 90000, 739.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('polestar-polestar-3-lr-single', 'POLESTAR', 'POLESTAR 3 LR SINGLE', '', 'SUV', 'Électrique', 79800.0, 0, NULL, FALSE, 28.999999999999996, FALSE, 1.0, 1000.0, 'ABVV', 'ABVV', TRUE, NULL, 'CRA LOCAL BEEV 2026   (1).pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'polestar-polestar-3-lr-single';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('polestar-polestar-3-lr-single', 'AYVENS', 'loueur', 49, 40000, 639.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('polestar-polestar-3-lr-single', 'AYVENS', 'loueur', 37, 90000, 879.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('renault-r5-evolution-150ch-autonomie-confort', 'RENAULT', 'R5 Evolution 150ch Autonomie Confort', '', 'Citadine', 'Électrique', 31490.0, 0, NULL, TRUE, 5.0, FALSE, 1.0, 750.0, 'RRG', 'RRG', FALSE, NULL, 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'renault-r5-evolution-150ch-autonomie-confort';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('renault-r5-evolution-150ch-autonomie-confort', 'AYVENS', 'loueur', 49, 40000, 469.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('renault-r5-evolution-150ch-autonomie-confort', 'AYVENS', 'loueur', 37, 90000, 599.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('bmw-ix1-edrive-20', 'BMW', 'iX1 eDrive 20', '', 'SUV', 'Électrique', 46990.0, 0, 514.0, TRUE, 16.0, TRUE, 2.0, 1000.0, 'NEUBAUER', 'BYMYCAR', TRUE, '4 mois', 'Accord Grands Comptes BMW France 2026 - BEEV - (851682807) - 12_02_2026.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'bmw-ix1-edrive-20';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('bmw-ix1-edrive-20', 'ARVAL', 'loueur', 49, 40000, 589.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('bmw-ix1-edrive-20', 'ARVAL', 'loueur', 37, 90000, 749.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('bmw-ix3-50-xdrive', 'BMW', 'iX3 50 xDrive', '', 'SUV', 'Électrique', 71950.0, 0, 805.0, FALSE, 11.0, TRUE, 2.0, 1000.0, 'NEUBAUER', 'BYMYCAR', FALSE, '12 mois', 'Accord Grands Comptes BMW France 2026 - BEEV - (851682807) - 12_02_2026.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'bmw-ix3-50-xdrive';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('bmw-ix3-50-xdrive', 'AYVENS', 'loueur', 49, 40000, 879.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('bmw-ix3-50-xdrive', 'ALPHABET', 'loueur', 37, 90000, 1129.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('skoda-epiq', 'SKODA', 'EPIQ', '', 'Citadine', 'Électrique', 0, 0, NULL, TRUE, 17.5, FALSE, 1.5, 1000.0, 'ABVV', 'ABVV', FALSE, NULL, NULL, NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'skoda-epiq';
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('byd-seal-u-design-rwd', 'BYD', 'SEAL U DESIGN RWD', '', 'SUV', 'Électrique', 46390.0, 0, 500.0, FALSE, 15.0, TRUE, 1.0, 1000.0, 'BPM', 'BYMYCAR', TRUE, '4 mois', 'Tripartite 2026 - BYD FRANCE - BEEV.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'byd-seal-u-design-rwd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-seal-u-design-rwd', 'AYVENS', 'loueur', 49, 40000, 539.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-seal-u-design-rwd', 'AYVENS', 'loueur', 37, 90000, 739.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('byd-sealion-7-comfort', 'BYD', 'SEALION 7 COMFORT', '', 'SUV', 'Électrique', 46990.0, 0, NULL, FALSE, 13.0, FALSE, 1.0, 1000.0, 'BPM', 'BYMYCAR', FALSE, NULL, 'Tripartite 2026 - BYD FRANCE - BEEV.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'byd-sealion-7-comfort';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-sealion-7-comfort', 'AYVENS', 'loueur', 49, 40000, 599.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('byd-sealion-7-comfort', 'AYVENS', 'loueur', 37, 90000, 819.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('skoda-peaq', 'SKODA', 'PEAQ', '', 'SUV', 'Électrique', 0, 0, NULL, TRUE, 17.5, FALSE, 1.5, 1000.0, 'ABVV', 'ABVV', FALSE, NULL, NULL, NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'skoda-peaq';
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('cupra-tavascan-endurance-77-kwh', 'CUPRA', 'TAVASCAN ENDURANCE 77 kWh', '', 'SUV', 'Électrique', 47430.0, 0, 568.0, TRUE, 20.0, TRUE, 1.5, 1000.0, 'ABVV', 'BYMYCAR', TRUE, '4 mois', 'VOLKSWAGEN GROUP-Contrat Grand Compte 2026-N 1-NKIEYOQ VERSION 2-BEEV_1-NL87JZA_1-NL8WRMA.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'cupra-tavascan-endurance-77-kwh';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('cupra-tavascan-endurance-77-kwh', 'AYVENS', 'loueur', 49, 40000, 489.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('cupra-tavascan-endurance-77-kwh', 'ARVAL', 'loueur', 37, 90000, 609.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('ford-explorer-extended-range-79kwh-select', 'FORD', 'EXPLORER Extended Range 79kWh Select', '', 'SUV', 'Électrique', 45990.0, 0, 602.0, TRUE, 24.0, TRUE, 2.0, 1000.0, 'NEUBAUER', 'NEUBAUER', TRUE, '3 mois', 'BEEV LLD 2026.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'ford-explorer-extended-range-79kwh-select';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('ford-explorer-extended-range-79kwh-select', 'AYVENS', 'loueur', 49, 40000, 479.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('ford-explorer-extended-range-79kwh-select', 'ALPHABET', 'loueur', 37, 90000, 619.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('tesla-model-y-premium-lr-awd', 'TESLA', 'MODEL Y PREMIUM LR AWD', '', 'SUV', 'Électrique', 52990.0, 0, NULL, TRUE, 8.0, FALSE, 0.0, 1000.0, 'TESLA', 'TESLA', TRUE, NULL, 'BPOEM_EMEA_491787 (2).pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'tesla-model-y-premium-lr-awd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('tesla-model-y-premium-lr-awd', 'ARVAL', 'loueur', 49, 40000, 639.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('tesla-model-y-premium-lr-awd', 'ARVAL', 'loueur', 37, 90000, 819.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('tesla-model-3-premium-lr-awd', 'TESLA', 'MODEL 3 PREMIUM LR AWD', '', 'Berline', 'Électrique', 49990.0, 0, NULL, FALSE, 14.000000000000002, FALSE, 0.0, 1000.0, 'TESLA', 'TESLA', TRUE, NULL, 'BPOEM_EMEA_491787 (2).pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'tesla-model-3-premium-lr-awd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('tesla-model-3-premium-lr-awd', 'AYVENS', 'loueur', 49, 40000, 609.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('tesla-model-3-premium-lr-awd', 'AYVENS', 'loueur', 37, 90000, 789.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('hyundai-ioniq-5-84kwh-intuitive-rwd', 'HYUNDAI', 'IONIQ 5 84kWh INTUITIVE RWD', '', 'SUV', 'Électrique', 49450.0, 0, 570.0, FALSE, 22.0, TRUE, 1.0, 1000.0, 'BPM', 'BPM', TRUE, '3 mois', 'BEEV FAST START BROOKER S1 2026_V1.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'hyundai-ioniq-5-84kwh-intuitive-rwd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('hyundai-ioniq-5-84kwh-intuitive-rwd', 'AYVENS', 'loueur', 49, 40000, 529.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('hyundai-ioniq-5-84kwh-intuitive-rwd', 'ARVAL', 'loueur', 37, 90000, 709.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('tesla-model-y-standard-lr-rwd', 'TESLA', 'MODEL Y STANDARD LR RWD', '', 'SUV', 'Électrique', 44990.0, 0, NULL, TRUE, 8.0, FALSE, 0.0, 1000.0, 'TESLA', 'TESLA', TRUE, NULL, 'BPOEM_EMEA_491787 (2).pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'tesla-model-y-standard-lr-rwd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('tesla-model-y-standard-lr-rwd', 'ARVAL', 'loueur', 49, 40000, 579.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('tesla-model-y-standard-lr-rwd', 'ARVAL', 'loueur', 37, 90000, 729.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('mercedes-glc-avangtarde-line-400-4m', 'MERCEDES', 'GLC Avangtarde Line 400 4M', '', 'SUV', 'Électrique', 71900.0, 0, 715.0, FALSE, 12.5, TRUE, 1.5, 1000.0, 'BPM', 'BPM', TRUE, '4 mois', 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'mercedes-glc-avangtarde-line-400-4m';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('mercedes-glc-avangtarde-line-400-4m', 'AYVENS', 'loueur', 49, 40000, 839.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('mercedes-glc-avangtarde-line-400-4m', 'ALPHABET', 'loueur', 37, 90000, 1089.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('renault-scenic-techno-220-ch-grande-autonomie', 'RENAULT', 'SCENIC Techno 220 ch Grande Autonomie', '', 'SUV', 'Électrique', 46990.0, 0, 623.0, TRUE, 5.0, TRUE, 1.0, 1000.0, 'RRG', 'RRG', TRUE, '3 mois', 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'renault-scenic-techno-220-ch-grande-autonomie';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('renault-scenic-techno-220-ch-grande-autonomie', 'AYVENS', 'loueur', 49, 40000, 569.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('renault-scenic-techno-220-ch-grande-autonomie', 'AYVENS', 'loueur', 37, 90000, 769.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('volkswagen-id-7-tourer-86kwh-pro-s-life-max', 'VOLKSWAGEN', 'ID.7 TOURER 86kWh Pro S Life Max', '', 'Break', 'Électrique', 62390.0, 0, NULL, TRUE, 23.5, FALSE, 1.0, 1000.0, 'NEUBAUER', 'BYMYCAR', FALSE, NULL, 'VOLKSWAGEN GROUP-Contrat Grand Compte 2026-N 1-NKIEYOQ VERSION 2-BEEV_1-NL87JZA_1-NL8WRMA.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'volkswagen-id-7-tourer-86kwh-pro-s-life-max';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volkswagen-id-7-tourer-86kwh-pro-s-life-max', 'AYVENS', 'loueur', 49, 40000, 639.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volkswagen-id-7-tourer-86kwh-pro-s-life-max', 'ALPHABET', 'loueur', 37, 90000, 839.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('volkswagen-id-3-79kwh-pro-s', 'VOLKSWAGEN', 'ID.3 79kWh Pro S', '', 'Compacte', 'Électrique', 42990.0, 0, NULL, TRUE, 19.5, FALSE, 1.0, 1000.0, 'NEUBAUER', 'BYMYCAR', FALSE, NULL, 'VOLKSWAGEN GROUP-Contrat Grand Compte 2026-N 1-NKIEYOQ VERSION 2-BEEV_1-NL87JZA_1-NL8WRMA.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'volkswagen-id-3-79kwh-pro-s';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volkswagen-id-3-79kwh-pro-s', 'AYVENS', 'loueur', 49, 40000, 519.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volkswagen-id-3-79kwh-pro-s', 'AYVENS', 'loueur', 37, 90000, 699.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('skoda-elroq-85-clever', 'SKODA', 'ELROQ 85 CLEVER', '', 'SUV', 'Électrique', 43680.0, 0, 576.0, TRUE, 17.5, TRUE, 1.5, 1000.0, 'ABVV', 'ABVV', TRUE, '4 mois', 'VOLKSWAGEN GROUP-Contrat Grand Compte 2026-N 1-NKIEYOQ VERSION 2-BEEV_1-NL87JZA_1-NL8WRMA.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'skoda-elroq-85-clever';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('skoda-elroq-85-clever', 'AYVENS', 'loueur', 49, 40000, 489.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('skoda-elroq-85-clever', 'ARVAL', 'loueur', 37, 90000, 669.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('volkswagen-id-5-pro-life', 'VOLKSWAGEN', 'ID.5 Pro Life', '', 'SUV', 'Électrique', 50500.0, 0, NULL, TRUE, 22.5, FALSE, 1.0, 1000.0, 'NEUBAUER', 'BYMYCAR', FALSE, NULL, 'VOLKSWAGEN GROUP-Contrat Grand Compte 2026-N 1-NKIEYOQ VERSION 2-BEEV_1-NL87JZA_1-NL8WRMA.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'volkswagen-id-5-pro-life';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volkswagen-id-5-pro-life', 'AYVENS', 'loueur', 49, 40000, 509.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volkswagen-id-5-pro-life', 'AYVENS', 'loueur', 37, 90000, 659.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('skoda-enyaq-85-element', 'SKODA', 'ENYAQ 85 ELEMENT', '', 'SUV', 'Électrique', 46950.0, 0, 581.0, TRUE, 19.5, TRUE, 1.5, 1000.0, 'ABVV', 'ABVV', TRUE, '4 mois', 'VOLKSWAGEN GROUP-Contrat Grand Compte 2026-N 1-NKIEYOQ VERSION 2-BEEV_1-NL87JZA_1-NL8WRMA.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'skoda-enyaq-85-element';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('skoda-enyaq-85-element', 'AYVENS', 'loueur', 49, 40000, 509.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('skoda-enyaq-85-element', 'ARVAL', 'loueur', 37, 90000, 690.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('tesla-model-y-standard', 'TESLA', 'MODEL Y STANDARD', '', 'SUV', 'Électrique', 40990.0, 0, 534.0, TRUE, 8.0, TRUE, 0.0, 1000.0, 'TESLA', 'TESLA', TRUE, '3 mois', 'BPOEM_EMEA_491787 (2).pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'tesla-model-y-standard';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('tesla-model-y-standard', 'AYVENS', 'loueur', 49, 40000, 529.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('tesla-model-y-standard', 'ARVAL', 'loueur', 37, 90000, 699.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('tesla-model-y-premium-lr-rwd', 'TESLA', 'MODEL Y PREMIUM LR RWD', '', 'SUV', 'Électrique', 46990.0, 0, 657.0, TRUE, 10.0, TRUE, 0.0, 1000.0, 'TESLA', 'TESLA', TRUE, '3 mois', 'BPOEM_EMEA_491787 (2).pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'tesla-model-y-premium-lr-rwd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('tesla-model-y-premium-lr-rwd', 'AYVENS', 'loueur', 49, 40000, 619.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('tesla-model-y-premium-lr-rwd', 'ARVAL', 'loueur', 37, 90000, 779.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('volkswagen-id-4-pro-life', 'VOLKSWAGEN', 'ID.4 Pro Life', '', 'SUV', 'Électrique', 46990.0, 0, 570.0, TRUE, 22.5, TRUE, 1.0, 1000.0, 'NEUBAUER', 'BYMYCAR', TRUE, '3 mois', 'VOLKSWAGEN GROUP-Contrat Grand Compte 2026-N 1-NKIEYOQ VERSION 2-BEEV_1-NL87JZA_1-NL8WRMA.PDF', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'volkswagen-id-4-pro-life';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volkswagen-id-4-pro-life', 'AYVENS', 'loueur', 49, 40000, 509.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volkswagen-id-4-pro-life', 'ARVAL', 'loueur', 37, 90000, 639.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('volvo-ec40-start-single-extended-range-start', 'VOLVO', 'EC40 START SINGLE EXTENDED RANGE START', '', 'SUV', 'Électrique', 53550.0, 0, NULL, TRUE, 21.0, FALSE, 1.0, 1000.0, 'ABVV', 'GRIM', FALSE, NULL, 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'volvo-ec40-start-single-extended-range-start';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volvo-ec40-start-single-extended-range-start', 'AYVENS', 'loueur', 49, 40000, 569.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volvo-ec40-start-single-extended-range-start', 'AYVENS', 'loueur', 37, 90000, 769.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('xpeng-g6-sr-rwd', 'XPENG', 'G6 SR RWD', '', 'SUV', 'Électrique', 42990.0, 0, NULL, FALSE, 20.0, FALSE, 0.5, 1000.0, 'BPM', 'BPM', FALSE, NULL, 'Accord tripartie Xpeng Motors France X Beev.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'xpeng-g6-sr-rwd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('xpeng-g6-sr-rwd', 'AYVENS', 'loueur', 49, 40000, 499.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('xpeng-g6-sr-rwd', 'AYVENS', 'loueur', 37, 90000, 669.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('volvo-ex40-start-single-extended-range-start', 'VOLVO', 'EX40 START SINGLE EXTENDED RANGE START', '', 'SUV', 'Électrique', 50200.0, 0, 576.0, TRUE, 21.0, TRUE, 1.0, 1000.0, 'ABVV', 'ABVV', TRUE, '3 mois', 'NON', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'volvo-ex40-start-single-extended-range-start';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volvo-ex40-start-single-extended-range-start', 'AYVENS', 'loueur', 49, 40000, 579.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('volvo-ex40-start-single-extended-range-start', 'AYVENS', 'loueur', 37, 90000, 780.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('xpeng-p7-sr-rwd', 'XPENG', 'P7+ SR RWD', '', 'Berline', 'Électrique', 45990.0, 0, NULL, FALSE, 18.0, FALSE, 0.5, 1000.0, 'BPM', 'BPM', FALSE, NULL, 'Accord tripartie Xpeng Motors France X Beev.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'xpeng-p7-sr-rwd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('xpeng-p7-sr-rwd', 'AYVENS', 'loueur', 49, 40000, 619.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('xpeng-p7-sr-rwd', 'AYVENS', 'loueur', 37, 90000, 819.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('xpeng-g6-lr-rwd', 'XPENG', 'G6 LR RWD', '', 'SUV', 'Électrique', 46990.0, 0, 525.0, FALSE, 20.0, TRUE, 0.5, 1000.0, 'BPM', 'BPM', TRUE, '5 mois', 'Accord tripartie Xpeng Motors France X Beev.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'xpeng-g6-lr-rwd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('xpeng-g6-lr-rwd', 'AYVENS', 'loueur', 49, 40000, 519.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('xpeng-g6-lr-rwd', 'AYVENS', 'loueur', 37, 90000, 709.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('xpeng-g9-sr-rwd', 'XPENG', 'G9 SR RWD', '', 'SUV', 'Électrique', 59990.0, 0, NULL, FALSE, 19.0, FALSE, 0.5, 1000.0, 'BPM', 'BPM', FALSE, NULL, 'Accord tripartie Xpeng Motors France X Beev.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'xpeng-g9-sr-rwd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('xpeng-g9-sr-rwd', 'AYVENS', 'loueur', 49, 40000, 659.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('xpeng-g9-sr-rwd', 'AYVENS', 'loueur', 37, 90000, 889.0);
INSERT INTO vehicles (id, brand, model, version, category, energy, price_ttc, monthly_lld, range_wltp, eco_score_bool, remise, shortlist, pcom_pct, commission_beev, distributeur_nord, distributeur_sud, available_stock, lead_time, tripartite_contract, last_sync_at)
VALUES ('xpeng-g9-lr-rwd', 'XPENG', 'G9 LR RWD', '', 'SUV', 'Électrique', 63990.0, 0, 585.0, FALSE, 19.0, TRUE, 0.5, 1000.0, 'BPM', 'BPM', TRUE, '7 mois', 'Accord tripartie Xpeng Motors France X Beev.pdf', NOW())
ON CONFLICT (id) DO UPDATE SET
  price_ttc = EXCLUDED.price_ttc,
  range_wltp = COALESCE(EXCLUDED.range_wltp, vehicles.range_wltp),
  eco_score_bool = EXCLUDED.eco_score_bool,
  remise = EXCLUDED.remise,
  shortlist = EXCLUDED.shortlist,
  pcom_pct = EXCLUDED.pcom_pct,
  commission_beev = EXCLUDED.commission_beev,
  distributeur_nord = EXCLUDED.distributeur_nord,
  distributeur_sud = EXCLUDED.distributeur_sud,
  available_stock = EXCLUDED.available_stock,
  lead_time = EXCLUDED.lead_time,
  tripartite_contract = EXCLUDED.tripartite_contract,
  last_sync_at = NOW();
DELETE FROM leaser_offers WHERE vehicle_id = 'xpeng-g9-lr-rwd';
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('xpeng-g9-lr-rwd', 'AYVENS', 'loueur', 49, 40000, 699.0);
INSERT INTO leaser_offers (vehicle_id, loueur, kind, duration_months, km_total, monthly_price_ttc) VALUES ('xpeng-g9-lr-rwd', 'AYVENS', 'loueur', 37, 90000, 959.0);


-- Vérification
SELECT
  (SELECT COUNT(*) FROM vehicles WHERE last_sync_at IS NOT NULL) AS vehicles_synces,
  (SELECT COUNT(*) FROM leaser_offers) AS offres_loueurs,
  (SELECT SUM(commission_beev) FROM vehicles WHERE commission_beev > 0) AS total_commission_beev,
  (SELECT COUNT(*) FROM vehicles WHERE price_ttc = 0) AS vehicules_sans_prix;
