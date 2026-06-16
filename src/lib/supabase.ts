import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Clés publiques Supabase (l'anon key est conçue pour être exposée côté client,
// la sécurité est garantie par Row Level Security côté base de données).
const SUPABASE_URL = "https://cufovklqzypdosgmkhrp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Zm92a2xxenlwZG9zZ21raHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NjQ4OTQsImV4cCI6MjA5NTM0MDg5NH0.UiR71ztyRbdowBqIOEIHtGDbgzHTFJIMn2V_ia3a9Es";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type UserRole = "admin" | "ops" | "sales" | "visitor";

// URL publique de l'application, utilisée pour les redirections des emails
// d'authentification (invitation, lien magique, réinitialisation de mot de
// passe). On privilégie l'origine réelle (preview Lovable, domaine custom),
// sauf en local (localhost) ou en SSR où l'on retombe sur l'URL de production.
const PROD_APP_URL = "https://tarif-master-beev.lovable.app";
export function appUrl(path = ""): string {
  const origin =
    typeof window !== "undefined" &&
    window.location?.origin &&
    !/localhost|127\.0\.0\.1/.test(window.location.origin)
      ? window.location.origin
      : PROD_APP_URL;
  return `${origin}${path}`;
}
