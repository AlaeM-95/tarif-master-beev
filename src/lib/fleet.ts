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

/** Part du prix catalogue TTC retenue comme loyer mensuel quand aucun loyer n'est
 *  renseigné (même convention que pour un véhicule actuel sans loyer). Sert
 *  uniquement à classer et chiffrer un aperçu : jamais écrite dans le devis. */
export const LOYER_ESTIMATE_RATE = 0.02;

/** Loyer mensuel de référence : loyer renseigné, sinon estimation depuis le prix
 *  catalogue, sinon 0 (véhicule non chiffrable). */
export function effectiveLoyer(v: Vehicle): number {
  if (v.monthlyLld > 0) return v.monthlyLld;
  return v.priceTtc > 0 ? Math.round(v.priceTtc * LOYER_ESTIMATE_RATE) : 0;
}
/** Vrai si le loyer est une estimation (aucun loyer renseigné au catalogue). */
export const isLoyerEstimated = (v: Vehicle): boolean => !(v.monthlyLld > 0) && v.priceTtc > 0;

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
  const catHasMatch = cat && catalogue.some((v) => v.energy === "Électrique" && normCategory(v.category) === cat);
  if (catHasMatch) return fromCat;

  // Repli tranche de prix : on se cale sur le loyer (ou, à défaut, une estimation
  // depuis le prix catalogue ~ 2 % du prix TTC / mois) du véhicule actuel.
  const ref = current.monthlyLld > 0 ? current.monthlyLld : (current.priceTtc > 0 ? current.priceTtc * 0.02 : 0);
  if (ref > 0) {
    const rank = (v: Vehicle) => (v.topRank && v.topRank > 0 ? v.topRank : Infinity);
    const inBand = dedupeByModel(catalogue
      .filter((v) => v.energy === "Électrique" && effectiveLoyer(v) > 0 && Math.abs(effectiveLoyer(v) - ref) <= ref * 0.4)
      .sort((a, b) => rank(a) - rank(b) || Math.abs(effectiveLoyer(a) - ref) - Math.abs(effectiveLoyer(b) - ref)));
    if (inBand.length > 0) return inBand.slice(0, n);
  }
  return fromCat; // repli ultime : tous EV les moins chers
}

/** Autonomie WLTP connue (0 = inconnue, classée en dernier). */
const rangeOf = (v: Vehicle) => (v.rangeWltp > 0 ? v.rangeWltp : 0);

/** EV du catalogue recommandés pour une catégorie donnée. Tri : d'abord les
 *  modèles ÉPINGLÉS (top_rank renseigné, par rang croissant : override éditorial
 *  de l'équipe), puis les autres par AUTONOMIE WLTP décroissante — le véhicule
 *  à la meilleure autonomie du segment passe en première ligne. À autonomie
 *  égale, le loyer le plus bas ; le loyer n'est pas requis (un EV sans loyer
 *  reste proposable). Repli sur l'ensemble des EV si la catégorie ne matche
 *  aucun modèle. */
export function topEvsForCategory(category: string, catalogue: Vehicle[], n = 3): Vehicle[] {
  const cat = normCategory(category);
  const isEv = (v: Vehicle) => v.energy === "Électrique";
  const rank = (v: Vehicle) => (v.topRank && v.topRank > 0 ? v.topRank : Infinity);
  const loyerAsc = (v: Vehicle) => effectiveLoyer(v) || Infinity; // 0 = inconnu, en dernier
  const bestRangeFirst = (a: Vehicle, b: Vehicle) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;                         // épinglés d'abord, par rang
    if (rangeOf(a) !== rangeOf(b)) return rangeOf(b) - rangeOf(a); // meilleure autonomie d'abord
    return loyerAsc(a) - loyerAsc(b);                      // puis le moins cher
  };
  const inCat = catalogue.filter((v) => isEv(v) && normCategory(v.category) === cat);
  const pool = inCat.length > 0 ? inCat : catalogue.filter(isEv);
  return dedupeByModel([...pool].sort(bestRangeFirst)).slice(0, Math.max(1, n));
}

/** Ne garde que la première variante de chaque modèle distinct (marque +
 *  modèle) : évite de proposer 3 finitions du même véhicule. La liste doit déjà
 *  être triée par ordre de préférence (la meilleure variante en tête). */
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

/** Clé de marque tolérante aux appellations courantes (Volkswagen = VW…), pour
 *  rapprocher une marque lue dans un Excel de celle du catalogue. */
const BRAND_ALIASES: Record<string, string> = {
  volkswagen: "vw",
  "mercedes benz": "mercedes",
  "mercedes-benz": "mercedes",
  citroen: "citroen",
  "ds automobiles": "ds",
  "alfa romeo": "alfaromeo",
  "land rover": "landrover",
  "range rover": "landrover",
};
function brandKey(b?: string): string {
  const n = norm(b).replace(/[^a-z0-9 -]/g, "");
  return BRAND_ALIASES[n] ?? n.replace(/[ -]/g, "");
}

/** Si le véhicule importé correspond à un modèle du catalogue (marque + modèle,
 *  + version si renseignée des deux côtés), on reprend les caractéristiques du
 *  catalogue (specs, image…) MAIS on conserve le loyer de l'Excel (et l'id
 *  importé + le flag flotte actuelle). Sinon on garde l'import tel quel. */
export function enrichFromCatalogue<T extends Vehicle & { kmPerYear?: number; durationMonths?: number }>(v: T, catalogue: Vehicle[]): T {
  const match = catalogue.find((c) =>
    brandKey(c.brand) === brandKey(v.brand) && norm(c.model) === norm(v.model) &&
    (!v.version || !c.version || norm(c.version) === norm(v.version)),
  );
  if (!match) return v;
  return {
    ...match,
    id: v.id,
    isCurrentFleet: true,
    custom: true,
    aiMeta: v.aiMeta,
    monthlyLld: v.monthlyLld > 0 ? v.monthlyLld : match.monthlyLld, // loyer de l'Excel prioritaire
    kmPerYear: v.kmPerYear,
    durationMonths: v.durationMonths,
  } as T;
}

/** Courtes justifications d'une suggestion (puces affichables) : segment,
 *  épinglage Beev, écart de loyer vs le véhicule actuel, stock, autonomie. */
export function explainReco(current: Vehicle, ev: Vehicle, catalogue?: Vehicle[]): string[] {
  const out: string[] = [];
  const cat = normCategory(current.category);
  const sameSegment = !!cat && normCategory(ev.category) === cat;
  // Meilleure autonomie WLTP parmi les EV du même segment du catalogue ?
  const bestRange = catalogue && sameSegment && rangeOf(ev) > 0
    ? rangeOf(ev) >= Math.max(...catalogue.filter((v) => v.energy === "Électrique" && normCategory(v.category) === cat).map(rangeOf))
    : false;
  if (bestRange) out.push("Meilleure autonomie du segment");
  const ref = current.monthlyLld > 0 ? current.monthlyLld : 0;
  if (sameSegment) out.push(`Même segment (${ev.category})`);
  else if (ref > 0 && Math.abs(effectiveLoyer(ev) - ref) <= ref * 0.4) out.push("Tranche de loyer proche");
  else out.push("Alternative électrique accessible");
  if (ev.topRank && ev.topRank > 0) out.push("Sélection Beev");
  if (ref > 0 && ev.monthlyLld > 0) {
    const d = Math.round(((ev.monthlyLld - ref) / ref) * 100);
    if (d !== 0) out.push(`Loyer ${d > 0 ? "+" : "−"}${Math.abs(d)} % vs actuel`);
  }
  if (ev.availableStock) out.push("En stock");
  if (ev.rangeWltp > 0) out.push(`${Math.round(ev.rangeWltp)} km WLTP`);
  return out;
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
