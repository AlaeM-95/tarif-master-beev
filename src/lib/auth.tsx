import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, appUrl, type UserRole } from "./supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  /** Super-admin : tous les droits y compris gestion des rôles utilisateurs. */
  isAdmin: boolean;
  /** Ops (ou admin) : droits d'écriture sur catalogue / pricing / PDF templates. */
  isOps: boolean;
  /** Sales (ou ops/admin) : peut construire et sauvegarder des propositions,
   *  générer des PDF. Tous les utilisateurs connectés avec un rôle reconnu. */
  isSales: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Connexion par lien magique envoyé par email (pas de mot de passe requis).
   *  Permet aux comptes invités de toujours se reconnecter. */
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  /** Envoie un email de réinitialisation / définition de mot de passe. */
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  /** Définit (ou met à jour) le mot de passe de l'utilisateur connecté. */
  setPassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Récupère le rôle de l'utilisateur depuis la table profiles.
  // Try-catch global pour ne JAMAIS bloquer le loading state.
  const fetchRole = async (userId: string): Promise<UserRole | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        console.error("[auth] fetchRole error:", error);
        return null;
      }
      return data?.role ?? null;
    } catch (err) {
      console.error("[auth] fetchRole exception:", err);
      return null;
    }
  };

  useEffect(() => {
    // Init session — try/finally garantit que loading passe TOUJOURS à false,
    // même si Supabase plante ou si fetchRole throw.
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const userRole = await fetchRole(session.user.id);
          setRole(userRole);
        }
      } catch (err) {
        console.error("[auth] init session error:", err);
      } finally {
        setLoading(false);
      }
    };
    init();

    // Listener changements de session — wrappé dans try/catch défensif
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const userRole = await fetchRole(session.user.id);
          setRole(userRole);
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error("[auth] onAuthStateChange error:", err);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  // Lien magique : connecte sans mot de passe. shouldCreateUser:false pour ne
  // pas créer de compte depuis l'écran de login (l'invitation se fait par l'admin).
  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: appUrl() },
    });
    return { error: error?.message ?? null };
  };

  // Réinitialisation : envoie un email avec un lien qui ramène sur /set-password.
  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: appUrl("/set-password"),
    });
    return { error: error?.message ?? null };
  };

  const setPassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        isAdmin: role === "admin",
        isOps: role === "admin" || role === "ops",
        isSales: role === "admin" || role === "ops" || role === "sales",
        loading,
        signIn,
        signInWithMagicLink,
        sendPasswordReset,
        setPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur d'<AuthProvider>");
  return ctx;
}
