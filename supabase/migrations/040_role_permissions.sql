-- Matrice de permissions par rôle, éditable par l'admin depuis /admin/users.
-- Permet de décider finement, par rôle, qui peut accéder au backoffice
-- véhicules, au backoffice PDF, gérer les utilisateurs, ou éditer les fiches
-- produit, sans toucher au code.
--
-- L'app DÉGRADE gracieusement si cette table n'existe pas encore : elle
-- retombe sur des valeurs par défaut équivalentes au comportement historique
-- (admin = tout, ops = backoffice + édition fiche, sales/visitor = rien).

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role text PRIMARY KEY,
  -- Accès au backoffice catalogue véhicules & loueurs (/admin/vehicles)
  backoffice_vehicles boolean NOT NULL DEFAULT false,
  -- Accès au backoffice PDF (textes, réglages) (/admin/pdf)
  backoffice_pdf boolean NOT NULL DEFAULT false,
  -- Gestion des utilisateurs et des rôles (/admin/users)
  manage_users boolean NOT NULL DEFAULT false,
  -- Édition inline de la fiche produit véhicule (depuis le catalogue)
  edit_product_sheet boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Valeurs par défaut alignées sur le comportement actuel de l'application.
INSERT INTO public.role_permissions (role, backoffice_vehicles, backoffice_pdf, manage_users, edit_product_sheet) VALUES
  ('admin',   true,  true,  true,  true),
  ('ops',     true,  true,  false, true),
  ('sales',   false, false, false, false),
  ('visitor', false, false, false, false)
ON CONFLICT (role) DO NOTHING;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Lecture par tous les utilisateurs connectés (pour que l'app applique les gates).
DROP POLICY IF EXISTS "role_permissions read" ON public.role_permissions;
CREATE POLICY "role_permissions read" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- Écriture réservée à l'admin (réutilise le helper de la migration 019/020).
DROP POLICY IF EXISTS "role_permissions admin write" ON public.role_permissions;
CREATE POLICY "role_permissions admin write" ON public.role_permissions
  FOR ALL TO authenticated USING (is_admin_only()) WITH CHECK (is_admin_only());

NOTIFY pgrst, 'reload schema';
