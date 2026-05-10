import { useEffect, useState } from "react";
import { DEFAULT_CHARGERS, DEFAULT_VEHICLES, type Charger, type Vehicle } from "./catalog";

const VK = "beev_vehicles_v3";
const CK = "beev_chargers_v3";
const EK = "beev_energy_v1";

export type EnergyParams = {
  durationYears: number;
  kmPerYear: number;
  fuelPriceL: number;       // €/L essence ref
  kWhHome: number;          // €/kWh domicile / bureau
  kWhPublic: number;        // €/kWh itinérance
  mixHomePct: number;       // 0-100
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

export function useVehicles() {
  const [items, setItems] = useState<Vehicle[]>(DEFAULT_VEHICLES);
  useEffect(() => setItems(load(VK, DEFAULT_VEHICLES)), []);
  const save = (next: Vehicle[]) => { setItems(next); localStorage.setItem(VK, JSON.stringify(next)); };
  return {
    vehicles: items,
    update: (id: string, patch: Partial<Vehicle>) => save(items.map((v) => (v.id === id ? { ...v, ...patch } : v))),
    reset: () => save(DEFAULT_VEHICLES),
  };
}

export function useChargers() {
  const [items, setItems] = useState<Charger[]>(DEFAULT_CHARGERS);
  useEffect(() => setItems(load(CK, DEFAULT_CHARGERS)), []);
  const save = (next: Charger[]) => { setItems(next); localStorage.setItem(CK, JSON.stringify(next)); };
  return {
    chargers: items,
    update: (id: string, patch: Partial<Charger>) => save(items.map((c) => (c.id === id ? { ...c, ...patch } : c))),
    reset: () => save(DEFAULT_CHARGERS),
  };
}

export function useEnergy() {
  const [e, setE] = useState<EnergyParams>(DEFAULT_ENERGY);
  useEffect(() => setE(load(EK, DEFAULT_ENERGY)), []);
  const save = (next: EnergyParams) => { setE(next); localStorage.setItem(EK, JSON.stringify(next)); };
  return { energy: e, set: save, reset: () => save(DEFAULT_ENERGY) };
}

export const fmtEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export const fmtEur2 = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
