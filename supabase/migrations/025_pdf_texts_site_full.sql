-- Migration 025 : rend éditables tous les textes du rapport visite technique
-- (mode "Bornes site entreprise"). Ajoute ~80 clés pdf_texts couvrant :
-- · Garanties (3 cartes + bandeau bas)
-- · Conformité réglementaire (Bureau de Contrôle, Consuel, Maintenance)
-- · Récapitulatif financier (libellés colonnes, lignes types, note bas)
-- · Options de paiement (3 cartes + bandeau total + CTA)
-- · Supervision (Beev Connect + Beev Home Charging)
-- · Pages existantes : Vue d'ensemble / Synthèse / Infrastructure / Équipements
--
-- Toutes ces clés deviennent visibles dans /admin/pdf > onglet Site.
-- Le code pdf.ts lit ces valeurs via lookupText/lookupList ; si la migration
-- n'est pas appliquée, le fallback hardcodé est utilisé (rétro-compat).

INSERT INTO pdf_texts (scope, slug, category, label, kind, content_text, content_list, position) VALUES

  -- ====== SITE · VUE D'ENSEMBLE ======
  ('site', 'site_overview_eyebrow', 'site · vue d''ensemble', 'Eyebrow page Vue d''ensemble', 'text', '1 · VUE D''ENSEMBLE', NULL, 1),
  ('site', 'site_overview_title', 'site · vue d''ensemble', 'Titre page Vue d''ensemble', 'text', 'Récapitulatif projet', NULL, 2),

  -- ====== SITE · GARANTIES ======
  ('site', 'site_guarantees_eyebrow', 'site · garanties', 'Eyebrow page Garanties', 'text', 'GARANTIES', NULL, 1),
  ('site', 'site_guarantees_title', 'site · garanties', 'Titre page Garanties', 'text', 'Nos qualifications et assurances', NULL, 2),
  ('site', 'site_guarantees_col1_title', 'site · garanties', 'Carte 1 · titre', 'text', 'Qualification IRVE', NULL, 10),
  ('site', 'site_guarantees_col1_items', 'site · garanties', 'Carte 1 · puces (1 par ligne)', 'list', NULL,
    '["Installateurs certifiés IRVE","Habilitation infrastructure VE","Formation continue réglementaire","Agréments : Hager, Smappee, Alfen, Schneider"]'::jsonb, 11),
  ('site', 'site_guarantees_col2_title', 'site · garanties', 'Carte 2 · titre', 'text', 'RC Décennale AXA', NULL, 20),
  ('site', 'site_guarantees_col2_items', 'site · garanties', 'Carte 2 · puces (1 par ligne)', 'list', NULL,
    '["Contrat BATISSUR n° 10998463604","RC Entreprise : 10 000 000 €","Dommages matériels : 2 000 000 €","Garantie décennale travaux IRVE"]'::jsonb, 21),
  ('site', 'site_guarantees_col3_title', 'site · garanties', 'Carte 3 · titre', 'text', 'Conformité et Certifications', NULL, 30),
  ('site', 'site_guarantees_col3_items', 'site · garanties', 'Carte 3 · puces (1 par ligne)', 'list', NULL,
    '["Respect NF C15-100","CONSUEL systématique","Certification B Corp","Membre ORIAS n° 21009382"]'::jsonb, 31),
  ('site', 'site_guarantees_footer_label', 'site · garanties', 'Bandeau bas · libellé', 'text', 'RECONNU PAR', NULL, 40),
  ('site', 'site_guarantees_footer_text', 'site · garanties', 'Bandeau bas · texte', 'multiline',
    'Attestations et certifications disponibles sur simple demande : RC Décennale AXA, Qualifelec IRVE, agréments constructeurs.', NULL, 41),

  -- ====== SITE · SYNTHÈSE PROJET ======
  ('site', 'site_synthesis_eyebrow', 'site · synthèse projet', 'Eyebrow page Synthèse', 'text', '2 · SYNTHÈSE PROJET', NULL, 1),
  ('site', 'site_synthesis_title', 'site · synthèse projet', 'Titre page Synthèse', 'text', 'Une lecture rapide du chantier', NULL, 2),

  -- ====== SITE · INFRASTRUCTURE ======
  ('site', 'site_infra_eyebrow', 'site · infrastructure', 'Eyebrow page Infrastructure', 'text', '3 · INFRASTRUCTURE ÉLECTRIQUE', NULL, 1),
  ('site', 'site_infra_title', 'site · infrastructure', 'Titre page Infrastructure', 'text', 'Travaux à réaliser · devis installation', NULL, 2),

  -- ====== SITE · ÉQUIPEMENTS ======
  ('site', 'site_equip_eyebrow', 'site · équipements', 'Eyebrow page Équipements', 'text', '4 · ÉQUIPEMENTS BEEV', NULL, 1),
  ('site', 'site_equip_title', 'site · équipements', 'Titre page Équipements', 'text', 'Les bornes de recharge', NULL, 2),
  ('site', 'site_equip_smart_title', 'site · équipements', 'Carte "Smart charging" · titre', 'text', 'Smart charging', NULL, 10),
  ('site', 'site_equip_smart_items', 'site · équipements', 'Carte "Smart charging" · puces (1 par ligne)', 'list', NULL,
    '["Délestage dynamique natif","Équilibrage de charge actif","Compatible OCPP 1.6 et 2.0","Données temps réel"]'::jsonb, 11),

  -- ====== SITE · SUPERVISION · BEEV CONNECT (site entreprise) ======
  ('site', 'site_sup_connect_eyebrow', 'site · supervision', 'Beev Connect · eyebrow', 'text', 'SUPERVISION · BEEV CONNECT', NULL, 1),
  ('site', 'site_sup_connect_title', 'site · supervision', 'Beev Connect · titre', 'text', 'Pilotez votre infrastructure en temps réel', NULL, 2),
  ('site', 'site_sup_connect_intro', 'site · supervision', 'Beev Connect · intro', 'multiline',
    'Beev Connect centralise la supervision de votre parc de bornes sur une plateforme unique. Vous gardez la main sur les usages, les coûts et la fiabilité technique.', NULL, 3),
  ('site', 'site_sup_connect_features', 'site · supervision', 'Beev Connect · fonctionnalités (1 par ligne)', 'list', NULL,
    '["Suivi temps réel des sessions et de la puissance","Reporting consommation et facturation refacturable","Gestion des accès (badges, QR codes, comptes utilisateurs)","Alerting en cas de défaut technique","Pilotage à distance et redémarrage à distance","API ouverte pour intégration SI/RH"]'::jsonb, 4),
  ('site', 'site_sup_connect_price_label', 'site · supervision', 'Beev Connect · libellé prix', 'text', 'À PARTIR DE', NULL, 5),
  ('site', 'site_sup_connect_price_value', 'site · supervision', 'Beev Connect · valeur prix', 'text', '6 € HT', NULL, 6),
  ('site', 'site_sup_connect_price_unit', 'site · supervision', 'Beev Connect · unité prix', 'text', '/ mois / point de recharge', NULL, 7),
  ('site', 'site_sup_connect_footer', 'site · supervision', 'Beev Connect · bandeau bas', 'multiline',
    'Engagement 12 mois minimum · sans frais d''activation · résiliable avec préavis 30 jours.', NULL, 8),

  -- ====== SITE · SUPERVISION · BEEV HOME CHARGING (B2B2E) ======
  ('site', 'site_sup_home_eyebrow', 'site · supervision', 'Beev Home Charging · eyebrow', 'text', 'SUPERVISION · BEEV HOME CHARGING', NULL, 20),
  ('site', 'site_sup_home_title', 'site · supervision', 'Beev Home Charging · titre', 'text', 'Refacturez la recharge à domicile sans friction', NULL, 21),
  ('site', 'site_sup_home_intro', 'site · supervision', 'Beev Home Charging · intro', 'multiline',
    'Beev Home Charging gère la refacturation de l''électricité consommée à domicile par les collaborateurs en véhicule de fonction. Le salarié branche, l''entreprise rembourse au kWh réel.', NULL, 22),
  ('site', 'site_sup_home_features', 'site · supervision', 'Beev Home Charging · fonctionnalités (1 par ligne)', 'list', NULL,
    '["Comptage précis kWh par session domicile","Tarif électricité indexé sur le contrat du collaborateur","Versement mensuel automatisé sur RIB salarié","Reporting employeur par collaborateur et par véhicule","Conformité fiscale URSSAF (avantage en nature)","Application mobile collaborateur"]'::jsonb, 23),
  ('site', 'site_sup_home_price_label', 'site · supervision', 'Beev Home Charging · libellé prix', 'text', 'À PARTIR DE', NULL, 24),
  ('site', 'site_sup_home_price_value', 'site · supervision', 'Beev Home Charging · valeur prix', 'text', '8 € HT', NULL, 25),
  ('site', 'site_sup_home_price_unit', 'site · supervision', 'Beev Home Charging · unité prix', 'text', '/ mois / collaborateur', NULL, 26),
  ('site', 'site_sup_home_footer', 'site · supervision', 'Beev Home Charging · bandeau bas', 'multiline',
    'Engagement 12 mois minimum · sans frais d''activation · résiliable avec préavis 30 jours.', NULL, 27),

  -- ====== SITE · CONFORMITÉ RÉGLEMENTAIRE ======
  ('site', 'site_comp_eyebrow', 'site · conformité', 'Eyebrow page Conformité', 'text', '5 · CONFORMITÉ RÉGLEMENTAIRE', NULL, 1),
  ('site', 'site_comp_title', 'site · conformité', 'Titre page Conformité', 'text', 'Contrôles obligatoires et maintenance', NULL, 2),

  ('site', 'site_comp_bureau_title', 'site · conformité', 'Bureau de Contrôle · titre', 'text', 'Bureau de Contrôle', NULL, 10),
  ('site', 'site_comp_bureau_desc', 'site · conformité', 'Bureau de Contrôle · description', 'multiline',
    'Abonnement client > 36 kVA → contrôle réglementaire obligatoire. Intervention prévue J+25 après installation. Attestation délivrée à réception.', NULL, 11),
  ('site', 'site_comp_bureau_price_label', 'site · conformité', 'Bureau de Contrôle · libellé prix', 'text', 'COÛT', NULL, 12),
  ('site', 'site_comp_bureau_price', 'site · conformité', 'Bureau de Contrôle · prix affiché', 'text', '700 € HT', NULL, 13),

  ('site', 'site_comp_consuel_title', 'site · conformité', 'Consuel · titre', 'text', 'Consuel', NULL, 20),
  ('site', 'site_comp_consuel_desc', 'site · conformité', 'Consuel · description', 'multiline',
    'Obligatoire pour toute installation IRVE. Passage prévu J+28 après installation. Attestation de conformité délivrée à réception.', NULL, 21),

  ('site', 'site_comp_maint_title', 'site · conformité', 'Maintenance annuelle · titre', 'text', 'Maintenance annuelle', NULL, 30),
  ('site', 'site_comp_maint_unit_label', 'site · conformité', 'Maintenance · libellé ligne 1', 'text', 'Forfait préventif', NULL, 31),
  ('site', 'site_comp_maint_unit_value', 'site · conformité', 'Maintenance · valeur affichée ligne 1', 'text', '150 € HT / PDC / an', NULL, 32),
  ('site', 'site_comp_maint_pdc_label', 'site · conformité', 'Maintenance · libellé ligne 2', 'text', 'Points de recharge', NULL, 33),
  ('site', 'site_comp_maint_total_label', 'site · conformité', 'Maintenance · libellé ligne 3', 'text', 'Total maintenance / an', NULL, 34),
  ('site', 'site_comp_maint_subtitle', 'site · conformité', 'Maintenance · sous-titre encart visite', 'text', 'VISITE ANNUELLE SUR SITE', NULL, 35),
  ('site', 'site_comp_maint_items', 'site · conformité', 'Maintenance · puces visite annuelle', 'list', NULL,
    '["Entretien général","Vérification électrique","Rapport de maintenance détaillé"]'::jsonb, 36),
  ('site', 'site_comp_maint_unit_eur', 'site · conformité', 'Maintenance · prix unitaire €/PDC/an (chiffre utilisé pour le calcul)', 'text', '150', NULL, 37),

  -- ====== SITE · RÉCAPITULATIF FINANCIER ======
  ('site', 'site_fin_eyebrow', 'site · récap financier', 'Eyebrow page Récap financier', 'text', '6 · RÉCAPITULATIF FINANCIER', NULL, 1),
  ('site', 'site_fin_title', 'site · récap financier', 'Titre page Récap financier', 'text', 'Votre budget projet', NULL, 2),
  ('site', 'site_fin_head_poste', 'site · récap financier', 'Colonne 1 (en-tête)', 'text', 'POSTE', NULL, 3),
  ('site', 'site_fin_head_fournisseur', 'site · récap financier', 'Colonne 2 (en-tête)', 'text', 'FOURNISSEUR', NULL, 4),
  ('site', 'site_fin_head_montant', 'site · récap financier', 'Colonne 3 (en-tête)', 'text', 'MONTANT HT', NULL, 5),
  ('site', 'site_fin_install_label', 'site · récap financier', 'Ligne Installation · libellé', 'text', 'Installation électrique', NULL, 10),
  ('site', 'site_fin_install_supplier', 'site · récap financier', 'Ligne Installation · fournisseur', 'text', 'Électricien partenaire', NULL, 11),
  ('site', 'site_fin_bornes_label', 'site · récap financier', 'Ligne Bornes · libellé', 'text', 'Bornes de recharge', NULL, 12),
  ('site', 'site_fin_bornes_supplier', 'site · récap financier', 'Ligne Bornes · fournisseur', 'text', 'Beev', NULL, 13),
  ('site', 'site_fin_bureau_label', 'site · récap financier', 'Ligne Bureau Contrôle · libellé', 'text', 'Bureau de Contrôle (>36 kVA)', NULL, 14),
  ('site', 'site_fin_bureau_supplier', 'site · récap financier', 'Ligne Bureau Contrôle · fournisseur', 'text', 'Tiers', NULL, 15),
  ('site', 'site_fin_sup_label', 'site · récap financier', 'Ligne Supervision · libellé', 'text', 'Supervision (12 premiers mois)', NULL, 16),
  ('site', 'site_fin_sup_supplier', 'site · récap financier', 'Ligne Supervision · fournisseur', 'text', 'Beev', NULL, 17),
  ('site', 'site_fin_sup_value', 'site · récap financier', 'Ligne Supervision · valeur (montant)', 'text', 'OPTION', NULL, 18),
  ('site', 'site_fin_total_ht_label', 'site · récap financier', 'Pied de tableau · Total HT', 'text', 'Total projet HT', NULL, 19),
  ('site', 'site_fin_tva_label', 'site · récap financier', 'Pied de tableau · TVA', 'text', 'TVA 20 %', NULL, 20),
  ('site', 'site_fin_total_ttc_label', 'site · récap financier', 'Pied de tableau · Total TTC', 'text', 'Total TTC', NULL, 21),
  ('site', 'site_fin_maint_note', 'site · récap financier', 'Note bas de page (maintenance hors total)', 'multiline',
    'Maintenance annuelle non incluse dans le total ci-dessus. Voir page Conformité.', NULL, 22),

  -- ====== SITE · OPTIONS DE PAIEMENT ======
  ('site', 'site_pay_eyebrow', 'site · paiement', 'Eyebrow page Paiement', 'text', '7 · OPTIONS DE PAIEMENT', NULL, 1),
  ('site', 'site_pay_title', 'site · paiement', 'Titre page Paiement', 'text', 'Régler en toute flexibilité', NULL, 2),
  ('site', 'site_pay_opt1_title', 'site · paiement', 'Option 1 · titre (Comptant)', 'text', 'Comptant', NULL, 10),
  ('site', 'site_pay_opt1_badge', 'site · paiement', 'Option 1 · badge', 'text', 'Remise 2 %', NULL, 11),
  ('site', 'site_pay_opt1_desc', 'site · paiement', 'Option 1 · description', 'multiline',
    'Paiement intégral à la commande. Économie immédiate sur le total projet.', NULL, 12),
  ('site', 'site_pay_opt2_title', 'site · paiement', 'Option 2 · titre (Classique)', 'text', 'Classique', NULL, 20),
  ('site', 'site_pay_opt2_badge', 'site · paiement', 'Option 2 · badge', 'text', 'Standard', NULL, 21),
  ('site', 'site_pay_opt2_desc', 'site · paiement', 'Option 2 · description', 'multiline',
    '50 % acompte à la commande, 50 % à réception. Échéancier détaillé possible.', NULL, 22),
  ('site', 'site_pay_opt3_title', 'site · paiement', 'Option 3 · titre (Leasing)', 'text', 'Leasing', NULL, 30),
  ('site', 'site_pay_opt3_badge', 'site · paiement', 'Option 3 · badge', 'text', 'Sur demande', NULL, 31),
  ('site', 'site_pay_opt3_desc', 'site · paiement', 'Option 3 · description', 'multiline',
    'Financement LLD sur 36 / 48 / 60 mois selon profil. Simulation personnalisée par notre partenaire.', NULL, 32),
  ('site', 'site_pay_total_label', 'site · paiement', 'Bandeau bas · libellé "MONTANT TOTAL PROJET"', 'text', 'MONTANT TOTAL PROJET', NULL, 40),
  ('site', 'site_pay_acompte_label', 'site · paiement', 'Bandeau bas · libellé acompte', 'text', 'Acompte 50 % à la commande', NULL, 41),
  ('site', 'site_pay_cta', 'site · paiement', 'Bandeau bas · CTA contact', 'text', 'Signez le devis en ligne · contact@beev.co', NULL, 42),
  ('site', 'site_pay_discount_pct', 'site · paiement', 'Pourcentage remise comptant (chiffre utilisé pour le calcul, ex: 2)', 'text', '2', NULL, 43),
  ('site', 'site_pay_bureau_ht', 'site · récap financier', 'Coût Bureau de Contrôle (chiffre utilisé pour le calcul, € HT)', 'text', '700', NULL, 23)

ON CONFLICT (scope, slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
