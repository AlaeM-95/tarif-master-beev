import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

// Logo par marque (Peugeot, Renault, Tesla...), réutilisé par tous les
// véhicules de cette marque au catalogue. Tant qu'une marque n'a pas de
// logo renseigné, l'UI retombe sur un monogramme (2 initiales) — voir
// brandInitials() ci-dessous, utilisé dans index.tsx.

async function fetchBrandLogos(): Promise<Record<string, string>> {
  const { data, error } = await (supabase as any).from("brand_logos").select("brand, logo_url");
  if (error) {
    console.error("[brand_logos] fetch error:", error);
    return {};
  }
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.logo_url) map[row.brand] = row.logo_url;
  }
  return map;
}

export function useBrandLogos() {
  const qc = useQueryClient();
  const { data: logos = {}, isLoading } = useQuery({
    queryKey: ["brand_logos"],
    queryFn: fetchBrandLogos,
    staleTime: 60_000,
  });

  // Upsert : une ligne par marque, appelée depuis l'admin catalogue.
  const setLogo = useMutation({
    mutationFn: async ({ brand, logoUrl }: { brand: string; logoUrl: string }) => {
      const { error } = await (supabase as any)
        .from("brand_logos")
        .upsert({ brand, logo_url: logoUrl, updated_at: new Date().toISOString() }, { onConflict: "brand" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brand_logos"] }),
  });

  return { logos, isLoading, setLogo };
}

// Monogramme de repli (2 initiales) quand aucun logo n'est encore renseigné
// pour la marque — ex. "Peugeot" → "PE", "Volkswagen" → "VW" (règle simple :
// 2 premières lettres, sauf si la marque contient déjà des majuscules
// significatives comme un acronyme).
export function brandInitials(brand: string): string {
  const trimmed = (brand || "").trim();
  if (!trimmed) return "??";
  const upperRun = trimmed.match(/^[A-Z]{2,}/);
  if (upperRun) return upperRun[0].slice(0, 2);
  return trimmed.slice(0, 2).toUpperCase();
}
