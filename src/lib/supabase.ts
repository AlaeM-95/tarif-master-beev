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
