-- Ajoute une colonne description (paragraphe long) à la table chargers.
-- Permet à l'admin de personnaliser le texte qui s'affiche sur la fiche borne du PDF.

ALTER TABLE chargers ADD COLUMN IF NOT EXISTS description TEXT;

-- Vérification
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'chargers' AND column_name = 'description';
