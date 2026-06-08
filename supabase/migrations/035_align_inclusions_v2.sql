-- Migration 035 : aligne pdf_texts.charger_inclusion_items sur les nouvelles
-- valeurs souhaitées par le commercial (édit GitHub fallback dans pdf.ts).
--
-- IMPORTANT : le fallback inline dans pdf.ts n'est utilisé que si la clé est
-- ABSENTE en DB. Comme la migration 013 a seedé une valeur, le fallback
-- n'apparaît jamais sur le PDF. Pour synchroniser les modifs faites dans
-- le code, il faut UPDATE pdf_texts.content_list ici.
--
-- HOME (B2B2E) : nouvelle liste épurée, suppression câblage standard,
-- supervision marque blanche et garantie. Ajout d'une ligne combinée
-- supervision + remboursement avec mention (en option).
-- SITE : conserve la liste sans la ligne garantie (déjà gérée par mig 033).

UPDATE pdf_texts
   SET content_list = '["Matériel et accessoires de raccordement","Pose et raccordement par technicien IRVE certifié","Mise en supervision et remboursement automatisé de l''énergie consommée à titre professionnel (en option)","Gestion des déchets de chantier"]'::jsonb
 WHERE scope = 'home' AND slug = 'charger_inclusion_items';

UPDATE pdf_texts
   SET content_list = '["Étude de site et chiffrage par technicien IRVE certifié","Pose, raccordement et mise en service","Paramétrage OCPP et configuration du superviseur","Formation des utilisateurs sur site","Gestion des déchets de chantier"]'::jsonb
 WHERE scope = 'site' AND slug = 'charger_inclusion_items';

NOTIFY pgrst, 'reload schema';
