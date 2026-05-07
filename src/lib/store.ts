import { useEffect, useState } from "react";
import { DEFAULT_CHARGERS, DEFAULT_VEHICLES, type Charger, type Vehicle } from "./catalog";

const VK = "beev_vehicles_v1";
const CK = "beev_chargers_v1";

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
  const save = (next: Vehicle[]) => {
    setItems(next);
    localStorage.setItem(VK, JSON.stringify(next));
  };
  return {
    vehicles: items,
    update: (id: string, patch: Partial<Vehicle>) =>
      save(items.map((v) => (v.id === id ? { ...v, ...patch } : v))),
    reset: () => save(DEFAULT_VEHICLES),
  };
}

export function useChargers() {
  const [items, setItems] = useState<Charger[]>(DEFAULT_CHARGERS);
  useEffect(() => setItems(load(CK, DEFAULT_CHARGERS)), []);
  const save = (next: Charger[]) => {
    setItems(next);
    localStorage.setItem(CK, JSON.stringify(next));
  };
  return {
    chargers: items,
    update: (id: string, patch: Partial<Charger>) =>
      save(items.map((c) => (c.id === id ? { ...c, ...patch } : c))),
    reset: () => save(DEFAULT_CHARGERS),
  };
}

export const fmtEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
