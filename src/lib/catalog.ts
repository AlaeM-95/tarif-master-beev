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

export type LineItem = { label: string; qty: number; unitHt: number };

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
  installPriceHt: number;
  features: string[];
  image: string;
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
    image: "https://upload.wikimedia.org/wikipedia/commons/f/f8/Question_mark_alternate.svg",
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
    image: "https://upload.wikimedia.org/wikipedia/commons/f/f8/Question_mark_alternate.svg",
    defaultLineItems: home
      ? [{ label: "Borne + forfait pose 0–10 m", qty: 1, unitHt: 1500 }]
      : [
          { label: "Borne", qty: 1, unitHt: 1500 },
          { label: "Pose & raccordement IRVE certifié", qty: 1, unitHt: 1200 },
        ],
    custom: true,
  };
}

const WM = (p: string) => `https://upload.wikimedia.org/wikipedia/commons/${p}`;

export const DEFAULT_VEHICLES: Vehicle[] = [
  { id: "tesla-model-y", brand: "TESLA", model: "MODEL Y", version: "PREMIUM PROPULSION", category: "SUV", energy: "Électrique", batteryKwh: 75, rangeWltp: 622, powerHp: 295, consumption: 14.9, co2: 0, fiscalHp: 6, envScore: 80, priceTtc: 46990, monthlyLld: 700, image: ("https://static-assets.tesla.com/configurator/compositor?context=design_studio_2&options=$MTY82,$PPSW,$WY19P,$IPB11&view=FRONT34&model=my&size=1920&bkba_opt=2&crop=0,0,0,0&overlay=0&") },
  { id: "mercedes-cla-sb", brand: "MERCEDES", model: "CLA SHOOTING BREAK 250+", version: "BUSINESS LINE", category: "Break", energy: "Électrique", batteryKwh: 85, rangeWltp: 768, powerHp: 272, consumption: 14.0, co2: 0, fiscalHp: 5, envScore: 79, priceTtc: 56900, monthlyLld: 850, image: ("https://media.oneweb.mercedes-benz.com/images/dynamic/europe/FR/174644/807/iris.png?q=COSY-EU-100-1713d0VXqaEFng9jfZobxEnlqHI5QqqrQCPPnU2GOpzxm7skt0uBI5TB2rQm6ApnksS5uoSu4C3MtGIzNTcRT7j6bWkKVSIdsvqtQ0gLRckM%25axXmFQH1JhKh8wO%25vUiZbRAy4FIxFDg9Q1XyPDkweTeWmpVQsdhu1XUf%253GTGEyN0G0lYjBHB2rGwyApn0DX5uoB70C3MAqCzNTFgb7j69WIKVSDACvqtWPtLRcuUraxX3lhH1JN4h8wOjKUiZbVvi4FIqLrg9QRPzPDkxeoeWm1losdhw2CUf%25ZplGEyFuO0lY9v%25B2r%25C8Apnygc5uoVPaC3MqeCzNTRPe7vzAIkbEBsdh2vLU0s6QEGBUkdc0lYF50B2r19BApnwDn5uoZPXC3MFeCzNT9YA7j6DreKVSfQC3PS9kzN5zdm7jCyjhKVzYt%25vq7JdyLRK4WYax2FurH18Hdn8wiAfoiZ45YM4FgCPTg9Px26PKNCZnX2f3SNKE4ZdCDkSW9wUwopoL24PvEa2zq7dXrCgQ&cp=8mhxDZy3qhkDFW2gqQWvpQ&imgt=P27&bkgnd=9&pov=BE040&uni=m&cp=8mhxDZy3qhkDFW2gqQWvpQ&width=610&crop=") },
  { id: "mercedes-cla-250", brand: "MERCEDES", model: "CLA 250+", version: "BUSINESS EDITION EXECUTIVE", category: "Berline", energy: "Électrique", batteryKwh: 85, rangeWltp: 792, powerHp: 272, consumption: 13.8, co2: 0, fiscalHp: 5, envScore: 79, priceTtc: 58700, monthlyLld: 880, image: ("https://media.oneweb.mercedes-benz.com/images/dynamic/europe/FR/174344/807/iris.png?q=COSY-EU-100-1713d0VXqNEFng9jfZobxEnlqHI5QqqrQCPPnU2GOpzxm7skt0uBI5TB2rQm6ApnksS5uoSu4C3MtGIzNTcRT7j6bWkKVSIdsvqtQ0gLRckM%25axXmFQH1JhKh8wO%25vUiZbRAy4FIxFDg9Q1XyPDkweTeWmpVQsdhu1XUf%253GTGEyN0G0lYjBHB2rGwyApn0DX5uoB70C3MAqCzNTFgb7j69WIKVSDACvqtWPtLRcuUraxX3lhH1JN4h8wOjK8iZbVvY4FIqgCg9QRPnPDkxEAeWm1lfsdhw2XUf%25Z7mGEymAa0lYhiSB2rN4vApnjgA5uoV4gC750OIJdGPDkE7KeUPMbdsGeIDSUf%25wBUGEyRZG0lYxFYB2r14tApnwgA5uoZ%250C3MFygzNTWbAp4TZI5uBmuQC3AhTkzN5t9m7jCHFhKVf1l%25vqLv9yLRaGDYaxH0hrH18Bin8wiVfoiCpBxySfD2MpCWHv9BZbMFwRPRYEY7fHizWKfAN59S%25B8O&cp=8mhxDZy3qhkDFW2gqQWvpQ&imgt=P27&bkgnd=9&pov=BE040&uni=m&cp=8mhxDZy3qhkDFW2gqQWvpQ&width=610&crop=") },
  { id: "vw-id7-tourer", brand: "VW", model: "ID.7 TOURER", version: "77 kWh PRO LIFE MAX 286", category: "Break", energy: "Électrique", batteryKwh: 77, rangeWltp: 608, powerHp: 286, consumption: 16.4, co2: 0, fiscalHp: 7, envScore: 75, priceTtc: 60690, monthlyLld: 900, image: ("https://media.vw.mediaservice.avp.tech/media/fast/v3_02TW2hcVRSG9_n2ZaKVptZKhApSTIZQO-bMycykQYaatGoDiURaE0RxsmfOnkszZ2Z6MjOpD9WIeAMvebHeQEpRWrRSLCJaKtXnPkhBBBHFF1-UCqWgFhU96VPhg8UPay0WP_86fVnoXix4fPr01aG_zMDBnxHiSEcI-ZLQ3V5cbntCiHlubkS25sYOdVxtaHt_NWP7nbFGOBb4wUSmEU5ksrlyplLpB4MilfQLKURqLSlfbQixeXMvbnZsbKN7Q1fu1W4drWYng93VMGfH7eSkP5F3uaDql_2wUKkmm6qVasEVwrK_e2sy_aGQttkUg2EhaldtMF6N261upyJGXJjPHY78jg02KLvrRBuEuYTVfD5BqI0bxeBwN27Uai4uRXGp3smivkNeRDyKt4z3Mt5bkIYz8CNchivIZ5CvIf9DfYE6hzqPHkbn0RPoWfRj6Lcx75K6m9Q9iBG815GbkFuQl7hzDfURej_eH8g9qCcxo5hFzJuIrYgs5ibMg_AN8gnkEvo4RmJ2YUqYo3ifoR5AX0L_iXkRcx7RBAUrcApzC2YHZhYW4Rg7BOYI3jryGvon9G_oKxiNuQPzNOYkYhZZQR5D_oC8irqdsW2o-1Cn0KPoKbRD19G_YPIU_sYcQDjUOnoX-kv4FvkC6mPEcbzfEecQXyMSl65hzpAaQgzgPYf3Ht5F1AfoEcwSZg2xB_EIXhXvLN7nMABzsASH4BPkduQy8h3k-yiBGkY9jFpCPYs6i74fHaDX4Xl2_ot8BXkC-StqBp3lrguYfXAUvkcewNsGJ-EC6lW0Rf-DyeAlnnwqNg1PzU3PzM48tP9g9kYR3CjGk5C94Vr9RhKsyLW6xYXF0t69C0Fput0M06uNsFsvJnn103XXqNW7xcmCn7bNTt0Wu3HPpSs2crEtTi3MB_tKU6Wg5PtB2raSh-k22q2VYjpqh64Zu35jJdHFuflsutZsl20ztqvL7qkVd7jnWhVXDNKR69rQdm3fxddbg9tksvV_N4gybaMDAAA.webp?width=864") },
  { id: "vw-id4", brand: "VW", model: "ID.4", version: "77 kWh PRO LIFE MAX 286", category: "SUV", energy: "Électrique", batteryKwh: 77, rangeWltp: 566, powerHp: 286, consumption: 16.2, co2: 0, fiscalHp: 7, envScore: 74, priceTtc: 46990, monthlyLld: 700, image: ("https://media.vw.mediaservice.avp.tech/media/fast/v3_02TW2hcVRSG9_n2ZaKVRmslQgUpJoeijZlzMpl0kKEmrdpAIpHWBFGc7Jmz59LMmZmezEzqQzUiFgUvebHeQCpUWrRSLCJaKtXnPkhBBBHFF1-UCqXgXfSkT4UPFj_8a7FY_Ov0ZaF7ieDx6dNXh_4wAwd-RIjDHSHkC0J3e0m57Qkh5rmxEduaGzvYcbWhbf3VUdvvjDWisTAbTo42osnRIFcerVT64aDIpH4hhcispeWLDSE2b-4lzY5NbHxv5Mq92i07wqzNVXa5sJC3obXlwBaiXFCuliedy43nbFDYVc1Xc_nylrT7fSFtsykGo3zcrtpwvJq0W91ORYy4KMwdirMdG25QdteIN4hyKasTEylCbewoBoe7SaNWc0kpTkr1ToD6BnkR8SjeMt6LeG-AD2fge7gMV5DPIF9B_of6DHUOdR49jJ5AT6Jn0Y-h38S8TeYuMvcgRvBeRW5C3oy8xB1rqA_Q-_B-Q-5GPYnxMYuY1xFbEAHmBsyD8BXyCeQS-jhGYnZiSpgjeJ-gHkBfQv-OOYo5j2iCghU4hbkJsx0zC4twjO0CcxhvHfkX-gf0L-grGI25HfM05iRiFllBHkN-h7yKuo2xraj7UKfQO9BTaIeuo3_CTJD_G7Mf4VDr6J3oz-Fr5FHUh4jjeL8iziG-RKRX-hNzhswQYgDvObx38C6i3kOPYJYwa4jdiEfwqnhn8T6FAZiDJTgIHyG3IZeRbyFPoARqGPUwagn1LOos-n50iF6H57n7X-RLyHeRP6Nm0AF3XsDshSPwLXI_3lY4CRdQL6Mt-h_MKF56k4_FpuGpuemZ2ZmH9h0Irhfh9WI8DdlrrtVvpMGKXatbXFgs7dmzEJam283IX21E3XoxKIRZv-4atXq3WMhnfdvs1G2xm_ScX7GxS2xxamE-3FuaKoWlbDb0bSt9mG6j3Vop-nE7cs3E9RsrqS7OzQd-rdku22ZiV5fdUyvuUM-1Kq4Y-rHr2sh2bd8l16zhrTKd-j_Nz01qowMAAA.webp?width=864") },
  { id: "renault-scenic", brand: "RENAULT", model: "SCENIC", version: "TECHNO GRANDE AUTONOMIE", category: "SUV", energy: "Électrique", batteryKwh: 87, rangeWltp: 625, powerHp: 220, consumption: 16.3, co2: 0, fiscalHp: 5, envScore: 78, priceTtc: 46990, monthlyLld: 700, image: ("https://cdn.group.renault.com/ren/fr/product-plans/scenic-e-tech/Scenic_electrique_offre.jpg.ximg.largex2.webp/2b9e3c795f.webp") },
  { id: "hyundai-kona", brand: "HYUNDAI", model: "KONA", version: "65 kWh CREATIVE", category: "SUV", energy: "Électrique", batteryKwh: 65, rangeWltp: 514, powerHp: 218, consumption: 16.6, co2: 0, fiscalHp: 6, envScore: 72, priceTtc: 41250, monthlyLld: 600, image: ("https://live.hyu.solution-server.com/webcc-v4?renderscript=SX2_my26A&format=png&height=540&options=7F%2CH4%2CLHD%2CWT3%2CW55%2C160K%2CELEC%2CDEC%2CBASE%2CHOT%2CR24%2CFR%2CAEAA27%2CAVDA01%2CAVDC01%2CAVEA54%2CAVGA05%2CAVHFA1%2CAVWA01%2CCAAA04%2CCABA06%2CCACB01%2CCBAA16%2CCBAB16%2CCBBA20%2CCBCA22%2CCCCA02%2CCDAAA1%2CCECA02%2CCEDB01%2CCEDDA1%2CCEDFA1%2CCEEA02%2CCRAAA1%2CCRBAAA%2CCSBA05%2CCSBB06%2CCTAA08%2CCTBA04%2CEGAA10%2CEGBA28%2CEGCC01%2CEGCD01%2CELAAD0%2CELBA01%2CELBB02%2CELBC03%2CELBF02%2CELCA50%2CELCB02%2CELD202%2CELDB02%2CELEC01%2CELF101%2CELFA02%2CESAA03%2CESBA11%2CESCA02%2CETBA03%2CETDA01%2CETFA02%2CETFCA2%2CETGA10%2CETGB08%2CETGE02%2CETHA02%2CETNA01%2CEWAAXP%2CEWBA01%2CEWCA03%2CS1BA02%2CS1CA04%2CS1CB07%2CS1CL02%2CS2AA30%2CS2BA03%2CS2CN01%2CSAAA23%2CSVAA80%2CSVAB02%2CSVBA04%2CSVBB04%2CSVDF01%2CSVDH01%2CTDAA31%2CTDCA03%2CTDEAG2%2CTLAA18%2CTLBA13%2CTLSA01%2CTLSB02%2CTSAA01%2CTSAC01%2CTSXD01%2CTSXH01%2CTSXJ01%2CTSXK01%2CTTBA09%2CTTCA01%2CTTEA03%2CTTFA34%2CTTGA06%2CTTGB01%2CTTGC01%2CTTGE02%2CTTGF04%2CTTHB02%2CTTHD03%2CTTKA03%2CVCAA04%2CVCBB01%2CVCCA01%2CVCDA01%2CVCDB01%2CVCDC01%2CVCDGA1%2CVDAA54%2CVDBA05%2CVDCA01%2CVDCC01%2CVDCF01%2CVDDA07%2CVDEA01%2CVDEB01%2CVDGA04%2CVDGC09%2CVDGE04%2CVDGG03%2CVDGH01%2CVDGKA2%2CVDHAA4%2CVDHC10%2CVDJAA1%2CVDJBA1%2CVDXC01%2CVDXFA2%2CVDXGA2%2CVGCA04%2CVGFH01%2CVGFP01%2CVGFQA1%2CVGFT01%2CVGFV02%2CVGTA01%2CVGXC01%2CVGXD02%2CVGXFA3%2CVGXGA1%2CVMAATY%2CVMBAC1%2CVMCA04%2CVMCC02%2CVMCF44%2CVMDB05%2CVMDGA1%2CVMFA01%2CVMFB03%2CVSAA51%2CVSAB01%2CVSBA01%2CVSCA04%2C002_NNB%2C012_NNB%2C013_NNB%2C014_LM5%2C015_TJ5%2C016_UF5%2C017_NNB%2C020_UF5%2C046_LM5%2C048_TJ5%2C060_HOT%2C061_UAY%2C064_VCS%2C068_NNB%2C110_1NB%2C122_NNB%2C123_NNB%2C127_NNB%2C130_LM5%2C140_NNB%2C143_NNB%2C212_CA%2C311_NNB%2C315_HOT%2C320_LM5%2C321_TJ5%2C322_HOT%2C350_HOT%2C351_VCS%2C358_RET%2C410_NNB%2C412_LM5%2C416_4X%2C440_LM5%2C491_TRY%2C801_NGB%2C802_EB%2C810_EB%2C820_R2T%2C832_SX2%2C834_EB%2C844_MBS%2C859_EB%2C860_R2T%2C862_YEN%2C863_YGH%2C864_YGB%2C868_YEN%2C871_A2B%2C876_EB%2C878_EB%2C922_R2T%2C934_YEN%2C941_CA%2CNLF%2CC082&quality=85&width=960") },
  { id: "cupra-born", brand: "CUPRA", model: "BORN", version: "V - Batterie XL", category: "Compacte", energy: "Électrique", batteryKwh: 77, rangeWltp: 514, powerHp: 231, consumption: 16.5, co2: 0, fiscalHp: 6, envScore: 73, priceTtc: 41250, monthlyLld: 600, image: ("https://render.seat.fr/SEA/RENDER/PRD/render/fast/v3_x2STYgbdRjG__llMpmZnQ-zy7QFoehlUKTNJLvZTZBQa1tFWGih4ge1hsnkv0naZJJOJrstVKrWg8Vq0YOCiFQriFAR2cMKtuhBCj20aA-tHhSxIH5gWehFumKdeHxf3ueD93nO_yVy41hw4NHztzf_rWpP_owQR4dCZB8UyopsDjNCiMcwuv2gLYuTxeYtIxkk24LlYTEcD-Og2BzEUbHslxcckU-PRVaI_ItCKNXJIGx7HPeGQRz0t690W0mn8EDTr8wuhQv-7FLFr83VwrlyMO83y9Vmq1maL83Xwlk5V6u1KtMp-gORDXo94aRq8mjSONRsLMWDKBHq4VI7bB0SykSX3BrWTcSXKD-i3CZ3P-4G2gL6axiLqXeMV3BXscC-SK5Ibge5Z1A7qJ_gXse9gLYJfYhzkMKnFL5FJCj_YnyFcQV7F8qbKHfI_0r-IlO_IPZg78B5GrEXESJex9yOtQXjIUwb8z70N7DvMP0NhXU2CYxVnAWcm7jraBvoJzBPYT2CdhW9i_029jq51NtbGCHGuxjvYab8GZzTiFX0KmYby8Y9iX0c-y7OExQ-RH0Z9Wu0A2jPY5zB_AlLwaqivIR6GvcG7mfMPI67RuZ3MreY_hPjFMYa2XM4q9zzPe5HKKn0Ptx_UC6jvoDdwD6Bcy_iY9xrKCdRz6B-x0we7Qbab7iXcD_HuMXUIuYRrALWVuzLOHtxziI8xMOIV3G_QD2HHqI7TJUx72JLxFbUd1AvYS9iabhXMafQn0U_jr5B5jm0PRjpl35A-QP1_TT-szJa7qaB92WU1Pcn41Z30Niftm_XpHje_32ql2pl3-vIbruT1Et-1feC3rAT1JN4LL0w6Ms4qO98al95d2Nno9zw_ZIXRGmZk-4gGtV3B8d6E6A3SqSMu1E7iNo9WS9VvFE4GKbQlcPy2EgeGcsolPWK15dJ0AqSYFnGo5SgXp7Jptz_AV-SSalEAwAA?width=1960") },
  { id: "skoda-enyaq-coupe", brand: "SKODA", model: "ENYAQ COUPE", version: "iV85 PLUS", category: "SUV Coupé", energy: "Électrique", batteryKwh: 82, rangeWltp: 590, powerHp: 286, consumption: 15.9, co2: 0, fiscalHp: 7, envScore: 75, priceTtc: 53050, monthlyLld: 780, image: ("blob:https://cc.skoda-auto.com/39884fa4-0cb4-4c33-8ace-0b780c90ab96") },
  { id: "skoda-elroq", brand: "SKODA", model: "ELROQ", version: "iV85 PLUS", category: "SUV", energy: "Électrique", batteryKwh: 77, rangeWltp: 590, powerHp: 286, consumption: 15.5, co2: 0, fiscalHp: 7, envScore: 76, priceTtc: 53050, monthlyLld: 780, image: ("blob:https://cc.skoda-auto.com/b4ddf891-6cff-4ddb-a29b-1c0620dc9fee") },
  { id: "hyundai-inster", brand: "HYUNDAI", model: "INSTER", version: "49 kWh INTUITIVE 5 PLACES", category: "Citadine", energy: "Électrique", batteryKwh: 49, rangeWltp: 360, powerHp: 115, consumption: 15.0, co2: 0, fiscalHp: 4, envScore: 81, priceTtc: 28600, monthlyLld: 400, image: ("https://live.hyu.solution-server.com/webcc-v4?renderscript=AX1_my24&format=png&height=540&options=6X%2CK4%2CLHD%2CWT3%2CS55%2C80KW%2CELEC%2CDEC%2CBASE%2CZON%2CA2B%2CFR%2CAEAA26%2CAVEA63%2CAVHFA1%2CAVUA01%2CCAAA09%2CCABA04%2CCACB01%2CCBAA15%2CCBAB14%2CCBBA20%2CCBCA22%2CCCCA02%2CCDAAA1%2CCECA02%2CCEDB01%2CCEDFA1%2CCEDOB2%2CCEEA02%2CCRAAA1%2CCRBAAA%2CCSBA05%2CCSBB06%2CCTAA12%2CCTBA06%2CEGAA04%2CEGBA28%2CEGCD01%2CELAA90%2CELBA01%2CELBB02%2CELBC02%2CELC101%2CELCB02%2CELD202%2CELDB02%2CELEC01%2CELFA02%2CESAA03%2CESBA11%2CESCA02%2CETAACC%2CETBA03%2CETCA26%2CETDB01%2CETFA02%2CETFCA1%2CETGA12%2CETGB02%2CETGE01%2CETHA02%2CETKA11%2CEWAAOB%2CEWBA01%2CS1BA05%2CS1CL02%2CS1CN01%2CS1CWA1%2CS1DA02%2CS2AA04%2CS2BA03%2CSAAA04%2CSVAA31%2CSVBA02%2CTDAA31%2CTDCA03%2CTLAA18%2CTLBA13%2CTLSA01%2CTLSB02%2CTSAA01%2CTSXH01%2CTTAA02%2CTTBA09%2CTTCA01%2CTTDB01%2CTTEA05%2CTTFA01%2CTTFBA2%2CTTGA06%2CTTGB01%2CTTGC01%2CTTGF04%2CTTHB08%2CTTHD02%2CTTHE01%2CTTKA01%2CTTMA03%2CVCAA02%2CVCDA01%2CVCDB01%2CVCDD02%2CVCDGA2%2CVDAAE3%2CVDBA05%2CVDDA07%2CVDEA01%2CVDEB01%2CVDGA04%2CVDGC09%2CVDGE03%2CVDGG03%2CVDGH01%2CVDGKA2%2CVDHAA3%2CVDHC10%2CVDJAA1%2CVDJBA1%2CVDXC01%2CVDXFA2%2CVDXGA2%2CVGCA01%2CVGFD01%2CVGFP03%2CVGFT01%2CVGFW01%2CVGTA01%2CVGXD02%2CVGXGA1%2CVMAAT6%2CVMCA04%2CVMCC02%2CVMCF02%2CVMDB05%2CVMDC04%2CVMFA01%2CVMFB03%2CVSAA51%2CVSAB01%2CVSBA01%2CVSCA04%2C002_YGN%2C012_YGN%2C020_NY5%2C021_YGN%2C023_1YT%2C046_LHD%2C048_YGN%2C061_YGN%2C063_VCS%2C110_1YT%2C121_YGN%2C122_YGN%2C123_YGN%2C124_YGN%2C125_NNB%2C130_LHY%2C140_4X%2C171_CA%2C210_YGN%2C315_NY5%2C316_YGN%2C317_NY5%2C325_LHD%2C410_YGU%2C411_YG8%2C414_NNB%2C490_YGN%2C801_TPS%2C802_EB%2C810_EBR%2C812_EBR%2C813_YFO%2C820_A2B%2C832_XAC%2C843_STE%2C844_MBS%2C845_NBC%2C857_TPS%2C858_TPS%2C860_A2B%2C863_EBR%2C865_TPS%2C867_EB%2C869_CA%2C876_A2B%2C881_TPS%2C883_CA%2C922_CA%2C934_TPS%2C981_YFB%2C982_TPS%2C983_CA%2C984_EBR%2C33Z%2CC082&quality=85&width=960") },
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
    image: ALFEN_IMG,
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
    image: ALFEN_IMG,
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
    image: WALLBOX_IMG,
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
    image: WALLBOX_IMG,
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
    image: WALLBOX_IMG,
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
    image: WALLBOX_IMG,
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
