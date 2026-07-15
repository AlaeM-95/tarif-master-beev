-- Migration 049 : volume de chargement (m³) pour les véhicules utilitaires
--
-- Vehicle.cargoVolumeM3 avait été ajouté côté TypeScript (catalog.ts) sans
-- colonne DB correspondante : la valeur ne pouvait donc jamais être
-- sauvegardée ni relue (data.ts n'avait pas non plus le mapping — corrigé
-- dans le même commit), d'où le champ toujours vide sur la fiche PDF.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cargo_volume_m3 numeric;

NOTIFY pgrst, 'reload schema';
