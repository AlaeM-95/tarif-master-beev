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
      // Invalide toutes les queries Supabase + refetch
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
        queryClient.invalidateQueries({ queryKey: ["chargers"] }),
        queryClient.invalidateQueries({ queryKey: ["proposals"] }),
        queryClient.invalidateQueries({ queryKey: ["pdf_settings"] }),
        queryClient.invalidateQueries({ queryKey: ["journey_steps"] }),
        queryClient.invalidateQueries({ queryKey: ["tco_results"] }),
      ]);
      await queryClient.refetchQueries({ type: "active" });
      toast.success("Données rafraîchies");
    } catch (err) {
      console.error("[refresh] erreur :", err);
      toast.error("Échec du rafraîchissement");
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
