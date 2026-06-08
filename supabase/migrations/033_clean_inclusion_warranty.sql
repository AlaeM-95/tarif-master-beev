-- Migration 033 : nettoyage de la ligne garantie dans charger_inclusion_items
-- La ligne "Garantie constructeur 3 ans, extensible 6 ans" doit être retirée
-- de l'encart "INCLUS DANS LA PRESTATION CLÉ EN MAIN" car la garantie est
-- désormais portée par modèle de borne (champ chargers.warranty éditable
-- dans /admin/chargers depuis la migration 032).
-- Idem pour la home : "Garantie constructeur selon la gamme" devient
-- redondant avec la fiche produit par borne.

-- Site entreprise : retire la ligne garantie
UPDATE pdf_texts
   SET content_list = '["Étude de site et chiffrage par technicien IRVE certifié","Pose, raccordement et mise en service","Paramétrage OCPP et configuration du superviseur","Formation des utilisateurs sur site","Gestion des déchets de chantier"]'::jsonb
 WHERE scope = 'site' AND slug = 'charger_inclusion_items';

-- Home / B2B2E : retire la ligne garantie
UPDATE pdf_texts
   SET content_list = '["Matériel et accessoires de raccordement","Pose et raccordement par technicien IRVE certifié","Câblage standard jusqu''à 10 m du tableau électrique","Supervision Beev en marque blanche","Remboursement automatisé de l''énergie consommée à titre professionnel"]'::jsonb
 WHERE scope = 'home' AND slug = 'charger_inclusion_items';

NOTIFY pgrst, 'reload schema';
