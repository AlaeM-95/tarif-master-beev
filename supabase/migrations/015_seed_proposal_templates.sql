-- Seed 2 templates de propositions suggérés par défaut. Le commercial les
-- ouvre comme point de départ, ajoute les véhicules concrets du catalogue,
-- ajuste les marges et remises selon le deal, puis sauvegarde.
-- Les selected_vehicles sont volontairement vides : le commercial pioche
-- dans le catalogue actuel (qui évolue) plutôt que d'avoir des références
-- figées qui deviendraient obsolètes.

-- Paramètres énergie cohérents avec une PME / ETI :
-- 20 000 km/an, électricité pro 0,18 €/kWh, essence 1,85 €/L, etc.
INSERT INTO proposal_templates (name, description, project_type, selected_vehicles, selected_chargers, energy_params, position) VALUES
  (
    'Moyen compte — 50 véhicules en parc',
    'Flotte d''ETI 50 VE. À compléter avec la sélection véhicules adaptée au mix segments (citadines + berlines + utilitaires). Paramètres énergie pré-réglés : 20 000 km/an, électricité 0,18 €/kWh, contrat 48 mois. Marges commerciales standards à valider site par site.',
    'vehicles',
    '[]'::jsonb,
    '[]'::jsonb,
    '{"kmPerYear":20000,"durationMonths":48,"electricityPricePerKwh":0.18,"fuelPricePerLiter":1.85,"chargingMix":{"home":0.6,"work":0.3,"public":0.1},"co2PricePerTon":0,"professionalKmShare":1}'::jsonb,
    1
  ),
  (
    'Grand compte — 100+ véhicules en parc',
    'Flotte grand compte 100+ VE. Cycle de décision long, multi-décideurs (DAF, DRH, RSE). À compléter avec la sélection véhicules par segment et site. Paramètres énergie grand compte : 25 000 km/an, électricité 0,15 €/kWh négociée, contrat 60 mois. Inclure systématiquement la page comparaison TCO et la synthèse exécutive dans le PDF.',
    'vehicles',
    '[]'::jsonb,
    '[]'::jsonb,
    '{"kmPerYear":25000,"durationMonths":60,"electricityPricePerKwh":0.15,"fuelPricePerLiter":1.85,"chargingMix":{"home":0.5,"work":0.4,"public":0.1},"co2PricePerTon":0,"professionalKmShare":1}'::jsonb,
    2
  );

SELECT name, project_type, position FROM proposal_templates ORDER BY position;
