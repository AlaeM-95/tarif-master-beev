import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type UserRole } from "./supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
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
        loading,
        signIn,
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
