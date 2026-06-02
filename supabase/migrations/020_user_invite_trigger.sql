-- Migration 020 : trigger auto-création profile + backfill + RLS profiles
--
-- Avant : un nouvel utilisateur créé via signInWithOtp ou Auth Dashboard avait
-- une entrée dans auth.users mais PAS dans public.profiles. Conséquence :
-- isAdmin/isOps/isSales = false (rôle null), l'utilisateur tournait en boucle
-- sur /login.
--
-- Après : trigger auto qui crée la ligne profiles avec role 'visitor' par défaut
-- dès qu'un user est ajouté à auth.users. L'admin assigne ensuite le rôle réel
-- via /admin/users.

-- Trigger function
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'visitor')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill : crée les profils manquants pour les utilisateurs déjà existants
INSERT INTO public.profiles (id, email, role)
SELECT u.id, u.email, 'visitor'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- === RLS profiles ===
-- Tous les utilisateurs connectés peuvent lire les profils (nécessaire pour
-- /admin/users côté admin, et pour vérifier son propre rôle côté tous).
-- Seul admin peut modifier les rôles. L'utilisateur peut modifier son propre
-- email/profil mais PAS son propre rôle.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read profiles" ON profiles;
CREATE POLICY "Authenticated read profiles" ON profiles FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Admin write profiles" ON profiles;
CREATE POLICY "Admin write profiles" ON profiles FOR ALL TO authenticated
  USING (is_admin_only())
  WITH CHECK (is_admin_only());

-- Vérification
SELECT
  (SELECT COUNT(*) FROM auth.users) AS auth_users,
  (SELECT COUNT(*) FROM public.profiles) AS profiles,
  (SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created')) AS trigger_existe;
