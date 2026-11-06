// Encart « IA locale » : active, dans le navigateur du commercial, un petit modèle de
// langage gratuit qui aide à reconnaître les libellés de véhicules inconnus du
// dictionnaire. Aucune clé, aucun envoi de données : le modèle (≈ 1 Go) se télécharge
// une fois, puis reste en cache dans le navigateur.

import { useSyncExternalStore, useState } from "react";
import { Cpu, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  LOCAL_MODELS, getLocalAiState, isLocalAiEnabled, selectedLocalModel, setLocalAiEnabled,
  setLocalAiModel, subscribeLocalAi, webGpuSupported,
} from "@/lib/local-llm";

export function LocalAiPanel() {
  const st = useSyncExternalStore(subscribeLocalAi, getLocalAiState, getLocalAiState);
  const [busy, setBusy] = useState(false);
  const supported = webGpuSupported();
  const enabled = isLocalAiEnabled();
  const model = selectedLocalModel();
  const meta = LOCAL_MODELS.find((m) => m.id === model) ?? LOCAL_MODELS[0];

  const toggle = async () => {
    setBusy(true);
    try {
      await setLocalAiEnabled(!enabled);
      if (!enabled) toast.success("IA locale prête");
    } catch (e) {
      toast.error(`IA locale indisponible : ${e instanceof Error ? e.message : "erreur inconnue"}`);
    } finally {
      setBusy(false);
    }
  };

  const loading = st.status === "loading";
  const ready = st.status === "ready";

  return (
    <div className="rounded-lg border border-beev-violet/30 bg-beev-violet-20/30 p-3 text-xs space-y-2">
      <div className="flex items-start gap-2">
        <Cpu className="w-4 h-4 mt-0.5 text-beev-violet shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[12px] flex items-center gap-1.5">
            IA locale (gratuite, sans clé)
            {ready && <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><CheckCircle2 className="w-3 h-3" /> prête</span>}
          </p>
          <p className="text-muted-foreground text-[11px] mt-0.5">
            Un petit modèle tourne dans votre navigateur pour reconnaître les libellés de véhicules inconnus du dictionnaire.
            Rien n'est envoyé à un service externe. Premier chargement : {meta.size} à télécharger une seule fois, ensuite en cache.
            Les véhicules qu'elle identifie sont toujours marqués « À vérifier ».
          </p>
        </div>
        {supported ? (
          <Button size="sm" variant={enabled ? "outline" : "default"} className="h-8 text-xs shrink-0 gap-1.5" onClick={toggle} disabled={busy || loading}>
            {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement</> : enabled ? "Désactiver" : "Activer"}
          </Button>
        ) : null}
      </div>

      {!supported && (
        <p className="flex items-center gap-1.5 text-amber-800 text-[11px]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Ce navigateur ne gère pas WebGPU : utilisez Chrome ou Edge récent sur un ordinateur. La lecture par dictionnaire reste disponible.
        </p>
      )}

      {loading && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-beev-violet transition-all" style={{ width: `${Math.round(st.progress * 100)}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground truncate">{st.message}</p>
        </div>
      )}

      {st.status === "error" && (
        <p className="flex items-center gap-1.5 text-amber-800 text-[11px]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {st.message}
        </p>
      )}

      {supported && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Modèle :</span>
          {LOCAL_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={loading}
              onClick={() => { void setLocalAiModel(m.id).catch(() => undefined); }}
              className={`rounded-full border px-2.5 py-0.5 ${model === m.id ? "bg-beev-violet text-white border-beev-violet" : "bg-white hover:bg-muted"}`}
              title={m.id}
            >
              {m.label} · {m.size}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
