// Edge Function « hubspot-crm » — lecture des sociétés et contacts HubSpot
// pour pré-remplir la fiche client d'un devis.
//
// Pourquoi une Edge Function : le jeton HubSpot donne accès à tout le CRM Beev.
// Il ne doit JAMAIS être envoyé au navigateur. La fonction vérifie que l'appelant
// est connecté à l'outil (JWT Supabase), puis interroge HubSpot avec le jeton
// stocké en secret côté serveur. Lecture seule : rien n'est écrit dans HubSpot.
//
// Actions (POST JSON) :
//   { "action": "search",  "query": "big france" } -> sociétés + contacts correspondants
//   { "action": "company", "id": "123456" }         -> société + ses contacts associés
//
// Mise en place (une fois) :
//   1. HubSpot -> Paramètres -> Intégrations -> Applications privées -> Créer :
//      portées crm.objects.companies.read et crm.objects.contacts.read.
//   2. Supabase Dashboard -> Edge Functions -> Secrets : HUBSPOT_PRIVATE_APP_TOKEN
//      = le jeton de l'application privée.
//   3. Supabase Dashboard -> Edge Functions -> New function « hubspot-crm » ->
//      coller ce code -> Deploy.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_PRIVATE_APP_TOKEN") ?? "";
const HS = "https://api.hubapi.com";

const COMPANY_PROPS = [
  "name", "domain", "address", "zip", "city", "siren", "siret_number",
  "numberofemployees", "effectif_societe", "phone", "hubspot_owner_id",
];
const CONTACT_PROPS = ["firstname", "lastname", "email", "phone", "mobilephone", "jobtitle", "associatedcompanyid", "company"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function hs(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${HS}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new Error("Jeton HubSpot invalide ou expiré");
    if (res.status === 403) throw new Error("Jeton HubSpot sans les droits de lecture sociétés / contacts");
    throw new Error(`HubSpot ${res.status} : ${text.slice(0, 200)}`);
  }
  return res.json();
}

type Company = {
  id: string; name: string; domain: string; address: string; postalCode: string; city: string;
  siren: string; siret: string; effectif: string; phone: string;
};
type Contact = {
  id: string; firstName: string; lastName: string; email: string; phone: string; jobTitle: string;
  companyId: string; companyName: string;
};

const s = (v: unknown) => (v == null ? "" : String(v).trim());

function toCompany(r: any): Company {
  const p = r.properties ?? {};
  const siret = s(p.siret_number).replace(/\s/g, "");
  return {
    id: s(r.id),
    name: s(p.name),
    domain: s(p.domain),
    address: s(p.address),
    postalCode: s(p.zip),
    city: s(p.city),
    siren: s(p.siren).replace(/\s/g, "") || (siret.length === 14 ? siret.slice(0, 9) : ""),
    siret,
    effectif: s(p.effectif_societe) || (s(p.numberofemployees) ? `${s(p.numberofemployees)} salariés` : ""),
    phone: s(p.phone),
  };
}

function toContact(r: any): Contact {
  const p = r.properties ?? {};
  return {
    id: s(r.id),
    firstName: s(p.firstname),
    lastName: s(p.lastname),
    email: s(p.email),
    phone: s(p.phone) || s(p.mobilephone),
    jobTitle: s(p.jobtitle),
    companyId: s(p.associatedcompanyid),
    companyName: s(p.company),
  };
}

async function search(query: string) {
  const [companies, contacts] = await Promise.all([
    hs("/crm/v3/objects/companies/search", {
      method: "POST",
      body: JSON.stringify({ query, limit: 8, properties: COMPANY_PROPS }),
    }),
    hs("/crm/v3/objects/contacts/search", {
      method: "POST",
      body: JSON.stringify({ query, limit: 6, properties: CONTACT_PROPS }),
    }),
  ]);
  return {
    companies: (companies.results ?? []).map(toCompany),
    contacts: (contacts.results ?? []).map(toContact),
  };
}

async function company(id: string) {
  const c = await hs(`/crm/v3/objects/companies/${encodeURIComponent(id)}?properties=${COMPANY_PROPS.join(",")}`);
  const assoc = await hs(`/crm/v4/objects/companies/${encodeURIComponent(id)}/associations/contacts?limit=50`);
  const ids: string[] = (assoc.results ?? []).map((a: any) => String(a.toObjectId)).slice(0, 50);
  let contacts: Contact[] = [];
  if (ids.length > 0) {
    const batch = await hs("/crm/v3/objects/contacts/batch/read", {
      method: "POST",
      body: JSON.stringify({ properties: CONTACT_PROPS, inputs: ids.map((x) => ({ id: x })) }),
    });
    contacts = (batch.results ?? []).map(toContact);
  }
  return { company: toCompany(c), contacts };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Non authentifié" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Session invalide" }, 401);

    if (!HUBSPOT_TOKEN) return json({ error: "HubSpot n'est pas encore connecté (secret HUBSPOT_PRIVATE_APP_TOKEN manquant)" }, 503);

    const body = await req.json().catch(() => ({}));
    if (body.action === "search") {
      const query = s(body.query).slice(0, 100);
      if (query.length < 2) return json({ companies: [], contacts: [] });
      return json(await search(query));
    }
    if (body.action === "company") {
      const id = s(body.id);
      if (!/^\d+$/.test(id)) return json({ error: "Identifiant de société invalide" }, 400);
      return json(await company(id));
    }
    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur HubSpot" }, 500);
  }
});
