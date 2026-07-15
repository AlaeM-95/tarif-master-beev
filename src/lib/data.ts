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
    topRank: (row as any).top_rank ?? undefined,
    pcomPct: (row as any).pcom_pct ?? 0,
    commissionBeev: (row as any).commission_beev ?? 0,
    distributeurNord: (row as any).distributeur_nord ?? undefined,
    distributeurSud: (row as any).distributeur_sud ?? undefined,
    availableStock: (row as any).available_stock ?? false,
    leadTime: (row as any).lead_time ?? undefined,
    tripartiteContract: (row as any).tripartite_contract ?? undefined,
    tripartitePdfUrl: (row as any).tripartite_pdf_url ?? undefined,
    lastSyncAt: (row as any).last_sync_at ?? undefined,
    image: row.image ?? "",
    gallery: Array.isArray((row as any).gallery) ? ((row as any).gallery as string[]) : undefined,
    featured: (row as any).featured ?? false,
    trunkLitres: (row as any).trunk_litres ?? undefined,
    cargoVolumeM3: (row as any).cargo_volume_m3 ?? undefined,
    chargeDcMaxKw: (row as any).charge_dc_max_kw ?? undefined,
    chargeAcMaxKw: (row as any).charge_ac_max_kw ?? undefined,
    dimensions: (row as any).dimensions ?? undefined,
    chargeTime2080Ac: (row as any).charge_time_2080_ac ?? undefined,
    chargeTime2080Dc: (row as any).charge_time_2080_dc ?? undefined,
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
  if (v.topRank !== undefined && v.topRank !== null) (row as any).top_rank = v.topRank;
  if (v.pcomPct !== undefined) (row as any).pcom_pct = v.pcomPct;
  if (v.commissionBeev !== undefined) (row as any).commission_beev = v.commissionBeev;
  if (v.distributeurNord !== undefined) (row as any).distributeur_nord = v.distributeurNord;
  if (v.distributeurSud !== undefined) (row as any).distributeur_sud = v.distributeurSud;
  if (v.availableStock !== undefined) (row as any).available_stock = v.availableStock;
  if (v.leadTime !== undefined) (row as any).lead_time = v.leadTime;
  if (v.tripartiteContract !== undefined) (row as any).tripartite_contract = v.tripartiteContract;
  if (v.tripartitePdfUrl !== undefined) (row as any).tripartite_pdf_url = v.tripartitePdfUrl;
  // Galerie + featured (migration 038). Defensif : si la colonne n'existe pas
  // encore en DB, on les évite simplement.
  if (v.gallery !== undefined) (row as any).gallery = v.gallery;
  if (v.featured !== undefined) (row as any).featured = v.featured;
  // Specs étendues (migration 039)
  if (v.trunkLitres !== undefined) (row as any).trunk_litres = v.trunkLitres;
  if (v.cargoVolumeM3 !== undefined) (row as any).cargo_volume_m3 = v.cargoVolumeM3;
  if (v.chargeDcMaxKw !== undefined) (row as any).charge_dc_max_kw = v.chargeDcMaxKw;
  if (v.chargeAcMaxKw !== undefined) (row as any).charge_ac_max_kw = v.chargeAcMaxKw;
  if (v.dimensions !== undefined) (row as any).dimensions = v.dimensions;
  if (v.chargeTime2080Ac !== undefined) (row as any).charge_time_2080_ac = v.chargeTime2080Ac;
  if (v.chargeTime2080Dc !== undefined) (row as any).charge_time_2080_dc = v.chargeTime2080Dc;
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
    marketingImageUrl: (row as any).marketing_image_url ?? undefined,
    description: row.description ?? undefined,
    warranty: (row as any).warranty ?? undefined,
    defaultLineItems: Array.isArray(row.default_line_items)
      ? (row.default_line_items as LineItem[])
      : undefined,
    // Champs comparateur B2B2E (migration 044) — lus avec garde-fou.
    casawattEligible: (row as any).casawatt_eligible ?? undefined,
    otherSupervision: (row as any).other_supervision ?? undefined,
    installPrice5mHt: (row as any).install_price_5m_ht ?? undefined,
    installPrice10mHt: (row as any).install_price_10m_ht ?? undefined,
    comparatorBadge: ((row as any).comparator_badge ?? undefined) as Charger["comparatorBadge"],
    ipRating: (row as any).ip_rating ?? undefined,
    dimensions: (row as any).dimensions ?? undefined,
    tempRange: (row as any).temp_range ?? undefined,
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
  // marketing_image_url : envoyé seulement si la migration 027 a tourné.
  if (c.marketingImageUrl !== undefined && c.marketingImageUrl !== null && c.marketingImageUrl !== "") {
    (row as any).marketing_image_url = c.marketingImageUrl;
  }
  // warranty : envoyé seulement si la migration 032 a tourné.
  if (c.warranty !== undefined && c.warranty !== null && c.warranty !== "") {
    (row as any).warranty = c.warranty;
  }
  // Champs comparateur B2B2E (migration 044) — envoyés seulement si définis.
  if (c.casawattEligible !== undefined) (row as any).casawatt_eligible = c.casawattEligible;
  if (c.otherSupervision !== undefined) (row as any).other_supervision = c.otherSupervision;
  if (c.installPrice5mHt !== undefined && c.installPrice5mHt !== null) (row as any).install_price_5m_ht = c.installPrice5mHt;
  if (c.installPrice10mHt !== undefined && c.installPrice10mHt !== null) (row as any).install_price_10m_ht = c.installPrice10mHt;
  if (c.comparatorBadge && c.comparatorBadge !== "none") (row as any).comparator_badge = c.comparatorBadge;
  if (c.ipRating !== undefined && c.ipRating !== null && c.ipRating !== "") (row as any).ip_rating = c.ipRating;
  if (c.dimensions !== undefined && c.dimensions !== null && c.dimensions !== "") (row as any).dimensions = c.dimensions;
  if (c.tempRange !== undefined && c.tempRange !== null && c.tempRange !== "") (row as any).temp_range = c.tempRange;
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
    const fullRow = vehicleToDb(merged) as any;
    let { error } = await supabase.from("vehicles").update(fullRow).eq("id", id);
    // Si la colonne top_rank (migration 046) n'existe pas encore, on retente
    // sans, pour ne pas bloquer l'édition des autres champs.
    if (error && /top_rank/i.test(error.message ?? "")) {
      const { top_rank: _drop, ...rest } = fullRow;
      ({ error } = await supabase.from("vehicles").update(rest).eq("id", id));
      if (!error) console.warn("Migration 046 (vehicles.top_rank) non appliquée — champ ignoré");
    }
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

  // Duplique un véhicule : nouveau UUID, suffixe " (copie)" sur la version
  // (visible mais pas écrasant pour la marque/modèle), position juste après
  // l'original. Le commercial édite ensuite les champs à modifier.
  const duplicate = async (id: string): Promise<{ error: string | null; newId?: string }> => {
    const source = vehicles.find((v) => v.id === id);
    if (!source) return { error: "Véhicule introuvable" };
    const newId = `dup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const sourceIdx = vehicles.findIndex((v) => v.id === id);
    const newPosition = sourceIdx >= 0 ? sourceIdx + 2 : vehicles.length + 1;
    const copy: Vehicle = {
      ...source,
      id: newId,
      version: `${source.version || "Version"} (copie)`,
      custom: true,
    };
    const { error } = await supabase
      .from("vehicles")
      .insert({ ...vehicleToDb(copy), position: newPosition });
    if (error) {
      console.error("Erreur duplicate vehicle:", error);
      return { error: error.message };
    }
    await qc.invalidateQueries({ queryKey: ["vehicles"] });
    await qc.refetchQueries({ queryKey: ["vehicles"] });
    return { error: null, newId };
  };

  return { vehicles, isLoading, update, add, remove, removeAll, importMany, duplicate };
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

  // Si la migration 032 (chargers.warranty) n'est pas encore appliquée côté
  // Supabase, on retry en strippant le champ warranty pour ne pas perdre
  // les autres modifications du charger.
  // Colonnes optionnelles ajoutées par des migrations tardives. Si l'une
  // manque encore, Supabase renvoie une erreur nommant la colonne : on la
  // retire et on retente, pour ne pas perdre les autres modifications.
  const OPTIONAL_CHARGER_COLS = [
    "warranty", "casawatt_eligible", "other_supervision",
    "install_price_5m_ht", "install_price_10m_ht", "comparator_badge",
    "ip_rating", "dimensions", "temp_range",
  ];
  const stripMissingCols = (row: any, msg: string) => {
    const rest = { ...row };
    let stripped = false;
    for (const k of OPTIONAL_CHARGER_COLS) {
      if (k in rest && new RegExp(k, "i").test(msg)) { delete rest[k]; stripped = true; }
    }
    return stripped ? rest : null;
  };
  const updateChargerRow = async (id: string, row: any) => {
    let { error } = await supabase.from("chargers").update(row).eq("id", id);
    // Jusqu'à 2 reprises (ex. warranty ET un champ comparateur manquants).
    for (let i = 0; error && i < OPTIONAL_CHARGER_COLS.length; i++) {
      const rest = stripMissingCols(row, error.message ?? "");
      if (!rest) break;
      row = rest;
      ({ error } = await supabase.from("chargers").update(row).eq("id", id));
      if (!error) console.warn("Colonnes chargers optionnelles absentes — champs ignorés (appliquez la migration 044)");
    }
    return error;
  };

  const update = async (id: string, patch: Partial<Charger>) => {
    const current = chargers.find((c) => c.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    const error = await updateChargerRow(id, chargerToDb(merged));
    if (error) console.error("Erreur update charger:", error);
    invalidate();
  };

  const add = async (c: Charger) => {
    const nextPosition = chargers.length + 1;
    let row = { ...chargerToDb(c), position: nextPosition } as any;
    let { error } = await supabase.from("chargers").insert(row);
    for (let i = 0; error && i < OPTIONAL_CHARGER_COLS.length; i++) {
      const rest = stripMissingCols(row, error.message ?? "");
      if (!rest) break;
      row = rest;
      ({ error } = await supabase.from("chargers").insert(row));
      if (!error) console.warn("Colonnes chargers optionnelles absentes — champs ignorés (appliquez la migration 044)");
    }
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

  // Duplique une borne : nouveau UUID, suffixe " (copie)" sur le modèle,
  // position juste après l'original. Le commercial édite ensuite la copie.
  const duplicate = async (id: string): Promise<{ error: string | null; newId?: string }> => {
    const source = chargers.find((c) => c.id === id);
    if (!source) return { error: "Borne introuvable" };
    const newId = `dup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const sourceIdx = chargers.findIndex((c) => c.id === id);
    const newPosition = sourceIdx >= 0 ? sourceIdx + 2 : chargers.length + 1;
    const copy: Charger = {
      ...source,
      id: newId,
      model: `${source.model} (copie)`,
      custom: true,
    };
    const row = { ...chargerToDb(copy), position: newPosition } as any;
    let { error } = await supabase.from("chargers").insert(row);
    if (error && /warranty/i.test(error.message ?? "")) {
      const { warranty: _drop, ...rest } = row;
      ({ error } = await supabase.from("chargers").insert(rest));
    }
    if (error) {
      console.error("Erreur duplicate charger:", error);
      return { error: error.message };
    }
    await qc.invalidateQueries({ queryKey: ["chargers"] });
    await qc.refetchQueries({ queryKey: ["chargers"] });
    return { error: null, newId };
  };

  return { chargers, isLoading, update, add, remove, removeAllByDeployment, duplicate };
}
