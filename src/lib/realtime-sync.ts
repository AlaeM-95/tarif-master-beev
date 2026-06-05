// Synchronisation Realtime des tables catalogue partagées entre commerciaux.
//
// Dès qu'un ops modifie un prix, une image, une offre loueur ou un texte
// PDF dans /admin, les autres commerciaux connectés voient la mise à jour
// en ~1 seconde sans avoir à rafraîchir la page.
//
// Mécanisme :
//   1. La migration 029 publie les tables vehicles/chargers/leaser_offers/
//      pdf_settings/pdf_texts/beev_pillars/journey_steps sur le channel
//      supabase_realtime.
//   2. Ce hook s'abonne via WebSocket aux changements (INSERT, UPDATE,
//      DELETE) sur chacune de ces tables.
//   3. À chaque event, on invalide la query React Query correspondante
//      → refetch automatique → UI mise à jour.
//   4. Un toast subtil signale au commercial que le catalogue a été mis
//      à jour (utile pour éviter l'effet "valeur qui change sans raison").

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "./supabase";

type RealtimeTable = {
  /** Nom de la table Postgres (doit matcher la publication 029). */
  table: string;
  /** Clé queryKey utilisée par les useQuery côté client (premier élément). */
  queryKey: string;
  /** Libellé humain pour le toast (ex. "Catalogue véhicules"). */
  label: string;
};

const TABLES: RealtimeTable[] = [
  { table: "vehicles", queryKey: "vehicles", label: "Catalogue véhicules" },
  { table: "chargers", queryKey: "chargers", label: "Catalogue bornes" },
  { table: "leaser_offers", queryKey: "leaser_offers", label: "Offres loueurs" },
  { table: "pdf_settings", queryKey: "pdf_settings", label: "Charte PDF" },
  { table: "pdf_texts", queryKey: "pdf_texts", label: "Textes PDF" },
  { table: "beev_pillars", queryKey: "beev_pillars", label: "Engagements Beev" },
  { table: "journey_steps", queryKey: "journey_steps", label: "Parcours client" },
];

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

/**
 * Hook d'abonnement aux changements catalogue partagés.
 * Renvoie le statut de connexion (utilisable pour afficher un indicateur
 * "Live" dans le header).
 */
export function useRealtimeSync(): { status: RealtimeStatus; lastEventAt: Date | null } {
  const qc = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  // Debounce des toasts par table : on n'en affiche qu'1 max par 3 secondes
  // pour éviter le spam si plusieurs UPDATE arrivent en rafale (édition admin).
  const lastToastByTable = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const channels = TABLES.map((t) => {
      return supabase
        .channel(`realtime_${t.table}`)
        .on(
          // @ts-expect-error postgres_changes typing limitations du SDK
          "postgres_changes",
          { event: "*", schema: "public", table: t.table },
          () => {
            // Invalide la query React Query → refetch + propagation UI
            qc.invalidateQueries({ queryKey: [t.queryKey] });
            setLastEventAt(new Date());
            // Toast debouncé par table (3s)
            const now = Date.now();
            const lastShown = lastToastByTable.current.get(t.table) ?? 0;
            if (now - lastShown > 3000) {
              toast.success(`${t.label} mis à jour`, { duration: 2000 });
              lastToastByTable.current.set(t.table, now);
            }
          },
        )
        .subscribe((s) => {
          if (s === "SUBSCRIBED") setStatus("connected");
          else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("disconnected");
        });
    });

    return () => {
      channels.forEach((ch) => {
        supabase.removeChannel(ch).catch(() => { /* ignore */ });
      });
    };
  }, [qc]);

  return { status, lastEventAt };
}
