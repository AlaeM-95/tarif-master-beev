// Logique « Mode Flotte » (v2) — fonctions pures, sans effet de bord.
//
// Sert à chiffrer rapidement une grosse flotte (50/80/100+ véhicules) à partir
// d'une car policy client : regroupement par modèle avec quantités, et
// auto-association de chaque véhicule thermique vers les EV « top du mois » de
// son segment (classement top_rank du catalogue).

import type { Vehicle } from "./catalog";

/** Normalise une catégorie pour le matching segment (minuscules, sans accents,
 *  quelques regroupements de synonymes courants). */
export function normCategory(c?: string): string {
  const base = (c ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "";
  if (/(suv|crossover|4x4|tout terrain|baroudeur|familiale haute)/.test(base)) return "suv";
  if (/(citadine|compacte|polyvalente|mini|urbaine|segment a|segment b|petite)/.test(base)) return "citadine";
  if (/(berline|sedan|tricorps|routiere|routière|segment d|familiale)/.test(base)) return "berline";
  if (/(break|sw|shooting|estate|touring|tourer)/.test(base)) return "break";
  if (/(utilitaire|fourgon|fourgonnette|vul|van|kangoo|cargo|pick ?up|benne)/.test(base)) return "utilitaire";
  if (/(monospace|ludospace|mpv|combispace)/.test(base)) return "monospace";
  return base;
}

/** Recommande des EV pour un véhicule actuel, avec une chaîne de repli robuste
 *  (les libellés de catégorie des car policies clients sont hétérogènes) :
 *  1) même segment (catégorie normalisée), du moins cher au plus cher ;
 *  2) sinon, même tranche de prix (loyer proche du véhicule actuel, ±40 %) ;
 *  3) sinon, les EV les moins chers du catalogue.
 *  Les modèles épinglés (top_rank) restent prioritaires dans chaque cas. */
export function recommendEvs(current: Vehicle, catalogue: Vehicle[], n = 3): Vehicle[] {
  const fromCat = topEvsForCategory(current.category, catalogue, n);
  // Si la catégorie a matché un vrai segment (pas le repli "tous EV"), on garde.
  const cat = normCategory(current.category);
  const catHasMatch = cat && catalogue.some((v) => v.energy === "Électrique" && v.monthlyLld > 0 && normCategory(v.category) === cat);
  if (catHasMatch) return fromCat;

  // Repli tranche de prix : on se cale sur le loyer (ou, à défaut, une estimation
  // depuis le prix catalogue ~ 2 % du prix TTC / mois) du véhicule actuel.
  const ref = current.monthlyLld > 0 ? current.monthlyLld : (current.priceTtc > 0 ? current.priceTtc * 0.02 : 0);
  if (ref > 0) {
    const rank = (v: Vehicle) => (v.topRank && v.topRank > 0 ? v.topRank : Infinity);
    const inBand = dedupeByModel(catalogue
      .filter((v) => v.energy === "Électrique" && v.monthlyLld > 0 && Math.abs(v.monthlyLld - ref) <= ref * 0.4)
      .sort((a, b) => rank(a) - rank(b) || Math.abs(a.monthlyLld - ref) - Math.abs(b.monthlyLld - ref)));
    if (inBand.length > 0) return inBand.slice(0, n);
  }
  return fromCat; // repli ultime : tous EV les moins chers
}

/** EV du catalogue recommandés pour une catégorie donnée. Tri : d'abord les
 *  modèles ÉPINGLÉS (top_rank renseigné, par rang croissant), puis les autres
 *  du MOINS CHER au plus cher (loyer mensuel). Autrement dit : par défaut on
 *  suggère les EV les moins chers du segment, et top_rank sert d'override pour
 *  forcer un modèle en tête. Repli sur l'ensemble des EV si la catégorie ne
 *  matche aucun modèle. */
export function topEvsForCategory(category: string, catalogue: Vehicle[], n = 3): Vehicle[] {
  const cat = normCategory(category);
  const isEv = (v: Vehicle) => v.energy === "Électrique" && v.monthlyLld > 0;
  const rank = (v: Vehicle) => (v.topRank && v.topRank > 0 ? v.topRank : Infinity);
  const cheapestFirst = (a: Vehicle, b: Vehicle) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;               // épinglés d'abord, par rang
    return a.monthlyLld - b.monthlyLld;          // sinon, le moins cher d'abord
  };
  const inCat = catalogue.filter((v) => isEv(v) && normCategory(v.category) === cat);
  const pool = inCat.length > 0 ? inCat : catalogue.filter(isEv);
  return dedupeByModel([...pool].sort(cheapestFirst)).slice(0, Math.max(1, n));
}

/** Ne garde que la variante la moins chère de chaque modèle distinct
 *  (marque + modèle) : évite de proposer 3 finitions du même véhicule. La
 *  liste doit déjà être triée du moins cher au plus cher. */
function dedupeByModel(sorted: Vehicle[]): Vehicle[] {
  const seen = new Set<string>();
  const out: Vehicle[] = [];
  for (const v of sorted) {
    const k = `${v.brand}|${v.model}`.toLowerCase().trim();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

/** Regroupe une liste de véhicules (1 entrée = 1 véhicule) par modèle identique
 *  (marque + modèle + énergie), en cumulant les quantités. Préserve une
 *  quantité déjà portée par le véhicule (champ optionnel injecté par le parseur
 *  si une colonne « nombre » existe). */
export function groupFleet(
  vehicles: Array<Vehicle & { quantity?: number }>,
): Array<{ vehicle: Vehicle; quantity: number }> {
  const map = new Map<string, { vehicle: Vehicle; quantity: number }>();
  for (const v of vehicles) {
    const key = `${v.brand}|${v.model}|${v.energy}`.toLowerCase().trim();
    const add = Math.max(1, Math.round(v.quantity ?? 1));
    const ex = map.get(key);
    if (ex) ex.quantity += add;
    else map.set(key, { vehicle: v, quantity: add });
  }
  return [...map.values()];
}

const norm = (s?: string) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Si le véhicule importé correspond à un modèle du catalogue (marque + modèle,
 *  + version si renseignée des deux côtés), on reprend les caractéristiques du
 *  catalogue (specs, image…) MAIS on conserve le loyer de l'Excel (et l'id
 *  importé + le flag flotte actuelle). Sinon on garde l'import tel quel. */
export function enrichFromCatalogue<T extends Vehicle & { kmPerYear?: number; durationMonths?: number }>(v: T, catalogue: Vehicle[]): T {
  const match = catalogue.find((c) =>
    norm(c.brand) === norm(v.brand) && norm(c.model) === norm(v.model) &&
    (!v.version || !c.version || norm(c.version) === norm(v.version)),
  );
  if (!match) return v;
  return {
    ...match,
    id: v.id,
    isCurrentFleet: true,
    custom: true,
    monthlyLld: v.monthlyLld > 0 ? v.monthlyLld : match.monthlyLld, // loyer de l'Excel prioritaire
    kmPerYear: v.kmPerYear,
    durationMonths: v.durationMonths,
  } as T;
}

/** Construit les lignes du constructeur de flotte : pour chaque modèle regroupé,
 *  la quantité, les km/durée extraits de l'Excel (si présents), et les EV
 *  recommandés de son segment. Le véhicule actuel est enrichi depuis le
 *  catalogue quand il y correspond. */
export type FleetLine = {
  current: Vehicle;
  quantity: number;
  recommendations: Vehicle[];
  kmPerYear?: number;
  durationMonths?: number;
};
export function buildFleetLines(
  imported: Array<Vehicle & { quantity?: number; kmPerYear?: number; durationMonths?: number }>,
  catalogue: Vehicle[],
  recoCount = 3,
): FleetLine[] {
  return groupFleet(imported).map(({ vehicle, quantity }) => {
    const imp = vehicle as Vehicle & { kmPerYear?: number; durationMonths?: number };
    const current = enrichFromCatalogue(imp, catalogue);
    return {
      current,
      quantity,
      recommendations: recommendEvs(current, catalogue, recoCount),
      kmPerYear: imp.kmPerYear,
      durationMonths: imp.durationMonths,
    };
  });
}
