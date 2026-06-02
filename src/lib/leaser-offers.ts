import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

export type LeaserOffer = {
  id: string;
  vehicleId: string;
  loueur: string;
  durationMonths: number;
  kmTotal: number;
  monthlyPriceTtc: number;
  active: boolean;
};

function dbToOffer(row: any): LeaserOffer {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    loueur: row.loueur,
    durationMonths: row.duration_months,
    kmTotal: row.km_total,
    monthlyPriceTtc: Number(row.monthly_price_ttc) || 0,
    active: row.active,
  };
}

async function fetchOffers(): Promise<LeaserOffer[]> {
  const { data, error } = await (supabase as any)
    .from("leaser_offers")
    .select("*")
    .eq("active", true)
    .order("vehicle_id")
    .order("duration_months");
  if (error) {
    console.error("[leaser_offers] fetch error:", error);
    return [];
  }
  return (data ?? []).map(dbToOffer);
}

export function useLeaserOffers() {
  const qc = useQueryClient();
  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["leaser_offers"],
    queryFn: fetchOffers,
    staleTime: 60_000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["leaser_offers"] });

  const create = useMutation({
    mutationFn: async (input: Omit<LeaserOffer, "id" | "active">) => {
      const { error } = await (supabase as any).from("leaser_offers").insert({
        vehicle_id: input.vehicleId,
        loueur: input.loueur,
        duration_months: input.durationMonths,
        km_total: input.kmTotal,
        monthly_price_ttc: input.monthlyPriceTtc,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<LeaserOffer> }) => {
      const row: any = {};
      if (patch.loueur !== undefined) row.loueur = patch.loueur;
      if (patch.durationMonths !== undefined) row.duration_months = patch.durationMonths;
      if (patch.kmTotal !== undefined) row.km_total = patch.kmTotal;
      if (patch.monthlyPriceTtc !== undefined) row.monthly_price_ttc = patch.monthlyPriceTtc;
      if (patch.active !== undefined) row.active = patch.active;
      const { error } = await (supabase as any).from("leaser_offers").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("leaser_offers").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { offers, isLoading, create, update, remove };
}

// Helper : trouve la meilleure offre matching pour un véhicule, selon
// une durée (mois) et un km/an souhaités. Match exact d'abord, puis
// approximatif (durée proche + km total proche), sinon retourne null.
export function findBestOffer(
  offers: LeaserOffer[],
  vehicleId: string,
  durationMonths: number,
  kmPerYear: number,
): LeaserOffer | null {
  const candidates = offers.filter((o) => o.vehicleId === vehicleId && o.active);
  if (candidates.length === 0) return null;
  const kmTotalTarget = (kmPerYear * durationMonths) / 12;

  // Match exact
  const exact = candidates.find((o) => o.durationMonths === durationMonths && Math.abs(o.kmTotal - kmTotalTarget) < 1000);
  if (exact) return exact;

  // Approximatif : minimise la distance (poids 1 sur durée, poids 0.001 sur km)
  let best = candidates[0];
  let bestScore = Infinity;
  for (const o of candidates) {
    const score = Math.abs(o.durationMonths - durationMonths) * 50 + Math.abs(o.kmTotal - kmTotalTarget) * 0.001;
    if (score < bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}
