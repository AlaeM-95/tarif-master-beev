// ============================================================================
// Calculateur TCO complet — porté de beev-tco-2026 (src/data/fiscalCalculations.ts)
// Inclut : TVS (taxe CO₂ + pollution), malus CO₂ (barème 2026 jusqu'à 80k€),
// malus poids, AND (Avantage Non Déductible), AEN (Avantage en Nature) avec
// part salariale et employeur.
// ============================================================================

import { isUtilitaireCategory, type Vehicle } from "./catalog";

// ---- Paramètres de contrat exposés à l'utilisateur ----
export type TcoContractParams = {
  dureeAnnees: number;
  kmContrat: number; // km totaux sur la durée du contrat
  prixEssenceLitre: number;
  prixKwhDomicile: number;
  prixKwhPublic: number;
  /** Total TTC des options sélectionnées sur le véhicule (sv.options).
   *  Ajouté au prix catalogue avant application de la remise commerciale
   *  pour le calcul AND (base d'amortissement). */
  optionsTotalTtc?: number;
  /** Remise commerciale en % appliquée au (prix catalogue + options).
   *  Si fournie, remplace v.remise du véhicule (qui peut être la remise
   *  catalogue par défaut alors qu'ici on veut la remise négociée). */
  remisePctOverride?: number;
};

// ---- Résultat enrichi du calcul TCO ----
export type TcoFullResult = {
  /** Prix catalogue TTC du véhicule (sans options). */
  prixCatalogue: number;
  /** Total TTC des options ajoutées. */
  optionsTotal: number;
  /** Montant TTC de la remise commerciale appliquée sur (catalogue + options). */
  remiseAmount: number;
  /** Prix d'achat final retenu pour calculer la base AND. */
  prixFinal: number;
  loyerTotal: number;
  coutEnergie: number;
  taxeCO2: number;
  taxePollution: number;
  tvsTotal: number;
  malusCO2: number;
  malusPoids: number;
  andAnnuel: number;
  /** Coût réel de l'AND pour l'entreprise : andAnnuel n'est PAS payé
   *  directement (ce n'est pas un décaissement) — c'est un montant que
   *  l'entreprise ne peut pas déduire de son résultat imposable. Le seul
   *  surcoût réel est l'IS supplémentaire dû sur ce montant réintégré :
   *  andAnnuel × TAUX_IS_ENTREPRISE (25%). C'est ce champ, et non
   *  andAnnuel, qui doit entrer dans tcoEmployeurComplet. */
  coutFiscalANDAnnuel: number;
  /** andAnnuel × nombre d'ANNÉES FISCALES ENTIÈRES du contrat (et non
   *  durationMonths / 12, une fraction sans réalité fiscale — une taxe
   *  annuelle se compte en exercices pleins). Source unique : ne pas
   *  recalculer andAnnuel × duree côté appelant, cf. anomalie relevée sur
   *  le devis Renault Captur où ce recalcul dupliqué en TVS avait dérivé. */
  andTotal: number;
  /** coutFiscalANDAnnuel × années fiscales entières — le montant à utiliser
   *  dans tcoEmployeurComplet. */
  coutFiscalANDTotal: number;
  aenBrut: number;
  aenAbattement: number;
  aenAnnuel: number;
  aenMensuel: number;
  partSalarialeAnnuelle: number;
  partEmployeurAnnuelle: number;
  partSalarialeMensuelle: number;
  partEmployeurMensuelle: number;
  /** partEmployeurAnnuelle × années fiscales entières du contrat. */
  aenEmployeurTotal: number;
  tcoMensuel: number;
  tcoAnnuel: number;
  tcoParKm: number;
  tcoTotal: number;
  emissionsContrat: number;
  /** TCO employeur complet : tcoTotal + (AND × durée) + (AEN part employeur × durée).
   *  Représente le coût total de possession du point de vue de l'entreprise,
   *  incluant les charges fiscales annexes habituellement présentées séparément. */
  tcoEmployeurComplet: number;
};

const DEFAULT_COUT_ESSENCE_LITRE = 1.75;
const DEFAULT_COUT_KWH_DOMICILE = 0.4;
const DEFAULT_COUT_KWH_PUBLIC = 0.6;

// Taux d'IS (impôt sur les sociétés) standard pour la majorité des PME/ETI
// (taux normal 2026). Utilisé uniquement pour chiffrer l'impact réel de
// l'AND sur le coût employeur — voir note plus bas.
export const TAUX_IS_ENTREPRISE = 0.25;

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
  if (masseTaxable < 1500) return 0;
  // Barème officiel 2025/2026 (taxe sur la masse en ordre de marche), tarifs
  // marginaux par fraction de kg au-dessus de 1500 kg :
  //   1500–1599 : 10 €/kg · 1600–1799 : 15 · 1800–1899 : 20 · 1900–1999 : 25 · ≥2000 : 30.
  // Calcul par tranches (comme l'IR) : on taxe chaque fraction à son tarif.
  const tranches: [number, number, number][] = [
    [1500, 1600, 10],
    [1600, 1800, 15],
    [1800, 1900, 20],
    [1900, 2000, 25],
    [2000, Infinity, 30],
  ];
  let malus = 0;
  for (const [from, to, rate] of tranches) {
    const kg = Math.max(0, Math.min(masseTaxable, to) - from);
    malus += kg * rate;
  }
  return malus;
}

// Coût énergie sur la durée du contrat.
// Fallbacks robustes : si conso_min/max_elec ou _thermique sont à 0 (cas
// classique pour les véhicules créés avant la migration 016 ou jamais
// re-saved), on retombe sur le champ legacy `consumption`. L'opérateur ??
// ne suffit pas car la DB stocke 0 (pas null), donc on teste > 0 explicitement.
function calculateCoutEnergie(
  v: Vehicle,
  kmContrat: number,
  prixEssence: number,
  prixKwhDomicile: number,
  prixKwhPublic: number,
): number {
  const baseConso = v.consumption ?? 0;
  const consoMinThermique = v.consoMinThermique && v.consoMinThermique > 0 ? v.consoMinThermique : baseConso;
  const consoMaxThermique = v.consoMaxThermique && v.consoMaxThermique > 0 ? v.consoMaxThermique : baseConso;
  const consoMinElec = v.consoMinElec && v.consoMinElec > 0 ? v.consoMinElec : baseConso;
  const consoMaxElec = v.consoMaxElec && v.consoMaxElec > 0 ? v.consoMaxElec : baseConso;

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
  // Véhicules utilitaires (N1/CTTE) : exonérés de TVS et de malus CO2/poids,
  // contrairement aux véhicules particuliers (VP). Ne pas les calculer plutôt
  // que les calculer puis les masquer à l'affichage : ils ne doivent entrer
  // dans aucun total (tcoTotal, coût employeur complet...).
  const isUtilitaire = isUtilitaireCategory(v.category);
  const taxeCO2 = isUtilitaire ? 0 : calculateTaxeCO2(v.co2 ?? 0);
  const taxePollution = isUtilitaire ? 0 : calculateTaxePollution(v.energy);
  // Nombre d'ANNÉES FISCALES ENTIÈRES couvertes par le contrat, utilisé pour
  // multiplier les taxes annuelles récurrentes (TVS, AND, AEN employeur).
  // durationMonths / 12 est une fraction (ex. 49 mois = 4,0833) sans réalité
  // fiscale : une taxe annuelle se compte en exercices pleins, pas en mois
  // fractionnés. Anomalie repérée sur le devis Renault Captur (49 mois) :
  // TVS affichait 339 × 4,0833 = 1 384 € au lieu de 339 × 4 = 1 356 €, le
  // montant réellement facturé par le loueur sur la durée du contrat.
  const dureeAnneesFiscales = Math.floor(contract.dureeAnnees);
  const tvsTotal = (taxeCO2 + taxePollution) * dureeAnneesFiscales;
  const malusCO2 = isUtilitaire ? 0 : calculateMalusCO2(v.co2 ?? 0);
  const malusPoids = isUtilitaire ? 0 : calculateMalusPoids(v.poidsVide ?? 0, v.energy);

  // AND (Avantage Non Déductible) — annualisé sur 5 ans
  // Base d'amortissement = (prix catalogue + options) - remise commerciale.
  // C'est le prix d'achat réel pour l'entreprise, plus juste que le prix
  // catalogue seul.
  // L'AND (art. 39-4 CGI, plafond selon le CO2) ne s'applique qu'aux voitures
  // particulières. Un utilitaire (N1, sans place arrière) en est exonéré, au
  // même titre que la TVS et le malus ci-dessus — un utilitaire ne doit
  // jamais afficher d'AND, quel que soit son prix ou son CO2.
  const plafondAND = getPlafondAND(v.co2 ?? 0);
  const prixCatalogue = v.priceTtc;
  const optionsTotal = Math.max(0, contract.optionsTotalTtc ?? 0);
  const remisePct = contract.remisePctOverride ?? v.remise ?? 0;
  const prixAvantRemise = prixCatalogue + optionsTotal;
  const remiseAmount = (prixAvantRemise * remisePct) / 100;
  const prixFinal = prixAvantRemise - remiseAmount;
  const baseAND = isUtilitaire ? 0 : prixFinal - (v.prixBatterie ?? 0) - plafondAND;
  const andAnnuel = baseAND > 0 ? baseAND / 5 : 0;
  // L'AND n'est pas un décaissement : l'entreprise ne paie pas andAnnuel
  // en tant que tel, elle perd seulement la déduction fiscale sur ce
  // montant. Le vrai surcoût est l'IS supplémentaire généré par cette
  // réintégration : andAnnuel × 25%.
  const coutFiscalANDAnnuel = andAnnuel * TAUX_IS_ENTREPRISE;
  const andTotal = andAnnuel * dureeAnneesFiscales;
  const coutFiscalANDTotal = coutFiscalANDAnnuel * dureeAnneesFiscales;

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
  const aenEmployeurTotal = partEmployeurAnnuelle * dureeAnneesFiscales;

  const emissionsContrat = ((v.co2 ?? 0) * contract.kmContrat) / 1_000_000;
  const tcoTotal = loyerTotal + coutEnergie + tvsTotal + malusCO2 + malusPoids;
  const tcoAnnuel = tcoTotal / contract.dureeAnnees;
  const tcoMensuel = tcoAnnuel / 12;
  const tcoParKm = contract.kmContrat > 0 ? tcoTotal / contract.kmContrat : 0;
  // Coût employeur complet : ajoute le coût FISCAL de l'AND (IS sur le
  // montant réintégré, pas le montant lui-même — voir coutFiscalANDAnnuel
  // ci-dessus) et la part employeur AEN (charges patronales, elle bien
  // réellement décaissée), sur le nombre d'années fiscales entières.
  const tcoEmployeurComplet = tcoTotal + coutFiscalANDTotal + aenEmployeurTotal;

  return {
    prixCatalogue,
    optionsTotal,
    remiseAmount,
    prixFinal,
    loyerTotal,
    coutEnergie,
    taxeCO2,
    taxePollution,
    tvsTotal,
    malusCO2,
    malusPoids,
    andAnnuel,
    coutFiscalANDAnnuel,
    andTotal,
    coutFiscalANDTotal,
    aenBrut,
    aenAbattement,
    aenAnnuel,
    aenMensuel,
    partSalarialeAnnuelle,
    partEmployeurAnnuelle,
    partSalarialeMensuelle,
    partEmployeurMensuelle,
    aenEmployeurTotal,
    tcoMensuel,
    tcoAnnuel,
    tcoParKm,
    tcoTotal,
    emissionsContrat,
    tcoEmployeurComplet,
  };
}

// ============================================================================
// TCO B2B2E — Bornes au domicile des collaborateurs
// Compare le coût total entre 2 solutions pour une flotte de N collaborateurs :
//  · Solution Beev : recharge à domicile + itinérance + supervision Home Charging
//  · Solution thermique : carburant SP95/Diesel via station
// Permet de montrer l'économie générée par l'électrification.
// ============================================================================

export type B2B2ECalculatorInput = {
  /** Nombre de collaborateurs équipés. */
  nbCollabs: number;
  /** Durée du contrat (années). */
  dureeAnnees: number;
  /** Km/an par collaborateur (moyenne). */
  kmParAnParCollab: number;
  /** Consommation moyenne du véhicule électrique (kWh/100km). */
  consoElecKWh100: number;
  /** Consommation moyenne du véhicule thermique de référence (L/100km). */
  consoCarbL100: number;
  /** Prix kWh domicile (€). */
  prixKwhDom: number;
  /** Prix kWh public/itinérance (€). */
  prixKwhPub: number;
  /** Prix carburant SP95/Diesel (€/L). */
  prixCarbL: number;
  /** Mix recharge domicile en % (0-100). Le reste = itinérance. */
  mixDomicilePct: number;
  /** Investissement initial par collaborateur HT pour l'installation borne. */
  investBorneParCollabHt: number;
  /** Abonnement Beev Home Charging par mois par collaborateur (€). */
  supervisionParMoisParCollab: number;
};

export type B2B2ECalculatorResult = {
  kmTotalParCollab: number;
  energieElecParCollab: number;
  energieCarbParCollab: number;
  investBorneFlotte: number;
  investBorneAnnuelFlotte: number;
  supervisionFlotteAnnuelle: number;
  supervisionFlotteTotale: number;
  energieBeevFlotteTotale: number;
  energieBeevAnnuelle: number;
  coutBeevFlotteTotal: number;
  coutBeevFlotteAnnuel: number;
  coutCarbFlotteTotal: number;
  coutCarbFlotteAnnuel: number;
  economieFlotteTotale: number;
  economieFlotteAnnuelle: number;
  economieParCollabParAn: number;
  economiePct: number;
  roiMois: number;
  co2EviteTonnes: number;
};

export function calculateB2B2ETco(input: B2B2ECalculatorInput): B2B2ECalculatorResult {
  const nb = Math.max(1, Math.round(input.nbCollabs));
  const duree = Math.max(0.5, input.dureeAnnees);
  const mixDom = Math.min(1, Math.max(0, input.mixDomicilePct / 100));
  const mixPub = 1 - mixDom;

  const kmTotalParCollab = input.kmParAnParCollab * duree;
  const energieElecParCollab = (input.consoElecKWh100 / 100) * kmTotalParCollab;
  const energieCarbParCollab = (input.consoCarbL100 / 100) * kmTotalParCollab;

  const investBorneFlotte = input.investBorneParCollabHt * nb;
  const investBorneAnnuelFlotte = investBorneFlotte / duree;

  const supervisionFlotteAnnuelle = input.supervisionParMoisParCollab * 12 * nb;
  const supervisionFlotteTotale = supervisionFlotteAnnuelle * duree;

  const prixKwhMoyen = input.prixKwhDom * mixDom + input.prixKwhPub * mixPub;
  const energieBeevParCollabTotale = energieElecParCollab * prixKwhMoyen;
  const energieBeevFlotteTotale = energieBeevParCollabTotale * nb;
  const energieBeevAnnuelle = energieBeevFlotteTotale / duree;

  const coutCarbParCollab = energieCarbParCollab * input.prixCarbL;
  const coutCarbFlotteTotal = coutCarbParCollab * nb;
  const coutCarbFlotteAnnuel = coutCarbFlotteTotal / duree;

  const coutBeevFlotteTotal = energieBeevFlotteTotale + supervisionFlotteTotale + investBorneFlotte;
  const coutBeevFlotteAnnuel = coutBeevFlotteTotal / duree;

  const economieFlotteTotale = coutCarbFlotteTotal - coutBeevFlotteTotal;
  const economieFlotteAnnuelle = economieFlotteTotale / duree;
  const economieParCollabParAn = economieFlotteAnnuelle / nb;
  const economiePct = coutCarbFlotteTotal > 0 ? (economieFlotteTotale / coutCarbFlotteTotal) * 100 : 0;

  const economieMensuelleMoyenne = economieFlotteAnnuelle / 12;
  const roiMois = economieMensuelleMoyenne > 0 ? investBorneFlotte / economieMensuelleMoyenne : 0;
  const co2EviteTonnes = (135 * kmTotalParCollab * nb) / 1_000_000;

  return {
    kmTotalParCollab,
    energieElecParCollab,
    energieCarbParCollab,
    investBorneFlotte,
    investBorneAnnuelFlotte,
    supervisionFlotteAnnuelle,
    supervisionFlotteTotale,
    energieBeevFlotteTotale,
    energieBeevAnnuelle,
    coutBeevFlotteTotal,
    coutBeevFlotteAnnuel,
    coutCarbFlotteTotal,
    coutCarbFlotteAnnuel,
    economieFlotteTotale,
    economieFlotteAnnuelle,
    economieParCollabParAn,
    economiePct,
    roiMois,
    co2EviteTonnes,
  };
}

export const DEFAULT_B2B2E_INPUT: B2B2ECalculatorInput = {
  nbCollabs: 10,
  dureeAnnees: 4,
  kmParAnParCollab: 25000,
  consoElecKWh100: 18,
  consoCarbL100: 6.5,
  prixKwhDom: 0.20,
  prixKwhPub: 0.45,
  prixCarbL: 1.85,
  mixDomicilePct: 85,
  investBorneParCollabHt: 1800,
  supervisionParMoisParCollab: 8,
};
