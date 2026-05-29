import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Database } from "./database.types";

type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];
type MaterialInsert = Database["public"]["Tables"]["materials"]["Insert"];

// Catégories de matériels affichées dans le menu déroulant commercial.
// Étiquettes humaines pour les codes catégorie stockés en DB.
export const MATERIAL_CATEGORIES: Record<string, string> = {
  delestage: "Délestage / Pilotage charge",
  compteur: "Compteur",
  cable: "Câbles T2",
  pied: "Pied de borne",
  kit: "Smart Kit",
  garantie: "Extension de garantie",
  tic: "Accessoire TIC",
  supervision: "Supervision",
  autre: "Autre",
};

export type Material = {
  id: string;
  label: string;
  brand: string | null;
  model: string | null;
  category: string;
  priceBuyHt: number;
  priceSellMinHt: number;
  position: number;
  active: boolean;
};

function dbToMaterial(row: MaterialRow): Material {
  return {
    id: row.id,
    label: row.label,
    brand: row.brand,
    model: row.model,
    category: row.category,
    priceBuyHt: Number(row.price_buy_ht) || 0,
    priceSellMinHt: Number(row.price_sell_min_ht) || 0,
    position: row.position,
    active: row.active,
  };
}

async function fetchMaterials(): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("position", { ascending: true });
  if (error) {
    console.error("[materials] fetch error:", error);
    return [];
  }
  return (data ?? []).map(dbToMaterial);
}

// Hook lecture : matériels actifs, groupés par catégorie côté consommateur.
export function useMaterials() {
  return useQuery({
    queryKey: ["materials"],
    queryFn: fetchMaterials,
    staleTime: 5 * 60 * 1000, // 5 min — le catalogue change rarement
  });
}

// Hooks d'écriture (admin) — utilisés par la page d'édition du catalogue
export function useMaterialMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["materials"] });

  const create = useMutation({
    mutationFn: async (m: MaterialInsert) => {
      const { error } = await supabase.from("materials").insert(m);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<MaterialInsert> }) => {
      const { error } = await supabase.from("materials").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

// Convertit un Material en LineItem prêt à être ajouté à un SelectedCharger.
// Le prix par défaut est le "prix de vente minimum" du fichier (config commercial),
// avec une marge 0 puisque c'est déjà le prix client souhaité. Le commercial
// peut ensuite ajuster qté/PU/marge dans le chiffrage.
export function materialToLineItem(m: Material): {
  label: string;
  qty: number;
  unitHt: number;
  marginPct: number;
} {
  return {
    label: m.label,
    qty: 1,
    unitHt: m.priceSellMinHt > 0 ? m.priceSellMinHt : m.priceBuyHt,
    marginPct: 0,
  };
}
