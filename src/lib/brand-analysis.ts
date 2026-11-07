// Analyse des marques : positionnement (gamme) et groupe industriel.
//
// Sert aux recommandations d'électriques : un client dont le parc est Peugeot ne
// commandera pas un BMW iX3 ou un Mercedes GLA, même s'ils ont la meilleure autonomie
// du segment. Règles :
//   - GAMME : une marque est classée de 1 (économique) à 4 (premium). Un électrique n'est
//     proposé que si sa marque est à un niveau d'écart au plus de celle du véhicule actuel
//     (Peugeot, niveau 2, voit les niveaux 1 à 3 : Dacia, Skoda, Tesla ; pas Mercedes).
//   - AFFINITÉ : à gamme acceptable, la même marque passe d'abord (le client garde son
//     réseau et ses habitudes), puis le même groupe (Peugeot > Citroën, DS, Opel, Fiat…).
//
// Le classement est un jugement commercial, pas une donnée officielle : il se corrige ici.

import { brandKey } from "./vehicle-reference";

export type BrandTier = 1 | 2 | 3 | 4;

export const TIER_LABEL: Record<BrandTier, string> = {
  1: "économique",
  2: "généraliste",
  3: "premium accessible",
  4: "premium",
};

// Clés de marque (cf. brandKey : minuscules, sans accents ni espaces, volkswagen pour VW).
const TIERS: Record<string, BrandTier> = {
  // 1 — économique
  dacia: 1, mg: 1, leapmotor: 1,
  // 2 — généraliste
  peugeot: 2, renault: 2, citroen: 2, opel: 2, fiat: 2, ford: 2, toyota: 2, hyundai: 2, kia: 2,
  nissan: 2, mazda: 2, honda: 2, mitsubishi: 2, suzuki: 2, seat: 2, skoda: 2, volkswagen: 2,
  jeep: 2, cupra: 2, byd: 2, xpeng: 2, smart: 2, lancia: 2, subaru: 2, ssangyong: 2, isuzu: 2,
  // 3 — premium accessible
  tesla: 3, volvo: 3, polestar: 3, ds: 3, mini: 3, alfaromeo: 3, lynkco: 3, zeekr: 3, nio: 3, alpine: 3,
  // 4 — premium
  mercedes: 4, bmw: 4, audi: 4, lexus: 4, porsche: 4, landrover: 4, jaguar: 4, genesis: 4,
  maserati: 4, lotus: 4, bentley: 4, rollsroyc: 4, ferrari: 4, lamborghin: 4,
};

const GROUPS: Record<string, string> = {
  peugeot: "Stellantis", citroen: "Stellantis", ds: "Stellantis", opel: "Stellantis", fiat: "Stellantis",
  jeep: "Stellantis", alfaromeo: "Stellantis", lancia: "Stellantis",
  renault: "Renault", dacia: "Renault", alpine: "Renault",
  volkswagen: "Volkswagen", skoda: "Volkswagen", seat: "Volkswagen", cupra: "Volkswagen", audi: "Volkswagen", porsche: "Volkswagen",
  hyundai: "Hyundai", kia: "Hyundai", genesis: "Hyundai",
  toyota: "Toyota", lexus: "Toyota",
  volvo: "Geely", polestar: "Geely", lynkco: "Geely", zeekr: "Geely",
  bmw: "BMW", mini: "BMW",
  mercedes: "Mercedes", smart: "Mercedes",
  nissan: "Nissan", mitsubishi: "Nissan",
};

export type BrandProfile = { key: string; tier: BrandTier; group: string };

/** Gamme et groupe d'une marque. Marque inconnue : généraliste, groupe = elle-même. */
export function brandProfile(brand: string): BrandProfile {
  const key = brandKey(brand);
  return { key, tier: TIERS[key] ?? 2, group: GROUPS[key] ?? key };
}

/** Écart de gamme entre un électrique candidat et la marque du véhicule actuel
 *  (positif : candidat plus haut de gamme). */
export const tierGap = (clientBrand: string, candidateBrand: string): number =>
  brandProfile(candidateBrand).tier - brandProfile(clientBrand).tier;

/** Vrai si la marque du candidat est dans la gamme du client (un niveau d'écart au plus). */
export const isBrandInRange = (clientBrand: string, candidateBrand: string): boolean =>
  Math.abs(tierGap(clientBrand, candidateBrand)) <= 1;

/** 0 = même marque, 1 = même groupe, 2 = autre. Plus petit = plus proche. */
export function brandAffinity(clientBrand: string, candidateBrand: string): 0 | 1 | 2 {
  const a = brandProfile(clientBrand);
  const b = brandProfile(candidateBrand);
  if (a.key === b.key) return 0;
  return a.group === b.group ? 1 : 2;
}

/** Justification courte (puces) de la proximité de marque entre le client et le candidat. */
export function brandReasons(clientBrand: string, candidateBrand: string): string[] {
  const a = brandProfile(clientBrand);
  const b = brandProfile(candidateBrand);
  if (a.key === b.key) return [`Même marque (${displayBrand(candidateBrand)})`];
  const out: string[] = [];
  if (a.group === b.group) out.push(`Même groupe (${a.group})`);
  const gap = b.tier - a.tier;
  out.push(gap === 0 ? `Gamme comparable (${TIER_LABEL[b.tier]})` : gap > 0 ? `Gamme au-dessus (${TIER_LABEL[b.tier]})` : `Gamme en dessous (${TIER_LABEL[b.tier]})`);
  return out;
}

const ACRONYMS = new Set(["BMW", "MG", "DS", "VW", "BYD", "GWM", "MINI"]);
/** « PEUGEOT » -> « Peugeot », « BMW » reste « BMW ». */
export function displayBrand(brand: string): string {
  return (brand ?? "").trim().split(/\s+/).filter(Boolean).map((w) =>
    w.split("-").map((p) => (ACRONYMS.has(p.toUpperCase()) ? (p.toUpperCase() === "MINI" ? "Mini" : p.toUpperCase()) : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join("-"),
  ).join(" ");
}

export type FleetBrandSummary = {
  total: number;
  byTier: Array<{ tier: BrandTier; label: string; pct: number }>;
  byBrand: Array<{ brand: string; pct: number }>;
  groups: string[];
};

/** Profil de marques d'un parc (pondéré par la quantité) : répartition par gamme, par
 *  marque et groupes présents. */
export function summarizeFleetBrands(items: Array<{ brand: string; quantity: number }>): FleetBrandSummary {
  const total = items.reduce((s, i) => s + Math.max(1, i.quantity || 1), 0) || 1;
  const tiers = new Map<BrandTier, number>();
  const brands = new Map<string, number>();
  const groups = new Set<string>();
  for (const it of items) {
    const q = Math.max(1, it.quantity || 1);
    const p = brandProfile(it.brand);
    tiers.set(p.tier, (tiers.get(p.tier) ?? 0) + q);
    const name = displayBrand(it.brand);
    brands.set(name, (brands.get(name) ?? 0) + q);
    groups.add(p.group);
  }
  return {
    total,
    byTier: [...tiers.entries()].sort((a, b) => b[1] - a[1]).map(([tier, n]) => ({ tier, label: TIER_LABEL[tier], pct: Math.round((n / total) * 100) })),
    byBrand: [...brands.entries()].sort((a, b) => b[1] - a[1]).map(([brand, n]) => ({ brand, pct: Math.round((n / total) * 100) })),
    groups: [...groups],
  };
}
