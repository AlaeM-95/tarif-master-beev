-- Migration 050 : éco-score "prochainement" (badge commercial, sans effet fiscal)
--
-- Vehicle.ecoScoreUpcoming avait été ajouté côté TypeScript (catalog.ts) sans
-- colonne DB correspondante : la sélection "Prochainement" dans la fiche
-- véhicule admin semblait ne jamais se sauvegarder (data.ts n'avait pas non
-- plus le mapping — corrigé dans le même commit), Supabase ignorant
-- silencieusement le champ inconnu dans le payload d'update.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS eco_score_upcoming boolean DEFAULT false;

NOTIFY pgrst, 'reload schema';
