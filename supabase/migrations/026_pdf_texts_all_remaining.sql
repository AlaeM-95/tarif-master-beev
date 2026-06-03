-- Migration 026 : rend éditables les textes restants du PDF
-- · Fiche produit borne (drawSiteProductSheet)
-- · Vue d'ensemble — bloc contacts (drawSiteOverview)
-- · Page véhicule (drawVehiclePage)
-- · TCO comparaison (drawTcoComparison)
-- · Récap financier vehicles/home (drawFinancialSummary)
-- · BPA · validation (drawValidation)

INSERT INTO pdf_texts (scope, slug, category, label, kind, content_text, content_list, position) VALUES

  -- ====== COMMUN · VUE D'ENSEMBLE (bloc contacts en haut à droite) ======
  ('common', 'overview_contacts_title', 'commun · vue d''ensemble', 'Titre encart contacts', 'text', 'VOS CONTACTS BEEV', NULL, 1),
  ('common', 'overview_contact1_role', 'commun · vue d''ensemble', 'Rôle 1er contact', 'text', 'Chargé d''affaires', NULL, 2),
  ('common', 'overview_contact2_role', 'commun · vue d''ensemble', 'Rôle 2e contact', 'text', 'Référent technique', NULL, 3),
  ('common', 'overview_contact2_team', 'commun · vue d''ensemble', '2e contact · nom (équipe)', 'text', 'Équipe IRVE Beev', NULL, 4),
  ('common', 'overview_perimeter_title', 'commun · vue d''ensemble', 'Titre encart périmètre', 'text', 'EMPLACEMENTS SÉLECTIONNÉS', NULL, 5),
  ('common', 'overview_perimeter_note', 'commun · vue d''ensemble', 'Note bas encart périmètre', 'multiline',
    'Précisés lors de la visite technique avec le bureau d''études IRVE Beev et le partenaire installateur certifié.', NULL, 6),
  ('common', 'overview_intro', 'commun · vue d''ensemble', 'Texte intro page Vue d''ensemble', 'multiline',
    'Ce rapport détaille la solution technique, les équipements, le planning et le budget pour l''installation de votre infrastructure de recharge.', NULL, 7),

  -- ====== SITE · FICHE PRODUIT BORNE (drawSiteProductSheet) ======
  ('site', 'site_product_eyebrow', 'site · fiche produit', 'Eyebrow page Fiche produit', 'text', 'FICHE PRODUIT', NULL, 1),
  ('site', 'site_product_presentation_label', 'site · fiche produit', 'Libellé "PRÉSENTATION"', 'text', 'PRÉSENTATION', NULL, 2),
  ('site', 'site_equip_specs_label', 'site · équipements', 'Libellé "CARACTÉRISTIQUES TECHNIQUES" sous la table', 'text', 'CARACTÉRISTIQUES TECHNIQUES', NULL, 12),
  ('site', 'site_equip_default_features', 'site · équipements', 'Puces par défaut affichées sous chaque modèle dans la grille équipements (1 par ligne)', 'list', NULL,
    '["Prise Type 2 intégrée","RFID + supervision OCPP","Connectivité WiFi/4G","IP54 · garantie 3 ans"]'::jsonb, 13),

  -- ====== VEHICLES · PAGE VÉHICULE (drawVehiclePage) ======
  ('vehicles', 'vehicle_price_remise_label', 'page véhicule', 'Libellé "PRIX REMISÉ TTC"', 'text', 'PRIX REMISÉ TTC', NULL, 7),
  ('vehicles', 'vehicle_alt_configs_label', 'page véhicule', 'Libellé "CONFIGURATIONS ALTERNATIVES"', 'text', 'CONFIGURATIONS ALTERNATIVES', NULL, 8),
  ('vehicles', 'vehicle_strengths_label', 'page véhicule', 'Libellé "POINTS FORTS"', 'text', 'POINTS FORTS', NULL, 9),
  ('vehicles', 'vehicle_presentation_label', 'page véhicule', 'Libellé "PRÉSENTATION"', 'text', 'PRÉSENTATION', NULL, 10),
  ('vehicles', 'vehicle_photo_disclaimer', 'page véhicule', 'Mention "Photo non contractuelle"', 'text', 'Photo non contractuelle', NULL, 11),
  ('vehicles', 'vehicle_scenarios_head_label', 'page véhicule', 'En-tête tableau scénarios · col Scénario', 'text', 'Scénario', NULL, 12),
  ('vehicles', 'vehicle_scenarios_head_duration', 'page véhicule', 'En-tête tableau scénarios · col Durée', 'text', 'Durée', NULL, 13),
  ('vehicles', 'vehicle_scenarios_head_kmyear', 'page véhicule', 'En-tête tableau scénarios · col Km/an', 'text', 'Km / an', NULL, 14),
  ('vehicles', 'vehicle_scenarios_head_kmtotal', 'page véhicule', 'En-tête tableau scénarios · col Km total', 'text', 'Km total', NULL, 15),
  ('vehicles', 'vehicle_scenarios_head_monthly', 'page véhicule', 'En-tête tableau scénarios · col Loyer mensuel TTC', 'text', 'Loyer mensuel TTC', NULL, 16),

  -- ====== VEHICLES · TCO COMPARAISON (drawTcoComparison) ======
  ('vehicles', 'tco_compare_col_vehicle', 'comparaison tco', 'Col 1 · "VÉHICULE"', 'text', 'VÉHICULE', NULL, 10),
  ('vehicles', 'tco_compare_col_per100', 'comparaison tco', 'Col 2 · "TCO / 100 KM"', 'text', 'TCO / 100 KM', NULL, 11),
  ('vehicles', 'tco_compare_col_tco', 'comparaison tco', 'Col 3 · "PRIX TCO"', 'text', 'PRIX TCO', NULL, 12),
  ('vehicles', 'tco_compare_col_total', 'comparaison tco', 'Col 4 · "TCO TOTAL"', 'text', 'TCO TOTAL', NULL, 13),
  ('vehicles', 'tco_compare_col_gap', 'comparaison tco', 'Col 5 · "ÉCART"', 'text', 'ÉCART', NULL, 14),
  ('vehicles', 'tco_compare_best', 'comparaison tco', 'Badge "MEILLEUR"', 'text', 'MEILLEUR', NULL, 15),
  ('vehicles', 'tco_compare_chart1_label', 'comparaison tco', 'Label graphique 1 · "ÉCART / 100 KM"', 'text', 'ÉCART / 100 KM', NULL, 16),
  ('vehicles', 'tco_compare_chart2_label', 'comparaison tco', 'Label graphique 2 · "ÉCART ANNUEL (PAR VÉHICULE)"', 'text', 'ÉCART ANNUEL (PAR VÉHICULE)', NULL, 17),
  ('vehicles', 'tco_compare_chart3_label', 'comparaison tco', 'Label graphique 3 · "ÉCART SUR DURÉE CONTRAT"', 'text', 'ÉCART SUR DURÉE CONTRAT', NULL, 18),
  ('vehicles', 'tco_compare_footnote', 'comparaison tco', 'Note bas de page comparaison TCO', 'multiline',
    'Comparaison entre les véhicules de votre sélection uniquement. Estimation indicative basée sur les paramètres énergie & kilométrage du projet.', NULL, 19),
  ('vehicles', 'tco_compare_empty', 'comparaison tco', 'Message si aucun véhicule sélectionné', 'text', 'Aucun véhicule sélectionné pour l''analyse TCO.', NULL, 20),

  -- ====== COMMUN · RÉCAP FINANCIER (drawFinancialSummary) ======
  ('common', 'financial_vehicles_title', 'commun · récap financier', 'Titre encart Véhicules', 'text', 'VÉHICULES — LOYERS LLD TTC', NULL, 1),
  ('common', 'financial_vehicles_tva_note', 'commun · récap financier', 'Note TVA récupérable', 'multiline',
    'Loyers exprimés en TTC. Conformément à la fiscalité LLD, la TVA sur le loyer véhicule électrique est récupérable à 100 %.', NULL, 2),
  ('common', 'financial_chargers_title', 'commun · récap financier', 'Titre encart Bornes', 'text', 'BORNES DE RECHARGE — HT / TVA / TTC', NULL, 3),
  ('common', 'financial_payment_title', 'commun · récap financier', 'Titre encart Modalités', 'text', 'MODALITÉS DE PAIEMENT (À CONFIRMER LORS DE LA SIGNATURE)', NULL, 4),
  ('common', 'financial_head_vehicle', 'commun · récap financier', 'Col 1 tableau véhicules', 'text', 'Véhicule', NULL, 5),
  ('common', 'financial_head_conditions', 'commun · récap financier', 'Col 2 tableau véhicules', 'text', 'Conditions', NULL, 6),
  ('common', 'financial_head_unit_monthly', 'commun · récap financier', 'Col 3 tableau véhicules', 'text', 'Loyer unitaire/mois', NULL, 7),
  ('common', 'financial_head_total_monthly', 'commun · récap financier', 'Col 4 tableau véhicules', 'text', 'Loyer mensuel TTC', NULL, 8),
  ('common', 'financial_foot_total_label', 'commun · récap financier', 'Pied tableau · libellé total', 'text', 'Loyer mensuel total TTC', NULL, 9),

  -- ====== COMMUN · BPA / VALIDATION (drawValidation) ======
  ('common', 'bpa_eyebrow', 'commun · bpa signature', 'Eyebrow page BPA', 'text', 'BON POUR ACCORD', NULL, 1),
  ('common', 'bpa_beev_label', 'commun · bpa signature', 'Libellé partie Beev', 'text', 'BEEV', NULL, 2),
  ('common', 'bpa_client_label', 'commun · bpa signature', 'Libellé partie Client', 'text', 'CLIENT', NULL, 3),
  ('common', 'bpa_conditions_title', 'commun · bpa signature', 'Titre encart conditions', 'text', 'CONDITIONS COMMERCIALES', NULL, 4),
  ('common', 'bpa_client_box_title', 'commun · bpa signature', 'Titre encart cadre client', 'text', 'CADRE RÉSERVÉ AU CLIENT', NULL, 5),
  ('common', 'bpa_date_label', 'commun · bpa signature', 'Label "Date de signature :"', 'text', 'Date de signature :', NULL, 6),
  ('common', 'bpa_name_label', 'commun · bpa signature', 'Label "Nom & qualité :"', 'text', 'Nom & qualité :', NULL, 7),
  ('common', 'bpa_phone_label', 'commun · bpa signature', 'Label "Téléphone :"', 'text', 'Téléphone :', NULL, 8),
  ('common', 'bpa_signature_label', 'commun · bpa signature', 'Label "Signature et cachet de l''entreprise"', 'text', 'Signature et cachet de l''entreprise', NULL, 9),
  ('common', 'bpa_contact_title', 'commun · bpa signature', 'Titre encart interlocuteur Beev', 'text', 'VOTRE INTERLOCUTEUR BEEV', NULL, 10),
  ('common', 'bpa_next_step_label', 'commun · bpa signature', 'Libellé "PROCHAINE ÉTAPE"', 'text', 'PROCHAINE ÉTAPE', NULL, 11)

ON CONFLICT (scope, slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
