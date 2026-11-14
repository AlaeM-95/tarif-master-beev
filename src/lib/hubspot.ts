// Lecture des sociétés et contacts HubSpot via l'Edge Function « hubspot-crm ».
// Le jeton HubSpot reste côté serveur ; le navigateur n'envoie que la session
// Supabase de l'utilisateur connecté. Lecture seule.

import { supabase } from "./supabase";

export type HubspotCompany = {
  id: string;
  name: string;
  domain: string;
  address: string;
  postalCode: string;
  city: string;
  siren: string;
  siret: string;
  effectif: string;
  phone: string;
};

export type HubspotContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("hubspot-crm", { body });
  if ((data as any)?.error) throw new Error((data as any).error);
  if (error) {
    // Réponse non 2xx : le message utile est dans le corps JSON de la fonction.
    const ctx = (error as any).context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
      if (ctx.status === 404) throw new Error("Connexion HubSpot pas encore installée (Edge Function hubspot-crm)");
    }
    // Fonction pas encore déployée : message clair plutôt qu'une erreur réseau brute.
    const msg = /not found|404|Failed to send/i.test(error.message)
      ? "Connexion HubSpot pas encore installée (Edge Function hubspot-crm)"
      : error.message;
    throw new Error(msg);
  }
  return data as T;
}

export function searchHubspot(query: string): Promise<{ companies: HubspotCompany[]; contacts: HubspotContact[] }> {
  return call({ action: "search", query });
}

export function getHubspotCompany(id: string): Promise<{ company: HubspotCompany; contacts: HubspotContact[] }> {
  return call({ action: "company", id });
}

export const contactName = (c: HubspotContact) => [c.firstName, c.lastName].filter(Boolean).join(" ");

/** Champs de la fiche client du devis renseignés depuis une société HubSpot. */
export function clientPatchFromCompany(c: HubspotCompany) {
  return {
    company: c.name,
    siren: c.siren,
    companyAddress: c.address,
    companyCity: [c.postalCode, c.city].filter(Boolean).join(" "),
    companyEffectif: c.effectif,
    hubspotCompanyId: c.id,
  };
}

/** Champs de la fiche client renseignés depuis un contact HubSpot. */
export function clientPatchFromContact(c: HubspotContact) {
  return {
    contact: contactName(c),
    email: c.email,
    contactPhone: c.phone,
    contactJobTitle: c.jobTitle,
    hubspotContactId: c.id,
  };
}
