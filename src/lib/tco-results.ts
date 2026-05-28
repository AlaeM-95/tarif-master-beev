import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

// Résultat TCO complet — provient de l'app beev-tco-2026.lovable.app ou
// d'une saisie manuelle dans tarif-master.
export type TcoResult = {
  id: string;
  vehicleId: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  durationMonths: number;
  kmPerYear: number;
  energyParams: {
    mixHomePct?: number;
    kWhHome?: number;
    kWhPublic?: number;
    fuelPriceL?: number;
  } | null;
  monthlyLld: number | null;
  leasePer100km: number | null;
  energyPer100km: number | null;
  insurancePerYear: number | null;
  maintenancePerYear: number | null;
  tiresPerYear: number | null;
  tcoPer100km: number | null;
  tcoPerYear: number | null;
  tcoTotalContract: number | null;
  refBrand: string | null;
  refTcoPer100km: number | null;
  refTcoPerYear: number | null;
  economyPer100km: number | null;
  economyPerYear: number | null;
  economyTotalContract: number | null;
  bonusEcologique: number;
  malusCo2: number;
  aideLocale: number;
  malusPoids: number;
  clientCompany: string | null;
  computedAt: string;
  source: string;
  notes: string | null;
};

type TcoResultRow = {
  id: string;
  vehicle_id: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  duration_months: number;
  km_per_year: number;
  energy_params: TcoResult["energyParams"];
  monthly_lld: number | null;
  lease_per_100km: number | null;
  energy_per_100km: number | null;
  insurance_per_year: number | null;
  maintenance_per_year: number | null;
  tires_per_year: number | null;
  tco_per_100km: number | null;
  tco_per_year: number | null;
  tco_total_contract: number | null;
  ref_brand: string | null;
  ref_tco_per_100km: number | null;
  ref_tco_per_year: number | null;
  economy_per_100km: number | null;
  economy_per_year: number | null;
  economy_total_contract: number | null;
  bonus_ecologique: number;
  malus_co2: number;
  aide_locale: number;
  malus_poids: number;
  client_company: string | null;
  computed_at: string;
  source: string;
  notes: string | null;
};

function rowToTcoResult(row: TcoResultRow): TcoResult {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    vehicleBrand: row.vehicle_brand,
    vehicleModel: row.vehicle_model,
    durationMonths: row.duration_months,
    kmPerYear: row.km_per_year,
    energyParams: row.energy_params,
    monthlyLld: row.monthly_lld,
    leasePer100km: row.lease_per_100km,
    energyPer100km: row.energy_per_100km,
    insurancePerYear: row.insurance_per_year,
    maintenancePerYear: row.maintenance_per_year,
    tiresPerYear: row.tires_per_year,
    tcoPer100km: row.tco_per_100km,
    tcoPerYear: row.tco_per_year,
    tcoTotalContract: row.tco_total_contract,
    refBrand: row.ref_brand,
    refTcoPer100km: row.ref_tco_per_100km,
    refTcoPerYear: row.ref_tco_per_year,
    economyPer100km: row.economy_per_100km,
    economyPerYear: row.economy_per_year,
    economyTotalContract: row.economy_total_contract,
    bonusEcologique: row.bonus_ecologique ?? 0,
    malusCo2: row.malus_co2 ?? 0,
    aideLocale: row.aide_locale ?? 0,
    malusPoids: row.malus_poids ?? 0,
    clientCompany: row.client_company,
    computedAt: row.computed_at,
    source: row.source,
    notes: row.notes,
  };
}

// Récupère le résultat TCO le plus récent pour un véhicule donné
export async function fetchLatestTcoResult(vehicleId: string): Promise<TcoResult | null> {
  const { data, error } = await supabase
    .from("tco_results")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToTcoResult(data as unknown as TcoResultRow);
}

// Récupère tous les TCO résultats pour une liste de véhicules
export async function fetchTcoResultsForVehicles(vehicleIds: string[]): Promise<Map<string, TcoResult>> {
  if (vehicleIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("tco_results")
    .select("*")
    .in("vehicle_id", vehicleIds)
    .order("computed_at", { ascending: false });
  if (error || !data) return new Map();
  const map = new Map<string, TcoResult>();
  (data as unknown as TcoResultRow[]).forEach((row) => {
    const result = rowToTcoResult(row);
    // Garde le plus récent par véhicule (la query est triée DESC par computed_at)
    if (result.vehicleId && !map.has(result.vehicleId)) {
      map.set(result.vehicleId, result);
    }
  });
  return map;
}

// Hook React Query
export function useTcoResults(vehicleIds: string[]) {
  return useQuery({
    queryKey: ["tco_results", vehicleIds.sort().join(",")],
    queryFn: () => fetchTcoResultsForVehicles(vehicleIds),
    enabled: vehicleIds.length > 0,
    staleTime: 30_000,
  });
}

// Insère un résultat TCO (utilisé par beev-tco-2026 ou par tarif-master en mode manuel)
export async function saveTcoResult(input: Partial<TcoResult> & { vehicleId: string; durationMonths: number; kmPerYear: number }): Promise<{ id: string | null; error: string | null }> {
  const row = {
    vehicle_id: input.vehicleId,
    vehicle_brand: input.vehicleBrand ?? null,
    vehicle_model: input.vehicleModel ?? null,
    duration_months: input.durationMonths,
    km_per_year: input.kmPerYear,
    energy_params: input.energyParams ?? null,
    monthly_lld: input.monthlyLld ?? null,
    lease_per_100km: input.leasePer100km ?? null,
    energy_per_100km: input.energyPer100km ?? null,
    insurance_per_year: input.insurancePerYear ?? null,
    maintenance_per_year: input.maintenancePerYear ?? null,
    tires_per_year: input.tiresPerYear ?? null,
    tco_per_100km: input.tcoPer100km ?? null,
    tco_per_year: input.tcoPerYear ?? null,
    tco_total_contract: input.tcoTotalContract ?? null,
    ref_brand: input.refBrand ?? null,
    ref_tco_per_100km: input.refTcoPer100km ?? null,
    ref_tco_per_year: input.refTcoPerYear ?? null,
    economy_per_100km: input.economyPer100km ?? null,
    economy_per_year: input.economyPerYear ?? null,
    economy_total_contract: input.economyTotalContract ?? null,
    bonus_ecologique: input.bonusEcologique ?? 0,
    malus_co2: input.malusCo2 ?? 0,
    aide_locale: input.aideLocale ?? 0,
    malus_poids: input.malusPoids ?? 0,
    client_company: input.clientCompany ?? null,
    source: input.source ?? "tarif-master",
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase
    .from("tco_results")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) return { id: null, error: error?.message ?? "Insertion échouée" };
  return { id: data.id, error: null };
}
