import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Database } from "./database.types";
import type { Charger, ChargerDeployment, Energy, LineItem, Vehicle } from "./catalog";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];
type ChargerRow = Database["public"]["Tables"]["chargers"]["Row"];
type ChargerInsert = Database["public"]["Tables"]["chargers"]["Insert"];

// ===== Conversions DB ↔ App =====
function dbToVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    version: row.version ?? "",
    category: row.category ?? "",
    energy: (row.energy ?? "Électrique") as Energy,
    batteryKwh: row.battery_kwh ?? 0,
    rangeWltp: row.range_wltp ?? 0,
    powerHp: row.power_hp ?? 0,
    consumption: row.consumption ?? 0,
    co2: row.co2 ?? 0,
    fiscalHp: row.fiscal_hp ?? 0,
    envScore: row.env_score ?? undefined,
    priceTtc: row.price_ttc,
    monthlyLld: row.monthly_lld,
    image: row.image ?? "",
    services: Array.isArray(row.services) ? (row.services as string[]) : undefined,
  };
}

function vehicleToDb(v: Vehicle): VehicleInsert {
  return {
    id: v.id,
    brand: v.brand,
    model: v.model,
    version: v.version,
    category: v.category,
    energy: v.energy,
    battery_kwh: v.batteryKwh,
    range_wltp: v.rangeWltp,
    power_hp: v.powerHp,
    consumption: v.consumption,
    co2: v.co2,
    fiscal_hp: v.fiscalHp,
    env_score: v.envScore,
    price_ttc: v.priceTtc,
    monthly_lld: v.monthlyLld,
    image: v.image,
    services: v.services,
  };
}

function dbToCharger(row: ChargerRow): Charger {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    powerKw: row.power_kw,
    type: row.type ?? "",
    deployment: (row.deployment ?? "site") as ChargerDeployment,
    priceHt: row.price_ht,
    installPriceHt: row.install_price_ht,
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
    image: row.image ?? "",
    defaultLineItems: Array.isArray(row.default_line_items)
      ? (row.default_line_items as LineItem[])
      : undefined,
  };
}

function chargerToDb(c: Charger): ChargerInsert {
  return {
    id: c.id,
    brand: c.brand,
    model: c.model,
    power_kw: c.powerKw,
    type: c.type,
    deployment: c.deployment,
    price_ht: c.priceHt,
    install_price_ht: c.installPriceHt,
    features: c.features,
    image: c.image,
    default_line_items: c.defaultLineItems,
  };
}

// ===== HOOK VÉHICULES =====
async function fetchVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("position", { ascending: true });
  if (error) {
    console.error("Erreur fetch vehicles:", error);
    return [];
  }
  return (data ?? []).map(dbToVehicle);
}

export function useVehiclesData() {
  const qc = useQueryClient();
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: fetchVehicles,
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["vehicles"] });

  const update = async (id: string, patch: Partial<Vehicle>) => {
    const current = vehicles.find((v) => v.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    const { error } = await supabase.from("vehicles").update(vehicleToDb(merged)).eq("id", id);
    if (error) console.error("Erreur update vehicle:", error);
    invalidate();
  };

  const add = async (v: Vehicle) => {
    const nextPosition = (vehicles[vehicles.length - 1]?.id ? vehicles.length + 1 : 1);
    const { error } = await supabase.from("vehicles").insert({ ...vehicleToDb(v), position: nextPosition });
    if (error) console.error("Erreur add vehicle:", error);
    invalidate();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) console.error("Erreur remove vehicle:", error);
    invalidate();
  };

  const importMany = async (list: Vehicle[]) => {
    const startPos = vehicles.length + 1;
    const rows = list.map((v, i) => ({ ...vehicleToDb(v), position: startPos + i }));
    const { error } = await supabase.from("vehicles").upsert(rows);
    if (error) console.error("Erreur import vehicles:", error);
    invalidate();
  };

  return { vehicles, isLoading, update, add, remove, importMany };
}

// ===== HOOK BORNES =====
async function fetchChargers(): Promise<Charger[]> {
  const { data, error } = await supabase
    .from("chargers")
    .select("*")
    .order("position", { ascending: true });
  if (error) {
    console.error("Erreur fetch chargers:", error);
    return [];
  }
  return (data ?? []).map(dbToCharger);
}

export function useChargersData() {
  const qc = useQueryClient();
  const { data: chargers = [], isLoading } = useQuery({
    queryKey: ["chargers"],
    queryFn: fetchChargers,
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["chargers"] });

  const update = async (id: string, patch: Partial<Charger>) => {
    const current = chargers.find((c) => c.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    const { error } = await supabase.from("chargers").update(chargerToDb(merged)).eq("id", id);
    if (error) console.error("Erreur update charger:", error);
    invalidate();
  };

  const add = async (c: Charger) => {
    const nextPosition = chargers.length + 1;
    const { error } = await supabase.from("chargers").insert({ ...chargerToDb(c), position: nextPosition });
    if (error) console.error("Erreur add charger:", error);
    invalidate();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("chargers").delete().eq("id", id);
    if (error) console.error("Erreur remove charger:", error);
    invalidate();
  };

  return { chargers, isLoading, update, add, remove };
}
