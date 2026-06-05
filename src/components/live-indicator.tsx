// Indicateur "Live" qui matérialise visuellement la connexion Realtime
// aux tables catalogue partagées (vehicles, chargers, leaser_offers,
// pdf_settings…). Vert clignotant quand un event vient d'arriver, vert
// uni en standby, gris quand déconnecté.

import { useEffect, useState } from "react";
import { useRealtimeSync } from "@/lib/realtime-sync";

export function LiveIndicator() {
  const { status, lastEventAt } = useRealtimeSync();
  const [pulse, setPulse] = useState(false);

  // Anime le point quand un nouvel event arrive (pulse 1.5s)
  useEffect(() => {
    if (!lastEventAt) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 1500);
    return () => clearTimeout(t);
  }, [lastEventAt]);

  const color = status === "connected"
    ? "bg-accent"
    : status === "connecting"
    ? "bg-muted-foreground/40"
    : "bg-muted-foreground/20";

  const label = status === "connected"
    ? (pulse ? "Mise à jour catalogue" : "Catalogue synchronisé")
    : status === "connecting"
    ? "Connexion temps réel…"
    : "Hors ligne (refresh manuel requis)";

  return (
    <div
      className="hidden md:inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"
      title={label}
    >
      <span className="relative inline-flex">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        {pulse && status === "connected" && (
          <span className="absolute inset-0 w-2 h-2 rounded-full bg-accent animate-ping" />
        )}
      </span>
      <span className="font-medium">Live</span>
    </div>
  );
}
