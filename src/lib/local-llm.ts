// IA locale FACULTATIVE : un petit modèle de langage qui tourne dans le navigateur du
// commercial (WebGPU, via WebLLM), gratuitement et sans clé. Rien n'est envoyé à un
// service d'IA : les libellés restent sur le poste.
//
// Rôle limité à ce que ce petit modèle fait bien : LIRE la marque, le modèle et la
// version dans les libellés de véhicules que le dictionnaire (vehicle-recognizer.ts)
// ne reconnaît pas. Mesuré sur des libellés réels (Qwen2.5-1.5B) : marque et modèle
// 12/12, rejet des lignes qui ne sont pas des véhicules 3/3 ; en revanche le segment
// n'était juste que 1 fois sur 12, donc il n'est PAS demandé au modèle (l'énergie vient
// des règles de motorisation, le segment reste à confirmer). Aucune caractéristique
// chiffrée n'est produite, et chaque véhicule identifié est marqué « À vérifier ».
//
// Le modèle (≈ 1 Go) est téléchargé UNE fois depuis Hugging Face, puis mis en cache
// par le navigateur. La bibliothèque WebLLM est chargée à la demande depuis jsDelivr :
// aucune dépendance de build, et aucun coût tant que l'IA locale n'est pas activée.

import type { ResolvedVehicle } from "./car-policy-importer";

const WEBLLM_URL = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.87/+esm";

export const LOCAL_MODELS = [
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Rapide", size: "≈ 1 Go" },
  { id: "Qwen2.5-3B-Instruct-q4f16_1-MLC", label: "Précis", size: "≈ 2 Go" },
] as const;

const SK_ENABLED = "beev_local_ai_enabled";
const SK_MODEL = "beev_local_ai_model";

export type LocalAiState = {
  status: "off" | "loading" | "ready" | "error";
  /** 0 à 1 pendant le chargement du modèle. */
  progress: number;
  message: string;
  model: string;
};

// État partagé (un seul moteur pour toute la page) + abonnements pour l'interface.
let state: LocalAiState = { status: "off", progress: 0, message: "", model: LOCAL_MODELS[0].id };
const listeners = new Set<() => void>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let engine: any = null;
let loadedModel = "";
let loading: Promise<void> | null = null;

function setState(patch: Partial<LocalAiState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const getLocalAiState = (): LocalAiState => state;
export function subscribeLocalAi(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function webGpuSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as unknown as { gpu?: unknown }).gpu;
}

const read = (k: string): string | null => {
  try { return typeof localStorage !== "undefined" ? localStorage.getItem(k) : null; } catch { return null; }
};
const write = (k: string, v: string) => {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(k, v); } catch { /* ignore */ }
};

export const isLocalAiEnabled = (): boolean => read(SK_ENABLED) === "1" && webGpuSupported();
export const localAiReady = (): boolean => !!engine && state.status === "ready";
export function selectedLocalModel(): string {
  const saved = read(SK_MODEL);
  return LOCAL_MODELS.some((m) => m.id === saved) ? (saved as string) : LOCAL_MODELS[0].id;
}

/** Charge le modèle (téléchargement la première fois, cache ensuite). */
export function ensureLocalAi(): Promise<void> {
  const model = selectedLocalModel();
  if (engine && loadedModel === model) return Promise.resolve();
  if (loading) return loading;
  if (!webGpuSupported()) {
    setState({ status: "error", message: "Ce navigateur ne gère pas WebGPU (utilisez Chrome ou Edge récent).", progress: 0 });
    return Promise.reject(new Error("WebGPU indisponible"));
  }
  setState({ status: "loading", progress: 0, message: "Préparation de l'IA locale…", model });
  loading = (async () => {
    try {
      // Import par URL : chargé à la demande, hors du bundle de l'application.
      const webllm = await import(/* @vite-ignore */ WEBLLM_URL);
      const e = await webllm.CreateMLCEngine(model, {
        initProgressCallback: (r: { progress: number; text: string }) =>
          setState({ status: "loading", progress: r.progress ?? 0, message: r.text ?? "" }),
      });
      engine = e;
      loadedModel = model;
      setState({ status: "ready", progress: 1, message: "IA locale prête", model });
    } catch (err) {
      engine = null;
      loadedModel = "";
      setState({ status: "error", progress: 0, message: err instanceof Error ? err.message : "Échec du chargement de l'IA locale" });
      throw err;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export async function setLocalAiEnabled(on: boolean): Promise<void> {
  write(SK_ENABLED, on ? "1" : "0");
  if (!on) {
    try { await engine?.unload?.(); } catch { /* ignore */ }
    engine = null;
    loadedModel = "";
    setState({ status: "off", progress: 0, message: "" });
    return;
  }
  await ensureLocalAi();
}

export async function setLocalAiModel(id: string): Promise<void> {
  if (!LOCAL_MODELS.some((m) => m.id === id)) return;
  write(SK_MODEL, id);
  setState({ model: id });
  if (read(SK_ENABLED) === "1") {
    try { await engine?.unload?.(); } catch { /* ignore */ }
    engine = null;
    loadedModel = "";
    await ensureLocalAi();
  }
}

// ── Identification ───────────────────────────────────────────────────────
const norm = (s: string) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const SCHEMA = {
  type: "object",
  properties: {
    vehicles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          i: { type: "integer" },
          brand: { type: "string" },
          model: { type: "string" },
          version: { type: "string" },
        },
        required: ["i", "brand", "model", "version"],
      },
    },
  },
  required: ["vehicles"],
};

// Consigne volontairement courte : les consignes avec exemples faisaient déformer les
// noms de modèles (« Colt » devenait « COLOUTRO »).
const SYSTEM =
  "Tu identifies des véhicules à partir de libellés d'un fichier de flotte en France. " +
  "Pour chaque ligne numérotée renvoie la marque, le modèle (sans la finition ni la motorisation) et la version. " +
  "Si la ligne n'est pas un véhicule, brand et model sont vides. N'invente rien.";

// Début d'une motorisation / finition collée au modèle (« Punto Evo 1.3 Multijet »).
const ENGINE_TOKEN = /^(\d[.,]\d|\d{2,3}(ch|cv|kw|h)?|dci|bluedci|blue|tdi|hdi|bluehdi|tce|puretech|tsi|tfsi|mpi|vti|thp|multijet|crdi|cdti|jtd|d|e-tech|hybrid|hybride|phev|turbo|ecoboost|ecoblue)$/i;

/** « Punto Evo 1.3 Multijet » -> modèle « PUNTO EVO », version « 1.3 Multijet ». */
export function splitModelVersion(model: string, version: string): { model: string; version: string } {
  const tokens = model.trim().split(/\s+/);
  const at = tokens.findIndex((t, i) => i >= 1 && ENGINE_TOKEN.test(t));
  if (at < 0) return { model: model.trim().toUpperCase(), version: version.trim() };
  return {
    model: tokens.slice(0, at).join(" ").toUpperCase(),
    version: `${tokens.slice(at).join(" ")} ${version}`.trim(),
  };
}

/** Identifie des libellés par lots. Renvoie, par libellé, ce que le modèle en comprend ;
 *  un libellé non reconnu n'apparaît pas dans le résultat. */
export async function resolveVehicleTexts(texts: string[]): Promise<Map<string, ResolvedVehicle>> {
  const out = new Map<string, ResolvedVehicle>();
  if (!engine || texts.length === 0) return out;
  const BATCH = 6;
  for (let start = 0; start < texts.length; start += BATCH) {
    const batch = texts.slice(start, start + BATCH);
    try {
      const reply = await engine.chat.completions.create({
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: batch.map((t, i) => `${i}: ${t}`).join("\n") },
        ],
        temperature: 0,
        max_tokens: 800,
        response_format: { type: "json_object", schema: JSON.stringify(SCHEMA) },
      });
      const raw = String(reply?.choices?.[0]?.message?.content ?? "");
      const parsed = JSON.parse(raw) as { vehicles?: Array<Record<string, unknown>> };
      for (const item of parsed.vehicles ?? []) {
        const idx = Number(item.i);
        const text = batch[idx];
        const brand = String(item.brand ?? "").trim();
        const rawModel = String(item.model ?? "").trim();
        if (!text || !brand || !rawModel) continue;
        // Garde-fou anti-invention : la marque ou le modèle doit figurer dans le libellé.
        const t = ` ${norm(text)} `;
        if (!t.includes(` ${norm(brand)} `) && !t.includes(` ${norm(rawModel)} `)) continue;
        const { model, version } = splitModelVersion(rawModel, String(item.version ?? ""));
        if (!model) continue;
        // Marque, modèle et version seulement : énergie et segment ne sont pas demandés
        // (le modèle se trompait sur le segment 11 fois sur 12).
        out.set(text, { brand: brand.toUpperCase(), model, version, confidence: 0.6 });
      }
    } catch (err) {
      // Lot illisible : ces libellés restent signalés comme non reconnus.
      console.warn("[IA locale] lot ignoré :", err);
    }
  }
  return out;
}
