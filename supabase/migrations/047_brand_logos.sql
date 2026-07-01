-- Migration 047 : logos de marque pour le catalogue véhicules
--
-- Contexte : le catalogue affiche vehicle.brand en texte libre ("Peugeot",
-- "Renault", "Tesla"...). La refonte visuelle du catalogue (proposition
-- validée : fusion des maquettes "magazine" + "fiche technique") ajoute un
-- badge logo à côté du nom de chaque véhicule. Ce logo est propre à la
-- MARQUE, pas au véhicule : une seule table, une ligne par marque, réutilisée
-- par tous les véhicules de cette marque (pas de duplication sur vehicles).
--
-- Tant qu'une marque n'a pas de logo renseigné, l'app affiche un monogramme
-- de repli (2 initiales) — voir index.tsx. Rien ne casse si cette table est
-- vide au déploiement.

CREATE TABLE IF NOT EXISTS brand_logos (
  brand text PRIMARY KEY,
  logo_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE brand_logos ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié de l'outil (sales, ops, admin).
DROP POLICY IF EXISTS "Authenticated read brand_logos" ON brand_logos;
CREATE POLICY "Authenticated read brand_logos" ON brand_logos FOR SELECT TO authenticated
  USING (true);

-- Écriture : réservée à sales+ops+admin, même règle que l'édition des
-- fiches produit (migration 037_sales_catalog_write.sql).
DROP POLICY IF EXISTS "Sales+Ops+Admin write brand_logos" ON brand_logos;
CREATE POLICY "Sales+Ops+Admin write brand_logos" ON brand_logos FOR ALL TO authenticated
  USING (is_sales_or_above()) WITH CHECK (is_sales_or_above());

-- Pas de nouveau bucket de stockage : ImageUpload (src/components/image-upload.tsx)
-- uploade toujours vers le bucket existant 'vehicle-images' (repli 'documents'),
-- le paramètre `folder` n'étant qu'un préfixe de chemin. Les fichiers de logo
-- marque atterrissent donc dans vehicle-images/brand-logos/..., déjà couvert
-- par les policies des migrations 005 et 043 (lecture publique, écriture
-- sales+ops+admin). Aucune policy Storage supplémentaire n'est nécessaire ici.

NOTIFY pgrst, 'reload schema';

-- Vérification
SELECT polname FROM pg_policy WHERE polrelid = 'brand_logos'::regclass;
