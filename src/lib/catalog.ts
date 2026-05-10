// Catalogue Beev synchronisé avec le calculateur TCO 2026
// https://beev-tco-2026.lovable.app/

export type Energy = "Électrique" | "Hybride Rechargeable" | "Hybride" | "Mild Hybrid" | "Essence" | "Diesel";

export type Vehicle = {
  id: string;
  brand: string;
  model: string;
  version: string;
  category: string;
  energy: Energy;
  batteryKwh: number;            // 0 si thermique pur
  rangeWltp: number;             // km WLTP (ou autonomie élec pour PHEV)
  powerHp: number;
  consumption: number;           // kWh/100km (élec) ou L/100km (thermique)
  co2: number;                   // g/km
  fiscalHp: number;              // CV fiscaux
  envScore?: number;             // score ADEME
  priceTtc: number;              // prix catalogue TTC
  monthlyLld: number;            // loyer LLD HT mensuel
  image: string;
  services?: string[];
};

export type LineItem = { label: string; qty: number; unitHt: number };

export const VEHICLE_SERVICES = [
  "Maintenance tous réseaux",
  "Assistance 24/24",
  "Gestion des pertes totales",
  "Certificat d'immatriculation inclus",
  "Certificat Qualité de l'Air",
  "Énergie à la livraison",
  "Pneumatiques",
  "Véhicule de remplacement",
  "Carte carburant / badge recharge",
  "Assurance tous risques",
  "Reprise du véhicule actuel",
  "Borne à domicile collaborateur",
  "Formation éco-conduite",
  "Télématique & reporting flotte",
  "Gestion administrative",
] as const;

export type Charger = {
  id: string;
  brand: string;
  model: string;
  powerKw: number;
  type: string;
  priceHt: number;             // prix matériel HT
  installPriceHt: number;      // installation IRVE forfaitaire HT (indicatif)
  features: string[];
  image: string;
  defaultLineItems?: LineItem[]; // devis détaillé type "Beev x BIG"
};

const WM = (p: string) => `https://upload.wikimedia.org/wikipedia/commons/${p}`;

export const DEFAULT_VEHICLES: Vehicle[] = [
  { id: "tesla-model-y", brand: "TESLA", model: "MODEL Y", version: "PREMIUM PROPULSION", category: "SUV", energy: "Électrique", batteryKwh: 75, rangeWltp: 622, powerHp: 295, consumption: 14.9, co2: 0, fiscalHp: 6, envScore: 80, priceTtc: 46990, monthlyLld: 700, image: WM("b/bd/2022_Tesla_Model_Y_Long_Range_AWD_Front.jpg") },
  { id: "mercedes-cla-sb", brand: "MERCEDES", model: "CLA SHOOTING BREAK 250+", version: "BUSINESS LINE", category: "Break", energy: "Électrique", batteryKwh: 85, rangeWltp: 768, powerHp: 272, consumption: 14.0, co2: 0, fiscalHp: 5, envScore: 79, priceTtc: 56900, monthlyLld: 850, image: WM("3/3a/Mercedes-Benz_CLA_250e_Shooting_Brake_AMG_Line_X118.jpg") },
  { id: "mercedes-cla-250", brand: "MERCEDES", model: "CLA 250+", version: "BUSINESS EDITION EXECUTIVE", category: "Berline", energy: "Électrique", batteryKwh: 85, rangeWltp: 792, powerHp: 272, consumption: 13.8, co2: 0, fiscalHp: 5, envScore: 79, priceTtc: 58700, monthlyLld: 880, image: WM("8/8e/Mercedes-Benz_CLA_250%2B_C118_IAA_2023_1X7A0107.jpg") },
  { id: "vw-id7-tourer", brand: "VW", model: "ID.7 TOURER", version: "77 kWh PRO LIFE MAX 286", category: "Break", energy: "Électrique", batteryKwh: 77, rangeWltp: 608, powerHp: 286, consumption: 16.4, co2: 0, fiscalHp: 7, envScore: 75, priceTtc: 60690, monthlyLld: 900, image: WM("9/96/VW_ID.7_Tourer_Pro_S_IAA_2023_1X7A0156.jpg") },
  { id: "vw-id4", brand: "VW", model: "ID.4", version: "77 kWh PRO LIFE MAX 286", category: "SUV", energy: "Électrique", batteryKwh: 77, rangeWltp: 566, powerHp: 286, consumption: 16.2, co2: 0, fiscalHp: 7, envScore: 74, priceTtc: 46990, monthlyLld: 700, image: WM("5/55/2025_Volkswagen_ID4_Pro_Redspot_front.jpg") },
  { id: "renault-scenic", brand: "RENAULT", model: "SCENIC", version: "TECHNO GRANDE AUTONOMIE", category: "SUV", energy: "Électrique", batteryKwh: 87, rangeWltp: 625, powerHp: 220, consumption: 16.3, co2: 0, fiscalHp: 5, envScore: 78, priceTtc: 46990, monthlyLld: 700, image: WM("4/4f/Renault_Sc%C3%A9nic_E-Tech_IMG_9977.jpg") },
  { id: "hyundai-kona", brand: "HYUNDAI", model: "KONA", version: "65 kWh CREATIVE", category: "SUV", energy: "Électrique", batteryKwh: 65, rangeWltp: 514, powerHp: 218, consumption: 16.6, co2: 0, fiscalHp: 6, envScore: 72, priceTtc: 41250, monthlyLld: 600, image: WM("d/d6/Hyundai_Kona_Electric_2024_IMG_8889.jpg") },
  { id: "cupra-born", brand: "CUPRA", model: "BORN", version: "V - Batterie XL", category: "Compacte", energy: "Électrique", batteryKwh: 77, rangeWltp: 514, powerHp: 231, consumption: 16.5, co2: 0, fiscalHp: 6, envScore: 73, priceTtc: 41250, monthlyLld: 600, image: WM("6/64/Cupra_Born_IMG_4124.jpg") },
  { id: "skoda-enyaq-coupe", brand: "SKODA", model: "ENYAQ COUPE", version: "iV85 PLUS", category: "SUV Coupé", energy: "Électrique", batteryKwh: 82, rangeWltp: 590, powerHp: 286, consumption: 15.9, co2: 0, fiscalHp: 7, envScore: 75, priceTtc: 53050, monthlyLld: 780, image: WM("4/4d/Skoda_Enyaq_Coupe_IV_RS_IAA_2023_1X7A0079.jpg") },
  { id: "skoda-elroq", brand: "SKODA", model: "ELROQ", version: "iV85 PLUS", category: "SUV", energy: "Électrique", batteryKwh: 77, rangeWltp: 590, powerHp: 286, consumption: 15.5, co2: 0, fiscalHp: 7, envScore: 76, priceTtc: 53050, monthlyLld: 780, image: WM("8/89/Skoda_Elroq_85_Sportline_IMG_8311.jpg") },
  { id: "hyundai-inster", brand: "HYUNDAI", model: "INSTER", version: "49 kWh INTUITIVE 5 PLACES", category: "Citadine", energy: "Électrique", batteryKwh: 49, rangeWltp: 360, powerHp: 115, consumption: 15.0, co2: 0, fiscalHp: 4, envScore: 81, priceTtc: 28600, monthlyLld: 400, image: WM("8/82/Hyundai_Inster_IAA_2024_1X7A0021.jpg") },
  { id: "tesla-model-3", brand: "TESLA", model: "MODEL 3", version: "PROPULSION", category: "Berline", energy: "Électrique", batteryKwh: 60, rangeWltp: 513, powerHp: 283, consumption: 13.2, co2: 0, fiscalHp: 5, envScore: 80, priceTtc: 42990, monthlyLld: 650, image: WM("a/ab/Tesla_Model_3_%282023%29_Autofr%C3%BChling_Ulm_IMG_9282.jpg") },
  { id: "hyundai-ioniq5", brand: "HYUNDAI", model: "IONIQ 5", version: "58 kWh INTUITIVE", category: "SUV", energy: "Électrique", batteryKwh: 58, rangeWltp: 400, powerHp: 170, consumption: 16.7, co2: 0, fiscalHp: 5, envScore: 73, priceTtc: 43700, monthlyLld: 680, image: WM("8/85/Hyundai_Ioniq_5_AWD_Techniq-Paket_%E2%80%93_f_31122024.jpg") },
  { id: "bmw-ix3", brand: "BMW", model: "iX3", version: "INSPIRING", category: "SUV", energy: "Électrique", batteryKwh: 80, rangeWltp: 461, powerHp: 286, consumption: 18.9, co2: 0, fiscalHp: 11, envScore: 65, priceTtc: 69950, monthlyLld: 1050, image: WM("a/aa/BMW_iX3_IMG_4068.jpg") },
  { id: "volvo-ex30", brand: "VOLVO", model: "EX30", version: "P5 LONG RANGE START", category: "SUV", energy: "Électrique", batteryKwh: 69, rangeWltp: 480, powerHp: 272, consumption: 16.7, co2: 0, fiscalHp: 5, envScore: 80, priceTtc: 43300, monthlyLld: 535, image: WM("4/40/2024_Volvo_EX30_Twin_Motor_Performance_Ultra%2C_front_left.jpg") },
  { id: "peugeot-3008-phev", brand: "PEUGEOT", model: "3008", version: "1.6 HYBRID 225 e-EAT8 GT Pack", category: "SUV", energy: "Hybride Rechargeable", batteryKwh: 12.4, rangeWltp: 40, powerHp: 225, consumption: 1.5, co2: 32, fiscalHp: 5, envScore: 60, priceTtc: 45000, monthlyLld: 650, image: WM("5/5e/Peugeot_3008_GT_Hybrid_225_e-EAT8_IMG_9921.jpg") },
  { id: "audi-q3", brand: "AUDI", model: "Q3 SPORTBACK", version: "35 TFSI 150 MHEV S Tron 7 BUSINESS LINE", category: "SUV", energy: "Mild Hybrid", batteryKwh: 0, rangeWltp: 0, powerHp: 150, consumption: 6.5, co2: 148, fiscalHp: 7, envScore: 35, priceTtc: 40500, monthlyLld: 600, image: WM("5/5b/Audi_Q3_Sportback_IMG_9914.jpg") },
  { id: "kia-sportage", brand: "KIA", model: "SPORTAGE", version: "1.6 T-GDI 230 HEV AUTO GT-LINE PREMIUM", category: "SUV", energy: "Hybride", batteryKwh: 1.5, rangeWltp: 0, powerHp: 230, consumption: 5.8, co2: 132, fiscalHp: 8, envScore: 42, priceTtc: 35000, monthlyLld: 550, image: WM("7/77/Kia_Sportage_HEV_GT-Line_IMG_9907.jpg") },
  { id: "renault-austral", brand: "RENAULT", model: "AUSTRAL", version: "TECHNO ESPRIT ALPINE MILD HYBRID 160", category: "SUV", energy: "Mild Hybrid", batteryKwh: 0, rangeWltp: 0, powerHp: 160, consumption: 6.2, co2: 142, fiscalHp: 7, envScore: 38, priceTtc: 40000, monthlyLld: 580, image: WM("7/76/Renault_Austral_E-Tech_Hybrid_Iconic_IMG_8847.jpg") },
  { id: "peugeot-308-sw", brand: "PEUGEOT", model: "308 SW", version: "PureTech 130 S&S EAT8 GT", category: "Break", energy: "Essence", batteryKwh: 0, rangeWltp: 0, powerHp: 130, consumption: 5.7, co2: 131, fiscalHp: 6, envScore: 40, priceTtc: 35000, monthlyLld: 500, image: WM("d/d2/Peugeot_308_SW_GT_IMG_4011.jpg") },
];

const ALFEN_IMG = WM("5/58/AmpCharge_EV_charging_station_at_Altona_North%2C_Victoria.jpg");
const WALLBOX_IMG = WM("5/58/AmpCharge_EV_charging_station_at_Altona_North%2C_Victoria.jpg");

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

export const DEFAULT_CHARGERS: Charger[] = [
  {
    id: "alfen-eve-double-proline",
    brand: "Alfen",
    model: "Eve Double Pro-line Triphasé",
    powerKw: 22,
    type: "Borne double 2× Type 2 · 1×22 ou 2×11 kW",
    priceHt: 3300,
    installPriceHt: 2825,
    features: ["Fabrication Pays-Bas", "OCPP 1.6/2.0 · MID · RFID", "IP54 / IK10 · -25°C/+55°C", "Garantie 3 ans (extension 6 ans)", "Délestage dynamique ALB"],
    image: ALFEN_IMG,
    defaultLineItems: ALFEN_DEFAULT_LINE_ITEMS,
  },
  {
    id: "wallbox-pulsar-plus",
    brand: "Wallbox",
    model: "Pulsar Plus",
    powerKw: 7.4,
    type: "Type 2 monophasé · domicile collaborateur",
    priceHt: 749,
    installPriceHt: 890,
    features: ["Wi-Fi & Bluetooth", "Pilotage app myWallbox", "Compact"],
    image: WALLBOX_IMG,
    defaultLineItems: [
      { label: "Wallbox Pulsar Plus 7,4 kW", qty: 1, unitHt: 749 },
      { label: "Pose résidentielle IRVE (forfait < 10m)", qty: 1, unitHt: 690 },
      { label: "Protection différentielle 30 mA type A", qty: 1, unitHt: 200 },
    ],
  },
  {
    id: "wallbox-pulsar-max",
    brand: "Wallbox",
    model: "Pulsar Max",
    powerKw: 22,
    type: "Type 2 triphasé",
    priceHt: 999,
    installPriceHt: 1290,
    features: ["Wi-Fi, BT, Matter", "Délestage dynamique", "MID compteur"],
    image: WALLBOX_IMG,
    defaultLineItems: [
      { label: "Wallbox Pulsar Max 22 kW", qty: 1, unitHt: 999 },
      { label: "Pose IRVE triphasée", qty: 1, unitHt: 1090 },
      { label: "Compteur MID + protections", qty: 1, unitHt: 350 },
    ],
  },
  {
    id: "schneider-evlink",
    brand: "Schneider",
    model: "EVlink Pro AC",
    powerKw: 22,
    type: "Type 2 triphasé · entreprise",
    priceHt: 1390,
    installPriceHt: 1490,
    features: ["MID + RFID", "Supervision OCPP 1.6", "Boîtier renforcé"],
    image: ALFEN_IMG,
    defaultLineItems: [
      { label: "Schneider EVlink Pro AC 22 kW", qty: 1, unitHt: 1390 },
      { label: "Pose IRVE certifiée", qty: 1, unitHt: 1290 },
      { label: "Pied + dalle", qty: 1, unitHt: 350 },
    ],
  },
  {
    id: "hager-witty",
    brand: "Hager",
    model: "Witty Park",
    powerKw: 22,
    type: "Type 2 triphasé",
    priceHt: 1190,
    installPriceHt: 1390,
    features: ["RFID badge", "Lecteur MID", "Pilotage à distance"],
    image: ALFEN_IMG,
    defaultLineItems: [
      { label: "Hager Witty Park 22 kW", qty: 1, unitHt: 1190 },
      { label: "Pose IRVE", qty: 1, unitHt: 1190 },
      { label: "Goulotte + raccordement", qty: 1, unitHt: 250 },
    ],
  },
];
