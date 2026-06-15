import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type UserRole } from "./supabase";
import { useAuth } from "./auth";

// Permissions configurables par l'admin (matrice par rôle, table
// role_permissions — migration 040). L'app dégrade gracieusement si la table
// n'existe pas encore : repli sur DEFAULTS, équivalent au comportement
// historique (admin = tout, ops = backoffice + édition fiche, sinon rien).

export type Permission =
  | "backoffice_vehicles"  // accès /admin/vehicles (catalogue & loueurs)
  | "backoffice_pdf"       // accès /admin/pdf (textes & réglages)
  | "manage_users"         // accès /admin/users (utilisateurs & rôles)
  | "edit_product_sheet";  // édition inline de la fiche produit véhicule

export type RolePermissions = Record<Permission, boolean>;
export type RolePermissionsRow = { role: UserRole } & RolePermissions;

export const PERMISSION_LABELS: Record<Permission, string> = {
  backoffice_vehicles: "Backoffice véhicules & loueurs",
  backoffice_pdf: "Backoffice PDF (textes & réglages)",
  manage_users: "Gestion des utilisateurs & rôles",
  edit_product_sheet: "Édition des fiches produit",
};

export const PERMISSION_ORDER: Permission[] = [
  "backoffice_vehicles",
  "backoffice_pdf",
  "edit_product_sheet",
  "manage_users",
];

// Repli aligné sur le comportement actuel de l'app.
const DEFAULTS: Record<UserRole, RolePermissions> = {
  admin: { backoffice_vehicles: true, backoffice_pdf: true, manage_users: true, edit_product_sheet: true },
  ops: { backoffice_vehicles: true, backoffice_pdf: false, manage_users: false, edit_product_sheet: true },
  sales: { backoffice_vehicles: false, backoffice_pdf: false, manage_users: false, edit_product_sheet: false },
  visitor: { backoffice_vehicles: false, backoffice_pdf: false, manage_users: false, edit_product_sheet: false },
};

async function fetchRolePermissions(): Promise<RolePermissionsRow[]> {
  // Cast (supabase as any) : la table role_permissions n'est pas dans les
  // types générés (database.types.ts), comme leaser_offers.
  const { data, error } = await (supabase as any).from("role_permissions").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as RolePermissionsRow[];
}

// Hook de lecture : expose can(permission) pour le rôle de l'utilisateur courant.
export function usePermissions() {
  const { role } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["role_permissions"],
    queryFn: fetchRolePermissions,
    staleTime: 60_000,
    retry: false, // si la table n'existe pas encore, on garde le repli sans réessayer
  });

  const can = (perm: Permission): boolean => {
    if (!role) return false;
    const row = data?.find((r) => r.role === role);
    const source: RolePermissions = row ?? DEFAULTS[role];
    return !!source?.[perm];
  };

  return { can, loading: isLoading };
}

// Hook d'administration : matrice complète + mutation (admin only via RLS).
export function useRolePermissionsAdmin() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["role_permissions"],
    queryFn: fetchRolePermissions,
    retry: false,
  });

  // Construit la matrice affichée : valeurs DB si présentes, sinon DEFAULTS.
  const matrix: Record<UserRole, RolePermissions> = {
    admin: { ...DEFAULTS.admin },
    ops: { ...DEFAULTS.ops },
    sales: { ...DEFAULTS.sales },
    visitor: { ...DEFAULTS.visitor },
  };
  for (const row of query.data ?? []) {
    matrix[row.role] = {
      backoffice_vehicles: row.backoffice_vehicles,
      backoffice_pdf: row.backoffice_pdf,
      manage_users: row.manage_users,
      edit_product_sheet: row.edit_product_sheet,
    };
  }

  const update = useMutation({
    mutationFn: async ({ role, patch }: { role: UserRole; patch: Partial<RolePermissions> }) => {
      // upsert pour créer la ligne si absente (avec les valeurs par défaut + patch)
      const base = matrix[role];
      const { error } = await (supabase as any)
        .from("role_permissions")
        .upsert({ role, ...base, ...patch, updated_at: new Date().toISOString() }, { onConflict: "role" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role_permissions"] }),
  });

  return {
    matrix,
    loading: query.isLoading,
    // true si la table existe (pas d'erreur de chargement)
    available: !query.error,
    update,
  };
}
