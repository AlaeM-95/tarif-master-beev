// ============================================================================
// Calculateur TCO complet — porté de beev-tco-2026 (src/data/fiscalCalculations.ts)
// Inclut : TVS (taxe CO₂ + pollution), malus CO₂ (barème 2026 jusqu'à 80k€),
// malus poids, AND (Avantage Non Déductible), AEN (Avantage en Nature) avec
// part salariale et employeur.
// ============================================================================

import type { Vehicle } from "./catalog";

// ---- Paramètres de contrat exposés à l'utilisateur ----
export type TcoContractParams = {
  dureeAnnees: number;
  kmContrat: number; // km totaux sur la durée du contrat
  prixEssenceLitre: number;
  prixKwhDomicile: number;
  prixKwhPublic: number;
};

// ---- Résultat enrichi du calcul TCO ----
export type TcoFullResult = {
  loyerTotal: number;
  coutEnergie: number;
  taxeCO2: number;
  taxePollution: number;
  tvsTotal: number;
  malusCO2: number;
  malusPoids: number;
  andAnnuel: number;
  aenBrut: number;
  aenAbattement: number;
  aenAnnuel: number;
  aenMensuel: number;
  partSalarialeAnnuelle: number;
  partEmployeurAnnuelle: number;
  partSalarialeMensuelle: number;
  partEmployeurMensuelle: number;
  tcoMensuel: number;
  tcoAnnuel: number;
  tcoParKm: number;
  tcoTotal: number;
  emissionsContrat: number;
};

const DEFAULT_COUT_ESSENCE_LITRE = 1.75;
const DEFAULT_COUT_KWH_DOMICILE = 0.4;
const DEFAULT_COUT_KWH_PUBLIC = 0.6;

// Plafond AND (Avantage Non Déductible) — dépend du CO₂
function getPlafondAND(co2: number): number {
  if (co2 < 20) return 30000;
  if (co2 < 50) return 20300;
  if (co2 < 160) return 18300;
  return 9900;
}

// Barème 2026 de la taxe annuelle sur les émissions de CO₂ (ex-TVS)
function calculateTaxeCO2(co2: number): number {
  if (co2 <= 4) return 0;
  let tax = 0;
  const brackets = [
    { min: 5, max: 45, rate: 1 },
    { min: 46, max: 53, rate: 2 },
    { min: 54, max: 85, rate: 3 },
    { min: 86, max: 105, rate: 4 },
    { min: 106, max: 125, rate: 10 },
    { min: 126, max: 145, rate: 50 },
    { min: 146, max: 165, rate: 60 },
    { min: 166, max: 9999, rate: 65 },
  ];
  for (const b of brackets) {
    if (co2 >= b.min) {
      const upper = Math.min(co2, b.max);
      tax += (upper - b.min + 1) * b.rate;
    }
  }
  return tax;
}

// Taxe sur les polluants atmosphériques 2026
function calculateTaxePollution(energy: Vehicle["energy"]): number {
  if (energy === "Électrique") return 0;
  if (energy === "Diesel") return 650;
  return 130;
}

// Malus CO₂ 2026 — barème officiel, 0€ jusqu'à 107g, plafonné à 80 000€ au-delà de 192g
export function calculateMalusCO2(co2: number): number {
  const bareme: [number, number][] = [
    [108, 50], [109, 75], [110, 100], [111, 125], [112, 150],
    [113, 170], [114, 190], [115, 210], [116, 230], [117, 240],
    [118, 260], [119, 280], [120, 310], [121, 330], [122, 360],
    [123, 400], [124, 450], [125, 540], [126, 650], [127, 740],
    [128, 818], [129, 898], [130, 983], [131, 1074], [132, 1172],
    [133, 1276], [134, 1386], [135, 1504], [136, 1629], [137, 1761],
    [138, 1901], [139, 2049], [140, 2205], [141, 2370], [142, 2544],
    [143, 2726], [144, 2918], [145, 3119], [146, 3331], [147, 3552],
    [148, 3784], [149, 4026], [150, 4279], [151, 4543], [152, 4818],
    [153, 5105], [154, 5404], [155, 5715], [156, 6126], [157, 6637],
    [158, 7248], [159, 7959], [160, 8770], [161, 9681], [162, 10692],
    [163, 11803], [164, 13014], [165, 14325], [166, 15736], [167, 17247],
    [168, 18858], [169, 20569], [170, 22380], [171, 24291], [172, 26302],
    [173, 28413], [174, 30624], [175, 32935], [176, 35346], [177, 37857],
    [178, 40468], [179, 43179], [180, 45990], [181, 48901], [182, 51912],
    [183, 55023], [184, 58134], [185, 61245], [186, 64356], [187, 67467],
    [188, 70578], [189, 73689], [190, 76800], [191, 79911], [192, 80000],
  ];
  if (co2 < 108) return 0;
  if (co2 > 192) return 80000;
  const entry = bareme.find(([g]) => g === Math.round(co2));
  return entry ? entry[1] : 80000;
}

// Malus poids 2026 — abattement pour véhicules électrifiés
export function calculateMalusPoids(poids: number, energy: Vehicle["energy"]): number {
  if (energy === "Électrique") return 0;
  let abattement = 0;
  if (energy === "Hybride Rechargeable") abattement = 200;
  else if (energy === "Hybride" || energy === "Mild Hybrid") abattement = 100;
  const masseTaxable = Math.max(poids - abattement, 0);
  if (masseTaxable <= 1499) return 0;
  let malus = 0;
  const brackets = [
    { min: 1500, max: 1699, rate: 10 },
    { min: 1700, max: 1799, rate: 15 },
    { min: 1800, max: 1899, rate: 20 },
    { min: 1900, max: 1999, rate: 25 },
    { min: 2000, max: 99999, rate: 30 },
  ];
  for (const b of brackets) {
    if (masseTaxable >= b.min) {
      const upper = Math.min(masseTaxable, b.max);
      malus += (upper - b.min + 1) * b.rate;
    }
  }
  return malus;
}

// Coût énergie sur la durée du contrat
function calculateCoutEnergie(
  v: Vehicle,
  kmContrat: number,
  prixEssence: number,
  prixKwhDomicile: number,
  prixKwhPublic: number,
): number {
  const consoMinThermique = v.consoMinThermique ?? v.consumption ?? 0;
  const consoMaxThermique = v.consoMaxThermique ?? v.consumption ?? 0;
  const consoMinElec = v.consoMinElec ?? v.consumption ?? 0;
  const consoMaxElec = v.consoMaxElec ?? v.consumption ?? 0;

  const consoMoyTh = (consoMinThermique + consoMaxThermique) / 2;
  const consoMoyEl = (consoMinElec + consoMaxElec) / 2;
  const coutThermique = (consoMoyTh / 100) * kmContrat * prixEssence;
  const prixKwhMoyen = prixKwhDomicile * 0.85 + prixKwhPublic * 0.15;
  const coutElec = (consoMoyEl / 100) * kmContrat * prixKwhMoyen;
  if (v.energy === "Électrique") return coutElec;
  if (v.energy === "Hybride Rechargeable") return coutThermique * 0.6 + coutElec * 0.4;
  return coutThermique;
}

// Fonction principale de calcul TCO. Le paramètre optionnel monthlyOverride
// permet d'utiliser le loyer NÉGOCIÉ par le commercial (sv.negotiatedMonthly)
// plutôt que le tarif catalogue (v.monthlyLld). Utilisé par le calculateur
// TCO interactif pour rester cohérent avec la valeur affichée à droite.
export function calculateTcoFull(v: Vehicle, contract: TcoContractParams, monthlyOverride?: number): TcoFullResult {
  const dureeMois = contract.dureeAnnees * 12;
  const monthly = monthlyOverride !== undefined && monthlyOverride > 0 ? monthlyOverride : v.monthlyLld;
  const loyerTotal = monthly * dureeMois;
  const prixEssence = contract.prixEssenceLitre ?? DEFAULT_COUT_ESSENCE_LITRE;
  const prixKwhDom = contract.prixKwhDomicile ?? DEFAULT_COUT_KWH_DOMICILE;
  const prixKwhPub = contract.prixKwhPublic ?? DEFAULT_COUT_KWH_PUBLIC;
  const coutEnergie = calculateCoutEnergie(v, contract.kmContrat, prixEssence, prixKwhDom, prixKwhPub);
  const taxeCO2 = calculateTaxeCO2(v.co2 ?? 0);
  const taxePollution = calculateTaxePollution(v.energy);
  const tvsTotal = (taxeCO2 + taxePollution) * contract.dureeAnnees;
  const malusCO2 = calculateMalusCO2(v.co2 ?? 0);
  const malusPoids = calculateMalusPoids(v.poidsVide ?? 0, v.energy);

  // AND (Avantage Non Déductible) — annualisé sur 5 ans
  const plafondAND = getPlafondAND(v.co2 ?? 0);
  const remisePct = v.remise ?? 0;
  const remiseAmount = (v.priceTtc * remisePct) / 100;
  const baseAND = v.priceTtc - (v.prixBatterie ?? 0) - remiseAmount - plafondAND;
  const andAnnuel = baseAND > 0 ? baseAND / 5 : 0;

  // AEN — Avantage en Nature (méthode forfaitaire basée sur le loyer)
  // Taux forfaitaire 50% ; abattement 70% si EL avec éco-score, sinon 0%.
  const baseAEN = monthly * 12;
  const tauxForfaitaire = 0.5;
  const aenBrut = baseAEN * tauxForfaitaire;
  const tauxAbattement = v.energy === "Électrique" && v.ecoScoreBool ? 0.7 : 0;
  const aenAbattement = aenBrut * tauxAbattement;
  const aenAnnuel = aenBrut - aenAbattement;
  const aenMensuel = aenAnnuel / 12;
  const partSalarialeAnnuelle = aenAnnuel * 0.25;
  const partEmployeurAnnuelle = aenAnnuel * 0.42;
  const partSalarialeMensuelle = partSalarialeAnnuelle / 12;
  const partEmployeurMensuelle = partEmployeurAnnuelle / 12;

  const emissionsContrat = ((v.co2 ?? 0) * contract.kmContrat) / 1_000_000;
  const tcoTotal = loyerTotal + coutEnergie + tvsTotal + malusCO2 + malusPoids;
  const tcoAnnuel = tcoTotal / contract.dureeAnnees;
  const tcoMensuel = tcoAnnuel / 12;
  const tcoParKm = contract.kmContrat > 0 ? tcoTotal / contract.kmContrat : 0;

  return {
    loyerTotal,
    coutEnergie,
    taxeCO2,
    taxePollution,
    tvsTotal,
    malusCO2,
    malusPoids,
    andAnnuel,
    aenBrut,
    aenAbattement,
    aenAnnuel,
    aenMensuel,
    partSalarialeAnnuelle,
    partEmployeurAnnuelle,
    partSalarialeMensuelle,
    partEmployeurMensuelle,
    tcoMensuel,
    tcoAnnuel,
    tcoParKm,
    tcoTotal,
    emissionsContrat,
  };
}
