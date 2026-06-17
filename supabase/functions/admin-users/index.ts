// Edge Function « admin-users » — gestion des comptes par l'administrateur,
// SANS email de confirmation et avec suppression de compte.
//
// Pourquoi une Edge Function : créer un compte avec l'email déjà confirmé
// (aucun email envoyé) et supprimer un compte auth nécessitent la clé
// service_role, qui ne doit JAMAIS être exposée côté navigateur. Cette fonction
// s'exécute côté serveur, vérifie que l'appelant est admin via son JWT, puis
// effectue l'opération privilégiée avec le service_role.
//
// Actions (POST JSON) :
//   { "action": "create", "email": "...", "password": "..." }  -> crée le compte (email_confirm: true)
//   { "action": "delete", "id": "<uuid>" }                       -> supprime le compte auth
//
// Déploiement : Supabase Dashboard -> Edge Functions -> New function
//   « admin-users » -> coller ce code -> Deploy. Les variables SUPABASE_URL,
//   SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont injectées automatiquement.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Non authentifié" }, 401);

    // 1) Identifie l'appelant via son JWT (clé anon + header Authorization).
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Session invalide" }, 401);

    // 2) Client privilégié (service_role) — vérifie que l'appelant est admin.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return json({ error: "Réservé aux administrateurs" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!email || !email.includes("@")) return json({ error: "Email invalide" }, 400);
      if (password.length < 6) return json({ error: "Mot de passe trop court (min 6 caractères)" }, 400);
      // email_confirm: true => compte actif immédiatement, AUCUN email envoyé.
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ id: data.user?.id ?? null });
    }

    if (action === "delete") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "Identifiant manquant" }, 400);
      if (id === user.id) return json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: error.message }, 400);
      // Filet de sécurité si la ligne profiles n'est pas supprimée en cascade.
      await admin.from("profiles").delete().eq("id", id);
      return json({ ok: true });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur serveur" }, 500);
  }
});
