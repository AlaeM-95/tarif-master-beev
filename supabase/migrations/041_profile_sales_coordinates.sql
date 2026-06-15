-- Migration 041 : coordonnées commercial rattachées au compte
--
-- Chaque commercial dispose de coordonnées (nom complet, téléphone) stockées
-- sur SON profil. À l'ouverture du devis, les champs « Informations client &
-- commercial » sont pré-remplis automatiquement à partir du compte connecté
-- (email = identifiant). Le commercial peut enregistrer / mettre à jour ses
-- coordonnées depuis le devis ; elles restent rattachées à son compte.

-- 1) Colonnes coordonnées sur profiles (email existe déjà sur la table).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sales_rep_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sales_rep_phone text;

-- 2) Pré-remplissage des deux commerciaux connus. UPDATE par email : ne crée
--    pas de profil (celui-ci est créé par le trigger à la première connexion),
--    se contente de renseigner les coordonnées si le profil existe déjà.
UPDATE public.profiles
   SET sales_rep_name = 'Alaé MAHMOUDI', sales_rep_phone = '+33 6 72 49 77 38'
 WHERE lower(email) = 'alae@beev.co';

UPDATE public.profiles
   SET sales_rep_name = 'Amine AOUKA', sales_rep_phone = '+33 7 57 91 64 21'
 WHERE lower(email) = 'amine@beev.co';

-- 3) RPC sécurisée : un utilisateur connecté met à jour UNIQUEMENT ses propres
--    coordonnées (nom + téléphone), jamais son rôle ni un autre profil.
--    SECURITY DEFINER pour contourner la policy d'écriture réservée à l'admin
--    (migration 020) tout en restant cantonné à auth.uid().
CREATE OR REPLACE FUNCTION public.update_my_sales_coordinates(p_name text, p_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  UPDATE public.profiles
     SET sales_rep_name  = NULLIF(btrim(p_name), ''),
         sales_rep_phone = NULLIF(btrim(p_phone), '')
   WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_sales_coordinates(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_my_sales_coordinates(text, text) TO authenticated;
