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
      // Liste exhaustive des queryKeys à invalider. Inclut les nouvelles tables
      // (materials, bpu_forfaits, beev_pillars, pdf_texts) qui ne l'étaient pas.
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
      ];

      // Parallélisation : avant les resetQueries étaient await en série, ce
      // qui dépassait facilement les 8s du timeout dès qu'une requête traînait.
      // Maintenant tout part en parallèle et on attend l'ensemble. Chaque
      // queryKey absent du QueryProvider est silencieusement no-op.
      const refetchAll = Promise.all(
        keys.map((k) =>
          queryClient.resetQueries({ queryKey: k as readonly any[] }).catch((e) => {
            console.warn(`[refresh] reset ${k.join("/")} a échoué :`, e);
          }),
        ),
      );

      // Timeout plus généreux (20s) car on attend TOUS les fetches en parallèle.
      // Si ça dépasse 20s c'est vraiment que Supabase est down.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout (20s). Vérifiez votre connexion Supabase.")), 20000),
      );
      await Promise.race([refetchAll, timeout]);
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
