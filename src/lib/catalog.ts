// Catalogue Beev synchronisé avec le calculateur TCO 2026
// https://beev-tco-2026.lovable.app/

export type ProjectType = "vehicles" | "home" | "site";

export const PROJECT_LABEL: Record<ProjectType, string> = {
  vehicles: "Projet Véhicules",
  home: "Bornes domicile collaborateurs (B2B2E)",
  site: "Bornes site entreprise",
};

export type Energy = "Électrique" | "Hybride Rechargeable" | "Hybride" | "Mild Hybrid" | "Essence" | "Diesel";

// ===== Parcours client Beev (process A → Z) =====
export type JourneyStep = {
  n: string;
  title: string;
  summary: string;
  beev: string[];   // ce que Beev fait
  client: string[]; // ce que le client fournit / valide
  duration?: string;
};

export const BEEV_JOURNEYS: Record<ProjectType, { intro: string; steps: JourneyStep[] }> = {
  vehicles: {
    intro: "De la sélection des véhicules à la livraison en concession ou chez vos collaborateurs, Beev orchestre l'intégralité du parcours et vous garde un interlocuteur unique tout au long du contrat LLD.",
    steps: [
      {
        n: "1", title: "Cadrage de la flotte", duration: "J → J+3",
        summary: "Sélection définitive du nombre de véhicules, marques, modèles, couple durée / kilométrage, options et prestations.",
        beev: ["Consolide la fiche besoin par véhicule", "Verrouille les tarifs loueurs (Ayvens, Arval, Athlon…)", "Émet le bon pour accord LLD"],
        client: ["Valide la sélection véhicules", "Confirme durée, kilométrage et options", "Signe le BPA commercial"],
      },
      {
        n: "2", title: "Constitution du dossier financement", duration: "J+3 → J+10",
        summary: "Récupération des pièces comptables nécessaires à l'étude de crédit-bail.",
        beev: ["Monte le dossier risque loueur", "Suit la décision du comité crédit", "Négocie en cas d'aller-retour"],
        client: ["Kbis de moins de 3 mois", "Dernier bilan & liasse fiscale", "RIB société", "CNI du gérant ou mandat de signature"],
      },
      {
        n: "3", title: "Signature des bons de commande", duration: "J+10 → J+15",
        summary: "Une fois l'accord de financement obtenu, émission et signature des BC LLD constructeurs.",
        beev: ["Édite les BC LLD par véhicule", "Transmet au constructeur retenu", "Confirme les délais usine"],
        client: ["Signe les bons de commande", "Valide le planning prévisionnel"],
      },
      {
        n: "4", title: "Choix du lieu de livraison", duration: "J+15 → livraison",
        summary: "Sélection de la ville pour solliciter le distributeur partenaire le plus proche — livraison concession, collaborateur ou siège.",
        beev: ["Sollicite le réseau distributeur partenaire", "Coordonne la logistique de livraison", "Prépare la prise en main"],
        client: ["Indique l'adresse / la concession", "Désigne le contact réception", "Confirme la date de remise"],
      },
      {
        n: "5", title: "Pilotage Fleet Manager Beev", duration: "Continu",
        summary: "Synchronisation du suivi sur notre Fleet Manager — Ryma reprend la relation constructeur et vous tient informés.",
        beev: ["Ryma pilote la livraison constructeur", "Updates hebdo sur l'avancement", "Hotline gestion de flotte tout au long du contrat"],
        client: ["Accès Fleet Manager (multi-utilisateurs)", "Validation des PV de livraison"],
      },
    ],
  },
  home: {
    intro: "Vous équipez vos collaborateurs roulant en VE d'une borne à leur domicile. Beev cadre côté employeur puis prend en charge chaque collaborateur de façon autonome, de la commande au remboursement de l'énergie.",
    steps: [
      {
        n: "1", title: "Cadrage employeur B2B2E", duration: "J → J+5",
        summary: "Définition du périmètre : collaborateurs éligibles, gamme de borne, modalités de remboursement de l'énergie.",
        beev: ["Rédige la convention cadre B2B2E", "Configure le portail employeur", "Forme le RH / flotte"],
        client: ["Liste des collaborateurs bénéficiaires", "Choix du modèle de borne standard", "Validation du tarif kWh remboursé"],
      },
      {
        n: "2", title: "Onboarding collaborateur", duration: "Par collaborateur",
        summary: "Chaque collaborateur signe un mandat d'installation et complète un formulaire technique sur son logement.",
        beev: ["Envoi du lien d'onboarding au collaborateur", "Vérification de la complétude du dossier"],
        client: ["Mandat d'installation signé", "Photos tableau électrique, parking, cheminement câble", "Justificatif d'occupation du logement"],
      },
      {
        n: "3", title: "Visite technique & devis ferme", duration: "J+10 → J+20",
        summary: "Audit à distance ou visite physique par notre partenaire IRVE Seris, puis devis ferme transmis pour validation.",
        beev: ["Audit Seris (distance ou physique)", "Émission du devis ferme par collaborateur", "Gestion des dépassements 0–10 m"],
        client: ["Validation du devis ferme", "Choix de la date de pose"],
      },
      {
        n: "4", title: "Pose & mise en service", duration: "1 demi-journée",
        summary: "Installation par technicien IRVE certifié, mise en service de la supervision en marque blanche.",
        beev: ["Pose IRVE certifiée Seris", "Mise en service de la supervision", "Procès-verbal de mise en service"],
        client: ["Accès au logement le jour J", "Réception et signature du PV"],
      },
      {
        n: "5", title: "Supervision & remboursement énergie", duration: "Continu",
        summary: "Pilotage en marque blanche par collaborateur, remboursement automatisé de l'énergie consommée à titre professionnel sous 30 jours.",
        beev: ["Supervision marque blanche par site / collaborateur", "Calcul mensuel des kWh pro", "Remboursement automatisé"],
        client: ["Dashboard employeur consolidé", "Reporting mensuel par collaborateur"],
      },
    ],
  },
  site: {
    intro: "Vous électrifiez vos sites tertiaires, logistiques ou commerciaux. Beev pilote l'étude IRVE, le matériel, le génie civil et la mise en service OCPP, site par site.",
    steps: [
      {
        n: "1", title: "Cadrage du projet IRVE", duration: "J → J+5",
        summary: "Définition du nombre de sites, du nombre de points de charge par site et des usages (flotte interne, visiteurs, public).",
        beev: ["Atelier de cadrage besoin", "Pré-dimensionnement par site", "Émission du bon pour accord"],
        client: ["Liste des sites concernés", "Usages cibles par site", "Signature du BPA cadre"],
      },
      {
        n: "2", title: "Audit technique site", duration: "J+5 → J+20",
        summary: "Visite physique de chaque site : trajets de câble, dimensionnement TGBT, contraintes d'accès chantier.",
        beev: ["Visite IRVE par site", "Étude électrique TGBT / délestage", "Reportage photo & note technique"],
        client: ["Accès aux locaux techniques", "Plans du site (si disponibles)", "Désignation du référent site"],
      },
      {
        n: "3", title: "Devis ferme & planification", duration: "J+20 → J+30",
        summary: "Devis détaillé ligne par ligne (matériel + IRVE + génie civil) et planning de chantier par site.",
        beev: ["Devis ferme par site", "Planning chantier consolidé", "Coordination génie civil le cas échéant"],
        client: ["Validation du devis ferme", "Confirmation des créneaux d'intervention"],
      },
      {
        n: "4", title: "Travaux, pose & mise en service", duration: "Selon site",
        summary: "Pose par technicien IRVE certifié, paramétrage OCPP, formation utilisateurs, signature du PV de réception.",
        beev: ["Pose IRVE certifiée", "Paramétrage superviseur OCPP", "Formation utilisateurs et gestionnaire"],
        client: ["Réception chantier & PV", "Communication interne aux utilisateurs"],
      },
      {
        n: "5", title: "Exploitation, supervision & SAV", duration: "Continu",
        summary: "Supervision multi-sites, hotline utilisateurs, maintenance préventive, garantie 3 ans extensible 6 ans.",
        beev: ["Supervision multi-sites Beev", "Hotline & GTR contractuelle", "Maintenance préventive annuelle"],
        client: ["Dashboard consolidé", "Reporting d'usage trimestriel"],
      },
    ],
  },
};

export type Vehicle = {
  id: string;
  brand: string;
  model: string;
  version: string;
  category: string;
  energy: Energy;
  batteryKwh: number;
  rangeWltp: number;
  powerHp: number;
  consumption: number;
  co2: number;
  fiscalHp: number;
  envScore?: number;
  priceTtc: number;
  monthlyLld: number;
  image: string;
  services?: string[];
  custom?: boolean;
};

// marginPct est appliqué uniquement à l'affichage côté client :
// le PDF client affiche unitHt * (1 + marginPct/100), mais l'UI admin
// montre les deux (prix d'achat + marge) pour le pilotage commercial.
export type LineItem = { label: string; qty: number; unitHt: number; marginPct?: number };

// Prestations obligatoires, toujours incluses, non décochables
export const MANDATORY_SERVICES = [
  "Maintenance tous réseaux",
  "Assistance 24/24",
  "Garantie perte financière",
] as const;

export type ChargerDeployment = "domicile" | "site";

export type Charger = {
  id: string;
  brand: string;
  model: string;
  powerKw: number;
  type: string;
  deployment: ChargerDeployment;
  priceHt: number;
  /** Prix d'achat HT (cost) — utilisé comme PU achat sur la ligne borne du
   *  chiffrage pour calculer la marge réelle. Distinct du prix vente catalogue
   *  (priceHt) qui sert d'affichage et de base au prix client par défaut. */
  priceBuyHt?: number;
  installPriceHt: number;
  features: string[];
  image: string;
  /** Description longue (paragraphe) — éditable par l'admin, affichée dans le PDF. */
  description?: string;
  defaultLineItems?: LineItem[];
  custom?: boolean;
};

// ===== Helpers création items custom =====
const uid = () => `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function createBlankVehicle(): Vehicle {
  return {
    id: uid(),
    brand: "MARQUE", model: "MODÈLE", version: "Version", category: "Berline",
    energy: "Électrique", batteryKwh: 60, rangeWltp: 400, powerHp: 200,
    consumption: 16, co2: 0, fiscalHp: 5, envScore: 75,
    priceTtc: 40000, monthlyLld: 600,
    image: "/images/placeholder.svg",
    custom: true,
  };
}

export function createBlankCharger(deployment: ChargerDeployment): Charger {
  const home = deployment === "domicile";
  return {
    id: uid(),
    brand: "MARQUE", model: "MODÈLE",
    powerKw: home ? 7.4 : 22,
    type: home ? "Type 2 monophasé · domicile" : "Type 2 triphasé · entreprise",
    deployment,
    priceHt: home ? 1500 : 1500,
    installPriceHt: home ? 0 : 1200,
    features: ["À compléter"],
    image: "/images/placeholder.svg",
    defaultLineItems: home
      ? [{ label: "Borne + forfait pose 0–10 m", qty: 1, unitHt: 1500 }]
      : [
          { label: "Borne", qty: 1, unitHt: 1500 },
          { label: "Pose & raccordement IRVE certifié", qty: 1, unitHt: 1200 },
        ],
    custom: true,
  };
}

// Helper pour les images locales hébergées dans public/images/
const IMG = (path: string) => `/images/${path}`;

export const DEFAULT_VEHICLES: Vehicle[] = [
  { id: "tesla-model-y", brand: "TESLA", model: "MODEL Y", version: "PREMIUM PROPULSION", category: "SUV", energy: "Électrique", batteryKwh: 75, rangeWltp: 622, powerHp: 295, consumption: 14.9, co2: 0, fiscalHp: 6, envScore: 80, priceTtc: 46990, monthlyLld: 700, image: IMG("vehicles/tesla-model-y.png") },
  { id: "mercedes-cla-sb", brand: "MERCEDES", model: "CLA SHOOTING BREAK 250+", version: "BUSINESS LINE", category: "Break", energy: "Électrique", batteryKwh: 85, rangeWltp: 768, powerHp: 272, consumption: 14.0, co2: 0, fiscalHp: 5, envScore: 79, priceTtc: 56900, monthlyLld: 850, image: IMG("vehicles/mercedes-cla-sb.png") },
  { id: "mercedes-cla-250", brand: "MERCEDES", model: "CLA 250+", version: "BUSINESS EDITION EXECUTIVE", category: "Berline", energy: "Électrique", batteryKwh: 85, rangeWltp: 792, powerHp: 272, consumption: 13.8, co2: 0, fiscalHp: 5, envScore: 79, priceTtc: 58700, monthlyLld: 880, image: IMG("vehicles/mercedes-cla-250.png") },
  { id: "vw-id7-tourer", brand: "VW", model: "ID.7 TOURER", version: "77 kWh PRO LIFE MAX 286", category: "Break", energy: "Électrique", batteryKwh: 77, rangeWltp: 608, powerHp: 286, consumption: 16.4, co2: 0, fiscalHp: 7, envScore: 75, priceTtc: 60690, monthlyLld: 900, image: IMG("vehicles/vw-id7-tourer.png") },
  { id: "vw-id4", brand: "VW", model: "ID.4", version: "77 kWh PRO LIFE MAX 286", category: "SUV", energy: "Électrique", batteryKwh: 77, rangeWltp: 566, powerHp: 286, consumption: 16.2, co2: 0, fiscalHp: 7, envScore: 74, priceTtc: 46990, monthlyLld: 700, image: IMG("vehicles/vw-id4.png") },
  { id: "renault-scenic", brand: "RENAULT", model: "SCENIC", version: "TECHNO GRANDE AUTONOMIE", category: "SUV", energy: "Électrique", batteryKwh: 87, rangeWltp: 625, powerHp: 220, consumption: 16.3, co2: 0, fiscalHp: 5, envScore: 78, priceTtc: 46990, monthlyLld: 700, image: IMG("vehicles/renault-scenic.png") },
  { id: "hyundai-kona", brand: "HYUNDAI", model: "KONA", version: "65 kWh CREATIVE", category: "SUV", energy: "Électrique", batteryKwh: 65, rangeWltp: 514, powerHp: 218, consumption: 16.6, co2: 0, fiscalHp: 6, envScore: 72, priceTtc: 41250, monthlyLld: 600, image: IMG("vehicles/hyundai-kona.png") },
  { id: "cupra-born", brand: "CUPRA", model: "BORN", version: "V - Batterie XL", category: "Compacte", energy: "Électrique", batteryKwh: 77, rangeWltp: 514, powerHp: 231, consumption: 16.5, co2: 0, fiscalHp: 6, envScore: 73, priceTtc: 41250, monthlyLld: 600, image: IMG("vehicles/cupra-born.png") },
  { id: "skoda-enyaq-coupe", brand: "SKODA", model: "ENYAQ COUPE", version: "iV85 PLUS", category: "SUV Coupé", energy: "Électrique", batteryKwh: 82, rangeWltp: 590, powerHp: 286, consumption: 15.9, co2: 0, fiscalHp: 7, envScore: 75, priceTtc: 53050, monthlyLld: 780, image: IMG("vehicles/skoda-enyaq-coupe.png") },
  { id: "skoda-elroq", brand: "SKODA", model: "ELROQ", version: "iV85 PLUS", category: "SUV", energy: "Électrique", batteryKwh: 77, rangeWltp: 590, powerHp: 286, consumption: 15.5, co2: 0, fiscalHp: 7, envScore: 76, priceTtc: 53050, monthlyLld: 780, image: IMG("vehicles/skoda-elroq.png") },
  { id: "hyundai-inster", brand: "HYUNDAI", model: "INSTER", version: "49 kWh INTUITIVE 5 PLACES", category: "Citadine", energy: "Électrique", batteryKwh: 49, rangeWltp: 360, powerHp: 115, consumption: 15.0, co2: 0, fiscalHp: 4, envScore: 81, priceTtc: 28600, monthlyLld: 400, image: IMG("vehicles/hyundai-inster.png") },
  { id: "tesla-model-3", brand: "TESLA", model: "MODEL 3", version: "PROPULSION", category: "Berline", energy: "Électrique", batteryKwh: 60, rangeWltp: 513, powerHp: 283, consumption: 13.2, co2: 0, fiscalHp: 5, envScore: 80, priceTtc: 42990, monthlyLld: 650, image: IMG("vehicles/tesla-model-3.png") },
  { id: "hyundai-ioniq5", brand: "HYUNDAI", model: "IONIQ 5", version: "58 kWh INTUITIVE", category: "SUV", energy: "Électrique", batteryKwh: 58, rangeWltp: 400, powerHp: 170, consumption: 16.7, co2: 0, fiscalHp: 5, envScore: 73, priceTtc: 43700, monthlyLld: 680, image: IMG("vehicles/hyundai-ioniq5.png") },
  { id: "bmw-ix3", brand: "BMW", model: "iX3", version: "INSPIRING", category: "SUV", energy: "Électrique", batteryKwh: 80, rangeWltp: 461, powerHp: 286, consumption: 18.9, co2: 0, fiscalHp: 11, envScore: 65, priceTtc: 69950, monthlyLld: 1050, image: IMG("vehicles/bmw-ix3.png") },
  { id: "volvo-ex30", brand: "VOLVO", model: "EX30", version: "P5 LONG RANGE START", category: "SUV", energy: "Électrique", batteryKwh: 69, rangeWltp: 480, powerHp: 272, consumption: 16.7, co2: 0, fiscalHp: 5, envScore: 80, priceTtc: 43300, monthlyLld: 535, image: IMG("vehicles/volvo-ex30.png") },
  { id: "peugeot-3008-phev", brand: "PEUGEOT", model: "3008", version: "1.6 HYBRID 225 e-EAT8 GT Pack", category: "SUV", energy: "Hybride Rechargeable", batteryKwh: 12.4, rangeWltp: 40, powerHp: 225, consumption: 1.5, co2: 32, fiscalHp: 5, envScore: 60, priceTtc: 45000, monthlyLld: 650, image: IMG("vehicles/peugeot-3008-phev.png") },
  { id: "audi-q3", brand: "AUDI", model: "Q3 SPORTBACK", version: "35 TFSI 150 MHEV S Tron 7 BUSINESS LINE", category: "SUV", energy: "Mild Hybrid", batteryKwh: 0, rangeWltp: 0, powerHp: 150, consumption: 6.5, co2: 148, fiscalHp: 7, envScore: 35, priceTtc: 40500, monthlyLld: 600, image: IMG("vehicles/audi-q3.png") },
  { id: "kia-sportage", brand: "KIA", model: "SPORTAGE", version: "1.6 T-GDI 230 HEV AUTO GT-LINE PREMIUM", category: "SUV", energy: "Hybride", batteryKwh: 1.5, rangeWltp: 0, powerHp: 230, consumption: 5.8, co2: 132, fiscalHp: 8, envScore: 42, priceTtc: 35000, monthlyLld: 550, image: IMG("vehicles/kia-sportage.png") },
  { id: "renault-austral", brand: "RENAULT", model: "AUSTRAL", version: "TECHNO ESPRIT ALPINE MILD HYBRID 160", category: "SUV", energy: "Mild Hybrid", batteryKwh: 0, rangeWltp: 0, powerHp: 160, consumption: 6.2, co2: 142, fiscalHp: 7, envScore: 38, priceTtc: 40000, monthlyLld: 580, image: IMG("vehicles/renault-austral.png") },
  { id: "peugeot-308-sw", brand: "PEUGEOT", model: "308 SW", version: "PureTech 130 S&S EAT8 GT", category: "Break", energy: "Essence", batteryKwh: 0, rangeWltp: 0, powerHp: 130, consumption: 5.7, co2: 131, fiscalHp: 6, envScore: 40, priceTtc: 35000, monthlyLld: 500, image: IMG("vehicles/peugeot-308-sw.png") },
];

const ALFEN_IMG = IMG("chargers/alfen-eve-double.png");
const SCHNEIDER_IMG = IMG("chargers/schneider-evlink.png");
const HAGER_PARK_IMG = IMG("chargers/hager-witty-park.png");
const WALLBOX_IMG = IMG("chargers/wallbox-pulsar-max.png");
const V2C_IMG = IMG("chargers/v2c-trydan.png");
const HAGER_PLUS_IMG = IMG("chargers/hager-witty-plus.png");

// Devis détaillés type "Beev x BIG" — l'utilisateur peut ajuster site par site
const ALFEN_DEFAULT_LINE_ITEMS: LineItem[] = [
  { label: "Alfen Eve Double Pro-line Triphasé · 1×22 kW ou 2×11 kW", qty: 1, unitHt: 3300 },
  { label: "Pose & raccordement IRVE certifié", qty: 1, unitHt: 1450 },
  { label: "Câble HO7RNF 5G10 mm² (par mètre)", qty: 15, unitHt: 25 },
  { label: "Tableau divisionnaire & protections (différentiel A + disjoncteur 4P)", qty: 1, unitHt: 450 },
  { label: "Module de délestage Alfen ALB", qty: 1, unitHt: 120 },
  { label: "Modbus Alfen triphasé indirect", qty: 1, unitHt: 400 },
  { label: "Pied Alfen Double + dalle béton", qty: 1, unitHt: 380 },
];

// Catalogue 1 : SITE ENTREPRISE — Catalogue 2 : DOMICILE COLLABORATEUR (B2B2E)
export const DEFAULT_CHARGERS: Charger[] = [
  // ====== SITE ENTREPRISE ======
  {
    id: "alfen-eve-double-proline",
    brand: "Alfen", model: "Eve Double Pro-line Triphasé",
    powerKw: 22, type: "Borne double 2× Type 2 · 1×22 ou 2×11 kW",
    deployment: "site",
    priceHt: 3300, installPriceHt: 2825,
    features: ["Fabrication Pays-Bas", "OCPP 1.6/2.0 · MID · RFID", "IP54 / IK10 · -25°C/+55°C", "Garantie 3 ans (extension 6 ans)", "Délestage dynamique ALB"],
    image: ALFEN_IMG,
    defaultLineItems: ALFEN_DEFAULT_LINE_ITEMS,
  },
  {
    id: "schneider-evlink",
    brand: "Schneider", model: "EVlink Pro AC",
    powerKw: 22, type: "Type 2 triphasé · entreprise",
    deployment: "site",
    priceHt: 1390, installPriceHt: 1490,
    features: ["MID + RFID", "Supervision OCPP 1.6", "Boîtier renforcé IP54", "Pilotage flotte"],
    image: SCHNEIDER_IMG,
    defaultLineItems: [
      { label: "Schneider EVlink Pro AC 22 kW", qty: 1, unitHt: 1390 },
      { label: "Pose & raccordement IRVE certifié", qty: 1, unitHt: 1290 },
      { label: "Pied + dalle béton", qty: 1, unitHt: 350 },
      { label: "Câble HO7RNF 5G6 (par mètre)", qty: 10, unitHt: 18 },
      { label: "Tableau divisionnaire & protections", qty: 1, unitHt: 420 },
    ],
  },
  {
    id: "hager-witty-park",
    brand: "Hager", model: "Witty Park",
    powerKw: 22, type: "Type 2 triphasé · entreprise",
    deployment: "site",
    priceHt: 1190, installPriceHt: 1390,
    features: ["RFID badge", "Lecteur MID", "Pilotage à distance", "Développée en France"],
    image: HAGER_PARK_IMG,
    defaultLineItems: [
      { label: "Hager Witty Park 22 kW", qty: 1, unitHt: 1190 },
      { label: "Pose IRVE certifiée", qty: 1, unitHt: 1190 },
      { label: "Goulotte + raccordement", qty: 1, unitHt: 250 },
      { label: "Module supervision OCPP", qty: 1, unitHt: 290 },
    ],
  },
  {
    id: "wallbox-pulsar-max-pro",
    brand: "Wallbox", model: "Pulsar Max",
    powerKw: 22, type: "Type 2 triphasé · flotte",
    deployment: "site",
    priceHt: 999, installPriceHt: 1290,
    features: ["Wi-Fi, BT, Matter", "Délestage dynamique", "Compteur MID"],
    image: WALLBOX_IMG,
    defaultLineItems: [
      { label: "Wallbox Pulsar Max 22 kW", qty: 1, unitHt: 999 },
      { label: "Pose IRVE triphasée", qty: 1, unitHt: 1090 },
      { label: "Compteur MID + protections", qty: 1, unitHt: 350 },
    ],
  },

  // ====== DOMICILE COLLABORATEUR (B2B2E) — kit Beev × Seris ======
  {
    id: "v2c-trydan-pro-7",
    brand: "Beev Essentiel", model: "V2C Trydan Pro 7,4 kW",
    powerKw: 7.4, type: "Type 2 monophasé · domicile (0–10 m inclus)",
    deployment: "domicile",
    priceHt: 1349, installPriceHt: 0,
    features: ["Meilleur rapport qualité/prix", "Supervision & remboursements automatisés", "Garantie 4 ans", "App mobile incluse"],
    image: V2C_IMG,
    defaultLineItems: [
      { label: "V2C Trydan Pro 7,4 kW (matériel + forfait pose 0–10 m)", qty: 1, unitHt: 1349 },
    ],
  },
  {
    id: "v2c-trydan-pro-11",
    brand: "Beev Essentiel", model: "V2C Trydan Pro 11 kW",
    powerKw: 11, type: "Type 2 triphasé · domicile (0–10 m inclus)",
    deployment: "domicile",
    priceHt: 1699, installPriceHt: 0,
    features: ["Triphasé · recharge accélérée", "Supervision & remboursements automatisés", "Garantie 4 ans", "App mobile incluse"],
    image: V2C_IMG,
    defaultLineItems: [
      { label: "V2C Trydan Pro 11 kW (matériel + forfait pose 0–10 m)", qty: 1, unitHt: 1699 },
    ],
  },
  {
    id: "hager-witty-plus-7",
    brand: "Beev Pro Max", model: "Hager Witty Plus 7,4 kW",
    powerKw: 7.4, type: "Type 2 monophasé · domicile premium (0–10 m inclus)",
    deployment: "domicile",
    priceHt: 1529, installPriceHt: 0,
    features: ["Best seller domicile", "Développée en France", "Supervision & remboursements automatisés", "Garantie 2 ans", "App mobile incluse"],
    image: HAGER_PLUS_IMG,
    defaultLineItems: [
      { label: "Hager Witty Plus 7,4 kW (matériel + forfait pose 0–10 m)", qty: 1, unitHt: 1529 },
    ],
  },
  {
    id: "hager-witty-plus-11",
    brand: "Beev Pro Max", model: "Hager Witty Plus 11 kW",
    powerKw: 11, type: "Type 2 triphasé · domicile premium (0–10 m inclus)",
    deployment: "domicile",
    priceHt: 1799, installPriceHt: 0,
    features: ["Triphasé premium", "Développée en France", "Supervision & remboursements automatisés", "Garantie 2 ans", "App mobile incluse"],
    image: HAGER_PLUS_IMG,
    defaultLineItems: [
      { label: "Hager Witty Plus 11 kW (matériel + forfait pose 0–10 m)", qty: 1, unitHt: 1799 },
    ],
  },
];

// Options domicile fréquentes (catalogue Beev × Seris) — saisie rapide
export const HOME_OPTIONS: LineItem[] = [
  { label: "Câble 5 m supplémentaire (monophasé)", qty: 1, unitHt: 75 },
  { label: "Câble 5 m supplémentaire (triphasé)", qty: 1, unitHt: 139 },
  { label: "Tableau divisionnaire supplémentaire", qty: 1, unitHt: 75 },
  { label: "Mise à la terre", qty: 1, unitHt: 160 },
  { label: "Tranchée (terre) 5 m", qty: 1, unitHt: 150 },
  { label: "Tranchée (terre) 10 m", qty: 1, unitHt: 300 },
  { label: "Dalle béton", qty: 1, unitHt: 250 },
  { label: "Pied de borne", qty: 1, unitHt: 350 },
];
