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
    prixBatterie: (row as any).prix_batterie ?? 0,
    poidsVide: (row as any).poids_vide ?? 0,
    ecoScoreBool: (row as any).eco_score_bool ?? false,
    remise: (row as any).remise ?? 0,
    carburantInclus: (row as any).carburant_inclus ?? false,
    consoMinThermique: (row as any).conso_min_thermique ?? 0,
    consoMaxThermique: (row as any).conso_max_thermique ?? 0,
    consoMinElec: (row as any).conso_min_elec ?? 0,
    consoMaxElec: (row as any).conso_max_elec ?? 0,
    shortlist: (row as any).shortlist ?? false,
    pcomPct: (row as any).pcom_pct ?? 0,
    commissionBeev: (row as any).commission_beev ?? 0,
    distributeurNord: (row as any).distributeur_nord ?? undefined,
    distributeurSud: (row as any).distributeur_sud ?? undefined,
    availableStock: (row as any).available_stock ?? false,
    leadTime: (row as any).lead_time ?? undefined,
    tripartiteContract: (row as any).tripartite_contract ?? undefined,
    lastSyncAt: (row as any).last_sync_at ?? undefined,
    image: row.image ?? "",
    services: Array.isArray(row.services) ? (row.services as string[]) : undefined,
  };
}

function vehicleToDb(v: Vehicle): VehicleInsert {
  const row: VehicleInsert = {
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
  // Champs fiscaux ajoutés via migration 016. Envoyés en best-effort —
  // les any silencieux permettent de fonctionner avant que la migration soit
  // appliquée (la colonne sera ignorée par Supabase et l'app ne crashe pas).
  if (v.prixBatterie !== undefined) (row as any).prix_batterie = v.prixBatterie;
  if (v.poidsVide !== undefined) (row as any).poids_vide = v.poidsVide;
  if (v.ecoScoreBool !== undefined) (row as any).eco_score_bool = v.ecoScoreBool;
  if (v.remise !== undefined) (row as any).remise = v.remise;
  if (v.carburantInclus !== undefined) (row as any).carburant_inclus = v.carburantInclus;
  if (v.consoMinThermique !== undefined) (row as any).conso_min_thermique = v.consoMinThermique;
  if (v.consoMaxThermique !== undefined) (row as any).conso_max_thermique = v.consoMaxThermique;
  if (v.consoMinElec !== undefined) (row as any).conso_min_elec = v.consoMinElec;
  if (v.consoMaxElec !== undefined) (row as any).conso_max_elec = v.consoMaxElec;
  // Champs commerciaux (migration 018)
  if (v.shortlist !== undefined) (row as any).shortlist = v.shortlist;
  if (v.pcomPct !== undefined) (row as any).pcom_pct = v.pcomPct;
  if (v.commissionBeev !== undefined) (row as any).commission_beev = v.commissionBeev;
  if (v.distributeurNord !== undefined) (row as any).distributeur_nord = v.distributeurNord;
  if (v.distributeurSud !== undefined) (row as any).distributeur_sud = v.distributeurSud;
  if (v.availableStock !== undefined) (row as any).available_stock = v.availableStock;
  if (v.leadTime !== undefined) (row as any).lead_time = v.leadTime;
  if (v.tripartiteContract !== undefined) (row as any).tripartite_contract = v.tripartiteContract;
  return row;
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
    priceBuyHt: row.price_buy_ht ?? 0,
    installPriceHt: row.install_price_ht,
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
    image: row.image ?? "",
    description: row.description ?? undefined,
    defaultLineItems: Array.isArray(row.default_line_items)
      ? (row.default_line_items as LineItem[])
      : undefined,
  };
}

function chargerToDb(c: Charger): ChargerInsert {
  // Construction conditionnelle : on n'envoie que les champs présents.
  // Évite les erreurs Supabase si la colonne 'description' n'a pas encore
  // été créée par la migration 007_chargers_description.sql.
  const row: ChargerInsert = {
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
  // N'ajoute la description que si elle est non-vide pour ne pas
  // tenter d'écrire dans une colonne potentiellement inexistante.
  if (c.description !== undefined && c.description !== null && c.description !== "") {
    row.description = c.description;
  }
  // price_buy_ht : envoyé seulement si la colonne a été créée par la migration
  // 010_chargers_price_buy.sql ET qu'on a une valeur explicite (sinon on garde
  // le défaut DB 0).
  if (c.priceBuyHt !== undefined && c.priceBuyHt !== null) {
    row.price_buy_ht = c.priceBuyHt;
  }
  return row;
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
    if (error) {
      console.error("Erreur update vehicle:", error);
      // Throw : les callers admin (v2) attendent un toast d'erreur visible.
      // Les callers commerciaux (VehicleCard inline) doivent wrap leur appel
      // dans un try/catch silencieux ou .catch() pour ne pas casser l'UI.
      throw new Error(error.message);
    }
    invalidate();
  };

  const add = async (v: Vehicle) => {
    const nextPosition = (vehicles[vehicles.length - 1]?.id ? vehicles.length + 1 : 1);
    const { error } = await supabase.from("vehicles").insert({ ...vehicleToDb(v), position: nextPosition });
    if (error) console.error("Erreur add vehicle:", error);
    invalidate();
  };

  const remove = async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) {
      console.error("Erreur remove vehicle:", error);
      return { error: error.message };
    }
    // Refetch immédiat pour garantir la cohérence UI ↔ DB
    await qc.invalidateQueries({ queryKey: ["vehicles"] });
    await qc.refetchQueries({ queryKey: ["vehicles"] });
    return { error: null };
  };

  // Supprime TOUS les véhicules (réservé admin via RLS).
  const removeAll = async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.from("vehicles").delete().neq("id", "__never__");
    if (error) {
      console.error("Erreur removeAll vehicles:", error);
      return { error: error.message };
    }
    await qc.invalidateQueries({ queryKey: ["vehicles"] });
    await qc.refetchQueries({ queryKey: ["vehicles"] });
    return { error: null };
  };

  const importMany = async (list: Vehicle[]) => {
    const startPos = vehicles.length + 1;
    const rows = list.map((v, i) => ({ ...vehicleToDb(v), position: startPos + i }));
    const { error } = await supabase.from("vehicles").upsert(rows);
    if (error) console.error("Erreur import vehicles:", error);
    invalidate();
  };

  return { vehicles, isLoading, update, add, remove, removeAll, importMany };
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

  const remove = async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from("chargers").delete().eq("id", id);
    if (error) {
      console.error("Erreur remove charger:", error);
      return { error: error.message };
    }
    await qc.invalidateQueries({ queryKey: ["chargers"] });
    await qc.refetchQueries({ queryKey: ["chargers"] });
    return { error: null };
  };

  // Supprime toutes les bornes d'un type (domicile ou site).
  const removeAllByDeployment = async (deployment: "domicile" | "site"): Promise<{ error: string | null }> => {
    const { error } = await supabase.from("chargers").delete().eq("deployment", deployment);
    if (error) {
      console.error("Erreur removeAllByDeployment:", error);
      return { error: error.message };
    }
    await qc.invalidateQueries({ queryKey: ["chargers"] });
    await qc.refetchQueries({ queryKey: ["chargers"] });
    return { error: null };
  };

  return { chargers, isLoading, update, add, remove, removeAllByDeployment };
}
