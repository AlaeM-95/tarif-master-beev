import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Database } from "./database.types";

type BpuRow = Database["public"]["Tables"]["bpu_forfaits"]["Row"];
type BpuInsert = Database["public"]["Tables"]["bpu_forfaits"]["Insert"];

// Catégories de forfaits BPU pour le filtrage dans le menu déroulant commercial.
export const BPU_CATEGORIES: Record<string, string> = {
  installation_borne: "Forfait installation borne",
  installation_prise: "Forfait installation prise Green'Up",
  cables: "Câbles supplémentaires",
  tableau: "Tableau électrique",
  tranchee: "Tranchée",
  percement: "Percement de mur",
  repartiteur: "Répartiteur",
  terre: "Mise à la terre",
  goulotte: "Goulotte",
  pied: "Pose pied / dalle",
  deplacement: "Déplacement",
  visite: "Visite technique",
  desinstallation: "Désinstallation",
  maintenance: "Maintenance",
  autre: "Autre",
};

// Coefficients multiplicateurs par zone géographique (extraits du BPU NATIONAL).
// Zone 1 est la référence ; les autres majorent le prix de base.
export const BPU_ZONE_COEFFICIENTS: Record<number, number> = {
  1: 1.0,
  2: 1.1,
  3: 1.15,
  4: 1.2,
};

export type BpuZone = 1 | 2 | 3 | 4;

export type BpuForfait = {
  id: string;
  label: string;
  category: string;
  priceZone1Ht: number;
  position: number;
  active: boolean;
};

function dbToBpu(row: BpuRow): BpuForfait {
  return {
    id: row.id,
    label: row.label,
    category: row.category,
    priceZone1Ht: Number(row.price_zone1_ht) || 0,
    position: row.position,
    active: row.active,
  };
}

async function fetchBpuForfaits(): Promise<BpuForfait[]> {
  const { data, error } = await supabase
    .from("bpu_forfaits")
    .select("*")
    .eq("active", true)
    .order("position", { ascending: true });
  if (error) {
    console.error("[bpu] fetch error:", error);
    return [];
  }
  return (data ?? []).map(dbToBpu);
}

export function useBpuForfaits() {
  return useQuery({
    queryKey: ["bpu_forfaits"],
    queryFn: fetchBpuForfaits,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useBpuMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["bpu_forfaits"] });

  const create = useMutation({
    mutationFn: async (m: BpuInsert) => {
      const { error } = await supabase.from("bpu_forfaits").insert(m);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<BpuInsert> }) => {
      const { error } = await supabase.from("bpu_forfaits").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bpu_forfaits").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

// Convertit un BpuForfait + une zone en LineItem prêt à être ajouté au chiffrage.
// Le prix est zone-ajusté (Zone 1 × coefficient) et la zone est tracée dans le
// libellé pour traçabilité dans le PDF et le récap commercial.
export function bpuForfaitToLineItem(
  f: BpuForfait,
  zone: BpuZone,
): { label: string; qty: number; unitHt: number; marginPct: number } {
  const coeff = BPU_ZONE_COEFFICIENTS[zone] ?? 1.0;
  const unit = Math.round(f.priceZone1Ht * coeff * 100) / 100;
  const labelWithZone = zone === 1 ? f.label : `${f.label} (Zone ${zone})`;
  return {
    label: labelWithZone,
    qty: 1,
    unitHt: unit,
    marginPct: 0,
  };
}
