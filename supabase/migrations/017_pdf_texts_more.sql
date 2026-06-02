-- Étend pdf_texts avec les textes additionnels couramment retouchés
-- (eyebrows de section, libellés colonnes, headers, titres de page).
-- Tous sont éditables depuis /admin/pdf après cette migration.

INSERT INTO pdf_texts (scope, slug, category, label, kind, content_text, content_list, position) VALUES
  -- Couverture (libellés petits)
  ('common', 'cover_offer_label', 'couverture', 'Libellé "OFFRE COMMERCIALE" (haut droite)', 'text', 'OFFRE COMMERCIALE', NULL, 10),

  -- Notre approche (en plus du whyBeevIntro / whyBeevBullets déjà dans pdf_settings)
  ('common', 'why_beev_eyebrow', 'pourquoi beev', 'Eyebrow "NOTRE APPROCHE"', 'text', 'NOTRE APPROCHE', NULL, 5),
  ('common', 'why_beev_chiffres_title', 'pourquoi beev', 'Titre encart chiffres clés', 'text', 'BEEV EN CHIFFRES', NULL, 6),

  -- Fiche véhicule (titres et labels recurrents)
  ('vehicles', 'vehicle_tariff_chip', 'page véhicule', 'Chip en haut de la fiche véhicule', 'text', 'TARIFICATION LLD', NULL, 1),
  ('vehicles', 'vehicle_catalog_label', 'page véhicule', 'Libellé "PRIX CATALOGUE TTC"', 'text', 'PRIX CATALOGUE TTC', NULL, 2),
  ('vehicles', 'vehicle_discount_label', 'page véhicule', 'Libellé remise commerciale', 'text', 'REMISE COMMERCIALE', NULL, 3),
  ('vehicles', 'vehicle_monthly_label', 'page véhicule', 'Libellé loyer mensuel', 'text', 'LOYER MENSUEL TTC', NULL, 4),
  ('vehicles', 'vehicle_tco_block_title', 'page véhicule', 'Titre encart bloc TCO sur fiche véhicule', 'text', 'COÛT TOTAL DE POSSESSION (TCO)', NULL, 5),
  ('vehicles', 'vehicle_tco_fiscal_title', 'page véhicule', 'Titre détails fiscaux sur fiche véhicule', 'text', 'DÉTAILS FISCAUX (CALCUL BEEV 2026)', NULL, 6),

  -- TCO comparaison
  ('vehicles', 'tco_compare_eyebrow', 'comparaison tco', 'Eyebrow page comparaison TCO', 'text', 'COMPARAISON TCO ENTRE VÉHICULES', NULL, 1),
  ('vehicles', 'tco_compare_title', 'comparaison tco', 'Titre page comparaison TCO', 'text', 'Quel véhicule offre le meilleur coût total ?', NULL, 2),

  -- Engagements Beev
  ('common', 'pillars_eyebrow', 'engagements', 'Eyebrow "GARANTIES & ENGAGEMENTS BEEV"', 'text', 'GARANTIES & ENGAGEMENTS BEEV', NULL, 1),
  ('common', 'pillars_title', 'engagements', 'Titre "Ce que Beev s''engage à tenir."', 'text', 'Ce que Beev s''engage à tenir.', NULL, 2),

  -- Parcours client (en complément du journey_title et changes_header existants)
  ('common', 'journey_eyebrow', 'parcours', 'Eyebrow page parcours client', 'text', 'PARCOURS CLIENT BEEV — DE A À Z', NULL, 1),

  -- En bref (synthèse direction)
  ('common', 'executive_eyebrow', 'en bref', 'Eyebrow page synthèse direction', 'text', 'EN BREF · POUR LE COMITÉ DE DIRECTION', NULL, 1),
  ('vehicles', 'executive_title', 'en bref', 'Titre page synthèse direction', 'text', 'Votre flotte VE en synthèse.', NULL, 2),
  ('home', 'executive_title', 'en bref', 'Titre page synthèse direction', 'text', 'Votre déploiement domicile en synthèse.', NULL, 2),
  ('site', 'executive_title', 'en bref', 'Titre page synthèse direction', 'text', 'Votre déploiement IRVE en synthèse.', NULL, 2),

  -- Prochaines étapes / validation
  ('common', 'next_steps_eyebrow', 'prochaines étapes', 'Eyebrow "PROCHAINES ÉTAPES"', 'text', 'PROCHAINES ÉTAPES', NULL, 1),
  ('common', 'next_steps_title', 'prochaines étapes', 'Titre page prochaines étapes', 'text', 'Validation et lancement du projet.', NULL, 2),

  -- Synthèse financière
  ('common', 'financial_eyebrow', 'synthèse financière', 'Eyebrow page synthèse financière', 'text', 'SYNTHÈSE FINANCIÈRE', NULL, 1),
  ('common', 'financial_title', 'synthèse financière', 'Titre page synthèse financière', 'text', 'Récapitulatif HT / TVA / TTC.', NULL, 2)
ON CONFLICT (scope, slug) DO NOTHING;

-- Vérification
SELECT category, COUNT(*) AS nb FROM pdf_texts GROUP BY category ORDER BY category;
