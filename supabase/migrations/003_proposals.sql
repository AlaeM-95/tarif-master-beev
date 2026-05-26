-- ====== TABLE proposals : sauvegarde des offres commerciales ======
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'refused', 'expired')),
  follow_up_date DATE,

  -- Info client
  client_company TEXT NOT NULL,
  client_contact TEXT,
  client_email TEXT,
  client_notes TEXT,
  proposal_date TEXT,

  -- Commercial
  sales_rep_name TEXT,
  sales_rep_email TEXT,
  sales_rep_phone TEXT,

  -- Projet
  project_type TEXT NOT NULL CHECK (project_type IN ('vehicles', 'home', 'site')),
  selected_vehicles JSONB DEFAULT '[]'::jsonb,
  selected_chargers JSONB DEFAULT '[]'::jsonb,
  energy_params JSONB,

  -- Métriques
  total_amount NUMERIC DEFAULT 0,
  vehicle_count INTEGER DEFAULT 0,
  charger_count INTEGER DEFAULT 0,

  -- Notes internes (privées, pas dans le PDF)
  internal_notes TEXT
);

CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_client ON proposals(client_company);
CREATE INDEX idx_proposals_created_at ON proposals(created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read proposals" ON proposals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin write proposals" ON proposals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
