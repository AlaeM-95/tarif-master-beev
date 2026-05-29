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
      // Reset les queries (force le state à 'idle') puis refetch.
      // Timeout 8s : si Supabase est inaccessible, on débloque le bouton.
      const refetchAll = async () => {
        // resetQueries vide complètement le cache et force le refetch
        await queryClient.resetQueries({ queryKey: ["vehicles"] });
        await queryClient.resetQueries({ queryKey: ["chargers"] });
        await queryClient.resetQueries({ queryKey: ["proposals"] });
        await queryClient.resetQueries({ queryKey: ["pdf_settings"] });
        await queryClient.resetQueries({ queryKey: ["journey_steps"] });
        await queryClient.resetQueries({ queryKey: ["tco_results"] });
      };
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout (8s). Vérifiez votre connexion Supabase.")), 8000),
      );
      await Promise.race([refetchAll(), timeout]);
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
