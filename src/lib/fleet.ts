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
  if (/(suv|crossover|4x4|tout terrain)/.test(base)) return "suv";
  if (/(citadine|compacte|polyvalente|mini|urbaine)/.test(base)) return "citadine";
  if (/(berline|sedan|tricorps)/.test(base)) return "berline";
  if (/(break|sw|shooting|estate|touring|tourer)/.test(base)) return "break";
  if (/(utilitaire|fourgon|vul|van|kangoo|cargo)/.test(base)) return "utilitaire";
  if (/(monospace|ludospace|mpv)/.test(base)) return "monospace";
  return base;
}

/** EV du catalogue recommandés pour une catégorie donnée, classés par
 *  top_rank croissant (1 = n°1), puis éco-score décroissant, puis loyer
 *  croissant. Repli sur l'ensemble des EV classés si la catégorie ne matche
 *  aucun modèle. */
export function topEvsForCategory(category: string, catalogue: Vehicle[], n = 3): Vehicle[] {
  const cat = normCategory(category);
  const isEv = (v: Vehicle) => v.energy === "Électrique";
  const rank = (v: Vehicle) => (v.topRank && v.topRank > 0 ? v.topRank : 999);
  const byRank = (a: Vehicle, b: Vehicle) =>
    rank(a) - rank(b) || (b.envScore ?? 0) - (a.envScore ?? 0) || a.monthlyLld - b.monthlyLld;

  const inCat = catalogue.filter((v) => isEv(v) && normCategory(v.category) === cat);
  const pool = inCat.length > 0 ? inCat : catalogue.filter(isEv);
  return [...pool].sort(byRank).slice(0, Math.max(1, n));
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

/** Construit les lignes du constructeur de flotte : pour chaque modèle regroupé,
 *  la quantité et les EV recommandés (top du mois) de son segment. */
export type FleetLine = {
  current: Vehicle;
  quantity: number;
  recommendations: Vehicle[];
};
export function buildFleetLines(
  imported: Array<Vehicle & { quantity?: number }>,
  catalogue: Vehicle[],
  recoCount = 3,
): FleetLine[] {
  return groupFleet(imported).map(({ vehicle, quantity }) => ({
    current: vehicle,
    quantity,
    recommendations: topEvsForCategory(vehicle.category, catalogue, recoCount),
  }));
}
