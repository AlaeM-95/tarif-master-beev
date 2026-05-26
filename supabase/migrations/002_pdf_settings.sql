-- ====== TABLE pdf_settings : 1 ligne par type de projet ======
CREATE TABLE pdf_settings (
  project_type TEXT PRIMARY KEY CHECK (project_type IN ('vehicles', 'home', 'site')),
  -- Couleurs (hex)
  color_ink TEXT DEFAULT '#111111',
  color_accent TEXT DEFAULT '#35DA76',
  color_lavender TEXT DEFAULT '#3809EA',
  color_bg TEXT DEFAULT '#FAF8F4',
  -- Images
  logo_url TEXT,
  cover_image_url TEXT,
  -- Textes
  cover_subtitle TEXT,
  why_beev_intro TEXT,
  why_beev_bullets JSONB,
  validation_conditions TEXT,
  validation_bpa_text TEXT,
  validation_bpa_title TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== TABLE journey_steps : étapes du parcours par type de projet ======
CREATE TABLE journey_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_type TEXT NOT NULL CHECK (project_type IN ('vehicles', 'home', 'site')),
  position INTEGER NOT NULL,
  step_number TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  duration TEXT,
  beev_actions JSONB,
  client_actions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_type, position)
);

-- ====== RLS ======
ALTER TABLE pdf_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read pdf_settings" ON pdf_settings FOR SELECT USING (true);
CREATE POLICY "Admin write pdf_settings" ON pdf_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public read journey_steps" ON journey_steps FOR SELECT USING (true);
CREATE POLICY "Admin write journey_steps" ON journey_steps FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ====== SEED initial : valeurs par défaut basées sur le code actuel ======
INSERT INTO pdf_settings (project_type, cover_subtitle, why_beev_intro, why_beev_bullets, validation_conditions, validation_bpa_text, validation_bpa_title) VALUES
('vehicles',
 'Véhicules électriques pour votre flotte',
 'Beev centralise pour vous le sourcing constructeur (Tesla, Mercedes, Renault, VW, Hyundai, Kia, Peugeot…), le financement LLD (Ayvens, Arval, Athlon, Leaseplan), et l''assistance multimarque tout au long de la vie du contrat. Loyers exprimés en TTC.',
 '["Un interlocuteur unique pour l''intégralité de votre flotte VE.","Tarifs négociés grand compte sur tous les constructeurs.","Étude TCO (loyer + énergie) systématique vs référence thermique.","Maintenance, assistance 24/24 et gestion des pertes totales toujours incluses.","Suivi commercial dédié grand compte."]'::jsonb,
 'Offre valable 30 jours. Loyers exprimés en TTC, sous réserve de disponibilité constructeur, d''évolution de la fiscalité applicable et d''acceptation par la direction des risques du loueur. TCO indicatif, hors malus, hors aides locales.',
 'Le client confirme la sélection des véhicules ci-avant et autorise Beev à transmettre les bons de commande LLD au loueur retenu, sous réserve de l''accord risque.',
 'BON POUR ACCORD — OFFRE VÉHICULES LLD'),
('home',
 'Bornes de recharge domicile collaborateurs',
 'Vous équipez vos collaborateurs roulant en véhicule électrique d''une borne à leur domicile. Beev gère l''intégralité : vente, installation IRVE certifiée par notre partenaire Seris, supervision, et remboursement automatisé de l''énergie consommée à titre professionnel.',
 '["Un kit standardisé : matériel + pose 0–10 m + supervision + remboursement.","Pose réalisée par technicien IRVE certifié partenaire Seris.","Supervision en marque blanche : visibilité par collaborateur, par site.","Remboursement automatisé de l''énergie consommée à des fins professionnelles.","Garantie matériel jusqu''à 4 ans selon la gamme retenue."]'::jsonb,
 'Offre valable 30 jours. Tarifs HT, pose 0–10 m incluse. Au-delà : devis complémentaire après visite technique. Le mandat d''installation est signé individuellement par chaque collaborateur bénéficiaire.',
 'L''employeur valide le cadre du déploiement B2B2E. Chaque installation au domicile d''un collaborateur fera l''objet d''un mandat individuel signé par le collaborateur concerné.',
 'BON POUR ACCORD — DÉPLOIEMENT DOMICILE COLLABORATEURS'),
('site',
 'Bornes de recharge site entreprise',
 'Vous électrifiez vos sites tertiaires, logistiques ou commerciaux. Beev prend en charge l''étude de site, le matériel premium (Alfen, Schneider, Hager, Wallbox), la pose IRVE certifiée, le génie civil, la mise en service OCPP et la formation des utilisateurs.',
 '["Visite technique de chaque site et étude de faisabilité IRVE.","Devis détaillé matériel + pose + génie civil, ligne par ligne.","Pose par technicien IRVE certifié, mise en service OCPP, formation utilisateurs.","Supervision flotte multi-sites et compteurs MID conformes.","Garantie constructeur 3 ans extensible 6 ans."]'::jsonb,
 'Offre valable 30 jours. Tarifs HT, sous réserve de visite technique sur site. Le devis ferme par site est émis après audit IRVE. Garantie constructeur 3 ans, extensible 6 ans en option.',
 'Le client autorise Beev à lancer l''étude technique sur site. Le devis ferme par site sera émis après audit IRVE et signé séparément avant pose.',
 'BON POUR ACCORD — DÉPLOIEMENT SITE ENTREPRISE');

-- Seed des étapes parcours pour le projet "vehicles" (5 étapes)
INSERT INTO journey_steps (project_type, position, step_number, title, summary, duration, beev_actions, client_actions) VALUES
('vehicles', 1, '1', 'Cadrage de la flotte', 'Sélection définitive du nombre de véhicules, marques, modèles, couple durée / kilométrage, options et prestations.', 'J → J+3',
 '["Consolide la fiche besoin par véhicule","Verrouille les tarifs loueurs (Ayvens, Arval, Athlon…)","Émet le bon pour accord LLD"]'::jsonb,
 '["Valide la sélection véhicules","Confirme durée, kilométrage et options","Signe le BPA commercial"]'::jsonb),
('vehicles', 2, '2', 'Constitution du dossier financement', 'Récupération des pièces comptables nécessaires à l''étude de crédit-bail.', 'J+3 → J+10',
 '["Monte le dossier risque loueur","Suit la décision du comité crédit","Négocie en cas d''aller-retour"]'::jsonb,
 '["Kbis de moins de 3 mois","Dernier bilan & liasse fiscale","RIB société","CNI du gérant ou mandat de signature"]'::jsonb),
('vehicles', 3, '3', 'Signature des bons de commande', 'Une fois l''accord de financement obtenu, émission et signature des BC LLD constructeurs.', 'J+10 → J+15',
 '["Édite les BC LLD par véhicule","Transmet au constructeur retenu","Confirme les délais usine"]'::jsonb,
 '["Signe les bons de commande","Valide le planning prévisionnel"]'::jsonb),
('vehicles', 4, '4', 'Choix du lieu de livraison', 'Sélection de la ville pour solliciter le distributeur partenaire le plus proche — livraison concession, collaborateur ou siège.', 'J+15 → livraison',
 '["Sollicite le réseau distributeur partenaire","Coordonne la logistique de livraison","Prépare la prise en main"]'::jsonb,
 '["Indique l''adresse / la concession","Désigne le contact réception","Confirme la date de remise"]'::jsonb),
('vehicles', 5, '5', 'Pilotage Fleet Manager Beev', 'Synchronisation du suivi sur notre Fleet Manager — Ryma reprend la relation constructeur et vous tient informés.', 'Continu',
 '["Ryma pilote la livraison constructeur","Updates hebdo sur l''avancement","Hotline gestion de flotte tout au long du contrat"]'::jsonb,
 '["Accès Fleet Manager (multi-utilisateurs)","Validation des PV de livraison"]'::jsonb);

-- Seed des étapes parcours pour "home"
INSERT INTO journey_steps (project_type, position, step_number, title, summary, duration, beev_actions, client_actions) VALUES
('home', 1, '1', 'Cadrage employeur B2B2E', 'Définition du périmètre : collaborateurs éligibles, gamme de borne, modalités de remboursement de l''énergie.', 'J → J+5',
 '["Rédige la convention cadre B2B2E","Configure le portail employeur","Forme le RH / flotte"]'::jsonb,
 '["Liste des collaborateurs bénéficiaires","Choix du modèle de borne standard","Validation du tarif kWh remboursé"]'::jsonb),
('home', 2, '2', 'Onboarding collaborateur', 'Chaque collaborateur signe un mandat d''installation et complète un formulaire technique sur son logement.', 'Par collaborateur',
 '["Envoi du lien d''onboarding au collaborateur","Vérification de la complétude du dossier"]'::jsonb,
 '["Mandat d''installation signé","Photos tableau électrique, parking, cheminement câble","Justificatif d''occupation du logement"]'::jsonb),
('home', 3, '3', 'Visite technique & devis ferme', 'Audit à distance ou visite physique par notre partenaire IRVE Seris, puis devis ferme transmis pour validation.', 'J+10 → J+20',
 '["Audit Seris (distance ou physique)","Émission du devis ferme par collaborateur","Gestion des dépassements 0–10 m"]'::jsonb,
 '["Validation du devis ferme","Choix de la date de pose"]'::jsonb),
('home', 4, '4', 'Pose & mise en service', 'Installation par technicien IRVE certifié, mise en service de la supervision en marque blanche.', '1 demi-journée',
 '["Pose IRVE certifiée Seris","Mise en service de la supervision","Procès-verbal de mise en service"]'::jsonb,
 '["Accès au logement le jour J","Réception et signature du PV"]'::jsonb),
('home', 5, '5', 'Supervision & remboursement énergie', 'Pilotage en marque blanche par collaborateur, remboursement automatisé de l''énergie consommée à titre professionnel sous 30 jours.', 'Continu',
 '["Supervision marque blanche par site / collaborateur","Calcul mensuel des kWh pro","Remboursement automatisé"]'::jsonb,
 '["Dashboard employeur consolidé","Reporting mensuel par collaborateur"]'::jsonb);

-- Seed des étapes parcours pour "site"
INSERT INTO journey_steps (project_type, position, step_number, title, summary, duration, beev_actions, client_actions) VALUES
('site', 1, '1', 'Cadrage du projet IRVE', 'Définition du nombre de sites, du nombre de points de charge par site et des usages (flotte interne, visiteurs, public).', 'J → J+5',
 '["Atelier de cadrage besoin","Pré-dimensionnement par site","Émission du bon pour accord"]'::jsonb,
 '["Liste des sites concernés","Usages cibles par site","Signature du BPA cadre"]'::jsonb),
('site', 2, '2', 'Audit technique site', 'Visite physique de chaque site : trajets de câble, dimensionnement TGBT, contraintes d''accès chantier.', 'J+5 → J+20',
 '["Visite IRVE par site","Étude électrique TGBT / délestage","Reportage photo & note technique"]'::jsonb,
 '["Accès aux locaux techniques","Plans du site (si disponibles)","Désignation du référent site"]'::jsonb),
('site', 3, '3', 'Devis ferme & planification', 'Devis détaillé ligne par ligne (matériel + IRVE + génie civil) et planning de chantier par site.', 'J+20 → J+30',
 '["Devis ferme par site","Planning chantier consolidé","Coordination génie civil le cas échéant"]'::jsonb,
 '["Validation du devis ferme","Confirmation des créneaux d''intervention"]'::jsonb),
('site', 4, '4', 'Travaux, pose & mise en service', 'Pose par technicien IRVE certifié, paramétrage OCPP, formation utilisateurs, signature du PV de réception.', 'Selon site',
 '["Pose IRVE certifiée","Paramétrage superviseur OCPP","Formation utilisateurs et gestionnaire"]'::jsonb,
 '["Réception chantier & PV","Communication interne aux utilisateurs"]'::jsonb),
('site', 5, '5', 'Exploitation, supervision & SAV', 'Supervision multi-sites, hotline utilisateurs, maintenance préventive, garantie 3 ans extensible 6 ans.', 'Continu',
 '["Supervision multi-sites Beev","Hotline & GTR contractuelle","Maintenance préventive annuelle"]'::jsonb,
 '["Dashboard consolidé","Reporting d''usage trimestriel"]'::jsonb);
