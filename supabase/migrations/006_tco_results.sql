-- ====== TABLE tco_results : synchronisation avec le calculateur TCO Beev 2026 ======
-- Cette table est écrite par l'app beev-tco-2026.lovable.app/app
-- et lue par tarif-master-beev.lovable.app pour afficher le TCO complet
-- dans le PDF client.

CREATE TABLE IF NOT EXISTS tco_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Référence véhicule (peut être un véhicule du catalog ou un custom)
  vehicle_id TEXT, -- pas de FK pour permettre les custom non-référencés
  vehicle_brand TEXT,
  vehicle_model TEXT,

  -- Paramètres du calcul
  duration_months INTEGER NOT NULL,
  km_per_year INTEGER NOT NULL,
  energy_params JSONB, -- { mixHomePct, kWhHome, kWhPublic, fuelPriceL }

  -- Résultats détaillés par poste (€/100km sauf mention contraire)
  monthly_lld NUMERIC, -- loyer mensuel TTC
  lease_per_100km NUMERIC,
  energy_per_100km NUMERIC,
  insurance_per_year NUMERIC, -- annuel
  maintenance_per_year NUMERIC, -- annuel
  tires_per_year NUMERIC, -- annuel
  tco_per_100km NUMERIC,
  tco_per_year NUMERIC,
  tco_total_contract NUMERIC,

  -- Comparaison vs essence référence
  ref_brand TEXT, -- ex: "Peugeot 308 essence"
  ref_tco_per_100km NUMERIC,
  ref_tco_per_year NUMERIC,
  economy_per_100km NUMERIC,
  economy_per_year NUMERIC,
  economy_total_contract NUMERIC,

  -- Bonus / malus / aides (€)
  bonus_ecologique NUMERIC DEFAULT 0,
  malus_co2 NUMERIC DEFAULT 0,
  aide_locale NUMERIC DEFAULT 0,
  malus_poids NUMERIC DEFAULT 0,

  -- Métadonnées
  client_company TEXT, -- pour associer à une proposition
  computed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'tco-calculator', -- 'tco-calculator' ou 'tarif-master'
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_tco_results_vehicle ON tco_results(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tco_results_computed_at ON tco_results(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tco_results_company ON tco_results(client_company);

-- ====== RLS ======
ALTER TABLE tco_results ENABLE ROW LEVEL SECURITY;

-- Lecture publique (les résultats TCO ne sont pas sensibles)
CREATE POLICY "Public read tco_results" ON tco_results FOR SELECT USING (true);

-- Écriture réservée aux utilisateurs authentifiés (admin ou commercial)
CREATE POLICY "Auth write tco_results" ON tco_results FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update tco_results" ON tco_results FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete tco_results" ON tco_results FOR DELETE TO authenticated USING (true);

-- Vérifie la création
SELECT 'Table tco_results créée' AS status;
