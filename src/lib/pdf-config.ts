// Configuration des sections et champs à afficher dans le PDF client.
// Permet au commercial de personnaliser le rendu sans modifier le code.

import { useEffect, useState } from "react";
import type { ProjectType } from "./catalog";

export type PdfDisplayConfig = {
  // ===== Sections du PDF =====
  showWhyBeev: boolean;
  showSocialProof: boolean; // chiffres clés + témoignage sur Pourquoi Beev
  showTcoComparison: boolean; // page comparaison TCO multi-véhicules
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

  // ===== Détails fiches bornes =====
  showChargerFeatures: boolean;
  showChargerLineItems: boolean;
  showChargerInclusionNote: boolean;
};

export const DEFAULT_PDF_CONFIG: PdfDisplayConfig = {
  showWhyBeev: true,
  showSocialProof: true,
  showTcoComparison: true,
  showFinancialSummary: true,
  showGuarantees: true,
  showJourney: true,
  showExecutiveSummary: true,
  showVehicleConsumption: true,
  showVehicleCo2: true,
  showVehicleFiscalHp: true,
  showVehicleEnvScore: false, // par défaut désactivé (info non standard)
  showVehicleServices: true,
  showVehicleOptions: true,
  showVehicleTcoBlock: true,
  showChargerFeatures: true,
  showChargerLineItems: true,
  showChargerInclusionNote: true,
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
];
