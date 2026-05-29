import { useEffect, useState } from "react";
import { Check, Cloud, CloudOff } from "lucide-react";

type Status = "idle" | "saving" | "saved" | "error";

type Props = {
  /** Dépendances qui déclenchent un nouveau cycle save → saved. */
  watch: unknown[];
};

// Indicateur visuel d'auto-sauvegarde. À chaque changement des dépendances
// `watch`, affiche brièvement "Sauvegardé" pendant 1.5s. Donne au commercial
// la confirmation que son travail est bien persisté en localStorage.
export function SaveIndicator({ watch }: Props) {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    setStatus("saving");
    const t1 = setTimeout(() => setStatus("saved"), 200);
    const t2 = setTimeout(() => setStatus("idle"), 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, watch);

  if (status === "idle") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Cloud className="w-3 h-3" />
        <span>Auto-sauvegarde active</span>
      </div>
    );
  }
  if (status === "saving") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Cloud className="w-3 h-3 animate-pulse" />
        <span>Sauvegarde...</span>
      </div>
    );
  }
  if (status === "saved") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-[#35DA76] font-medium">
        <Check className="w-3 h-3" />
        <span>Sauvegardé</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-red-600">
      <CloudOff className="w-3 h-3" />
      <span>Échec sauvegarde</span>
    </div>
  );
}
