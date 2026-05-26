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
};

export const DEFAULT_ENERGY: EnergyParams = {
  durationYears: 4,
  kmPerYear: 30000,
  fuelPriceL: 1.75,
  kWhHome: 0.4,
  kWhPublic: 0.6,
  mixHomePct: 85,
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
  const { vehicles, update, add, remove, importMany } = useVehiclesData();
  return {
    vehicles,
    update,
    add,
    remove,
    importMany,
    // reset() est désactivé tant que les véhicules sont en base — l'admin doit gérer
    // les suppressions individuellement depuis l'UI admin.
    reset: () => {},
  };
}

export function useChargers() {
  const { chargers, update, add, remove } = useChargersData();
  return {
    chargers,
    update,
    add,
    remove,
    reset: () => {},
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
