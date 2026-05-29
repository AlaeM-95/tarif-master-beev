-- ====== TABLE bpu_forfaits : Bordereau de Prix Unitaires d'installation.
-- Chaque forfait a un prix de base en Zone 1 ; les autres zones (2/3/4) sont
-- calculées côté code via les coefficients 1.0/1.1/1.15/1.2.

CREATE TABLE IF NOT EXISTS bpu_forfaits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  price_zone1_ht NUMERIC NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bpu_category ON bpu_forfaits(category);
CREATE INDEX IF NOT EXISTS idx_bpu_position ON bpu_forfaits(position);

ALTER TABLE bpu_forfaits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read bpu_forfaits" ON bpu_forfaits FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Admin write bpu_forfaits" ON bpu_forfaits FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER bpu_forfaits_updated_at BEFORE UPDATE ON bpu_forfaits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ====== SEED depuis TARIF INSTALLATEURS (1) (1).xlsx / onglet 'BPU NATIONAL' ======

-- 45 forfaits à insérer
INSERT INTO bpu_forfaits (label, category, price_zone1_ht, position) VALUES
  ('Forfait d''installation - Monophasé 7,4kW - 5m - TYPE A', 'installation_borne', 320.0, 1),
  ('Forfait d''installation - Monophasé 7,4kW - 10m - TYPE A', 'installation_borne', 355.0, 2),
  ('Forfait d''installation - Monophasé 7,4kW - 15m - TYPE A', 'installation_borne', 390.0, 3),
  ('Forfait d''installation - Monophasé 7,4kW - 20m - TYPE A', 'installation_borne', 425.0, 4),
  ('Forfait d''installation - Triphasé 11kW - 5m - TYPE A', 'installation_borne', 430.0, 5),
  ('Forfait d''installation - Triphasé 11kW - 10m - TYPE A', 'installation_borne', 510.0, 6),
  ('Forfait d''installation - Triphasé 11kW - 15m - TYPE A', 'installation_borne', 590.0, 7),
  ('Forfait d''installation - Triphasé 11kW - 20m - TYPE A', 'installation_borne', 670.0, 8),
  ('Forfait d''installation - Triphasé 22kW - 5m - TYPE A', 'installation_borne', 470.0, 9),
  ('Forfait d''installation - Triphasé 22kW - 10m - TYPE A', 'installation_borne', 555.0, 10),
  ('Forfait d''installation - Triphasé 22kW - 15m - TYPE A', 'installation_borne', 640.0, 11),
  ('Forfait d''installation - Triphasé 22kW - 20m - TYPE A', 'installation_borne', 725.0, 12),
  ('Forfait d''installation - Prise Green''Up - Monophasé 3,7kW - 5m - TYPE A', 'installation_prise', 260.0, 13),
  ('Forfait d''installation - Prise Green''Up - Monophasé 3,7kW - 10m - TYPE A', 'installation_prise', 290.0, 14),
  ('Forfait d''installation - Prise Green''Up - Monophasé 3,7kW - 15m - TYPE A', 'installation_prise', 320.0, 15),
  ('Forfait d''installation - Prise Green''Up - Monophasé 3,7kW - 20m - TYPE A', 'installation_prise', 350.0, 16),
  ('Forfait d''installation - Triphasé 22kW - 5m - TYPE B', 'installation_borne', 650.0, 17),
  ('Forfait d''installation - Triphasé 22kW - 10m - TYPE B', 'installation_borne', 735.0, 18),
  ('Forfait d''installation - Triphasé 22kW - 15m - TYPE B', 'installation_borne', 820.0, 19),
  ('Forfait d''installation - Triphasé 22kW - 20m - TYPE B', 'installation_borne', 905.0, 20),
  ('Forfait câbles supplémentaires - Prise Green''Up Monophasé - 5m + Tube IRL + Cable RJ45', 'cables', 30.0, 21),
  ('Forfait câbles supplémentaires - Borne Monophasé - 5m + Tube IRL + Cable RJ45', 'cables', 45.0, 22),
  ('Forfait câbles supplémentaires - Borne Triphasé - 5m + Tube IRL + Cable RJ45', 'cables', 80.0, 23),
  ('Tableau dérivé 1 rangée supplémentaire standard', 'tableau', 40.0, 24),
  ('Tableau dérivé 1 rangée supplémentaire étanche', 'tableau', 60.0, 25),
  ('Tranchée TERRE - 5m', 'tranchee', 88.0, 26),
  ('Tranchée GRAVIER - 5m', 'tranchee', 130.0, 27),
  ('Tranchée BETON - 5m', 'tranchee', 300.0, 28),
  ('Percement de mur supplémentaire < 25cm', 'percement', 20.0, 29),
  ('Percement de mur supplémentaire > 25cm', 'percement', 25.0, 30),
  ('Répartiteur Monophasé', 'repartiteur', 25.0, 31),
  ('Répartiteur Triphasé', 'repartiteur', 40.0, 32),
  ('Création Mise à la Terre', 'terre', 120.0, 33),
  ('Modification tableau électrique Monophasé', 'tableau', 60.0, 34),
  ('Modification tableau électrique Triphasé', 'tableau', 70.0, 35),
  ('Fourniture et pose goulotte - 1m liénaire', 'goulotte', 12.0, 36),
  ('Pose de pied sur sol existant', 'pied', 80.0, 37),
  ('Création dalle béton pour pied 40x40 cm + pose de pied', 'pied', 180.0, 38),
  ('Création dalle béton avec un regard 40x40 cm + pose de pied', 'pied', 210.0, 39),
  ('Déplacement hors zone - 100km', 'deplacement', 40.0, 40),
  ('Visite technique', 'visite', 60.0, 41),
  ('Désinstallation de borne de recharge', 'desinstallation', 150.0, 42),
  ('Désinstallation de borne de recharge + câblage + disjoncteur', 'desinstallation', 200.0, 43),
  ('Maintenance 1 borne Mono Rayon 100km', 'maintenance', 0, 44),
  ('Maintenance 1 borne Mono Rayon 250km', 'maintenance', 0, 45);

-- Vérification
SELECT category, COUNT(*) FROM bpu_forfaits GROUP BY category ORDER BY category;
