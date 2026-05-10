export type Vehicle = {
  id: string;
  brand: string;
  model: string;
  version: string;
  category: string;
  batteryKwh: number;
  rangeWltp: number;
  powerHp: number;
  consumption: number; // kWh/100km
  priceTtc: number;
  monthlyLld: number; // 36 mois indicatif
  image: string;
  services?: string[];
};

export const VEHICLE_SERVICES = [
  "Livraison à domicile",
  "Carte carburant / recharge",
  "Assurance tous risques",
  "Entretien & révisions",
  "Pneumatiques",
  "Véhicule de remplacement",
  "Assistance 24/7",
  "Gestion administrative",
  "Carte grise incluse",
  "Malus écologique pris en charge",
  "Reprise du véhicule actuel",
  "Borne de recharge à domicile",
  "Badge de recharge multi-réseaux",
  "Formation éco-conduite",
  "Télématique & reporting flotte",
] as const;

export type Charger = {
  id: string;
  brand: string;
  model: string;
  powerKw: number;
  type: string;
  priceHt: number;
  installPriceHt: number;
  features: string[];
  image: string;
};

// Images : Wikimedia Commons (libres de droits, CORS activé pour génération PDF).
// Tu peux remplacer chaque URL par une image officielle constructeur depuis l'éditeur.
const WM = (path: string) => `https://upload.wikimedia.org/wikipedia/commons/${path}`;

export const DEFAULT_VEHICLES: Vehicle[] = [
  {
    id: "tesla-model-3",
    brand: "Tesla",
    model: "Model 3",
    version: "Propulsion",
    category: "Berline",
    batteryKwh: 60,
    rangeWltp: 513,
    powerHp: 283,
    consumption: 13.2,
    priceTtc: 39990,
    monthlyLld: 469,
    image: WM("a/ab/Tesla_Model_3_%282023%29_Autofr%C3%BChling_Ulm_IMG_9282.jpg"),
  },
  {
    id: "tesla-model-y",
    brand: "Tesla",
    model: "Model Y",
    version: "Propulsion",
    category: "SUV",
    batteryKwh: 60,
    rangeWltp: 455,
    powerHp: 295,
    consumption: 14.9,
    priceTtc: 44990,
    monthlyLld: 529,
    image: WM("b/bd/2022_Tesla_Model_Y_Long_Range_AWD_Front.jpg"),
  },
  {
    id: "renault-megane-etech",
    brand: "Renault",
    model: "Megane E-Tech",
    version: "EV60 220ch Techno",
    category: "Compacte",
    batteryKwh: 60,
    rangeWltp: 470,
    powerHp: 218,
    consumption: 16.1,
    priceTtc: 38000,
    monthlyLld: 399,
    image: WM("4/42/Renault_M%C3%A9gane_E-Tech_IMG_4064.jpg"),
  },
  {
    id: "renault-scenic-etech",
    brand: "Renault",
    model: "Scenic E-Tech",
    version: "Long Range Techno",
    category: "SUV",
    batteryKwh: 87,
    rangeWltp: 625,
    powerHp: 220,
    consumption: 16.3,
    priceTtc: 44900,
    monthlyLld: 489,
    image: WM("4/4f/Renault_Sc%C3%A9nic_E-Tech_IMG_9977.jpg"),
  },
  {
    id: "peugeot-e308",
    brand: "Peugeot",
    model: "e-308",
    version: "GT 156ch",
    category: "Compacte",
    batteryKwh: 54,
    rangeWltp: 410,
    powerHp: 156,
    consumption: 15.3,
    priceTtc: 41600,
    monthlyLld: 449,
    image: WM("9/99/Peugeot_e-308_IMG_9970.jpg"),
  },
  {
    id: "peugeot-e3008",
    brand: "Peugeot",
    model: "e-3008",
    version: "GT 210ch",
    category: "SUV",
    batteryKwh: 73,
    rangeWltp: 525,
    powerHp: 210,
    consumption: 16.5,
    priceTtc: 49990,
    monthlyLld: 569,
    image: WM("e/ed/Peugeot_e-3008_Automesse_Ludwigsburg_2024_IMG_1537.jpg"),
  },
  {
    id: "bmw-i4",
    brand: "BMW",
    model: "i4",
    version: "eDrive40 M Sport",
    category: "Berline",
    batteryKwh: 83.9,
    rangeWltp: 590,
    powerHp: 340,
    consumption: 16.1,
    priceTtc: 60500,
    monthlyLld: 689,
    image: WM("a/ad/BMW_i4_IMG_6695.jpg"),
  },
  {
    id: "bmw-ix1",
    brand: "BMW",
    model: "iX1",
    version: "xDrive30 M Sport",
    category: "SUV",
    batteryKwh: 64.7,
    rangeWltp: 440,
    powerHp: 313,
    consumption: 17.3,
    priceTtc: 55950,
    monthlyLld: 649,
    image: WM("6/65/2022_BMW_X1_sDrive18d_M_Sport_MHEV_Automatic_2.0.jpg"),
  },
  {
    id: "audi-q4-etron",
    brand: "Audi",
    model: "Q4 e-tron",
    version: "45 286ch",
    category: "SUV",
    batteryKwh: 82,
    rangeWltp: 533,
    powerHp: 286,
    consumption: 16.6,
    priceTtc: 56700,
    monthlyLld: 619,
    image: WM("0/05/2021_Audi_Q4_e-tron_Sport_35.jpg"),
  },
  {
    id: "vw-id4",
    brand: "Volkswagen",
    model: "ID.4",
    version: "Pro 286ch",
    category: "SUV",
    batteryKwh: 77,
    rangeWltp: 544,
    powerHp: 286,
    consumption: 16.2,
    priceTtc: 49990,
    monthlyLld: 549,
    image: WM("5/55/2025_Volkswagen_ID4_Pro_Redspot_front.jpg"),
  },
  {
    id: "kia-ev6",
    brand: "Kia",
    model: "EV6",
    version: "Air 229ch",
    category: "SUV",
    batteryKwh: 77.4,
    rangeWltp: 528,
    powerHp: 229,
    consumption: 16.5,
    priceTtc: 47990,
    monthlyLld: 529,
    image: WM("d/d9/2021_Kia_EV6_GT-Line_S.jpg"),
  },
  {
    id: "hyundai-ioniq5",
    brand: "Hyundai",
    model: "Ioniq 5",
    version: "Intuitive 229ch",
    category: "SUV",
    batteryKwh: 77.4,
    rangeWltp: 507,
    powerHp: 229,
    consumption: 17.7,
    priceTtc: 49900,
    monthlyLld: 559,
    image: WM("8/85/Hyundai_Ioniq_5_AWD_Techniq-Paket_%E2%80%93_f_31122024.jpg"),
  },
];

const CHARGER_IMG = WM("5/58/AmpCharge_EV_charging_station_at_Altona_North%2C_Victoria.jpg");
const SCHNEIDER_IMG = WM("9/94/Schneider_Electric_EVLink_Pro_AC_Metal_used_for_a_Coles_EV_Charging_Station.jpg");

export const DEFAULT_CHARGERS: Charger[] = [
  {
    id: "wallbox-pulsar-plus",
    brand: "Wallbox",
    model: "Pulsar Plus",
    powerKw: 7.4,
    type: "Type 2 monophasé",
    priceHt: 749,
    installPriceHt: 890,
    features: ["Wi-Fi & Bluetooth", "Pilotage app myWallbox", "Compact"],
    image: CHARGER_IMG,
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
    image: CHARGER_IMG,
  },
  {
    id: "schneider-evlink",
    brand: "Schneider",
    model: "EVlink Pro AC",
    powerKw: 22,
    type: "Type 2 triphasé",
    priceHt: 1390,
    installPriceHt: 1490,
    features: ["MID + RFID", "Supervision OCPP 1.6", "Boîtier renforcé"],
    image: SCHNEIDER_IMG,
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
    image: CHARGER_IMG,
  },
  {
    id: "legrand-green-up",
    brand: "Legrand",
    model: "Green'up Premium",
    powerKw: 7.4,
    type: "Type 2 monophasé",
    priceHt: 690,
    installPriceHt: 790,
    features: ["Plug & Play", "Sortie câble fixe", "Idéal collaborateur"],
    image: CHARGER_IMG,
  },
  {
    id: "circontrol-erax",
    brand: "Circontrol",
    model: "eHome Link",
    powerKw: 22,
    type: "Type 2 triphasé",
    priceHt: 1090,
    installPriceHt: 1290,
    features: ["OCPP 1.6", "Délestage", "Compteur intégré"],
    image: CHARGER_IMG,
  },
];
