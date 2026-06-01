import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Bouton qui rafraîchit toutes les données Supabase sans recharger la page.
// Utile quand un autre commercial a modifié le catalogue, ou après une
// synchronisation TCO depuis beev-tco-2026.
export function RefreshButton() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      // Liste exhaustive des queryKeys à rafraîchir. Inclut les nouvelles
      // tables (materials, bpu_forfaits, beev_pillars, pdf_texts, templates).
      const keys: Array<readonly unknown[]> = [
        ["vehicles"],
        ["chargers"],
        ["proposals"],
        ["pdf_settings"],
        ["journey_steps"],
        ["tco_results"],
        ["materials"],
        ["bpu_forfaits"],
        ["beev_pillars"],
        ["pdf_texts"],
        ["proposal_templates"],
      ];

      // refetchQueries plutôt que resetQueries : on garde le cache (données
      // visibles pendant le refresh) et on déclenche juste un refetch en
      // arrière-plan. Plus rapide perçu, moins de risque que des composants
      // suspendent. Batché par groupes de 4 pour éviter de saturer Supabase
      // (qui peut rate-limit au-delà de 5-6 connexions parallèles).
      const refetchBatched = async () => {
        const batchSize = 4;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await Promise.all(
            batch.map((k) =>
              queryClient.refetchQueries({ queryKey: k as readonly any[] }).catch((e) => {
                console.warn(`[refresh] refetch ${k.join("/")} a échoué :`, e);
              }),
            ),
          );
        }
      };

      // Timeout 45s : généreux car le total est ~3 vagues. Si ça dépasse,
      // c'est vraiment que Supabase rame ou est down.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout (45s). Supabase semble très lent — réessayez dans quelques secondes.")), 45000),
      );
      await Promise.race([refetchBatched(), timeout]);
      toast.success("Données rafraîchies");
    } catch (err) {
      console.error("[refresh] erreur :", err);
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Échec rafraîchissement : ${msg}`);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRefresh}
      disabled={refreshing}
      className="gap-2"
      title="Rafraîchir les données (sans recharger la page)"
    >
      {refreshing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <RefreshCcw className="w-4 h-4" />
      )}
      <span className="hidden md:inline">{refreshing ? "Refresh..." : "Refresh"}</span>
    </Button>
  );
}
