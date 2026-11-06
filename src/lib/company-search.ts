// Recherche d'entreprise via l'API publique « Recherche d'entreprises »
// (data.gouv.fr / annuaire-entreprises). Gratuite, sans clé, CORS ouvert : elle
// s'appelle directement depuis le navigateur. Limite : 7 requêtes / seconde
// (la saisie est temporisée côté composant).
//
// On ne retient QUE des données d'entreprise (raison sociale, SIREN, adresse du
// siège, tranche d'effectif, catégorie). Les dirigeants renvoyés par l'API sont
// des personnes physiques : ils ne sont volontairement jamais lus.
// Doc : https://recherche-entreprises.api.gouv.fr/docs/

export type CompanyHit = {
  siren: string;
  /** Raison sociale mise en forme (« BIG FRANCE » -> « BIG France »). */
  name: string;
  /** Raison sociale telle que renvoyée par l'API. */
  legalName: string;
  address: string;
  postalCode: string;
  city: string;
  /** Tranche d'effectif lisible (« 20 à 49 salariés »), vide si non diffusée. */
  effectif: string;
  /** PME, ETI ou GE, vide si inconnue. */
  category: string;
};

const API = "https://recherche-entreprises.api.gouv.fr/search";

// Codes INSEE de tranche d'effectif salarié.
const EFFECTIFS: Record<string, string> = {
  "00": "0 salarié",
  "01": "1 à 2 salariés",
  "02": "3 à 5 salariés",
  "03": "6 à 9 salariés",
  "11": "10 à 19 salariés",
  "12": "20 à 49 salariés",
  "21": "50 à 99 salariés",
  "22": "100 à 199 salariés",
  "31": "200 à 249 salariés",
  "32": "250 à 499 salariés",
  "41": "500 à 999 salariés",
  "42": "1 000 à 1 999 salariés",
  "51": "2 000 à 4 999 salariés",
  "52": "5 000 à 9 999 salariés",
  "53": "10 000 salariés et plus",
};

const LEGAL_FORMS = new Set(["SA", "SAS", "SASU", "SARL", "EURL", "SCI", "SNC", "SCOP", "GIE"]);
// Particules laissées en minuscules hors début de nom (Saint-Laurent-du-Var).
const PARTICLES = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "sur", "sous", "au", "aux", "d", "l"]);

/** « BIG FRANCE » -> « BIG France », « AXIENCE » -> « Axience » : les sigles
 *  courts, formes juridiques et mots à chiffres restent en majuscules. Ne touche
 *  pas un nom déjà en casse mixte. */
export function prettyCompanyName(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s || s !== s.toUpperCase()) return s;
  return s.replace(/[A-Za-zÀ-ÿ0-9]+/g, (w, offset: number) => {
    if (offset > 0 && PARTICLES.has(w.toLowerCase())) return w.toLowerCase();
    if (w.length <= 3 || LEGAL_FORMS.has(w) || /\d/.test(w) || !/[AEIOUYÀ-ÿ]/.test(w)) return w;
    return w.charAt(0) + w.slice(1).toLowerCase();
  });
}

/** 851682807 -> « 851 682 807 ». */
export function formatSiren(siren: string): string {
  const d = (siren ?? "").replace(/\D/g, "");
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : siren;
}

const capitalizeCity = (c: string) =>
  (c ?? "")
    .toLowerCase()
    .replace(/[a-zà-ÿ]+/g, (w, offset: number) => (offset > 0 && PARTICLES.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));

type ApiResult = {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  categorie_entreprise?: string | null;
  tranche_effectif_salarie?: string | null;
  siege?: { adresse?: string; code_postal?: string; libelle_commune?: string } | null;
};

/** Cherche des entreprises actives par nom, sigle, SIREN ou SIRET (3 caractères
 *  minimum). Renvoie au plus 6 résultats. */
export async function searchCompanies(query: string, signal?: AbortSignal): Promise<CompanyHit[]> {
  const q = query.trim();
  if (q.replace(/\s/g, "").length < 3) return [];
  // Un SIREN / SIRET saisi avec des espaces (« 851 682 807 ») est compacté.
  const compact = q.replace(/\s/g, "");
  const term = /^\d{9}$|^\d{14}$/.test(compact) ? compact : q;
  const url = `${API}?q=${encodeURIComponent(term)}&per_page=6&etat_administratif=A`;
  const res = await fetch(url, { signal });
  if (res.status === 429) throw new Error("Trop de recherches d'affilée, réessayez dans un instant");
  if (!res.ok) throw new Error("Recherche d'entreprise indisponible");
  const data = (await res.json()) as { results?: ApiResult[] };
  return (data.results ?? [])
    .filter((r) => r.siren)
    .map((r) => {
      const legalName = (r.nom_complet || r.nom_raison_sociale || "").trim();
      return {
        siren: String(r.siren),
        name: prettyCompanyName(legalName),
        legalName,
        address: (r.siege?.adresse ?? "").trim(),
        postalCode: (r.siege?.code_postal ?? "").trim(),
        city: capitalizeCity(r.siege?.libelle_commune ?? ""),
        effectif: EFFECTIFS[r.tranche_effectif_salarie ?? ""] ?? "",
        category: r.categorie_entreprise ?? "",
      };
    });
}
