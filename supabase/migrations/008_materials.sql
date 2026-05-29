-- ====== TABLE materials : catalogue d'accessoires (modules de délestage, câbles,
-- pieds, compteurs, kits, extensions de garantie, etc.) que le commercial peut
-- ajouter à une borne sélectionnée. Issu du fichier TARIF INSTALLATEURS.

CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  category TEXT NOT NULL,
  price_buy_ht NUMERIC NOT NULL DEFAULT 0,
  price_sell_min_ht NUMERIC NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_position ON materials(position);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les utilisateurs authentifiés (catalogue partagé)
CREATE POLICY "Authenticated read materials" ON materials FOR SELECT TO authenticated
  USING (TRUE);

-- Écriture : admin uniquement
CREATE POLICY "Admin write materials" ON materials FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER materials_updated_at BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ====== SEED depuis TARIF INSTALLATEURS (1) (1).xlsx / onglet 'Materiel - Autres' ======

INSERT INTO materials (label, brand, model, category, price_buy_ht, price_sell_min_ht, position) VALUES
  ('Alfen Module de Delestage Alfen ALB', 'Alfen', 'Module de Delestage Alfen ALB', 'delestage', 71.6, 120.0, 1),
  ('Wallbox PowerBoost Monophasé Wallbox EM112', 'Wallbox', 'PowerBoost Monophasé Wallbox EM112', 'delestage', 62.0, 120.0, 2),
  ('Wallbox PowerBoost Triphasé Wallbox EM340', 'Wallbox', 'PowerBoost Triphasé Wallbox EM340', 'delestage', 146.0, 200.0, 3),
  ('Alfen Modbus Alfen Monophasé Direct', 'Alfen', 'Modbus Alfen Monophasé Direct', 'delestage', 59.0, 120.0, 4),
  ('Alfen Modbus Alfen Monophasé Indirect', 'Alfen', 'Modbus Alfen Monophasé Indirect', 'delestage', 87.0, 160.0, 5),
  ('Alfen Modbus Alfen Triphasé Direct', 'Alfen', 'Modbus Alfen Triphasé Direct', 'delestage', 89.0, 190.0, 6),
  ('Alfen Modbus Alfen Triphasé Indirect', 'Alfen', 'Modbus Alfen Triphasé Indirect', 'delestage', 203.0, 350.0, 7),
  ('Alfen Pied Alfen Simple', 'Alfen', 'Pied Alfen Simple', 'pied', 170.0, 270.0, 8),
  ('Alfen Pied Alfen Double', 'Alfen', 'Pied Alfen Double', 'pied', 280.0, 380.0, 9),
  ('Jatrhg Pied Eiffel Simple', 'Jatrhg', 'Pied Eiffel Simple', 'pied', 130.0, 270.0, 10),
  ('Ohme Pied Ohme', 'Ohme', 'Pied Ohme', 'pied', 289.0, 390.0, 11),
  ('Khons Câble T2 5m Carrefour Only', 'Khons', 'Câble T2 5m Carrefour Only', 'cable', 50.0, 0.0, 12),
  ('Khons Câble T2 5m (hors Carrefour)', 'Khons', 'Câble T2 5m (hors Carrefour)', 'cable', 50.0, 150.0, 13),
  ('Câble T2 8m', NULL, 'Câble T2 8m', 'cable', 115.0, 200.0, 14),
  ('Câble T2 10m', NULL, 'Câble T2 10m', 'cable', 155.0, 250.0, 15),
  ('Câble T2 15m', NULL, 'Câble T2 15m', 'cable', 199.0, 300.0, 16),
  ('Carlo Gavazzi  EM340 (Triphasé, jusqu’à 65A)', 'Carlo Gavazzi', 'EM340 (Triphasé, jusqu’à 65A)', 'compteur', 214.21, 250.0, 17),
  ('Carlo Gavazzi  EM112 (Monophasé, jusqu’à 100 A)', 'Carlo Gavazzi', 'EM112 (Monophasé, jusqu’à 100 A)', 'compteur', 99.0, 150.0, 18),
  ('Carlo Gavazzi  EM24 Ethernet Mosbus TCP / IP DIN.AV5.3.X.TCP', 'Carlo Gavazzi', 'EM24 Ethernet Mosbus TCP / IP DIN.AV5.3.X.TCP', 'compteur', 150.0, 220.0, 19),
  ('Smappee Smart Kit 100 Ampères', 'Smappee', 'Smart Kit 100 Ampères', 'kit', 150.0, 250.0, 20),
  ('Smappee Kit Infinity', 'Smappee', 'Kit Infinity', 'kit', 320.0, 500.0, 21),
  ('Alfen Extension Garantie 1 an On Site', 'Alfen', 'Extension Garantie 1 an On Site', 'garantie', 86.0, 110.0, 22),
  ('Alfen Extension Garantie 2 ans On Site', 'Alfen', 'Extension Garantie 2 ans On Site', 'garantie', 134.0, 170.0, 23),
  ('Alfen Extension Garantie 3 ans On Site', 'Alfen', 'Extension Garantie 3 ans On Site', 'garantie', 182.0, 230.0, 24),
  ('V2C Pied Simple', 'V2C', 'Pied Simple', 'pied', 212.0, 350.0, 25),
  ('V2C Pied Double', 'V2C', 'Pied Double', 'pied', 273.0, 400.0, 26),
  ('Hager  Pied Simple', 'Hager', 'Pied Simple', 'pied', 213.0, 350.0, 27),
  ('Hager  Pied Double', 'Hager', 'Pied Double', 'pied', 223.0, 390.0, 28),
  ('Hager  Carte TIC radio RF', 'Hager', 'Carte TIC radio RF', 'tic', 85.0, 120.0, 29),
  ('Hager  Emmetteur Recepteur TIC Hager', 'Hager', 'Emmetteur Recepteur TIC Hager', 'tic', 115.0, 150.0, 30),
  ('Hager  XEV304 EVCS ACCESSOIRE SIMULATEUR TIC 1P', 'Hager', 'XEV304 EVCS ACCESSOIRE SIMULATEUR TIC 1P', 'tic', 135.0, 250.0, 31),
  ('Hager  XEV305 EVCS ACCESSOIRE SIMULATEUR TIC 3P', 'Hager', 'XEV305 EVCS ACCESSOIRE SIMULATEUR TIC 3P', 'tic', 170.0, 290.0, 32),
  ('Beev Supervision Borne Collaborateur Mensuel', 'Beev', 'Supervision Borne Collaborateur Mensuel', 'supervision', 6.0, 12.0, 33),
  ('Beev Supervision Borne Collaborateur Mensuel via SIM', 'Beev', 'Supervision Borne Collaborateur Mensuel via SIM', 'supervision', 8.0, 14.0, 34);

-- Vérification
SELECT category, COUNT(*) FROM materials GROUP BY category ORDER BY category;
