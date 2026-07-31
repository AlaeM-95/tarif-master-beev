import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BEEV_JOURNEYS, MANDATORY_SERVICES, isUtilitaireCategory, type Charger, type LineItem, type ProjectType, type Vehicle } from "./catalog";
import { loadPdfSettings, hexToRgb } from "./pdf-settings";
import { DEFAULT_PDF_CONFIG, type PdfDisplayConfig } from "./pdf-config";
import { fetchTcoResultsForVehicles, type TcoResult } from "./tco-results";
import { loadBeevPillars, type BeevPillar } from "./beev-pillars";
import { loadPdfTexts, buildPdfTextMap, lookupText, lookupList, setPdfTextOverrides, type PdfTextMap } from "./pdf-texts";
import { calculateTcoFull, calculateB2B2ETco, calculateMalusCO2, calculateMalusPoids, DEFAULT_B2B2E_INPUT, type B2B2ECalculatorInput } from "./tco-calculator";
import type { EnergyParams } from "./store";

export type ClientInfo = {
  company: string;
  contact: string;
  email: string;
  date: string;
  salesRep: string;
  salesRepEmail: string;
  salesRepPhone: string;
  notes: string;
};

/** Configuration alternative durée/km/loyer pour un même véhicule sélectionné.
 *  Permet au commercial de présenter plusieurs scénarios au client (ex : 48m
 *  / 30k vs 60m / 60k) sur la même fiche véhicule. */
export type PricingConfig = {
  id: string;
  durationMonths: number;
  kmPerYear: number;
  negotiatedMonthly: number;
};

export type SelectedVehicle = {
  /** Identifiant d'instance unique dans le devis. Permet de sélectionner
   *  plusieurs variantes du MÊME modèle catalogue (ex. Tesla Model Y sans
   *  options et une seconde avec options). Généré à la sélection / duplication.
   *  Optionnel pour rétro-compat avec les devis enregistrés avant le multi-variante. */
  instanceId?: string;
  vehicle: Vehicle;
  quantity: number;
  discountPct: number;
  /** Masque la remise commerciale (lignes « Remise commerciale » + « Prix
   *  remisé TTC ») sur la fiche véhicule du PDF, PAR véhicule. La remise reste
   *  prise en compte dans le calcul de l'AND (via discountPct). Géré sur la
   *  carte du panneau de droite. Par défaut false = remise affichée. */
  hideDiscount?: boolean;
  /** Loyer mensuel TTC de la configuration PRINCIPALE (rétro-compat). */
  negotiatedMonthly: number;
  /** Durée de la configuration principale. */
  durationMonths: number;
  /** Km/an de la configuration principale. */
  kmPerYear: number;
  /** Configurations supplémentaires (durée, km, loyer) au-delà de la principale.
   *  Affichées dans le PDF et le panneau droit comme scénarios alternatifs. */
  additionalConfigs?: PricingConfig[];
  includeTco: boolean;
  services: string[];
  options: LineItem[];
  /** Offres concurrentes saisies par le commercial pour la mise en concurrence :
   *  Beev propose sur le MÊME véhicule un loyer face à plusieurs loueurs
   *  existants (Arval, Ayvens, Leasys...). Si non vide, déclenche l'affichage
   *  de la slide « Mise en concurrence » dans le PDF avec une colonne par
   *  offre concurrente + 1 colonne Beev. */
  competitorOffers?: Array<{
    loueur: string;
    monthlyTtc: number;
    durationMonths: number;
    kmPerYear: number;
  }>;
  /** Groupe de comparaison libre — permet au commercial de pairer plusieurs
   *  véhicules dans le PDF. Tous les véhicules ayant le même comparisonGroup
   *  sont comparés ensemble dans une slide dédiée. Si vide, le véhicule
   *  apparaît dans le comparateur global. Exemples : "Groupe A", "Berlines",
   *  "Remplacement 3008". */
  comparisonGroup?: string;
  /** N° de devis du loueur saisi par le commercial : permet de retrouver l'offre
   *  préparée chez le loueur. Affiché dans le PDF sous « Proposition Beev /
   *  Tarification LLD ». */
  leaserQuoteRef?: string;
  /** Clés de caractéristiques techniques MASQUÉES sur la fiche véhicule, choisies
   *  par le commercial dans le panneau de droite (cf. getVehicleSpecRows pour les
   *  clés). Par défaut vide = toutes les caractéristiques disponibles s'affichent. */
  hiddenSpecs?: string[];
  /** Montant de la prime CEE (utilitaire électrique uniquement), saisi par le
   *  commercial. Intégré au loyer mensuel affiché : l'entreprise l'avance à la
   *  mise en service puis se le fait rembourser par l'organisme émetteur du
   *  certificat d'économie d'énergie sous 2 à 3 mois. Si > 0, un encart
   *  explicatif est affiché sur la fiche véhicule du PDF (cf. drawVehiclePage). */
  primeCeeAmount?: number;
};

/** Une ligne de caractéristique technique de la fiche véhicule. */
export type VehicleSpecRow = { key: string; label: string; value: string };

/** Construit la liste des caractéristiques techniques CANDIDATES d'un véhicule
 *  (énergie, autonomie, batterie, puissance, conso, CO2, recharges, etc.) en
 *  respectant la disponibilité de la donnée, l'applicabilité selon l'énergie et
 *  la config PDF globale. Source unique partagée par la fiche PDF et le panneau
 *  de droite (cases à cocher afficher / masquer). Le commercial masque ensuite
 *  les clés non souhaitées via SelectedVehicle.hiddenSpecs. */
// `lang` est un paramètre EXPLICITE (pas le global PDF_LANG) : cette fonction
// est aussi appelée par le panneau admin (index.tsx, specToggles) en dehors
// de toute génération PDF — passer par PDF_LANG y ferait fuiter la langue du
// DERNIER PDF généré dans l'interface French-only du commercial.
export function getVehicleSpecRows(v: Vehicle, cfg: PdfDisplayConfig, lang: "fr" | "en" = "fr"): VehicleSpecRow[] {
  const t = (fr: string, en: string) => (lang === "en" ? en : fr);
  const rows: VehicleSpecRow[] = [];
  const isElec = v.energy === "Électrique";
  const isPhev = v.energy === "Hybride Rechargeable";
  // Utilitaire thermique/hybride : les caractéristiques électriques n'ont pas
  // de sens (pas de batterie, pas de recharge) — masquées sur la fiche PDF.
  const hideEvSpecs = isUtilitaireCategory(v.category) && !isElec;
  rows.push({ key: "energy", label: t("Énergie", "Energy"), value: v.energy });
  // Autonomie : pour un EV / hybride rechargeable, c'est l'autonomie WLTP ;
  // pour un véhicule hors électrique, on affiche l'autonomie saisie dans le
  // panneau de configuration (champ « Autonomie km ») dès qu'elle est renseignée.
  rows.push({ key: "range", label: t("Autonomie / distance WLTP", "Range / WLTP distance"), value: v.rangeWltp > 0 ? `${v.rangeWltp} km` : "—" });
  if (!hideEvSpecs) rows.push({ key: "battery", label: t("Capacité batterie", "Battery capacity"), value: v.batteryKwh > 0 ? `${v.batteryKwh} kWh` : "—" });
  rows.push({ key: "power", label: t("Puissance", "Power"), value: `${v.powerHp} ${t("ch", "hp")}` });
  // Volume de chargement en priorité pour un utilitaire : c'est une
  // caractéristique décisive à l'achat, à faire figurer avant conso/CO2/CV
  // fiscaux/score environnemental pour ne pas être coupé par la limite de
  // 7 lignes affichées sur la fiche véhicule (mode admin).
  const isUtil = isUtilitaireCategory(v.category);
  if (isUtil && cfg.showVehicleTrunk && v.cargoVolumeM3) {
    rows.push({ key: "trunk", label: t("Volume de chargement", "Cargo volume"), value: `${v.cargoVolumeM3} m³` });
  }
  if (cfg.showVehicleConsumption) {
    if (isElec) {
      rows.push({ key: "consumption", label: t("Consommation", "Consumption"), value: `${v.consumptionElec ?? v.consumption} kWh/100 km` });
    } else if (isPhev && (v.consumptionThermal || v.consumptionElec)) {
      if (v.consumptionThermal) rows.push({ key: "consumption", label: t("Conso thermique", "Combustion consumption"), value: `${v.consumptionThermal} L/100 km` });
      if (v.consumptionElec) rows.push({ key: "consumption", label: t("Conso électrique (mode EV)", "Electric consumption (EV mode)"), value: `${v.consumptionElec} kWh/100 km` });
    } else {
      rows.push({ key: "consumption", label: t("Consommation moyenne", "Average consumption"), value: `${v.consumptionThermal ?? v.consumption} L/100 km` });
    }
  }
  if (cfg.showVehicleCo2) rows.push({ key: "co2", label: "CO2", value: `${v.co2} g/km` });
  if (cfg.showVehicleFiscalHp) rows.push({ key: "fiscalHp", label: t("Puissance fiscale", "Fiscal power (CV, French tax horsepower)"), value: `${v.fiscalHp} CV` });
  if (!hideEvSpecs && cfg.showVehicleEnvScore && v.envScore !== undefined) rows.push({ key: "envScore", label: t("Score environnemental", "Environmental score"), value: `${v.envScore} / 100` });
  // Volume de coffre (véhicules particuliers) : reste à sa place habituelle,
  // le volume de chargement utilitaire est déjà inséré plus haut en priorité.
  if (cfg.showVehicleTrunk && !isUtil && v.trunkLitres) {
    rows.push({ key: "trunk", label: t("Volume de coffre", "Trunk volume"), value: `${v.trunkLitres} L` });
  }
  if (isElec && cfg.showVehicleChargeAc && v.chargeAcMaxKw) rows.push({ key: "chargeAc", label: t("Recharge AC max", "Max AC charging"), value: `${v.chargeAcMaxKw} kW` });
  if (isElec && cfg.showVehicleChargeDc && v.chargeDcMaxKw) rows.push({ key: "chargeDc", label: t("Recharge DC max", "Max DC charging"), value: `${v.chargeDcMaxKw} kW` });
  if (isElec && cfg.showVehicleChargeTime2080Ac && v.chargeTime2080Ac) rows.push({ key: "chargeTime2080Ac", label: t("Recharge 20-80 % AC", "20-80% AC charging"), value: v.chargeTime2080Ac });
  if (isElec && cfg.showVehicleChargeTime2080Dc && v.chargeTime2080Dc) rows.push({ key: "chargeTime2080Dc", label: t("Recharge 20-80 % DC", "20-80% DC charging"), value: v.chargeTime2080Dc });
  if (cfg.showVehicleDimensions && v.dimensions) rows.push({ key: "dimensions", label: t("Dimensions", "Dimensions"), value: v.dimensions });
  if (cfg.showVehicleLeadTime && v.leadTime) rows.push({ key: "leadTime", label: t("Délai de livraison", "Delivery time"), value: v.leadTime });
  return rows;
}

/** Spécifications site personnalisables par le commercial pour le rapport site
 *  entreprise. Tous les champs sont optionnels — quand renseignés, ils
 *  remplacent les placeholders 'à confirmer après visite technique' dans le
 *  PDF généré (Vue d'ensemble, Synthèse projet, Infrastructure).
 *  L'option supervision détermine aussi le bloc 'Supervision' du PDF :
 *  beev_connect (site entreprise) ou beev_home_charging (B2B2E). */
export type SiteSpecs = {
  /** Secteur d'activité du client (Hôtellerie, Tertiaire, Logistique...) */
  sector?: string;
  /** Type d'installation (Parking extérieur, sous-sol, etc.) */
  installationType?: string;
  /** Usage des bornes (collaborateurs, visiteurs...) */
  usage?: string;
  /** Délai estimé après validation devis */
  estimatedDelay?: string;
  /** Puissance abonnement EDF (ex : "180 kVA") */
  edfPower?: string;
  /** Distance TGBT → bornes la plus longue */
  distanceTgbt?: string;
  /** Description de l'emplacement (ex : "Parking extérieur, cour gravillons") */
  locationDescription?: string;
  /** Local TGBT et cheminement câble */
  tgbtRoom?: string;
  /** Liste des travaux à réaliser (1 bullet = 1 ligne, jusqu'à 20) —
   *  remplace la liste par défaut dans la page Infrastructure électrique. */
  worksList?: string[];
  /** Type de câble triphasé (22 kW) — preset ou personnalisé. */
  cable22Type?: string;
  /** Type de câble monophasé (7,4 kW) — preset ou personnalisé. */
  cable74Type?: string;
  /** Nombre de points de charge par borne (1 ou 2). */
  pointsParBorne?: 1 | 2;
  /** Inclure la maintenance annuelle dans le PDF (case à cocher commercial). */
  includeMaintenance?: boolean;
  /** Photos du chantier uploadées par le commercial — affichées sous la
   *  liste des travaux à réaliser dans le PDF "Infrastructure électrique". */
  chantierPhotos?: string[];
  /** Taux de TVA applicable (5,5 % ou 20 %) — utilisé dans le récap
   *  financier pour calculer le total TTC. */
  tvaRate?: 5.5 | 20;
  /** Activer le bureau de contrôle dans le chiffrage (obligatoire si abonnement
   *  > 36 kVA). Si false, ligne masquée dans le récap financier, le total
   *  MONTANT TOTAL PROJET et la page conformité. */
  includeBureauControle?: boolean;
  /** Inclure le bloc Consuel sur la page conformité (obligatoire pour toute
   *  installation IRVE en théorie, mais souvent géré par l'électricien ; le
   *  commercial choisit de l'afficher ou non au client). */
  includeConsuel?: boolean;
  /** Plan de supervision : Beev Connect (site entreprise) ou Beev Home Charging
   *  (B2B2E domicile collaborateur). 'none' = pas de bloc supervision. */
  supervisionPlan?: "beev_connect" | "beev_home_charging" | "none";
};

export type SelectedCharger = {
  /** Identifiant unique de CETTE instance dans le devis. Permet de chiffrer
   *  plusieurs fois la même référence de borne (ex. un site différent par
   *  instance). Distinct de charger.id (la référence catalogue). */
  instanceId: string;
  charger: Charger;
  quantity: number;
  /** Multiplie le prix de vente (lineItems) par `quantity`. Par défaut true
   *  (comportement historique) : quantity = 2 double le prix, en supposant
   *  que lineItems chiffre UNE seule borne. Décoché par le commercial quand
   *  lineItems chiffre déjà le lot complet (N bornes) — quantity reste alors
   *  purement informatif, sans effet sur le prix total. */
  multiplyPriceByQty?: boolean;
  discountPct: number;
  installIncluded: boolean;
  siteName: string;
  siteAddress: string;
  siteContact: string;
  lineItems: LineItem[];
  // URL du devis technicien uploadé (privé, jamais inclus dans le PDF client)
  technicianQuoteUrl?: string;
  /** Spécifications site personnalisables par le commercial. */
  siteSpecs?: SiteSpecs;
  /** Mode LOCATION (leasing) : présente la borne en loyer mensuel plutôt qu'à
   *  l'achat. Le commercial saisit le loyer et la durée ; option d'achat (10%
   *  du total des loyers) et pénalité de résiliation anticipée (loyers restants
   *  × 1,10) calculées automatiquement. Remplace le chiffrage à l'achat. */
  leaseEnabled?: boolean;
  leaseMonthly?: number;        // loyer mensuel HT (par borne)
  leaseDurationMonths?: number; // durée du contrat en mois
  /** Location du matériel SEUL (sans installation). Le PDF mentionne « matériel
   *  seul » et n'affiche pas les inclusions d'installation. */
  leaseEquipmentOnly?: boolean;
  /** Montant total projet HT saisi manuellement en mode location (admin). Quand
   *  il est renseigné (> 0), il REMPLACE le total calculé dans la page
   *  « 7 · Options de paiement » (utile quand tout est en location, donc total
   *  achat = 0). Plusieurs bornes : les montants sont additionnés. */
  leaseProjectTotalHt?: number;
  /** Formules de location SUPPLÉMENTAIRES (admin) : durées / loyers alternatifs
   *  présentés en plus de la formule principale (leaseMonthly / leaseDurationMonths).
   *  Chaque formule reçoit le même calcul (option d'achat 10 %, échéancier
   *  trimestriel, résiliation anticipée). */
  leaseConfigs?: Array<{ id: string; monthly: number; durationMonths: number }>;
  /** Lien de signature en ligne du devis (admin). Utilisé par le CTA « Signer le
   *  devis » de la page Options de paiement. Vide : repli sur contact@beev.co. */
  signatureUrl?: string;
  /** Nombre de points de charge par borne : 1 (borne simple) ou 2 (borne
   *  double — un poteau/mur avec 2 prises indépendantes). Distinct de
   *  `quantity` (nombre de bornes achetées). Par défaut 1 si non renseigné. */
  chargePoints?: 1 | 2;
  /** Masque l'encart "Inclus dans la prestation" / "Location du matériel seul"
   *  pour CETTE borne uniquement, sans désactiver le toggle global
   *  showChargerInclusionNote (qui s'applique à toutes les bornes du PDF). */
  hideInclusionNote?: boolean;
  /** Masque la fiche détaillée (drawChargerPage) de CETTE borne dans le PDF
   *  généré, sans la retirer du devis (chiffrage interne, comparateur B2B2E,
   *  totaux). Utile quand la fiche ne contient plus rien de pertinent une fois
   *  points forts/présentation/encart désactivés. */
  hideFromPdf?: boolean;
  /** Masque UNIQUEMENT le tableau de chiffrage à l'achat (Prestation/Qté/PU HT/
   *  Total HT) + l'encart "Pour N bornes/collaborateurs" pour CETTE borne, en
   *  gardant le reste de la fiche (points forts, présentation, offre en
   *  location le cas échéant). Utile en mode location + compte admin : le
   *  chiffrage à l'achat reste affiché par défaut pour les comptes admin
   *  (postes de dépense internes), ce qui n'est pas toujours pertinent à
   *  montrer sur ce devis précis. */
  hideAchatPricing?: boolean;
};

/** Multiplicateur de prix à appliquer à `sc.lineItems` : `quantity` sauf si
 *  le commercial a explicitement décoché `multiplyPriceByQty` (lineItems
 *  chiffre alors déjà le lot complet). Source unique — ne pas réécrire
 *  `sc.quantity` directement dans un calcul de prix. */
export function chargerQtyMultiplier(sc: SelectedCharger): number {
  return sc.multiplyPriceByQty === false ? 1 : Math.max(1, sc.quantity || 1);
}

// Calculs de l'offre en location d'une borne (par instance). Respecte
// multiplyPriceByQty comme le chiffrage à l'achat (chargerQtyMultiplier) :
// sinon la case "Doubler le prix selon la quantité" décochée n'avait aucun
// effet en mode location, seulement en mode achat.
export function computeChargerLease(sc: SelectedCharger) {
  return computeLeaseScenario(sc.leaseMonthly ?? 0, sc.leaseDurationMonths ?? 0, chargerQtyMultiplier(sc));
}

// Calcul d'UNE formule de location (loyer mensuel + durée + nb de bornes).
// Identique pour la formule principale et chaque formule supplémentaire.
export function computeLeaseScenario(monthly0: number, duration0: number, qty0: number) {
  const monthly = Math.max(0, monthly0);
  const duration = Math.max(0, Math.round(duration0));
  const qty = Math.max(1, qty0 || 1);
  const monthlyTotal = monthly * qty;             // loyer mensuel pour l'ensemble des bornes
  const totalRents = monthlyTotal * duration;     // total des loyers sur le contrat
  const buyout = totalRents * 0.10;               // option d'achat = 10% du total des loyers
  // Échéancier de prélèvement TRIMESTRIEL : le loyer est calculé au mois mais
  // prélevé tous les 3 mois (1 prélèvement = 3 loyers mensuels). Le dernier
  // prélèvement couvre les mois restants si la durée n'est pas un multiple de 3.
  const quarterlyAmount = monthlyTotal * 3;       // prélèvement trimestriel standard
  const installments: Array<{ index: number; fromMonth: number; toMonth: number; months: number; amount: number; cumulative: number }> = [];
  let cumulative = 0;
  let qi = 0;
  for (let m = 0; m < duration; m += 3) {
    const months = Math.min(3, duration - m);
    const amount = monthlyTotal * months;
    cumulative += amount;
    qi += 1;
    installments.push({ index: qi, fromMonth: m + 1, toMonth: m + months, months, amount, cumulative });
  }
  // Pénalité de résiliation anticipée à la fin de chaque année : loyers restants × 1,10.
  const schedule: Array<{ afterMonths: number; remainingMonths: number; remainingRents: number; penalty: number }> = [];
  for (let m = 12; m < duration; m += 12) {
    const remainingMonths = duration - m;
    const remainingRents = remainingMonths * monthlyTotal;
    schedule.push({ afterMonths: m, remainingMonths, remainingRents, penalty: remainingRents * 1.10 });
  }
  return { monthly, duration, qty, monthlyTotal, totalRents, buyout, quarterlyAmount, installments, schedule };
}

// Calcule le prix unitaire final (avec marge) qui sera présenté au client.
// Le prix d'achat (unitHt) et la marge restent privés côté admin.
export function lineItemClientUnit(li: LineItem): number {
  const m = li.marginPct ?? 0;
  return li.unitHt * (1 + m / 100);
}

export function lineItemClientTotal(li: LineItem): number {
  return lineItemClientUnit(li) * li.qty;
}

// === CHARTE GRAPHIQUE BEEV 2026 ===
// Les couleurs sont mutables : elles sont écrasées par les valeurs de pdf_settings
// (Supabase) au début de chaque génération via applyPdfSettings().
// Charte Beev 2026 officielle :
//   Black  #1D1D1D  · Beige #FCF9F2  · Rose #F4B8AA · Bleu #A5D2FF · Violet #D3CCD8
// LAVENDER conservé comme alias historique mais pointe désormais sur le ROSE
// (accent principal de la charte) pour compatibilité avec le code existant.
let INK: [number, number, number] = [29, 29, 29];           // #1D1D1D Black charte
const SUB: [number, number, number] = [95, 95, 100];        // #5F5F64 gris secondaire
const RULE: [number, number, number] = [220, 218, 212];     // #DCDAD4 filets
let BG: [number, number, number] = [252, 249, 242];         // #FCF9F2 Beige charte
let ACCENT: [number, number, number] = [244, 184, 170];     // #F4B8AA Rose charte (était vert)
let LAVENDER: [number, number, number] = [244, 184, 170];   // alias Rose pour code legacy
// Rose FONCÉ lisible pour le TEXTE accentué (totaux, montants mis en avant) :
// le rose charte #F4B8AA est trop pâle pour du texte sur fond clair.
const ACCENT_TEXT: [number, number, number] = [181, 96, 79]; // #B5604F

// Contenus éditables depuis l'admin (chargés depuis pdf_settings + journey_steps).
let PDF_CONTENT: {
  logoUrl: string | null;
  logoInverseUrl: string | null;
  coverImageUrl: string | null;
  coverSubtitle: string | null;
  whyBeevIntro: string | null;
  whyBeevBullets: string[];
  validationConditions: string | null;
  validationBpaText: string | null;
  validationBpaTitle: string | null;
  steps: Array<{ n: string; title: string; summary: string; duration: string; beev: string[]; client: string[] }>;
} = {
  logoUrl: null,
  logoInverseUrl: null,
  coverImageUrl: null,
  coverSubtitle: null,
  whyBeevIntro: null,
  whyBeevBullets: [],
  validationConditions: null,
  validationBpaText: null,
  validationBpaTitle: null,
  steps: [],
};

// Police de marque (chargée dynamiquement depuis public/fonts/)
let BRAND_FONT = "helvetica"; // fallback si Roobert non disponible

// Configuration d'affichage du PDF (toggleable depuis l'app par le commercial)
let PDF_CFG: PdfDisplayConfig = DEFAULT_PDF_CONFIG;

// Mode admin : déverrouille des comportements réservés aux comptes admin
// (chiffrage des postes affiché même en location, BPA / conditions propres à
// chaque type de projet). Positionné par generateProposalPdf (adminMode).
let ADMIN_MODE = false;

// Langue du PDF généré. Défaut "fr" : comportement inchangé si le paramètre
// n'est pas fourni. Positionné par generateProposalPdf (lang). Les nombres,
// devises et dates restent au format français dans les 2 langues (toujours
// une transaction en euros sous droit fiscal français) — seuls les mots
// changent, via le helper L() ci-dessous.
let PDF_LANG: "fr" | "en" = "fr";

// Traduction inline : garde le texte anglais collé à côté du français au
// point d'appel plutôt qu'un dictionnaire séparé à resynchroniser à chaque
// changement de texte. Périmètre actuel (voir plan) : pages véhicules
// uniquement — les pages bornes site / B2B2E domicile n'appellent pas L()
// et restent en français quel que soit PDF_LANG.
function L(fr: string, en: string): string {
  return PDF_LANG === "en" ? en : fr;
}

// Rebrand v2 (admin) : couleur d'accent du produit courant — rose (véhicules),
// bleu (domicile B2B2E), violet (site). Pilote eyebrows / en-tête / accents.
const PRODUCT_ROSE: [number, number, number] = [244, 184, 170];
const PRODUCT_BLEU: [number, number, number] = [165, 210, 255];
const PRODUCT_VIOLET: [number, number, number] = [211, 204, 216];
let PRODUCT_ACCENT: [number, number, number] = PRODUCT_ROSE;

// Résultats TCO chargés depuis Supabase (synchronisés avec beev-tco-2026)
// Map vehicleId → TcoResult le plus récent. Vide si l'app TCO n'a rien écrit.
let TCO_RESULTS: Map<string, TcoResult> = new Map();

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 48;
const FOOTER_LIMIT = PAGE_H - 78; // footer enrichi (2 lignes) prend ~22pt + filet
// Marge basse de sécurité pour les tableaux autoTable : le footer (filet +
// 2 lignes) occupe la bande PAGE_H-56 → PAGE_H-32. Sans cette marge, la
// marge basse par défaut d'autoTable (40) laisse les lignes du tableau
// chevaucher le footer. 72pt garantit un espace propre au-dessus du footer.
const TABLE_BOTTOM_MARGIN = 72;

// Garantit qu'un bloc de hauteur `needed` (pt) tient avant le footer. Sinon,
// nouvelle page (avec header si `client` fourni) et retourne le y de départ en
// haut de la nouvelle page. Évite que les notes méthodologiques dessinées après
// un grand tableau chevauchent le pied de page.
function ensureBottomSpace(
  doc: jsPDF,
  y: number,
  needed: number,
  client?: ClientInfo,
  type: ProjectType = "vehicles",
): number {
  if (y + needed <= FOOTER_LIMIT) return y;
  doc.addPage();
  if (client) drawHeader(doc, client, type);
  return 116;
}

// ============ TCO ============
export function computeTco(sv: SelectedVehicle, e: EnergyParams) {
  const mix = e.mixHomePct / 100;
  const v = sv.vehicle;
  const isElec = v.energy === "Électrique";
  const isPhev = v.energy === "Hybride Rechargeable";
  const isHev = v.energy === "Hybride" || v.energy === "Mild Hybrid";
  const kWhCost = mix * e.kWhHome + (1 - mix) * e.kWhPublic;
  let energy100 = 0;
  if (isElec) {
    // 100 % électrique : v.consumption en kWh/100 km (legacy) ou
    // v.consumptionElec si renseigné (priorité car plus explicite)
    const consoKwh = (v.consumptionElec ?? v.consumption) || 0;
    energy100 = consoKwh * kWhCost;
  } else if (isPhev) {
    // Hybride Rechargeable : si les 2 consos sont renseignées, on les utilise
    // directement (mode mixte 60 % élec / 40 % thermique par défaut). Sinon
    // fallback heuristique sur batterie/autonomie.
    const elecShare = 0.6;
    const consoKwh = v.consumptionElec ?? 0;
    const consoL = v.consumptionThermal ?? v.consumption ?? 0;
    if (consoKwh > 0 && consoL > 0) {
      energy100 = elecShare * consoKwh * kWhCost + (1 - elecShare) * consoL * e.fuelPriceL;
    } else {
      // Fallback historique : on déduit la conso élec depuis la batterie/autonomie
      const fuelL100 = consoL || 6.5;
      energy100 = elecShare * (v.batteryKwh / Math.max(v.rangeWltp, 1)) * 100 * kWhCost
                + (1 - elecShare) * fuelL100 * e.fuelPriceL;
    }
  } else if (isHev) {
    // Hybride non rechargeable (Toyota HEV, MHEV) : pas de recharge externe,
    // donc la conso "officielle" L/100 inclut déjà le bonus EV ponctuel.
    // Si consumptionThermal est renseigné, on l'utilise ; sinon legacy consumption.
    const consoL = v.consumptionThermal ?? v.consumption ?? 0;
    energy100 = consoL * e.fuelPriceL;
  } else {
    // Thermique pur (Essence, Diesel) : v.consumption en L/100 km
    const consoL = v.consumptionThermal ?? v.consumption ?? 0;
    energy100 = consoL * e.fuelPriceL;
  }
  const lease100 = (sv.negotiatedMonthly * 12) / Math.max(sv.kmPerYear, 1) * 100;
  const tco100 = lease100 + energy100;
  const refFuel100 = 6.0 * e.fuelPriceL;
  const refLease100 = (500 * 12) / Math.max(sv.kmPerYear, 1) * 100;
  const refTco100 = refLease100 + refFuel100;
  const economy100 = refTco100 - tco100;
  return { energy100, lease100, tco100, refTco100, economy100 };
}

const TYPE_TITLE: Record<ProjectType, string> = {
  vehicles: "Véhicules électriques pour votre flotte",
  home: "Bornes de recharge domicile collaborateurs",
  site: "Bornes de recharge site entreprise",
};

// Charge les paramètres PDF (couleurs, textes, étapes) depuis Supabase et les applique
// aux variables module-level utilisées par les fonctions de dessin.
// Cache module-level pour éviter de recharger settings/fonts/TCO à chaque PDF.
// Sans cache, générer 3 PDF d'affilée déclenche 15 requêtes réseau, ce qui
// faisait sauter le timeout global de 30s dès le 2e ou 3e document.
// Cache TTL court (5 s) sur tous les contenus éditables admin : assez pour
// dédupliquer les fetches dans une génération chaînée (clic → clic en < 5 s)
// mais imperceptible côté admin (toute modif est visible au PDF suivant).
type CachedSettings = { type: ProjectType; data: Awaited<ReturnType<typeof loadPdfSettings>>; expiresAt: number };
const PDF_SETTINGS_CACHE = new Map<ProjectType, CachedSettings>();
const SETTINGS_TTL_MS = 5 * 1000;

let TCO_CACHE: { key: string; data: Map<string, TcoResult>; expiresAt: number } | null = null;
const TCO_TTL_MS = 30 * 1000; // 30 s : les TCO changent rarement, peu de risque admin

let FONT_CACHE: { regularB64: string; semiBoldB64: string } | null = null;

let PILLARS_CACHE: { data: BeevPillar[]; expiresAt: number } | null = null;
const PILLARS_TTL_MS = 5 * 1000;
let PILLARS: BeevPillar[] = [];

let TEXTS_CACHE: { data: PdfTextMap; expiresAt: number } | null = null;
const TEXTS_TTL_MS = 5 * 1000;
let TEXTS: PdfTextMap = new Map();

// Logo Beev préchargé une fois par appel à generateProposalPdf, puis utilisé
// de manière synchrone dans drawHeader (qui est appelé après chaque addPage).
// La variante blanche est placée sur un petit bandeau noir arrondi pour
// rester visible sur les pages internes à fond clair.
let HEADER_LOGO: { dataUrl: string; w: number; h: number; format: "JPEG" | "PNG" } | null = null;
// Variante FONCÉE du logo (en-tête admin sur fond clair) — logo paramétré dans
// l'admin en priorité, sinon logo noir local.
let HEADER_LOGO_DARK: { dataUrl: string; w: number; h: number; format: "JPEG" | "PNG" } | null = null;

// Wrap une promesse avec un timeout court qui rejette si la requête traîne.
// Utilisé pour chaque fetch réseau afin de retomber rapidement sur les valeurs
// par défaut plutôt que de bloquer la génération entière.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout ${label} (${ms}ms)`)), ms)),
  ]);
}

async function applyPdfSettings(projectType: ProjectType) {
  try {
    const now = Date.now();
    const cached = PDF_SETTINGS_CACHE.get(projectType);
    let result: Awaited<ReturnType<typeof loadPdfSettings>>;
    if (cached && cached.expiresAt > now) {
      result = cached.data;
    } else {
      result = await withTimeout(loadPdfSettings(projectType), 8000, "pdf_settings");
      PDF_SETTINGS_CACHE.set(projectType, { type: projectType, data: result, expiresAt: now + SETTINGS_TTL_MS });
    }
    const { settings, steps } = result;
    if (settings) {
      INK = hexToRgb(settings.colorInk);
      BG = hexToRgb(settings.colorBg);
      ACCENT = hexToRgb(settings.colorAccent);
      LAVENDER = hexToRgb(settings.colorLavender);
      PDF_CONTENT = {
        logoUrl: settings.logoUrl,
        logoInverseUrl: settings.logoInverseUrl,
        coverImageUrl: settings.coverImageUrl,
        coverSubtitle: settings.coverSubtitle,
        whyBeevIntro: settings.whyBeevIntro,
        whyBeevBullets: settings.whyBeevBullets,
        validationConditions: settings.validationConditions,
        validationBpaText: settings.validationBpaText,
        validationBpaTitle: settings.validationBpaTitle,
        steps: steps.map((s) => ({
          n: s.stepNumber,
          title: s.title,
          summary: s.summary,
          duration: s.duration,
          beev: s.beevActions,
          client: s.clientActions,
        })),
      };
    }
  } catch (err) {
    console.error("Erreur chargement pdf_settings:", err);
    // En cas d'erreur, on garde les valeurs par défaut
  }
}

// Charge la police Roobert depuis public/fonts/ et l'enregistre dans le document.
// Si les fichiers ne sont pas disponibles, on retombe silencieusement sur Helvetica.
async function loadBrandFont(doc: jsPDF): Promise<string> {
  const toBase64 = (buf: ArrayBuffer): string => {
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };
  try {
    // Si la police a déjà été chargée pendant la session, on réutilise les
    // buffers en base64 mis en cache. Évite 2 requêtes réseau par PDF.
    if (!FONT_CACHE) {
      const [regBuf, sbBuf] = await withTimeout(
        Promise.all([
          fetch("/fonts/Roobert-Regular.ttf").then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("font regular HTTP " + r.status)))),
          fetch("/fonts/Roobert-SemiBold.ttf").then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("font semibold HTTP " + r.status)))),
        ]),
        8000,
        "fonts",
      );
      FONT_CACHE = { regularB64: toBase64(regBuf), semiBoldB64: toBase64(sbBuf) };
    }
    doc.addFileToVFS("Roobert-Regular.ttf", FONT_CACHE.regularB64);
    doc.addFont("Roobert-Regular.ttf", "Roobert", "normal");
    doc.addFileToVFS("Roobert-SemiBold.ttf", FONT_CACHE.semiBoldB64);
    doc.addFont("Roobert-SemiBold.ttf", "Roobert", "bold");
    return "Roobert";
  } catch (err) {
    // Le repli est volontaire (Helvetica plutôt qu'un PDF cassé), mais il
    // doit rester visible en console : sans ce log, un échec de chargement
    // de la police de marque passe totalement inaperçu.
    console.warn("[pdf] Police Roobert non chargée, repli sur Helvetica :", err);
    return "helvetica";
  }
}

// Cache + timeout pour les textes éditables (table pdf_texts).
async function loadTextsCached(): Promise<PdfTextMap> {
  const now = Date.now();
  if (TEXTS_CACHE && TEXTS_CACHE.expiresAt > now) return TEXTS_CACHE.data;
  try {
    const list = await withTimeout(loadPdfTexts(), 8000, "pdf_texts");
    const map = buildPdfTextMap(list);
    TEXTS_CACHE = { data: map, expiresAt: now + TEXTS_TTL_MS };
    return map;
  } catch (err) {
    console.warn("[pdf] pdf_texts fetch timed out, fallback hardcoded :", err);
    return new Map();
  }
}

// Cache + timeout pour les piliers d'engagement Beev (table beev_pillars).
async function loadPillarsCached(): Promise<BeevPillar[]> {
  const now = Date.now();
  if (PILLARS_CACHE && PILLARS_CACHE.expiresAt > now) return PILLARS_CACHE.data;
  try {
    const data = await withTimeout(loadBeevPillars(), 8000, "beev_pillars");
    PILLARS_CACHE = { data, expiresAt: now + PILLARS_TTL_MS };
    return data;
  } catch (err) {
    console.warn("[pdf] beev_pillars fetch timed out, fallback hardcoded :", err);
    return [];
  }
}

// Wrap fetchTcoResultsForVehicles avec cache + timeout court.
// La clé de cache est l'ensemble des IDs véhicules triés ; tant qu'on génère
// des PDF pour la même sélection, on réutilise le résultat sans re-fetcher.
async function fetchTcoResultsCached(
  vehicles: Array<{ id: string; brand: string; model: string }>,
): Promise<Map<string, TcoResult>> {
  if (vehicles.length === 0) return new Map();
  const key = vehicles.map((v) => v.id).sort().join("|");
  const now = Date.now();
  if (TCO_CACHE && TCO_CACHE.key === key && TCO_CACHE.expiresAt > now) {
    return TCO_CACHE.data;
  }
  try {
    const data = await withTimeout(fetchTcoResultsForVehicles(vehicles), 8000, "tco_results");
    TCO_CACHE = { key, data, expiresAt: now + TCO_TTL_MS };
    return data;
  } catch (err) {
    console.warn("[pdf] TCO fetch timed out, génération sans TCO :", err);
    return new Map();
  }
}

// Ordonne les véhicules pour l'affichage (fiches détaillées ET tableau
// DÉTAIL DES LOYERS) : regroupés par « groupe de comparaison », et au sein de
// chaque groupe le(s) véhicule(s) « flotte actuelle » d'abord, puis les
// propositions Beev par loyer croissant. Les groupes nommés conservent leur
// ordre d'apparition ; les véhicules sans groupe passent en dernier.
// Exemple : flotte actuelle 790€, A 789€, B 765€ (même groupe) → [flotte, B, A].
function orderVehiclesByGroup(vehicles: SelectedVehicle[]): SelectedVehicle[] {
  const groupOrder: string[] = [];
  const buckets = new Map<string, SelectedVehicle[]>();
  for (const sv of vehicles) {
    const g = (sv.comparisonGroup ?? "").trim() || "__nogroup__";
    if (!buckets.has(g)) { buckets.set(g, []); groupOrder.push(g); }
    buckets.get(g)!.push(sv);
  }
  // Groupes nommés en premier (ordre d'apparition), bucket sans groupe en
  // dernier — tri stable pour préserver l'ordre des groupes nommés.
  groupOrder.sort((a, b) => (a === "__nogroup__" ? 1 : 0) - (b === "__nogroup__" ? 1 : 0));
  const byLoyerAsc = (a: SelectedVehicle, b: SelectedVehicle) =>
    (a.negotiatedMonthly || Infinity) - (b.negotiatedMonthly || Infinity);
  const out: SelectedVehicle[] = [];
  for (const g of groupOrder) {
    const arr = buckets.get(g)!;
    const fleet = arr.filter((sv) => sv.vehicle.isCurrentFleet).sort(byLoyerAsc);
    const rest = arr.filter((sv) => !sv.vehicle.isCurrentFleet).sort(byLoyerAsc);
    out.push(...fleet, ...rest);
  }
  return out;
}

// ============ MAIN ============
export async function generateProposalPdf(opts: {
  projectType: ProjectType;
  client: ClientInfo;
  vehicles: SelectedVehicle[];
  chargers: SelectedCharger[];
  energy: EnergyParams;
  pdfConfig?: PdfDisplayConfig;
  /** Si fourni ET projet "home", insère la page TCO B2B2E dans le PDF. */
  b2b2eInput?: B2B2ECalculatorInput;
  /** Overrides textes par devis (éditeur WYSIWYG). Clés "scope:slug",
   *  valeurs string (text) ou string[] (list). Priorité max sur DB et
   *  fallback. Reset à null après la génération pour ne pas polluer les
   *  appels suivants. */
  textOverrides?: import("./pdf-texts").PdfTextOverrides | null;
  /** Si true, ouvre le PDF dans un nouvel onglet (aperçu) au lieu de le
   *  télécharger directement. */
  preview?: boolean;
  /** Compte admin : déverrouille les améliorations réservées (chiffrage en
   *  location, BPA propre à chaque type). */
  adminMode?: boolean;
  /** Langue du PDF généré. Défaut "fr" — comportement inchangé si omis.
   *  Périmètre actuel : pages véhicules uniquement (voir L() plus haut). */
  lang?: "fr" | "en";
}) {
  const { projectType, client, vehicles, chargers, energy, pdfConfig, b2b2eInput, textOverrides, preview } = opts;
  const cfg: PdfDisplayConfig = pdfConfig ?? DEFAULT_PDF_CONFIG;
  PDF_CFG = cfg; // expose la config pour les fonctions draw*
  ADMIN_MODE = !!opts.adminMode;
  PDF_LANG = opts.lang ?? "fr";
  PRODUCT_ACCENT = projectType === "home" ? PRODUCT_BLEU : projectType === "site" ? PRODUCT_VIOLET : PRODUCT_ROSE;
  // Active les overrides texte pour ce devis (priorité max dans lookupText
  // / lookupList). Reset en fin de fonction.
  setPdfTextOverrides(textOverrides ?? null);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  // Charge en parallèle : settings PDF, police, et résultats TCO depuis Supabase.
  // Le matching TCO est tolérant : ID exact OU (brand + model) pour gérer les
  // différences de nomenclature entre les 2 apps (tarif-master / beev-tco-2026).
  const vehiclesForTcoMatch = vehicles.map((sv) => ({
    id: sv.vehicle.id,
    brand: sv.vehicle.brand,
    model: sv.vehicle.model,
  }));
  await Promise.all([
    applyPdfSettings(projectType),
    loadBrandFont(doc).then((f) => { BRAND_FONT = f; }),
    fetchTcoResultsCached(vehiclesForTcoMatch).then((m) => { TCO_RESULTS = m; }),
    loadPillarsCached().then((p) => { PILLARS = p; }),
    loadTextsCached().then((t) => { TEXTS = t; }),
  ]);

  // Offre potentiellement combinée : on inclut TOUS les véhicules et TOUTES
  // les bornes sélectionnés, quel que soit projectType courant. Le commercial
  // peut donc construire une offre véhicules + bornes dans le même PDF.
  const v = vehicles;
  const c = chargers;
  // Détermine le type "dominant" pour les pages génériques (Pourquoi Beev,
  // Garanties, Parcours) en fonction de la sélection majoritaire.
  const hasVehicles = v.length > 0;
  const hasChargers = c.length > 0;
  const hasHome = c.some((sc) => sc.charger.deployment === "domicile");
  const hasSite = c.some((sc) => sc.charger.deployment === "site");
  // Type effectif : si véhicules dominants → vehicles, sinon le déploiement majoritaire
  const effectiveType: ProjectType = hasVehicles && !hasChargers
    ? "vehicles"
    : (!hasVehicles && hasHome && !hasSite)
      ? "home"
      : (!hasVehicles && hasSite && !hasHome)
        ? "site"
        : projectType; // par défaut : ce que le commercial a choisi en dernier

  // Préchargement du logo header (variante blanche officielle Beev) — utilisé
  // sur chaque page interne via drawHeader (placé dans un bandeau noir
  // arrondi). Priorité à la variante fond sombre paramétrée dans l'admin
  // (PDF_CONTENT.logoInverseUrl) : logoUrl seul (fond clair) n'a pas assez
  // de contraste ici. Puis repli sur les fichiers locaux, puis sur le texte
  // si rien ne charge.
  const headerLogoCandidates = [
    PDF_CONTENT.logoInverseUrl ?? undefined,
    "/images/logo-beev-white.png", // copie URL-safe (sans espaces) recommandée
    "/images/logo-beev-blanc.png",
    "/images/logo%20beev%20white.png",
    "/images/logo beev white.png",
  ].filter(Boolean) as string[];
  HEADER_LOGO = null;
  for (const url of headerLogoCandidates) {
    const img = await loadImage(url);
    if (!img) continue;
    // Si le logo est en PNG transparent, on le pré-aplatit sur fond noir
    // (la box du badge est INK). Sans ça, doc.addImage rend mal la
    // transparence et le logo disparaît visuellement.
    if (img.format === "PNG") {
      const flatUrl = await flattenPngToJpeg(img.dataUrl, img.w, img.h, INK);
      HEADER_LOGO = { dataUrl: flatUrl, w: img.w, h: img.h, format: "JPEG" };
    } else {
      HEADER_LOGO = img;
    }
    break;
  }

  // Logo header FONCÉ (en-tête admin v2, sur fond clair) : priorité au logo
  // paramétré dans l'admin (PDF_CONTENT.logoUrl), sinon logo noir local. Aplati
  // sur blanc pour les PNG transparents.
  HEADER_LOGO_DARK = null;
  const headerDarkCandidates = [PDF_CONTENT.logoUrl ?? undefined, "/images/logo-beev-noir.png", "/images/logo-beev.png"].filter(Boolean) as string[];
  for (const url of headerDarkCandidates) {
    const img = await loadImage(url);
    if (!img) continue;
    if (img.format === "PNG") {
      const flatUrl = await flattenPngToJpeg(img.dataUrl, img.w, img.h, [255, 255, 255]);
      HEADER_LOGO_DARK = { dataUrl: flatUrl, w: img.w, h: img.h, format: "JPEG" };
    } else {
      HEADER_LOGO_DARK = img;
    }
    break;
  }

  // Points de charge totaux du site (quantité de bornes × points par borne) —
  // même formule que « Synthèse projet » (aggregateSiteSpecs), pour que la
  // couverture et la synthèse ne se contredisent jamais sur ce chiffre.
  const sitePdcTotal = (() => {
    const specs = aggregateSiteSpecs(c);
    const totalUnits = c.reduce((s, sc) => s + (sc.quantity || 1), 0);
    return totalUnits * (specs.pointsParBorne ?? 1);
  })();
  await drawCover(doc, effectiveType, client, v.length, c.length, sitePdcTotal);

  // Pages dédiées 'rapport site' — pour les projets bornes site entreprise,
  // inspiré du rapport visite technique Château la Commaraine.
  // Suite : Vue d'ensemble + Synthèse projet + Infrastructure + Équipements
  // + Fiche produit, entre la couverture et 'Pourquoi Beev'.
  if (effectiveType === "site" && c.length > 0) {
    if (cfg.showSiteOverview) {
      doc.addPage();
      drawHeader(doc, client, effectiveType);
      drawSiteOverview(doc, client, c);
    }
    if (cfg.showSiteGuarantees) {
      doc.addPage();
      drawHeader(doc, client, effectiveType);
      drawSiteGuarantees(doc);
    }
    if (cfg.showSiteProjectSynthesis) {
      doc.addPage();
      drawHeader(doc, client, effectiveType);
      drawSiteProjectSynthesis(doc, client, c);
    }
    // « Travaux à réaliser » : pour un admin, on n'affiche PAS la page si aucune
    // ligne de travaux n'a été saisie (worksList vide), même si la case est cochée.
    const hasWorks = (aggregateSiteSpecs(c).worksList?.length ?? 0) > 0;
    if (cfg.showSiteInfrastructure && (!ADMIN_MODE || hasWorks)) {
      doc.addPage();
      drawHeader(doc, client, effectiveType);
      await drawSiteInfrastructure(doc, c);
    }
    if (cfg.showSiteEquipments) {
      doc.addPage();
      drawHeader(doc, client, effectiveType);
      drawSiteEquipments(doc, c);
    }
    if (cfg.showSiteProductSheet) {
      // Fiche produit par modèle unique de borne
      const uniqueChargers = new Map<string, typeof c[0]>();
      for (const sc of c) {
        const key = `${sc.charger.brand}-${sc.charger.model}`;
        if (!uniqueChargers.has(key)) uniqueChargers.set(key, sc);
      }
      for (const sc of uniqueChargers.values()) {
        doc.addPage();
        drawHeader(doc, client, effectiveType);
        await drawSiteProductSheet(doc, sc);
      }
    }
    if (cfg.showSiteSupervision) {
      // Page Supervision : Beev Connect ou Beev Home Charging selon le choix
      // du commercial dans le panneau droit (sc.siteSpecs.supervisionPlan).
      const supSpecs = c.map((sc) => sc.siteSpecs?.supervisionPlan).filter(Boolean) as string[];
      const supPlan = (supSpecs[0] as "beev_connect" | "beev_home_charging" | "none" | undefined);
      if (supPlan && supPlan !== "none") {
        doc.addPage();
        drawHeader(doc, client, effectiveType);
        drawSiteSupervision(doc, supPlan);
      }
    }
    // « Contrôles obligatoires et maintenance » : pour un admin, on n'affiche
    // PAS la page si rien n'est coché (ni bureau de contrôle, ni Consuel, ni
    // maintenance), même si la case est cochée dans le configurateur.
    const compl = aggregateSiteSpecs(c);
    const hasCompliance = compl.includeBureauControle === true || compl.includeConsuel === true || compl.includeMaintenance === true;
    if (cfg.showSiteCompliance && (!ADMIN_MODE || hasCompliance)) {
      doc.addPage();
      drawHeader(doc, client, effectiveType);
      drawSiteCompliance(doc, c);
    }
    // Page "Récapitulatif financier" supprimée sur demande utilisateur : le
    // total HT/TVA/TTC est déjà affiché sur la page "Options de paiement"
    // (drawSitePaymentOptions, plus bas), qui reste la seule source de prix
    // pour un déploiement site entreprise.
    // Paiement déplacé en fin de document, juste avant Journey
    // (cf. bloc plus bas dans cette fonction).
  }

  if (cfg.showWhyBeev) {
    doc.addPage();
    drawHeader(doc, client, effectiveType);
    drawWhyBeev(doc, effectiveType);
  }

  // Page « Synthèse flotte » — vue d'ensemble agrégée pour les grosses flottes.
  // Auto : dès ~10 véhicules au devis (somme des quantités) et toggle actif.
  // Placée en tête de la section véhicules (résumé exécutif), avant le détail.
  const fleetQty = v.reduce((s, sv) => s + Math.max(1, sv.quantity || 1), 0);
  if (cfg.showFleetSynthesis !== false && fleetQty >= 10 && v.length >= 2) {
    try {
      doc.addPage();
      drawHeader(doc, client, "vehicles");
      drawFleetSynthesis(doc, v, energy);
    } catch (e) { console.error("[pdf] synthèse flotte :", e); }
  }

  // Page comparateur véhicules (specs côte à côte) — placée AVANT les fiches
  // véhicule individuelles : le client voit d'abord la vue d'ensemble
  // comparative, puis le détail de chaque modèle. Toggleable, indépendante du
  // TCO. Affichée dès 2+ véhicules dans la sélection commerciale.
  if (cfg.showVehicleComparator && v.length >= 2) {
    // Groupes de comparaison granulaire : si le commercial a saisi des
    // valeurs dans « Groupe de comparaison » sur certaines cards, on
    // génère une slide PAR groupe (en plus de la slide globale qui
    // contient les véhicules sans groupe). Permet par exemple d'avoir
    // "Groupe Berlines" (1 actuelle + 2 EV) ET "Groupe SUV" (1 actuelle
    // + 2 EV) dans le même PDF.
    const groups = new Map<string, SelectedVehicle[]>();
    for (const sv of v) {
      const g = (sv.comparisonGroup ?? "").trim();
      if (!g) continue;
      const arr = groups.get(g) ?? [];
      arr.push(sv);
      groups.set(g, arr);
    }
    if (groups.size > 0) {
      // Une slide par groupe (titre = nom du groupe)
      for (const [groupName, groupVehicles] of groups.entries()) {
        if (groupVehicles.length < 2) continue;
        doc.addPage();
        drawHeader(doc, client, "vehicles");
        await drawVehicleComparator(doc, groupVehicles, groupName, client);
      }
      // Véhicules sans groupe : slide globale uniquement s'il y en a 2+
      const ungrouped = v.filter((sv) => !(sv.comparisonGroup ?? "").trim());
      if (ungrouped.length >= 2) {
        doc.addPage();
        drawHeader(doc, client, "vehicles");
        await drawVehicleComparator(doc, ungrouped, undefined, client);
      }
    } else {
      // Pas de groupes : comparateur global classique
      doc.addPage();
      drawHeader(doc, client, "vehicles");
      await drawVehicleComparator(doc, v, undefined, client);
    }
  }

  // Boucle véhicules : les fiches détaillées sont ordonnées par groupe de
  // comparaison (flotte actuelle d'abord, puis propositions Beev par loyer
  // croissant). Les fiches détaillées sont MASQUÉES par défaut (la vue
  // d'ensemble passe par le comparateur) : le commercial active séparément
  // « Fiche détaillée flotte actuelle » et « Fiche détaillée proposition Beev »
  // dans la configuration PDF.
  const vehiclesForDetail = orderVehiclesByGroup(v)
    .filter((sv) => sv.vehicle.isCurrentFleet ? cfg.showCurrentFleetVehicle : cfg.showProposalVehicle);
  for (let i = 0; i < vehiclesForDetail.length; i++) {
    doc.addPage();
    drawHeader(doc, client, effectiveType);
    await drawVehiclePage(doc, vehiclesForDetail[i], energy, i + 1, vehiclesForDetail.length, client, effectiveType);
  }

  // ─── ANALYSE TCO VÉHICULES — placée JUSTE APRÈS les fiches véhicule ───
  // Ordre voulu : devis véhicule → TCO véhicule → bornes B2B2E → TCO B2B2E →
  // bornes site. La mise en concurrence (véhicules) et les pages d'analyse TCO
  // suivent donc immédiatement le bloc véhicules, AVANT les bornes.
  // Slide « Mise en concurrence » — si au moins un véhicule a une offre
  // concurrente avec un loyer > 0.
  const withCompetitor = v.filter((sv) =>
    sv.competitorOffers && sv.competitorOffers.some((co) => co.monthlyTtc > 0),
  );
  if (cfg.showCompetitorComparison && withCompetitor.length > 0) {
    doc.addPage();
    drawHeader(doc, client, "vehicles");
    drawCompetitorComparison(doc, withCompetitor);
  }
  // Pages d'analyse TCO multi-véhicules, chacune activable indépendamment.
  // 1 véhicule avec includeTco suffit : la synthèse/détail garde son sens
  // (récap des composantes du coût) même sans comparaison à un second modèle.
  const tcoEligible = v.some((sv) => sv.includeTco);
  if (ADMIN_MODE) {
    // Page TCO FUSIONNÉE (admin) : bandeau d'impact + KPI + détail des
    // composantes sur une seule page (remplace le tableau de bord à barres).
    if ((cfg.showTcoComparison || cfg.showTcoDetailedTable) && tcoEligible) {
      doc.addPage();
      drawHeader(doc, client, "vehicles");
      // Si des groupes de comparaison apparient un véhicule ACTUEL avec des EV
      // proposés → vue « impact » (paires actuel → EV, économie mise en avant).
      // Sinon → vue synthèse & détail (classement + tableau).
      const gk = (sv: SelectedVehicle) => (sv.comparisonGroup ?? "").trim();
      const curGroups = new Set(v.filter((sv) => sv.vehicle.isCurrentFleet).map(gk).filter(Boolean));
      const hasPairs = v.some((sv) => !sv.vehicle.isCurrentFleet && curGroups.has(gk(sv)));
      if (hasPairs) await drawTcoImpact(doc, v, energy, client, "vehicles");
      else await drawTcoDetailedTable(doc, v, energy, client);
    }
  } else {
    if (cfg.showTcoComparison && tcoEligible) {
      doc.addPage();
      drawHeader(doc, client, "vehicles");
      await drawTcoDashboard(doc, v, energy, client, "vehicles");
    }
    if (cfg.showTcoDetailedTable && tcoEligible) {
      doc.addPage();
      drawHeader(doc, client, "vehicles");
      await drawTcoDetailedTable(doc, v, energy, client);
    }
  }
  if (cfg.showCarbonImpact && v.length >= 1) {
    doc.addPage();
    drawHeader(doc, client, "vehicles");
    drawCarbonImpact(doc, v, energy, client);
  }

  // Boucle bornes : on regroupe par deployment (domicile puis site).
  const chargersHome = c.filter((sc) => sc.charger.deployment === "domicile");
  const chargersSite = c.filter((sc) => sc.charger.deployment === "site");
  // Bornes DOMICILE (B2B2E) : présentation au choix du commercial —
  // comparateur (grille modèles), catalogue (forfait de base) ou les deux.
  // Remplace les fiches bornes détaillées sur ce parcours.
  if (chargersHome.length > 0) {
    const mode = cfg.b2b2eChargerMode ?? "both";
    // Chaque section est isolée : une erreur de rendu sur l'une ne doit pas
    // faire échouer toute la génération du PDF (page blanche / aucun aperçu).
    if (mode === "comparator" || mode === "both") {
      try {
        for (let i = 0; i < chargersHome.length; i += 4) {
          doc.addPage();
          drawHeader(doc, client, "home");
          await drawChargerComparatorB2B2E(doc, chargersHome.slice(i, i + 4), client);
        }
      } catch (e) { console.error("[pdf] comparateur bornes B2B2E :", e); }
      // Fiche produit par borne (format « fiche technique » Beev, même rendu que
      // les fiches officielles), à la suite du comparateur. Pas de bandeau noir :
      // la fiche dessine son propre fond beige + en-tête.
      const seenModels = new Set<string>();
      for (const sc of chargersHome) {
        const key = `${sc.charger.brand}-${sc.charger.model}`;
        if (seenModels.has(key)) continue; // une fiche par modèle unique
        seenModels.add(key);
        try {
          doc.addPage();
          await drawChargerProductSheet(doc, sc.charger, client);
        } catch (e) { console.error("[pdf] fiche produit borne :", key, e); }
      }
    }
    if (mode === "catalogue" || mode === "both") {
      // Catalogue = fiche détaillée par collaborateur (format complet : points
      // forts, présentation, chiffrage Total HT par collaborateur). hideFromPdf
      // exclut une borne de cette fiche sans la retirer du devis (chiffrage,
      // comparateur B2B2E, totaux) — numérotation "N / total" recalculée sur
      // les bornes effectivement affichées.
      const chargersHomeVisible = chargersHome.filter((sc) => !sc.hideFromPdf);
      for (let i = 0; i < chargersHomeVisible.length; i++) {
        try {
          doc.addPage();
          drawHeader(doc, client, "home");
          await drawChargerPage(doc, chargersHomeVisible[i], "home", i + 1, chargersHomeVisible.length, client);
        } catch (e) { console.error("[pdf] fiche borne collaborateur :", e); }
      }
    }
  }

  // Page TCO B2B2E (Bornes domicile) — incluse si projet "home", calculateur
  // activé côté UI, et au moins 1 borne domicile sélectionnée.
  if (b2b2eInput && chargersHome.length > 0 && cfg.showB2B2ETco !== false) {
    doc.addPage();
    drawHeader(doc, client, "home");
    drawB2B2ETco(doc, b2b2eInput);
  }

  // Slide Supervision Beev Home Charging (toggle PDF config) — activée
  // manuellement par le commercial dans la Configuration PDF du devis.
  if (cfg.showSupervisionHome) {
    doc.addPage();
    drawHeader(doc, client, "home");
    drawSiteSupervision(doc, "beev_home_charging");
  }
  // Kit collaborateur Beev Home Connect — opt-in, uniquement en supervision
  // domicile (parcours B2B2E avec bornes domicile).
  if (cfg.showHomeConnectKit && chargersHome.length > 0) {
    doc.addPage();
    drawHeader(doc, client, "home");
    drawHomeConnectKit(doc, client);
  }

  // hideFromPdf exclut une borne de sa fiche détaillée sans la retirer du
  // devis — numérotation "SITE N / total" recalculée sur les bornes
  // effectivement affichées.
  const chargersSiteVisible = chargersSite.filter((sc) => !sc.hideFromPdf);
  for (let i = 0; i < chargersSiteVisible.length; i++) {
    doc.addPage();
    drawHeader(doc, client, "site");
    await drawChargerPage(doc, chargersSiteVisible[i], "site", i + 1, chargersSiteVisible.length, client);
  }

  // Slide Supervision Beev Connect (site entreprise) — toggle PDF config.
  if (cfg.showSupervisionConnect) {
    doc.addPage();
    drawHeader(doc, client, "site");
    drawSiteSupervision(doc, "beev_connect");
  }

  // Page synthèse financière (toggleable)
  if (cfg.showFinancialSummary && (v.length > 0 || c.length > 0)) {
    doc.addPage();
    drawHeader(doc, client, effectiveType);
    drawFinancialSummary(doc, effectiveType, v, c);
  }

  // Page synthèse financière enrichie (KPI cards, économies vs concurrents,
  // TVS évitée, CO2 évité) — réservée aux projets véhicules
  if (cfg.showFinancialSynthesis && v.length > 0) {
    doc.addPage();
    drawHeader(doc, client, effectiveType);
    drawFinancialSynthesis(doc, v, energy);
  }

  // Page avantages fiscaux 2026 (réservée aux projets véhicules)
  if (cfg.showFiscalAdvantages && v.length > 0) {
    doc.addPage();
    drawHeader(doc, client, effectiveType);
    drawFiscalAdvantages(doc, v, energy);
  }

  // Page garanties & engagements (toggleable)
  if (cfg.showGuarantees) {
    doc.addPage();
    drawHeader(doc, client, effectiveType);
    drawGuarantees(doc, effectiveType);
  }

  // Options de paiement (mode site) : déplacée ici sur demande utilisateur
  // pour être l'AVANT-DERNIÈRE page utile, juste avant le parcours client.
  if (effectiveType === "site" && c.length > 0 && cfg.showSitePaymentOptions) {
    doc.addPage();
    drawHeader(doc, client, effectiveType);
    drawSitePaymentOptions(doc, c, client);
  }

  // Parcours client (toggleable) — dernière page avant le BPA
  if (cfg.showJourney) {
    doc.addPage();
    drawHeader(doc, client, effectiveType);
    drawJourney(doc, effectiveType, client);
  }

  // Executive summary "EN BREF" (toggleable, avant-dernière page)
  if (cfg.showExecutiveSummary && (v.length > 0 || c.length > 0)) {
    doc.addPage();
    drawHeader(doc, client, effectiveType);
    drawExecutiveSummary(doc, effectiveType, client, v, c, energy);
  }

  if (cfg.showValidation) {
    doc.addPage();
    drawHeader(doc, client, effectiveType);
    drawValidation(doc, effectiveType, client);
  }

  // Légende couleurs / symboles — toute dernière page didactique
  if (cfg.showLegend) {
    doc.addPage();
    drawHeader(doc, client, effectiveType);
    drawLegend(doc);
  }

  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    drawFooter(doc, client, i, pages);
  }

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "client";
  const tag = projectType === "vehicles" ? "Vehicules" : projectType === "home" ? "Bornes_Domicile" : "Bornes_Site";
  const fileName = `Beev_${tag}_${safe(client.company)}_${client.date.replace(/\//g, "-")}.pdf`;
  if (preview) {
    // Aperçu : ouvre le PDF dans un nouvel onglet sans télécharger.
    try {
      const url = doc.output("bloburl");
      window.open(url as unknown as string, "_blank");
    } catch {
      doc.save(fileName); // repli si l'ouverture est bloquée
    }
  } else {
    doc.save(fileName);
  }
  // Reset des overrides texte pour ne pas polluer les générations suivantes
  // (un même processus peut générer plusieurs PDF pour plusieurs clients).
  setPdfTextOverrides(null);
}

// ============ COVER ============
// Refonte selon design Claude/Beev :
// - Fond noir #1D1D1D, beige #FCF9F2 pour les textes
// - Top : logo (placeholder texte "Beev") + meta "OFFRE COMMERCIALE / date" à droite
// - Centre : kicker tagline, H1 58px "Beev × Client" avec × en rose F4B8AA,
//   sous-titre, chip pill "Devis ... · Validité 30 jours"
// - Bottom : 3 colonnes "Préparée pour / par / Périmètre" séparées par bordure top
// - Footer : "Document confidentiel" / "Réf devis · contact"
// Couverture v2 (rebrand charte Beev, réservée admin) : fond beige, carte héro
// noire avec couleur d'accent par produit (voiture rose · domicile bleu · site
// violet), eyebrow, chip client, grand titre éditorial, filet d'accent, chips,
// puis bloc méta (préparée pour/par) + mentions légales.
async function drawCoverV2(doc: jsPDF, type: ProjectType, c: ClientInfo, nbV: number, nbC: number, sitePdcTotal: number) {
  const ROSE: [number, number, number] = [244, 184, 170];
  const BLEU: [number, number, number] = [165, 210, 255];
  const VIOLET: [number, number, number] = [211, 204, 216];
  const isCombined = nbV > 0 && nbC > 0;
  const acc = isCombined ? ROSE : type === "vehicles" ? ROSE : type === "home" ? BLEU : VIOLET;
  const W = PAGE_W - M * 2;

  doc.setFillColor(...BG);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Logo Beev foncé (sur fond beige) — repli wordmark.
  let logoLoaded = false;
  for (const url of [PDF_CONTENT.logoUrl ?? undefined, "/images/logo-beev-noir.png", "/images/logo-beev.png"].filter(Boolean) as string[]) {
    try { await drawImageContain(doc, url, M, 44, 92, 28, BG); logoLoaded = true; break; } catch { /* suivant */ }
  }
  if (!logoLoaded) {
    doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(18); doc.setTextColor(...INK);
    doc.text("Beev", M, 66);
  }
  doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(8); doc.setTextColor(...SUB);
  doc.text(L("PROPOSITION COMMERCIALE", "BUSINESS PROPOSAL"), PAGE_W - M, 60, { align: "right" });

  const eyebrow = isCombined ? L("PROPOSITION · MULTI-PRODUITS", "PROPOSAL · MULTI-PRODUCT")
    : type === "vehicles" ? L("PROPOSITION · FLOTTE VÉHICULES", "PROPOSAL · VEHICLE FLEET")
    : type === "home" ? L("RECHARGE DOMICILE · B2B2E", "HOME CHARGING · B2B2E")
    : L("INFRASTRUCTURE DE RECHARGE · SITE", "CHARGING INFRASTRUCTURE · SITE");
  const headline = isCombined ? (PDF_LANG === "en" ? ["Your electric", "transition, end to end."] : ["Votre transition", "électrique, clé en main."])
    : type === "vehicles" ? (PDF_LANG === "en" ? ["Electrify your fleet,", "without the complexity."] : ["Électrifier votre flotte,", "sans la complexité."])
    : type === "home" ? ["La recharge chez", "vos collaborateurs."]
    : ["Électrifier", "vos sites."];
  const total = isCombined ? nbV + nbC : type === "vehicles" ? nbV : nbC;
  const subtitle = isCombined ? L(
      "Véhicules électriques, bornes de recharge et pilotage. Un interlocuteur unique, de la sélection à la mise en route.",
      "Electric vehicles, charging stations and fleet management. One single point of contact, from selection to rollout.",
    )
    : type === "vehicles" ? L(
      "Véhicules électriques multimarques, financement LLD négocié et accompagnement de A à Z par un interlocuteur unique.",
      "Multi-brand electric vehicles, negotiated long-term lease financing, and end-to-end support from a single point of contact.",
    )
    : type === "home" ? "Kit clé en main installé au domicile, supervision Beev Home Charging et remboursement automatisé de l'énergie professionnelle."
    : "Étude de site, matériel premium, pose IRVE certifiée, génie civil, mise en service OCPP et supervision Beev Connect.";
  const chips = isCombined ? [L(`${nbV} véhicule${nbV > 1 ? "s" : ""}`, `${nbV} vehicle${nbV > 1 ? "s" : ""}`), L(`${nbC} borne${nbC > 1 ? "s" : ""}`, `${nbC} charger${nbC > 1 ? "s" : ""}`), L("Offre combinée", "Combined offer")]
    : type === "vehicles" ? [L(`${total} véhicule${total > 1 ? "s" : ""}`, `${total} vehicle${total > 1 ? "s" : ""}`), L("Location longue durée", "Long-term lease"), L("Multimarque", "Multi-brand")]
    : type === "home" ? [`${total} collaborateur${total > 1 ? "s" : ""}`, "Installation IRVE", "Supervision"]
    // Points de charge = quantité de bornes × points par borne (même calcul
    // que « Synthèse projet »), pas le nombre de bornes lui-même — une borne
    // double sur 2 unités = 4 points, pas 2. Repéré via un devis 2 bornes
    // doubles affichant « 1 point de charge » ici alors que la synthèse
    // affichait correctement « 4 PDC ».
    : [`${sitePdcTotal} point${sitePdcTotal > 1 ? "s" : ""} de charge`, "Pose IRVE", "Mise en service OCPP"];

  // Carte héro noire
  const hy = 150, hh = 420, ix = M + 28;
  doc.setFillColor(...INK);
  doc.roundedRect(M, hy, W, hh, 18, 18, "F");
  doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(9); doc.setTextColor(...acc);
  doc.text(eyebrow, ix, hy + 36);
  // Chip client
  const company = c.company || "Votre entreprise";
  doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(12);
  const cw = doc.getTextWidth(company) + 34;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(ix, hy + 50, cw, 24, 8, 8, "F");
  doc.setFillColor(...acc);
  doc.circle(ix + 14, hy + 62, 4, "F");
  doc.setTextColor(...INK);
  doc.text(company, ix + 24, hy + 66);
  // Titre
  doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(34); doc.setTextColor(...BG);
  const ty = hy + 126;
  headline.forEach((l, i) => doc.text(l, ix, ty + i * 38));
  const tEnd = ty + (headline.length - 1) * 38;
  // Filet d'accent
  doc.setFillColor(...acc);
  doc.rect(ix, tEnd + 22, 48, 4, "F");
  // Sous-titre
  doc.setFont(BRAND_FONT, "normal"); doc.setFontSize(12); doc.setTextColor(206, 206, 206);
  const subL = doc.splitTextToSize(subtitle, W * 0.82) as string[];
  doc.text(subL, ix, tEnd + 48);
  // Chips
  let cy = tEnd + 48 + subL.length * 15 + 16;
  let cx = ix;
  doc.setFont(BRAND_FONT, "normal"); doc.setFontSize(10);
  for (const chip of chips) {
    const pw = doc.getTextWidth(chip) + 22;
    doc.setDrawColor(120, 118, 112); doc.setLineWidth(0.8);
    doc.roundedRect(cx, cy, pw, 22, 11, 11, "S");
    doc.setTextColor(...BG);
    doc.text(chip, cx + 11, cy + 15);
    cx += pw + 8;
  }

  // Bloc méta (sur beige)
  const now = new Date();
  const ref = `BEEV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  let by = hy + hh + 34;
  doc.setFont(BRAND_FONT, "normal"); doc.setFontSize(8.5); doc.setTextColor(...SUB);
  doc.text(`${L("Devis", "Quote")} ${ref}  ·  ${lookupText(TEXTS, "common", "cover_validity", L("Validité 30 jours à compter de l'émission", "Valid for 30 days from the issue date"))}`, M, by);
  by += 14;
  doc.setDrawColor(...RULE); doc.setLineWidth(0.6);
  doc.line(M, by, PAGE_W - M, by);
  by += 22;
  const colW = W / 2;
  doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(8); doc.setTextColor(...ACCENT_TEXT);
  doc.text(lookupText(TEXTS, "common", "cover_prepared_for_label", L("PRÉPARÉE POUR", "PREPARED FOR")), M, by);
  doc.text(lookupText(TEXTS, "common", "cover_prepared_by_label", L("PRÉPARÉE PAR", "PREPARED BY")), M + colW, by);
  doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(13); doc.setTextColor(...INK);
  doc.text((company).slice(0, 40), M, by + 18);
  doc.text((c.salesRep || "Beev").slice(0, 40), M + colW, by + 18);
  doc.setFont(BRAND_FONT, "normal"); doc.setFontSize(9.5); doc.setTextColor(...SUB);
  doc.text(lookupText(TEXTS, "common", "cover_tagline", L("Le copilote de l'électrification des flottes · beev.co", "The all-in-one copilot for fleet electrification · beev.co")), M, by + 44);

  doc.setFontSize(8); doc.setTextColor(...SUB);
  doc.text(L(
    "Beev · 5 rue Pleyel, 93200 Saint-Denis · SAS au capital de 63 245,02 € · RCS Bobigny 851 682 807",
    "Beev · 5 rue Pleyel, 93200 Saint-Denis, France · SAS with share capital of €63,245.02 · RCS Bobigny 851 682 807",
  ), PAGE_W / 2, PAGE_H - 34, { align: "center" });
}

async function drawCover(doc: jsPDF, type: ProjectType, c: ClientInfo, nbV: number, nbC: number, sitePdcTotal: number) {
  // Rebrand v2 réservé aux comptes admin (le reste de la gamme suit page à page).
  if (ADMIN_MODE) { await drawCoverV2(doc, type, c, nbV, nbC, sitePdcTotal); return; }
  // Charte officielle Beev — couleurs synchronisées avec pdf_settings (admin)
  // INK     = colorInk    (texte principal, #111111 par défaut)
  // BG      = colorBg     (fond cream, #FCF9F2 par défaut)
  // LAVENDER = colorLavender (accent primaire, #3809EA)
  // ACCENT  = colorAccent  (vert Beev, #35DA76)
  // Toute modification dans /admin/pdf > Apparence se répercute ici.
  const GREY_LABEL: [number, number, number] = [154, 150, 142];
  const GREY_LINE: [number, number, number] = [183, 180, 172];
  const GREY_FOOT: [number, number, number] = [118, 115, 108];

  // Fond pleine page : utilise INK (noir admin) — l'admin peut basculer
  // sur une autre couleur via /admin/pdf > Apparence
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Logo Beev en haut gauche — cette couverture a un fond NOIR plein page,
  // donc priorité à la variante fond sombre (PDF_CONTENT.logoInverseUrl,
  // alimentée par pdf_settings.logo_dark_bg_url). logoUrl seul (pensé pour
  // fond clair) devenait illisible ici. Fallback sur les fichiers locaux
  // dans public/images/ pour les variations de nommage (espace, accent,
  // langue). Le premier qui charge gagne.
  const logoCandidates = [
    PDF_CONTENT.logoInverseUrl ?? undefined,
    "/images/logo-beev-blanc.png",
    "/images/logo-beev-white.png",
    "/images/logo%20beev%20white.png",
    "/images/logo beev white.png",
    "/images/logo-beev.png",
  ].filter(Boolean) as string[];
  let logoLoaded = false;
  for (const url of logoCandidates) {
    try {
      // bg=INK : aplatit la transparence sur fond noir (la cover a un fond
      // noir pleine page), sinon un PNG blanc transparent devient invisible
      // car flattenPngToJpeg utilise cream par défaut.
      await drawImageContain(doc, url, M, 50, 120, 70, INK);
      logoLoaded = true;
      break;
    } catch {
      // Essai suivant
    }
  }
  if (!logoLoaded) {
    doc.setTextColor(...BG);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(22);
    doc.text("Beev", M, 80);
  }

  // Image de couverture uploadée par le commercial dans /admin/pdf
  // (pdf_settings.cover_image_url → PDF_CONTENT.coverImageUrl). Placée en
  // haut à droite de la cover, dans une zone 240×180. Si absente, on saute
  // — la cover reste lisible sans visuel.
  if (PDF_CONTENT.coverImageUrl) {
    const coverImgW = 240;
    const coverImgH = 180;
    const coverImgX = PAGE_W - M - coverImgW;
    const coverImgY = 50;
    try {
      // bg=INK : fond noir derrière les zones transparentes pour préserver
      // la cohérence visuelle avec le fond de la cover.
      await drawImageContain(doc, PDF_CONTENT.coverImageUrl, coverImgX, coverImgY, coverImgW, coverImgH, INK);
    } catch {
      // image non chargée — non bloquant, la cover reste valide
    }
  }

  // Référence devis générée automatiquement : BEEV-AAAA-MMJJ-HHMM
  const now = new Date();
  const ref = `BEEV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  // ─── CENTER : kicker + H1 client + sous-titre périmètre ───
  const isCombinedOffer = nbV > 0 && nbC > 0;

  // Kicker
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...LAVENDER);
  const kicker = isCombinedOffer
    ? L("PROPOSITION COMMERCIALE · MULTI-PRODUITS", "BUSINESS PROPOSAL · MULTI-PRODUCT")
    : type === "vehicles" ? L("PROPOSITION COMMERCIALE · FLOTTE VÉHICULES", "BUSINESS PROPOSAL · VEHICLE FLEET")
    : type === "home" ? "PROPOSITION COMMERCIALE · BORNES DOMICILE"
    : "PROPOSITION COMMERCIALE · BORNES SITE";
  doc.text(kicker, M, 260);

  // H1 client en très gros — découpé en lignes si trop long
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(54);
  doc.setTextColor(...BG);
  const h1 = (c.company || "Votre entreprise").toUpperCase();
  const h1Lines = doc.splitTextToSize(h1, PAGE_W - M * 2);
  let h1Y = 310;
  h1Lines.slice(0, 2).forEach((line: string, i: number) => {
    doc.text(line, M, h1Y + i * 58);
  });
  const h1End = h1Y + (Math.min(h1Lines.length, 2) - 1) * 58;

  // Séparateur lavande
  const sepY = h1End + 35;
  doc.setFillColor(...LAVENDER);
  doc.rect(M, sepY, 40, 3, "F");

  // Sous-titre périmètre
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(16);
  doc.setTextColor(...BG);
  const total = isCombinedOffer ? nbV + nbC : (type === "vehicles" ? nbV : nbC);
  const sub = isCombinedOffer
    ? L(`Offre combinée : ${nbV} véhicule${nbV > 1 ? "s" : ""} et ${nbC} borne${nbC > 1 ? "s" : ""} de recharge`, `Combined offer: ${nbV} vehicle${nbV > 1 ? "s" : ""} and ${nbC} charging station${nbC > 1 ? "s" : ""}`)
    : type === "vehicles"
    ? L(`${total} véhicule${total > 1 ? "s" : ""} électrique${total > 1 ? "s" : ""} en location longue durée`, `${total} electric vehicle${total > 1 ? "s" : ""} on long-term lease`)
    : type === "home"
    ? `Kit clé en main pour ${total} collaborateur${total > 1 ? "s" : ""} équipé${total > 1 ? "s" : ""} au domicile`
    : `Déploiement IRVE pour ${total} site${total > 1 ? "s" : ""} entreprise`;
  doc.text(sub, M, sepY + 32);

  // Tagline marketing (plus discrète, en bas du bloc center)
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GREY_LABEL);
  doc.text(
    lookupText(TEXTS, "common", "cover_tagline", L("Le copilote de l'électrification des flottes · beev.co", "The all-in-one copilot for fleet electrification · beev.co")),
    M,
    sepY + 60,
  );

  // ─── BOTTOM : ligne réf devis + 2 colonnes Préparée pour / par ───
  const cardsY = PAGE_H - 180;
  // Mini-ligne avec réf devis et validité (visible avant le footer ultra-discret)
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY_LABEL);
  doc.text(`${L("Devis", "Quote")} ${ref}  ·  ${lookupText(TEXTS, "common", "cover_validity", L("Validité 30 jours à compter de l'émission", "Valid for 30 days from the issue date"))}`, M, cardsY - 16);

  doc.setDrawColor(70, 67, 62);
  doc.setLineWidth(0.5);
  doc.line(M, cardsY, PAGE_W - M, cardsY);

  const colWidth = (PAGE_W - M * 2) / 2;
  const labelY = cardsY + 24;
  const nameY = cardsY + 48;
  const lineY = cardsY + 68;

  // Col 1 : Préparée pour
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...LAVENDER);
  doc.text(lookupText(TEXTS, "common", "cover_prepared_for_label", L("PRÉPARÉE POUR", "PREPARED FOR")), M, labelY);
  doc.setFont(BRAND_FONT, "bold");
  // La raison sociale peut être longue au point de déborder sur la colonne
  // « Préparée par » (ex. « AALBERTS SURFACE TECHNOLOGIE (AMBOISE) »
  // chevauchant le nom du commercial). splitTextToSize seul ne suffisait pas
  // (marge de sécurité insuffisante entre les 2 colonnes) : on réduit la
  // police si la ligne la plus large dépasse encore la largeur dispo, puis on
  // limite à 2 lignes avec troncature (…) plutôt que de laisser déborder.
  const col1MaxW = colWidth - 30;
  let companyFontSize = 13;
  doc.setFontSize(companyFontSize);
  let companyLines = doc.splitTextToSize(c.company || "—", col1MaxW) as string[];
  while (companyFontSize > 9 && companyLines.some((l) => doc.getTextWidth(l) > col1MaxW)) {
    companyFontSize -= 0.5;
    doc.setFontSize(companyFontSize);
    companyLines = doc.splitTextToSize(c.company || "—", col1MaxW) as string[];
  }
  if (companyLines.length > 2) {
    let last = companyLines[1];
    while (last.length > 4 && doc.getTextWidth(last + "…") > col1MaxW) last = last.slice(0, -1);
    companyLines = [companyLines[0], last + "…"];
  }
  doc.setTextColor(...BG);
  const NAME_LINE_H = 15;
  doc.text(companyLines, M, nameY);
  const contactY = nameY + (companyLines.length - 1) * NAME_LINE_H + (lineY - nameY);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GREY_LINE);
  if (c.contact) doc.text(c.contact, M, contactY);
  if (c.email) doc.text(c.email, M, contactY + 14);

  // Col 2 : Préparée par
  const col2X = M + colWidth + 10;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...LAVENDER);
  doc.text(lookupText(TEXTS, "common", "cover_prepared_by_label", L("PRÉPARÉE PAR", "PREPARED BY")), col2X, labelY);
  doc.setFont(BRAND_FONT, "bold");
  // Même garde-fou côté commercial : évite un débordement en bord de page
  // pour un nom long.
  const col2MaxW = PAGE_W - M - col2X;
  let salesRepFontSize = 13;
  let salesRepText = c.salesRep || "Beev";
  doc.setFontSize(salesRepFontSize);
  while (salesRepFontSize > 9 && doc.getTextWidth(salesRepText) > col2MaxW) {
    salesRepFontSize -= 0.5;
    doc.setFontSize(salesRepFontSize);
  }
  if (doc.getTextWidth(salesRepText) > col2MaxW) {
    while (salesRepText.length > 4 && doc.getTextWidth(salesRepText + "…") > col2MaxW) salesRepText = salesRepText.slice(0, -1);
    salesRepText += "…";
  }
  doc.setTextColor(...BG);
  doc.text(salesRepText, col2X, nameY);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GREY_LINE);
  if (c.salesRepEmail) doc.text(c.salesRepEmail, col2X, lineY);
  if (c.salesRepPhone) doc.text(c.salesRepPhone, col2X, lineY + 14);

  // ─── FOOTER (cover-foot) ───
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...GREY_FOOT);
  doc.text(
    lookupText(TEXTS, "common", "footer_confidential", L("DOCUMENT CONFIDENTIEL · USAGE INTERNE CLIENT", "CONFIDENTIAL DOCUMENT · CLIENT INTERNAL USE")),
    M,
    PAGE_H - 30,
  );
  const refText = `${L("Réf.", "Ref.")} ${ref} · contact@beev.co`;
  doc.text(refText, PAGE_W - M, PAGE_H - 30, { align: "right" });
  // Lien cliquable sur la mention email du footer couverture
  const refW = doc.getTextWidth(refText);
  doc.link(PAGE_W - M - refW, PAGE_H - 36, refW, 10, { url: "mailto:contact@beev.co" });
}

// ============ POURQUOI BEEV (varie par type) ============
// ============ RAPPORT SITE — VUE D'ENSEMBLE ============
// Page d'ouverture du rapport pour projets bornes site entreprise, inspirée
// du rapport visite technique Château la Commaraine. Affiche en 2 colonnes :
// à gauche les caractéristiques projet (Client, Site, Secteur, Nb bornes,
// Type d'installation, Usage, Supervision, Délai), à droite les contacts
// Beev (chargé d'affaires + référent technique).
// Agrège les SiteSpecs de toutes les bornes sélectionnées en un seul objet.
// Prend la première valeur définie pour chaque champ. Travaux et supervision
// pris depuis la première borne qui les définit.
function aggregateSiteSpecs(chargers: SelectedCharger[]): SiteSpecs {
  const merged: SiteSpecs = {};
  for (const sc of chargers) {
    const s = sc.siteSpecs;
    if (!s) continue;
    if (!merged.sector && s.sector) merged.sector = s.sector;
    if (!merged.installationType && s.installationType) merged.installationType = s.installationType;
    if (!merged.usage && s.usage) merged.usage = s.usage;
    if (!merged.estimatedDelay && s.estimatedDelay) merged.estimatedDelay = s.estimatedDelay;
    if (!merged.edfPower && s.edfPower) merged.edfPower = s.edfPower;
    if (!merged.distanceTgbt && s.distanceTgbt) merged.distanceTgbt = s.distanceTgbt;
    if (!merged.locationDescription && s.locationDescription) merged.locationDescription = s.locationDescription;
    if (!merged.tgbtRoom && s.tgbtRoom) merged.tgbtRoom = s.tgbtRoom;
    if (!merged.worksList && s.worksList && s.worksList.length > 0) merged.worksList = s.worksList;
    if (!merged.cable22Type && s.cable22Type) merged.cable22Type = s.cable22Type;
    if (!merged.cable74Type && s.cable74Type) merged.cable74Type = s.cable74Type;
    if (merged.pointsParBorne === undefined && s.pointsParBorne) merged.pointsParBorne = s.pointsParBorne;
    // Flags d'inclusion : sémantique OU sur toutes les instances. Si le
    // commercial a coché l'option sur AU MOINS UNE borne du devis, elle
    // s'affiche (et le coût éventuel est compté une fois). Évite qu'une
    // instance dupliquée avec le flag à false écrase le true d'une autre.
    if (s.includeMaintenance) merged.includeMaintenance = true;
    if (!merged.chantierPhotos && s.chantierPhotos && s.chantierPhotos.length > 0) merged.chantierPhotos = s.chantierPhotos;
    if (!merged.tvaRate && s.tvaRate) merged.tvaRate = s.tvaRate;
    if (s.includeBureauControle) merged.includeBureauControle = true;
    if (s.includeConsuel) merged.includeConsuel = true;
    if (!merged.supervisionPlan && s.supervisionPlan) merged.supervisionPlan = s.supervisionPlan;
  }
  return merged;
}

function drawSiteOverview(doc: jsPDF, client: ClientInfo, chargers: SelectedCharger[]) {
  const BLACK: [number, number, number] = [29, 29, 29];
  const BEIGE_BG: [number, number, number] = [252, 249, 242];
  const PINK: [number, number, number] = [244, 184, 170]; // accent rose Beev

  let y = 116;
  // Eyebrow
  doc.setFillColor(...PINK);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(lookupText(TEXTS, "site", "site_overview_eyebrow", "1 · VUE D'ENSEMBLE"), M + 30, y - 4);
  y += 14;

  // Title
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(28);
  doc.setTextColor(...INK);
  doc.text(lookupText(TEXTS, "site", "site_overview_title", "Votre projet de recharge en un coup d'œil"), M, y + 18);
  y += 50;

  // Intro
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const intro = lookupText(TEXTS, "common", "overview_intro", "Ce rapport détaille la solution technique, les équipements, le planning et le budget pour l'installation de votre infrastructure de recharge.");
  const introL = doc.splitTextToSize(intro, PAGE_W - M * 2);
  doc.text(introL, M, y);
  y += introL.length * 13 + 26;

  // 2 colonnes : gauche = specs, droite = contacts Beev
  const colW = (PAGE_W - M * 2 - 24) / 2;
  const leftX = M;
  const rightX = M + colW + 24;

  // Calculs des champs synthétiques
  const totalChargers = chargers.reduce((s, sc) => s + sc.quantity, 0);
  const uniqueModels = new Set(chargers.map((sc) => `${sc.charger.brand} ${sc.charger.model}`));
  const modelsSummary = Array.from(uniqueModels).slice(0, 2).join(", ") + (uniqueModels.size > 2 ? "..." : "");
  // Points de charge par borne (1 = simple, 2 = double), pas le nombre de
  // bornes achetées (déjà affiché séparément sous "Nombre de bornes").
  const powerBreakdown = chargers.map((sc) => `${sc.chargePoints ?? 1} × ${sc.charger.powerKw} kW`).join(" + ");

  // === Colonne gauche : caractéristiques projet ===
  // Toutes les valeurs sont surchargeables via sc.siteSpecs (champs admin
  // par borne renseignés dans le panneau droit en mode site).
  const specs = aggregateSiteSpecs(chargers);
  const rows = [
    { label: "Client", value: client.company || "—" },
    { label: "Site", value: chargers[0]?.siteAddress || "—" },
    { label: "Secteur", value: specs.sector || "—" },
    { label: "Nombre de bornes", value: `${totalChargers} ${modelsSummary ? `· ${modelsSummary}` : ""}` },
    { label: "Puissance bornes", value: powerBreakdown || "—" },
    { label: "Type d'installation", value: specs.installationType || (chargers.some((sc) => sc.charger.deployment === "site") ? "Parking, site entreprise" : "—") },
    { label: "Usage", value: specs.usage || "Collaborateurs et visiteurs" },
    { label: "Supervision", value: specs.supervisionPlan === "beev_connect" ? "Beev Connect (site entreprise)" : specs.supervisionPlan === "beev_home_charging" ? "Beev Home Charging (B2B2E)" : "À définir" },
    { label: "Délai estimé", value: specs.estimatedDelay || "3 à 5 semaines après signature du devis" },
  ];

  let ly = y;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.4);
  // Hauteur minimum de row uniforme pour garantir l'alignement vertical
  // (label baseline + valeur + filet à hauteurs cohérentes même si la valeur
  // tient sur 1 seule ligne).
  const ROW_MIN_H = 36;
  rows.forEach((row) => {
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUB);
    doc.text(row.label, leftX, ly);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    const valLines = doc.splitTextToSize(row.value, colW - 4).slice(0, 2);
    doc.text(valLines, leftX, ly + 14);
    // Avance Y = max entre la hauteur calculée et la hauteur min (36px)
    const advance = Math.max(ROW_MIN_H, 14 + valLines.length * 12 + 10);
    ly += advance;
    doc.line(leftX, ly - 6, leftX + colW - 8, ly - 6);
  });

  // === Colonne droite : contacts Beev (card noire) ===
  // Hauteur de la card alignée sur la hauteur de la colonne gauche (ly - y)
  // pour avoir 2 colonnes de même hauteur visuelle.
  doc.setFillColor(...BLACK);
  const contactCardH = Math.max(180, ly - y);
  doc.roundedRect(rightX, y, colW, contactCardH, 8, 8, "F");

  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...PINK);
  doc.text(lookupText(TEXTS, "common", "overview_contacts_title", "VOS CONTACTS BEEV"), rightX + 16, y + 22);

  // Chargé d'affaires (commercial) — nom en gros, rôle en petit
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BEIGE_BG);
  doc.text(client.salesRep || "—", rightX + 16, y + 46, { maxWidth: colW - 32 });
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(200, 200, 200);
  doc.text(lookupText(TEXTS, "common", "overview_contact1_role", "Chargé d'affaires"), rightX + 16, y + 60);
  doc.setFontSize(9);
  doc.setTextColor(...BEIGE_BG);
  let contact1Y = y + 76;
  if (client.salesRepEmail) { doc.text(client.salesRepEmail, rightX + 16, contact1Y, { maxWidth: colW - 32 }); contact1Y += 12; }
  if (client.salesRepPhone) { doc.text(client.salesRepPhone, rightX + 16, contact1Y); contact1Y += 12; }

  // Séparateur
  const sepY = Math.max(contact1Y + 6, y + 108);
  doc.setDrawColor(70, 67, 62);
  doc.line(rightX + 16, sepY, rightX + colW - 16, sepY);

  // Référent technique — nom en gros, rôle en petit (cohérent avec contact 1)
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BEIGE_BG);
  doc.text(lookupText(TEXTS, "common", "overview_contact2_team", "Équipe IRVE Beev"), rightX + 16, sepY + 24, { maxWidth: colW - 32 });
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(200, 200, 200);
  doc.text(lookupText(TEXTS, "common", "overview_contact2_role", "Référent technique"), rightX + 16, sepY + 38);
  doc.setFontSize(9);
  doc.setTextColor(...BEIGE_BG);
  doc.text("contact@beev.co", rightX + 16, sepY + 56);
}

// ============ RAPPORT SITE — SYNTHÈSE PROJET ============
// Page lecture rapide du chantier inspirée de Château la Commaraine. Présente
// les specs clés sous forme de bandeau horizontal + table de caractéristiques
// techniques chiffrées.
function drawSiteProjectSynthesis(doc: jsPDF, client: ClientInfo, chargers: SelectedCharger[]) {
  const PINK: [number, number, number] = [244, 184, 170];

  let y = 116;
  doc.setFillColor(...PINK);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(lookupText(TEXTS, "site", "site_synthesis_eyebrow", "2 · SYNTHÈSE PROJET"), M + 30, y - 4);
  y += 14;

  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(28);
  doc.setTextColor(...INK);
  doc.text(lookupText(TEXTS, "site", "site_synthesis_title", "Une lecture rapide du chantier"), M, y + 18);
  y += 50;

  const totalChargers = chargers.reduce((s, sc) => s + sc.quantity, 0);
  const breakdown = chargers.map((sc) => `${sc.quantity} × ${sc.charger.powerKw} kW`).join(" + ");
  const hasHighPower = chargers.some((sc) => sc.charger.powerKw >= 22);
  const hasLowPower = chargers.some((sc) => sc.charger.powerKw < 22);
  const specs = aggregateSiteSpecs(chargers);
  // Câbles : valeur custom du commercial (siteSpecs) en priorité, sinon défaut
  const cable22 = specs.cable22Type || (hasHighPower ? "U1000 R2V 5G16 mm²" : "—");
  const cable74 = specs.cable74Type || (hasLowPower ? "U1000 R2V 3G10 mm²" : "—");
  // Nombre de points de charge par borne (1 ou 2). Détermine le total réel.
  const ppb = specs.pointsParBorne ?? 1;
  const totalPdc = totalChargers * ppb;

  // Table 2 colonnes : libellé / valeur. Surcharge via sc.siteSpecs.
  const rows: Array<{ label: string; value: string }> = [
    { label: "Points de recharge", value: `${totalPdc} PDC (${totalChargers} borne${totalChargers > 1 ? "s" : ""} × ${ppb} point${ppb > 1 ? "s" : ""})` },
    // Roobert n'a pas le glyphe → (U+2192) — jsPDF tombe sur un fallback
    // qui casse l'espacement. Pour tout texte client : ASCII + ponctuation
    // de base seulement.
    { label: "Distance tableau électrique > bornes", value: specs.distanceTgbt || "Précisée lors de la visite technique" },
    { label: "Emplacement", value: specs.locationDescription || chargers[0]?.siteAddress || "Parking site entreprise" },
    { label: "Puissance électrique disponible", value: specs.edfPower || "Selon votre contrat d'électricité" },
  ];
  // Câble 22 kW : affiché seulement si au moins 1 borne triphasée
  if (hasHighPower) rows.push({ label: "Type de câble", value: cable22 });
  // Câble 7,4 kW : affiché seulement si TOUTES les bornes sont monophasées
  // (si une seule est triphasée, le 7,4 n'a pas de sens d'apparaître)
  if (hasLowPower && !hasHighPower) rows.push({ label: "Type de câble", value: cable74 });
  rows.push(
    { label: "Délai estimé", value: specs.estimatedDelay || "3 à 5 semaines après signature du devis" },
    { label: "Local technique et raccordement", value: specs.tgbtRoom || "Déterminés lors de la visite technique" },
  );

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.4);
  rows.forEach((row) => {
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SUB);
    doc.text(row.label, M, y);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    const valLines = doc.splitTextToSize(row.value, PAGE_W - M * 2 - 240).slice(0, 2);
    valLines.forEach((vl: string, i: number) => {
      doc.text(vl, M + 240, y + i * 12);
    });
    const advance = Math.max(20, valLines.length * 12 + 8);
    y += advance;
    doc.line(M, y - 4, PAGE_W - M, y - 4);
    y += 6;
  });

  // Bandeau bas : emplacements sélectionnés (placeholder)
  y += 14;
  doc.setFillColor(...PINK);
  doc.roundedRect(M, y, PAGE_W - M * 2, 50, 8, 8, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(lookupText(TEXTS, "common", "overview_perimeter_title", "EMPLACEMENTS SÉLECTIONNÉS"), M + 16, y + 18);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9);
  doc.text(lookupText(TEXTS, "common", "overview_perimeter_note", "Précisés lors de la visite technique avec le bureau d'études IRVE Beev et le partenaire installateur certifié."), M + 16, y + 36);
}

// ============ RAPPORT SITE — INFRASTRUCTURE ÉLECTRIQUE ============
// Page 'Travaux à réaliser · devis installation' inspirée Château la Commaraine.
// 2 colonnes de bullets (gros œuvre / équipements + raccordement) avec un
// bandeau bas 'GÉNIE CIVIL TOTAL' et 'MASSIFS BÉTON'.
async function drawSiteInfrastructure(doc: jsPDF, chargers: SelectedCharger[]) {
  const PINK: [number, number, number] = [244, 184, 170];

  let y = 116;
  doc.setFillColor(...PINK);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(lookupText(TEXTS, "site", "site_infra_eyebrow", "3 · INFRASTRUCTURE ÉLECTRIQUE"), M + 30, y - 4);
  y += 14;

  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(26);
  doc.setTextColor(...INK);
  doc.text(lookupText(TEXTS, "site", "site_infra_title", "Travaux à réaliser · devis installation"), M, y + 18);
  y += 50;

  // Deux colonnes de bullets. Si le commercial a saisi une liste custom dans
  // sc.siteSpecs.worksList, on l'utilise pour la colonne gauche. Sinon
  // génération automatique depuis les bornes sélectionnées (placeholder).
  const totalBornes = chargers.reduce((s, sc) => s + sc.quantity, 0);
  const has22kW = chargers.some((sc) => sc.charger.powerKw >= 22);
  const has7kW = chargers.some((sc) => sc.charger.powerKw < 22);
  const specs = aggregateSiteSpecs(chargers);

  const customWorks = specs.worksList ?? [];
  const splitIdx = Math.ceil(customWorks.length / 2);
  const leftBullets = customWorks.length > 0
    ? customWorks.slice(0, splitIdx)
    : ([
        "Mise à niveau de l'infrastructure amont (câble principal, protections amont — à dimensionner après visite)",
        has22kW ? "Fourniture et pose câble U1000 R2V 5G16 mm² pour les bornes 22 kW" : null,
        has7kW ? "Fourniture et pose câble U1000 R2V 3G10 mm² pour les bornes 7,4 kW" : null,
        "Génie civil : fouilles selon longueurs depuis le TGBT",
        `Pose de ${totalBornes} massifs béton pour bornes sur pied / poteau`,
      ].filter(Boolean) as string[]);

  const rightBullets = customWorks.length > 0
    ? customWorks.slice(splitIdx)
    : [
        "Création chambre(s) de tirage selon cheminement validé en visite",
        `Pose et fixation de ${totalBornes} bornes ${chargers[0]?.charger.brand ?? ""}`,
        "Raccordement électrique complet et mise en service",
        "VIE · Vérification Installation Électrique",
        "Étiquetage et repérage final des protections",
      ];

  const colW = (PAGE_W - M * 2 - 30) / 2;
  const leftX = M;
  const rightX = M + colW + 30;
  const bulletStart = y;

  const drawBullets = (bullets: string[], x: number) => {
    let by = bulletStart;
    bullets.forEach((b) => {
      doc.setFillColor(...PINK);
      doc.circle(x + 4, by - 3, 2.5, "F");
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(b, colW - 16);
      doc.text(lines, x + 14, by);
      by += lines.length * 13 + 8;
    });
    return by;
  };
  const leftEnd = drawBullets(leftBullets, leftX);
  const rightEnd = drawBullets(rightBullets, rightX);
  // Photos chantier — affichées sous les bullets si le commercial en a uploadé.
  // Grille 2 ou 3 colonnes selon nombre de photos. Max 6 photos.
  if (specs.chantierPhotos && specs.chantierPhotos.length > 0) {
    const photosY = Math.max(leftEnd, rightEnd) + 20;
    if (photosY < PAGE_H - 200) {
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...SUB);
      doc.text("PHOTOS DU CHANTIER", M, photosY);
      const photos = specs.chantierPhotos.slice(0, 6);
      const cols = photos.length <= 2 ? 2 : 3;
      const gap = 8;
      const photoW = (PAGE_W - M * 2 - gap * (cols - 1)) / cols;
      const photoH = 90;
      for (let i = 0; i < photos.length; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const px = M + col * (photoW + gap);
        const py = photosY + 8 + row * (photoH + gap);
        if (py + photoH > PAGE_H - 60) break; // évite débordement footer
        try {
          await drawImageContain(doc, photos[i], px, py, photoW, photoH);
        } catch {
          // Photo indisponible : on dessine un placeholder discret
          doc.setFillColor(...BG);
          doc.rect(px, py, photoW, photoH, "F");
        }
      }
    }
  }
}

// ============ RAPPORT SITE — ÉQUIPEMENTS BEEV ============
// Page 'Les bornes de recharge' avec table prix par modèle + 3 colonnes
// caractéristiques techniques.
function drawSiteEquipments(doc: jsPDF, chargers: SelectedCharger[]) {
  const PINK: [number, number, number] = [244, 184, 170];

  let y = 116;
  doc.setFillColor(...PINK);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(lookupText(TEXTS, "site", "site_equip_eyebrow", "4 · ÉQUIPEMENTS BEEV"), M + 30, y - 4);
  y += 14;

  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(26);
  doc.setTextColor(...INK);
  doc.text(lookupText(TEXTS, "site", "site_equip_title", "Les bornes de recharge"), M, y + 18);
  y += 50;

  // Table récapitulative : 1 ligne par modèle agrégé.
  // IMPORTANT : on affiche le PRIX DE VENTE CLIENT (avec marge appliquée
  // via lineItemClientUnit), JAMAIS le prix d'achat catalogue (priceBuyHt).
  // Le client ne doit voir que ce qui lui est facturé.
  const byModel = new Map<string, { brand: string; model: string; powerKw: number; quantity: number; unitHt: number }>();
  for (const sc of chargers) {
    const key = `${sc.charger.brand}-${sc.charger.model}`;
    // Prix de vente client = unitHt avec marge appliquée (cf. lineItemClientUnit
    // dans pdf.ts) ; fallback sur priceHt (prix catalogue de vente, pas
    // priceBuyHt qui est le prix d'achat ops).
    const firstLi = sc.lineItems[0];
    const unitHt = firstLi
      ? lineItemClientUnit(firstLi)
      : sc.charger.priceHt ?? 0;
    if (byModel.has(key)) {
      byModel.get(key)!.quantity += sc.quantity;
    } else {
      byModel.set(key, {
        brand: sc.charger.brand,
        model: sc.charger.model,
        powerKw: sc.charger.powerKw,
        quantity: sc.quantity,
        unitHt,
      });
    }
  }
  const aggregated = Array.from(byModel.values());
  const totalQty = aggregated.reduce((s, r) => s + r.quantity, 0);

  // Pas de colonne "TOTAL HT" ni de footer prix : le Total HT par site est
  // affiché UNIQUEMENT sur la page "Options de paiement" (drawSitePaymentOptions)
  // pour éviter les doublons sur le PDF client.
  autoTable(doc, {
    startY: y,
    theme: "plain",
    head: [["MODÈLE", "QTÉ", "PUISSANCE"]],
    body: [
      ...aggregated.map((r) => [
        `${r.brand} ${r.model}`,
        String(r.quantity),
        `${r.powerKw} kW`,
      ]),
    ],
    foot: [[
      { content: `Total bornes`, styles: { fontStyle: "bold", textColor: INK, fillColor: BG, cellPadding: 8 } },
      { content: String(totalQty), styles: { halign: "center", fontStyle: "bold", textColor: INK, fillColor: BG, cellPadding: 8 } },
      { content: "", styles: { fillColor: BG, cellPadding: 8 } },
    ]],
    headStyles: { fillColor: LAVENDER, textColor: 255, fontSize: 9, fontStyle: "bold", font: BRAND_FONT, cellPadding: 7 },
    bodyStyles: { fontSize: 10, cellPadding: 7, textColor: INK, lineColor: RULE, lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 } as any, font: BRAND_FONT },
    footStyles: { font: BRAND_FONT },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 60 },
      2: { halign: "right", cellWidth: 100 },
    },
    margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 24;

  // 3 colonnes caractéristiques techniques (top 2 models + Smart charging)
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(lookupText(TEXTS, "site", "site_equip_specs_label", "CARACTÉRISTIQUES TECHNIQUES"), M, y);
  y += 16;

  const cardW = (PAGE_W - M * 2 - 20) / 3;
  // 3 cards : modèles uniques (max 2) + Smart charging unique.
  // Filtrage pour éviter le doublon historique (Smart charging affiché 2 fois
  // quand un seul modèle dans la sélection).
  const modelCards = aggregated.slice(0, 2).map((a) => ({
    title: `${a.brand} ${a.model}`,
    sub: `${a.powerKw} kW`,
    lines: lookupList(TEXTS, "site", "site_equip_default_features", [
      "Prise Type 2 intégrée",
      "RFID + supervision OCPP",
      "Connectivité WiFi/4G",
      "IP54 · garantie 3 ans",
    ]),
  }));
  const smartCharging = {
    title: lookupText(TEXTS, "site", "site_equip_smart_title", "Smart charging"),
    sub: "Pilotage flotte",
    lines: lookupList(TEXTS, "site", "site_equip_smart_items", [
      "Délestage dynamique natif",
      "Équilibrage de charge actif",
      "Compatible OCPP 1.6 et 2.0",
      "Données temps réel",
    ]),
  };
  const cards = [...modelCards, smartCharging].slice(0, 3);

  // Hauteur de carte uniforme calculée pour accueillir le pire cas (titre 2 lignes + 4 bullets 1 ligne)
  const cardH = 140;
  cards.forEach((card, i) => {
    const cx = M + i * (cardW + 10);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cx, y, cardW, cardH, 8, 8, "F");
    doc.setDrawColor(...RULE);
    doc.roundedRect(cx, y, cardW, cardH, 8, 8, "S");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    const titleLines = doc.splitTextToSize(card.title, cardW - 24);
    doc.text(titleLines, cx + 12, y + 22);
    const subY = y + 22 + titleLines.length * 13;
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SUB);
    doc.text(card.sub, cx + 12, subY);
    let by = subY + 22;
    card.lines.forEach((l) => {
      doc.setFillColor(...PINK);
      doc.circle(cx + 16, by - 3, 2, "F");
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(l, cardW - 36);
      doc.text(lines, cx + 24, by);
      by += lines.length * 11 + 4;
    });
  });
}

// ============ RAPPORT SITE — FICHE PRODUIT ============
// 1 page par modèle de borne unique : nom + image + table specs détaillées
// (puissance, connectivité, communication, smart charging, qualité/garantie).
async function drawSiteProductSheet(doc: jsPDF, sc: SelectedCharger) {
  const PINK: [number, number, number] = [244, 184, 170];
  const v = sc.charger;

  let y = 116;
  doc.setFillColor(...PINK);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(lookupText(TEXTS, "site", "site_product_eyebrow", "FICHE PRODUIT"), M + 30, y - 4);
  y += 14;

  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(32);
  doc.setTextColor(...INK);
  doc.text(`${v.brand} ${v.model}`, M, y + 22);
  y += 60;

  // 2 colonnes : table specs gauche, photo droite
  const photoW = 180;
  const photoX = PAGE_W - M - photoW;
  const tableW = PAGE_W - M * 2 - photoW - 20;

  // Photo borne dans cadre rose clair
  // Priorité : marketingImageUrl (image marketing HD éditable par l'ops) →
  // fallback sur v.image standard.
  doc.setFillColor(253, 241, 238);
  doc.roundedRect(photoX, y, photoW, 200, 8, 8, "F");
  const productImg = v.marketingImageUrl && v.marketingImageUrl.trim() ? v.marketingImageUrl : v.image;
  await drawImageContain(doc, productImg, photoX + 12, y + 12, photoW - 24, 180);

  // Table specs
  const specs = [
    { label: "Puissance", value: `${sc.chargePoints ?? 1} × ${v.powerKw} kW` },
    { label: "Connectivité", value: lookupText(TEXTS, "site", "site_product_connectivity", "Prise Type 2 intégrée · Lecteur RFID · Connectivité WiFi/4G") },
    { label: "Communication", value: lookupText(TEXTS, "site", "site_product_communication", "OCPP 1.6 et 2.0 · Supervision compatible") },
    { label: "Smart Charging", value: lookupText(TEXTS, "site", "site_product_smart_charging", "Délestage dynamique · Équilibrage actif") },
    // Garantie : priorité au champ saisi par le commercial dans /admin/chargers
    // (v.warranty) puis fallback sur pdf_texts (site_product_warranty) puis
    // valeur par défaut. Permet d'avoir une garantie spécifique par modèle.
    { label: "Qualité et Garantie", value: (v.warranty && v.warranty.trim()) || lookupText(TEXTS, "site", "site_product_warranty", "IP54 · IK10 · Garantie constructeur 3 ans (extensible 6 ans)") },
  ];
  let ty = y;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.4);
  specs.forEach((s) => {
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUB);
    doc.text(s.label, M, ty);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    const valLines = doc.splitTextToSize(s.value, tableW);
    doc.text(valLines, M, ty + 14);
    ty += 14 + valLines.length * 12 + 8;
    doc.line(M, ty - 2, M + tableW, ty - 2);
    ty += 6;
  });

  // Sous-titre photo
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SUB);
  doc.text(`${v.brand} ${v.model}`, photoX + photoW / 2, y + 218, { align: "center" });

  // Bloc PRÉSENTATION (description longue) volontairement retiré sur demande
  // utilisateur — la fiche produit doit se limiter aux specs techniques pour
  // éviter de noyer le lecteur sur cette slide.
}

// ============ RAPPORT SITE — SUPERVISION ============
// Page Supervision affichée si le commercial a choisi un plan dans le panneau
// droit : Beev Connect (site entreprise) ou Beev Home Charging (B2B2E).
function drawSiteSupervision(doc: jsPDF, plan: "beev_connect" | "beev_home_charging") {
  const PINK: [number, number, number] = [244, 184, 170];
  const BLACK: [number, number, number] = [29, 29, 29];
  const BEIGE: [number, number, number] = [252, 249, 242];
  const isHome = plan === "beev_home_charging";
  const pfx = isHome ? "site_sup_home" : "site_sup_connect";
  const t = (s: string, fb: string) => lookupText(TEXTS, "site", s, fb);
  const tl = (s: string, fb: string[]) => lookupList(TEXTS, "site", s, fb);

  const eyebrow = t(`${pfx}_eyebrow`, isHome ? "SUPERVISION · BEEV HOME CHARGING" : "SUPERVISION · BEEV CONNECT");
  const title = t(`${pfx}_title`, isHome ? "Refacturez la recharge à domicile sans friction" : "Pilotez votre infrastructure en temps réel");
  const subtitle = t(`${pfx}_intro`, isHome
    ? "Beev Home Charging gère la refacturation de l'électricité consommée à domicile par les collaborateurs en véhicule de fonction."
    : "Beev Connect centralise la supervision de votre parc de bornes sur une plateforme unique.");
  const features = tl(`${pfx}_features`, isHome
    ? ["Comptage précis kWh par session domicile","Tarif électricité indexé sur le contrat collaborateur","Versement mensuel automatisé sur RIB salarié","Reporting employeur","Conformité fiscale URSSAF","Application mobile collaborateur"]
    : ["Suivi temps réel des sessions","Reporting consommation","Gestion des accès (badges, QR codes)","Alerting défaut technique","Pilotage à distance","API ouverte"]);
  const priceLabel = t(`${pfx}_price_label`, "À PARTIR DE");
  const priceValue = t(`${pfx}_price_value`, isHome ? "8 € HT" : "6 € HT");
  const priceUnit = t(`${pfx}_price_unit`, isHome ? "/ mois / collaborateur" : "/ mois / point de recharge");
  const footer = t(`${pfx}_footer`, "Engagement 12 mois minimum · sans frais d'activation.");

  let y = 116;
  doc.setFillColor(...PINK);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(eyebrow, M + 30, y - 4);
  y += 14;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(28);
  doc.setTextColor(...INK);
  // Titre limité à la largeur utile, peut s'étaler sur 2 lignes si nécessaire
  const titleLines = doc.splitTextToSize(title, PAGE_W - M * 2);
  doc.text(titleLines, M, y + 22);
  y += 22 + (titleLines.length - 1) * 30 + 28;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...SUB);
  const subLines = doc.splitTextToSize(subtitle, PAGE_W - M * 2);
  doc.text(subLines, M, y);
  y += subLines.length * 13 + 24;

  // Card noire à droite : tarification — démarre au même Y que la liste features
  const cardX = PAGE_W - M - 200;
  const cardY = y;
  const cardW = 200;
  const cardH = 180;
  doc.setFillColor(...BLACK);
  doc.roundedRect(cardX, cardY, cardW, cardH, 8, 8, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PINK);
  doc.text(priceLabel, cardX + 16, cardY + 24);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(24);
  doc.setTextColor(...BEIGE);
  doc.text(priceValue, cardX + 16, cardY + 58, { maxWidth: cardW - 32 });
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text(priceUnit, cardX + 16, cardY + 80, { maxWidth: cardW - 32 });

  // Liste des fonctionnalités à gauche (largeur restreinte pour ne pas
  // empiéter sur la card noire à droite)
  const featuresW = cardX - M - 24;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SUB);
  doc.text("FONCTIONNALITÉS INCLUSES", M, y);
  y += 14;
  features.filter((f) => f && f.trim()).forEach((f) => {
    doc.setFillColor(...PINK);
    doc.circle(M + 4, y + 4, 2.5, "F");
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(f, featuresW - 20);
    doc.text(lines, M + 14, y + 7);
    y += lines.length * 13 + 6;
  });

  // Bandeau bas
  const noteY = Math.max(y + 16, cardY + cardH + 24);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SUB);
  doc.text(footer, M, noteY, { maxWidth: PAGE_W - M * 2 });
}

// ============ RAPPORT SITE — GARANTIES ============
// 3 colonnes : Qualification IRVE / RC Décennale AXA / Conformité &
// Certifications, suivies d'un bandeau "Reconnu par" en bas de page.
function drawSiteGuarantees(doc: jsPDF) {
  const PINK: [number, number, number] = [244, 184, 170];
  const PINK_LIGHT: [number, number, number] = [253, 241, 238];
  const t = (s: string, fb: string) => lookupText(TEXTS, "site", s, fb);
  const tl = (s: string, fb: string[]) => lookupList(TEXTS, "site", s, fb);
  let y = 116;
  doc.setFillColor(...PINK);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(t("site_guarantees_eyebrow", "GARANTIES"), M + 30, y - 4);
  y += 14;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(28);
  doc.setTextColor(...INK);
  doc.text(t("site_guarantees_title", "Nos qualifications et assurances"), M, y + 18);
  y += 50;

  const colW = (PAGE_W - M * 2 - 24) / 3;
  const cols = [
    {
      title: t("site_guarantees_col1_title", "Qualification IRVE"),
      items: tl("site_guarantees_col1_items", [
        "Installateurs certifiés IRVE",
        "Habilitation infrastructure VE",
        "Formation continue réglementaire",
        "Agréments : Hager, Smappee, Alfen, Schneider",
      ]),
    },
    {
      title: t("site_guarantees_col2_title", "RC Décennale AXA"),
      items: tl("site_guarantees_col2_items", [
        "Contrat BATISSUR n° 10998463604",
        "RC Entreprise : 10 000 000 €",
        "Dommages matériels : 2 000 000 €",
        "Garantie décennale travaux IRVE",
      ]),
    },
    {
      title: t("site_guarantees_col3_title", "Conformité et Certifications"),
      items: tl("site_guarantees_col3_items", [
        "Respect NF C15-100",
        "CONSUEL systématique",
        "Certification B Corp",
        "Membre ORIAS n° 21009382",
      ]),
    },
  ];

  // Hauteur de carte uniforme : suffisant pour titre 2 lignes + 5 puces 1 ligne
  const guaranteeCardH = 230;
  cols.forEach((col, i) => {
    const cx = M + i * (colW + 12);
    doc.setFillColor(...PINK_LIGHT);
    doc.roundedRect(cx, y, colW, guaranteeCardH, 8, 8, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    const titleLines = doc.splitTextToSize(col.title, colW - 24);
    doc.text(titleLines, cx + 12, y + 24);
    let by = y + 24 + titleLines.length * 14 + 12;
    col.items.forEach((it) => {
      doc.setFillColor(...PINK);
      doc.circle(cx + 16, by - 3, 2, "F");
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(it, colW - 36);
      doc.text(lines, cx + 24, by);
      by += lines.length * 12 + 6;
    });
  });
  y += guaranteeCardH + 24;

  // Bandeau bas
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SUB);
  doc.text(t("site_guarantees_footer_label", "RECONNU PAR"), M, y);
  y += 14;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(
    t("site_guarantees_footer_text", "Attestations et certifications disponibles sur simple demande : RC Décennale AXA, Qualifelec IRVE, agréments constructeurs."),
    M,
    y,
    { maxWidth: PAGE_W - M * 2 },
  );
}

// ============ RAPPORT SITE — CONFORMITÉ RÉGLEMENTAIRE ============
// 2 colonnes : Bureau de Contrôle (obligatoire si abonnement > 36 kVA) +
// Maintenance annuelle (forfait préventif).
function drawSiteCompliance(doc: jsPDF, chargers: SelectedCharger[]) {
  const PINK: [number, number, number] = [244, 184, 170];
  const PINK_LIGHT: [number, number, number] = [253, 241, 238];
  const t = (s: string, fb: string) => lookupText(TEXTS, "site", s, fb);
  const tl = (s: string, fb: string[]) => lookupList(TEXTS, "site", s, fb);
  const totalBornes = chargers.reduce((s, sc) => s + sc.quantity, 0);
  const maintenanceUnit = Math.max(0, parseFloat(t("site_comp_maint_unit_eur", "150")) || 150);
  const maintenanceTotal = totalBornes * maintenanceUnit;
  // La maintenance et le bureau de contrôle sont affichés uniquement si le
  // commercial coche la case dans le panneau droit (SiteSpecsEditor →
  // includeMaintenance / includeBureauControle).
  const aggregated = aggregateSiteSpecs(chargers);
  const showMaintenance = aggregated.includeMaintenance === true;
  const showBureauControle = aggregated.includeBureauControle === true;
  const showConsuel = aggregated.includeConsuel === true;
  // Même source numérique que le calcul du "MONTANT TOTAL PROJET" dans
  // drawSitePaymentOptions (slug site_pay_bureau_ht) : évite qu'un admin qui
  // modifie ce montant depuis la Configuration des textes PDF ne désynchronise
  // silencieusement l'affichage de cette page (qui utilisait jusqu'ici un
  // texte libre indépendant, jamais recalculé) du total réellement facturé.
  const bureauControleAmount = Math.max(0, parseFloat(t("site_pay_bureau_ht", "700")) || 700);
  // Si rien à afficher côté colonne gauche, on ne dessine pas la box rose
  // (la page reste cohérente avec uniquement la maintenance à droite).
  const showLeftCol = showBureauControle || showConsuel;

  let y = 116;
  doc.setFillColor(...PINK);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(t("site_comp_eyebrow", "5 · CONFORMITÉ RÉGLEMENTAIRE"), M + 30, y - 4);
  y += 14;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(26);
  doc.setTextColor(...INK);
  doc.text(t("site_comp_title", "Contrôles obligatoires et maintenance"), M, y + 18);
  y += 50;

  // Largeur colonnes : 2 colonnes si maintenance ET colonne gauche affichées,
  // pleine largeur sinon (le bloc maintenance prend toute la page si seul).
  const twoCol = showMaintenance && showLeftCol;
  const colW = twoCol ? (PAGE_W - M * 2 - 20) / 2 : PAGE_W - M * 2;

  // Colonne gauche : Bureau de Contrôle (conditionnel) + Consuel (conditionnel)
  // Hauteur adaptative selon les blocs activés. Si rien à gauche : on saute.
  let ly = y + 22;
  if (showLeftCol) {
    const leftBoxH = (showBureauControle && showConsuel) ? 280 : 140;
    doc.setFillColor(...PINK_LIGHT);
    doc.roundedRect(M, y, colW, leftBoxH, 8, 8, "F");
  }
  if (showLeftCol && showBureauControle) {
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(t("site_comp_bureau_title", "Bureau de Contrôle"), M + 14, ly);
    ly += 18;
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(
      t("site_comp_bureau_desc", "Abonnement client > 36 kVA, contrôle réglementaire obligatoire. Intervention prévue J+25 après installation. Attestation délivrée à réception."),
      M + 14,
      ly,
      { maxWidth: colW - 28 },
    );
    ly += 60;
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...SUB);
    doc.text(t("site_comp_bureau_price_label", "COÛT"), M + 14, ly);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(18);
    doc.setTextColor(...INK);
    doc.text(t("site_comp_bureau_price", `${eur(bureauControleAmount)} HT`), M + 14, ly + 22);

    ly += 56;
    // Séparateur entre Bureau de Contrôle et Consuel uniquement si Consuel
    // est aussi affiché (sinon le trait pend dans le vide).
    if (showConsuel) {
      doc.setDrawColor(...RULE);
      doc.line(M + 14, ly, M + colW - 14, ly);
      ly += 18;
    }
  }
  if (showLeftCol && showConsuel) {
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(t("site_comp_consuel_title", "Consuel"), M + 14, ly);
    ly += 18;
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(
      t("site_comp_consuel_desc", "Obligatoire pour toute installation IRVE. Passage prévu J+28 après installation. Attestation de conformité délivrée à réception."),
      M + 14,
      ly,
      { maxWidth: colW - 28 },
    );
  }

  // Colonne droite : Maintenance annuelle — affichée uniquement si le
  // commercial a coché "Inclure la maintenance annuelle" dans le panneau
  // droit (SiteSpecs.includeMaintenance). Si la colonne gauche est masquée,
  // le bloc maintenance prend toute la largeur de la page.
  if (showMaintenance) {
    const rx = showLeftCol ? M + colW + 20 : M;
    const rW = showLeftCol ? colW : PAGE_W - M * 2;
    doc.setFillColor(29, 29, 29);
    doc.roundedRect(rx, y, rW, 280, 8, 8, "F");
    let ry = y + 22;
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PINK);
    doc.text(t("site_comp_maint_title", "Maintenance annuelle"), rx + 14, ry);
    ry += 22;
    const lines = [
      { l: t("site_comp_maint_unit_label", "Forfait préventif"), v: t("site_comp_maint_unit_value", `${maintenanceUnit} € HT / PDC / an`) },
      { l: t("site_comp_maint_pdc_label", "Points de recharge"), v: `${totalBornes} PDC` },
      { l: t("site_comp_maint_total_label", "Total maintenance / an"), v: `${eur(maintenanceTotal)} HT` },
    ];
    // Alignement vertical : on utilise la même fontSize pour label et valeur
    // (10pt), seul le poids change. Évite le décalage visuel entre la valeur
    // grande (14pt total) et son label petit (9pt). Le total est mis en avant
    // par le BOLD + la couleur PINK, pas par une taille plus grande.
    lines.forEach((line, i) => {
      const isTotal = i === 2;
      doc.setFont(BRAND_FONT, isTotal ? "bold" : "normal");
      doc.setFontSize(10);
      doc.setTextColor(isTotal ? PINK[0] : 200, isTotal ? PINK[1] : 200, isTotal ? PINK[2] : 200);
      doc.text(line.l, rx + 14, ry);
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(11);
      doc.setTextColor(isTotal ? PINK[0] : 252, isTotal ? PINK[1] : 249, isTotal ? PINK[2] : 242);
      doc.text(line.v, rx + rW - 14, ry, { align: "right" });
      ry += 22;
      if (i < 2) {
        // Trait centré entre la ligne actuelle et la suivante : ry vient
        // d'être incrémenté de 22 pt, le centre se trouve donc à ry - 11.
        doc.setDrawColor(70, 67, 62);
        doc.line(rx + 14, ry - 11, rx + rW - 14, ry - 11);
      }
    });
    ry += 16;
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PINK);
    doc.text(t("site_comp_maint_subtitle", "VISITE ANNUELLE SUR SITE"), rx + 14, ry);
    ry += 14;
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(252, 249, 242);
    tl("site_comp_maint_items", ["Entretien général", "Vérification électrique", "Rapport de maintenance détaillé"]).forEach((it) => {
      doc.setFillColor(...PINK);
      doc.circle(rx + 18, ry + 4, 2, "F");
      doc.text(it, rx + 26, ry + 7);
      ry += 16;
    });
  }
}


// ============ RAPPORT SITE — OPTIONS DE PAIEMENT ============
// 3 colonnes : Comptant -2% / 50% acompte + 50% / Leasing.
function drawSitePaymentOptions(doc: jsPDF, chargers: SelectedCharger[], client?: ClientInfo) {
  const PINK: [number, number, number] = [244, 184, 170];
  const PINK_LIGHT: [number, number, number] = [253, 241, 238];
  const BLACK: [number, number, number] = [29, 29, 29];
  const t = (s: string, fb: string) => lookupText(TEXTS, "site", s, fb);
  // Bureau de Contrôle activé uniquement si toggle commercial coché.
  const specsBureau = aggregateSiteSpecs(chargers);
  const bureauControle = specsBureau.includeBureauControle === true
    ? Math.max(0, parseFloat(t("site_pay_bureau_ht", "700")) || 700)
    : 0;

  // Total recalculé pour cohérence avec la page récap financier (hors bornes en location).
  const total = chargers.reduce((sum, sc) => sc.leaseEnabled ? sum : sum + sc.lineItems.reduce((a, li) => a + lineItemClientTotal(li), 0) * chargerQtyMultiplier(sc), 0) + bureauControle;
  // Montant total projet saisi manuellement (mode location) : s'il est renseigné,
  // il REMPLACE le total calculé (qui exclut les bornes en location). Ne compter
  // que les bornes ACTUELLEMENT en location : sinon une borne repassée en achat
  // après avoir eu ce champ renseigné en location laisse une valeur fantôme qui
  // écrase silencieusement le total achat correctement recalculé.
  const manualTotal = chargers.reduce((sum, sc) => sum + (sc.leaseEnabled ? (sc.leaseProjectTotalHt ?? 0) : 0), 0);
  const displayTotal = manualTotal > 0 ? manualTotal : total;
  const ttc = displayTotal * 1.2;
  const acompte50 = ttc * 0.5;

  let y = 116;
  doc.setFillColor(...PINK);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(t("site_pay_eyebrow", "7 · OPTIONS DE PAIEMENT"), M + 30, y - 4);
  y += 14;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(26);
  doc.setTextColor(...INK);
  doc.text(t("site_pay_title", "Régler en toute flexibilité"), M, y + 18);
  y += 50;

  const colW = (PAGE_W - M * 2 - 24) / 3;
  const opts = [
    {
      title: t("site_pay_opt1_title", "Comptant"),
      badge: t("site_pay_opt1_badge", "Standard"),
      desc: t("site_pay_opt1_desc", "Paiement intégral à la commande. Économie immédiate sur le total projet."),
      tone: "default" as const,
    },
    {
      title: t("site_pay_opt2_title", "Classique"),
      badge: t("site_pay_opt2_badge", "Standard"),
      desc: t("site_pay_opt2_desc", "50 % acompte à la commande, 50 % à réception. Échéancier détaillé possible."),
      tone: "highlight" as const,
    },
    {
      title: t("site_pay_opt3_title", "Leasing"),
      badge: t("site_pay_opt3_badge", "Sur demande"),
      desc: t("site_pay_opt3_desc", "Financement en LOA sur 24 / 36 / 48 mois selon profil. Simulation personnalisée par notre partenaire."),
      tone: "default" as const,
    },
  ];

  // Admin : si au moins une borne du site est présentée en LOCATION, on bascule
  // la mise en avant (carte noire) sur la formule Leasing et on affiche la / les
  // durée(s) de location souhaitée(s).
  const leaseSiteChargers = chargers.filter((sc) => sc.leaseEnabled);
  const adminLease = ADMIN_MODE && leaseSiteChargers.length > 0;
  let highlightIdx = opts.findIndex((o) => o.tone === "highlight");
  if (highlightIdx < 0) highlightIdx = 1;
  // Récap location (pour la carte Leasing + le bandeau bas).
  const leaseDurations = adminLease
    ? Array.from(new Set(leaseSiteChargers.flatMap((sc) => [
        sc.leaseDurationMonths ?? 0,
        ...(sc.leaseConfigs ?? []).map((cfg) => cfg.durationMonths ?? 0),
      ]).filter((d) => d > 0))).sort((a, b) => a - b)
    : [];
  const leaseDurLabel = leaseDurations.join(" / ");
  const leaseTotalRents = adminLease ? leaseSiteChargers.reduce((s, sc) => s + computeChargerLease(sc).totalRents, 0) : 0;
  const leaseBuyout = leaseTotalRents * 0.10;
  if (adminLease) {
    highlightIdx = 2;
    opts[2].badge = leaseDurLabel ? `${leaseDurLabel} mois` : opts[2].badge;
    if (leaseDurLabel) {
      opts[2].desc = `Location sur ${leaseDurLabel} mois. Option d'achat 10 %, échéancier trimestriel et conditions de résiliation anticipée détaillés dans l'offre.`;
    }
  }

  const payCardH = 200;
  opts.forEach((opt, i) => {
    const cx = M + i * (colW + 12);
    if (i === highlightIdx) {
      doc.setFillColor(...BLACK);
      doc.roundedRect(cx, y, colW, payCardH, 8, 8, "F");
      // Badge largeur dynamique selon le texte (min 80, max colW - 28)
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(8);
      const badgeTextW = doc.getTextWidth(opt.badge);
      const badgeW = Math.min(colW - 28, Math.max(80, badgeTextW + 20));
      doc.setFillColor(...PINK);
      doc.roundedRect(cx + 14, y + 16, badgeW, 18, 9, 9, "F");
      doc.setTextColor(...BLACK);
      doc.text(opt.badge, cx + 14 + badgeW / 2, y + 28, { align: "center" });
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(22);
      doc.setTextColor(252, 249, 242);
      doc.text(opt.title, cx + 14, y + 70, { maxWidth: colW - 28 });
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(10);
      doc.setTextColor(200, 200, 200);
      const lines = doc.splitTextToSize(opt.desc, colW - 28);
      doc.text(lines, cx + 14, y + 96);
    } else {
      doc.setFillColor(...PINK_LIGHT);
      doc.roundedRect(cx, y, colW, payCardH, 8, 8, "F");
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(8);
      doc.setTextColor(...SUB);
      doc.text(opt.badge, cx + 14, y + 24);
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(22);
      doc.setTextColor(...INK);
      doc.text(opt.title, cx + 14, y + 60, { maxWidth: colW - 28 });
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(opt.desc, colW - 28);
      doc.text(lines, cx + 14, y + 86);
    }
  });
  y += payCardH + 16;

  // Mention location : dossier soumis à étude / validation du partenaire financier.
  if (adminLease) {
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SUB);
    const leaseNote = t("site_pay_lease_note", "Le financement en location est soumis à étude et validation du dossier par notre partenaire financier.");
    const leaseNoteLines = doc.splitTextToSize(leaseNote, PAGE_W - M * 2);
    doc.text(leaseNoteLines, M, y + 4);
    y += leaseNoteLines.length * 12 + 10;
  }

  // Bandeau bas : mise en page en pile (label, montant, info), puis une ligne
  // CTA (bouton à gauche, e-mail du conseiller à droite). Robuste quelle que
  // soit la longueur de la ligne d'info (achat vs location).
  const px = 18;
  const innerW = PAGE_W - M * 2;
  const bandH = 142;
  doc.setFillColor(...BLACK);
  doc.roundedRect(M, y, innerW, bandH, 10, 10, "F");

  // Label + montant total HT
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PINK);
  doc.text(t("site_pay_total_label", "MONTANT TOTAL PROJET"), M + px, y + 28);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(26);
  doc.setTextColor(252, 249, 242);
  doc.text(`${eur(displayTotal)} HT`, M + px, y + 60);

  // Ligne d'info pleine largeur : acompte 50 % en achat, détail loyers en location.
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(190, 190, 190);
  const infoLine = adminLease
    ? `Total des loyers : ${eur(leaseTotalRents)} HT · Option d'achat 10 % : ${eur(leaseBuyout)} HT${leaseDurLabel ? ` · ${leaseDurLabel} mois` : ""}`
    : `${t("site_pay_acompte_label", "Acompte 50 % à la commande")} : ${eur(acompte50 / 1.2)} HT`;
  doc.text(infoLine, M + px, y + 82, { maxWidth: innerW - px * 2 });

  // Ligne CTA : bouton signature (gauche) + e-mail du conseiller (droite).
  const email = (client?.salesRepEmail ?? "").trim();
  const signatureUrl = chargers.map((sc) => sc.signatureUrl).find((u) => u && u.trim()) ?? "";
  const signUrl = /^https?:\/\//i.test(signatureUrl)
    ? signatureUrl
    : `mailto:${email || "contact@beev.co"}?subject=Signature%20devis%20Beev`;
  const ctaTxt = `${t("site_pay_sign_cta", "Signer le devis en ligne")}   →`;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(11);
  const btnW = doc.getTextWidth(ctaTxt) + 36;
  const btnH = 34;
  const bx = M + px;
  const by = y + bandH - 16 - btnH;
  doc.setFillColor(...PINK);
  doc.roundedRect(bx, by, btnW, btnH, btnH / 2, btnH / 2, "F");
  doc.setTextColor(...BLACK);
  doc.text(ctaTxt, bx + btnW / 2, by + btnH / 2 + 4, { align: "center" });
  doc.link(bx, by, btnW, btnH, { url: signUrl });

  // E-mail du commercial à droite (aligné sur le bouton). Jamais contact@beev.co.
  if (email) {
    const rx = M + innerW - px;
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...PINK);
    doc.text(t("site_pay_advisor_label", "VOTRE CONSEILLER"), rx, by + 13, { align: "right" });
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(10);
    doc.setTextColor(220, 220, 220);
    doc.text(email, rx, by + 28, { align: "right" });
  }
}

function drawWhyBeev(doc: jsPDF, type: ProjectType) {
  let y = 130;
  eyebrow(doc, lookupText(TEXTS, "common", "why_beev_eyebrow", L("NOTRE APPROCHE", "OUR APPROACH")), y);
  y += 32;
  const whyBeevTitleFallback = type === "vehicles" ? L("Pourquoi confier vos véhicules à Beev.", "Why entrust your vehicles to Beev.") :
              type === "home" ? "Le forfait clé en main pour vos collaborateurs." :
              "Un déploiement IRVE site entreprise sans friction.";
  title(doc, lookupText(TEXTS, type, "why_beev_title", whyBeevTitleFallback), y);
  y += 36;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);

  const intros: Record<ProjectType, string> = {
    vehicles: L(
      "Beev centralise pour vous le sourcing constructeur (Tesla, Mercedes, Renault, VW, Hyundai, Kia, Peugeot…), le financement LLD (Ayvens, Arval, Athlon, Leaseplan), et l'assistance multimarque tout au long de la vie du contrat. Loyers exprimés en TTC.",
      "Beev centralizes manufacturer sourcing for you (Tesla, Mercedes, Renault, VW, Hyundai, Kia, Peugeot…), long-term lease financing (Ayvens, Arval, Athlon, Leaseplan), and multi-brand support throughout the contract. Rents shown including VAT.",
    ),
    home: "Vous équipez vos collaborateurs roulant en véhicule électrique d'une borne à leur domicile. Beev gère l'intégralité : vente, installation IRVE certifiée par nos techniciens partenaries, supervision, et remboursement automatisé de l'énergie consommée à titre professionnel.",
    site: "Vous électrifiez vos sites tertiaires, logistiques ou commerciaux. Beev prend en charge l'étude de site, le matériel premium (Alfen, Schneider, Hager, Smappee), la pose IRVE certifiée, le génie civil, la mise en service OCPP et la formation des utilisateurs.",
  };
  const introText = PDF_CONTENT.whyBeevIntro ?? intros[type];
  const l1 = doc.splitTextToSize(introText, PAGE_W - M * 2);
  doc.text(l1, M, y);
  y += l1.length * 14 + 16;

  doc.setFont(BRAND_FONT, "bold");
  doc.text(lookupText(TEXTS, type, "why_beev_changes_header", L("Concrètement, ce qui change pour vous :", "In practical terms, here's what changes for you:")), M, y);
  y += 18;
  doc.setFont(BRAND_FONT, "normal");

  const bulletsByType: Record<ProjectType, string[]> = {
    vehicles: PDF_LANG === "en" ? [
      "A single point of contact for your entire EV fleet.",
      "Key account negotiated rates across all manufacturers.",
      "Systematic TCO study (lease + energy) vs. a combustion-engine benchmark.",
      "Maintenance, 24/7 assistance and total loss management always included.",
      "Dedicated key account management.",
    ] : [
      "Un interlocuteur unique pour l'intégralité de votre flotte VE.",
      "Tarifs négociés grand compte sur tous les constructeurs.",
      "Étude TCO (loyer + énergie) systématique vs référence thermique.",
      "Maintenance, assistance 24/24 et gestion des pertes totales toujours incluses.",
      "Suivi commercial dédié grand compte.",
    ],
    home: [
      "Un forfait standardisé : matériel + pose + supervision.",
      "Pose réalisée par nos techniciens IRVE certifié.",
      "Supervision : visibilité par collaborateur, par site. (en option)",
      "Remboursement automatisé de l'énergie consommée à des fins professionnelles. (en option)",
      "Garantie matériel selon la gamme retenue.",
    ],
    site: [
      "Visite technique de chaque site et étude de faisabilité IRVE.",
      "Devis détaillé matériel + pose + génie civil, ligne par ligne.",
      "Pose par technicien IRVE certifié, mise en service OCPP, formation utilisateurs.",
      "Supervision flotte multi-sites (en option) et compteurs MID conformes.",
      "Garantie matériel selon la gamme retenue.",
    ],
  };
  const bullets = PDF_CONTENT.whyBeevBullets.length > 0 ? PDF_CONTENT.whyBeevBullets : bulletsByType[type];
  bullets.forEach((b) => {
    doc.setFillColor(...ACCENT);
    doc.circle(M + 4, y - 3, 2, "F");
    const t = doc.splitTextToSize(b, PAGE_W - M * 2 - 16);
    doc.setTextColor(...INK);
    doc.text(t, M + 14, y);
    y += t.length * 14 + 6;
  });

  // ===== Section "Beev en chiffres" (preuve sociale, conditionnée) =====
  if (PDF_CFG.showSocialProof && y < FOOTER_LIMIT - 130) {
    y += 14;
    doc.setFillColor(...INK);
    doc.rect(M, y, PAGE_W - M * 2, 90, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...ACCENT);
    doc.text(lookupText(TEXTS, "common", "why_beev_chiffres_title", L("BEEV EN CHIFFRES", "BEEV IN NUMBERS")), M + 16, y + 18);

    const stats: Array<{ value: string; label: string }> = PDF_LANG === "en" ? [
      { value: "5000+", label: "companies\nsupported" },
      { value: "90%", label: "charging stations\ninstalled in under 20 business days" },
      { value: "350+", label: "partner EVSE\ntechnicians" },
      { value: "97 %", label: "satisfied clients\n(NPS 2025)" },
    ] : [
      { value: "5000+", label: "entreprises\naccompagnées" },
      { value: "90%", label: "bornes\ninstallées en moins de 20 jours ouvrés" },
      { value: "350+", label: "techniciens\nIRVE partenaire" },
      { value: "97 %", label: "clients satisfaits\n(NPS 2025)" },
    ];
    const cw = (PAGE_W - M * 2 - 32) / stats.length;
    stats.forEach((s, i) => {
      const x = M + 16 + i * cw;
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text(s.value, x, y + 50);
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 185);
      const lbl = doc.splitTextToSize(s.label, cw - 8);
      doc.text(lbl, x, y + 64);
    });
    y += 100;
  }

  // ===== Citation client (témoignage, conditionnée par showSocialProof) =====
  if (PDF_CFG.showSocialProof && y < FOOTER_LIMIT - 80) {
    doc.setFillColor(...BG);
    doc.rect(M, y, PAGE_W - M * 2, 60, "F");
    doc.setFillColor(...LAVENDER);
    doc.rect(M, y, 4, 60, "F");
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    const quoteByType: Record<ProjectType, { quote: string; author: string }> = {
      vehicles: PDF_LANG === "en" ? {
        quote: "\"Beev helped us electrify 30 vehicles in 2 months, with a single point of contact and flawless follow-through.\"",
        author: "CFO · Mid-cap logistics company, 180 employees",
      } : {
        quote: "« Beev nous a permis d'électrifier 30 véhicules en 2 mois, avec un interlocuteur unique et un suivi sans faille. »",
        author: "DAF · ETI logistique 180 collaborateurs",
      },
      home: {
        quote: "« Le forfait Beev a simplifié notre déploiement chez 35 collaborateurs : zéro charge pour notre équipe RH. »",
        author: "DRH · PME tech 60 collaborateurs",
      },
      site: {
        quote: "« Étude IRVE rigoureuse, pose dans les délais, supervision OCPP impeccable. Du clé en main. »",
        author: "Directeur immobilier · ETI tertiaire 400 collaborateurs",
      },
    };
    const q = quoteByType[type];
    const ql = doc.splitTextToSize(q.quote, PAGE_W - M * 2 - 32);
    doc.text(ql, M + 16, y + 22);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUB);
    doc.text(q.author.toUpperCase(), M + 16, y + 50);
  }
}

// Trace un segment en pointillés avec les seuls primitifs jsPDF garantis
// disponibles (doc.line) — évite de dépendre de setLineDashPattern, dont le
// support varie selon la version de jsPDF et n'est utilisé nulle part
// ailleurs dans ce fichier.
function drawDashedLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, dashLen = 4, gapLen = 3) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return;
  const ux = dx / dist, uy = dy / dist;
  let pos = 0;
  while (pos < dist) {
    const segEnd = Math.min(pos + dashLen, dist);
    doc.line(x1 + ux * pos, y1 + uy * pos, x1 + ux * segEnd, y1 + uy * segEnd);
    pos += dashLen + gapLen;
  }
}

// ROI installation borne domicile (véhicules électriques uniquement) ———
// Compare le coût cumulé « avec borne domicile » (investissement + kWh au
// tarif domicile) au coût cumulé « sans borne » (100 % recharge publique,
// plus chère) pour montrer à partir de quelle consommation l'installation
// devient rentable. Dessiné en vectoriel (jsPDF), comme le reste du PDF —
// pas d'image bitmap, cohérent avec le style du reste du document.
// L'investissement borne est réglable par le commercial (« Prix borne
// domicile HT », panneau Paramètres TCO & énergie) ; à défaut, reprend
// l'hypothèse par défaut du calculateur B2B2E (investBorneParCollabHt).
function drawHomeChargerRoi(doc: jsPDF, y: number, v: Vehicle, e: EnergyParams, client: ClientInfo, type: ProjectType): number {
  const prixDom = e.kWhHome ?? 0.20;
  const prixPub = e.kWhPublic ?? 0.45;
  // Sans écart de prix domicile/public en faveur du domicile, il n'y a pas
  // de seuil de rentabilité à montrer (la borne ne coûterait jamais moins).
  if (prixPub <= prixDom) return y;
  // Réglable par le commercial (Paramètres TCO & énergie) ; à défaut, reprend
  // l'hypothèse par défaut du calculateur B2B2E pour rester cohérent.
  const investBorne = e.homeChargerCostHt ?? DEFAULT_B2B2E_INPUT.investBorneParCollabHt;
  const seuilKwh = investBorne / (prixPub - prixDom);
  const conso = v.consumptionElec ?? v.consumption ?? 18;
  const seuilKm = conso > 0 ? (seuilKwh / conso) * 100 : 0;

  const chartTop = ensureSpace(doc, y, 260, client, type);
  y = chartTop;

  doc.setFillColor(...LAVENDER);
  doc.rect(M, y + 2, 24, 2.5, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(L("ROI INSTALLATION BORNE DOMICILE", "HOME CHARGER INSTALLATION ROI"), M + 32, y + 6);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SUB);
  doc.text(L(`Coût cumulé selon la consommation, sur la base de ${eur(investBorne)} d'investissement borne.`, `Cumulative cost by consumption, based on a ${eur(investBorne)} charger investment.`), M + 32, y + 18);
  y += 34;

  const plotX = M + 44;
  const plotTop = y;
  const plotBottom = y + 150;
  const plotW = PAGE_W - M * 2 - 54;
  const maxKwh = Math.max(seuilKwh * 1.7, 1000);
  const costWithBorne = (kwh: number) => investBorne + kwh * prixDom;
  const costNoBorne = (kwh: number) => kwh * prixPub;
  const maxCost = Math.max(costWithBorne(maxKwh), costNoBorne(maxKwh));
  const xAt = (kwh: number) => plotX + (kwh / maxKwh) * plotW;
  const yAt = (cost: number) => plotBottom - Math.max(0, Math.min(1, cost / maxCost)) * (plotBottom - plotTop);

  // Grille horizontale + labels axe Y (coût)
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.4);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(6.5);
  for (let i = 0; i <= 4; i++) {
    const gy = plotTop + (i / 4) * (plotBottom - plotTop);
    doc.line(plotX, gy, plotX + plotW, gy);
    doc.setTextColor(...SUB);
    doc.text(eur(maxCost * (1 - i / 4)), plotX - 6, gy + 3, { align: "right" });
  }
  // Axe X (labels kWh)
  for (let i = 0; i <= 4; i++) {
    const kwhVal = (i / 4) * maxKwh;
    doc.setTextColor(...SUB);
    doc.text(`${Math.round(kwhVal)}`, xAt(kwhVal), plotBottom + 12, { align: "center" });
  }
  doc.setFontSize(7);
  doc.text(L("kWh consommés", "kWh consumed"), plotX + plotW / 2, plotBottom + 24, { align: "center" });

  // Ligne « avec borne » (pleine, accent lavande)
  doc.setDrawColor(...LAVENDER);
  doc.setLineWidth(1.6);
  doc.line(xAt(0), yAt(costWithBorne(0)), xAt(maxKwh), yAt(costWithBorne(maxKwh)));
  // Ligne « sans borne » (pointillés, gris) — comparaison, pas la solution mise en avant
  const GREY_LINE2: [number, number, number] = [150, 146, 138];
  doc.setDrawColor(...GREY_LINE2);
  doc.setLineWidth(1.6);
  drawDashedLine(doc, xAt(0), yAt(costNoBorne(0)), xAt(maxKwh), yAt(costNoBorne(maxKwh)));

  // Point de seuil de rentabilité
  if (seuilKwh > 0 && seuilKwh < maxKwh) {
    const px = xAt(seuilKwh);
    const py = yAt(costWithBorne(seuilKwh));
    doc.setFillColor(...INK);
    doc.circle(px, py, 3, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    const seuilLabel = L(`Seuil de rentabilité : ${Math.round(seuilKwh)} kWh (~${Math.round(seuilKm)} km)`, `Break-even point: ${Math.round(seuilKwh)} kWh (~${Math.round(seuilKm)} km)`);
    const labelX = px + 8 + doc.getTextWidth(seuilLabel) > plotX + plotW ? px - 8 - doc.getTextWidth(seuilLabel) : px + 8;
    doc.text(seuilLabel, labelX, py - 8);
  }

  // Légende
  const legY = plotBottom + 40;
  doc.setFillColor(...LAVENDER);
  doc.rect(plotX, legY - 6, 14, 3, "F");
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(L(`Avec borne domicile : ${eur(investBorne)} + ${prixDom.toFixed(2)} €/kWh`, `With home charger: ${eur(investBorne)} + ${prixDom.toFixed(2)} €/kWh`), plotX + 20, legY - 3);
  doc.setFillColor(...GREY_LINE2);
  doc.rect(plotX, legY + 8, 14, 3, "F");
  doc.text(L(`Sans borne, 100 % recharge publique : ${prixPub.toFixed(2)} €/kWh`, `Without charger, 100% public charging: ${prixPub.toFixed(2)} €/kWh`), plotX + 20, legY + 11);

  return legY + 22;
}

// ============ FICHE VÉHICULE ============
async function drawVehiclePage(doc: jsPDF, sv: SelectedVehicle, e: EnergyParams, idx: number, total: number, client: ClientInfo, type: ProjectType) {
  // Refonte design Claude/Beev — étape 3/5 :
  // - Accent bleu Beev A5D2FF (pill "Tarification LLD")
  // - Photo sur fond bleu très clair EDF6FF (radius)
  // - Price card NOIRE à droite avec rows séparées + bloc loyer mis en valeur
  //   (label bleu, gros chiffre 36pt, note multi-véhicules / km)
  const BLEU_LIGHT: [number, number, number] = [237, 246, 255]; // #EDF6FF fond photo
  // Admin : l'accent de la fiche suit la couleur du produit (rose véhicules,
  // bleu domicile, violet site) pour rester cohérent avec la couverture et les
  // en-têtes. Sinon bleu Beev historique.
  const BLEU_ACCENT: [number, number, number] = ADMIN_MODE ? PRODUCT_ACCENT : [165, 210, 255];
  // Déclinaisons claires de l'accent produit pour la table « scénarios » (admin).
  const accSoft: [number, number, number] = PRODUCT_ACCENT.map((c) => Math.round(c + (255 - c) * 0.80)) as [number, number, number];
  const accMid: [number, number, number] = PRODUCT_ACCENT.map((c) => Math.round(c + (255 - c) * 0.62)) as [number, number, number];
  const accDeep: [number, number, number] = PRODUCT_ACCENT.map((c) => Math.round(c * 0.55)) as [number, number, number];
  const GREY_TXT: [number, number, number] = [74, 74, 74];
  const BLACK: [number, number, number] = [29, 29, 29];
  const BEIGE: [number, number, number] = [252, 249, 242];
  const GREY_ON_DARK: [number, number, number] = [201, 198, 190]; // #C9C6BE
  const GREY_LABEL_DARK: [number, number, number] = [140, 137, 128]; // #8C8980
  const v = sv.vehicle;

  // ─── Header : eyebrow + titre + sous-titre + pill "Tarification LLD" droite ───
  // Eyebrow barre bleue + label
  doc.setFillColor(...BLEU_ACCENT);
  doc.rect(M, 105, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(L(`VÉHICULE ${idx} / ${total}`, `VEHICLE ${idx} / ${total}`), M + 30, 109);

  // Badge en haut à droite : « FLOTTE ACTUELLE » (rose) si véhicule à
  // remplacer, sinon « PROPOSITION BEEV » (bleu) — pour distinguer
  // visuellement le statut de chaque fiche dans le devis.
  {
    const ROSE: [number, number, number] = [244, 184, 170];
    const BLUE: [number, number, number] = [165, 210, 255];
    const isFlotte = !!v.isCurrentFleet;
    const badgeText = isFlotte ? L("FLOTTE ACTUELLE", "CURRENT FLEET") : L("PROPOSITION BEEV", "BEEV PROPOSAL");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    const badgeW = doc.getTextWidth(badgeText) + 16;
    const badgeX = PAGE_W - M - badgeW;
    doc.setFillColor(...(isFlotte ? ROSE : BLUE));
    doc.roundedRect(badgeX, 100, badgeW, 16, 8, 8, "F");
    doc.setTextColor(...INK);
    doc.text(badgeText, badgeX + badgeW / 2, 111, { align: "center" });
  }

  // Titre 38px ≈ 28.5pt — auto-ajusté pour ne pas déborder sous la colonne
  // de badges à droite (badge statut y≈100, pill TARIFICATION LLD y≈130).
  // On calcule la largeur disponible jusqu'au bord gauche du plus large des
  // deux badges, puis on réduit la taille de police jusqu'à ce que le titre
  // tienne sur une ligne (plancher 16pt). Au-delà, on tronque proprement.
  {
    const titleText = `${v.brand} ${v.model}`;
    // Largeur du badge statut (même calcul que dans le bloc badge ci-dessus)
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    const statusBadgeW = doc.getTextWidth(v.isCurrentFleet ? L("FLOTTE ACTUELLE", "CURRENT FLEET") : L("PROPOSITION BEEV", "BEEV PROPOSAL")) + 16;
    const statusBadgeLeft = PAGE_W - M - statusBadgeW;
    // Largeur du pill tarification (calculé plus bas mais on anticipe ici)
    doc.setFontSize(7.5);
    const pillTextEarly = lookupText(TEXTS, "vehicles", "vehicle_tariff_chip", L("TARIFICATION LLD", "LEASE PRICING"));
    const pillLeft = PAGE_W - M - (doc.getTextWidth(pillTextEarly) + 22);
    const rightColLeft = Math.min(statusBadgeLeft, pillLeft);
    const availW = rightColLeft - M - 16; // 16pt de marge de sécurité

    doc.setFont(BRAND_FONT, "bold");
    doc.setTextColor(...INK);
    let titleSize = 28;
    doc.setFontSize(titleSize);
    while (titleSize > 16 && doc.getTextWidth(titleText) > availW) {
      titleSize -= 1;
      doc.setFontSize(titleSize);
    }
    // Si même à 16pt ça ne rentre pas, on tronque avec ellipse
    let drawn = titleText;
    if (doc.getTextWidth(drawn) > availW) {
      while (drawn.length > 4 && doc.getTextWidth(drawn + "…") > availW) {
        drawn = drawn.slice(0, -1);
      }
      drawn = drawn.trimEnd() + "…";
    }
    doc.text(drawn, M, 140);
  }

  // Sous-titre 13px ≈ 10pt
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const subtitleText = `${v.version} · ${v.category} · ${v.energy}`;
  doc.text(subtitleText, M, 158);
  // Badge éco-score officiel (ouvre l'abattement AEN 70 % — voir tco-calculator.ts) :
  // accolé à droite du sous-titre, sur la même ligne, en vert charte (#35DA76).
  if (v.ecoScoreBool) {
    const GREEN: [number, number, number] = [53, 218, 118];
    const subtitleW = doc.getTextWidth(subtitleText);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(7.5);
    const ecoText = L("ÉCO-SCORE", "ECO-SCORE");
    const ecoW = doc.getTextWidth(ecoText) + 12;
    const ecoX = M + subtitleW + 10;
    doc.setFillColor(...GREEN);
    doc.roundedRect(ecoX, 150, ecoW, 13, 6.5, 6.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(ecoText, ecoX + ecoW / 2, 159, { align: "center" });
  } else if (v.ecoScoreUpcoming) {
    // Éco-score en cours d'obtention : même emplacement, badge contour vert
    // (pas de remplissage plein) pour bien le distinguer du badge confirmé
    // ci-dessus — communication commerciale uniquement, aucun effet fiscal.
    const GREEN: [number, number, number] = [53, 218, 118];
    const subtitleW = doc.getTextWidth(subtitleText);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(7.5);
    const ecoText = L("PROCHAINEMENT ÉCO-SCORÉ", "ECO-SCORE COMING SOON");
    const ecoW = doc.getTextWidth(ecoText) + 12;
    const ecoX = M + subtitleW + 10;
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.8);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(ecoX, 150, ecoW, 13, 6.5, 6.5, "FD");
    doc.setTextColor(...GREEN);
    doc.text(ecoText, ecoX + ecoW / 2, 159, { align: "center" });
  }

  // ─── Encart ALERTE FISCALE — visible si le véhicule génère un malus
  // à l'achat ou une TVS. Permet au client de prendre conscience de la
  // charge fiscale du véhicule au moment de l'arbitrage.
  // Calcul rapide TVS annuelle (taxe CO2 + pollution)
  const malusCo2 = calculateMalusCO2(v.co2 ?? 0);
  const malusPoids = calculateMalusPoids(v.poidsVide ?? 0, v.energy, v.rangeWltp);
  const malusTotal = malusCo2 + malusPoids;
  let taxeCO2Annuelle = 0;
  const co2v = v.co2 ?? 0;
  if (co2v > 4 && v.energy !== "Électrique") {
    const brackets: [number, number, number][] = [[5,45,1],[46,53,2],[54,85,3],[86,105,4],[106,125,10],[126,145,50],[146,165,60],[166,9999,65]];
    for (const [min, max, rate] of brackets) {
      if (co2v >= min) taxeCO2Annuelle += (Math.min(co2v, max) - min + 1) * rate;
    }
  }
  const taxePollution = v.energy === "Électrique" ? 0 : v.energy === "Diesel" ? 650 : 130;
  const tvsAnnuelle = taxeCO2Annuelle + taxePollution;
  // Barre d'alerte fiscale (sous le sous-titre) — jamais affichée pour un
  // utilitaire : exonéré de malus et de TVS (voir tco-calculator.ts).
  if (!isUtilitaireCategory(v.category) && (malusTotal > 0 || tvsAnnuelle > 0)) {
    const ROSE_LIGHT: [number, number, number] = [253, 241, 238]; // Rose 20% charte
    const ROSE_ACCENT: [number, number, number] = [244, 184, 170]; // Rose charte
    const alertY = 168;
    const alertH = 22;
    const alertW = PAGE_W - M * 2 - 120; // laisse place au pill "TARIFICATION LLD" droite
    doc.setFillColor(...ROSE_LIGHT);
    doc.roundedRect(M, alertY, alertW, alertH, 4, 4, "F");
    doc.setFillColor(...ROSE_ACCENT);
    doc.rect(M, alertY, 3, alertH, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    doc.text(L("CHARGES FISCALES À VÉRIFIER", "TAX CHARGES TO REVIEW"), M + 10, alertY + 9);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8);
    const parts: string[] = [];
    if (malusTotal > 0) parts.push(L(`Malus TTC : ${eur(malusTotal)}`, `Penalty (incl. VAT): ${eur(malusTotal)}`));
    if (tvsAnnuelle > 0) parts.push(L(`TVS : ${eur(tvsAnnuelle)} / an`, `TVS: ${eur(tvsAnnuelle)} / year`));
    doc.text(parts.join("  ·  "), M + 10, alertY + 18);
  }

  // Pill "Tarification LLD" à droite (radius pill, fond bleu A5D2FF)
  const pillText = lookupText(TEXTS, "vehicles", "vehicle_tariff_chip", L("TARIFICATION LLD", "LEASE PRICING"));
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(7.5);
  const pillW = doc.getTextWidth(pillText) + 22;
  const pillH = 18;
  const pillX = PAGE_W - M - pillW;
  const pillY = 130;
  doc.setFillColor(...BLEU_ACCENT);
  doc.roundedRect(pillX, pillY, pillW, pillH, 9, 9, "F");
  doc.setTextColor(...INK);
  doc.text(pillText, pillX + pillW / 2, pillY + 12, { align: "center" });

  // ─── Photo + price card côte à côte ───
  // mainY décalé vers le bas si l'encart d'alerte fiscale est présent
  // (sinon il chevaucherait avec le bloc photo/prix). Jamais pour un
  // utilitaire : l'encart n'est de toute façon pas dessiné (voir plus haut).
  const hasFiscalAlert = !isUtilitaireCategory(v.category) && (malusTotal > 0 || tvsAnnuelle > 0);
  const mainY = hasFiscalAlert ? 200 : 175;
  const mainH = 190;
  const photoW = (PAGE_W - M * 2 - 16) * 0.54;
  const cardX = M + photoW + 16;
  const cardW = PAGE_W - M - cardX;

  // Photo : fond bleu light, radius 16, image contain centrée
  doc.setFillColor(...BLEU_LIGHT);
  doc.roundedRect(M, mainY, photoW, mainH, 12, 12, "F");
  await drawImageContain(doc, v.image, M + 12, mainY + 12, photoW - 24, mainH - 36);
  // Caption "Photo non contractuelle"
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 155);
  doc.text(lookupText(TEXTS, "vehicles", "vehicle_photo_disclaimer", L("Photo non contractuelle", "Photo not contractually binding")), M + photoW / 2, mainY + mainH - 8, { align: "center" });

  // Price card NOIRE, radius 16
  doc.setFillColor(...BLACK);
  doc.roundedRect(cardX, mainY, cardW, mainH, 12, 12, "F");

  // Prix remisé = (prix catalogue + options TTC) × (1 - remise%)
  // Les options s'ajoutent AVANT remise pour matcher le calcul AND.
  // sv.options sont saisies en TTC dans le panneau droit (convention UX —
  // le nom du champ "unitHt" est legacy). On ne multiplie donc PAS par 1.2.
  const optionsTotalTtcCard = sv.options.reduce((s, o) => s + o.qty * o.unitHt, 0);
  const priceBeforeDiscount = v.priceTtc + optionsTotalTtcCard;
  const discounted = priceBeforeDiscount * (1 - sv.discountPct / 100);
  // Utilitaire : prix saisis DIRECTEMENT en HT par l'admin (TVA récupérable
  // par l'entreprise sur les véhicules utilitaires, contrairement aux
  // véhicules particuliers) — v.priceTtc / sv.negotiatedMonthly contiennent
  // donc déjà le montant HT pour un utilitaire, aucune conversion à
  // appliquer, seul le libellé change.
  const isUtilPrice = isUtilitaireCategory(v.category);
  const priceUnitLabel = isUtilPrice ? L("HT", "excl. VAT") : L("TTC", "incl. VAT");
  let py = mainY + 22;
  const rowPad = 14;
  const innerX = cardX + rowPad;
  const innerR = cardX + cardW - rowPad;

  // Row 1 : Prix catalogue TTC
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GREY_LABEL_DARK);
  doc.text(isUtilPrice ? L("PRIX CATALOGUE HT", "CATALOG PRICE (excl. VAT)") : lookupText(TEXTS, "vehicles", "vehicle_catalog_label", L("PRIX CATALOGUE TTC", "CATALOG PRICE (incl. VAT)")), innerX, py);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BEIGE);
  doc.text(eur(v.priceTtc), innerR, py, { align: "right" });
  py += 9;
  doc.setDrawColor(70, 67, 62); // séparateur beige@14%
  doc.setLineWidth(0.4);
  doc.line(innerX, py, innerR, py);
  py += 12;

  // Row 2 : Total options TTC (uniquement si des options sont saisies)
  if (optionsTotalTtcCard > 0) {
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GREY_LABEL_DARK);
    doc.text(L(`TOTAL OPTIONS ${priceUnitLabel}`, `TOTAL OPTIONS (${priceUnitLabel})`), innerX, py);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BEIGE);
    doc.text(`+ ${eur(optionsTotalTtcCard)}`, innerR, py, { align: "right" });
    py += 9;
    doc.line(innerX, py, innerR, py);
    py += 12;
  }

  // Rows « Remise commerciale » + « Prix remisé TTC » : masquables soit
  // globalement (toggle showVehicleDiscount), soit véhicule par véhicule
  // (sv.hideDiscount, case sur la carte du panneau de droite). Le pourcentage
  // de remise reste TOUJOURS pris en compte dans le calcul de l'AND (via
  // sv.discountPct → remisePctOverride), qu'il soit affiché ou non.
  if (PDF_CFG.showVehicleDiscount && !sv.hideDiscount) {
    // Row 3 : Remise commerciale (sur catalogue + options)
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GREY_LABEL_DARK);
    doc.text(lookupText(TEXTS, "vehicles", "vehicle_discount_label", L("REMISE COMMERCIALE", "COMMERCIAL DISCOUNT")), innerX, py);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BEIGE);
    doc.text(`−${sv.discountPct.toFixed(1)} %`, innerR, py, { align: "right" });
    py += 9;
    doc.line(innerX, py, innerR, py);
    py += 12;

    // Row 4 : Prix remisé
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GREY_LABEL_DARK);
    doc.text(isUtilPrice ? L("PRIX REMISÉ HT", "DISCOUNTED PRICE (excl. VAT)") : lookupText(TEXTS, "vehicles", "vehicle_price_remise_label", L("PRIX REMISÉ TTC", "DISCOUNTED PRICE (incl. VAT)")), innerX, py);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BEIGE);
    doc.text(eur(discounted), innerR, py, { align: "right" });
    py += 16;
  }

  // Séparateur épais avant le bloc loyer
  doc.setDrawColor(70, 67, 62);
  doc.setLineWidth(0.6);
  doc.line(innerX, py, innerR, py);
  py += 16;

  // Bloc pc-loyer : label bleu + gros chiffre + note
  // py += 8 supplémentaires (28 au lieu de 26) pour aérer la respiration
  // entre le sous-titre "LOYER MENSUEL TTC · X MOIS" et le gros chiffre.
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLEU_ACCENT);
  const loyerLabel = isUtilPrice ? L("LOYER MENSUEL HT", "MONTHLY LEASE (excl. VAT)") : lookupText(TEXTS, "vehicles", "vehicle_monthly_label", L("LOYER MENSUEL TTC", "MONTHLY LEASE (incl. VAT)"));
  doc.text(ADMIN_MODE ? loyerLabel : `${loyerLabel} · ${sv.durationMonths} ${L("MOIS", "MONTHS")}`, innerX, py);
  py += 32;
  // Gros chiffre 36pt + "/ mois" 12pt à côté
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(34);
  doc.setTextColor(...BEIGE);
  const monthlyText = eurLoyer(sv.negotiatedMonthly);
  doc.text(monthlyText, innerX, py);
  const monthlyW = doc.getTextWidth(monthlyText);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(11);
  doc.setTextColor(...GREY_ON_DARK);
  doc.text(L(" / mois", " / month"), innerX + monthlyW + 2, py - 2);
  py += 14;
  // Note multi-véhicules
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GREY_LABEL_DARK);
  const kmContratTxt = fmt(Math.round(sv.kmPerYear * sv.durationMonths / 12));
  const noteText = ADMIN_MODE
    ? L(`× ${sv.quantity} véhicule${sv.quantity > 1 ? "s" : ""} · ${sv.durationMonths} mois · ${kmContratTxt} km au contrat`, `× ${sv.quantity} vehicle${sv.quantity > 1 ? "s" : ""} · ${sv.durationMonths} months · ${kmContratTxt} km over the contract`)
    : L(`× ${sv.quantity} véhicule${sv.quantity > 1 ? "s" : ""} · ${kmContratTxt} km (contrat) · prestations incluses`, `× ${sv.quantity} vehicle${sv.quantity > 1 ? "s" : ""} · ${kmContratTxt} km (contract) · services included`);
  const noteLines = doc.splitTextToSize(noteText, cardW - rowPad * 2);
  doc.text(noteLines, innerX, py);

  let y = mainY + mainH + 18;

  // N° de devis loueur (sous la proposition Beev / tarification LLD) — aide à
  // retrouver l'offre préparée chez le loueur.
  if (sv.leaserQuoteRef && sv.leaserQuoteRef.trim()) {
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SUB);
    doc.text(L(`N° de devis loueur : ${sv.leaserQuoteRef.trim()}`, `Lessor quote no.: ${sv.leaserQuoteRef.trim()}`), M, y);
    y += 16;
  }

  // Prime CEE — utilitaire électrique uniquement. Le montant est intégré au
  // loyer affiché plus haut : le client doit savoir qu'il l'avance et se le
  // fait rembourser par la suite, sans quoi le loyer réel perçu serait erroné.
  if (sv.primeCeeAmount && sv.primeCeeAmount > 0) {
    const ceeText = L(
      `Une prime CEE de ${eur(sv.primeCeeAmount)} est intégrée à ce loyer mensuel. Ce montant est avancé par l'entreprise à la mise en service du véhicule, puis remboursé par l'organisme émetteur du certificat d'économie d'énergie dans un délai de 2 à 3 mois.`,
      `A CEE incentive (Certificat d'Économie d'Énergie, a French energy-savings scheme) of ${eur(sv.primeCeeAmount)} is included in this monthly lease. This amount is advanced by the company when the vehicle enters service, then reimbursed by the certificate issuer within 2 to 3 months.`,
    );
    const ceeLines = doc.splitTextToSize(ceeText, PAGE_W - M * 2 - 24) as string[];
    const ceeH = ceeLines.length * 11 + 28;
    y = ensureSpace(doc, y, ceeH + 10, client, type);
    doc.setFillColor(...BLEU_LIGHT);
    doc.rect(M, y, PAGE_W - M * 2, ceeH, "F");
    doc.setFillColor(...BLEU_ACCENT);
    doc.rect(M, y, 3, ceeH, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...BLEU_ACCENT);
    doc.text(L("PRIME CEE", "CEE INCENTIVE"), M + 14, y + 12);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    doc.text(ceeLines, M + 14, y + 25);
    y += ceeH + 14;
  }

  // Configurations alternatives — si le commercial a ajouté plusieurs scénarios
  // durée/km/loyer pour ce véhicule, on les présente en tableau comparatif
  // juste après la price card pour aider le client à choisir son scénario.
  const altConfigs = sv.additionalConfigs ?? [];
  if (altConfigs.length > 0) {
    y = ensureSpace(doc, y, 80 + altConfigs.length * 18, client, type);
    // Bandeau d'introduction
    const altLabel = lookupText(TEXTS, "vehicles", "vehicle_alt_configs_label", L("CONFIGURATIONS ALTERNATIVES", "ALTERNATIVE CONFIGURATIONS"));
    const altSub = L(`${altConfigs.length + 1} scénarios disponibles selon vos besoins de kilométrage et de durée.`, `${altConfigs.length + 1} scenarios available based on your mileage and duration needs.`);
    if (ADMIN_MODE) {
      // v2 : barre d'accent + label + sous-titre, sans encart.
      doc.setFillColor(...PRODUCT_ACCENT);
      doc.rect(M, y + 2, 24, 2.5, "F");
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...GREY_TXT);
      doc.text(altLabel, M + 32, y + 6);
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(9);
      doc.setTextColor(122, 122, 122);
      doc.text(altSub, M + 32, y + 20);
      y += 32;
    } else {
      doc.setFillColor(...BLEU_LIGHT);
      doc.roundedRect(M, y, PAGE_W - M * 2, 26, 6, 6, "F");
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...LAVENDER);
      doc.text(altLabel, M + 12, y + 11);
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(altSub, M + 12, y + 22);
      y += 32;
    }

    // Table comparative : principale + alternatives
    autoTable(doc, {
      startY: y,
      theme: "plain",
      head: [[
        lookupText(TEXTS, "vehicles", "vehicle_scenarios_head_label", L("Scénario", "Scenario")),
        lookupText(TEXTS, "vehicles", "vehicle_scenarios_head_duration", L("Durée", "Duration")),
        lookupText(TEXTS, "vehicles", "vehicle_scenarios_head_kmtotal", L("Km total (contrat)", "Total km (contract)")),
        lookupText(TEXTS, "vehicles", "vehicle_scenarios_head_monthly", L("Loyer mensuel TTC", "Monthly lease (incl. VAT)")),
      ]],
      body: [
        [
          { content: L("Principal", "Main"), styles: { fontStyle: "bold", textColor: ADMIN_MODE ? INK : LAVENDER, ...(ADMIN_MODE ? { fillColor: accMid } : {}) } },
          { content: `${sv.durationMonths} ${L("mois", "months")}`, styles: ADMIN_MODE ? { fillColor: accMid, textColor: GREY_TXT } : {} },
          { content: fmt(Math.round(sv.kmPerYear * sv.durationMonths / 12)), styles: ADMIN_MODE ? { fillColor: accMid, textColor: GREY_TXT } : {} },
          { content: eurLoyer(sv.negotiatedMonthly), styles: { fontStyle: "bold", textColor: ADMIN_MODE ? INK : LAVENDER, halign: "right", ...(ADMIN_MODE ? { fillColor: accMid } : {}) } },
        ],
        ...altConfigs.map((c, i) => [
          { content: `${L("Alternative", "Alternative")} ${i + 1}`, styles: { textColor: SUB } },
          `${c.durationMonths} ${L("mois", "months")}`,
          fmt(Math.round(c.kmPerYear * c.durationMonths / 12)),
          { content: eurLoyer(c.negotiatedMonthly), styles: { fontStyle: "bold", halign: "right" } },
        ]),
      ],
      headStyles: { fillColor: ADMIN_MODE ? accSoft : LAVENDER, textColor: (ADMIN_MODE ? GREY_TXT : 255) as any, fontSize: 8.5, fontStyle: "bold", font: BRAND_FONT, cellPadding: 6 },
      bodyStyles: { fontSize: 9.5, cellPadding: 6, textColor: INK, lineColor: RULE, lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 } as any, font: BRAND_FONT },
      alternateRowStyles: { fillColor: [252, 251, 248] as [number, number, number] },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { halign: "center", cellWidth: 80 },
        2: { halign: "right", cellWidth: 110 },
        3: { halign: "right" },
      },
      margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  // Caractéristiques techniques : liste candidate (source unique partagée avec
  // le panneau de droite) filtrée des clés que le commercial a choisi de masquer
  // pour CE véhicule (sv.hiddenSpecs). Si tout est masqué, on saute le tableau.
  const hiddenSpecKeys = new Set(sv.hiddenSpecs ?? []);
  const specRows = getVehicleSpecRows(v, PDF_CFG, PDF_LANG).filter((r) => !hiddenSpecKeys.has(r.key));
  if (ADMIN_MODE && specRows.length > 0) {
    // v2 : bloc deux colonnes — caractéristiques (gauche) + compris dans le
    // loyer (droite, icônes accent). Reproduit la maquette de référence.
    y = ensureSpace(doc, y, 210, client, type);
    const contentW = PAGE_W - M * 2;
    const colGap = 30;
    const leftW = Math.round(contentW * 0.56);
    const rightX = M + leftW + colGap;
    const top = y;

    // Colonne gauche : caractéristiques techniques
    doc.setFillColor(...PRODUCT_ACCENT);
    doc.rect(M, top, 22, 2.5, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...GREY_TXT);
    doc.text(L("CARACTÉRISTIQUES TECHNIQUES", "TECHNICAL SPECIFICATIONS"), M + 30, top + 4);
    let ly = top + 26;
    for (const r of specRows.slice(0, 7)) {
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(10);
      doc.setTextColor(...GREY_TXT);
      doc.text(r.label, M, ly);
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      doc.text(r.value, M + leftW, ly, { align: "right" });
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.4);
      doc.line(M, ly + 7, M + leftW, ly + 7);
      ly += 22;
    }

    // Colonne droite : compris dans le loyer (icônes accent-soft + check)
    doc.setFillColor(...PRODUCT_ACCENT);
    doc.rect(rightX, top, 22, 2.5, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...GREY_TXT);
    doc.text(L("COMPRIS DANS LE LOYER", "INCLUDED IN THE LEASE"), rightX + 30, top + 4);
    let ry = top + 22;
    const svcs = [...MANDATORY_SERVICES, ...sv.services].slice(0, 5);
    const svcTextX = rightX + 30;
    const svcTextW = M + contentW - svcTextX; // largeur restante jusqu'à la marge droite
    for (const svc of svcs) {
      doc.setFillColor(...accSoft);
      doc.roundedRect(rightX, ry, 22, 22, 7, 7, "F");
      doc.setDrawColor(...accDeep);
      doc.setLineWidth(1.4);
      doc.line(rightX + 6, ry + 11.5, rightX + 9.5, ry + 15);
      doc.line(rightX + 9.5, ry + 15, rightX + 16, ry + 7.5);
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      const svcLines: string[] = doc.splitTextToSize(svc, svcTextW);
      doc.text(svcLines, svcTextX, ry + 15);
      ry += Math.max(30, svcLines.length * 13 + 8);
    }
    // Fin des deux colonnes : on repart sous la plus profonde.
    y = Math.max(ly, ry) + 18;

    // Options & accessoires — PLEINE LARGEUR sous les deux colonnes, même
    // disposition que « Caractéristiques techniques » (barre d'accent + label,
    // lignes label / montant avec filets). Affiché seulement s'il y en a.
    const fOpts = (PDF_CFG.showVehicleOptions ? sv.options : []) ?? [];
    if (fOpts.length > 0) {
      y = ensureSpace(doc, y, 44 + fOpts.length * 22, client, type);
      doc.setFillColor(...PRODUCT_ACCENT);
      doc.rect(M, y, 22, 2.5, "F");
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...GREY_TXT);
      doc.text(L("OPTIONS & ACCESSOIRES", "OPTIONS & ACCESSORIES"), M + 30, y + 4);
      y += 24;
      for (const o of fOpts.slice(0, 8)) {
        const lbl = o.qty > 1 ? `${o.label} ×${o.qty}` : o.label;
        doc.setFont(BRAND_FONT, "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(...GREY_TXT);
        doc.text(lbl, M, y, { maxWidth: contentW - 90 });
        doc.setFont(BRAND_FONT, "bold");
        doc.setFontSize(11);
        doc.setTextColor(...accDeep);
        doc.text(eur(o.qty * o.unitHt), M + contentW, y, { align: "right" });
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.4);
        doc.line(M, y + 7, M + contentW, y + 7);
        y += 22;
      }
      y += 6;
    }
  } else if (specRows.length > 0) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [[L("Caractéristique technique", "Technical specification"), L("Valeur", "Value")]],
      body: specRows.map((r) => [r.label, r.value]),
      headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold", font: BRAND_FONT },
      bodyStyles: { fontSize: 9.5, cellPadding: 6, textColor: INK, lineColor: RULE, font: BRAND_FONT },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
      margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // Garde-fou espace : bloc TCO + encart fiscal = ~250px de haut.
  // Si on est trop bas dans la page, on saute le bloc pour éviter un
  // débordement sur le footer — SAUF pour la flotte actuelle : le TCO est le
  // point de comparaison attendu sur ce véhicule, on force un saut de page
  // plutôt que de le faire disparaître silencieusement (comportement observé
  // et signalé). Les véhicules proposés gardent le comportement d'origine.
  if (PDF_CFG.showVehicleTcoBlock && sv.vehicle.isCurrentFleet) {
    y = ensureSpace(doc, y, 250, client, type);
  }
  if (PDF_CFG.showVehicleTcoBlock && (sv.includeTco || sv.vehicle.isCurrentFleet) && y < FOOTER_LIMIT - 250) {
    const t = computeTco(sv, e);
    // Vérifie si on a une TCO synchronisée depuis beev-tco-2026
    const synced = TCO_RESULTS.get(sv.vehicle.id);
    // Utilise les valeurs synchronisées si disponibles, sinon le calcul interne
    const tco100 = synced?.tcoPer100km ?? t.tco100;
    const lease100 = synced?.leasePer100km ?? t.lease100;
    const energy100 = synced?.energyPer100km ?? t.energy100;
    const tcoMonthly = synced?.tcoPerYear ? synced.tcoPerYear / 12 : t.tco100 * (sv.kmPerYear / 100) / 12;
    const tcoTotal = synced?.tcoTotalContract ?? t.tco100 * (sv.kmPerYear / 100) * (sv.durationMonths / 12);

    // hasFiscalBlock vrai dès que synced OU includeTco OU flotte actuelle
    // (cf. fin du bloc) — un véhicule marqué flotte actuelle doit toujours
    // avoir son encart fiscal, même quand includeTco est resté à false
    // (ex. ajouté manuellement puis coché "flotte actuelle" après coup).
    const hasFiscalBlock = !!synced || sv.includeTco || sv.vehicle.isCurrentFleet;
    const cardH = hasFiscalBlock ? 130 : 100;
    // Hauteur réelle de la carte (KPIs + encart fiscal optionnel)
    const totalCardH = cardH + (hasFiscalBlock ? 120 : 0);

    doc.setFillColor(...BG);
    doc.rect(M, y, PAGE_W - M * 2, totalCardH, "F");
    doc.setFillColor(...ACCENT);
    doc.rect(M, y, 4, totalCardH, "F");

    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...SUB);
    doc.text(lookupText(TEXTS, "vehicles", "vehicle_tco_block_title", L("COÛT TOTAL DE POSSESSION (TCO)", "TOTAL COST OF OWNERSHIP (TCO)")), M + 16, y + 16);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7.5);
    doc.text(L(`${sv.durationMonths} mois · ${fmt(Math.round(sv.kmPerYear * sv.durationMonths / 12))} km (contrat) · estimation non contractuelle`, `${sv.durationMonths} months · ${fmt(Math.round(sv.kmPerYear * sv.durationMonths / 12))} km (contract) · non-contractual estimate`), M + 16, y + 27);

    // Badge "TCO calculé via Beev 2026" si données synchronisées
    if (synced) {
      const badgeText = L("✓ TCO précis Beev 2026", "✓ Precise Beev 2026 TCO");
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(7);
      const badgeW = doc.getTextWidth(badgeText) + 16;
      doc.setFillColor(...ACCENT);
      doc.roundedRect(PAGE_W - M - badgeW - 16, y + 8, badgeW, 14, 4, 4, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(badgeText, PAGE_W - M - 16 - 8, y + 17, { align: "right" });
    }

    // ===== 4 KPIs côte à côte : TCO/100km · Loyer/100km · Énergie/100km · TCO total =====
    const kpiY = y + 40;
    const kpis = [
      { label: "TCO / 100 KM", value: eur2(tco100), accent: true },
      { label: L("LOYER / 100 KM", "LEASE / 100 KM"), value: eur2(lease100) },
      { label: L("ÉNERGIE / 100 KM", "ENERGY / 100 KM"), value: eur2(energy100) },
      { label: L("TCO MENSUEL", "MONTHLY TCO"), value: eur(tcoMonthly) },
    ];
    const kpiW = (PAGE_W - M * 2 - 32) / kpis.length;
    kpis.forEach((kpi, i) => {
      const kx = M + 16 + i * kpiW;
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(7);
      doc.setTextColor(...SUB);
      doc.text(kpi.label, kx, kpiY);
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(kpi.accent ? 17 : 14);
      doc.setTextColor(kpi.accent ? ACCENT[0] : INK[0], kpi.accent ? ACCENT[1] : INK[1], kpi.accent ? ACCENT[2] : INK[2]);
      doc.text(kpi.value, kx, kpiY + 18);
    });

    // Charges fiscales annexes : on calcule à la volée via calculateTcoFull
    // (calcul officiel beev-tco-2026). synced (depuis la DB tco_results) sert
    // de fallback pour rétro-compat.
    if (hasFiscalBlock) {
      const fiscalY = y + 80;
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.4);
      doc.line(M + 16, fiscalY, PAGE_W - M - 16, fiscalY);

      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(7);
      doc.setTextColor(...LAVENDER);
      doc.text(lookupText(TEXTS, "vehicles", "vehicle_tco_fiscal_title", L("CHARGES FISCALES ANNEXES (CALCUL BEEV 2026)", "ADDITIONAL TAX CHARGES (BEEV 2026 CALCULATION)")), M + 16, fiscalY + 12);

      // Calcul TCO complet à la volée — intègre options + remise commerciale.
      // sv.options sont saisies en TTC dans le panneau droit (convention UX).
      const duree = sv.durationMonths / 12;
      const dureeEntiere = Math.floor(duree);
      const optionsTotalTtc = sv.options.reduce((s, o) => s + o.qty * o.unitHt, 0);
      const tcoFull = calculateTcoFull(sv.vehicle, {
        dureeAnnees: duree,
        kmContrat: sv.kmPerYear * duree,
        prixEssenceLitre: e.fuelPriceL ?? 1.75,
        prixKwhDomicile: e.kWhHome ?? 0.4,
        prixKwhPublic: e.kWhPublic ?? 0.6,
        optionsTotalTtc,
        remisePctOverride: sv.discountPct,
      }, sv.negotiatedMonthly);
      const tvsTotal = tcoFull.tvsTotal;
      const andAnnuel = tcoFull.andAnnuel;
      const aenAnnuel = tcoFull.aenAnnuel;
      const partEmpAnnuelle = tcoFull.partEmployeurAnnuelle;
      // Coût employeur complet : reconstruit à partir du `tcoTotal` OFFICIEL
      // affiché juste au-dessus (synced beev-tco-2026 si disponible, sinon
      // calcul local — ligne 3253), PAS de tcoFull.tcoTotal qui peut différer
      // (ex. options/remise pris en compte différemment). Utiliser
      // tcoFull.tcoEmployeurComplet ici cassait la cohérence avec "TCO TOTAL
      // CONTRAT" affiché en dessous (coût employeur pouvait apparaître
      // inférieur au TCO total, ce qui est fiscalement impossible).
      // L'AND n'entre pas pour son montant brut — voir coutFiscalANDAnnuel
      // dans tco-calculator.ts : l'entreprise ne décaisse pas andAnnuel, elle
      // perd seulement la déduction fiscale dessus ; le vrai surcoût est
      // l'IS supplémentaire (25%) sur ce montant.
      const tcoEmployeur = tcoTotal + tcoFull.coutFiscalANDTotal + tcoFull.aenEmployeurTotal;

      // Ligne 1 : 3 colonnes (Malus CO2, Malus poids, TVS contrat).
      // Couleur orange si valeur > 0 pour signaler la charge à l'achat.
      const ORANGE: [number, number, number] = [217, 119, 6]; // amber-600
      const row1Y = fiscalY + 22;
      const row1 = [
        { label: L("MALUS CO2", "CO2 PENALTY"), value: tcoFull.malusCO2, formatted: eur(tcoFull.malusCO2) },
        { label: L("MALUS POIDS", "WEIGHT PENALTY"), value: tcoFull.malusPoids, formatted: eur(tcoFull.malusPoids) },
        { label: `TVS (${dureeEntiere} ${L("ANS", "YEARS")})`, value: tvsTotal, formatted: eur(tvsTotal) },
      ];
      const colW = (PAGE_W - M * 2 - 32) / 3;
      row1.forEach((col, i) => {
        const cx = M + 16 + i * colW;
        const isCharge = col.value > 0;
        doc.setFont(BRAND_FONT, "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...SUB);
        doc.text(col.label, cx, row1Y);
        doc.setFont(BRAND_FONT, "bold");
        doc.setFontSize(11);
        if (isCharge) doc.setTextColor(...ORANGE);
        else doc.setTextColor(...INK);
        doc.text(col.formatted, cx, row1Y + 14);
      });

      // Ligne 2 : 3 colonnes (AND annuel, AEN annuel, Part employeur AEN)
      const row2Y = row1Y + 32;
      const row2 = [
        { label: L("AND / AN (NON DÉCAISSÉ)", "AND / YEAR (NOT DISBURSED)"), value: eur(andAnnuel) },
        { label: L("AEN ANNUEL", "ANNUAL AEN"), value: eur(aenAnnuel) },
        { label: L("PART EMPLOYEUR AEN / AN", "AEN EMPLOYER SHARE / YEAR"), value: eur(partEmpAnnuelle) },
      ];
      row2.forEach((col, i) => {
        const cx = M + 16 + i * colW;
        doc.setFont(BRAND_FONT, "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...SUB);
        doc.text(col.label, cx, row2Y);
        doc.setFont(BRAND_FONT, "bold");
        doc.setFontSize(11);
        doc.setTextColor(...INK);
        doc.text(col.value, cx, row2Y + 14);
      });

      // Ligne récap : TCO total contrat + TCO employeur complet
      const recapY = row2Y + 28;
      doc.setDrawColor(...RULE);
      doc.line(M + 16, recapY, PAGE_W - M - 16, recapY);
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(7);
      doc.setTextColor(...SUB);
      doc.text(L("TCO TOTAL CONTRAT", "TOTAL TCO OVER CONTRACT"), M + 16, recapY + 14);
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(13);
      doc.setTextColor(...INK);
      doc.text(eur(tcoTotal), M + 16, recapY + 30);

      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(7);
      doc.setTextColor(...LAVENDER);
      doc.text(L("COÛT EMPLOYEUR COMPLET (TCO + IS/AND + AEN)", "FULL EMPLOYER COST (TCO + IS/AND + AEN)"), PAGE_W - M - 16, recapY + 14, { align: "right" });
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(13);
      doc.setTextColor(...LAVENDER);
      doc.text(eur(tcoEmployeur), PAGE_W - M - 16, recapY + 30, { align: "right" });
    }

    // Avance du Y : utilise la hauteur totale déjà calculée (BG + encart fiscal)
    y += totalCardH + 12;

    // ROI installation borne domicile — uniquement pour un véhicule électrique
    // dont le TCO est calculé (même condition que l'encart fiscal ci-dessus).
    if (sv.vehicle.energy === "Électrique") {
      y = drawHomeChargerRoi(doc, y, sv.vehicle, e, client, type);
    }
  }

  // Admin (v2) : prestations & services ET le détail des options sont désormais
  // présentés dans la rubrique « Compris dans le loyer » de la fiche → pas de
  // tableau noir redondant en bas de page.
  if (ADMIN_MODE) return;

  const body: any[] = [];
  if (PDF_CFG.showVehicleServices) {
    const allServices = [...MANDATORY_SERVICES, ...sv.services.filter((s) => !MANDATORY_SERVICES.includes(s as any))];
    const servicesText = allServices.map((s) => `· ${s}`).join("\n");
    body.push([{ content: L("Prestations & services compris dans le loyer", "Services included in the lease"), colSpan: 4, styles: { fillColor: BG, fontStyle: "bold", textColor: INK } }]);
    body.push([{ content: servicesText, colSpan: 4, styles: { fontSize: 9.5, textColor: INK } }]);
  }
  if (PDF_CFG.showVehicleOptions && sv.options.length) {
    body.push([{ content: L("Options & accessoires inclus", "Options & accessories included"), colSpan: 4, styles: { fillColor: BG, fontStyle: "bold", textColor: INK } }]);
    sv.options.forEach((li) => body.push([li.label, String(li.qty), eur2(li.unitHt), eur2(li.qty * li.unitHt)]));
  }
  // Si tout est masqué, on saute le tableau pour ne pas avoir un cadre vide.
  if (body.length === 0) return;
  y = ensureSpace(doc, y, 80, client, type);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [[L("Désignation", "Description"), L("Qté", "Qty"), L("PU HT", "Unit price (excl. VAT)"), L("Total HT", "Total (excl. VAT)")]],
    body: body as any,
    headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold", font: BRAND_FONT },
    bodyStyles: { fontSize: 9, cellPadding: 6, textColor: INK, lineColor: RULE, font: BRAND_FONT },
    columnStyles: { 1: { halign: "center", cellWidth: 40 }, 2: { halign: "right", cellWidth: 70 }, 3: { halign: "right", cellWidth: 80, fontStyle: "bold" } },
    margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
  });
}

// ============ FICHE BORNE / SITE ============
// Bloc « Offre en location » : chiffres clés (loyer, durée, total loyers,
// option d'achat) + tableau de résiliation anticipée + clause. Présentation pro
// dans la charte Beev. Remplace le chiffrage à l'achat pour cette borne.
function drawChargerLeaseBlock(doc: jsPDF, sc: SelectedCharger, y: number, client: ClientInfo, type: ProjectType): number {
  // Montants exacts : pas d'arrondi, on n'affiche les centimes que s'ils existent.
  const money = (n: number) => (Number.isInteger(n) ? eur(n) : eur2(n));
  const fullW = PAGE_W - M * 2;
  const qty = chargerQtyMultiplier(sc);
  // Formules : formule principale (leaseMonthly / leaseDurationMonths) + formules
  // supplémentaires (leaseConfigs). On ne garde que celles dûment renseignées.
  const extras = (sc.leaseConfigs ?? []).filter((cfg) => (cfg.monthly ?? 0) > 0 && (cfg.durationMonths ?? 0) > 0);
  const scenarios = [computeChargerLease(sc), ...extras.map((cfg) => computeLeaseScenario(cfg.monthly, cfg.durationMonths, qty))]
    .filter((s) => s.monthly > 0 && s.duration > 0);
  if (scenarios.length === 0) scenarios.push(computeChargerLease(sc));
  const multiLease = scenarios.length > 1;

  y = ensureSpace(doc, y, 200, client, type);

  // En-tête
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...LAVENDER);
  doc.text(multiLease ? `OFFRE EN LOCATION · ${scenarios.length} FORMULES AU CHOIX` : "OFFRE EN LOCATION", M, y);
  y += 14;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SUB);
  doc.text(sc.leaseEquipmentOnly ? "Location du matériel seul · installation non comprise" : "Location du matériel, installation comprise", M, y);
  y += 16;

  for (const L of scenarios) {
    // Sous-titre par formule (uniquement quand plusieurs formules).
    if (multiLease) {
      y = ensureSpace(doc, y, 130, client, type);
      doc.setFillColor(...ACCENT);
      doc.rect(M, y - 9, 18, 14, "F");
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      doc.text(`Formule ${L.duration} mois · ${money(L.monthly)} HT/mois${L.qty > 1 ? ` × ${L.qty} bornes` : ""}`, M + 26, y + 2);
      y += 18;
    }

  // Panneau « financement » : nombre de bornes + calcul EXACT du total des loyers.
  const qtyTerm = L.qty > 1 ? ` × ${L.qty} bornes` : "";
  const formula = `${money(L.monthly)} HT/mois${qtyTerm} × ${L.duration} mois  =  ${money(L.totalRents)} HT`;
  const panelH = 92;
  doc.setFillColor(...BG);
  doc.rect(M, y, fullW, panelH, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(M, y, 4, panelH, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUB);
  doc.text(`FINANCEMENT · ${L.qty} BORNE${L.qty > 1 ? "S" : ""} INCLUSE${L.qty > 1 ? "S" : ""}`, M + 14, y + 18);
  // Libellé + calcul exact du total des loyers
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text("TOTAL DES LOYERS HT", M + 14, y + 38);
  doc.setFont(BRAND_FONT, "bold");
  let fSize = 13;
  doc.setFontSize(fSize);
  // Auto-ajustement : réduit la taille si la formule dépasse la largeur du panneau.
  const maxW = fullW - 28;
  while (fSize > 8 && doc.getTextWidth(formula) > maxW) { fSize -= 0.5; doc.setFontSize(fSize); }
  doc.setTextColor(...INK);
  doc.text(formula, M + 14, y + 58);
  // Option d'achat
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SUB);
  doc.text(`Option d'achat en fin de contrat (10% du total des loyers) : `, M + 14, y + 78);
  const w = doc.getTextWidth(`Option d'achat en fin de contrat (10% du total des loyers) : `);
  doc.setFont(BRAND_FONT, "bold");
  doc.setTextColor(...INK);
  doc.text(`${money(L.buyout)} HT`, M + 14 + w, y + 78);
  y += panelH + 18;

  // Échéancier de prélèvement TRIMESTRIEL : le loyer est calculé au mois et
  // prélevé tous les 3 mois. Tableau clair et lisible pour le client (période,
  // détail mensuel, montant prélevé, cumul).
  if (L.installments.length) {
    y = ensureSpace(doc, y, 110, client, type);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...LAVENDER);
    doc.text("ÉCHÉANCIER DE PRÉLÈVEMENT · TRIMESTRIEL", M, y);
    y += 12;
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUB);
    const intro = `Loyer calculé au mois (${money(L.monthlyTotal)} HT/mois${L.qty > 1 ? ` pour ${L.qty} bornes` : ""}), prélevé par trimestre : ${money(L.quarterlyAmount)} HT tous les 3 mois.`;
    const introLines = doc.splitTextToSize(intro, fullW);
    doc.text(introLines, M, y);
    y += introLines.length * 11 + 6;
    autoTable(doc, {
      startY: y,
      theme: "plain",
      head: [["Échéance", "Période", "Détail mensuel", "Montant prélevé HT", "Cumul HT"]],
      body: L.installments.map((q) => [
        `Trimestre ${q.index}`,
        `Mois ${q.fromMonth} à ${q.toMonth}`,
        `${q.months} × ${money(L.monthlyTotal)}`,
        money(q.amount),
        money(q.cumulative),
      ]),
      headStyles: { fillColor: LAVENDER, textColor: 255, fontSize: 8.5, fontStyle: "bold", font: BRAND_FONT, cellPadding: 7, halign: "left" },
      bodyStyles: { fontSize: 9.5, cellPadding: 7, textColor: INK, lineColor: RULE, lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 } as any, font: BRAND_FONT },
      alternateRowStyles: { fillColor: [252, 251, 248] as [number, number, number] },
      columnStyles: {
        0: { cellWidth: 90, fontStyle: "bold" },
        1: { cellWidth: 110 },
        2: { halign: "right", cellWidth: 120 },
        3: { halign: "right", cellWidth: 110, fontStyle: "bold", textColor: LAVENDER },
        4: { halign: "right" },
      },
      margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 18;
  }

  // Coût global de résiliation anticipée : loyers restants + pénalité 10% = total HT à régler.
  if (L.schedule.length) {
    y = ensureSpace(doc, y, 90, client, type);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...LAVENDER);
    doc.text("COÛT DE RÉSILIATION ANTICIPÉE", M, y);
    y += 12;
    autoTable(doc, {
      startY: y,
      theme: "plain",
      head: [["Résiliation anticipée", "Loyers restants HT", "Pénalité 10% HT", "Total HT à régler"]],
      body: L.schedule.map((s) => {
        const years = Math.round(s.afterMonths / 12);
        const penalty10 = s.remainingRents * 0.10;
        return [
          `Après ${years} an${years > 1 ? "s" : ""}`,
          money(s.remainingRents),
          money(penalty10),
          money(s.penalty),
        ];
      }),
      headStyles: { fillColor: LAVENDER, textColor: 255, fontSize: 8.5, fontStyle: "bold", font: BRAND_FONT, cellPadding: 7, halign: "left" },
      bodyStyles: { fontSize: 9.5, cellPadding: 7, textColor: INK, lineColor: RULE, lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 } as any, font: BRAND_FONT },
      alternateRowStyles: { fillColor: [252, 251, 248] as [number, number, number] },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { halign: "right", cellWidth: 110 },
        2: { halign: "right", cellWidth: 100 },
        3: { halign: "right", cellWidth: 110, fontStyle: "bold", textColor: LAVENDER },
      },
      margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }
  } // fin boucle formules de location

  // Clause
  const clause = "Condition de résiliation anticipée : en cas de rupture du contrat avant son terme, une pénalité égale aux loyers restant dus, majorés de 10%, est exigible (« Total HT à régler »). À l'échéance du contrat, l'option d'achat de l'équipement s'élève à 10% du total des loyers versés.";
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  const cl = doc.splitTextToSize(clause, fullW);
  const clH = cl.length * 11 + 8;
  y = ensureSpace(doc, y, clH + 6, client, type);
  doc.text(cl, M, y);
  y += clH;
  return y;
}

async function drawChargerPage(doc: jsPDF, sc: SelectedCharger, type: ProjectType, idx: number, total: number, client: ClientInfo) {
  const isHome = type === "home";
  eyebrow(doc, `${isHome ? "COLLABORATEUR" : "SITE"} ${idx} / ${total}`, 116);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(sc.siteName || `${sc.charger.brand} ${sc.charger.model}`, M, 148);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(11);
  doc.setTextColor(...SUB);
  doc.text(`${sc.charger.brand} ${sc.charger.model} · ${sc.charger.powerKw} kW · ${sc.charger.type}`, M, 166);
  if (sc.siteAddress) {
    doc.setFontSize(10);
    doc.text(sc.siteAddress, M, 182);
  }

  // Image (format auto, ratio préservé) + features
  const imgY = 200;
  const imgW = 200;
  const imgH = 150;
  doc.setFillColor(...BG);
  doc.rect(M, imgY, imgW, imgH, "F");
  await drawImageContain(doc, sc.charger.image, M + 6, imgY + 6, imgW - 12, imgH - 12);
  // Mention "(photo non contractuelle)" sous l'image
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 155);
  doc.text("(photo non contractuelle)", M + imgW / 2, imgY + imgH + 8, { align: "center" });

  const fx = M + imgW + 18;
  const colMaxW = PAGE_W - M - fx - 4;
  let fy = imgY + 14;

  // POINTS FORTS d'abord (compact, bullets courtes) — bloc principal à droite
  // de l'image. La description longue passe en bas en pleine largeur si elle
  // existe, pour éviter d'écraser le tableau de chiffrage.
  if (PDF_CFG.showChargerFeatures) {
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...LAVENDER);
    doc.text(lookupText(TEXTS, "vehicles", "vehicle_strengths_label", "POINTS FORTS"), fx, fy);
    fy += 14;
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    sc.charger.features.forEach((f) => {
      doc.setDrawColor(...ACCENT);
      doc.setLineWidth(1.4);
      doc.line(fx + 1, fy - 3.5, fx + 4, fy - 1);
      doc.line(fx + 4, fy - 1, fx + 7, fy - 6);
      doc.setLineWidth(0.2);
      const tt = doc.splitTextToSize(f, colMaxW - 14);
      doc.text(tt, fx + 12, fy);
      fy += tt.length * 14;
    });
  }
  if (sc.siteContact) {
    fy += 8;
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...LAVENDER);
    doc.text(isHome ? "COLLABORATEUR" : "RÉFÉRENT SITE", fx, fy);
    fy += 12;
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(sc.siteContact, fx, fy);
    fy += 14;
  }

  // Démarrage du bloc inférieur : après l'image ET la colonne droite
  let y = Math.max(imgY + imgH, fy) + 18;

  // PRÉSENTATION (description longue) en pleine largeur — placée APRÈS l'image
  // et POINTS FORTS, AVANT le tableau de chiffrage. Texte affiché en entier
  // (plus de troncature à 18 lignes avec ellipsis) : on calcule la hauteur
  // RÉELLE nécessaire pour le label + tout le texte AVANT de dessiner, pour
  // que ensureSpace décide d'un saut de page propre si ça ne tient pas sur la
  // page courante, plutôt que de couper le texte artificiellement.
  if (sc.charger.description && sc.charger.description.trim().length > 0) {
    const fullW = PAGE_W - M * 2;
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(10);
    const descLines = doc.splitTextToSize(sc.charger.description, fullW) as string[];
    const neededH = 14 + descLines.length * 13 + 16;
    y = ensureSpace(doc, y, neededH, client, type);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...LAVENDER);
    doc.text(lookupText(TEXTS, "vehicles", "vehicle_presentation_label", "PRÉSENTATION"), M, y);
    y += 14;
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(descLines, M, y);
    y += descLines.length * 13 + 16;
  }

  // Le PDF client utilise les prix avec marge (lineItemClientUnit/Total).
  // Le prix d'achat (unitHt brut) et la marge restent invisibles côté client.
  const total_ = sc.lineItems.reduce((a, li) => a + lineItemClientTotal(li), 0);
  const grandTotal = total_ * chargerQtyMultiplier(sc);
  // Mode LOCATION : on présente l'offre en loyer (option d'achat + résiliation)
  // à la place du chiffrage à l'achat.
  if (sc.leaseEnabled) {
    y = drawChargerLeaseBlock(doc, sc, y, client, type);
  }
  // Le tableau de chiffrage et l'encart 'Pour N collaborateurs' sont gated
  // par showChargerLineItems. Si l'admin a décoché la case, on saute tout.
  // En mode location, le chiffrage à l'achat est masqué par défaut, MAIS reste
  // affiché pour les comptes admin (ADMIN_MODE) : ils veulent voir les postes
  // de dépense même quand le devis est présenté en location. hideAchatPricing
  // permet de forcer le masquage au cas par cas (par borne), même pour un
  // compte admin, sans toucher à l'offre en location au-dessus.
  if (PDF_CFG.showChargerLineItems && (!sc.leaseEnabled || ADMIN_MODE) && !sc.hideAchatPricing) {
  y = ensureSpace(doc, y, 110, client, type);
  // Pour le scope SITE, on supprime le footer "Total HT par site" : ce total
  // est partiel (n'inclut pas le bureau de contrôle 700 €), donc il
  // contredisait le MONTANT TOTAL PROJET de la slide options de paiement et
  // le Total HT du récap financier. Le Total HT par site n'est plus affiché
  // QUE sur la slide récap financier final.
  // Pour le scope HOME (B2B2E), on garde le footer "Total HT par collaborateur"
  // car il n'y a pas de récap financier consolidé sur ce parcours.
  const showLineItemFooter = isHome;
  autoTable(doc, {
    startY: y,
    theme: "plain",
    head: [["Prestation", "Qté", "PU HT", "Total HT"]],
    body: sc.lineItems.map((li) => [
      li.label,
      String(li.qty),
      // eur2 (2 décimales max, masquées si nulles) plutôt que eur (arrondi à
      // l'euro) : la marge appliquée (marginPct) donne souvent un prix
      // unitaire avec centimes. Arrondir le PU HT affiché cachait ces
      // centimes tout en gardant le Total HT calculé sur la valeur exacte
      // non arrondie — qté × PU affiché ne correspondait alors plus au Total
      // HT affiché (ex. 12 × 134 € affichés = 1 608 €, quand le vrai calcul
      // 12 × 134,40 € = 1 612,80 € arrondissait le Total HT à 1 613 €).
      eur2(lineItemClientUnit(li)),
      eur2(lineItemClientTotal(li)),
    ]),
    foot: showLineItemFooter ? [[
      {
        content: lookupText(
          TEXTS,
          "home",
          "charger_total_label",
          "Total HT par collaborateur",
        ),
        colSpan: 3,
        styles: { halign: "right", fontStyle: "normal", textColor: INK, fillColor: BG, cellPadding: 8, font: BRAND_FONT },
      },
      {
        content: eur2(total_),
        styles: { halign: "right", fontStyle: "bold", textColor: ACCENT_TEXT, fillColor: BG, cellPadding: 8, fontSize: 12, font: BRAND_FONT },
      },
    ]] : undefined,
    headStyles: { fillColor: LAVENDER, textColor: 255, fontSize: 9, fontStyle: "bold", font: BRAND_FONT, cellPadding: 7, halign: "left" },
    bodyStyles: { fontSize: 9.5, cellPadding: 7, textColor: INK, lineColor: RULE, lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 } as any, font: BRAND_FONT },
    footStyles: { font: BRAND_FONT },
    alternateRowStyles: { fillColor: [252, 251, 248] as [number, number, number] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 38 },
      2: { halign: "right", cellWidth: 80 },
      3: { halign: "right", cellWidth: 90, fontStyle: "bold" },
    },
    margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Encart "Pour N bornes / Total HT" affiché uniquement sur le parcours
  // HOME (B2B2E) où il n'y a pas de slide récap financier. Sur le parcours
  // SITE, le total consolidé apparaît uniquement sur la slide récap financier.
  if (sc.quantity > 1 && isHome) {
    y = ensureSpace(doc, y, 44, client, type);
    doc.setFillColor(...LAVENDER);
    doc.rect(M, y, PAGE_W - M * 2, 36, "F");
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    const unitSingular = lookupText(TEXTS, "home", "charger_grand_total_unit_singular", "collaborateur");
    const unitPlural = lookupText(TEXTS, "home", "charger_grand_total_unit_plural", "collaborateurs");
    const unitLabel = sc.quantity > 1 ? unitPlural : unitSingular;
    const label = `Pour ${sc.quantity} ${unitLabel}`;
    doc.text(label, M + 14, y + 22);
    doc.setFontSize(14);
    doc.text(`Total HT : ${eur2(grandTotal)}`, PAGE_W - M - 14, y + 22, { align: "right" });
    y += 46;
  }
  } // fin du gating showChargerLineItems

  if (!PDF_CFG.showChargerInclusionNote || sc.hideInclusionNote) return;
  // Location du matériel seul : on remplace le contenu de l'encart par la seule
  // mention « matériel seul, sans installation », en gardant une ligne sur la
  // supervision Beev Connect : elle reste disponible en option même quand la
  // pose n'est pas incluse (c'est un service logiciel, indépendant de
  // l'installation physique).
  const equipOnly = !!(sc.leaseEnabled && sc.leaseEquipmentOnly);
  // Encart "Inclus dans la prestation" en liste de bullets propres
  const fallbackInclusions = isHome
    ? [
        "Matériel et accessoires de raccordement",
        "Pose et raccordement par technicien IRVE certifié",
        "Mise en supervision et remboursement automatisé de l'énergie consommée à titre professionnel (en option)",
        "Gestion des déchets de chantier",
      ]
    : [
        "Étude de site et chiffrage par technicien IRVE certifié",
        "Pose, raccordement et mise en service",
        "Mise en service et configuration du système de supervision",
        "Formation des utilisateurs sur site",
        "Gestion des déchets de chantier",
        // Ligne "Garantie constructeur 3 ans, extensible 6 ans" retirée :
        // la garantie est désormais affichée sur la fiche produit borne, par
        // modèle (champ warranty éditable dans /admin/chargers).
      ];
  const inclusions = equipOnly
    ? [
        "Location du matériel seul, sans prestation d'installation",
        isHome
          ? "Supervision Beev Connect disponible en option (indépendante de la pose)"
          : "Supervision Beev Connect disponible en option, y compris sans prestation d'installation",
      ]
    : lookupList(TEXTS, isHome ? "home" : "site", "charger_inclusion_items", fallbackInclusions);
  const lineH = 13;
  const padTop = 14;
  const padBottom = 12;
  const boxH = padTop + inclusions.length * lineH + padBottom;
  if (y + boxH < FOOTER_LIMIT) {
    doc.setFillColor(...BG);
    doc.rect(M, y, PAGE_W - M * 2, boxH, "F");
    doc.setFillColor(...LAVENDER);
    doc.rect(M, y, 4, boxH, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...LAVENDER);
    doc.text(
      equipOnly
        ? "LOCATION DU MATÉRIEL SEUL"
        : lookupText(
            TEXTS,
            isHome ? "home" : "site",
            "charger_inclusion_title",
            isHome ? "INCLUS DANS LE KIT INSTALLATION DOMICILE" : "INCLUS DANS LA PRESTATION CLÉ EN MAIN",
          ),
      M + 16,
      y + padTop,
    );
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    let by = y + padTop + 14;
    inclusions.forEach((item) => {
      doc.setFillColor(...ACCENT);
      doc.circle(M + 20, by - 3, 1.6, "F");
      doc.text(item, M + 28, by);
      by += lineH;
    });
  }
}

// ============ PARCOURS CLIENT BEEV (A → Z) ============
// ============ COMPARAISON TCO MULTI-VÉHICULES (entre eux) ============
// Affichée uniquement si 2+ véhicules sont dans la sélection. Compare les
// véhicules les uns par rapport aux autres (pas de référence essence).
// Le véhicule le moins cher est mis en valeur en vert Beev.
// Helper : libellé complet d'un véhicule (marque + modèle + version) avec
// troncature optionnelle. Permet de distinguer 2 finitions du même modèle
// dans les comparateurs TCO. Si la version est vide, on retourne juste
// "MARQUE MODÈLE". Si maxLen est défini, on tronque proprement.
function vehicleLabel(v: { brand: string; model: string; version?: string }, maxLen?: number): string {
  const main = `${v.brand} ${v.model}`.trim();
  const ver = (v.version ?? "").trim();
  const full = ver ? `${main} · ${ver}` : main;
  if (maxLen && full.length > maxLen) return full.slice(0, maxLen - 1) + "…";
  return full;
}

// ============ SYNTHÈSE FLOTTE (vue agrégée pour grosses flottes) ============
// Pour 50/80/100+ véhicules : un tableau par segment/modèle (modèle actuel →
// EV proposé, quantité, économie) + total flotte, au lieu de 80 fiches.
// Regroupe selectedV par comparisonGroup ; chaque groupe = un véhicule actuel
// (flotte à remplacer) + son EV de remplacement principal.
function drawFleetSynthesis(doc: jsPDF, vehicles: SelectedVehicle[], e: EnergyParams) {
  const PINK: [number, number, number] = [244, 184, 170];
  const tcoAn = (sv: SelectedVehicle, loyerOverride?: number): number => {
    const duree = sv.durationMonths / 12;
    const opt = sv.options.reduce((s, o) => s + o.qty * o.unitHt, 0);
    const r = calculateTcoFull(sv.vehicle, {
      dureeAnnees: duree, kmContrat: sv.kmPerYear * duree,
      prixEssenceLitre: e.fuelPriceL, prixKwhDomicile: e.kWhHome, prixKwhPublic: e.kWhPublic,
      optionsTotalTtc: opt, remisePctOverride: sv.discountPct,
    }, loyerOverride !== undefined && loyerOverride > 0 ? loyerOverride : sv.negotiatedMonthly);
    return r.tcoAnnuel;
  };

  const groups = new Map<string, { current?: SelectedVehicle; props: SelectedVehicle[] }>();
  for (const sv of vehicles) {
    const g = (sv.comparisonGroup ?? "").trim() || `${sv.vehicle.brand} ${sv.vehicle.model}`.trim();
    if (!groups.has(g)) groups.set(g, { props: [] });
    const b = groups.get(g)!;
    if (sv.vehicle.isCurrentFleet) b.current = sv; else b.props.push(sv);
  }

  let totalVeh = 0, totalEcoAn = 0;
  const body: any[] = [];
  for (const [, b] of groups) {
    const ev = b.props[0];
    const qty = Math.max(1, ev?.quantity ?? b.current?.quantity ?? 1);
    totalVeh += qty;
    // Économie à loyer comparable : si le thermique actuel n'a pas de loyer
    // (car policy sans tarif), on aligne sur celui de l'EV → l'économie reflète
    // l'énergie + la fiscalité évitées.
    const curLoyer = (b.current && b.current.negotiatedMonthly > 0) ? b.current.negotiatedMonthly : (ev?.negotiatedMonthly ?? 0);
    const ecoVeh = (b.current && ev) ? Math.max(0, tcoAn(b.current, curLoyer) - tcoAn(ev)) : 0;
    totalEcoAn += ecoVeh * qty;
    body.push([
      { content: b.current ? vehicleLabel(b.current.vehicle, 32) : "—", styles: { halign: "left" } },
      { content: String(qty), styles: { halign: "center" } },
      { content: ev ? vehicleLabel(ev.vehicle, 32) : "—", styles: { halign: "left", fontStyle: "bold" } },
      { content: ev ? `${eurLoyer(ev.negotiatedMonthly)}${L("/mois", "/month")}` : "—", styles: { halign: "center" } },
      { content: ecoVeh > 0 ? `− ${eur(ecoVeh)}` : "—", styles: { halign: "center" } },
      { content: ecoVeh > 0 ? `− ${eur(ecoVeh * qty)}` : "—", styles: { halign: "center", fontStyle: "bold", textColor: ACCENT_TEXT } },
    ]);
  }

  let y = 116;
  eyebrow(doc, L("SYNTHÈSE FLOTTE", "FLEET SUMMARY"), y);
  y += 26;
  title(doc, L("Votre flotte électrifiée en un coup d'œil", "Your electrified fleet at a glance"), y);
  y += 40;

  // Bandeau économie totale (rose, texte noir)
  doc.setFillColor(...PINK);
  doc.roundedRect(M, y, PAGE_W - M * 2, 76, 10, 10, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(L("ÉCONOMIE TOTALE DE LA FLOTTE / AN", "TOTAL FLEET SAVINGS / YEAR"), M + 18, y + 22);
  doc.setFontSize(30);
  doc.text(totalEcoAn > 0 ? `− ${eur(totalEcoAn)}` : "—", M + 18, y + 56);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9);
  doc.text(L(`${totalVeh} véhicules · ${groups.size} segments · vs flotte thermique actuelle`, `${totalVeh} vehicles · ${groups.size} segments · vs current combustion fleet`), PAGE_W - M - 18, y + 56, { align: "right" });
  y += 96;

  autoTable(doc, {
    startY: y,
    theme: "plain",
    head: [[L("Modèle actuel", "Current model"), L("Qté", "Qty"), L("Remplacement électrique", "Electric replacement"), L("Loyer", "Lease"), L("Éco / véh. / an", "Savings / vehicle / year"), L("Éco flotte / an", "Fleet savings / year")]],
    body,
    headStyles: { fillColor: INK, textColor: 255, fontSize: 8, fontStyle: "bold", font: BRAND_FONT, cellPadding: 6 },
    bodyStyles: { fontSize: 8.5, cellPadding: 6, textColor: INK, lineColor: RULE, lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 } as any, font: BRAND_FONT, valign: "middle" as any },
    alternateRowStyles: { fillColor: BG },
    columnStyles: { 1: { cellWidth: 36 }, 3: { cellWidth: 64 }, 4: { cellWidth: 78 }, 5: { cellWidth: 86 } },
    margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
  });
  let ny = (doc as any).lastAutoTable.finalY + 16;
  ny = ensureBottomSpace(doc, ny, 30);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUB);
  doc.text(
    L(
      "Économie = écart de TCO annuel (loyer + énergie + fiscalité) entre le véhicule thermique actuel et l'électrique proposé, × quantité. Détail par véhicule dans l'analyse TCO. Le comparateur présente les alternatives par segment.",
      "Savings = annual TCO gap (lease + energy + tax) between the current combustion vehicle and the proposed EV, × quantity. Per-vehicle detail in the TCO analysis. The comparator presents alternatives by segment.",
    ),
    M, ny, { maxWidth: PAGE_W - M * 2 },
  );
}

// ============ TCO DASHBOARD (page de synthèse visuelle pour le mode TCO) ============
// Page d'ouverture du PDF TCO standalone : 4 KPI cards en haut + barres
// empilées par véhicule (loyer + énergie + TVS + malus) en bas. Permet au
// décideur de visualiser instantanément la structure du coût total et de
// repérer où sont les écarts entre véhicules.
/** Bandeau « FLOTTE ACTUELLE » : carte foncée pleine largeur qui met en avant le
 *  coût actuel du parc du client comme référence pour mesurer l'économie des EV.
 *  `value` = chiffre fort (à droite), `valueLabel` = légende sous le chiffre,
 *  `message` = phrase d'impact (à gauche). Renvoie le y sous le bandeau. */
function drawCurrentFleetBanner(doc: jsPDF, y: number, value: string, valueLabel: string, message: string): number {
  const w = PAGE_W - M * 2;
  const h = 46;
  doc.setFillColor(...INK);
  doc.roundedRect(M, y, w, h, 7, 7, "F");
  // Pastille accent rose à gauche
  doc.setFillColor(...ACCENT);
  doc.roundedRect(M + 12, y + 12, 5, h - 24, 2.5, 2.5, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...ACCENT);
  doc.text("FLOTTE ACTUELLE", M + 26, y + 17);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(232, 232, 232);
  const msgL = doc.splitTextToSize(message, w - 190);
  doc.text(msgL.slice(0, 2), M + 26, y + 30);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(value, M + w - 16, y + 25, { align: "right" });
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(175, 175, 180);
  doc.text(valueLabel, M + w - 16, y + 36, { align: "right" });
  return y + h + 14;
}

/** Style autoTable d'un intertitre de section dans les tableaux TCO. `dark` =
 *  bandeau noir (flotte actuelle), sinon couleur de groupe charte. */
function sectionHeaderRow(label: string, colSpan: number, color: [number, number, number], dark = false) {
  return [{
    content: label.toUpperCase(),
    colSpan,
    styles: {
      fillColor: dark ? INK : color,
      textColor: dark ? ([255, 255, 255] as [number, number, number]) : INK,
      fontStyle: "bold" as any,
      fontSize: 9,
      halign: "center" as any,
      cellPadding: 6,
    },
  }];
}

async function drawTcoDashboard(doc: jsPDF, vehiclesIn: SelectedVehicle[], e: EnergyParams, client?: ClientInfo, type?: ProjectType) {
  // Option commerciale : inclure ou non la flotte actuelle (thermiques) dans le
  // classement TCO. Décoché → on ne compare que les électriques proposés.
  const vehicles = PDF_CFG.includeCurrentFleetInTco === false
    ? vehiclesIn.filter((sv) => !sv.vehicle.isCurrentFleet)
    : vehiclesIn;
  // Couleurs cohérentes avec les graphiques recharts dans l'app
  // Couleurs des composantes. Admin = palette charte Beev (noir/bleu/violet/rose),
  // sinon palette historique. COLOR_BEST sert au rang « meilleur TCO » (lisible).
  const COLOR_LOYER: [number, number, number] = ADMIN_MODE ? [29, 29, 29] : [56, 9, 234];
  const COLOR_ENERGIE: [number, number, number] = ADMIN_MODE ? [165, 210, 255] : [53, 218, 118];
  const COLOR_TVS: [number, number, number] = ADMIN_MODE ? [211, 204, 216] : [245, 166, 35];
  const COLOR_MALUS: [number, number, number] = ADMIN_MODE ? [244, 184, 170] : [229, 75, 75];
  const COLOR_BEST: [number, number, number] = ADMIN_MODE ? [29, 29, 29] : [53, 218, 118];

  let y = 116;
  eyebrow(doc, L("ANALYSE TCO · TABLEAU DE BORD", "TCO ANALYSIS · DASHBOARD"), y);
  y += 32;
  title(doc, L("Décomposition du coût total de possession.", "Breakdown of the total cost of ownership."), y);
  y += 30;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const intro = L(
    "Classement par TCO d'usage : loyer LLD, coût énergie, fiscalité (TVS) et malus à l'achat. Le véhicule en haut a le TCO d'usage le plus bas. Ce TCO d'usage n'inclut pas l'AND ni l'AEN employeur : le coût employeur complet (qui les ajoute) est détaillé dans la page « Détail des composantes ».",
    "Ranked by usage TCO: lease, energy cost, tax (TVS) and purchase penalty. The vehicle at the top has the lowest usage TCO. This usage TCO does not include the AND or the employer's AEN share: the full employer cost (which adds them) is detailed on the \"Component detail\" page.",
  );
  const introL = doc.splitTextToSize(intro, PAGE_W - M * 2);
  doc.text(introL, M, y);
  y += introL.length * 13 + 14;

  // Calcul TCO par véhicule via calculateTcoFull (utilise les paramètres
  // fiscaux Beev 2026 : malus CO2, malus poids, TVS, etc.)
  // sv.options sont saisies en TTC dans le panneau droit.
  const rows = vehicles.map((sv) => {
    const optionsTotalTtc = sv.options.reduce((s, o) => s + o.qty * o.unitHt, 0);
    const duree = sv.durationMonths / 12;
    const contract: import("./tco-calculator").TcoContractParams = {
      dureeAnnees: duree,
      kmContrat: (sv.kmPerYear * sv.durationMonths) / 12,
      prixEssenceLitre: e.fuelPriceL,
      prixKwhDomicile: e.kWhHome,
      prixKwhPublic: e.kWhPublic,
      optionsTotalTtc,
      remisePctOverride: sv.discountPct,
    };
    const r = calculateTcoFull(sv.vehicle, contract, sv.negotiatedMonthly);
    return {
      sv,
      total: r.tcoTotal,
      loyer: r.loyerTotal,
      energie: r.coutEnergie,
      tvs: r.tvsTotal,
      malus: r.malusCO2 + r.malusPoids,
      andTotal: r.andTotal,
      aenTotal: r.aenEmployeurTotal,
      coutEmployeur: r.tcoEmployeurComplet,
      annuel: r.tcoAnnuel,
      par100km: r.tcoParKm * 100,
    };
  }).sort((a, b) => a.total - b.total);

  if (rows.length === 0) {
    doc.text(lookupText(TEXTS, "vehicles", "tco_compare_empty", L("Aucun véhicule sélectionné pour l'analyse TCO.", "No vehicle selected for the TCO analysis.")), M, y);
    return;
  }

  const cheapest = rows[0];
  const mostExpensive = rows[rows.length - 1];
  const ecartTotal = mostExpensive.total - cheapest.total;
  const ecartPct = mostExpensive.total > 0 ? (ecartTotal / mostExpensive.total) * 100 : 0;

  // === Bandeau FLOTTE ACTUELLE : calcule le TCO du parc thermique actuel et
  // donne l'impact (coût moyen actuel /100km vs meilleur EV proposé). ===
  const dashCurrent = rows.filter((r) => r.sv.vehicle.isCurrentFleet);
  const dashEv = rows.filter((r) => !r.sv.vehicle.isCurrentFleet);
  if (dashCurrent.length > 0 && dashEv.length > 0) {
    const avgCur = dashCurrent.reduce((s, r) => s + r.par100km, 0) / dashCurrent.length;
    const bestEv = Math.min(...dashEv.map((r) => r.par100km));
    const ecoPct = avgCur > 0 ? ((avgCur - bestEv) / avgCur) * 100 : 0;
    y = drawCurrentFleetBanner(
      doc,
      y,
      `${avgCur.toFixed(2)} €/100km`,
      L(`coût moyen actuel · ${dashCurrent.length} véh.`, `current average cost · ${dashCurrent.length} veh.`),
      L(
        `Le meilleur véhicule électrique proposé revient à ${bestEv.toFixed(2)} €/100km, soit ${ecoPct.toFixed(0)} % d'économie par véhicule sur votre usage.`,
        `The best proposed electric vehicle costs ${bestEv.toFixed(2)} €/100km, a ${ecoPct.toFixed(0)}% saving per vehicle on your usage.`,
      ),
    );
  }

  // === 4 KPI cards en haut — sémantique COMPARAISON entre véhicules,
  // pas une flotte à commander. Le client choisira UN véhicule. ===
  const cardW = (PAGE_W - M * 2 - 30) / 4;
  const cardH = 70;
  const kpis = [
    {
      label: L("MEILLEUR TCO", "BEST TCO"),
      value: `${cheapest.par100km.toFixed(2)} €/100km`,
      // Version incluse pour distinguer 2 finitions du même modèle
      sub: vehicleLabel(cheapest.sv.vehicle, 30),
      color: COLOR_ENERGIE,
    },
    {
      label: L("TCO LE PLUS ÉLEVÉ", "HIGHEST TCO"),
      value: `${mostExpensive.par100km.toFixed(2)} €/100km`,
      sub: vehicleLabel(mostExpensive.sv.vehicle, 30),
      color: COLOR_MALUS,
    },
    {
      label: L("ÉCART SUR CONTRAT", "GAP OVER CONTRACT"),
      value: eur(ecartTotal),
      sub: L("économie potentielle pire vs meilleur", "potential savings, worst vs best"),
      color: COLOR_LOYER,
    },
    {
      label: L("ÉCART %", "GAP %"),
      value: `${ecartPct.toFixed(1)} %`,
      sub: L("pire − meilleur ÷ pire", "worst − best ÷ worst"),
      color: COLOR_TVS,
    },
  ];
  kpis.forEach((k, i) => {
    const cx = M + i * (cardW + 10);
    doc.setFillColor(...BG);
    doc.roundedRect(cx, y, cardW, cardH, 6, 6, "F");
    doc.setFillColor(...k.color);
    doc.rect(cx, y, cardW, 3, "F");
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SUB);
    doc.text(k.label, cx + 8, y + 16);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(15);
    doc.setTextColor(...INK);
    doc.text(k.value, cx + 8, y + 38);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SUB);
    const subLines = doc.splitTextToSize(k.sub, cardW - 16);
    doc.text(subLines.slice(0, 2), cx + 8, y + 54);
  });
  y += cardH + 20;

  // === Légende couleurs des composantes ===
  const legend = [
    { label: L("Loyer LLD", "Lease"), color: COLOR_LOYER },
    { label: L("Énergie", "Energy"), color: COLOR_ENERGIE },
    { label: L("TVS / fiscalité", "TVS / tax"), color: COLOR_TVS },
    { label: L("Malus à l'achat", "Purchase penalty"), color: COLOR_MALUS },
  ];
  let lx = M;
  legend.forEach((l) => {
    doc.setFillColor(...l.color);
    doc.rect(lx, y - 6, 12, 8, "F");
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(l.label, lx + 16, y);
    lx += 16 + doc.getTextWidth(l.label) + 20;
  });
  y += 16;

  // === Barres empilées par véhicule (horizontales) ===
  const maxTotal = mostExpensive.total || 1;
  const labelW = 150;
  const barAreaW = PAGE_W - M * 2 - labelW - 80;
  const barX = M + labelW;
  const valueX = M + labelW + barAreaW + 8;
  const rowH = 36;

  // Choix commercial : classement GLOBAL (à plat, par TCO) ou PAR GROUPE de
  // comparaison (un intertitre par segment, classement interne au groupe).
  const useGroups = PDF_CFG.tcoGroupByComparison !== false && rows.some((r) => (r.sv.comparisonGroup ?? "").trim());
  type DashItem = { header?: string; r?: (typeof rows)[number]; rank?: number; best?: boolean };
  const items: DashItem[] = [];
  if (useGroups) {
    const gmap = new Map<string, typeof rows>();
    const order: string[] = [];
    for (const r of rows) {
      const g = (r.sv.comparisonGroup ?? "").trim() || L("Autres véhicules", "Other vehicles");
      if (!gmap.has(g)) { gmap.set(g, []); order.push(g); }
      gmap.get(g)!.push(r);
    }
    for (const g of order) {
      const gr = [...gmap.get(g)!].sort((a, b) => a.total - b.total);
      items.push({ header: g });
      gr.forEach((r, i) => items.push({ r, rank: i + 1, best: i === 0 }));
    }
  } else {
    rows.forEach((r, i) => items.push({ r, rank: i + 1, best: i === 0 }));
  }

  for (const it of items) {
    // Pagination : si l'élément ne tient pas avant le footer, on passe à une
    // NOUVELLE PAGE au lieu de tronquer la liste (le tableau de bord peut donc
    // comparer tous les véhicules). Un intertitre de groupe emporte au moins sa
    // première ligne (anti-orphelin) : ~10 véhicules par page selon la place.
    const needed = it.header !== undefined ? 20 + rowH : rowH;
    if (y + needed > FOOTER_LIMIT) {
      doc.addPage();
      drawHeader(doc, (client ?? { company: "", date: "" }) as ClientInfo, type ?? "vehicles");
      y = 130;
      eyebrow(doc, L("ANALYSE TCO · TABLEAU DE BORD (SUITE)", "TCO ANALYSIS · DASHBOARD (CONTINUED)"), y);
      y += 30;
    }
    if (it.header !== undefined) {
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(8);
      doc.setTextColor(...SUB);
      doc.text(it.header.toUpperCase(), M, y + 6);
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.4);
      doc.line(M, y + 10, PAGE_W - M, y + 10);
      y += 20;
      continue;
    }
    const r = it.r!;
    const idx = (it.rank ?? 1) - 1;
    const isBest = !!it.best;

    // Rang + nom véhicule (gauche)
    const isCur = !!r.sv.vehicle.isCurrentFleet;
    if (isBest) {
      doc.setFillColor(...COLOR_BEST);
      doc.circle(M + 8, y + 10, 8, "F");
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(String(idx + 1), M + 8, y + 13, { align: "center" });
    } else if (isCur) {
      // Flotte actuelle : pastille noire pour la repérer dans le classement.
      doc.setFillColor(...INK);
      doc.circle(M + 8, y + 10, 8, "F");
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(String(idx + 1), M + 8, y + 13, { align: "center" });
    } else {
      doc.setFillColor(220, 220, 225);
      doc.circle(M + 8, y + 10, 8, "F");
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(String(idx + 1), M + 8, y + 13, { align: "center" });
    }
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    // Tronque le nom à la LARGEUR réelle dispo avant les barres (plus de coupe
    // au milieu d'un mot type « MERCEDES CLA SHOOTING BR »).
    const nameFull = `${r.sv.vehicle.brand} ${r.sv.vehicle.model}`.trim();
    const nameMaxW = barX - (M + 22) - 10;
    let nm = nameFull;
    if (doc.getTextWidth(nm) > nameMaxW) {
      while (nm.length > 4 && doc.getTextWidth(nm + "…") > nameMaxW) nm = nm.slice(0, -1);
      nm = nm.replace(/\s+$/, "") + "…";
    }
    doc.text(nm, M + 22, y + 7);
    // Version sur sa propre ligne (sub) pour distinguer 2 finitions du même
    // modèle (ex. plusieurs HYUNDAI KONA) — indispensable au classement TCO.
    const verRank = (r.sv.vehicle.version ?? "").trim();
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SUB);
    const tagTxt = isCur ? L("actuel · ", "current · ") : "";
    if (verRank) {
      doc.text(verRank.slice(0, 30), M + 22, y + 16);
      doc.text(`${tagTxt}${r.par100km.toFixed(2)} €/100km · × ${r.sv.quantity}`, M + 22, y + 25);
    } else {
      doc.text(`${tagTxt}${r.par100km.toFixed(2)} €/100km · × ${r.sv.quantity}`, M + 22, y + 18);
    }

    // Barre empilée (loyer + énergie + TVS + malus, largeur relative au max total)
    const scale = (barAreaW - 4) / maxTotal;
    let bx = barX;
    const segments: Array<{ width: number; color: [number, number, number] }> = [
      { width: r.loyer * scale, color: COLOR_LOYER },
      { width: r.energie * scale, color: COLOR_ENERGIE },
      { width: r.tvs * scale, color: COLOR_TVS },
      { width: r.malus * scale, color: COLOR_MALUS },
    ];
    segments.forEach((s) => {
      if (s.width > 0.5) {
        doc.setFillColor(...s.color);
        doc.rect(bx, y + 4, s.width, 14, "F");
        bx += s.width;
      }
    });

    // Valeur totale TCO contrat (droite)
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(isBest ? COLOR_BEST[0] : INK[0], isBest ? COLOR_BEST[1] : INK[1], isBest ? COLOR_BEST[2] : INK[2]);
    doc.text(eur(r.total), valueX, y + 14);

    y += rowH;
  }

  // === Détail Charges fiscales annexes (AND/AEN) — récap par véhicule ===
  // Désactivé par défaut (toggle showTcoFiscalDetail). Sur une nouvelle page.
  if (!PDF_CFG.showTcoFiscalDetail) return;
  doc.addPage();
  if (client && type) drawHeader(doc, client, type);
  y = 116;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...LAVENDER);
  doc.text(L("DÉTAIL CHARGES FISCALES ANNEXES PAR VÉHICULE", "DETAIL OF ADDITIONAL TAX CHARGES BY VEHICLE"), M, y);
  y += 14;

  // Sépare la flotte actuelle (thermiques) des EV proposés.
  const fiscalCurrent = rows.filter((r) => r.sv.vehicle.isCurrentFleet);
  const fiscalEv = rows.filter((r) => !r.sv.vehicle.isCurrentFleet);

  // Bandeau impact : TVS + malus que le parc thermique actuel supporte (×qté),
  // charges quasi nulles en électrique.
  if (fiscalCurrent.length > 0) {
    const curFisc = fiscalCurrent.reduce((s, r) => s + (r.tvs + r.malus) * r.sv.quantity, 0);
    y = drawCurrentFleetBanner(
      doc,
      y,
      eur(curFisc),
      L("TVS + malus actuels (×durée)", "Current TVS + penalty (×duration)"),
      L(
        "Charges fiscales annexes que vos véhicules thermiques supportent aujourd'hui. Elles sont fortement réduites, voire nulles, en passant à l'électrique.",
        "Additional tax charges your combustion vehicles bear today. They are sharply reduced, or eliminated, when switching to electric.",
      ),
    );
  }

  // Groupement par groupe de comparaison (si au moins un groupe nommé côté EV).
  const fGroupKey = (sv: SelectedVehicle) => (sv.comparisonGroup ?? "").trim();
  const fHasGroups = PDF_CFG.tcoGroupByComparison !== false && fiscalEv.some((r) => fGroupKey(r.sv));
  const fGroupColors: [number, number, number][] = [
    [237, 246, 255], [246, 245, 247], [232, 247, 233], [253, 241, 238], [255, 245, 230],
  ];
  const buildFiscalRow = (r: (typeof rows)[number]) => [
    vehicleLabel(r.sv.vehicle),
    { content: eur(r.malus), styles: { halign: "center" as any, textColor: r.malus > 0 ? ACCENT_TEXT : SUB, fontStyle: r.malus > 0 ? "bold" as any : "normal" as any } },
    { content: eur(r.tvs), styles: { halign: "center" as any, textColor: r.tvs > 0 ? ACCENT_TEXT : SUB, fontStyle: r.tvs > 0 ? "bold" as any : "normal" as any } },
    { content: eur(r.andTotal), styles: { halign: "center" as any } },
    { content: eur(r.aenTotal), styles: { halign: "center" as any } },
    { content: eur(r.coutEmployeur), styles: { halign: "center" as any, fontStyle: "bold" as any, textColor: ACCENT_TEXT } },
  ];

  const fiscalBody: any[] = [];
  const fiscalRowSvs: (SelectedVehicle | null)[] = [];
  // 1) Flotte actuelle en tête (bandeau noir)
  if (fiscalCurrent.length > 0) {
    fiscalBody.push(sectionHeaderRow(L("Flotte actuelle", "Current fleet"), 6, INK, true));
    fiscalRowSvs.push(null);
    for (const r of [...fiscalCurrent].sort((a, b) => b.coutEmployeur - a.coutEmployeur)) {
      fiscalBody.push(buildFiscalRow(r)); fiscalRowSvs.push(r.sv);
    }
  }
  // 2) EV proposés : groupés par groupe de comparaison, sinon liste simple
  if (fHasGroups) {
    const gOrder: string[] = [];
    const gMap = new Map<string, typeof rows>();
    for (const r of fiscalEv) {
      const g = fGroupKey(r.sv) || L("Autres véhicules", "Other vehicles");
      if (!gMap.has(g)) { gMap.set(g, []); gOrder.push(g); }
      gMap.get(g)!.push(r);
    }
    let gi = 0;
    for (const g of gOrder) {
      fiscalBody.push(sectionHeaderRow(g, 6, fGroupColors[gi % fGroupColors.length]));
      fiscalRowSvs.push(null);
      gi++;
      for (const r of [...gMap.get(g)!].sort((a, b) => a.coutEmployeur - b.coutEmployeur)) {
        fiscalBody.push(buildFiscalRow(r)); fiscalRowSvs.push(r.sv);
      }
    }
  } else {
    if (fiscalCurrent.length > 0 && fiscalEv.length > 0) {
      fiscalBody.push(sectionHeaderRow(L("Véhicules électriques proposés", "Proposed electric vehicles"), 6, fGroupColors[2]));
      fiscalRowSvs.push(null);
    }
    for (const r of fiscalEv) { fiscalBody.push(buildFiscalRow(r)); fiscalRowSvs.push(r.sv); }
  }

  // Vignettes véhicule mappées par véhicule (les lignes d'intertitre = null).
  const fiscalOrderedSvs = fiscalRowSvs.filter((s): s is SelectedVehicle => !!s);
  const fiscalThumbsArr = await preloadVehicleThumbs(fiscalOrderedSvs);
  const fiscalThumbMap = new Map<SelectedVehicle, LoadedImage | null>();
  fiscalOrderedSvs.forEach((sv, i) => fiscalThumbMap.set(sv, fiscalThumbsArr[i]));

  autoTable(doc, {
    startY: y,
    theme: "plain",
    head: [[L("Véhicule", "Vehicle"), L("Malus (achat)", "Penalty (purchase)"), L("TVS (×durée)", "TVS (×duration)"), L("AND (×durée)", "AND (×duration)"), L("AEN empl. (×durée)", "AEN employer (×duration)"), L("Coût empl. complet", "Full employer cost")]],
    body: fiscalBody,
    headStyles: { fillColor: ADMIN_MODE ? INK : LAVENDER, textColor: 255, fontSize: 7, fontStyle: "bold", font: BRAND_FONT, cellPadding: 4, halign: "center" as any },
    bodyStyles: { fontSize: 8, cellPadding: 4, textColor: INK, lineColor: RULE, lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 } as any, font: BRAND_FONT, valign: "middle" as any },
    alternateRowStyles: { fillColor: BG },
    columnStyles: { 0: { cellWidth: 150, cellPadding: { left: 56, right: 4, top: 6, bottom: 6 }, minCellHeight: 48, valign: "middle" as any } },
    // Empêche la coupure d'une ligne véhicule entre 2 pages (sinon la version
    // arrive seule en haut de la page suivante, avec des cellules chiffres vides
    // et la vignette désalignée).
    rowPageBreak: "avoid",
    margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
    didDrawCell: (data: any) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const sv = fiscalRowSvs[data.row.index];
      if (!sv) return; // ligne d'intertitre de section
      drawThumbCell(doc, data.cell, fiscalThumbMap.get(sv) ?? null);
    },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Pied : note méthodologie (paginée si le tableau remplit la page)
  y = ensureBottomSpace(doc, y, 50, client, type ?? "vehicles");
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUB);
  doc.text(
    L(
      "Estimation Beev 2026 : loyer LLD × durée + énergie sur kilométrage prévu + TVS annualisée + malus à l'achat. AND/AEN selon barèmes fiscaux 2026. Valeurs indicatives, à confirmer auprès du loueur retenu.",
      "Beev 2026 estimate: lease × duration + energy over expected mileage + annualized TVS + purchase penalty. AND/AEN per 2026 tax scales. Indicative values, to be confirmed with the selected lessor.",
    ),
    M,
    y,
    { maxWidth: PAGE_W - M * 2 },
  );
}

// ============ TABLEAU DÉTAILLÉ TCO PAR VÉHICULE ============
// Page dédiée listant pour chaque véhicule sélectionné toutes les composantes
// du TCO et des charges fiscales annexes : Loyer / Énergie / TVS / Malus CO2 /
// Malus poids / AND (×durée) / AEN employeur (×durée) / TCO total /
// TCO employeur complet. Permet au commercial et au client de vérifier
// chaque ligne du calcul.
// Vue « Impact du passage à l'électrique » (admin) : pour chaque groupe de
// comparaison ayant un véhicule ACTUEL (flotte) et des EV proposés, on décompose
// le thermique actuel juste au-dessus de chaque EV recommandé (même échelle) et
// on met l'économie en avant. Économie totale en tête. Orienté DAF / dirigeant.
async function drawTcoImpact(doc: jsPDF, vehiclesIn: SelectedVehicle[], e: EnergyParams, client: ClientInfo, type: ProjectType) {
  const GOOD: [number, number, number] = [29, 122, 84];
  const GOOD_LT: [number, number, number] = [127, 211, 172];
  const SEG_ENERGIE: [number, number, number] = [165, 210, 255];
  const SEG_FISC: [number, number, number] = [150, 122, 168];
  const SEG_EMPL: [number, number, number] = [244, 184, 170];
  const GREY_NAME: [number, number, number] = [106, 106, 111];

  const compute = (sv: SelectedVehicle) => {
    const duree = sv.durationMonths / 12;
    const optionsTotalTtc = sv.options.reduce((s, o) => s + o.qty * o.unitHt, 0);
    const r = calculateTcoFull(sv.vehicle, { dureeAnnees: duree, kmContrat: sv.kmPerYear * duree, prixEssenceLitre: e.fuelPriceL, prixKwhDomicile: e.kWhHome, prixKwhPublic: e.kWhPublic, optionsTotalTtc, remisePctOverride: sv.discountPct }, sv.negotiatedMonthly);
    const fisc = r.tvsTotal + r.malusCO2 + r.malusPoids;
    // Coût fiscal réel de l'AND (IS sur le montant réintégré), pas l'AND
    // brut — sinon ce segment + les autres dépasserait `total`.
    const empl = r.coutFiscalANDTotal + r.aenEmployeurTotal;
    return { sv, total: r.tcoEmployeurComplet, loyer: r.loyerTotal, energie: r.coutEnergie, fisc, empl, r, duree };
  };
  type IItem = ReturnType<typeof compute>;
  const items = vehiclesIn.map(compute);
  const gkey = (sv: SelectedVehicle) => (sv.comparisonGroup ?? "").trim();
  const gmap = new Map<string, IItem[]>(); const order: string[] = [];
  for (const it of items) { const g = gkey(it.sv) || "—"; if (!gmap.has(g)) { gmap.set(g, []); order.push(g); } gmap.get(g)!.push(it); }
  const cards: { g: string; ref: IItem; evs: IItem[] }[] = [];
  const pairedEvs = new Set<IItem>();
  let totalEco = 0, totalRef = 0;
  for (const g of order) {
    const list = gmap.get(g)!;
    const currents = list.filter((i) => i.sv.vehicle.isCurrentFleet).sort((a, b) => b.total - a.total);
    const evs = list.filter((i) => !i.sv.vehicle.isCurrentFleet).sort((a, b) => a.total - b.total);
    if (!currents.length || !evs.length) continue;
    cards.push({ g: g === "—" ? L("Remplacement", "Replacement") : g, ref: currents[0], evs });
    evs.forEach((ev) => pairedEvs.add(ev));
    totalEco += Math.max(0, currents[0].total - evs[0].total);
    totalRef += currents[0].total;
  }
  const totalPct = totalRef > 0 ? (totalEco / totalRef) * 100 : 0;
  const maxTotal = Math.max(1, ...items.map((i) => i.total));

  let y = 116;
  eyebrow(doc, L("ANALYSE TCO · IMPACT DU PASSAGE À L'ÉLECTRIQUE", "TCO ANALYSIS · IMPACT OF SWITCHING TO ELECTRIC"), y); y += 32;
  title(doc, L("Ce que vous économisez.", "What you save."), y); y += 40;

  const W = PAGE_W - M * 2;
  // Hero économie totale
  const hh = 76;
  doc.setFillColor(...INK); doc.roundedRect(M, y, W, hh, 14, 14, "F");
  doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(8); doc.setTextColor(...GOOD_LT);
  doc.text(L("ÉCONOMIE TOTALE SUR LA FLOTTE", "TOTAL FLEET SAVINGS"), M + 22, y + 24);
  doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(34); doc.setTextColor(255, 255, 255);
  doc.text(`− ${eur(totalEco)}`, M + 22, y + 55);
  doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(26); doc.setTextColor(...GOOD_LT);
  doc.text(`− ${totalPct.toFixed(0)} %`, M + W - 22, y + 42, { align: "right" });
  doc.setFont(BRAND_FONT, "normal"); doc.setFontSize(8); doc.setTextColor(200, 200, 200);
  doc.text(L("vs votre flotte actuelle · coût employeur complet", "vs. your current fleet · full employer cost"), M + W - 22, y + 57, { align: "right" });
  y += hh + 16;

  // Légende
  doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(7); doc.setTextColor(...SUB);
  const decompLabel = L("DÉCOMPOSITION", "BREAKDOWN");
  doc.text(decompLabel, M, y + 4);
  let lx = M + doc.getTextWidth(decompLabel) + 12;
  const lgs: [string, [number, number, number]][] = [[L("Loyer", "Lease"), INK], [L("Énergie", "Energy"), SEG_ENERGIE], [L("Fiscalité", "Tax"), SEG_FISC], [L("Charges empl.", "Employer charges"), SEG_EMPL]];
  doc.setFont(BRAND_FONT, "normal");
  for (const [lab, col] of lgs) { doc.setFillColor(col[0], col[1], col[2]); doc.rect(lx, y - 3, 9, 7, "F"); lx += 13; doc.setTextColor(...SUB); doc.text(lab, lx, y + 4); lx += doc.getTextWidth(lab) + 14; }
  y += 18;

  const nx = M + 16;
  const rightX = M + W - 16;
  const iThumbs = await preloadVehicleThumbs(items.map((i) => i.sv));
  const tmap = new Map<IItem, LoadedImage | null>();
  items.forEach((it, i) => tmap.set(it, iThumbs[i]));
  const textX = nx + 56;
  const barMaxW = rightX - textX - 175;
  const block = (it: IItem, isEv: boolean, eco: number | null, refTot: number, cy: number): number => {
    // Photo du véhicule
    drawThumbCell(doc, { x: nx, y: cy - 12, height: 36 }, tmap.get(it) ?? null, 48, 32);
    const name = `${it.sv.vehicle.brand} ${it.sv.vehicle.model}`.slice(0, 28);
    doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(12);
    if (isEv) doc.setTextColor(...INK); else doc.setTextColor(...GREY_NAME);
    doc.text(name, textX, cy);
    const nameW = doc.getTextWidth(name);
    // Badge rôle
    const badgeTxt = isEv ? L("Recommandé", "Recommended") : L("Actuel", "Current");
    doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(6.5);
    const btw = doc.getTextWidth(badgeTxt);
    doc.setFillColor(isEv ? 253 : 238, isEv ? 241 : 236, isEv ? 238 : 230);
    doc.roundedRect(textX + nameW + 8, cy - 8, btw + 12, 12, 6, 6, "F");
    doc.setTextColor(isEv ? 181 : 106, isEv ? 96 : 106, isEv ? 79 : 111);
    doc.text(badgeTxt, textX + nameW + 14, cy);
    // Total (droite)
    doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(13);
    if (isEv) doc.setTextColor(...INK); else doc.setTextColor(...SUB);
    doc.text(eur(it.total), rightX, cy, { align: "right" });
    // Barre décomposition (échelle commune)
    const by = cy + 9;
    doc.setFillColor(242, 240, 234); doc.rect(textX, by, barMaxW, 12, "F");
    const scaled = (it.total / maxTotal) * barMaxW;
    let sx = textX;
    const segs: [number, [number, number, number]][] = [[it.loyer, INK], [it.energie, SEG_ENERGIE], [it.fisc, SEG_FISC], [it.empl, SEG_EMPL]];
    for (const [v, col] of segs) { const w = (v / Math.max(1, it.total)) * scaled; if (w > 0.4) { doc.setFillColor(col[0], col[1], col[2]); doc.rect(sx, by, w, 12, "F"); sx += w; } }
    // Économie (EV)
    if (isEv && eco != null && eco > 0) {
      const pct = refTot > 0 ? (eco / refTot) * 100 : 0;
      doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(11); doc.setTextColor(...GOOD);
      doc.text(`− ${eur(eco)} · −${pct.toFixed(0)} %`, rightX, by + 11, { align: "right" });
    }
    return cy + 36;
  };

  for (const card of cards) {
    const nLines = 1 + card.evs.length;
    const cardH = 26 + nLines * 36 + 8;
    if (y + cardH > FOOTER_LIMIT) { doc.addPage(); drawHeader(doc, client, type); y = 116; }
    doc.setDrawColor(...RULE); doc.setLineWidth(0.6); doc.roundedRect(M, y, W, cardH, 12, 12, "S");
    let cy = y + 20;
    doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(8); doc.setTextColor(...SUB);
    doc.text(card.g.toUpperCase(), M + 16, cy); cy += 22;
    cy = block(card.ref, false, null, 0, cy);
    for (const ev of card.evs) cy = block(ev, true, card.ref.total - ev.total, card.ref.total, cy);
    y += cardH + 12;
  }

  // EV proposés hors groupe apparié : liste compacte pour ne rien perdre.
  const leftover = items.filter((i) => !i.sv.vehicle.isCurrentFleet && !pairedEvs.has(i));
  if (leftover.length) {
    if (y + 40 + leftover.length * 16 > FOOTER_LIMIT) { doc.addPage(); drawHeader(doc, client, type); y = 116; }
    doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(8); doc.setTextColor(...SUB);
    doc.text(L("AUTRES VÉHICULES PROPOSÉS", "OTHER PROPOSED VEHICLES"), M, y + 6); y += 16;
    doc.setDrawColor(...RULE); doc.setLineWidth(0.4);
    for (const it of leftover.sort((a, b) => a.total - b.total)) {
      doc.setFont(BRAND_FONT, "normal"); doc.setFontSize(11); doc.setTextColor(...INK);
      doc.text(`${it.sv.vehicle.brand} ${it.sv.vehicle.model}`.slice(0, 40), M, y + 4);
      doc.setFont(BRAND_FONT, "bold"); doc.text(eur(it.total), rightX, y + 4, { align: "right" });
      doc.line(M, y + 10, rightX, y + 10); y += 20;
    }
  }

  // Détail chiffré complet (loyer, énergie, TVS, malus, AND, AEN, coût empl.).
  y += 8;
  if (y + 70 > FOOTER_LIMIT) { doc.addPage(); drawHeader(doc, client, type); y = 116; }
  doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(8.5); doc.setTextColor(...SUB);
  doc.text(L("DÉTAIL DES COMPOSANTES", "COMPONENT DETAIL"), M, y); y += 8;
  // Corps groupé par groupe de comparaison (intertitre par groupe), actuel(s)
  // en tête de groupe puis EV. Ordre des groupes identique aux cartes.
  const detRow = (it: IItem) => [
    `${it.sv.vehicle.brand} ${it.sv.vehicle.model}${it.sv.vehicle.isCurrentFleet ? L(" (actuel)", " (current)") : ""}`,
    eur(it.r.loyerTotal), eur(it.r.coutEnergie), eur(it.r.tvsTotal), eur(it.r.malusCO2 + it.r.malusPoids),
    eur(it.r.andTotal), eur(it.r.aenEmployeurTotal), eur(it.total),
  ];
  const detBody: any[] = [];
  for (const g of order) {
    const list = gmap.get(g)!;
    const label = g === "—" ? L("Sans groupe de comparaison", "No comparison group") : g;
    detBody.push([{ content: label.toUpperCase(), colSpan: 8, styles: { fillColor: [246, 242, 236] as [number, number, number], textColor: INK, fontStyle: "bold" as any, halign: "left" as any, cellPadding: 6, fontSize: 9 } }]);
    const gCur = list.filter((i) => i.sv.vehicle.isCurrentFleet).sort((a, b) => b.total - a.total);
    const gEv = list.filter((i) => !i.sv.vehicle.isCurrentFleet).sort((a, b) => a.total - b.total);
    for (const it of [...gCur, ...gEv]) detBody.push(detRow(it));
  }
  autoTable(doc, {
    startY: y,
    theme: "plain",
    head: [[L("VÉHICULE", "VEHICLE"), L("LOYER", "LEASE"), L("ÉNERGIE", "ENERGY"), "TVS", L("MALUS", "PENALTY"), "AND", L("AEN EMPL.", "AEN EMPLOYER"), L("COÛT EMPL.", "EMPLOYER COST")]],
    body: detBody,
    headStyles: { fillColor: INK, textColor: 255, fontSize: 7.5, fontStyle: "bold", font: BRAND_FONT, cellPadding: 5, halign: "right" as any },
    bodyStyles: { fontSize: 8, cellPadding: 5, textColor: INK, lineColor: RULE, lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 } as any, font: BRAND_FONT, halign: "right" as any },
    alternateRowStyles: { fillColor: BG },
    columnStyles: { 0: { halign: "left" as any, cellWidth: 168, fontStyle: "bold" as any }, 7: { fontStyle: "bold" as any, textColor: ACCENT_TEXT } },
    rowPageBreak: "avoid",
    margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
  });
}

async function drawTcoDetailedTable(doc: jsPDF, vehiclesIn: SelectedVehicle[], e: EnergyParams, client?: ClientInfo) {
  const vehicles = PDF_CFG.includeCurrentFleetInTco === false
    ? vehiclesIn.filter((sv) => !sv.vehicle.isCurrentFleet)
    : vehiclesIn;
  let y = 116;
  const PINK: [number, number, number] = [244, 184, 170];
  doc.setFillColor(...PINK);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(ADMIN_MODE ? L("ANALYSE TCO · SYNTHÈSE & DÉTAIL", "TCO ANALYSIS · SUMMARY & DETAIL") : L("ANALYSE TCO · DÉTAIL DES COMPOSANTES", "TCO ANALYSIS · COMPONENT DETAIL"), M + 30, y - 4);
  y += 14;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(ADMIN_MODE ? 30 : 26);
  doc.setTextColor(...INK);
  doc.text(ADMIN_MODE ? L("Coût total de possession.", "Total cost of ownership.") : L("Tableau de décomposition du TCO", "TCO breakdown table"), M, y + 18);
  y += 50;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const intro = ADMIN_MODE
    ? L(
        "Classement par COÛT EMPLOYEUR COMPLET croissant = loyer + énergie + TVS + malus + AND + AEN employeur (sur la durée du contrat, options et remise incluses). L'AEN salarié est indiqué à titre informatif, non compté dans le coût employeur.",
        "Ranked by increasing FULL EMPLOYER COST = lease + energy + TVS + penalty + AND + employer AEN (over the contract duration, options and discount included). The employee AEN is shown for information only, not counted in the employer cost.",
      )
    : L(
        "Chaque composante du coût total de possession est détaillée par véhicule sur la durée du contrat (options et remise commerciale incluses). Le « coût employeur complet » ajoute au TCO d'usage (loyer + énergie + TVS + malus, repris du tableau de bord) l'amortissement non déductible (AND) et l'avantage en nature employeur (AEN) ; les véhicules restent classés par TCO d'usage croissant.",
        "Each component of the total cost of ownership is detailed by vehicle over the contract duration (options and commercial discount included). The \"full employer cost\" adds to the usage TCO (lease + energy + TVS + penalty, carried over from the dashboard) the non-deductible depreciation (AND) and the employer's benefit-in-kind share (AEN); vehicles remain ranked by increasing usage TCO.",
      );
  const introL = doc.splitTextToSize(intro, PAGE_W - M * 2);
  doc.text(introL, M, y);
  y += introL.length * 13 + 16;

  // Calcul pour chaque véhicule.
  const computed = vehicles.map((sv) => {
    const duree = sv.durationMonths / 12;
    const optionsTotalTtc = sv.options.reduce((s, o) => s + o.qty * o.unitHt, 0);
    const r = calculateTcoFull(sv.vehicle, {
      dureeAnnees: duree,
      kmContrat: sv.kmPerYear * duree,
      prixEssenceLitre: e.fuelPriceL,
      prixKwhDomicile: e.kWhHome,
      prixKwhPublic: e.kWhPublic,
      optionsTotalTtc,
      remisePctOverride: sv.discountPct,
    }, sv.negotiatedMonthly);
    return { sv, r, duree };
  });

  // === Admin (page fusionnée) : bandeau d'impact + KPI en tête ===
  if (ADMIN_MODE) {
    // Métrique de reco = COÛT EMPLOYEUR COMPLET (loyer + énergie + TVS + malus
    // + AND + AEN employeur), et non le seul TCO d'usage.
    const impactRows = computed.map((c) => {
      const kmC = c.sv.kmPerYear * c.duree;
      return { sv: c.sv, total: c.r.tcoEmployeurComplet, per100: kmC > 0 ? (c.r.tcoEmployeurComplet / kmC) * 100 : 0 };
    });
    const evImpact = impactRows.filter((r) => !r.sv.vehicle.isCurrentFleet);
    const ranked = [...(evImpact.length ? evImpact : impactRows)].sort((a, b) => a.total - b.total);
    if (ranked.length > 0) {
      const best = ranked[0];
      const worst = ranked[ranked.length - 1];
      const ecart = Math.max(0, worst.total - best.total);
      const ecartPct = worst.total > 0 ? (ecart / worst.total) * 100 : 0;
      const W = PAGE_W - M * 2;
      // Bandeau d'impact (carte noire)
      const bh = 72;
      doc.setFillColor(...INK);
      doc.roundedRect(M, y, W, bh, 12, 12, "F");
      doc.setFillColor(...PRODUCT_ACCENT);
      doc.roundedRect(M + 14, y + 14, 5, bh - 28, 2.5, 2.5, "F");
      doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(7.5); doc.setTextColor(...PRODUCT_ACCENT);
      doc.text(L("RECOMMANDATION BEEV", "BEEV RECOMMENDATION"), M + 28, y + 19);
      doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(15); doc.setTextColor(252, 249, 242);
      doc.text(`${best.sv.vehicle.brand} ${best.sv.vehicle.model}`.slice(0, 36), M + 28, y + 40);
      doc.setFont(BRAND_FONT, "normal"); doc.setFontSize(8.5); doc.setTextColor(206, 206, 206);
      doc.text(L("Le coût employeur complet le plus bas de la sélection.", "The lowest full employer cost in the selection."), M + 28, y + 55);
      doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(22); doc.setTextColor(255, 255, 255);
      doc.text(`${best.per100.toFixed(2)} €/100km`, M + W - 16, y + 36, { align: "right" });
      doc.setFont(BRAND_FONT, "normal"); doc.setFontSize(8.5); doc.setTextColor(...PRODUCT_ACCENT);
      doc.text(L(`${eur(ecart)} économisés sur le contrat (−${ecartPct.toFixed(0)} %)`, `${eur(ecart)} saved over the contract (−${ecartPct.toFixed(0)}%)`), M + W - 16, y + 53, { align: "right" });
      y += bh + 14;
      // 4 KPI
      const kc = (W - 30) / 4;
      const kpiData: { lab: string; val: string; sub: string; c: number[] }[] = [
        { lab: L("MEILLEUR COÛT TOTAL", "BEST TOTAL COST"), val: `${best.per100.toFixed(2)} €`, sub: `/100km · ${best.sv.vehicle.brand} ${best.sv.vehicle.model}`.slice(0, 32), c: [165, 210, 255] },
        { lab: L("COÛT TOTAL LE + ÉLEVÉ", "HIGHEST TOTAL COST"), val: `${worst.per100.toFixed(2)} €`, sub: `/100km · ${worst.sv.vehicle.brand} ${worst.sv.vehicle.model}`.slice(0, 32), c: [244, 184, 170] },
        { lab: L("ÉCART SUR CONTRAT", "GAP OVER CONTRACT"), val: eur(ecart), sub: L("pire vs meilleur", "worst vs best"), c: INK },
        { lab: L("ÉCART %", "GAP %"), val: `${ecartPct.toFixed(1)} %`, sub: L("pire − meilleur ÷ pire", "worst − best ÷ worst"), c: [211, 204, 216] },
      ];
      kpiData.forEach((k, i) => {
        const kx = M + i * (kc + 10);
        doc.setFillColor(...BG); doc.roundedRect(kx, y, kc, 56, 7, 7, "F");
        doc.setFillColor(k.c[0], k.c[1], k.c[2]); doc.rect(kx, y, kc, 3, "F");
        doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(6.5); doc.setTextColor(...SUB);
        doc.text(k.lab, kx + 8, y + 16);
        doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(15); doc.setTextColor(...INK);
        doc.text(k.val, kx + 8, y + 35);
        doc.setFont(BRAND_FONT, "normal"); doc.setFontSize(6.5); doc.setTextColor(...SUB);
        doc.text((doc.splitTextToSize(k.sub, kc - 14) as string[]).slice(0, 1), kx + 8, y + 47);
      });
      y += 56 + 16;
    }
  }

  // Flotte actuelle (thermiques) séparée des EV proposés : elle s'affiche
  // TOUJOURS en tête de liste, avec un bandeau d'impact.
  const detCurrent = computed.filter((c) => c.sv.vehicle.isCurrentFleet);
  const detEv = computed.filter((c) => !c.sv.vehicle.isCurrentFleet);
  if (detCurrent.length > 0) {
    const curTotal = detCurrent.reduce((s, c) => s + c.r.tcoEmployeurComplet * c.sv.quantity, 0);
    y = drawCurrentFleetBanner(
      doc,
      y,
      eur(curTotal),
      L("coût employeur complet actuel (×durée)", "current full employer cost (×duration)"),
      L(
        "Coût complet de votre flotte thermique actuelle sur la durée. Les véhicules électriques proposés ci-dessous réduisent ce total.",
        "Full cost of your current combustion fleet over the duration. The electric vehicles proposed below reduce this total.",
      ),
    );
  }

  // Segmentation par GROUPE DE COMPARAISON (catégorie saisie par le commercial),
  // appliquée aux EV proposés. Si au moins un groupe est nommé, on analyse le
  // TCO PAR catégorie : un intertitre par groupe + tri du meilleur au pire DANS
  // le groupe. Sinon, liste globale triée par TCO croissant.
  const groupKey = (sv: SelectedVehicle) => (sv.comparisonGroup ?? "").trim();
  const hasGroups = PDF_CFG.tcoGroupByComparison !== false && detEv.some((c) => groupKey(c.sv));
  const groupOrder: string[] = [];
  const buckets = new Map<string, typeof computed>();
  for (const c of detEv) {
    // Si le mode groupé est désactivé, tout va dans un seul bucket global trié
    // par TCO (pas d'intertitre de segment).
    const g = (hasGroups ? groupKey(c.sv) : "") || "__none__";
    if (!buckets.has(g)) { buckets.set(g, []); groupOrder.push(g); }
    buckets.get(g)!.push(c);
  }
  groupOrder.sort((a, b) => (a === "__none__" ? 1 : 0) - (b === "__none__" ? 1 : 0));
  // Admin : tri par coût employeur complet (métrique de reco) ; sinon TCO usage.
  for (const g of groupOrder) buckets.get(g)!.sort((a, b) => (ADMIN_MODE ? a.r.tcoEmployeurComplet - b.r.tcoEmployeurComplet : a.r.tcoTotal - b.r.tcoTotal));
  // Liste à plat triée (pour la légende / fallback)
  const rows = groupOrder.flatMap((g) => buckets.get(g)!);

  // Tableau autoTable — 7 colonnes (au lieu de 10) pour rester lisible sur A4
  // portrait. Les composantes sont fusionnées : "Malus" = Malus CO2 + Poids,
  // "Fiscalité" = AND + AEN employeur sur la durée.
  // Couleurs charte 2026 :
  //   ALERT_BG   = Rose 30% (#FCEAE5) — fond cellule pour valeurs > 0
  //   ALERT_TEXT = Rose foncé dérivé (#B5604F) — lisible sur fond cream
  //   ALERT_TEXT garantit le contraste là où le Rose charte (#F4B8AA)
  //   serait trop pâle pour un texte de chiffre.
  const ALERT_BG: [number, number, number] = [252, 234, 229]; // #FCEAE5
  const ALERT_TEXT: [number, number, number] = [181, 96, 79];  // #B5604F
  const GROUP_BG: [number, number, number] = [253, 241, 238];  // rose clair (intertitre groupe)

  // Construit une ligne de données pour un véhicule.
  const buildRow = ({ sv, r, duree }: (typeof computed)[number]) => {
    const malusTotal = r.malusCO2 + r.malusPoids;
    const andTotal = r.andTotal;
    const aenTotal = r.aenEmployeurTotal;
    // Affichage hiérarchisé : Marque + Modèle sur la 1re ligne, Version sur la
    // 2e (ou plusieurs si longue), durée/km sur la dernière. Sépare clairement
    // deux finitions d'un même modèle dans le tableau.
    const brandModel = `${sv.vehicle.brand} ${sv.vehicle.model}`.trim();
    const ver = (sv.vehicle.version ?? "").trim();
    const durKm = `${sv.durationMonths} ${L("mois", "months")} · ${((sv.kmPerYear * sv.durationMonths / 12) / 1000).toFixed(0)}k km`;
    const label = [brandModel, ver, durKm].filter(Boolean).join("\n");
    return [
      { content: label, styles: { halign: "left" as any, fontStyle: "normal" as any, fontSize: 8.5 } },
        { content: eur(r.loyerTotal), styles: { halign: "center" as any } },
        { content: eur(r.coutEnergie), styles: { halign: "center" as any } },
        { content: eur(r.tvsTotal), styles: r.tvsTotal > 0
          ? { halign: "center" as any, fillColor: ALERT_BG, textColor: ALERT_TEXT, fontStyle: "bold" as any }
          : { halign: "center" as any, textColor: SUB } },
        { content: eur(malusTotal), styles: malusTotal > 0
          ? { halign: "center" as any, fillColor: ALERT_BG, textColor: ALERT_TEXT, fontStyle: "bold" as any }
          : { halign: "center" as any, textColor: SUB } },
        // AND calculé sur le PRIX CATALOGUE TTC du véhicule. Si ce prix n'est pas
        // renseigné dans le catalogue, l'AND ne peut pas être calculé : on affiche
        // « — » plutôt qu'un « 0 € » trompeur, pour signaler la donnée manquante.
        (sv.vehicle.priceTtc ?? 0) <= 0
          ? { content: "—", styles: { halign: "center" as any, textColor: SUB } }
          : { content: eur(andTotal), styles: { halign: "center" as any } },
        { content: eur(aenTotal), styles: { halign: "center" as any } },
        // AEN salarié /mois : avantage en nature imposable côté salarié, forfait
        // 50 % du loyer mensuel SANS CARBURANT (abattement 70 % si EV éco-score).
        // Affiché à titre INFORMATIF — n'entre PAS dans le coût employeur complet.
        { content: eur(r.aenMensuel), styles: { halign: "center" as any, textColor: SUB, fontStyle: "italic" as any } },
        { content: eur(r.tcoEmployeurComplet), styles: { halign: "center" as any, fontStyle: "bold" as any, textColor: ADMIN_MODE ? ACCENT_TEXT : LAVENDER, fontSize: 10 } },
      ];
  };

  // Corps du tableau : un intertitre par groupe de comparaison (si au moins un
  // groupe est nommé), puis les véhicules du groupe triés par TCO croissant.
  // Couleurs d'intertitre par catégorie (charte Beev) — chaque groupe a sa
  // couleur pour bien différencier les catégories.
  const GROUP_COLORS: [number, number, number][] = [
    [237, 246, 255], // bleu clair
    [246, 245, 247], // violet clair
    [232, 247, 233], // vert clair
    [253, 241, 238], // rose clair
    [255, 245, 230], // ambre clair
  ];
  // tcoBody + mapping ligne→véhicule (null pour les lignes d'intertitre).
  const tcoBody: any[] = [];
  const rowVehicles: (SelectedVehicle | null)[] = [];
  // 1) FLOTTE ACTUELLE en tête (bandeau noir), triée du plus cher au moins cher.
  if (detCurrent.length > 0) {
    tcoBody.push(sectionHeaderRow(L("Flotte actuelle", "Current fleet"), 9, INK, true));
    rowVehicles.push(null);
    for (const c of [...detCurrent].sort((a, b) => b.r.tcoEmployeurComplet - a.r.tcoEmployeurComplet)) {
      tcoBody.push(buildRow(c)); rowVehicles.push(c.sv);
    }
  }
  // 2) Véhicules électriques proposés (groupés ou non).
  if (detCurrent.length > 0 && !hasGroups && detEv.length > 0) {
    tcoBody.push(sectionHeaderRow(L("Véhicules électriques proposés", "Proposed electric vehicles"), 9, GROUP_COLORS[2]));
    rowVehicles.push(null);
  }
  let groupIdx = 0;
  for (const g of groupOrder) {
    if (hasGroups) {
      const label = g === "__none__" ? L("Autres véhicules", "Other vehicles") : g;
      const gColor = GROUP_COLORS[groupIdx % GROUP_COLORS.length];
      tcoBody.push([{ content: label.toUpperCase(), colSpan: 9, styles: { fillColor: gColor, textColor: INK, fontStyle: "bold" as any, fontSize: 9, halign: "center" as any, cellPadding: 6 } }]);
      rowVehicles.push(null);
      groupIdx++;
    }
    for (const c of buckets.get(g)!) { tcoBody.push(buildRow(c)); rowVehicles.push(c.sv); }
  }

  // Vignettes véhicule (mêmes que le comparateur), mappées par véhicule.
  const orderedSvs = rowVehicles.filter((s): s is SelectedVehicle => !!s);
  const orderedThumbs = await preloadVehicleThumbs(orderedSvs);
  const thumbMap = new Map<SelectedVehicle, LoadedImage | null>();
  orderedSvs.forEach((sv, i) => thumbMap.set(sv, orderedThumbs[i]));

  // Décomposition visuelle (admin) : mini-barre empilée loyer / énergie /
  // fiscalité par véhicule, dessinée dans la cellule véhicule. Échelle commune
  // (longueur ∝ TCO usage) → repère visuel du plus/moins cher.
  const compMap = new Map<SelectedVehicle, { loyer: number; energie: number; fisc: number; empl: number; total: number }>();
  let maxUsage = 1;
  for (const c of computed) {
    const fisc = c.r.tvsTotal + c.r.malusCO2 + c.r.malusPoids;
    // Coût fiscal réel de l'AND (IS sur le montant réintégré), pas l'AND
    // brut — sinon la somme des segments dépasserait `total`.
    const empl = c.r.coutFiscalANDTotal + c.r.aenEmployeurTotal;
    const total = c.r.tcoEmployeurComplet; // source unique, cohérent avec le reste du PDF
    compMap.set(c.sv, { loyer: c.r.loyerTotal, energie: c.r.coutEnergie, fisc, empl, total });
    if (total > maxUsage) maxUsage = total;
  }
  const SEG_ENERGIE: [number, number, number] = [165, 210, 255];
  const SEG_FISC: [number, number, number] = [150, 122, 168]; // violet plus soutenu (lisible sur barre)
  const SEG_EMPL: [number, number, number] = [244, 184, 170]; // rose (charges employeur AND + AEN)
  if (ADMIN_MODE) {
    doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(7); doc.setTextColor(...SUB);
    const decompLabel2 = L("DÉCOMPOSITION", "BREAKDOWN");
    doc.text(decompLabel2, M, y + 4);
    let lx = M + doc.getTextWidth(decompLabel2) + 12;
    const lgs: [string, [number, number, number]][] = [[L("Loyer", "Lease"), INK], [L("Énergie", "Energy"), SEG_ENERGIE], [L("Fiscalité", "Tax"), SEG_FISC], [L("Charges empl.", "Employer charges"), SEG_EMPL]];
    doc.setFont(BRAND_FONT, "normal");
    for (const [lab, col] of lgs) {
      doc.setFillColor(col[0], col[1], col[2]); doc.rect(lx, y - 3, 9, 7, "F"); lx += 13;
      doc.setTextColor(...SUB); doc.text(lab, lx, y + 4); lx += doc.getTextWidth(lab) + 14;
    }
    y += 16;
  }

  autoTable(doc, {
    startY: y,
    theme: "plain",
    head: [[
      L("VÉHICULE", "VEHICLE"),
      L("LOYER\nTOTAL", "LEASE\nTOTAL"),
      L("ÉNERGIE", "ENERGY"),
      L("TVS\n(×durée)", "TVS\n(×duration)"),
      L("MALUS\n(achat)", "PENALTY\n(purchase)"),
      L("AND\n(×durée)", "AND\n(×duration)"),
      L("AEN EMPL.\n(×durée)", "AEN EMPLOYER\n(×duration)"),
      L("AEN SAL.\n/mois (info)", "AEN EMPLOYEE\n/month (info)"),
      L("COÛT EMPL.\nCOMPLET", "FULL EMPL.\nCOST"),
    ]],
    body: tcoBody,
    headStyles: { fillColor: ADMIN_MODE ? INK : LAVENDER, textColor: 255, fontSize: 7.5, fontStyle: "bold", font: BRAND_FONT, cellPadding: 5, halign: "center" as any, valign: "middle" as any },
    // Police réduite + padding serré sur les colonnes chiffrées pour que les
    // gros montants (« 53 305 € », « 99 777 € ») tiennent sur UNE ligne.
    bodyStyles: { fontSize: 7.5, cellPadding: 4, textColor: INK, lineColor: RULE, lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 } as any, font: BRAND_FONT, valign: "middle" as any, overflow: "visible" as any },
    alternateRowStyles: { fillColor: BG },
    columnStyles: {
      0: { cellWidth: 130, halign: "left" as any, cellPadding: { left: 54, right: 4, top: 6, bottom: ADMIN_MODE ? 16 : 6 }, minCellHeight: ADMIN_MODE ? 58 : 48, valign: "middle" as any, overflow: "linebreak" as any },
      1: { cellWidth: 46 },
      2: { cellWidth: 44 },
      3: { cellWidth: 40 },
      4: { cellWidth: 40 },
      5: { cellWidth: 40 },
      6: { cellWidth: 46 },
      7: { cellWidth: 46 },
      8: { cellWidth: "auto" },
    },
    // Une ligne véhicule (label multi-ligne + vignette) ne doit jamais être
    // coupée entre 2 pages : sinon la version se retrouve seule en haut de page
    // avec des cellules chiffres vides et la vignette décalée.
    rowPageBreak: "avoid",
    margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
    // Colonne "Coût employeur complet" (dernière, index 8) mise en évidence :
    // c'est la métrique de décision, elle doit se distinguer visuellement du
    // reste du tableau plutôt que se fondre dans une rangée de chiffres.
    didParseCell: (data: any) => {
      if (data.column.index !== 8) return;
      if (data.section === "head") {
        data.cell.styles.fillColor = SEG_FISC;
      } else if (data.section === "body" && rowVehicles[data.row.index]) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 9;
      }
    },
    didDrawCell: (data: any) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const sv = rowVehicles[data.row.index];
      if (!sv) return; // ligne d'intertitre de groupe
      drawThumbCell(doc, data.cell, thumbMap.get(sv) ?? null);
      // Mini-barre empilée (admin) en bas de la cellule véhicule.
      if (ADMIN_MODE) {
        const cmp = compMap.get(sv);
        if (cmp && cmp.total > 0) {
          const cell = data.cell;
          const bx = cell.x + 54;
          const bw = cell.x + cell.width - 4 - bx;
          const by = cell.y + cell.height - 11;
          doc.setFillColor(240, 238, 232);
          doc.rect(bx, by, bw, 6, "F");
          const scaled = (cmp.total / maxUsage) * bw;
          let sx = bx;
          const segs: [number, [number, number, number]][] = [[cmp.loyer, INK], [cmp.energie, SEG_ENERGIE], [cmp.fisc, SEG_FISC], [cmp.empl, SEG_EMPL]];
          for (const [val, col] of segs) {
            const w = (val / cmp.total) * scaled;
            if (w > 0.4) { doc.setFillColor(col[0], col[1], col[2]); doc.rect(sx, by, w, 6, "F"); sx += w; }
          }
        }
      }
    },
  });
  let y2 = (doc as any).lastAutoTable.finalY + 20;

  // Encart de lecture pour la colonne AND : la note méthodologique complète
  // est plus bas, mais ce rappel visuel au plus près du tableau évite de mal
  // lire la colonne AND comme un coût direct.
  {
    const noteText = L(
      "La colonne AND n'est pas un montant payé directement par l'entreprise : c'est la base sur laquelle elle perd le droit de déduire de l'impôt sur les sociétés. Le surcoût réel, égal à 25 % de ce montant, est déjà intégré dans la colonne « Coût employeur complet ».",
      "The AND column is not an amount paid directly by the company: it is the base on which it loses the right to deduct from corporate tax (AND stands for Avantage Non Déductible, a French tax rule). The real extra cost, equal to 25% of this amount, is already included in the \"Full employer cost\" column.",
    );
    const noteLines = doc.splitTextToSize(noteText, PAGE_W - M * 2 - 24) as string[];
    const noteH = noteLines.length * 11 + 16;
    y2 = ensureSpace(doc, y2, noteH + 10, client, "vehicles");
    const VIOLET_TINT: [number, number, number] = [239, 234, 243];
    doc.setFillColor(...VIOLET_TINT);
    doc.rect(M, y2, PAGE_W - M * 2, noteH, "F");
    doc.setFillColor(...SEG_FISC);
    doc.rect(M, y2, 3, noteH, "F");
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    doc.text(noteLines, M + 14, y2 + 13);
    y2 += noteH + 14;
  }

  // Notes méthodologiques : réaffichées pour tous (admin inclus). Masquées
  // depuis le 30/06 pour "épurer" la page admin, mais un calcul fiscal sans
  // sa méthode n'est pas vérifiable — la transparence prime sur l'épure.
  const legendLines = PDF_LANG === "en" ? [
    "Cells in pink signal an additional tax charge at purchase (CO2 penalty, weight penalty) or a non-zero annual company car tax.",
    "The full employer cost adds the lease, energy, company car tax, penalties, the AND tax impact and the employer's share of the benefit-in-kind, over the contract duration.",
    "The AND (Avantage Non Déductible, non-deductible depreciation, a French tax rule) is the portion of the purchase price above the tax ceiling set according to the vehicle's CO2 emissions, after deducting the battery price, amortized over 5 years.",
    "The AND is not a disbursement for the company: it is an amount it cannot deduct from its taxable income. The real cost borne is the additional corporate tax generated by this amount, i.e. 25% of the AND. It is this amount, not the raw AND, that enters the full employer cost.",
    "The employer's share of the benefit-in-kind (AEN) is 42% of the calculated benefit-in-kind, with a 70% reduction for electric vehicles benefiting from the environmental score.",
    "The employee's benefit-in-kind, calculated on 50% of the monthly lease with the same electric reduction, is taxable for the employee. It is shown for information only and is not included in the full employer cost or the TCO.",
    "The total lease equals the negotiated monthly lease multiplied by the contract duration, recoverable VAT included for long-term leasing.",
    "The energy cost equals the vehicle's consumption multiplied by the contract mileage and the fuel or electricity price, based on 85% home charging and 15% public charging.",
  ] : [
    "Les cellules en rose signalent une charge fiscale supplémentaire à l'achat (malus CO2, malus au poids) ou une taxe annuelle sur les véhicules de société non nulle.",
    "Le coût employeur complet additionne le loyer, l'énergie, la taxe sur les véhicules de société, les malus, l'impact fiscal de l'AND et la part employeur de l'avantage en nature, sur la durée du contrat.",
    "L'AND (avantage non déductible) correspond à la part du prix d'achat qui dépasse le plafond fiscal fixé selon les émissions de CO2 du véhicule, après déduction du prix de la batterie, amortie sur 5 ans.",
    "L'AND n'est pas un décaissement pour l'entreprise : c'est un montant qu'elle ne peut pas déduire de son résultat imposable. Le coût réel supporté est l'impôt sur les sociétés supplémentaire généré par ce montant, soit 25 % de l'AND. C'est ce montant, et non l'AND brut, qui entre dans le coût employeur complet.",
    "La part employeur de l'avantage en nature correspond à 42 % de l'avantage en nature calculé, avec un abattement de 70 % pour les véhicules électriques bénéficiant du score environnemental.",
    "L'avantage en nature du salarié, calculé sur 50 % du loyer mensuel avec le même abattement électrique, est imposable pour le collaborateur. Il est indiqué à titre d'information et n'entre pas dans le coût employeur complet ni dans le TCO.",
    "Le loyer total correspond au loyer mensuel négocié multiplié par la durée du contrat, TVA récupérable incluse en location longue durée.",
    "Le coût énergie correspond à la consommation du véhicule multipliée par le kilométrage du contrat et le prix du carburant ou de l'électricité, sur la base d'une recharge à 85 % à domicile et 15 % en public.",
  ];
  // On pré-wrappe avec la police déjà fixée (8pt) pour mesurer la hauteur
  // réelle. Pas d'encart à hauteur fixe (ça désynchronise si le contenu
  // déborde sur une 2e page) : juste un titre + page-break par ligne, comme
  // avant, avec de vraies puces rondes au lieu du caractère "· ".
  const legendLineH = 11;
  const bulletIndent = 11;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  const wrappedAll = legendLines.map((line) => doc.splitTextToSize(line, PAGE_W - M * 2 - bulletIndent) as string[]);
  const titleLineH = 18;
  const drawLegendTitle = (top: number) => {
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(L("MÉTHODE DE CALCUL", "CALCULATION METHOD"), M, top);
    doc.setDrawColor(...RULE);
    doc.line(M, top + 4, PAGE_W - M, top + 4);
    return top + titleLineH;
  };
  const totalLegendH = titleLineH + wrappedAll.reduce((s, w) => s + w.length * legendLineH + 4, 0);
  if (y2 + Math.min(totalLegendH, titleLineH + legendLineH * 3) > FOOTER_LIMIT) {
    doc.addPage();
    if (client) drawHeader(doc, client, "vehicles");
    y2 = 116;
  }
  let ly = drawLegendTitle(y2);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SUB);
  wrappedAll.forEach((wrapped) => {
    if (ly + wrapped.length * legendLineH > FOOTER_LIMIT) {
      doc.addPage();
      if (client) drawHeader(doc, client, "vehicles");
      ly = drawLegendTitle(116);
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...SUB);
    }
    doc.setFillColor(...RULE);
    doc.circle(M + 2, ly - 3, 1.3, "F");
    doc.text(wrapped, M + bulletIndent, ly);
    ly += wrapped.length * legendLineH + 4;
  });
  y2 = ly + 6;

  // Bloc TOTAUX FLOTTE retiré sur demande utilisateur (il s'agit d'une
  // comparaison entre véhicules pour aider le client à choisir, pas d'une
  // flotte à commander en totalité).
}

// ============ TCO B2B2E — Bornes au domicile des collaborateurs ============
// Page dédiée pour les projets "Bornes domicile". Compare le coût total
// entre la solution Beev (recharge domicile + itinérance + supervision)
// et la solution thermique de référence (carburant SP95/Diesel).
function drawB2B2ETco(doc: jsPDF, input: B2B2ECalculatorInput) {
  // Charte Beev 2026 : Rose #F4B8AA · Bleu #A5D2FF · Violet #D3CCD8 · Black ·
  // Beige. On utilise les 3 accents (rose/bleu/violet) pour varier les KPI.
  const PINK: [number, number, number] = [244, 184, 170]; // rose charte
  const BLEU: [number, number, number] = [165, 210, 255]; // #A5D2FF bleu charte
  const VIOLET: [number, number, number] = [211, 204, 216]; // #D3CCD8 violet charte
  const result = calculateB2B2ETco(input);

  let y = 116;
  // Eyebrow + titre
  doc.setFillColor(...PINK);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text("ANALYSE TCO · BORNES DOMICILE COLLABORATEURS", M + 30, y - 4);
  y += 14;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(26);
  doc.setTextColor(...INK);
  doc.text("Combien votre flotte économisera-t-elle ?", M, y + 18);
  y += 50;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const intro = `Comparaison directe entre la solution Beev (recharge à domicile + itinérance + supervision Beev Home Charging) et la solution thermique de référence (carburant) pour ${input.nbCollabs} collaborateur${input.nbCollabs > 1 ? "s" : ""} sur ${input.dureeAnnees} an${input.dureeAnnees > 1 ? "s" : ""}.`;
  const introL = doc.splitTextToSize(intro, PAGE_W - M * 2);
  doc.text(introL, M, y);
  y += introL.length * 13 + 18;

  // === Bandeau ÉCONOMIE (la valeur reine) ===
  // Fond rose charte (#F4B8AA) : texte en NOIR (#1D1D1D) pour le contraste —
  // le texte blanc sur rose clair était illisible (bug charte).
  doc.setFillColor(...LAVENDER);
  doc.roundedRect(M, y, PAGE_W - M * 2, 100, 8, 8, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text("ÉCONOMIE TOTALE SUR CONTRAT", M + 16, y + 20);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(34);
  doc.setTextColor(...INK);
  doc.text(eur(result.economieFlotteTotale), M + 16, y + 60);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(
    `soit ${eur(result.economieFlotteAnnuelle)} / an · ${eur(result.economieParCollabParAn)} par collaborateur / an · ${result.economiePct.toFixed(1)} % moins cher que le thermique`,
    M + 16, y + 80,
  );
  y += 112;

  // === 4 KPIs colorés ===
  const kpiW = (PAGE_W - M * 2 - 30) / 4;
  const kpiH = 80;
  const kpis = [
    { label: "ÉCONOMIE / COLLAB / AN", value: eur(result.economieParCollabParAn), color: PINK, sub: "vs solution thermique" },
    { label: "ROI BORNE", value: result.roiMois > 0 && result.roiMois < 120 ? `${result.roiMois.toFixed(0)} mois` : "—", color: VIOLET, sub: "avant amortissement complet" },
    { label: "CO2 ÉVITÉ", value: `${result.co2EviteTonnes.toFixed(1)} t`, color: BLEU, sub: `sur ${input.dureeAnnees} ans (135 g/km évité)` },
    { label: "KM CONTRAT / COLLAB", value: `${(result.kmTotalParCollab / 1000).toFixed(0)} k km`, color: INK, sub: `${input.kmParAnParCollab.toLocaleString("fr-FR")} km/an` },
  ];
  kpis.forEach((k, i) => {
    const cx = M + i * (kpiW + 10);
    doc.setFillColor(...BG);
    doc.roundedRect(cx, y, kpiW, kpiH, 6, 6, "F");
    doc.setFillColor(...k.color);
    doc.rect(cx, y, kpiW, 3, "F");
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SUB);
    doc.text(k.label, cx + 10, y + 18);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(17);
    doc.setTextColor(...INK);
    doc.text(k.value, cx + 10, y + 44);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SUB);
    const subL = doc.splitTextToSize(k.sub, kpiW - 20);
    doc.text(subL.slice(0, 2), cx + 10, y + 60);
  });
  y += kpiH + 20;

  // === Décomposition 2 colonnes : Beev vs Thermique ===
  const colW = (PAGE_W - M * 2 - 20) / 2;

  // Colonne gauche : Beev — fond rose très clair (charte 2026, rose-20 #FDF1EE)
  // au lieu de l'ancien lavande #EEE8FE hors charte.
  const colH = 200;
  doc.setFillColor(253, 241, 238); // #FDF1EE rose-20 charte
  doc.roundedRect(M, y, colW, colH, 8, 8, "F");
  // Header
  doc.setFillColor(...LAVENDER);
  doc.roundedRect(M, y, colW, 28, 8, 8, "F");
  doc.rect(M, y + 14, colW, 14, "F");
  // En-tête rose : texte noir (contraste charte) au lieu de blanc illisible.
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text("SOLUTION BEEV", M + 14, y + 18);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text("Recharge domicile + itinérance + supervision Home Charging", M + 14, y + 38);

  // Postes de coût. Les TOTAUX des deux colonnes sont posés à une position
  // FIXE en bas de carte (totalLabelY) pour rester alignés sur la même ligne
  // quel que soit le nombre de postes — on ne remplit donc plus la colonne
  // thermique avec des « — » disgracieux. Le séparateur de chaque poste suit
  // la hauteur réelle du libellé (qui peut s'enrouler sur 2 lignes).
  const lineTop = y + 60;
  const minStep = 24;
  const labelW = colW - 96; // réserve à droite pour le montant
  const totalLabelY = y + colH - 30; // ligne des totaux, identique pour les 2 colonnes

  const drawCostLine = (x: number, label: string, value: string, yPos: number): number => {
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUB);
    const ll = doc.splitTextToSize(label, labelW) as string[];
    doc.text(ll, x + 14, yPos);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(value, x + colW - 14, yPos, { align: "right" });
    const next = yPos + Math.max(minStep, ll.length * 11 + 10);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.4);
    doc.line(x + 14, next - 8, x + colW - 14, next - 8);
    return next;
  };

  const drawColTotal = (x: number, label: string, value: string) => {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.6);
    doc.line(x + 14, totalLabelY - 14, x + colW - 14, totalLabelY - 14);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...SUB);
    doc.text(label, x + 14, totalLabelY);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(16);
    doc.setTextColor(...INK); // noir lisible (le rose pâle de la charte était illisible en texte)
    doc.text(value, x + colW - 14, totalLabelY + 4, { align: "right" });
  };

  // Colonne Beev
  let by = lineTop;
  by = drawCostLine(M, "Énergie électrique (mix domicile + itinérance)", eur(result.energieBeevFlotteTotale), by);
  by = drawCostLine(M, "Supervision Beev Home Charging", eur(result.supervisionFlotteTotale), by);
  by = drawCostLine(M, "Investissement bornes installées", eur(result.investBorneFlotte), by);
  drawColTotal(M, "COÛT TOTAL BEEV", eur(result.coutBeevFlotteTotal));

  // Colonne droite : Thermique
  const rx = M + colW + 20;
  doc.setFillColor(...BG); // cream Beev (charte officielle)
  doc.roundedRect(rx, y, colW, colH, 8, 8, "F");
  doc.setFillColor(...INK);
  doc.roundedRect(rx, y, colW, 28, 8, 8, "F");
  doc.rect(rx, y + 14, colW, 14, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("SOLUTION THERMIQUE (RÉFÉRENCE)", rx + 14, y + 18);
  // Sous-titre sur le corps beige : couleur grise (était blanc → invisible).
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SUB);
  doc.text(`Carburant SP95 / Diesel via station-service (${input.consoCarbL100} L/100 km)`, rx + 14, y + 38);

  drawCostLine(rx, `Carburant (${input.prixCarbL.toFixed(2)} €/L × ${(result.energieCarbParCollab * input.nbCollabs).toFixed(0)} L)`, eur(result.coutCarbFlotteTotal), lineTop);
  drawColTotal(rx, "COÛT TOTAL THERMIQUE", eur(result.coutCarbFlotteTotal));

  y += colH + 20;

  // === Encart Bases de calcul (transparence) ===
  if (y < FOOTER_LIMIT - 90) {
    doc.setFillColor(...BG);
    doc.rect(M, y, PAGE_W - M * 2, 80, "F");
    doc.setFillColor(...LAVENDER);
    doc.rect(M, y, 4, 80, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...LAVENDER);
    doc.text("BASES DE CALCUL · HYPOTHÈSES", M + 14, y + 16);

    const lines = [
      `· ${input.nbCollabs} collaborateurs · ${input.kmParAnParCollab.toLocaleString("fr-FR")} km/an · ${input.dureeAnnees} ans`,
      `· Énergie : conso élec ${input.consoElecKWh100} kWh/100 (${input.mixDomicilePct}% domicile à ${input.prixKwhDom.toFixed(2)} €/kWh + ${100 - input.mixDomicilePct}% itinérance à ${input.prixKwhPub.toFixed(2)} €/kWh)`,
      `· Référence thermique : conso ${input.consoCarbL100} L/100 · prix carburant ${input.prixCarbL.toFixed(2)} €/L (SP95 ou Diesel)`,
      `· Supervision Beev Home Charging : ${input.supervisionParMoisParCollab} €/mois/collab · installation borne ${input.investBorneParCollabHt} € HT/collab amorti sur ${input.dureeAnnees} ans`,
      `· CO2 évité estimé sur la base de 135 g CO2/km émis en moyenne par un véhicule thermique équivalent`,
    ];
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    lines.forEach((l, i) => doc.text(l, M + 14, y + 30 + i * 10, { maxWidth: PAGE_W - M * 2 - 28 }));
  }
}

// ============ COMPARATEUR BORNES B2B2E (grille modèles côte à côte) ============
// Grille comparative des bornes domicile sélectionnées (jusqu'à 4 par page) :
// badge (Premium bleu / Rapport qualité-prix rose), photo, specs, prix pose
// 5 m / 10 m, et un pied « Installation 5 m … € HT ». La carte « premium » est
// inversée (fond noir, texte clair) comme sur la maquette.
function chargerInstall5m(ch: Charger): number {
  return ch.installPrice5mHt && ch.installPrice5mHt > 0 ? ch.installPrice5mHt : (ch.priceHt + ch.installPriceHt);
}
function chargerInstall10m(ch: Charger): number {
  return ch.installPrice10mHt && ch.installPrice10mHt > 0 ? ch.installPrice10mHt : (chargerInstall5m(ch) + 75);
}
async function drawChargerComparatorB2B2E(doc: jsPDF, chargers: SelectedCharger[], _client: ClientInfo) {
  const PINK: [number, number, number] = [244, 184, 170];
  const BLEU: [number, number, number] = [165, 210, 255];
  const CARD_BORDER: [number, number, number] = [225, 222, 216];

  let y = 116;
  doc.setFillColor(...PINK);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text("COMPARATEUR · BORNES DOMICILE", M + 30, y - 4);
  y += 14;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(28);
  doc.setTextColor(...INK);
  doc.text("Comparatif des bornes", M, y + 18);
  y += 36;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const introC = doc.splitTextToSize(
    "Les bornes recommandées pour vos collaborateurs, comparées sur les critères clés : puissance, alimentation, garantie, supervision et prix d'installation tout compris.",
    PAGE_W - M * 2,
  ) as string[];
  doc.text(introC, M, y);
  y += introC.length * 13 + 18;

  const list = chargers.slice(0, 4);
  const cols = Math.max(1, list.length);
  const gap = 12;
  const cardW = (PAGE_W - M * 2 - gap * (cols - 1)) / cols;
  const ct = y;
  const halfW = (cardW - 24) * 0.48;

  // Caractéristiques de chaque borne. Les MÊMES lignes pour toutes les cartes,
  // dans le même ordre → on peut leur donner une hauteur uniforme par ligne.
  const buildSpecs = (ch: Charger): Array<[string, string]> => {
    const isTri = /tri/i.test(ch.type) || (ch.powerKw >= 11 && !/mono/i.test(ch.type));
    const ampMax = isTri
      ? Math.round((ch.powerKw * 1000) / (400 * Math.sqrt(3)))
      : Math.round((ch.powerKw * 1000) / 230);
    const kwLabel = String(ch.powerKw).replace(".", ",");
    const connector = /type\s*2/i.test(ch.type) ? "Type 2" : (ch.type.split(/[·\-]/)[0] || "Type 2").trim();
    return [
      ["Puissance", `${kwLabel} kW`],
      ["Alimentation", isTri ? "Triphasé" : "Monophasé"],
      ["Courant max", `${ampMax} A`],
      ["Connecteur", connector],
      ["Garantie / protection", (ch.warranty && ch.warranty.trim()) || "36 + 24 mois option"],
      ["Casawatt", ch.casawattEligible ? "Oui" : "Non"],
      ["Autre supervision", ch.otherSupervision ? "Oui" : "Non"],
      ["Prix 5 m", `${eur(chargerInstall5m(ch))} HT`],
      ["Prix 10 m", `${eur(chargerInstall10m(ch))} HT`],
    ];
  };
  const allSpecs = list.map((sc) => buildSpecs(sc.charger));
  const rowCount = allSpecs[0]?.length ?? 0;
  // Hauteur uniforme PAR LIGNE = max de lignes nécessaires sur toutes les cartes
  // (ex. une garantie longue sur 2 lignes décale d'autant la même ligne PARTOUT,
  // pour que les lignes restent alignées d'une carte à l'autre).
  const rowSteps: number[] = [];
  for (let r = 0; r < rowCount; r++) {
    let maxLines = 1;
    for (const sp of allSpecs) {
      doc.setFont(BRAND_FONT, "normal"); doc.setFontSize(7);
      const lL = Math.min(2, (doc.splitTextToSize(sp[r][0], halfW) as string[]).length);
      doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(8);
      const vL = Math.min(2, (doc.splitTextToSize(sp[r][1], halfW) as string[]).length);
      maxLines = Math.max(maxLines, lL, vL);
    }
    rowSteps.push(Math.max(20, maxLines * 9 + 9));
  }
  const specsTop = ct + 150;
  const specsH = rowSteps.reduce((a, b) => a + b, 0);
  const cardH = specsTop - ct + specsH + 16 + 40; // specs + marge + pied CTA

  for (let i = 0; i < list.length; i++) {
    const ch = list[i].charger;
    const specs = allSpecs[i];
    const x = M + i * (cardW + gap);
    const premium = ch.comparatorBadge === "premium";
    const txtMain: [number, number, number] = premium ? [252, 249, 242] : INK;
    const txtLabel: [number, number, number] = premium ? [200, 200, 200] : SUB;
    const lineCol: [number, number, number] = premium ? [70, 67, 62] : CARD_BORDER;

    // Corps de carte (fond plein)
    doc.setFillColor(...(premium ? INK : [255, 255, 255] as [number, number, number]));
    doc.roundedRect(x, ct, cardW, cardH, 10, 10, "F");
    // Bandeau d'en-tête bicolore (charte) : beige clair / ton sombre (premium).
    const headZ: [number, number, number] = premium ? [40, 40, 42] : BG;
    doc.setFillColor(headZ[0], headZ[1], headZ[2]);
    doc.roundedRect(x, ct, cardW, 142, 10, 10, "F");
    doc.rect(x, ct + 132, cardW, 10, "F");
    // Bordure de carte (claire) par-dessus les fonds
    if (!premium) {
      doc.setDrawColor(...CARD_BORDER);
      doc.setLineWidth(0.6);
      doc.roundedRect(x, ct, cardW, cardH, 10, 10, "S");
    }
    // Filet de séparation en-tête / caractéristiques
    doc.setDrawColor(lineCol[0], lineCol[1], lineCol[2]);
    doc.setLineWidth(0.5);
    doc.line(x + 10, ct + 142, x + cardW - 10, ct + 142);
    // Badge
    doc.setFillColor(...(premium ? BLEU : PINK));
    doc.roundedRect(x + 10, ct + 12, cardW - 20, 18, 5, 5, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    doc.text(premium ? "Premium" : "Rapport qualité/prix", x + cardW / 2, ct + 24, { align: "center" });
    // Nom
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(txtMain[0], txtMain[1], txtMain[2]);
    const nameLines = (doc.splitTextToSize(`${ch.brand} ${ch.model}`, cardW - 16) as string[]).slice(0, 2);
    doc.text(nameLines, x + cardW / 2, ct + 48, { align: "center" });
    // Tuile photo blanche (rendu uniforme : les visuels produit ont des fonds
    // variés — JPEG blanc, PNG transparent — on les pose sur une tuile blanche
    // pour un cadrage propre, y compris sur la carte premium sombre).
    const tileW = Math.min(96, cardW - 40);
    const tileX = x + (cardW - tileW) / 2;
    const tileY = ct + 70;
    const tileH = 60;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(tileX, tileY, tileW, tileH, 8, 8, "F");
    const imgUrl = (ch.marketingImageUrl && ch.marketingImageUrl.trim()) || ch.image;
    if (imgUrl && imgUrl.trim()) {
      try { await drawImageContain(doc, imgUrl, tileX + 6, tileY + 5, tileW - 12, tileH - 10, [255, 255, 255]); } catch { /* non bloquant */ }
    }
    // Caractéristiques — hauteurs partagées → lignes alignées entre cartes.
    // Chaque cellule est CENTRÉE verticalement dans son emplacement : si une
    // valeur d'une autre carte impose 2 lignes, la valeur courte de cette carte
    // ne « flotte » plus en haut avec un vide en dessous (rythme régulier).
    let slotTop = specsTop;
    for (let r = 0; r < specs.length; r++) {
      const [l, v] = specs[r];
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(7);
      const ll = (doc.splitTextToSize(l, halfW) as string[]).slice(0, 2);
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(8);
      const vv = (doc.splitTextToSize(v, halfW) as string[]).slice(0, 2);
      const lines = Math.max(ll.length, vv.length);
      const slotH = rowSteps[r];
      // baseline de la 1re ligne, bloc centré verticalement dans l'emplacement
      const baseY = slotTop + (slotH - lines * 9) / 2 + 6.5;
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(7);
      doc.setTextColor(txtLabel[0], txtLabel[1], txtLabel[2]);
      doc.text(ll, x + 12, baseY);
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(8);
      doc.setTextColor(txtMain[0], txtMain[1], txtMain[2]);
      doc.text(vv, x + cardW - 12, baseY, { align: "right" });
      slotTop += slotH;
      // Filet de séparation au bas de l'emplacement (sauf après la dernière ligne)
      if (r < specs.length - 1) {
        doc.setDrawColor(lineCol[0], lineCol[1], lineCol[2]);
        doc.setLineWidth(0.3);
        doc.line(x + 12, slotTop, x + cardW - 12, slotTop);
      }
    }
    // Pied CTA
    const ftY = ct + cardH - 32;
    doc.setFillColor(...(premium ? [252, 249, 242] as [number, number, number] : INK));
    doc.roundedRect(x + 10, ftY, cardW - 20, 24, 6, 6, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8);
    const ctaTxt: [number, number, number] = premium ? INK : [252, 249, 242];
    doc.setTextColor(ctaTxt[0], ctaTxt[1], ctaTxt[2]);
    doc.text(`Installation 5 m  ${eur(chargerInstall5m(ch))} HT`, x + cardW / 2, ftY + 15, { align: "center" });
  }

  // Note de bas de page (charte) : accent rose + précision sur les forfaits.
  const noteY = ct + cardH + 24;
  doc.setDrawColor(...PINK);
  doc.setLineWidth(2);
  doc.line(M, noteY - 9, M, noteY + 4);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SUB);
  doc.text(
    "Prix HT, pose comprise jusqu'à la distance indiquée (5 ou 10 m depuis le tableau électrique). Au-delà ou en cas de contrainte technique, un devis sur mesure est établi après visite. Bornes installées et supervisées par Beev.",
    M + 12, noteY, { maxWidth: PAGE_W - M * 2 - 12 },
  );
}

// ============ FICHE PRODUIT BORNE (format « fiche technique » Beev) ============
// Reproduit la maquette des fiches produit officielles : en-tête FICHE
// TECHNIQUE, titre, description, 3 atouts, photo, grille de 6 caractéristiques
// clés. Une page par borne. Fond beige pleine page (pas le bandeau noir).
function chargerProtection(ch: Charger): string {
  if (ch.ipRating && ch.ipRating.trim()) return ch.ipRating.trim();
  const w = ch.warranty ?? "";
  const ip = w.match(/IP\s*\d{2}/i)?.[0];
  const ik = w.match(/IK\s*\d{1,2}/i)?.[0];
  if (ip || ik) return [ip, ik].filter(Boolean).join(" · ").replace(/\s+/g, " ");
  return "IP54 · IK10";
}
// Petit pictogramme dans une pastille bleue (jeu d'icônes simplifié, dessiné
// uniquement avec line/circle/roundedRect — jsPDF n'a pas de primitive polygone).
function drawTileIcon(doc: jsPDF, kind: string, cx: number, cy: number) {
  doc.setDrawColor(29, 29, 29);
  doc.setFillColor(29, 29, 29);
  doc.setLineWidth(1.1);
  const s = 4.5;
  switch (kind) {
    case "power": // éclair (zigzag)
      doc.line(cx + 1.5, cy - s, cx - 2, cy);
      doc.line(cx - 2, cy, cx + 1, cy);
      doc.line(cx + 1, cy, cx - 1.5, cy + s);
      break;
    case "current": // jauge
      doc.circle(cx, cy, s - 0.5, "S");
      doc.line(cx, cy, cx + 2.5, cy - 2.5);
      break;
    case "plug": // prise
      doc.line(cx - 2, cy - s, cx - 2, cy - 1);
      doc.line(cx + 2, cy - s, cx + 2, cy - 1);
      doc.line(cx - 3.5, cy - 1, cx + 3.5, cy - 1);
      doc.line(cx, cy - 1, cx, cy + s);
      break;
    case "shield": // bouclier
      doc.roundedRect(cx - 3, cy - s, 6, 6.5, 1.5, 1.5, "S");
      doc.line(cx, cy + 1.5, cx, cy + s);
      break;
    case "dim": // dimensions
      doc.roundedRect(cx - s, cy - s, s * 2, s * 2, 1, 1, "S");
      break;
    case "temp": // thermomètre
      doc.line(cx, cy - s, cx, cy + 1);
      doc.circle(cx, cy + 2.5, 1.8, "S");
      break;
    default:
      doc.circle(cx, cy, 1.8, "F");
  }
}
async function drawChargerProductSheet(doc: jsPDF, ch: Charger, _client: ClientInfo) {
  const BLEU_30: [number, number, number] = [228, 242, 255]; // pastille icône claire
  const CARD_BORDER: [number, number, number] = [228, 226, 220];

  // Fond beige pleine page (charte) — pas de bandeau noir sur cette page.
  doc.setFillColor(...BG);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // En-tête : logo Beev (fond clair) + « FICHE TECHNIQUE / Borne de recharge AC »
  // Priorité au logo paramétré dans l'admin (PDF_CONTENT.logoUrl), comme sur
  // le reste du PDF, sinon repli sur le fichier noir local. drawImageContain
  // aplatit la transparence PNG sur le beige (pas de carré noir) et cale le
  // logo en haut à gauche.
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text("Beev", M, 62); // repli si le logo ne charge pas
  for (const logoUrl of [PDF_CONTENT.logoUrl ?? undefined, "/images/logo-beev-noir.png"].filter(Boolean) as string[]) {
    try { await drawImageContain(doc, logoUrl, M, 44, 78, 22, BG); break; } catch { /* essai suivant */ }
  }
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SUB);
  doc.text("F I C H E   T E C H N I Q U E", PAGE_W - M, 50, { align: "right" });
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("Borne de recharge AC", PAGE_W - M, 64, { align: "right" });
  doc.setDrawColor(...CARD_BORDER);
  doc.setLineWidth(0.6);
  doc.line(M, 84, PAGE_W - M, 84);

  // Titre + description
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(34);
  doc.setTextColor(...INK);
  const title = `${ch.brand} ${ch.model}`.trim();
  const titleLines = (doc.splitTextToSize(title, PAGE_W - M * 2) as string[]).slice(0, 2);
  doc.text(titleLines, M, 124);
  let y = 124 + (titleLines.length - 1) * 34 + 24;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(11);
  doc.setTextColor(...SUB);
  const desc = ch.description && ch.description.trim()
    ? ch.description.trim()
    : `Borne de recharge ${ch.powerKw} kW${/tri/i.test(ch.type) ? " triphasée" : " monophasée"}, ${ch.type}.`;
  // Cette fiche est une page unique sans pagination (pas d'ensureSpace) : les
  // atouts + photo + caractéristiques clés qui suivent occupent une hauteur
  // fixe d'environ 410pt. On n'écrête donc la description que si elle menace
  // réellement de faire déborder ce bloc du bas de page, plutôt qu'à un
  // nombre de lignes arbitraire (l'ancien plafond fixe à 3 lignes coupait le
  // texte même quand la page avait largement la place de l'afficher en
  // entier).
  const descAllLines = doc.splitTextToSize(desc, PAGE_W - M * 2) as string[];
  const reservedBelow = 410;
  const maxDescLines = Math.max(3, Math.floor((FOOTER_LIMIT - y - reservedBelow) / 14));
  const descLines = descAllLines.slice(0, maxDescLines);
  doc.text(descLines, M, y);
  y += descLines.length * 14 + 24;

  // Colonne gauche : 3 atouts · Colonne droite : photo
  const leftW = 300;
  const atoutTop = y;
  const atouts = (ch.features ?? []).filter((f) => f && f.trim()).slice(0, 3);
  atouts.forEach((f, i) => {
    const ay = atoutTop + i * 56;
    doc.setFillColor(...BLEU_30);
    doc.roundedRect(M, ay, 30, 30, 8, 8, "F");
    drawTileIcon(doc, ["power", "shield", "current"][i] ?? "dot", M + 15, ay + 15);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text((doc.splitTextToSize(f, leftW - 46) as string[]).slice(0, 2), M + 42, ay + 13);
  });
  // Photo dans une carte blanche
  const photoX = M + leftW + 16;
  const photoW = PAGE_W - M - photoX;
  const photoY = atoutTop - 6;
  const photoH = 170;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(photoX, photoY, photoW, photoH, 14, 14, "F");
  const imgUrl = (ch.marketingImageUrl && ch.marketingImageUrl.trim()) || ch.image;
  if (imgUrl && imgUrl.trim()) {
    try { await drawImageContain(doc, imgUrl, photoX + 16, photoY + 16, photoW - 32, photoH - 32, [255, 255, 255]); } catch { /* */ }
  }

  // Caractéristiques clés
  let cy = Math.max(atoutTop + 3 * 56, photoY + photoH) + 30;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("C A R A C T É R I S T I Q U E S   C L É S", M, cy);
  cy += 18;
  const isTri = /tri/i.test(ch.type) || (ch.powerKw >= 11 && !/mono/i.test(ch.type));
  const amp = isTri ? Math.round((ch.powerKw * 1000) / (400 * Math.sqrt(3))) : Math.round((ch.powerKw * 1000) / 230);
  const kw = String(ch.powerKw).replace(".", ",");
  const tiles: Array<{ icon: string; value: string; label: string }> = [
    { icon: "power", value: `${kw} kW`, label: isTri ? "Mono ou triphasé" : "Monophasé" },
    { icon: "current", value: `${amp} A`, label: "Intensité max / phase" },
    { icon: "plug", value: /type\s*2/i.test(ch.type) ? "Type 2" : "Type 2", label: "Prise ou câble fixe" },
    { icon: "shield", value: chargerProtection(ch), label: "Intérieur / extérieur" },
    { icon: "dim", value: ch.dimensions && ch.dimensions.trim() ? ch.dimensions.trim() : "—", label: "mm (H×L×P)" },
    { icon: "temp", value: ch.tempRange && ch.tempRange.trim() ? ch.tempRange.trim() : "−25 à 50 °C", label: "Température d'usage" },
  ];
  const tgap = 14;
  const tW = (PAGE_W - M * 2 - tgap * 2) / 3;
  const tH = 88;
  tiles.forEach((t, i) => {
    const tx = M + (i % 3) * (tW + tgap);
    const ty = cy + Math.floor(i / 3) * (tH + tgap);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(tx, ty, tW, tH, 12, 12, "F");
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(0.5);
    doc.roundedRect(tx, ty, tW, tH, 12, 12, "S");
    doc.setFillColor(...BLEU_30);
    doc.roundedRect(tx + 14, ty + 14, 26, 26, 7, 7, "F");
    drawTileIcon(doc, t.icon, tx + 27, ty + 27);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(15);
    doc.setTextColor(...INK);
    doc.text((doc.splitTextToSize(t.value, tW - 24) as string[]).slice(0, 1), tx + 14, ty + 62);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SUB);
    doc.text((doc.splitTextToSize(t.label, tW - 24) as string[]).slice(0, 1), tx + 14, ty + 76);
  });
}

// ============ KIT COLLABORATEUR · BEEV HOME CONNECT (supervision B2B2E) ============
// Insert pédagogique optionnel destiné aux collaborateurs : explique la
// supervision Beev Home Connect (Casawatt) et le remboursement automatisé des
// recharges à domicile. Affiché uniquement sur le parcours bornes domicile.
function drawHomeConnectKit(doc: jsPDF, _client: ClientInfo) {
  const PINK: [number, number, number] = [244, 184, 170];
  const BLEU: [number, number, number] = [165, 210, 255];
  const VIOLET: [number, number, number] = [211, 204, 216];
  const CARD_BORDER: [number, number, number] = [225, 222, 216];

  let y = 116;
  doc.setFillColor(...PINK);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text("KIT COLLABORATEUR · BEEV HOME CONNECT", M + 30, y - 4);
  y += 14;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(26);
  doc.setTextColor(...INK);
  doc.text("La recharge à domicile, remboursée sans paperasse", M, y + 16, { maxWidth: PAGE_W - M * 2 });
  y += 44;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const intro = doc.splitTextToSize(
    "Beev Home Connect certifie automatiquement les recharges réalisées au domicile de vos collaborateurs et génère, chaque mois, le justificatif prêt pour le remboursement. Simplifiée, automatique et certifiée.",
    PAGE_W - M * 2,
  ) as string[];
  doc.text(intro, M, y);
  y += intro.length * 13 + 16;

  // --- Comment ça marche : 3 cartes ---
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Comment ça marche", M, y);
  y += 12;
  const steps = [
    { n: "1", t: "Détection automatique", d: "Le véhicule connecté et le compteur Linky détectent chaque session de recharge, sans aucune action du collaborateur.", c: PINK },
    { n: "2", t: "Classification", d: "Les recharges à domicile sont distinguées de l'itinérance et de la consommation du foyer, automatiquement.", c: BLEU },
    { n: "3", t: "Justificatif mensuel", d: "Un justificatif clair (date, énergie, montant) est généré et envoyé chaque mois, prêt pour le remboursement.", c: VIOLET },
  ];
  const cgap = 14;
  const cW = (PAGE_W - M * 2 - cgap * 2) / 3;
  const cH = 116;
  const cTop = y;
  steps.forEach((s, i) => {
    const cx = M + i * (cW + cgap);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cx, cTop, cW, cH, 10, 10, "F");
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(0.6);
    doc.roundedRect(cx, cTop, cW, cH, 10, 10, "S");
    doc.setFillColor(...s.c);
    doc.circle(cx + 22, cTop + 24, 11, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(s.n, cx + 22, cTop + 28, { align: "center" });
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text((doc.splitTextToSize(s.t, cW - 24) as string[]).slice(0, 2), cx + 14, cTop + 52);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUB);
    doc.text((doc.splitTextToSize(s.d, cW - 28) as string[]).slice(0, 5), cx + 14, cTop + 72);
  });
  y = cTop + cH + 22;

  // --- Bandeau noir : ce que ça change ---
  const bandH = 96;
  doc.setFillColor(...INK);
  doc.roundedRect(M, y, PAGE_W - M * 2, bandH, 10, 10, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PINK);
  doc.text("CE QUE ÇA CHANGE POUR LE COLLABORATEUR", M + 18, y + 22);
  const changes = [
    "Plus de relevé manuel du compteur kilométrique",
    "Plus d'estimation des kilomètres rechargés à la maison",
    "Recharges à domicile détectées et catégorisées",
    "Un justificatif envoyé chaque mois, sans y penser",
  ];
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9.5);
  const colX = [M + 18, M + (PAGE_W - M * 2) / 2 + 8];
  changes.forEach((ch, i) => {
    const cx = colX[i % 2];
    const cy = y + 44 + Math.floor(i / 2) * 20;
    doc.setFillColor(...PINK);
    doc.circle(cx + 2, cy - 3, 2, "F");
    doc.setTextColor(252, 249, 242);
    doc.text((doc.splitTextToSize(ch, (PAGE_W - M * 2) / 2 - 30) as string[]).slice(0, 1), cx + 10, cy);
  });
  y += bandH + 22;

  // --- Comment démarrer ---
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Comment démarrer", M, y);
  y += 16;
  const starts = [
    "Le collaborateur reçoit une invitation par e-mail (bornes@beev.co).",
    "Il connecte son véhicule et son compteur Linky — en ligne, en moins de 5 minutes.",
    "Données privées : rien n'est partagé avec l'employeur, consentement révocable à tout moment.",
  ];
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  starts.forEach((s) => {
    doc.setFillColor(...BLEU);
    doc.circle(M + 3, y - 3, 2.4, "F");
    const sl = doc.splitTextToSize(s, PAGE_W - M * 2 - 16) as string[];
    doc.text(sl, M + 12, y);
    y += sl.length * 12 + 6;
  });
  y += 6;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SUB);
  doc.text("Accompagnement Beev à chaque étape · bornes@beev.co", M, y);
}


// ============ BILAN CARBONE — Page dédiée RSE ============
// Argument vente RSE : montre les émissions CO2 évitées par la flotte
// électrique vs un équivalent thermique de référence. Affichage en
// équivalences concrètes (allers-retours, arbres) pour parler à un
// décideur non-technique.
function drawCarbonImpact(doc: jsPDF, vehicles: SelectedVehicle[], e: EnergyParams, client?: ClientInfo) {
  let y = 116;
  const ROSE: [number, number, number] = [244, 184, 170];
  doc.setFillColor(...ROSE);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(L("BILAN CARBONE · IMPACT RSE", "CARBON FOOTPRINT · CSR IMPACT"), M + 30, y - 4);
  y += 14;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(26);
  doc.setTextColor(...INK);
  doc.text(L("Votre flotte évite des émissions de CO2.", "Your fleet avoids CO2 emissions."), M, y + 18);
  y += 50;

  // Hypothèses : véhicule thermique de référence émet 135 g CO2/km
  // Pour les véhicules ÉLECTRIQUES, on force 0 g/km en usage (zéro émission
  // directe à l'échappement) même si la DB peut contenir une valeur résiduelle
  // (parfois 22 g/km par convention WLTP).
  const refCO2gKm = 135;
  const co2OfVehicle = (v: typeof vehicles[0]["vehicle"]) =>
    v.energy === "Électrique" ? 0 : (v.co2 ?? 0);
  let kmTotalFlotte = 0;
  let co2EmisFlotteKg = 0;
  let co2EviteFlotteKg = 0;
  vehicles.forEach((sv) => {
    const duree = sv.durationMonths / 12;
    const kmContrat = sv.kmPerYear * duree * (sv.quantity || 1);
    kmTotalFlotte += kmContrat;
    const co2Vehicule = (co2OfVehicle(sv.vehicle) * kmContrat) / 1000; // kg
    co2EmisFlotteKg += co2Vehicule;
    const co2Ref = (refCO2gKm * kmContrat) / 1000; // kg
    co2EviteFlotteKg += co2Ref - co2Vehicule;
  });
  const co2EviteFlotteTonnes = co2EviteFlotteKg / 1000;
  // Équivalences pour rendre concret le chiffre
  const arRedAvionParisMarseille = co2EviteFlotteKg / 270; // 270 kg CO2/passager A/R
  const arbresPlantes = co2EviteFlotteKg / 25; // 1 arbre absorbe ~25 kg CO2/an
  const ttKmEquivalents = co2EviteFlotteKg / 0.135; // km thermiques évités

  // Intro
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const intro = L(
    `Sur la durée des contrats, votre sélection ${vehicles.length > 1 ? "de véhicules électriques" : "véhicule électrique"} parcourra ${(kmTotalFlotte / 1000).toFixed(0)} k km. Comparé à un parc thermique équivalent (${refCO2gKm} g CO2 / km en moyenne), l'économie d'émissions est significative.`,
    `Over the contract duration, your ${vehicles.length > 1 ? "selection of electric vehicles" : "electric vehicle"} will cover ${(kmTotalFlotte / 1000).toFixed(0)} k km. Compared to an equivalent combustion fleet (${refCO2gKm} g CO2 / km on average), the emissions savings are significant.`,
  );
  const introL = doc.splitTextToSize(intro, PAGE_W - M * 2);
  doc.text(introL, M, y);
  y += introL.length * 13 + 20;

  // Bandeau ÉCONOMIE CO2 GÉANT (style B2B2E)
  doc.setFillColor(...INK);
  doc.roundedRect(M, y, PAGE_W - M * 2, 110, 8, 8, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...ROSE);
  doc.text(L("CO2 ÉVITÉ SUR LA DURÉE DES CONTRATS", "CO2 AVOIDED OVER THE CONTRACT DURATION"), M + 20, y + 22);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(40);
  doc.setTextColor(...BG);
  doc.text(`${co2EviteFlotteTonnes.toFixed(1)} tonnes`, M + 20, y + 66);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(220, 220, 220);
  doc.text(L(
    `soit ${co2EviteFlotteKg.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kg CO2 vs un parc thermique de référence (${refCO2gKm} g CO2 / km)`,
    `i.e. ${co2EviteFlotteKg.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kg CO2 vs. a reference combustion fleet (${refCO2gKm} g CO2 / km)`,
  ), M + 20, y + 86);
  y += 122;

  // 3 équivalences concrètes
  const eqWidth = (PAGE_W - M * 2 - 20) / 3;
  const equivalences = [
    { label: L("VOLS A/R PARIS-MARSEILLE", "PARIS-MARSEILLE ROUND TRIP FLIGHTS"), value: arRedAvionParisMarseille.toFixed(0), unit: L("passagers", "passengers"), color: ROSE },
    { label: L("ARBRES PLANTÉS / AN", "TREES PLANTED / YEAR"), value: arbresPlantes.toFixed(0), unit: L("arbres", "trees"), color: [165, 210, 255] as [number, number, number] },
    { label: L("KM THERMIQUES ÉVITÉS", "COMBUSTION KM AVOIDED"), value: `${(ttKmEquivalents / 1000).toFixed(0)} k`, unit: "km", color: [211, 204, 216] as [number, number, number] },
  ];
  equivalences.forEach((eq, i) => {
    const cx = M + i * (eqWidth + 10);
    doc.setFillColor(...BG);
    doc.roundedRect(cx, y, eqWidth, 90, 8, 8, "F");
    doc.setFillColor(...eq.color);
    doc.rect(cx, y, eqWidth, 4, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...SUB);
    doc.text(eq.label, cx + 12, y + 22);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(22);
    doc.setTextColor(...INK);
    doc.text(String(eq.value), cx + 12, y + 56);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...SUB);
    doc.text(eq.unit, cx + 12, y + 74);
  });
  y += 110;

  // Détail par véhicule (table)
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SUB);
  doc.text(L("DÉTAIL PAR VÉHICULE", "DETAIL BY VEHICLE"), M, y);
  y += 6;
  autoTable(doc, {
    startY: y + 4,
    theme: "plain",
    head: [[L("Véhicule", "Vehicle"), L("Version", "Version"), L("Motorisation", "Powertrain"), L("Km contrat", "Contract km"), L("Émissions g/km", "Emissions g/km"), L("CO2 émis", "CO2 emitted"), L("CO2 évité", "CO2 avoided")]],
    body: vehicles.map((sv) => {
      const duree = sv.durationMonths / 12;
      const km = sv.kmPerYear * duree * (sv.quantity || 1);
      const co2gKm = co2OfVehicle(sv.vehicle); // 0 si électrique
      const co2Emi = (co2gKm * km) / 1000;
      const co2Ref = (refCO2gKm * km) / 1000;
      const isElec = sv.vehicle.energy === "Électrique";
      return [
        `${sv.vehicle.brand} ${sv.vehicle.model}${(sv.quantity || 1) > 1 ? ` × ${sv.quantity}` : ""}`,
        sv.vehicle.version || "—",
        sv.vehicle.energy || "—",
        `${(km / 1000).toFixed(0)} k km`,
        isElec ? L("0 g (EL)", "0 g (EV)") : `${co2gKm} g`,
        isElec ? "0 kg" : `${co2Emi.toFixed(0)} kg`,
        { content: `${(co2Ref - co2Emi).toFixed(0)} kg`, styles: { fontStyle: "bold" as any, textColor: ROSE, halign: "center" as any } },
      ];
    }),
    // Données centrées dans toutes les colonnes (demande commercial) ; le nom
    // et la version restent lisibles, les 4 colonnes chiffrées sont alignées.
    headStyles: { fillColor: INK, textColor: 255, fontSize: 8, fontStyle: "bold", font: BRAND_FONT, cellPadding: 5, halign: "center" },
    bodyStyles: { fontSize: 8.5, cellPadding: 5, textColor: INK, lineColor: RULE, lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 } as any, font: BRAND_FONT, halign: "center", valign: "middle" },
    alternateRowStyles: { fillColor: BG },
    columnStyles: { 0: { halign: "center" as any }, 1: { halign: "center" as any }, 2: { halign: "center" as any }, 3: { halign: "center" as any }, 4: { halign: "center" as any }, 5: { halign: "center" as any }, 6: { halign: "center" as any } },
    margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
  });
  let y2 = (doc as any).lastAutoTable.finalY + 16;

  // Note méthodologique (paginée si le tableau remplit la page)
  y2 = ensureBottomSpace(doc, y2, 48, client, "vehicles");
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUB);
  doc.text(
    L(
      "Estimation Beev 2026 · Référence thermique 135 g CO2/km (moyenne véhicules essence + diesel parc France). 1 arbre absorbe en moyenne 25 kg CO2/an (chêne adulte, ADEME). 1 A/R Paris-Marseille en avion = 270 kg CO2/passager.",
      "Beev 2026 estimate · Combustion reference 135 g CO2/km (average of petrol + diesel vehicles, French fleet). 1 tree absorbs an average of 25 kg CO2/year (mature oak, ADEME). 1 Paris-Marseille round-trip flight = 270 kg CO2/passenger.",
    ),
    M, y2, { maxWidth: PAGE_W - M * 2 },
  );
}

// Précharge les images véhicule en miniatures JPEG APLATIES SUR FOND BLANC.
// jsPDF ne gère pas l'alpha PNG (les zones transparentes deviennent noires) :
// l'aplatissement sur blanc évite le « fond noir ». Réutilisé par le
// comparateur et les tableaux TCO pour une vignette véhicule homogène.
async function preloadVehicleThumbs(vehicles: SelectedVehicle[]): Promise<(LoadedImage | null)[]> {
  return Promise.all(vehicles.map(async (sv) => {
    const url = sv.vehicle.image?.trim();
    if (!url) return null;
    const li = await loadImage(url);
    if (!li) return null;
    try {
      const flat = await flattenPngToJpeg(li.dataUrl, li.w, li.h, [255, 255, 255]);
      return { dataUrl: flat, w: li.w, h: li.h, format: "JPEG" as const };
    } catch {
      return li;
    }
  }));
}

// Dessine une vignette véhicule (carte blanche + image contenue) à gauche d'une
// cellule autoTable. Même taille partout (comparateur + tableaux TCO).
function drawThumbCell(doc: jsPDF, cell: { x: number; y: number; height: number }, img: LoadedImage | null, boxW = 48, boxH = 36) {
  const bx = cell.x + 3;
  const by = cell.y + (cell.height - boxH) / 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(bx, by, boxW, boxH, 4, 4, "F");
  if (img) {
    const pad = 4;
    const ratio = Math.min((boxW - pad) / img.w, (boxH - pad) / img.h);
    const w = img.w * ratio, h = img.h * ratio;
    try { doc.addImage(img.dataUrl, img.format, bx + (boxW - w) / 2, by + (boxH - h) / 2, w, h); } catch { /* non bloquant */ }
  }
}

// ============ COMPARATEUR VÉHICULES (vertical, véhicules en lignes) ============
// Tableau comparatif vertical : chaque véhicule est une ligne (image + nom +
// chip statut dans la colonne Véhicule, puis prix / loyer / autonomie / conso /
// énergie). Gère n'importe quel nombre de véhicules sans débordement.
async function drawVehicleComparator(doc: jsPDF, vehicles: SelectedVehicle[], groupName?: string, client?: ClientInfo) {
  const PINK: [number, number, number] = [244, 184, 170];
  const PINK_LIGHT: [number, number, number] = [253, 241, 238];
  const BLUE_LIGHT: [number, number, number] = [237, 246, 255]; // beev-bleu-20
  const ROSE_LIGHT: [number, number, number] = [253, 241, 238];
  // Mode AVANT/APRÈS : déclenché si au moins 1 véhicule "flotte actuelle"
  // ET au moins 1 véhicule à proposer. On réarrange l'ordre : thermiques
  // d'abord (gauche), EV après (droite), avec un séparateur visuel.
  const beforeVehicles = vehicles.filter((sv) => sv.vehicle.isCurrentFleet);
  const afterVehicles = vehicles.filter((sv) => !sv.vehicle.isCurrentFleet);
  const isBeforeAfter = beforeVehicles.length > 0 && afterVehicles.length > 0;
  // Affichage VERTICAL (véhicules en lignes) : plus de limite à 4. Toujours
  // trié par LOYER CROISSANT (du moins cher au plus cher) ; les loyers non
  // renseignés (0) passent en fin de liste. En mode avant/après, le tri par
  // loyer s'applique à l'intérieur de chaque bloc (flotte actuelle puis
  // propositions Beev) pour conserver la lecture comparative.
  const byLoyerAsc = (a: SelectedVehicle, b: SelectedVehicle) => {
    const la = (a.negotiatedMonthly ?? 0) > 0 ? a.negotiatedMonthly : Infinity;
    const lb = (b.negotiatedMonthly ?? 0) > 0 ? b.negotiatedMonthly : Infinity;
    return la - lb;
  };
  const items = isBeforeAfter
    ? [...[...beforeVehicles].sort(byLoyerAsc), ...[...afterVehicles].sort(byLoyerAsc)]
    : [...vehicles].sort(byLoyerAsc);
  let y = 130;
  eyebrow(
    doc,
    groupName
      ? L(`COMPARATEUR · ${groupName.toUpperCase()}`, `COMPARISON · ${groupName.toUpperCase()}`)
      : isBeforeAfter
        ? lookupText(TEXTS, "vehicles", "comparator_before_after_eyebrow", L("FLOTTE ACTUELLE · PROPOSITION BEEV", "CURRENT FLEET · BEEV PROPOSAL"))
        : lookupText(TEXTS, "vehicles", "comparator_eyebrow", L("COMPARATEUR VÉHICULES", "VEHICLE COMPARISON")),
    y,
  );
  y += 32;
  // Titre rendu en inline pour mesurer le nombre réel de lignes (le titre
  // « Votre flotte actuelle face à notre proposition Beev » passe sur 2
  // lignes) et avancer y en conséquence, sinon l'intro chevauche la 2e ligne.
  const titleText = isBeforeAfter
    ? lookupText(TEXTS, "vehicles", "comparator_before_after_title", L("Votre flotte actuelle face à notre proposition Beev", "Your current fleet vs. our Beev proposal"))
    : lookupText(TEXTS, "vehicles", "comparator_title", L("Quel modèle choisir ?", "Which model should you choose?"));
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  const titleLinesHdr = doc.splitTextToSize(titleText, PAGE_W - M * 2);
  doc.text(titleLinesHdr, M, y);
  y += titleLinesHdr.length * 26 + 12;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const introText = isBeforeAfter
    ? lookupText(TEXTS, "vehicles", "comparator_before_after_intro",
        L("À gauche, votre flotte actuelle. À droite, les véhicules Beev qui peuvent la remplacer. Les écarts sur le coût, la consommation et le CO2 sont mis en évidence.",
          "On the left, your current fleet. On the right, the Beev vehicles that can replace it. Differences in cost, consumption and CO2 are highlighted."))
    : lookupText(TEXTS, "vehicles", "comparator_intro",
        L("Comparaison côte à côte des caractéristiques clés. Les cellules surlignées indiquent la meilleure valeur sur chaque ligne (prix le plus bas, autonomie la plus haute, etc.).",
          "Side-by-side comparison of key specifications. Highlighted cells indicate the best value on each row (lowest price, longest range, etc.)."));
  const introLinesHdr = doc.splitTextToSize(introText, PAGE_W - M * 2);
  doc.text(introLinesHdr, M, y);
  y += introLinesHdr.length * 13 + 12;

  // ─── Tableau comparatif VERTICAL (véhicules en lignes) avec image ───────
  // Chaque véhicule est une LIGNE. La colonne « Véhicule » contient l'image,
  // le nom et un chip de statut (flotte actuelle / proposition Beev), dessinés
  // via didDrawCell. Les colonnes numériques sont dimensionnées pour ne JAMAIS
  // tronquer la valeur (« 42 490 € » reste sur une ligne).
  const ROSE_TEXT: [number, number, number] = [181, 96, 79];
  // Admin : on remplace le bleu électrique hors-charte par le noir charte.
  const BEEV_BLUE: [number, number, number] = ADMIN_MODE ? [29, 29, 29] : [56, 9, 234];

  const showLoyer = items.some((sv) => (sv.negotiatedMonthly ?? 0) > 0);

  // Conso par véhicule : kWh/100km (électrique) ou L/100km (autres).
  const consoOf = (sv: SelectedVehicle): { txt: string } => {
    const v = sv.vehicle;
    const elec = v.energy === "Électrique";
    const c = elec ? (v.consumptionElec ?? v.consumption) : (v.consumptionThermal ?? v.consumption);
    if (!c || c <= 0) return { txt: "—" };
    return { txt: elec ? `${c} kWh/100km` : `${c} L/100km` };
  };

  const vehImgs = await preloadVehicleThumbs(items);

  type Col = { key: string; header: string; align: "left" | "right" | "center" };
  // Toutes les colonnes de données sont CENTRÉES (en-tête + valeurs). La
  // colonne Véhicule reste à gauche (image + nom + chip).
  const cols: Col[] = [
    { key: "veh", header: L("Véhicule", "Vehicle"), align: "left" },
    { key: "prix", header: L("Prix TTC", "Price (incl. VAT)"), align: "center" as const },
    ...(showLoyer ? [{ key: "loyer", header: L("Loyer/mois", "Lease/month"), align: "center" as const }] : []),
    { key: "auto", header: L("Autonomie", "Range"), align: "center" as const },
    { key: "conso", header: L("Conso", "Consumption"), align: "center" as const },
    { key: "energie", header: L("Énergie", "Energy"), align: "center" as const },
  ];

  const cellFor = (sv: SelectedVehicle, key: string): string => {
    switch (key) {
      case "veh": return vehicleLabel(sv.vehicle);
      case "prix": return sv.vehicle.priceTtc > 0 ? eur(sv.vehicle.priceTtc) : "—";
      case "loyer": return (sv.negotiatedMonthly ?? 0) > 0 ? `${eurLoyer(sv.negotiatedMonthly)}${L("/mois", "/month")}` : "—";
      case "auto": return sv.vehicle.rangeWltp > 0 ? `${sv.vehicle.rangeWltp} km` : "—";
      case "conso": return consoOf(sv).txt;
      case "energie": return sv.vehicle.energy;
      default: return "";
    }
  };

  const head = [cols.map((c) => c.header)];
  const body = items.map((sv) => cols.map((c) => cellFor(sv, c.key)));

  // Largeurs fixes. La colonne Énergie (auto = reste) doit rester assez large
  // pour que « Hybride Rechargeable » s'enroule ENTRE les mots (et non au
  // milieu de « Rechargeable »). On réduit donc les autres pour lui laisser
  // ~80 pt de reste.
  const W: Record<string, number> = { veh: 166, prix: 56, loyer: 62, auto: 54, conso: 74 };
  const columnStyles: any = {};
  cols.forEach((c, i) => {
    columnStyles[i] = { halign: c.align };
    if (W[c.key]) columnStyles[i].cellWidth = W[c.key];
    if (c.key === "veh") {
      // Réserve à gauche pour l'image + en bas pour le chip statut.
      columnStyles[i].cellPadding = { left: 56, right: 4, top: 6, bottom: isBeforeAfter ? 18 : 6 };
      columnStyles[i].minCellHeight = 48;
      columnStyles[i].valign = "middle";
    }
  });

  autoTable(doc, {
    startY: y,
    theme: "plain",
    head,
    body,
    // Empêche une ligne véhicule (image + nom multi-lignes + chip) d'être
    // coupée en deux par un saut de page : sinon les cellules numériques
    // tombaient « dans le vide » et la ligne réapparaissait vide sur la page
    // suivante. La ligne entière bascule sur la page d'après.
    rowPageBreak: "avoid",
    headStyles: { fillColor: INK, textColor: 255, fontSize: 8, fontStyle: "bold", font: BRAND_FONT, cellPadding: 6, valign: "middle" as any, halign: "center" as any },
    bodyStyles: { fontSize: 8.5, cellPadding: 5, textColor: INK, lineColor: RULE, lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 } as any, font: BRAND_FONT, valign: "middle" as any },
    alternateRowStyles: { fillColor: BG },
    columnStyles,
    margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
    didDrawCell: (data: any) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const sv = items[data.row.index];
      if (!sv) return;
      const cell = data.cell;
      drawThumbCell(doc, cell, vehImgs[data.row.index]);
      // Chip statut (uniquement en mode mixte flotte / proposition)
      if (isBeforeAfter) {
        const isFleet = !!sv.vehicle.isCurrentFleet;
        const label = isFleet ? L("FLOTTE ACTUELLE", "CURRENT FLEET") : L("PROPOSITION BEEV", "BEEV PROPOSAL");
        doc.setFont(BRAND_FONT, "bold");
        doc.setFontSize(6);
        const tw = doc.getTextWidth(label);
        const chipX = cell.x + 56;
        const chipY = cell.y + cell.height - 14;
        doc.setFillColor(...(isFleet ? PINK : BLUE_LIGHT));
        doc.roundedRect(chipX, chipY, tw + 10, 11, 5.5, 5.5, "F");
        doc.setTextColor(...(isFleet ? ROSE_TEXT : BEEV_BLUE));
        doc.text(label, chipX + 5, chipY + 7.5);
      }
    },
  });
  let yEnd = (doc as any).lastAutoTable.finalY + 14;

  // Note de bas de page (paginée si le tableau remplit la page)
  yEnd = ensureBottomSpace(doc, yEnd, 40, client, "vehicles");
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUB);
  doc.text(
    lookupText(TEXTS, "vehicles", "comparator_footnote",
      L(
        "Données constructeur. Le CO2 est forcé à 0 g/km pour les véhicules électriques (convention Beev). Consommation exprimée en kWh/100 km (électrique) ou L/100 km (autres motorisations).",
        "Manufacturer data. CO2 is set to 0 g/km for electric vehicles (Beev convention). Consumption shown in kWh/100 km (electric) or L/100 km (other powertrains).",
      )),
    M, yEnd, { maxWidth: PAGE_W - M * 2 },
  );
}

// ============ MISE EN CONCURRENCE (offre actuelle vs Beev sur même véhicule) ============
// Slide PDF dédiée : pour chaque véhicule ayant une offre concurrente saisie,
// on affiche un bloc avec 2 colonnes côte à côte (offre actuelle | offre Beev)
// + un encart d'économies (€/mois et total contrat).
function drawCompetitorComparison(doc: jsPDF, vehicles: SelectedVehicle[]) {
  const PINK: [number, number, number] = [244, 184, 170];
  const ROSE_LIGHT: [number, number, number] = [253, 241, 238];
  const BLUE_LIGHT: [number, number, number] = [237, 246, 255];
  const GREEN_LIGHT: [number, number, number] = [219, 238, 220]; // beev-good 20%
  const GREEN: [number, number, number] = [108, 190, 94]; // beev-good
  const LAVENDER_COLOR: [number, number, number] = ADMIN_MODE ? [29, 29, 29] : [56, 9, 234];

  let y = 130;
  eyebrow(doc, lookupText(TEXTS, "vehicles", "competitor_eyebrow", L("MISE EN CONCURRENCE", "COMPETITIVE COMPARISON")), y);
  y += 32;
  title(doc, lookupText(TEXTS, "vehicles", "competitor_title", L("Votre offre actuelle face à notre proposition Beev", "Your current offer vs. our Beev proposal")), y);
  y += 36;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const introText = lookupText(TEXTS, "vehicles", "competitor_intro",
    L(
      "Sur les mêmes véhicules, comparaison côte à côte de votre offre actuelle avec notre proposition Beev. Les économies mensuelles et sur la durée du contrat sont mises en évidence.",
      "On the same vehicles, side-by-side comparison of your current offer with our Beev proposal. Monthly and full-contract savings are highlighted.",
    ));
  const introLines = doc.splitTextToSize(introText, PAGE_W - M * 2);
  doc.text(introLines, M, y);
  // Espace réel = nombre de lignes × interligne (~13pt) + marge avant le
  // 1er titre véhicule, pour éviter que le titre soit collé à l'intro.
  y += introLines.length * 13 + 18;

  // Cumul économies sur l'ensemble du devis (affiché en bas)
  let totalMonthlySavings = 0;
  let totalContractSavings = 0;

  for (const sv of vehicles) {
    const offers = (sv.competitorOffers ?? []).filter((o) => o.monthlyTtc > 0);
    if (offers.length === 0) continue;

    // Économie maximale (offre concurrente la plus chère - Beev)
    const maxCompetitor = Math.max(...offers.map((o) => o.monthlyTtc));
    const bestSavings = maxCompetitor - sv.negotiatedMonthly;
    if (bestSavings > 0) {
      totalMonthlySavings += bestSavings * sv.quantity;
      totalContractSavings += bestSavings * sv.durationMonths * sv.quantity;
    }

    // Hauteur du bloc : 1 ligne titre + N colonnes côte à côte
    // (N offres concurrentes + 1 Beev). Maximum 4 colonnes par ligne ;
    // au-delà on saute en page suivante.
    const totalCols = offers.length + 1;
    const blockH = 96;
    const econH = 30;
    const need = 30 + blockH + econH + 16;
    if (y + need > PAGE_H - 80) {
      doc.addPage();
      drawHeader(doc, { company: "" } as ClientInfo, "vehicles");
      y = 130;
    }

    // Titre véhicule
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(vehicleLabel(sv.vehicle, 60), M, y);
    y += 14;
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SUB);
    doc.text(`${L("Quantité", "Quantity")} ${sv.quantity} · ${sv.vehicle.energy}`, M, y);
    y += 16;

    // Disposition en N+1 colonnes : N offres concurrentes (rose) + 1 Beev (bleu)
    const gap = 8;
    const colW = (PAGE_W - M * 2 - gap * (totalCols - 1)) / totalCols;

    // Fonction interne pour dessiner une carte (loueur, loyer, durée, km, couleur).
    // Layout vertical strict pour éviter la superposition avec « TTC/mois » :
    //   • header (6.5pt)         à y + 13
    //   • titre loueur (9.5pt)   à y + 27 (+/- 12 si 2 lignes)
    //   • LOYER en gros (18pt)   à y + 58 (largeur protégée)
    //   • « TTC/mois »  (7.5pt)  à y + 70 (SOUS le loyer, pas à côté)
    //   • durée · km    (8pt)    à y + 88, sur une seule ligne (trait séparateur)
    const drawOfferCard = (
      cx: number,
      header: string,
      headerColor: [number, number, number],
      bg: [number, number, number],
      title: string,
      monthly: number,
      duration: number,
      kmPerYear: number,
    ) => {
      doc.setFillColor(...bg);
      doc.roundedRect(cx, y, colW, blockH, 8, 8, "F");
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...headerColor);
      doc.text(header, cx + 10, y + 13);
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      const titleLines = doc.splitTextToSize(title, colW - 16);
      doc.text(titleLines.slice(0, 2), cx + 10, y + 27);
      // Loyer en gros sur sa propre ligne — pas de texte à droite pour éviter
      // toute superposition avec le « TTC/mois » qui passe en-dessous.
      doc.setFontSize(18);
      doc.text(`${eurLoyer(monthly)}`, cx + 10, y + 58);
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...SUB);
      doc.text(L("TTC/mois", "incl. VAT/month"), cx + 10, y + 70);
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      // Durée et kilométrage sur la MÊME ligne, séparés par un point médian
      // (séparateur de charte Beev). Trait fin vertical dessiné entre les
      // deux pour bien marquer la séparation demandée.
      const durTxt = `${duration} ${L("mois", "months")}`;
      const kmTxt = `${Math.round(kmPerYear * (duration / 12)).toLocaleString("fr-FR")} km`;
      const lineY = y + 88;
      doc.text(durTxt, cx + 10, lineY);
      const durW = doc.getTextWidth(durTxt);
      const sepX = cx + 10 + durW + 6;
      doc.setDrawColor(...SUB);
      doc.setLineWidth(0.6);
      doc.line(sepX, lineY - 6, sepX, lineY + 1);
      doc.text(kmTxt, sepX + 6, lineY);
    };

    // Cartes concurrentes (rose)
    offers.forEach((offer, idx) => {
      const cx = M + idx * (colW + gap);
      drawOfferCard(
        cx,
        offers.length > 1 ? L(`OFFRE ${idx + 1}`, `OFFER ${idx + 1}`) : L("OFFRE ACTUELLE", "CURRENT OFFER"),
        PINK,
        ROSE_LIGHT,
        offer.loueur || L(`Loueur ${idx + 1}`, `Lessor ${idx + 1}`),
        offer.monthlyTtc,
        offer.durationMonths,
        offer.kmPerYear,
      );
    });

    // Carte Beev (bleu) — toujours dernière
    const beevX = M + offers.length * (colW + gap);
    drawOfferCard(
      beevX,
      L("OFFRE BEEV", "BEEV OFFER"),
      LAVENDER_COLOR,
      BLUE_LIGHT,
      "Beev",
      sv.negotiatedMonthly,
      sv.durationMonths,
      sv.kmPerYear,
    );

    y += blockH + 6;

    // Bandeau économies : on prend la meilleure offre concurrente comme référence
    if (bestSavings > 0) {
      doc.setFillColor(...GREEN_LIGHT);
      doc.roundedRect(M, y, PAGE_W - M * 2, econH, 6, 6, "F");
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...GREEN);
      const refLabel = offers.length > 1 ? L("vs offre la plus chère", "vs. most expensive offer") : L("vs votre offre actuelle", "vs. your current offer");
      doc.text(L(
        `Économie Beev (${refLabel}) : ${eur(bestSavings)} / mois · ${eur(bestSavings * sv.durationMonths)} sur ${sv.durationMonths} mois`,
        `Beev savings (${refLabel}): ${eur(bestSavings)} / month · ${eur(bestSavings * sv.durationMonths)} over ${sv.durationMonths} months`,
      ), M + 14, y + 19);
      if (sv.quantity > 1) {
        doc.setFont(BRAND_FONT, "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...INK);
        const totalRow = L(`× ${sv.quantity} véhicules = ${eur(bestSavings * sv.durationMonths * sv.quantity)}`, `× ${sv.quantity} vehicles = ${eur(bestSavings * sv.durationMonths * sv.quantity)}`);
        doc.text(totalRow, PAGE_W - M - 14 - doc.getTextWidth(totalRow), y + 19);
      }
      y += econH + 16;
    } else if (bestSavings < 0) {
      // Encart neutre à la charte Beev (fond beige, police Roobert normale —
      // PAS d'italique qui retombe sur une serif hors charte). Pas de tiret
      // cadratin comme séparateur : on coupe en deux phrases. Hauteur de
      // l'encart calculée sur le nombre réel de lignes pour ne pas chevaucher
      // le titre du véhicule suivant.
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(9);
      const noteText = L(
        `Notre offre est ${eur(Math.abs(bestSavings))}/mois plus chère que la meilleure offre concurrente. Beev apporte d'autres avantages : services, accompagnement et conditions de fin de contrat.`,
        `Our offer is ${eur(Math.abs(bestSavings))}/month more expensive than the best competing offer. Beev brings other benefits: services, support, and end-of-contract terms.`,
      );
      const noteLines = doc.splitTextToSize(noteText, PAGE_W - M * 2 - 28);
      const noteH = noteLines.length * 12 + 16;
      doc.setFillColor(252, 251, 248); // beige charte
      doc.roundedRect(M, y, PAGE_W - M * 2, noteH, 6, 6, "F");
      doc.setFillColor(...PINK);
      doc.rect(M, y, 3, noteH, "F");
      doc.setTextColor(...INK);
      doc.text(noteLines, M + 14, y + 14);
      y += noteH + 18;
    } else {
      y += 12;
    }
  }

  // Cumul global si plusieurs véhicules concernés et économies positives
  if (vehicles.length > 1 && totalContractSavings > 0 && y + 60 < PAGE_H - 80) {
    doc.setFillColor(...INK);
    doc.roundedRect(M, y, PAGE_W - M * 2, 50, 10, 10, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PINK);
    doc.text(L("ÉCONOMIE GLOBALE BEEV", "OVERALL BEEV SAVINGS"), M + 16, y + 17);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text(L(`${eur(totalMonthlySavings)} / mois`, `${eur(totalMonthlySavings)} / month`), M + 16, y + 38);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    const totalText = L(`Soit ${eur(totalContractSavings)} sur la durée totale des contrats`, `That's ${eur(totalContractSavings)} over the total contract duration`);
    doc.text(totalText, PAGE_W - M - 16 - doc.getTextWidth(totalText), y + 35);
  }
}

function drawTcoComparison(doc: jsPDF, vehicles: SelectedVehicle[], e: EnergyParams) {
  let y = 130;
  eyebrow(doc, lookupText(TEXTS, "vehicles", "tco_compare_eyebrow", L("COMPARAISON TCO ENTRE VÉHICULES", "TCO COMPARISON BETWEEN VEHICLES")), y);
  y += 32;
  title(doc, L("Quel véhicule offre le meilleur coût total ?", "Which vehicle offers the best total cost?"), y);
  y += 36;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...SUB);
  const intro = L(
    "Comparaison directe des véhicules sélectionnés sur le coût total de possession (TCO). Le véhicule le moins coûteux par 100 km est mis en évidence.",
    "Direct comparison of the selected vehicles on total cost of ownership (TCO). The least expensive vehicle per 100 km is highlighted.",
  );
  const introL = doc.splitTextToSize(intro, PAGE_W - M * 2);
  doc.text(introL, M, y);
  y += introL.length * 14 + 18;

  // Calcul TCO unifié via calculateTcoFull pour TOUS les véhicules (mêmes
  // hypothèses : prix catalogue + options - remise, barèmes 2026, etc.).
  // sv.options sont saisies en TTC dans le panneau droit.
  const tcos = vehicles.map((sv) => {
    const optionsTotalTtc = sv.options.reduce((s, o) => s + o.qty * o.unitHt, 0);
    const duree = sv.durationMonths / 12;
    const kmContrat = sv.kmPerYear * duree;
    const r = calculateTcoFull(sv.vehicle, {
      dureeAnnees: duree,
      kmContrat,
      prixEssenceLitre: e.fuelPriceL,
      prixKwhDomicile: e.kWhHome,
      prixKwhPublic: e.kWhPublic,
      optionsTotalTtc,
      remisePctOverride: sv.discountPct,
    }, sv.negotiatedMonthly);
    const tco100 = r.tcoParKm * 100;
    const lease100 = (r.loyerTotal / kmContrat) * 100;
    const energy100 = (r.coutEnergie / kmContrat) * 100;
    return {
      sv,
      synced: true,
      tco100,
      lease100,
      energy100,
      tcoYear: r.tcoAnnuel,
      tcoTotal: r.tcoTotal,
      malus: r.malusCO2 + r.malusPoids,
      tvsTotal: r.tvsTotal,
      andAnnuel: r.andAnnuel,
      aenAnnuel: r.aenAnnuel,
    };
  });

  // Trie du moins cher au plus cher (au TCO/100km)
  const sorted = [...tcos].sort((a, b) => a.tco100 - b.tco100);
  const cheapest = sorted[0];
  const mostExpensive = sorted[sorted.length - 1];
  const maxTco = mostExpensive.tco100 || 1;

  // ===== Warning si catégories différentes =====
  const categories = new Set(vehicles.map((v) => (v.vehicle.category || "").trim().toLowerCase()).filter(Boolean));
  if (categories.size > 1) {
    doc.setFillColor(255, 244, 220); // jaune pâle
    doc.rect(M, y, PAGE_W - M * 2, 36, "F");
    doc.setFillColor(230, 170, 30);
    doc.rect(M, y, 4, 36, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(150, 100, 0);
    doc.text(L("⚠ ATTENTION : COMPARAISON ENTRE CATÉGORIES DIFFÉRENTES", "⚠ WARNING: COMPARISON BETWEEN DIFFERENT CATEGORIES"), M + 14, y + 14);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 80, 0);
    const catsList = [...categories].map((c) => c.toUpperCase()).join(" · ");
    doc.text(L(
      `Les véhicules comparés appartiennent à plusieurs catégories (${catsList}). Le match n'est pas à 100 %, utilisez ces données avec prudence.`,
      `The compared vehicles belong to several categories (${catsList}). This is not a 100% match, so use this data with caution.`,
    ), M + 14, y + 28, { maxWidth: PAGE_W - M * 2 - 24 });
    y += 46;
  }

  // ===== Chart — colonnes fixes pour éviter toute superposition =====
  const chartX = M;
  const chartW = PAGE_W - M * 2;
  const labelW = 130;              // colonne véhicule (rang + nom)
  const barAreaW = 180;            // zone barre horizontale
  const tcoPer100W = 60;           // colonne TCO / 100 km (right-aligned)
  const tcoTotalW = 70;            // colonne TCO total contrat (right-aligned)
  const ecartW = chartW - labelW - barAreaW - tcoPer100W - tcoTotalW; // reste pour écart
  const rowH = 32;

  const colLabelX = chartX;
  const colBarX = chartX + labelW;
  const colTco100X = chartX + labelW + barAreaW + 6;
  const colTcoTotalX = chartX + labelW + barAreaW + tcoPer100W + 6;
  const colEcartX = chartX + chartW;

  // Header tableau (positions fixes alignées sur les colonnes)
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SUB);
  doc.text(lookupText(TEXTS, "vehicles", "tco_compare_col_vehicle", L("VÉHICULE", "VEHICLE")), colLabelX, y);
  doc.text(lookupText(TEXTS, "vehicles", "tco_compare_col_per100", "TCO / 100 KM"), colBarX, y);
  doc.text(lookupText(TEXTS, "vehicles", "tco_compare_col_tco", L("PRIX TCO", "TCO PRICE")), colTco100X + tcoPer100W - 6, y, { align: "right" });
  doc.text(lookupText(TEXTS, "vehicles", "tco_compare_col_total", L("TCO TOTAL", "TOTAL TCO")), colTcoTotalX + tcoTotalW - 6, y, { align: "right" });
  doc.text(lookupText(TEXTS, "vehicles", "tco_compare_col_gap", L("ÉCART", "GAP")), colEcartX, y, { align: "right" });
  y += 6;
  doc.setDrawColor(...RULE);
  doc.line(chartX, y, chartX + chartW, y);
  y += 12;

  sorted.forEach((row, idx) => {
    const isCheapest = idx === 0;
    const ecartVsCheapest = row.tco100 - cheapest.tco100;
    const ecartPct = cheapest.tco100 > 0 ? (ecartVsCheapest / cheapest.tco100) * 100 : 0;

    // === Colonne véhicule (rang + nom) ===
    doc.setFillColor(isCheapest ? ACCENT[0] : 200, isCheapest ? ACCENT[1] : 200, isCheapest ? ACCENT[2] : 205);
    doc.circle(colLabelX + 8, y + 8, 7, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(isCheapest ? 255 : INK[0], isCheapest ? 255 : INK[1], isCheapest ? 255 : INK[2]);
    doc.text(String(idx + 1), colLabelX + 8, y + 11, { align: "center" });

    // Ligne 1 : MARQUE MODÈLE (gras, gros)
    // Ligne 2 : version + qté (sous-titre discret) — permet de distinguer
    // 2 finitions du même modèle dans le ranking.
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    const titleMaxChars = 22;
    const titleLine = `${row.sv.vehicle.brand} ${row.sv.vehicle.model}`.slice(0, titleMaxChars);
    doc.text(titleLine, colLabelX + 20, y + 7);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SUB);
    const versionShort = (row.sv.vehicle.version ?? "").slice(0, 30);
    const subParts = [versionShort, `× ${row.sv.quantity}`, row.synced ? L("sync", "synced") : null].filter(Boolean);
    doc.text(subParts.join(" · "), colLabelX + 20, y + 17);

    // === Colonne barre (largeur clampée pour ne jamais déborder) ===
    const veBarW = Math.min(barAreaW - 4, (row.tco100 / maxTco) * (barAreaW - 4));
    if (isCheapest) {
      doc.setFillColor(...ACCENT);
    } else {
      const ratio = idx / Math.max(sorted.length - 1, 1);
      const gray = Math.round(200 - ratio * 60);
      doc.setFillColor(gray, gray, gray + 5);
    }
    doc.rect(colBarX, y + 4, Math.max(veBarW, 2), 14, "F");

    // === Colonne TCO / 100 km (right-aligned dans sa zone) ===
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(eur2(row.tco100), colTco100X + tcoPer100W - 6, y + 14, { align: "right" });

    // === Colonne TCO total (right-aligned) ===
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUB);
    doc.text(eur(row.tcoTotal), colTcoTotalX + tcoTotalW - 6, y + 14, { align: "right" });

    // === Colonne écart vs le meilleur ===
    if (isCheapest) {
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(10);
      doc.setTextColor(...ACCENT);
      doc.text(lookupText(TEXTS, "vehicles", "tco_compare_best", L("MEILLEUR", "BEST")), colEcartX, y + 12, { align: "right" });
    } else {
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(`+ ${eur2(ecartVsCheapest)}`, colEcartX, y + 11, { align: "right" });
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(7);
      doc.setTextColor(...SUB);
      doc.text(`+ ${ecartPct.toFixed(1)} %`, colEcartX, y + 22, { align: "right" });
    }

    y += rowH;
  });

  // ===== Bandeau écart max =====
  y += 10;
  doc.setDrawColor(...INK);
  doc.setLineWidth(1);
  doc.line(chartX, y, chartX + chartW, y);
  y += 14;

  const ecartTcoMaxPer100km = mostExpensive.tco100 - cheapest.tco100;
  // Écart annuel et sur durée du contrat pour le véhicule le moins cher
  const ecartAnnualPerVehicle = ecartTcoMaxPer100km * (cheapest.sv.kmPerYear / 100);
  // Si chacun des véhicules est multiplié par sa quantité, l'écart total représente
  // l'économie si on remplaçait le plus cher par le moins cher pour tous les véhicules
  const ecartTotalAnnual = ecartAnnualPerVehicle * cheapest.sv.quantity;
  const ecartTotalContract = ecartTotalAnnual * (cheapest.sv.durationMonths / 12);

  doc.setFillColor(...INK);
  doc.rect(chartX, y, chartW, 90, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(chartX, y, 4, 90, "F");

  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ACCENT);
  doc.text(L("ÉCART ENTRE LE MOINS CHER ET LE PLUS CHER", "GAP BETWEEN CHEAPEST AND MOST EXPENSIVE"), chartX + 16, y + 18);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 185);
  const cheapestName = `${cheapest.sv.vehicle.brand} ${cheapest.sv.vehicle.model}`;
  const expensiveName = `${mostExpensive.sv.vehicle.brand} ${mostExpensive.sv.vehicle.model}`;
  doc.text(`${cheapestName} vs ${expensiveName}`, chartX + 16, y + 32);

  const colW = (chartW - 32) / 3;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 185);
  doc.text(lookupText(TEXTS, "vehicles", "tco_compare_chart1_label", L("ÉCART / 100 KM", "GAP / 100 KM")), chartX + 16, y + 52);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(eur2(ecartTcoMaxPer100km), chartX + 16, y + 74);

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 185);
  doc.text(lookupText(TEXTS, "vehicles", "tco_compare_chart2_label", L("ÉCART ANNUEL (PAR VÉHICULE)", "ANNUAL GAP (PER VEHICLE)")), chartX + 16 + colW, y + 52);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(eur(ecartAnnualPerVehicle), chartX + 16 + colW, y + 74);

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 185);
  doc.text(lookupText(TEXTS, "vehicles", "tco_compare_chart3_label", L("ÉCART SUR DURÉE CONTRAT", "GAP OVER CONTRACT DURATION")), chartX + 16 + 2 * colW, y + 52);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(18);
  doc.setTextColor(...ACCENT);
  doc.text(eur(ecartTotalContract), chartX + 16 + 2 * colW, y + 74);

  y += 110;

  // === Encart "BASES DE CALCUL" : transparence sur les hypothèses ===
  if (y < FOOTER_LIMIT - 130) {
    doc.setFillColor(...BG);
    doc.rect(M, y, PAGE_W - M * 2, 110, "F");
    doc.setFillColor(...LAVENDER);
    doc.rect(M, y, 4, 110, "F");

    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...LAVENDER);
    doc.text(L("BASES DE CALCUL · HYPOTHÈSES BEEV 2026", "CALCULATION BASIS · BEEV 2026 ASSUMPTIONS"), M + 16, y + 18);

    const fuelL = e.fuelPriceL ?? 1.75;
    const kwhDom = e.kWhHome ?? 0.4;
    const kwhPub = e.kWhPublic ?? 0.6;
    const lines = PDF_LANG === "en" ? [
      `· Petrol / Diesel fuel: ${fuelL.toFixed(2)} €/L`,
      `· Electricity: ${kwhDom.toFixed(2)} €/kWh home (85%) + ${kwhPub.toFixed(2)} €/kWh public (15%)`,
      `· TVS: 2026 scale (CO2 tax by bracket + pollution tax €130 petrol / €650 diesel / €0 electric) × contract duration`,
      `· CO2 penalty, incl. VAT: 2026 scale (€0 below 108 g, capped at €80,000 above 192 g), plus VAT on lease refinancing`,
      `· Weight penalty, incl. VAT: from 1500 kg (100 kg reduction for hybrid, 200 kg capped at 15% of weight for PHEV with ≥50 km electric range, electric exempt), plus VAT on lease refinancing`,
      `· AND (Avantage Non Déductible, non-deductible depreciation): (catalog price + options incl. VAT) − discount − battery − ceiling, amortized over 5 years`,
      `· AEN (Avantage en Nature, benefit-in-kind): 50% of the annual lease, 70% reduction for eco-scored electric vehicles`,
    ] : [
      `· Carburant SP95 / Diesel : ${fuelL.toFixed(2)} €/L`,
      `· Électricité : ${kwhDom.toFixed(2)} €/kWh domicile (85 %) + ${kwhPub.toFixed(2)} €/kWh public (15 %)`,
      `· TVS : barème 2026 (taxe CO2 par tranche + taxe pollution 130 € essence / 650 € diesel / 0 € électrique) × durée contrat`,
      `· Malus CO2 TTC : barème 2026 (0 € < 108 g, plafonné à 80 000 € au-delà de 192 g), majoré de la TVA sur la refacturation en LLD`,
      `· Malus poids TTC : à partir de 1500 kg (abattement 100 kg hybride, 200 kg plafonné à 15 % du poids pour PHEV ≥ 50 km d'autonomie électrique, exonération électrique), majoré de la TVA sur la refacturation en LLD`,
      `· AND (Avantage Non Déductible) : (prix catalogue + options TTC) − remise − batterie − plafond, amorti sur 5 ans`,
      `· AEN (Avantage en Nature) : 50 % du loyer annuel, abattement 70 % si véhicule électrique éco-scoré`,
    ];
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    lines.forEach((l, i) => {
      doc.text(l, M + 16, y + 34 + i * 11, { maxWidth: PAGE_W - M * 2 - 32 });
    });
    y += 120;
  }

  // Mention bas
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUB);
  doc.text(lookupText(TEXTS, "vehicles", "tco_compare_footnote", L(
    "Comparaison entre les véhicules de votre sélection uniquement. Estimation indicative basée sur les paramètres énergie & kilométrage du projet.",
    "Comparison between the vehicles in your selection only. Indicative estimate based on the project's energy and mileage parameters.",
  )), M, y, {
    maxWidth: PAGE_W - M * 2,
  });
}

// ============ GARANTIES & ENGAGEMENTS BEEV ============
function drawGuarantees(doc: jsPDF, type: ProjectType) {
  let y = 130;
  eyebrow(doc, lookupText(TEXTS, "common", "pillars_eyebrow", L("GARANTIES & ENGAGEMENTS BEEV", "BEEV GUARANTEES & COMMITMENTS")), y);
  y += 32;
  title(doc, lookupText(TEXTS, "common", "pillars_title", L("Ce que Beev s'engage à tenir.", "What Beev commits to.")), y);
  y += 36;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...SUB);
  const intro = type === "vehicles"
    ? L("Au-delà du tarif catalogue, Beev s'engage sur la qualité opérationnelle pendant toute la durée du contrat LLD.", "Beyond the catalog price, Beev commits to operational quality throughout the LLD contract.")
    : type === "home"
    ? "Pour chaque collaborateur équipé, Beev pilote l'installation, la supervision et l'exploitation pendant toute la durée du contrat."
    : "Pour chaque site IRVE, Beev s'engage sur des SLA opérationnels mesurables, du déploiement à l'exploitation.";
  const introL = doc.splitTextToSize(intro, PAGE_W - M * 2);
  doc.text(introL, M, y);
  y += introL.length * 14 + 18;

  // 3 piliers d'engagement (cartes alignées)
  const pillarsByType: Record<ProjectType, Array<{ title: string; metric: string; details: string[] }>> = {
    vehicles: PDF_LANG === "en" ? [
      {
        title: "SINGLE POINT OF CONTACT",
        metric: "Reply within 1 business day",
        details: [
          "A dedicated key account manager",
          "Shared fleet management hotline",
          "Lessor coordination (Ayvens, Arval, Athlon, Leaseplan)",
          "Tracking of deliveries and manufacturer incidents",
        ],
      },
      {
        title: "MAINTENANCE INCLUDED",
        metric: "All networks",
        details: [
          "Manufacturer servicing, all networks",
          "24/7 assistance, roadside breakdown service",
          "Replacement vehicle per contract",
          "Financial loss guarantee in case of theft/accident",
        ],
      },
      {
        title: "FLEET MANAGER DASHBOARD",
        metric: "Live dashboard",
        details: [
          "Multi-user access to Beev Fleet Manager",
          "Tracking of delivery and return reports",
          "Updates on applicable tax rules",
          "Consolidated reporting on request",
        ],
      },
    ] : [
      {
        title: "INTERLOCUTEUR UNIQUE",
        metric: "Réponse J+1",
        details: [
          "Un commercial grand compte dédié",
          "Hotline gestion de flotte mutualisée",
          "Coordination loueurs (Ayvens, Arval, Athlon, Leaseplan)",
          "Suivi livraisons et incidents constructeurs",
        ],
      },
      {
        title: "MAINTENANCE INCLUSE",
        metric: "Tous réseaux",
        details: [
          "Entretien constructeur tous réseaux",
          "Assistance 24/24, dépannage routier",
          "Véhicule de remplacement selon contrat",
          "Garantie perte financière en cas de vol/sinistre",
        ],
      },
      {
        title: "PILOTAGE FLEET MANAGER",
        metric: "Dashboard live",
        details: [
          "Accès Fleet Manager Beev multi-utilisateurs",
          "Suivi des PV de livraison et restitutions",
          "Mise à jour fiscalité applicable",
          "Reporting consolidé sur demande",
        ],
      },
    ],
    home: [
      {
        title: "POSE IRVE CERTIFIÉE",
        metric: "Partenaire Seris",
        details: [
          "Pose 0–10 m incluse · garantie 4 ans",
          "Visite technique systématique",
          "Mise en service le jour de la pose",
          "Procès-verbal signé collaborateur",
        ],
      },
      {
        title: "SUPERVISION MARQUE BLANCHE",
        metric: "Temps réel",
        details: [
          "Visibilité par collaborateur, par site",
          "Mesures conformes MID",
          "Données disponibles sous 24h",
          "API d'export pour SI RH si besoin",
        ],
      },
      {
        title: "REMBOURSEMENT AUTOMATISÉ",
        metric: "Sous 30 jours",
        details: [
          "Calcul mensuel des kWh professionnels",
          "Virement automatique au collaborateur",
          "Facturation employeur consolidée",
          "Garantie de conformité fiscale",
        ],
      },
    ],
    site: [
      {
        title: "GARANTIE MATÉRIEL",
        metric: "3 ans (ext. 6)",
        details: [
          "Constructeurs premium : Alfen, Schneider, Hager, Wallbox",
          "Garantie pièces & main d'œuvre 3 ans",
          "Extension à 6 ans en option",
          "SAV reconditionné en cas de panne hardware",
        ],
      },
      {
        title: "POSE IRVE CERTIFIÉE",
        metric: "Supervision universelle",
        details: [
          "Technicien IRVE certifié AFNOR",
          "Compatible avec tous les systèmes de supervision",
          "Mise en service & formation utilisateurs",
          "Signature conjointe du rapport de réception",
        ],
      },
      {
        title: "EXPLOITATION & SAV",
        metric: "GTR contractuelle",
        details: [
          "Hotline utilisateurs 24/24",
          "GTR rétablissement sous 24h ouvrées",
          "Supervision multi-sites consolidée",
          "Maintenance préventive annuelle incluse",
        ],
      },
    ],
  };

  // Priorité : piliers chargés depuis la table beev_pillars (éditables admin).
  // Fallback : valeurs hardcodées de pillarsByType si la table est vide ou
  // si le fetch a échoué (cas avant migration 012 ou réseau coupé).
  const fromDb = PILLARS
    .filter((p) => p.projectType === type && p.active)
    .sort((a, b) => a.position - b.position)
    .map((p) => ({ title: p.title, metric: p.metric, details: p.details }));
  const pillars = fromDb.length > 0 ? fromDb : pillarsByType[type];
  const colW = (PAGE_W - M * 2 - 16) / 3;
  pillars.forEach((p, i) => {
    const x = M + i * (colW + 8);
    doc.setFillColor(...BG);
    doc.rect(x, y, colW, 200, "F");
    doc.setFillColor(...ACCENT);
    doc.rect(x, y, colW, 4, "F");

    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUB);
    const titleLines = doc.splitTextToSize(p.title, colW - 20);
    doc.text(titleLines, x + 10, y + 22);

    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(18);
    doc.setTextColor(...ACCENT);
    const metricLines = doc.splitTextToSize(p.metric, colW - 20);
    doc.text(metricLines, x + 10, y + 22 + titleLines.length * 11 + 18);

    let yy = y + 22 + titleLines.length * 11 + 18 + metricLines.length * 18 + 12;
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    p.details.forEach((d) => {
      doc.setFillColor(...ACCENT);
      doc.circle(x + 13, yy - 3, 1.5, "F");
      const dl = doc.splitTextToSize(d, colW - 24);
      doc.text(dl, x + 20, yy);
      yy += dl.length * 10 + 4;
    });
  });

  y += 220;

  // Bandeau "trust signal" en bas
  doc.setFillColor(...INK);
  doc.rect(M, y, PAGE_W - M * 2, 60, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ACCENT);
  doc.text(L("BEEV EN CHIFFRES (2026)", "BEEV IN NUMBERS (2026)"), M + 16, y + 20);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(L("Le copilote tout-en-un de l'électrification des flottes en France :", "The all-in-one copilot for fleet electrification in France:"), M + 16, y + 36);
  doc.text(L("vente VE multi-marques · installation IRVE · logiciel Fleet Manager.", "multi-brand EV sales · EVSE installation · Fleet Manager software."), M + 16, y + 50);
}

// ============ EXECUTIVE SUMMARY (page "EN BREF" — décideur) ============
function drawExecutiveSummary(
  doc: jsPDF,
  type: ProjectType,
  c: ClientInfo,
  vehicles: SelectedVehicle[],
  chargers: SelectedCharger[],
  e: EnergyParams,
) {
  let y = 116;
  eyebrow(doc, lookupText(TEXTS, "common", "executive_eyebrow", L("EN BREF · POUR LE COMITÉ DE DIRECTION", "AT A GLANCE · FOR THE EXECUTIVE COMMITTEE")), y);
  y += 32;
  const execTitleFallback = type === "vehicles" ? L("Votre flotte électrique en synthèse.", "Your electric fleet in summary.") :
            type === "home" ? "Votre déploiement domicile en synthèse." :
            "Votre projet IRVE site en synthèse.";
  title(doc, lookupText(TEXTS, type, "executive_title", execTitleFallback), y);
  y += 30;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const introText = type === "vehicles"
    ? L(
        `Cette page résume l'essentiel pour ${c.company || "votre entreprise"} : périmètre, budget, économies attendues et engagements Beev.`,
        `This page summarizes the essentials for ${c.company || "your company"}: scope, budget, expected savings and Beev commitments.`,
      )
    : `Cette page résume l'essentiel pour ${c.company || "votre entreprise"} : périmètre, budget, modalités et engagements Beev.`;
  const introLines = doc.splitTextToSize(introText, PAGE_W - M * 2);
  doc.text(introLines, M, y);
  y += introLines.length * 13 + 16;

  // ===== Calculs financiers =====
  let monthlyTtc = 0, annualTtc = 0, totalContrat = 0;
  let chargersHt = 0;
  let tcoTotalFlotte = 0; // somme du TCO total contrat de tous les véhicules
  let vehiclesCount = 0;

  vehicles.forEach((sv) => {
    monthlyTtc += sv.negotiatedMonthly * sv.quantity;
    annualTtc += sv.negotiatedMonthly * 12 * sv.quantity;
    totalContrat += sv.negotiatedMonthly * sv.durationMonths * sv.quantity;
    vehiclesCount += sv.quantity;
    // Récupère le TCO total (sync prioritaire, fallback computeTco interne)
    const synced = TCO_RESULTS.get(sv.vehicle.id);
    if (synced?.tcoTotalContract != null) {
      tcoTotalFlotte += synced.tcoTotalContract * sv.quantity;
    } else if (sv.includeTco) {
      const t = computeTco(sv, e);
      tcoTotalFlotte += t.tco100 * (sv.kmPerYear / 100) * (sv.durationMonths / 12) * sv.quantity;
    }
  });
  chargers.forEach((sc) => {
    chargersHt += sc.lineItems.reduce((a, li) => a + lineItemClientTotal(li), 0) * chargerQtyMultiplier(sc);
  });
  const chargersTtc = chargersHt * 1.20;

  // ===== Grille 2x2 de KPIs =====
  const colW = (PAGE_W - M * 2 - 12) / 2;
  const startY = y;
  const rowH = 100;

  // KPI 1 : Périmètre
  drawKpiBlock(doc, M, startY, colW, rowH, L("PÉRIMÈTRE DU PROJET", "PROJECT SCOPE"), [
    type === "vehicles"
      ? { label: L("Véhicules étudiés", "Vehicles studied"), value: String(vehiclesCount), accent: true }
      : { label: type === "home" ? "Bornes domicile" : "Bornes site", value: String(chargers.reduce((a, sc) => a + sc.quantity, 0)), accent: true },
    type === "vehicles" && vehicles[0]
      ? { label: L("Durée LLD", "LLD duration"), value: `${vehicles[0].durationMonths} ${L("mois", "months")}` }
      : { label: "Type", value: type === "home" ? "B2B2E" : "IRVE site" },
    type === "vehicles" && vehicles[0]
      ? { label: L("Kilométrage", "Mileage"), value: L(`${fmt(Math.round(vehicles[0].kmPerYear * vehicles[0].durationMonths / 12))} km (contrat)`, `${fmt(Math.round(vehicles[0].kmPerYear * vehicles[0].durationMonths / 12))} km (contract)`) }
      : { label: "Modèles", value: String(chargers.length) },
  ]);

  // KPI 2 : Investissement
  drawKpiBlock(doc, M + colW + 12, startY, colW, rowH, L("INVESTISSEMENT", "INVESTMENT"), type === "vehicles" ? [
    { label: L("Loyer mensuel TTC", "Monthly lease (incl. VAT)"), value: eurLoyer(monthlyTtc), accent: true },
    { label: L("Loyer annuel TTC", "Annual lease (incl. VAT)"), value: eurLoyer(annualTtc) },
    { label: L("Total contrat", "Total contract"), value: eurLoyer(totalContrat) },
  ] : [
    { label: "Total HT", value: eur(chargersHt), accent: true },
    { label: "TVA 20 %", value: eur(chargersTtc - chargersHt) },
    { label: "Total TTC", value: eur(chargersTtc) },
  ]);

  // KPI 3 : Coût total de possession (vehicles) ou Garanties (chargers)
  drawKpiBlock(doc, M, startY + rowH + 12, colW, rowH, type === "vehicles" ? L("COÛT TOTAL DE POSSESSION (TCO)", "TOTAL COST OF OWNERSHIP (TCO)") : "GARANTIES MATÉRIEL", type === "vehicles" ? [
    { label: L("TCO total flotte", "Total fleet TCO"), value: tcoTotalFlotte > 0 ? eur(tcoTotalFlotte) : "—", accent: tcoTotalFlotte > 0 },
    { label: L("TCO moyen / véhicule / an", "Average TCO / vehicle / year"), value: tcoTotalFlotte > 0 && vehiclesCount > 0 && vehicles[0] ? eur(tcoTotalFlotte / vehiclesCount / (vehicles[0].durationMonths / 12)) : "—" },
    { label: L("TVA récupérable LLD VE", "Recoverable VAT, EV LLD"), value: "100 %" },
  ] : [
    { label: "Garantie matériel", value: type === "home" ? "2 à 4 ans" : "3 ans (ext. 6)", accent: true },
    { label: "Pose IRVE certifiée", value: type === "home" ? "Seris" : "Beev × partenaires" },
    { label: "Supervision incluse", value: "Compatible tous fabricants" },
  ]);

  // KPI 4 : Engagements Beev
  drawKpiBlock(doc, M + colW + 12, startY + rowH + 12, colW, rowH, L("ENGAGEMENTS BEEV", "BEEV COMMITMENTS"), [
    { label: L("Interlocuteur dédié", "Dedicated contact"), value: L("Grand compte", "Key account"), accent: true },
    { label: L("Hotline réactive", "Responsive hotline"), value: L("Réponse J+1 ouvré", "Reply within 1 business day") },
    { label: type === "vehicles" ? L("Maintenance & assistance", "Maintenance & assistance") : "Mise en service OCPP", value: L("Incluses", "Included") },
  ]);

  // Prochaine étape en bas
  y = startY + 2 * rowH + 32;
  doc.setFillColor(...INK);
  doc.rect(M, y, PAGE_W - M * 2, 50, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(M, y, 4, 50, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ACCENT);
  doc.text(lookupText(TEXTS, "common", "bpa_next_step_label", L("PROCHAINE ÉTAPE", "NEXT STEP")), M + 16, y + 18);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  const nextStep = type === "vehicles"
    ? L("Signature du Bon Pour Accord, commande des véhicules auprès des loueurs sous 10 jours ouvrés.", "Signing the order confirmation, vehicles ordered from lessors within 10 business days.")
    : type === "home"
    ? "Validation du cadre du programme, intégration des collaborateurs en parallèle."
    : "Validation de l'offre cadre, étude technique site sous 5 jours ouvrés.";
  doc.text(nextStep, M + 16, y + 36);
}

// Helper : dessine un bloc KPI sur fond cream avec accent vert
function drawKpiBlock(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  items: Array<{ label: string; value: string; accent?: boolean }>,
) {
  doc.setFillColor(...BG);
  doc.rect(x, y, w, h, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(x, y, 3, h, "F");

  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(title, x + 12, y + 14);

  let yy = y + 30;
  items.forEach((it, i) => {
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SUB);
    doc.text(it.label.toUpperCase(), x + 12, yy);
    doc.setFont(BRAND_FONT, it.accent ? "bold" : "normal");
    doc.setFontSize(i === 0 || it.accent ? 14 : 11);
    doc.setTextColor(it.accent ? ACCENT[0] : INK[0], it.accent ? ACCENT[1] : INK[1], it.accent ? ACCENT[2] : INK[2]);
    doc.text(it.value, x + 12, yy + 14);
    yy += 22;
  });
}

// ============ SYNTHÈSE FINANCIÈRE (récap HT / TVA / TTC) ============
function drawFinancialSummary(
  doc: jsPDF,
  type: ProjectType,
  vehicles: SelectedVehicle[],
  chargers: SelectedCharger[],
) {
  const hasVehicles = vehicles.length > 0;
  const hasChargers = chargers.length > 0;
  const isCombined = hasVehicles && hasChargers;

  let y = 130;
  eyebrow(doc, lookupText(TEXTS, "common", "financial_eyebrow", L("SYNTHÈSE FINANCIÈRE", "FINANCIAL SUMMARY")), y);
  y += 32;
  const titleText = isCombined
    ? L("Récapitulatif loyers LLD + bornes HT/TTC.", "Summary of LLD leases + charging stations (excl./incl. VAT).")
    : (hasVehicles ? L("Récapitulatif loyers LLD.", "Summary of LLD leases.") : L("Récapitulatif HT / TVA / TTC.", "Summary excl. VAT / VAT / incl. VAT."));
  title(doc, titleText, y);
  y += 30;

  // ===== Section véhicules (LLD) =====
  if (hasVehicles) {
    if (isCombined) {
      // Sous-titre pour distinguer en mode combiné
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(11);
      doc.setTextColor(...SUB);
      doc.text(lookupText(TEXTS, "common", "financial_vehicles_title", L("VÉHICULES — LOYERS LLD TTC", "VEHICLES · LLD LEASES (INCL. VAT)")), M, y);
      y += 14;
    }
    // Pour les véhicules : récap LLD mensuel + annuel TTC (la fiscalité TVA récupérée)
    let monthlyTotal = 0;
    let annualTotal = 0;
    const rows: Array<[string, string, string, string]> = [];
    vehicles.forEach((sv) => {
      const monthly = sv.negotiatedMonthly * sv.quantity;
      const annual = monthly * 12;
      monthlyTotal += monthly;
      annualTotal += annual;
      rows.push([
        `${sv.vehicle.brand} ${sv.vehicle.model}`,
        `${sv.quantity} × ${sv.durationMonths} ${L("mois", "months")}`,
        eurLoyer(sv.negotiatedMonthly),
        eurLoyer(monthly),
      ]);
    });

    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [[
        lookupText(TEXTS, "common", "financial_head_vehicle", L("Véhicule", "Vehicle")),
        lookupText(TEXTS, "common", "financial_head_conditions", L("Conditions", "Terms")),
        lookupText(TEXTS, "common", "financial_head_unit_monthly", L("Loyer unitaire/mois", "Unit lease/month")),
        lookupText(TEXTS, "common", "financial_head_total_monthly", L("Loyer mensuel TTC", "Monthly lease (incl. VAT)")),
      ]],
      body: rows,
      foot: [
        ["", "", { content: lookupText(TEXTS, "common", "financial_foot_total_label", L("Loyer mensuel total TTC", "Total monthly lease (incl. VAT)")), styles: { fontStyle: "bold", halign: "right" } }, { content: eurLoyer(monthlyTotal), styles: { fontStyle: "bold", halign: "right", fillColor: BG } }],
        ["", "", { content: L("Loyer annuel total TTC", "Total annual lease (incl. VAT)"), styles: { fontStyle: "bold", halign: "right" } }, { content: eurLoyer(annualTotal), styles: { fontStyle: "bold", halign: "right", fillColor: ACCENT, textColor: 255 } }],
      ],
      headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold", font: BRAND_FONT },
      bodyStyles: { fontSize: 9.5, cellPadding: 6, textColor: INK, lineColor: RULE, font: BRAND_FONT },
      footStyles: { fontSize: 9.5, fillColor: BG, textColor: INK, font: BRAND_FONT },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
      margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 16;

    // Mention TVA
    doc.setFontSize(9);
    doc.setTextColor(...SUB);
    doc.text(lookupText(TEXTS, "common", "financial_vehicles_tva_note", L(
      "Loyers exprimés en TTC. Conformément à la fiscalité LLD, la TVA sur le loyer véhicule électrique est récupérable à 100 %.",
      "Leases shown incl. VAT. Under LLD tax rules, VAT on the electric vehicle lease is 100% recoverable.",
    )), M, y);
    y += 28;
  }

  // ===== Section bornes (HT / TVA / TTC) =====
  if (hasChargers) {
    if (isCombined) {
      // Sous-titre quand on a déjà la section véhicules au-dessus
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(11);
      doc.setTextColor(...SUB);
      doc.text(lookupText(TEXTS, "common", "financial_chargers_title", L("BORNES DE RECHARGE — HT / TVA / TTC", "CHARGING STATIONS · EXCL. VAT / VAT / INCL. VAT")), M, y);
      y += 14;
    }
    // Pour les chargers (home / site) : tableau HT par site + TVA 20 % + TTC
    let totalHt = 0;
    const rows: Array<[string, string, string]> = [];
    chargers.forEach((sc) => {
      const lineTotalHt = sc.lineItems.reduce((a, li) => a + lineItemClientTotal(li), 0);
      const totalForSite = lineTotalHt * chargerQtyMultiplier(sc);
      totalHt += totalForSite;
      const label = sc.siteName ? `${sc.siteName} — ${sc.charger.brand} ${sc.charger.model}` : `${sc.charger.brand} ${sc.charger.model}`;
      rows.push([
        label,
        `${sc.quantity} ${sc.charger.deployment === "domicile" ? L("collab.", "employee(s)") : L("borne(s)", "charger(s)")}`,
        eur(totalForSite),
      ]);
    });
    const tva = totalHt * 0.20;
    const ttc = totalHt + tva;

    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [[L("Désignation", "Description"), L("Quantité", "Quantity"), L("Total HT", "Total (excl. VAT)")]],
      body: rows,
      foot: [
        ["", { content: L("Sous-total HT", "Subtotal (excl. VAT)"), styles: { fontStyle: "bold", halign: "right" } }, { content: eur(totalHt), styles: { halign: "right", fontStyle: "bold" } }],
        ["", { content: L("TVA 20 %", "VAT 20%"), styles: { halign: "right" } }, { content: eur(tva), styles: { halign: "right" } }],
        ["", { content: L("Total TTC", "Total (incl. VAT)"), styles: { fontStyle: "bold", halign: "right" } }, { content: eur(ttc), styles: { halign: "right", fontStyle: "bold", fillColor: ACCENT, textColor: 255 } }],
      ],
      headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold", font: BRAND_FONT },
      bodyStyles: { fontSize: 9.5, cellPadding: 6, textColor: INK, lineColor: RULE, font: BRAND_FONT },
      footStyles: { fontSize: 9.5, fillColor: BG, textColor: INK, font: BRAND_FONT },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right", fontStyle: "bold" } },
      margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 16;

    // Mentions de paiement standard
    doc.setFillColor(...BG);
    doc.rect(M, y, PAGE_W - M * 2, 60, "F");
    doc.setFillColor(...ACCENT);
    doc.rect(M, y, 4, 60, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...SUB);
    doc.text(lookupText(TEXTS, "common", "financial_payment_title", L("MODALITÉS DE PAIEMENT (À CONFIRMER LORS DE LA SIGNATURE)", "PAYMENT TERMS (TO BE CONFIRMED AT SIGNING)")), M + 16, y + 16);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    const modalities = PDF_LANG === "en" ? [
      "50% on order, 50% on commissioning.",
      "Deposit invoiced within 8 days. Balance within 30 days after work completion.",
      "20% VAT invoiced according to the regime applicable to your company.",
    ] : [
      "50 % à la commande, 50 % à la mise en service.",
      "Acompte facturé sous 8 jours. Solde sous 30 jours après réception des travaux.",
      "TVA 20 % facturée selon le régime applicable à votre entreprise.",
    ];
    modalities.forEach((m, i) => {
      doc.text("· " + m, M + 16, y + 32 + i * 11);
    });
  }
}

// Parcours client compact : 5 colonnes verticales sur 1 seule page.
// Chaque colonne = 1 étape avec son cercle numéroté + titre + durée + résumé court.
function drawJourney(doc: jsPDF, type: ProjectType, _client: ClientInfo) {
  // Refonte selon design Claude/Beev — accent violet, eyebrow + ptitle + lead,
  // puis liste verticale de step cards (style identique aux Prochaines étapes
  // pour cohérence visuelle bout-en-bout du PDF). Chaque carte = badge numéroté
  // sur fond violet décroissant + bloc droit avec titre, chip durée, lignes
  // "Beev fait" et "Vous fournissez". Pas de cascade diagonale (trop complexe
  // à reproduire en jsPDF), mais respect du système d'accents par section.
  const VIOLET: [number, number, number] = [211, 204, 216]; // #D3CCD8
  const ROSE: [number, number, number] = [244, 184, 170]; // #F4B8AA pour le "Beev"

  // BEEV_JOURNEYS est un objet partagé importé de catalog.ts, aussi utilisé
  // par l'éditeur WYSIWYG de l'app (index.tsx) hors génération PDF — on ne
  // le modifie pas selon PDF_LANG (fuite possible vers l'UI French-only du
  // commercial). La traduction anglaise reste locale à cette fonction,
  // uniquement pour le type véhicules (périmètre actuel).
  const journeyVehiclesEn = {
    intro: "From vehicle selection to delivery at the dealership or at your employees' homes, Beev orchestrates the entire journey and keeps you a single point of contact throughout the LLD contract.",
    steps: [
      {
        n: "1", title: "Fleet scoping", duration: "Day 0 > Day 3",
        summary: "Final selection of the number of vehicles, brands, models, duration/mileage pairing, options and services.",
        beev: [], client: [],
      },
      {
        n: "2", title: "Financing file setup", duration: "Day 3 > Day 10",
        summary: "Collection of the accounting documents required for the lease financing review.",
        beev: [], client: [],
      },
      {
        n: "3", title: "Signing the purchase orders", duration: "Day 10 > Day 15",
        summary: "Once financing is approved, issuance and signing of the manufacturer LLD purchase orders.",
        beev: [], client: [],
      },
      {
        n: "4", title: "Choosing the delivery location", duration: "Day 15 > delivery",
        summary: "Selecting the city to engage the nearest partner dealership, for delivery at the dealership, to an employee, or at head office.",
        beev: [], client: [],
      },
      {
        n: "5", title: "Beev Fleet Manager monitoring", duration: "Ongoing",
        summary: "Tracking synchronized on our Fleet Manager. Ryma takes over the manufacturer relationship and keeps you informed.",
        beev: [], client: [],
      },
    ],
  };
  const fallbackJourney = (type === "vehicles" && PDF_LANG === "en") ? journeyVehiclesEn : BEEV_JOURNEYS[type];
  const j = PDF_CONTENT.steps.length > 0
    ? { intro: fallbackJourney.intro, steps: PDF_CONTENT.steps }
    : fallbackJourney;

  let y = 116;
  // Eyebrow : barre violette 22×2 + label
  doc.setFillColor(...VIOLET);
  doc.rect(M, y - 8, 22, 2, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(lookupText(TEXTS, "common", "journey_eyebrow", L("PARCOURS CLIENT BEEV — DE A À Z", "BEEV CLIENT JOURNEY · START TO FINISH")), M + 30, y - 4);
  y += 14;

  // Title (.ptitle 33px ≈ 25pt)
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(25);
  doc.setTextColor(...INK);
  const titleText = type === "vehicles" ? "Comment Beev pilote votre flotte." :
                    type === "home" ? "Comment Beev équipe vos collaborateurs." :
                    "Comment Beev déploie vos sites.";
  doc.text(lookupText(TEXTS, type, "journey_title", titleText), M, y + 18);
  y += 38;

  // Lead intro (.lead 13px ≈ 10pt)
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const intro = doc.splitTextToSize(j.intro, PAGE_W - M * 2);
  doc.text(intro, M, y);
  y += intro.length * 13 + 20;

  // Liste verticale d'étapes — pleine largeur de page. Ce layout remplace
  // l'ancienne timeline horizontale qui, faute de place dans des cartes
  // ~90pt de large, tronquait titres et résumés à l'ellipse. Ici chaque
  // étape dispose de toute la largeur utile : 100 % du texte est affiché,
  // sans troncature.
  const steps = j.steps.slice(0, 5);
  const stepColors: Array<[number, number, number]> = [
    ROSE, [165, 210, 255], VIOLET, ROSE, [165, 210, 255],
  ];

  // Géométrie : rail à gauche avec pastille numérotée, contenu à droite.
  const railX = M + 16;            // centre des pastilles
  const badgeR = 15;               // rayon pastille
  const contentX = railX + badgeR + 18; // début du bloc texte
  const contentW = PAGE_W - M - contentX; // largeur dispo pour le texte
  const gapBetween = 18;           // espace vertical entre étapes

  steps.forEach((s, i) => {
    const color = stepColors[i % stepColors.length];

    // Calcule la hauteur de l'étape AVANT de dessiner, pour gérer la
    // pagination et le trait de liaison vers l'étape suivante.
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(12);
    const titleLines = doc.splitTextToSize(s.title, contentW);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9.5);
    const sumLines = doc.splitTextToSize(s.summary || "", contentW);
    const titleH = titleLines.length * 15;
    const sumH = sumLines.length * 13;
    const durH = s.duration ? 16 : 0;
    const blockH = titleH + 6 + sumH + durH;
    const rowH = Math.max(blockH, badgeR * 2);

    // Pagination : si l'étape ne tient pas, page suivante avec header.
    const before = y;
    y = ensureSpace(doc, y, rowH + gapBetween, _client, type);
    if (y !== before) {
      // Nouvelle page : on repart sous le header, sans titre de section
      // répété (le contenu reste lisible et continu).
      y += 8;
    }

    const rowTop = y;
    const badgeCY = rowTop + badgeR;

    // Trait de liaison vertical entre cette pastille et la suivante
    // (sauf dernière étape). Tracé léger couleur de l'étape courante.
    if (i < steps.length - 1) {
      doc.setDrawColor(...color);
      doc.setLineWidth(1.5);
      doc.line(railX, badgeCY + badgeR + 2, railX, rowTop + rowH + gapBetween + badgeR - 2);
    }

    // Pastille numérotée pleine couleur + anneau INK
    doc.setFillColor(...color);
    doc.circle(railX, badgeCY, badgeR, "F");
    doc.setDrawColor(...INK);
    doc.setLineWidth(1);
    doc.circle(railX, badgeCY, badgeR, "S");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(String(i + 1).padStart(2, "0"), railX, badgeCY + 4.5, { align: "center" });

    // Bloc texte à droite
    let ty = rowTop + 12;
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(titleLines, contentX, ty);
    ty += titleH + 4;

    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...SUB);
    doc.text(sumLines, contentX, ty);
    ty += sumH;

    // Chip durée sous le résumé (jamais superposée au texte)
    if (s.duration) {
      ty += 6;
      const durText = s.duration.toUpperCase();
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(7.5);
      const chipW = doc.getTextWidth(durText) + 16;
      doc.setFillColor(...color);
      doc.roundedRect(contentX, ty - 9, chipW, 14, 7, 7, "F");
      doc.setTextColor(...INK);
      doc.text(durText, contentX + 8, ty);
    }

    y = rowTop + rowH + gapBetween;
  });
}

// ============ AVANTAGES FISCAUX 2026 ============
// Page pédagogique sur la fiscalité de l'électrification (B2B France 2026).
// IMPORTANT : la TVA sur l'acquisition / LLD n'est récupérable QUE sur les
// véhicules UTILITAIRES 100 % électriques — jamais sur les véhicules de
// tourisme (VP), quelle que soit l'énergie. La TVA sur l'électricité de
// recharge est, elle, récupérable à 100 %.
function drawFiscalAdvantages(doc: jsPDF, vehicles: SelectedVehicle[], energy: EnergyParams) {
  const ROSE_LIGHT: [number, number, number] = [253, 241, 238];
  const BLUE_LIGHT: [number, number, number] = [237, 246, 255];
  const GREEN_LIGHT: [number, number, number] = [219, 238, 220];
  const VIOLET_LIGHT: [number, number, number] = [246, 245, 247];
  const GREEN: [number, number, number] = [108, 190, 94];
  const ROSE: [number, number, number] = [244, 184, 170];

  let y = 130;
  eyebrow(doc, lookupText(TEXTS, "common", "fiscal_eyebrow", L("FISCALITÉ ENTREPRISE 2026", "CORPORATE TAX 2026")), y);
  y += 32;
  title(doc, lookupText(TEXTS, "common", "fiscal_title", L("Vos avantages fiscaux à l'électrification.", "Your tax advantages from electrification.")), y);
  y += 36;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const intro = doc.splitTextToSize(
    lookupText(TEXTS, "common", "fiscal_intro",
      L(
        "L'électrification de votre flotte ouvre des leviers fiscaux concrets : exonération de TVS, récupération de TVA sur la recharge, absence de malus. Voici ce qui s'applique à votre projet.",
        "Electrifying your fleet opens up concrete tax levers: TVS exemption, VAT recovery on charging, no penalty. Here's what applies to your project.",
      )),
    PAGE_W - M * 2);
  doc.text(intro, M, y);
  y += intro.length * 13 + 18;

  // ─── Calculs ─────────────────────────────────────────────────────────
  const isUtilitaire = (cat?: string) => /utilitaire|fourgon|camionnette|\butilit|\bvu\b/i.test(cat ?? "");
  const utilEvs = vehicles.filter((sv) => sv.vehicle.energy === "Électrique" && isUtilitaire(sv.vehicle.category));
  const currentFleet = vehicles.filter((sv) => sv.vehicle.isCurrentFleet && sv.vehicle.energy !== "Électrique");
  let tvsEvitee = 0;
  for (const sv of currentFleet) {
    try {
      const r = calculateTcoFull(sv.vehicle, {
        dureeAnnees: sv.durationMonths / 12,
        kmContrat: sv.kmPerYear * (sv.durationMonths / 12),
        prixEssenceLitre: energy.fuelPriceL,
        prixKwhDomicile: energy.kWhHome,
        prixKwhPublic: energy.kWhPublic,
        remisePctOverride: sv.discountPct,
      }, sv.negotiatedMonthly);
      tvsEvitee += r.tvsTotal * sv.quantity;
    } catch { /* skip */ }
  }

  type Card = { label: string; value: string; sub: string; bg: [number, number, number]; accent: [number, number, number] };
  const cards: Card[] = [
    {
      label: L("TAXE SUR LES VÉHICULES DE SOCIÉTÉ", "COMPANY CAR TAX (TVS)"),
      value: L("0 € de TVS", "€0 TVS"),
      sub: tvsEvitee > 0
        ? L(`Véhicules électriques exonérés. Soit ${eur(tvsEvitee)} évités vs votre flotte thermique actuelle.`, `Electric vehicles are exempt. That's ${eur(tvsEvitee)} avoided vs. your current combustion fleet.`)
        : L(
            "Les véhicules 100 % électriques sont exonérés des taxes annuelles sur les véhicules de société (CO2 + ancienneté).",
            "100% electric vehicles are exempt from the annual company car taxes (CO2 + age).",
          ),
      bg: GREEN_LIGHT, accent: GREEN,
    },
    {
      label: L("MALUS À L'ACHAT", "PURCHASE PENALTY"),
      value: L("0 € de malus", "€0 penalty"),
      sub: L(
        "Les véhicules électriques sont exonérés du malus CO2 et du malus au poids — économie immédiate à l'acquisition.",
        "Electric vehicles are exempt from the CO2 penalty and the weight penalty, an immediate saving at acquisition.",
      ),
      bg: ROSE_LIGHT, accent: ROSE,
    },
    {
      label: L("TVA SUR LA RECHARGE", "VAT ON CHARGING"),
      value: L("Récupérable 100 %", "100% recoverable"),
      sub: L(
        "La TVA sur l'électricité consommée pour la recharge de la flotte est intégralement récupérable.",
        "VAT on the electricity consumed for charging the fleet is fully recoverable.",
      ),
      bg: BLUE_LIGHT, accent: ADMIN_MODE ? [30, 90, 153] : [56, 9, 234],
    },
    {
      label: L("TVA SUR LE VÉHICULE", "VAT ON THE VEHICLE"),
      value: utilEvs.length > 0 ? L(`${utilEvs.length} utilitaire${utilEvs.length > 1 ? "s" : ""} éligible${utilEvs.length > 1 ? "s" : ""}`, `${utilEvs.length} eligible van${utilEvs.length > 1 ? "s" : ""}`) : L("Utilitaires uniquement", "Vans only"),
      sub: L(
        "Récupérable UNIQUEMENT sur les véhicules utilitaires 100 % électriques. Sur les véhicules de tourisme, la TVA à l'achat / LLD n'est pas récupérable.",
        "Recoverable ONLY on 100% electric vans. On passenger vehicles, VAT on purchase / LLD lease is not recoverable.",
      ),
      bg: VIOLET_LIGHT, accent: [108, 94, 130],
    },
  ];

  const gap = 12;
  const cardW = (PAGE_W - M * 2 - gap) / 2;
  const cardH = 112;
  cards.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const cx = M + col * (cardW + gap);
    const cy = y + row * (cardH + gap);
    doc.setFillColor(...c.bg);
    doc.roundedRect(cx, cy, cardW, cardH, 10, 10, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...c.accent);
    doc.text(doc.splitTextToSize(c.label, cardW - 28), cx + 14, cy + 18);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(19);
    doc.setTextColor(...INK);
    doc.text(c.value, cx + 14, cy + 46);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUB);
    doc.text(doc.splitTextToSize(c.sub, cardW - 28), cx + 14, cy + 64);
  });
  y += cardH * 2 + gap + 22;

  // Encart "AND/AEN" + note précision TVA
  doc.setFillColor(252, 251, 248);
  doc.roundedRect(M, y, PAGE_W - M * 2, 64, 8, 8, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(L("AVANTAGE EN NATURE & AMORTISSEMENTS", "BENEFIT-IN-KIND & DEPRECIATION"), M + 14, y + 18);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(
    L(
      "Les véhicules électriques bénéficient d'un abattement de 70 % sur l'avantage en nature (plafonné), et le plafond d'amortissement non déductible (AND) est relevé pour l'électrique. Ces leviers réduisent le coût employeur réel, intégré dans nos calculs TCO.",
      "Electric vehicles benefit from a 70% reduction on the benefit-in-kind (AEN, capped), and the non-deductible depreciation ceiling (AND) is raised for electric. These levers reduce the real employer cost, included in our TCO calculations.",
    ),
    M + 14, y + 34, { maxWidth: PAGE_W - M * 2 - 28 },
  );
  y += 64 + 16;

  // Sources
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SUB);
  doc.text(
    L(
      "Sources : Code général des impôts, barèmes 2026 (TVS, AND/AEN, malus CO2 et poids), service-public.fr / impots.gouv.fr. Synthèse indicative, à ajuster selon la situation fiscale propre à votre entreprise.",
      "Sources: French General Tax Code, 2026 scales (TVS, AND/AEN, CO2 and weight penalty), service-public.fr / impots.gouv.fr. Indicative summary, to be adjusted to your company's specific tax situation.",
    ),
    M, y, { maxWidth: PAGE_W - M * 2 },
  );
}

// ============ VALIDATION (varie par type) ============
// ============ SYNTHÈSE FINANCIÈRE ENRICHIE ============
// Slide récap avec 4 KPI cards en grille (loyers cumulés, économies vs
// concurrents, TVS évitée par électrification, CO2 évité) + tableau
// détaillé en bas. Vise à donner au décideur une vue chiffrée immédiate
// de la valeur financière ET environnementale du projet.
function drawFinancialSynthesis(
  doc: jsPDF,
  vehicles: SelectedVehicle[],
  energy: EnergyParams,
) {
  const ROSE: [number, number, number] = [244, 184, 170];
  const ROSE_LIGHT: [number, number, number] = [253, 241, 238];
  const BLUE: [number, number, number] = [165, 210, 255];
  const BLUE_LIGHT: [number, number, number] = [237, 246, 255];
  const VIOLET_LIGHT: [number, number, number] = [246, 245, 247];
  const GREEN: [number, number, number] = [108, 190, 94];
  const GREEN_LIGHT: [number, number, number] = [219, 238, 220];

  let y = 130;
  eyebrow(doc, lookupText(TEXTS, "common", "synthesis_eyebrow", L("SYNTHÈSE FINANCIÈRE & ENVIRONNEMENTALE", "FINANCIAL & ENVIRONMENTAL SUMMARY")), y);
  y += 32;
  title(doc, lookupText(TEXTS, "common", "synthesis_title", L("Ce que ce projet vous apporte, chiffré.", "What this project brings you, in figures.")), y);
  y += 36;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const synthIntro = lookupText(TEXTS, "common", "synthesis_intro",
    L(
      "Récapitulatif sur la durée totale des contrats : coût total, économies négociées vs vos offres actuelles, fiscalité évitée par l'électrification et empreinte carbone évitée.",
      "Summary over the total contract duration: total cost, negotiated savings vs. your current offers, tax avoided through electrification, and avoided carbon footprint.",
    ));
  const synthIntroLines = doc.splitTextToSize(synthIntro, PAGE_W - M * 2);
  doc.text(synthIntroLines, M, y);
  // Espace réel calculé sur le nombre de lignes (l'intro fait 2 lignes) + marge,
  // sinon le titre DÉTAIL DES LOYERS chevauche la dernière ligne d'intro.
  y += synthIntroLines.length * 13 + 18;

  // ─── Calculs cumulés ─────────────────────────────────────────────────
  // Véhicules Beev (propositions) vs flotte actuelle (à remplacer)
  const beevVehicles = vehicles.filter((sv) => !sv.vehicle.isCurrentFleet);
  const currentFleet = vehicles.filter((sv) => sv.vehicle.isCurrentFleet);

  // Économies vs offres concurrentes : pour chaque véhicule Beev avec
  // au moins une offre concurrente, on prend la MEILLEURE économie (vs
  // l'offre concurrente la plus chère).
  let savingsVsCompetitors = 0;
  for (const sv of beevVehicles) {
    const offers = (sv.competitorOffers ?? []).filter((o) => o.monthlyTtc > 0);
    if (offers.length === 0) continue;
    const maxCompetitor = Math.max(...offers.map((o) => o.monthlyTtc));
    const monthlyDelta = maxCompetitor - sv.negotiatedMonthly;
    if (monthlyDelta > 0) {
      savingsVsCompetitors += monthlyDelta * sv.durationMonths * sv.quantity;
    }
  }

  // TVS évitée par l'électrification (passage thermique → EV).
  // On somme la TVS annuelle des véhicules flotte actuelle thermiques
  // × durée du contrat — Beev EV = TVS 0.
  let tvsAvoided = 0;
  for (const sv of currentFleet) {
    if (sv.vehicle.energy === "Électrique") continue;
    try {
      const r = calculateTcoFull(sv.vehicle, {
        dureeAnnees: sv.durationMonths / 12,
        kmParAn: sv.kmPerYear,
        mixDomicilePct: energy.mixHomePct,
        prixKwhDom: energy.kWhHome,
        prixKwhPub: energy.kWhPublic,
        prixCarburant: energy.fuelPriceL,
      }, sv.negotiatedMonthly);
      tvsAvoided += r.tvsTotal * sv.quantity;
    } catch { /* skip if calc fails */ }
  }

  // CO2 évité : delta CO2 entre la flotte actuelle thermique et les EV
  // proposés × km/an × durée. Convention : EV = 0 g/km.
  let co2AvoidedKg = 0;
  const avgCo2CurrentFleet = currentFleet.length > 0
    ? currentFleet.reduce((s, sv) => s + (sv.vehicle.co2 || 0) * sv.quantity, 0) / currentFleet.reduce((s, sv) => s + sv.quantity, 0)
    : 130; // référence thermique moyenne France si pas de flotte
  // Pour les EV Beev qui ont du km/an, on calcule la conso évitée vs un
  // thermique de référence (avgCo2CurrentFleet g/km).
  for (const sv of beevVehicles) {
    if (sv.vehicle.energy !== "Électrique") continue;
    const kmTotal = sv.kmPerYear * (sv.durationMonths / 12) * sv.quantity;
    co2AvoidedKg += kmTotal * avgCo2CurrentFleet / 1000;
  }
  // Fallback : si pas de pairing thermique→EV, on utilise la référence
  // thermique 130 g/km pour estimer.
  if (co2AvoidedKg === 0 && currentFleet.length === 0) {
    co2AvoidedKg = beevVehicles
      .filter((sv) => sv.vehicle.energy === "Électrique")
      .reduce((s, sv) => s + sv.kmPerYear * (sv.durationMonths / 12) * sv.quantity, 0)
      * 130 / 1000;
  }

  // ─── 3 KPI cards sur une rangée ──────────────────────────────────────
  // Le « coût total du contrat » a été retiré : la synthèse se concentre
  // sur la valeur ajoutée (économies négociées, fiscalité évitée, impact
  // carbone), pas sur le montant brut déjà détaillé ailleurs.
  type Kpi = { label: string; value: string; sub: string; bg: [number, number, number]; accent: [number, number, number] };
  // On ne construit QUE les briques qui ont une valeur réelle à afficher.
  // Une brique sans valeur (économie nulle, pas de flotte marquée, CO2 nul)
  // n'apparaît pas du tout dans le PDF — pas de carte « — » placeholder.
  const kpis: Kpi[] = [];
  if (savingsVsCompetitors > 0) {
    kpis.push({
      label: L("ÉCONOMIES vs OFFRES ACTUELLES", "SAVINGS vs. CURRENT OFFERS"),
      value: eur(savingsVsCompetitors),
      sub: L("Cumul sur la durée des contrats", "Cumulative over the contract duration"),
      bg: GREEN_LIGHT,
      accent: GREEN,
    });
  }
  if (tvsAvoided > 0) {
    kpis.push({
      label: L("TVS ÉVITÉE PAR ÉLECTRIFICATION", "TVS AVOIDED THROUGH ELECTRIFICATION"),
      value: eur(tvsAvoided),
      sub: L("Cumul sur la durée des contrats", "Cumulative over the contract duration"),
      bg: ROSE_LIGHT,
      accent: ROSE,
    });
  }
  if (co2AvoidedKg > 0) {
    kpis.push({
      label: L("CO2 ÉVITÉ", "CO2 AVOIDED"),
      value: `${Math.round(co2AvoidedKg).toLocaleString("fr-FR")} kg`,
      sub: L(`≈ ${Math.round(co2AvoidedKg / 25).toLocaleString("fr-FR")} arbres absorbant 1 an`, `≈ ${Math.round(co2AvoidedKg / 25).toLocaleString("fr-FR")} trees absorbing for 1 year`),
      bg: VIOLET_LIGHT,
      accent: [108, 190, 94],
    });
  }

  const nCols = Math.max(kpis.length, 1);
  const gapKpi = 12;
  const cardW = (PAGE_W - M * 2 - gapKpi * (nCols - 1)) / nCols;
  const cardH = 110;
  if (kpis.length > 0) {
    kpis.forEach((kpi, i) => {
      const cx = M + i * (cardW + gapKpi);
      const cy = y;
      doc.setFillColor(...kpi.bg);
      doc.roundedRect(cx, cy, cardW, cardH, 10, 10, "F");
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...kpi.accent);
      doc.text(doc.splitTextToSize(kpi.label, cardW - 24), cx + 14, cy + 18);
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(22);
      doc.setTextColor(...INK);
      doc.text(kpi.value, cx + 14, cy + 62);
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...SUB);
      doc.text(doc.splitTextToSize(kpi.sub, cardW - 24), cx + 14, cy + 82);
    });
    y += cardH + 28;
  }

  // ─── Tableau détaillé loyers (flotte actuelle vs proposition Beev) ─────
  // Les véhicules sont ordonnés PAR GROUPE DE COMPARAISON : au sein de chaque
  // groupe, la flotte actuelle d'abord puis les propositions Beev par loyer
  // croissant (cf. orderVehiclesByGroup). Les lignes flotte actuelle sont
  // surlignées en rose, et le loyer le plus bas DE CHAQUE GROUPE en vert.
  const detailVehicles = orderVehiclesByGroup(vehicles);
  const groupKey = (sv: SelectedVehicle) => (sv.comparisonGroup ?? "").trim() || "__nogroup__";
  if (detailVehicles.length > 0 && y < PAGE_H - 200) {
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    const detailTitle = currentFleet.length > 0
      ? L("DÉTAIL DES LOYERS — FLOTTE ACTUELLE vs PROPOSITION BEEV", "LEASE DETAIL · CURRENT FLEET vs. BEEV PROPOSAL")
      : L("DÉTAIL DES LOYERS — PROPOSITION BEEV", "LEASE DETAIL · BEEV PROPOSAL");
    doc.text(detailTitle, M, y);
    y += 8;

    // Loyer le plus bas PAR GROUPE (valeurs > 0) pour le surlignement vert.
    // IMPORTANT : on n'inclut QUE les propositions Beev — jamais la flotte
    // actuelle. Le bandeau vert « loyer le plus bas » valorise l'offre Beev,
    // il ne doit pas s'afficher sur un véhicule de la flotte actuelle.
    const groupMinLoyer = new Map<string, number>();
    for (const sv of detailVehicles) {
      if (sv.vehicle.isCurrentFleet) continue; // exclut la flotte actuelle
      const l = sv.negotiatedMonthly || 0;
      if (l <= 0) continue;
      const g = groupKey(sv);
      groupMinLoyer.set(g, Math.min(groupMinLoyer.get(g) ?? Infinity, l));
    }
    // Affiche une colonne « Groupe » seulement si au moins un groupe est nommé.
    const hasGroups = detailVehicles.some((sv) => (sv.comparisonGroup ?? "").trim());

    const rows = detailVehicles.map((sv) => {
      const base = [
        vehicleLabel(sv.vehicle, 32),
        sv.vehicle.isCurrentFleet ? L("Flotte actuelle", "Current fleet") : L("Proposition Beev", "Beev proposal"),
        `${sv.quantity}`,
        L(
          `${sv.durationMonths} mois · ${((sv.kmPerYear * sv.durationMonths / 12) / 1000).toFixed(0)}k km (contrat)`,
          `${sv.durationMonths} months · ${((sv.kmPerYear * sv.durationMonths / 12) / 1000).toFixed(0)}k km (contract)`,
        ),
        eurLoyer(sv.negotiatedMonthly),
      ];
      return hasGroups ? [(sv.comparisonGroup ?? "").trim() || "—", ...base] : base;
    });
    const head = hasGroups
      ? [[L("Groupe", "Group"), L("Véhicule", "Vehicle"), L("Statut", "Status"), L("Qté", "Qty"), L("Conditions", "Terms"), L("Loyer / mois", "Lease / month")]]
      : [[L("Véhicule", "Vehicle"), L("Statut", "Status"), L("Qté", "Qty"), L("Conditions", "Terms"), L("Loyer / mois", "Lease / month")]];
    const loyerCol = hasGroups ? 5 : 4;
    const colStyles: any = hasGroups
      ? { 0: { cellWidth: 64 }, 2: { cellWidth: 78 }, 3: { halign: "center", cellWidth: 28 }, 5: { halign: "right", fontStyle: "bold" } }
      : { 1: { cellWidth: 86 }, 2: { halign: "center", cellWidth: 32 }, 4: { halign: "right", fontStyle: "bold" } };
    autoTable(doc, {
      startY: y,
      theme: "plain",
      head,
      body: rows,
      headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold", font: BRAND_FONT, cellPadding: 6 },
      bodyStyles: { fontSize: 9, cellPadding: 6, textColor: INK, lineColor: RULE, lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 } as any, font: BRAND_FONT },
      columnStyles: colStyles,
      margin: { left: M, right: M, bottom: TABLE_BOTTOM_MARGIN },
      didParseCell: (data: any) => {
        if (data.section !== "body") return;
        const sv = detailVehicles[data.row.index];
        if (!sv) return;
        // Ligne flotte actuelle → fond rose
        if (sv.vehicle.isCurrentFleet) {
          data.cell.styles.fillColor = ROSE_LIGHT;
        }
        // Cellule loyer la plus basse DU GROUPE → fond vert, UNIQUEMENT sur une
        // proposition Beev (jamais sur la flotte actuelle).
        const gMin = groupMinLoyer.get(groupKey(sv));
        if (!sv.vehicle.isCurrentFleet && data.column.index === loyerCol && gMin !== undefined && (sv.negotiatedMonthly || 0) === gMin) {
          data.cell.styles.fillColor = GREEN_LIGHT;
          data.cell.styles.textColor = INK;
        }
      },
    });

    // Légende du surlignement, sous le tableau
    const afterY = (doc as any).lastAutoTable?.finalY ?? y;
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SUB);
    doc.text(L(
      "Rose : véhicule de votre flotte actuelle à remplacer.  Vert : loyer le plus bas du groupe comparé.",
      "Pink: vehicle from your current fleet to be replaced.  Green: lowest lease in the compared group.",
    ), M, afterY + 14);
  }
}

// ============ LÉGENDE COULEURS / ICÔNES ============
// Page didactique qui explique au client la signification des couleurs
// et badges utilisés dans le PDF Beev. Aide à la lecture, surtout
// utile sur les longs documents avec mise en concurrence et comparateurs.
function drawLegend(doc: jsPDF) {
  const ROSE: [number, number, number] = [244, 184, 170];
  const BLUE: [number, number, number] = [165, 210, 255];
  const VIOLET: [number, number, number] = [211, 204, 216];
  const GREEN: [number, number, number] = [108, 190, 94];

  let y = 130;
  eyebrow(doc, lookupText(TEXTS, "common", "legend_eyebrow", L("LÉGENDE · COULEURS & SYMBOLES", "LEGEND · COLORS & SYMBOLS")), y);
  y += 32;
  title(doc, lookupText(TEXTS, "common", "legend_title", L("Comment lire ce document.", "How to read this document.")), y);
  y += 36;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  doc.text(
    lookupText(TEXTS, "common", "legend_intro",
      L(
        "Ce document combine plusieurs vues (fiches véhicule, comparateurs, mise en concurrence). Les couleurs et badges ci-dessous vous aident à naviguer rapidement.",
        "This document combines several views (vehicle fiches, comparators, competitive comparison). The colors and badges below help you navigate quickly.",
      )),
    M, y, { maxWidth: PAGE_W - M * 2 },
  );
  y += 30;

  type LegendItem = { color: [number, number, number]; label: string; desc: string };
  const items: LegendItem[] = [
    {
      color: ROSE,
      label: L("FLOTTE ACTUELLE", "CURRENT FLEET"),
      desc: L(
        "Véhicule de votre flotte existante (en cours de contrat). Apparaît dans le comparateur pour visualiser l'écart avec notre proposition.",
        "Vehicle from your existing fleet (contract in progress). Appears in the comparator to visualize the gap with our proposal.",
      ),
    },
    {
      color: BLUE,
      label: L("PROPOSITION BEEV", "BEEV PROPOSAL"),
      desc: L(
        "Véhicule électrique que nous vous proposons en remplacement ou en nouvel ajout. Détaillé sur sa propre fiche.",
        "Electric vehicle we propose as a replacement or new addition. Detailed on its own fiche.",
      ),
    },
    {
      color: VIOLET,
      label: L("HYBRIDE / TRANSITION", "HYBRID / TRANSITION"),
      desc: L(
        "Véhicule hybride rechargeable ou non rechargeable. Énergie mixte, conso thermique + consommation électrique en mode EV.",
        "Plug-in or non-plug-in hybrid vehicle. Mixed energy, combustion consumption plus electric consumption in EV mode.",
      ),
    },
    {
      color: GREEN,
      label: L("ÉCONOMIE / IMPACT POSITIF", "SAVINGS / POSITIVE IMPACT"),
      desc: L(
        "Indique un gain mesurable : économie €/mois vs l'offre concurrente, TVS évitée, CO2 économisé, etc.",
        "Indicates a measurable gain: savings €/month vs. the competing offer, TVS avoided, CO2 saved, etc.",
      ),
    },
    {
      color: [29, 29, 29],
      label: L("INFORMATION PRINCIPALE", "KEY INFORMATION"),
      desc: L(
        "Données contractuelles clés (loyer mensuel, MONTANT TOTAL PROJET, BPA). Charte Beev — Black officiel.",
        "Key contractual data (monthly lease, TOTAL PROJECT AMOUNT, order confirmation). Official Beev black brand color.",
      ),
    },
  ];

  // Affichage en liste verticale : pastille couleur + label gras + description
  items.forEach((item) => {
    // Pastille couleur 28×28
    doc.setFillColor(...item.color);
    doc.roundedRect(M, y, 28, 28, 6, 6, "F");
    // Label
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(item.label, M + 40, y + 13);
    // Description
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SUB);
    const descLines = doc.splitTextToSize(item.desc, PAGE_W - M * 2 - 40);
    doc.text(descLines, M + 40, y + 24);
    y += 28 + Math.max(0, (descLines.length - 1)) * 11 + 16;
  });

  // Encart bas : symboles génériques
  y += 8;
  if (y < PAGE_H - 100) {
    doc.setFillColor(252, 251, 248);
    doc.roundedRect(M, y, PAGE_W - M * 2, 70, 8, 8, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(L("SYMBOLES UTILISÉS", "SYMBOLS USED"), M + 14, y + 16);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SUB);
    doc.text(L(
      "·  Cellules surlignées dans le comparateur = meilleure valeur sur la ligne (prix le plus bas, autonomie la plus haute, etc.).",
      "·  Highlighted cells in the comparator = best value on the row (lowest price, longest range, etc.).",
    ), M + 14, y + 32, { maxWidth: PAGE_W - M * 2 - 28 });
    doc.text(L(
      "·  Loyer affiché en TTC. La TVA sur les loyers LLD véhicules électriques est récupérable à 100 %.",
      "·  Lease shown incl. VAT. VAT on electric vehicle LLD leases is 100% recoverable.",
    ), M + 14, y + 46, { maxWidth: PAGE_W - M * 2 - 28 });
    doc.text(L(
      "·  CO2 évité estimé sur une référence thermique de 130 g/km (moyenne France) — ajustable selon votre flotte actuelle.",
      "·  CO2 avoided estimated on a 130 g/km combustion reference (France average), adjustable based on your current fleet.",
    ), M + 14, y + 60, { maxWidth: PAGE_W - M * 2 - 28 });
  }
}

function drawValidation(doc: jsPDF, type: ProjectType, c: ClientInfo) {
  let y = 130;
  eyebrow(doc, lookupText(TEXTS, "common", "next_steps_eyebrow", L("PROCHAINES ÉTAPES", "NEXT STEPS")), y);
  y += 32;
  title(doc, lookupText(TEXTS, "common", "next_steps_title", L("Validation et lancement du projet.", "Validating and launching the project.")), y);
  y += 36;

  const stepsByType: Record<ProjectType, [string, string, string][]> = {
    vehicles: PDF_LANG === "en" ? [
      ["1", "Approving the LLD offer", "Order confirmation signed, final vehicle selection, choice of lessor (Ayvens, Arval, Athlon…)."],
      ["2", "Financing review", "Building the lessor's credit file, approval from the risk department."],
      ["3", "Ordering from manufacturers", "Issuing the vehicle orders, tracking manufacturing and the delivery schedule."],
      ["4", "Delivery & entry into service", "Delivery of the vehicles on site, handover, activation of fuel cards / charging badges."],
    ] : [
      ["1", "Validation de l'offre LLD", "Bon pour accord signé, sélection des véhicules définitive, choix du loueur (Ayvens, Arval, Athlon…)."],
      ["2", "Étude de financement", "Constitution du dossier crédit-bailleur, accord de la direction des risques."],
      ["3", "Commande auprès des constructeurs", "Émission des commandes véhicules, suivi de fabrication et planning de livraison."],
      ["4", "Livraison & mise en service", "Livraison des véhicules sur site, prise en main, activation des cartes carburant / badges recharge."],
    ],
    home: [
      ["1", "Validation du cadre employeur", "Signature du cadre par l'employeur : périmètre, modèle de borne, modalités de remboursement."],
      ["2", "Mandat & intégration collaborateur", "Le collaborateur signe un mandat d'installation à son domicile et fournit quelques informations (type de logement, stationnement, accès au tableau électrique)."],
      ["3", "Visite technique & devis ferme", "Visite ou audit à distance par notre partenaire IRVE Seris, devis ferme transmis pour validation."],
      ["4", "Pose & mise en service", "Installation par technicien IRVE certifié, mise en service de la supervision, premier remboursement énergie sous 30 jours."],
    ],
    site: [
      ["1", "Validation de l'offre site", "Bon pour accord signé, sélection des modèles et nombre de points de charge par site."],
      ["2", "Étude technique site", "Visite technique de chaque site, étude de faisabilité électrique et planning des travaux."],
      ["3", "Devis ferme & travaux", "Devis ferme par site (matériel, installation, travaux), validation des conditions d'accès et planning des travaux."],
      ["4", "Pose, mise en service & réception", "Installation par technicien IRVE certifié, mise en service et formation des utilisateurs, signature du rapport de réception."],
    ],
  };

  stepsByType[type].forEach(([n, t, d]) => {
    doc.setFillColor(...ACCENT);
    doc.rect(M, y - 12, 26, 26, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(n, M + 13, y + 5, { align: "center" });
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(t, M + 38, y);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...SUB);
    const ll = doc.splitTextToSize(d, PAGE_W - M - (M + 38));
    doc.text(ll, M + 38, y + 14);
    y += 14 + ll.length * 12 + 16;
  });

  y += 6;
  doc.setDrawColor(...RULE);
  doc.line(M, y, PAGE_W - M, y);
  y += 20;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  doc.text(lookupText(TEXTS, "common", "bpa_conditions_title", L("CONDITIONS COMMERCIALES", "COMMERCIAL TERMS")), M, y);
  y += 14;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  const fallback: Record<ProjectType, string> = {
    vehicles: L(
      "Offre valable 30 jours. Loyers exprimés en TTC, sous réserve de disponibilité constructeur, d'évolution de la fiscalité applicable et d'acceptation par la direction des risques du loueur. TCO indicatif, hors malus, hors aides locales.",
      "Offer valid for 30 days. Leases shown incl. VAT, subject to manufacturer availability, changes to applicable tax rules, and approval by the lessor's risk department. Indicative TCO, excluding penalties and local incentives.",
    ),
    home: "Offre valable 30 jours. Tarifs HT, pose 0–10 m incluse. Au-delà : devis complémentaire après visite technique. Le mandat d'installation est signé individuellement par chaque collaborateur bénéficiaire.",
    site: "Offre valable 30 jours. Tarifs HT, sous réserve de visite technique sur site. Le devis ferme par site est émis après audit IRVE. Garantie constructeur 3 ans, extensible 6 ans en option.",
  };
  // Pour un compte admin sur un projet site (B2B) ou domicile (B2B2E), on ignore
  // le texte BPA/conditions enregistré dans l'admin (rédigé pour les véhicules /
  // LLD) et on garde le texte propre au type, cohérent avec le projet.
  const adminPerType = ADMIN_MODE && type !== "vehicles";
  const conditionsText = c.notes || (adminPerType ? "" : PDF_CONTENT.validationConditions) || fallback[type];
  const lines = doc.splitTextToSize(conditionsText, PAGE_W - M * 2);
  doc.text(lines, M, y);
  y += lines.length * 13 + 22;

  // Bon pour accord — libellé adapté au type
  const bpaTitle: Record<ProjectType, string> = {
    vehicles: L("BON POUR ACCORD — OFFRE VÉHICULES LLD", "ORDER CONFIRMATION · VEHICLE LLD OFFER"),
    home: "BON POUR ACCORD — DÉPLOIEMENT DOMICILE COLLABORATEURS",
    site: "BON POUR ACCORD — DÉPLOIEMENT SITE ENTREPRISE",
  };
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  doc.text((adminPerType ? "" : PDF_CONTENT.validationBpaTitle) || bpaTitle[type], M, y);
  y += 14;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  const bpaText: Record<ProjectType, string> = {
    vehicles: L(
      "Le client confirme la sélection des véhicules ci-avant et autorise Beev à transmettre les bons de commande LLD au loueur retenu, sous réserve de l'accord risque.",
      "The client confirms the vehicle selection above and authorizes Beev to send the LLD purchase orders to the selected lessor, subject to risk department approval.",
    ),
    home: "L'employeur valide le cadre du déploiement B2B2E. Chaque installation au domicile d'un collaborateur fera l'objet d'un mandat individuel signé par le collaborateur concerné.",
    site: "Le client autorise Beev à lancer l'étude technique sur site. Le devis ferme par site sera émis après audit IRVE et signé séparément avant pose.",
  };
  const bl = doc.splitTextToSize((adminPerType ? "" : PDF_CONTENT.validationBpaText) || bpaText[type], PAGE_W - M * 2);
  doc.text(bl, M, y);
  y += bl.length * 13 + 18;

  // ===== Encart signature pro =====
  const sigH = 110;
  doc.setFillColor(...BG);
  doc.rect(M, y, PAGE_W - M * 2, sigH, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(M, y, 4, sigH, "F");

  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SUB);
  doc.text(lookupText(TEXTS, "common", "bpa_client_box_title", L("CADRE RÉSERVÉ AU CLIENT", "CLIENT SECTION")), M + 16, y + 18);

  // 2 colonnes : infos client | signature
  const colY = y + 36;
  const colW = (PAGE_W - M * 2 - 32) / 2;

  // Colonne gauche : champs date / nom
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(lookupText(TEXTS, "common", "bpa_date_label", L("Date de signature :", "Signature date:")), M + 16, colY);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(M + 100, colY + 2, M + 16 + colW - 10, colY + 2);

  doc.text(lookupText(TEXTS, "common", "bpa_name_label", L("Nom & qualité :", "Name & title:")), M + 16, colY + 22);
  doc.line(M + 100, colY + 24, M + 16 + colW - 10, colY + 24);

  doc.text(lookupText(TEXTS, "common", "bpa_phone_label", L("Téléphone :", "Phone:")), M + 16, colY + 44);
  doc.line(M + 100, colY + 46, M + 16 + colW - 10, colY + 46);

  // Colonne droite : zone signature
  const sigX = M + 16 + colW + 16;
  const sigW = colW - 16;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SUB);
  doc.text(lookupText(TEXTS, "common", "bpa_signature_label", L("Signature et cachet de l'entreprise", "Company signature and stamp")), sigX, colY);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.rect(sigX, colY + 6, sigW, 60);
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 165);
  doc.text(L("(faire précéder de la mention 'Bon pour accord')", "(precede with the words 'Approved for order')"), sigX, colY + 75);

  // Sous-bandeau : références Beev pour démarrer
  y += sigH + 14;
  doc.setFillColor(...INK);
  doc.rect(M, y, PAGE_W - M * 2, 36, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ACCENT);
  doc.text(lookupText(TEXTS, "common", "bpa_contact_title", L("VOTRE INTERLOCUTEUR BEEV", "YOUR BEEV CONTACT")), M + 16, y + 14);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  const repInfo = [c.salesRep, c.salesRepEmail, c.salesRepPhone].filter(Boolean).join(" · ");
  doc.text(repInfo || L("Commercial grand compte Beev", "Beev key account manager"), M + 16, y + 28);
}

// ============ HEADER / FOOTER / HELPERS ============
function drawHeader(doc: jsPDF, c: ClientInfo, type: ProjectType) {
  const tag = type === "vehicles" ? L("Offre véhicules LLD", "EV fleet lease offer") : type === "home" ? "Déploiement domicile (B2B2E)" : "Déploiement site entreprise";
  if (ADMIN_MODE) {
    // v2 : en-tête épuré — logo paramétré (dashboard) + point d'accent produit
    // (gauche), client + objet (droite), filet fin.
    let logoW = 0;
    if (HEADER_LOGO_DARK) {
      const ratio = HEADER_LOGO_DARK.w / Math.max(HEADER_LOGO_DARK.h, 1);
      logoW = Math.min(104, 20 * ratio);
      try {
        doc.addImage(HEADER_LOGO_DARK.dataUrl, HEADER_LOGO_DARK.format, M, 45, logoW, 20, undefined, "FAST");
      } catch {
        doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(14); doc.setTextColor(...INK);
        doc.text("Beev", M, 60); logoW = doc.getTextWidth("Beev");
      }
    } else {
      doc.setFont(BRAND_FONT, "bold"); doc.setFontSize(14); doc.setTextColor(...INK);
      doc.text("Beev", M, 60); logoW = doc.getTextWidth("Beev");
    }
    doc.setFillColor(...PRODUCT_ACCENT);
    doc.circle(M + logoW + 8, 55, 2.6, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(c.company || "—", PAGE_W - M, 54, { align: "right" });
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SUB);
    doc.text(`${tag}${c.date ? "  ·  " + c.date : ""}`, PAGE_W - M, 67, { align: "right" });
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.6);
    doc.line(M, 84, PAGE_W - M, 84);
    return;
  }
  // Bandeau noir arrondi en haut à gauche contenant le logo Beev blanc
  // (préchargé dans HEADER_LOGO). Si l'image n'a pas pu être chargée, on
  // retombe sur le texte "Beev" centré dans le même bandeau.
  const badgeW = 80;
  const badgeH = 26;
  const badgeX = M;
  const badgeY = 40;
  doc.setFillColor(...INK);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 6, 6, "F");

  const fallbackText = () => {
    doc.setTextColor(255, 255, 255);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(12);
    // baseline 'middle' centre verticalement le glyphe dans la box noire
    (doc.text as any)("Beev", badgeX + badgeW / 2, badgeY + badgeH / 2, {
      align: "center",
      baseline: "middle",
    });
  };

  if (HEADER_LOGO) {
    // Placement contain dans le bandeau, avec padding interne
    const padX = 12;
    const padY = 5;
    const innerW = badgeW - padX * 2;
    const innerH = badgeH - padY * 2;
    const ratio = HEADER_LOGO.w / Math.max(HEADER_LOGO.h, 1);
    let w = innerW;
    let h = w / ratio;
    if (h > innerH) {
      h = innerH;
      w = h * ratio;
    }
    const cx = badgeX + (badgeW - w) / 2;
    const cy = badgeY + (badgeH - h) / 2;
    try {
      doc.addImage(HEADER_LOGO.dataUrl, HEADER_LOGO.format, cx, cy, w, h, undefined, "FAST");
    } catch {
      fallbackText();
    }
  } else {
    fallbackText();
  }

  // Tag offre sous le bandeau, en gris discret
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(tag, M, badgeY + badgeH + 12);

  // Bloc droite : société client + date
  doc.setTextColor(...INK);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(9);
  doc.text(c.company || "—", PAGE_W - M, 56, { align: "right" });
  doc.setFont(BRAND_FONT, "normal");
  doc.setTextColor(...SUB);
  doc.setFontSize(8.5);
  doc.text(c.date, PAGE_W - M, 70, { align: "right" });

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.6);
  doc.line(M, 86, PAGE_W - M, 86);
}

// Filigrane "DEVIS" en diagonale, gris très clair, sous le contenu.
// Différencie visuellement une offre commerciale d'un contrat / facture.
function drawWatermark(doc: jsPDF) {
  try {
    const anyDoc = doc as any;
    anyDoc.saveGraphicsState?.();
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(120);
    doc.setTextColor(240, 238, 232); // gris cream très clair
    // Texte diagonal au centre de la page — angle non typé selon versions jsPDF
    (doc.text as any)(L("DEVIS", "QUOTE"), PAGE_W / 2, PAGE_H / 2 + 40, {
      align: "center",
      angle: 35,
    });
    anyDoc.restoreGraphicsState?.();
  } catch {
    // Si le filigrane échoue, on continue sans (non bloquant)
  }
}

function drawFooter(doc: jsPDF, c: ClientInfo, page: number, total: number) {
  // Filet supérieur
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.6);
  doc.line(M, PAGE_H - 56, PAGE_W - M, PAGE_H - 56);

  // Ligne 1 : commercial + coordonnées Beev société
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  const repName = c.salesRep || "Commercial grand compte";
  doc.text(`BEEV · ${repName}`, M, PAGE_H - 42);

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUB);
  const repContact = [c.salesRepEmail, c.salesRepPhone].filter(Boolean).join(" · ");
  if (repContact) doc.text(repContact, M, PAGE_H - 32);

  // Centre : mention confidentielle + tag offre
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUB);
  doc.text(L("Document confidentiel · usage interne client", "Confidential document · client internal use"), PAGE_W / 2, PAGE_H - 42, { align: "center" });
  doc.text("beev.co · contact@beev.co", PAGE_W / 2, PAGE_H - 32, { align: "center" });

  // Droite : numérotation page
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(L(`Page ${page} / ${total}`, `Page ${page} of ${total}`), PAGE_W - M, PAGE_H - 42, { align: "right" });
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUB);
  doc.text(c.date || "", PAGE_W - M, PAGE_H - 32, { align: "right" });
}

function eyebrow(doc: jsPDF, label: string, y: number) {
  if (ADMIN_MODE) {
    // v2 : barre d'accent produit à gauche + label en capitales.
    doc.setFillColor(...PRODUCT_ACCENT);
    doc.rect(M, y - 7, 18, 3, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUB);
    doc.text(label.toUpperCase(), M + 26, y);
    return;
  }
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SUB);
  doc.text(label, M, y);
  doc.setFillColor(...ACCENT);
  doc.rect(M, y + 6, 24, 2.5, "F");
}

function title(doc: jsPDF, label: string, y: number) {
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(ADMIN_MODE ? 24 : 22);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(label, PAGE_W - M * 2);
  doc.text(lines, M, y);
}

// Remplace les espaces spéciaux (NARROW NO-BREAK SPACE U+202F et NO-BREAK SPACE U+00A0)
// que Helvetica jsPDF ne sait pas rendre (apparaissent comme "/" dans le PDF)
const cleanSpaces = (s: string) => s.replace(/ /g, " ").replace(/ /g, " ");
const fmt = (n: number) => cleanSpaces(n.toLocaleString("fr-FR"));
const eur = (n: number) =>
  cleanSpaces(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n));
const eur2 = (n: number) =>
  cleanSpaces(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n));
// Format dédié aux loyers : toujours 2 décimales (ex. 481,73 € — jamais 482 €),
// utilisé sur les fiches véhicule + récap financier pour préserver la précision
// négociée. Empêche l'arrondi à l'euro qui faisait apparaître le loyer comme
// un chiffre rond alors qu'il a été négocié à la virgule.
const eurLoyer = (n: number) =>
  cleanSpaces(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n));

function ensureSpace(doc: jsPDF, y: number, needed: number, client?: ClientInfo, type?: ProjectType): number {
  if (y + needed > FOOTER_LIMIT) {
    doc.addPage();
    if (client && type) drawHeader(doc, client, type);
    return 116;
  }
  return y;
}

type LoadedImage = { dataUrl: string; w: number; h: number; format: "JPEG" | "PNG" };

async function loadImage(url: string): Promise<LoadedImage | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) {
      console.warn(`[pdf] loadImage ${res.status} ${url}`);
      return null;
    }
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    const format: "JPEG" | "PNG" = /\.png(\?|$)/i.test(url) || dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    return { dataUrl, w: dims.w, h: dims.h, format };
  } catch (e) {
    console.warn(`[pdf] loadImage error ${url}`, e);
    return null;
  }
}

// Aplatit une image PNG (potentiellement transparente) sur un fond opaque
// (par défaut cream) pour éviter les pixels noirs dans le PDF (jsPDF ne gère
// pas l'alpha PNG). Le paramètre `bg` permet d'utiliser un fond différent —
// indispensable pour les logos blancs placés sur fond noir (cover, badge
// header) qui deviendraient invisibles s'ils étaient aplatis sur cream.
async function flattenPngToJpeg(
  dataUrl: string,
  w: number,
  h: number,
  bg: [number, number, number] = [250, 248, 244],
): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(dataUrl);
    ctx.fillStyle = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
    ctx.fillRect(0, 0, w, h);
    const imgEl = new Image();
    imgEl.onload = () => {
      ctx.drawImage(imgEl, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    imgEl.onerror = () => resolve(dataUrl);
    imgEl.src = dataUrl;
  });
}

// Affiche une image en gardant son ratio natif, centrée dans la zone (x,y,maxW,maxH).
// `bg` : couleur de fond utilisée pour aplatir les PNG transparents. Par défaut
// cream (zones produits). Passer [29,29,29] sur la cover et le badge header
// pour préserver la visibilité des logos blancs.
async function drawImageContain(
  doc: jsPDF,
  url: string,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
  bg: [number, number, number] = [250, 248, 244],
) {
  const img = await loadImage(url);
  if (!img) return;
  const ratio = img.w / Math.max(img.h, 1);
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  const cx = x + (maxW - w) / 2;
  const cy = y + (maxH - h) / 2;
  let finalDataUrl = img.dataUrl;
  let finalFormat: "JPEG" | "PNG" = img.format;
  if (img.format === "PNG") {
    finalDataUrl = await flattenPngToJpeg(img.dataUrl, img.w, img.h, bg);
    finalFormat = "JPEG";
  }
  try {
    doc.addImage(finalDataUrl, finalFormat, cx, cy, w, h, undefined, "FAST");
  } catch {
    /* image format non supporté — silencieux */
  }
}
