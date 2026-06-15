import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type UserRole } from "./supabase";
import { useAuth } from "./auth";

export type AppUser = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

async function fetchUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[users] fetch error:", error);
    return [];
  }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    email: r.email ?? "",
    role: r.role as UserRole,
    createdAt: r.created_at,
  }));
}

export function useUsers() {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  // Change le rôle d'un utilisateur. RLS : seul un admin peut.
  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  // Envoi d'un lien magique d'inscription/connexion à un email donné.
  // Si l'email n'existe pas en base, Supabase crée le user et envoie le lien.
  // À la première connexion, le trigger handle_new_user() ajoute la ligne
  // profiles avec rôle 'visitor'. L'admin assigne ensuite le bon rôle.
  const inviteUser = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          // Redirection après clic sur le lien (page d'accueil de l'app)
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { users, isLoading, updateRole, inviteUser };
}

// Coordonnées commercial rattachées au compte connecté (table profiles).
// Sert à pré-remplir et persister les champs « commercial » du devis.
export type SalesCoordinates = {
  name: string;
  email: string;
  phone: string;
};

export function useMyCoordinates() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? null;

  const { data: coordinates, isLoading } = useQuery({
    queryKey: ["my-coordinates", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<SalesCoordinates | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("email, sales_rep_name, sales_rep_phone")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        console.error("[users] fetch coordinates error:", error);
        return null;
      }
      return {
        name: (data as any)?.sales_rep_name ?? "",
        email: data?.email ?? user?.email ?? "",
        phone: (data as any)?.sales_rep_phone ?? "",
      };
    },
  });

  // Enregistre nom + téléphone sur le profil via la RPC sécurisée (l'email
  // est l'identifiant du compte, non modifiable ici).
  const save = useMutation({
    mutationFn: async ({ name, phone }: { name: string; phone: string }) => {
      const { error } = await supabase.rpc("update_my_sales_coordinates", {
        p_name: name,
        p_phone: phone,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-coordinates", userId] }),
  });

  return { coordinates, isLoading, save };
}

// Étiquettes lisibles pour l'UI
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin (tous droits)",
  ops: "Ops (catalogue / pricing / PDF)",
  sales: "Sales (propositions et PDF)",
  visitor: "Visiteur (lecture seule)",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: "bg-[#FFB800]/15 text-[#9A6800] border-[#FFB800]/30",
  ops: "bg-[#3809EA]/10 text-[#3809EA] border-[#3809EA]/30",
  sales: "bg-[#35DA76]/10 text-[#1E7A3F] border-[#35DA76]/30",
  visitor: "bg-muted text-muted-foreground border-border",
};
