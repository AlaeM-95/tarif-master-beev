// Configuration des sections et champs à afficher dans le PDF client.
// Permet au commercial de personnaliser le rendu sans modifier le code.

import { useEffect, useState } from "react";
import type { ProjectType } from "./catalog";

export type PdfDisplayConfig = {
  // ===== Sections du PDF =====
  showWhyBeev: boolean;
  showSocialProof: boolean; // chiffres clés + témoignage sur Pourquoi Beev
  showTcoComparison: boolean; // page comparaison TCO multi-véhicules
  showVehicleComparator: boolean; // page comparateur multi-véhicules (specs côte à côte)
  showFinancialSummary: boolean; // page synthèse HT/TVA/TTC
  showGuarantees: boolean; // page garanties Beev
  showJourney: boolean; // page parcours client
  showExecutiveSummary: boolean; // page EN BREF

  // ===== Détails fiches véhicules =====
  showVehicleConsumption: boolean;
  showVehicleCo2: boolean;
  showVehicleFiscalHp: boolean;
  showVehicleEnvScore: boolean;
  showVehicleServices: boolean;
  showVehicleOptions: boolean;
  showVehicleTcoBlock: boolean; // bloc TCO par véhicule (graphique barres)
  // Specs étendues (migration 039) — chaque ligne du tableau caractéristique
  // technique est désormais togglable indépendamment pour ne pas polluer la
  // fiche si une donnée manque ou n'est pas pertinente pour le client.
  showVehicleTrunk: boolean;
  showVehicleChargeDc: boolean;
  showVehicleChargeAc: boolean;
  showVehicleChargeTime2080Ac: boolean;
  showVehicleChargeTime2080Dc: boolean;
  showVehicleDimensions: boolean;

  // ===== Détails fiches bornes =====
  showChargerFeatures: boolean;
  showChargerLineItems: boolean;
  showChargerInclusionNote: boolean;

  // ===== Pages dédiées site entreprise (rapport visite technique) =====
  showSiteCover: boolean; // couverture (toujours forcée si false → désactivable)
  showSiteOverview: boolean; // page Vue d'ensemble
  showSiteGuarantees: boolean; // page Garanties (RC, IRVE, conformité)
  showSiteProjectSynthesis: boolean; // page Synthèse projet
  showSiteInfrastructure: boolean; // page Infrastructure / Travaux
  showSiteEquipments: boolean; // page Équipements (bornes table)
  showSiteProductSheet: boolean; // pages Fiche produit (1 par modèle)
  showSiteSupervision: boolean; // page Supervision (Connect / Home Charging)
  showSiteCompliance: boolean; // page Conformité réglementaire
  showSiteFinancialRecap: boolean; // page Récap financier site
  showSitePaymentOptions: boolean; // page Options de paiement
  showValidation: boolean; // page BPA (signature)
  showB2B2ETco: boolean; // page TCO B2B2E (Bornes domicile)
  showSupervisionHome: boolean; // slide Supervision Beev Home Charging (B2B2E)
  showSupervisionConnect: boolean; // slide Supervision Beev Connect (site entreprise)
  showCarbonImpact: boolean; // page Bilan carbone (argument RSE)
};

export const DEFAULT_PDF_CONFIG: PdfDisplayConfig = {
  showWhyBeev: true,
  showSocialProof: true,
  showTcoComparison: true,
  showVehicleComparator: true,
  showFinancialSummary: false, // retirée sur demande utilisateur (info déjà dans le récap site)
  showGuarantees: true,
  showJourney: true,
  showExecutiveSummary: false, // retirée sur demande utilisateur (redondant avec couverture)
  showVehicleConsumption: true,
  showVehicleCo2: true,
  showVehicleFiscalHp: true,
  showVehicleEnvScore: false, // par défaut désactivé (info non standard)
  showVehicleServices: true,
  showVehicleOptions: true,
  showVehicleTcoBlock: true,
  showVehicleTrunk: true,
  showVehicleChargeDc: true,
  showVehicleChargeAc: true,
  showVehicleChargeTime2080Ac: true,
  showVehicleChargeTime2080Dc: true,
  showVehicleDimensions: true,
  showChargerFeatures: true,
  showChargerLineItems: true,
  showChargerInclusionNote: true,
  showSiteCover: true,
  showSiteOverview: true,
  showSiteGuarantees: true,
  showSiteProjectSynthesis: true,
  showSiteInfrastructure: true,
  showSiteEquipments: false, // désactivé par défaut : redondant avec fiche produit + récap financier (doublon Total HT)
  showSiteProductSheet: true,
  showSiteSupervision: true,
  showSiteCompliance: true,
  showSiteFinancialRecap: true,
  showSitePaymentOptions: true,
  showValidation: true,
  showB2B2ETco: true,
  showSupervisionHome: false, // activé manuellement via le panneau Configuration PDF du devis
  showSupervisionConnect: false,
  showCarbonImpact: true, // page Bilan carbone affichée par défaut (argument RSE fort)
};

const STORAGE_KEY = "beev_pdf_config_v1";

// Hook pour persister la config en localStorage (par commercial / navigateur)
export function usePdfConfig() {
  const [config, setConfig] = useState<PdfDisplayConfig>(DEFAULT_PDF_CONFIG);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setConfig({ ...DEFAULT_PDF_CONFIG, ...JSON.parse(raw) });
    } catch {
      // Ignore
    }
  }, []);

  const update = (patch: Partial<PdfDisplayConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      if (typeof window !== "undefined") {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      }
      return next;
    });
  };

  const reset = () => {
    setConfig(DEFAULT_PDF_CONFIG);
    if (typeof window !== "undefined") {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  };

  return { config, update, reset };
}

// Helpers de description (utilisés dans l'UI pour expliquer chaque toggle)
export type ConfigGroup = {
  title: string;
  appliesTo?: ProjectType[]; // sections spécifiques à un type de projet
  items: Array<{ key: keyof PdfDisplayConfig; label: string; description?: string }>;
};

export const CONFIG_GROUPS: ConfigGroup[] = [
  {
    title: "Sections du PDF",
    items: [
      { key: "showWhyBeev", label: "Page Pourquoi Beev", description: "Intro, proposition de valeur" },
      { key: "showSocialProof", label: "Chiffres clés + témoignage", description: "Encart noir + citation client" },
      { key: "showTcoComparison", label: "Comparaison TCO flotte", description: "Page synthèse si 2+ véhicules", appliesTo: ["vehicles"] as unknown as string[] } as any,
      { key: "showVehicleComparator", label: "Comparateur véhicules", description: "Tableau comparatif specs côte à côte (prix, autonomie, conso, fiscalité) si 2+ véhicules", appliesTo: ["vehicles"] as unknown as string[] } as any,
      { key: "showCarbonImpact", label: "Bilan carbone (RSE)", description: "Page CO2 évité + équivalences (avion, arbres, km)", appliesTo: ["vehicles"] as unknown as string[] } as any,
      { key: "showFinancialSummary", label: "Synthèse HT / TVA / TTC", description: "Tableau récap financier" },
      { key: "showGuarantees", label: "Garanties Beev", description: "3 piliers d'engagement" },
      { key: "showJourney", label: "Parcours client", description: "Frise + 5 étapes" },
      { key: "showExecutiveSummary", label: "EN BREF (synthèse décideur)", description: "Avant-dernière page" },
    ],
  },
  {
    title: "Fiches véhicule",
    appliesTo: ["vehicles"],
    items: [
      { key: "showVehicleConsumption", label: "Consommation" },
      { key: "showVehicleCo2", label: "CO₂" },
      { key: "showVehicleFiscalHp", label: "Puissance fiscale (CV)" },
      { key: "showVehicleEnvScore", label: "Score environnemental" },
      { key: "showVehicleServices", label: "Services inclus" },
      { key: "showVehicleOptions", label: "Options & accessoires" },
      { key: "showVehicleTcoBlock", label: "Bloc TCO graphique", description: "Comparaison vs essence" },
      { key: "showVehicleTrunk", label: "Volume de coffre" },
      { key: "showVehicleChargeAc", label: "Recharge AC max", description: "Puissance recharge sur borne AC (kW)" },
      { key: "showVehicleChargeDc", label: "Recharge DC max", description: "Puissance recharge rapide DC (kW)" },
      { key: "showVehicleChargeTime2080Ac", label: "Recharge 20-80 % AC", description: "Durée recharge AC" },
      { key: "showVehicleChargeTime2080Dc", label: "Recharge 20-80 % DC", description: "Durée recharge rapide" },
      { key: "showVehicleDimensions", label: "Dimensions", description: "L × l × H" },
    ],
  },
  {
    title: "Fiches bornes",
    appliesTo: ["home", "site"],
    items: [
      { key: "showChargerFeatures", label: "Caractéristiques techniques" },
      { key: "showChargerLineItems", label: "Lignes de chiffrage détaillées" },
      { key: "showChargerInclusionNote", label: "Encart 'Inclus dans la prestation'" },
    ],
  },
  {
    title: "Rapport visite technique (site entreprise)",
    appliesTo: ["site"],
    items: [
      { key: "showSiteOverview", label: "Vue d'ensemble", description: "Page 1 du rapport, intro + contacts" },
      { key: "showSiteGuarantees", label: "Garanties", description: "3 cartes : IRVE, RC Décennale, Conformité" },
      { key: "showSiteProjectSynthesis", label: "Synthèse projet", description: "Lecture rapide du chantier" },
      { key: "showSiteInfrastructure", label: "Infrastructure / Travaux", description: "Travaux à réaliser + génie civil" },
      { key: "showSiteEquipments", label: "Équipements", description: "Table bornes + caractéristiques" },
      { key: "showSiteProductSheet", label: "Fiches produit", description: "1 page par modèle de borne" },
      { key: "showSiteSupervision", label: "Supervision", description: "Beev Connect ou Home Charging" },
      { key: "showSiteCompliance", label: "Conformité réglementaire", description: "Bureau Contrôle + Maintenance" },
      { key: "showSiteFinancialRecap", label: "Récap financier", description: "Tableau Poste/Fournisseur/Montant HT" },
      { key: "showSitePaymentOptions", label: "Options de paiement", description: "Comptant / 50-50 / Leasing" },
    ],
  },
  {
    title: "Supervision Beev (modules optionnels)",
    items: [
      { key: "showSupervisionHome", label: "Beev Home Charging (B2B2E)", description: "Slide dédiée à la supervision recharge domicile collaborateurs : refacturation kWh, app mobile, conformité URSSAF" },
      { key: "showSupervisionConnect", label: "Beev Connect (site entreprise)", description: "Slide dédiée à la supervision parc site : pilotage à distance, RFID, alerting, reporting" },
    ],
  },
  {
    title: "Pages finales",
    items: [
      { key: "showValidation", label: "BPA (signature)", description: "Page Bon Pour Accord + signatures" },
    ],
  },
];
