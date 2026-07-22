import { useEffect, useState } from "react";
import { type ProjectType } from "./catalog";
import { useVehiclesData, useChargersData } from "./data";

const EK = "beev_energy_v1";
const PK = "beev_project_type_v1";

export type EnergyParams = {
  durationYears: number;
  kmPerYear: number;
  fuelPriceL: number;
  kWhHome: number;
  kWhPublic: number;
  mixHomePct: number;
  /** Coût HT d'installation d'une borne domicile, utilisé par le graphique
   *  ROI installation borne domicile sur la fiche véhicule électrique (PDF).
   *  Réglable par le commercial, contrairement à l'ancien défaut figé repris
   *  du calculateur B2B2E. */
  homeChargerCostHt: number;
};

export const DEFAULT_ENERGY: EnergyParams = {
  durationYears: 4,
  kmPerYear: 30000,
  fuelPriceL: 1.75,
  kWhHome: 0.4,
  kWhPublic: 0.6,
  mixHomePct: 85,
  homeChargerCostHt: 1800,
};

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Les véhicules et bornes sont maintenant stockés dans Supabase (table public.vehicles
// et public.chargers). Les hooks ci-dessous réexposent l'API existante de useVehicles()
// et useChargers() en lisant/écrivant depuis Supabase. Les RLS de Supabase garantissent
// que seuls les utilisateurs avec role = 'admin' peuvent muter les données.
export function useVehicles() {
  const { vehicles, update, add, remove, removeAll, importMany, duplicate } = useVehiclesData();
  return {
    vehicles,
    update,
    add,
    remove,
    removeAll,
    importMany,
    duplicate,
    reset: removeAll, // reset = supprimer tout
  };
}

export function useChargers() {
  const { chargers, update, add, remove, removeAllByDeployment, duplicate } = useChargersData();
  return {
    chargers,
    update,
    add,
    remove,
    removeAllByDeployment,
    duplicate,
    reset: () => {}, // pas de reset global, on utilise removeAllByDeployment
  };
}

export function useEnergy() {
  const [e, setE] = useState<EnergyParams>(DEFAULT_ENERGY);
  useEffect(() => setE(load(EK, DEFAULT_ENERGY)), []);
  const save = (next: EnergyParams) => { setE(next); localStorage.setItem(EK, JSON.stringify(next)); };
  return { energy: e, set: save, reset: () => save(DEFAULT_ENERGY) };
}

export function useProjectType() {
  const [t, setT] = useState<ProjectType>("vehicles");
  useEffect(() => setT(load(PK, "vehicles" as ProjectType)), []);
  const save = (next: ProjectType) => { setT(next); localStorage.setItem(PK, JSON.stringify(next)); };
  return { projectType: t, setProjectType: save };
}

export const fmtEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export const fmtEur2 = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
