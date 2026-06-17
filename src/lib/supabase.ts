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

// Client d'authentification ISOLÉ : permet à l'admin de créer un compte
// (signUp avec mot de passe) SANS remplacer sa propre session. persistSession
// false + storageKey dédié garantissent qu'aucune session n'est écrite ni lue
// dans le stockage de la session principale. Utilisé pour l'onboarding interne
// sans email : l'admin crée le compte et communique le mot de passe au sales.
export function createIsolatedAuthClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "beev-admin-signup",
    },
  });
}

export type UserRole = "admin" | "ops" | "sales" | "visitor";

// URL CANONIQUE de l'application, utilisée pour les redirections des emails
// d'authentification (invitation, lien magique, réinitialisation de mot de
// passe). On retourne TOUJOURS cette URL, jamais window.location.origin :
//  - une invitation envoyée depuis un domaine de preview Lovable produirait
//    sinon une redirect_url absente de l'allowlist Supabase, ce qui fait
//    retomber Supabase sur la « Site URL » (par défaut http://localhost:3000) ;
//  - résultat : le mail de confirmation affichait localhost:3000.
// En forçant une seule URL déterministe, il n'y a qu'UNE redirect URL à
// autoriser dans Supabase (Authentication → URL Configuration). Si un jour un
// domaine custom est mis en place, il suffit de changer PROD_APP_URL ici.
const PROD_APP_URL = "https://tarif-master-beev.lovable.app";
export function appUrl(path = ""): string {
  return `${PROD_APP_URL}${path}`;
}
