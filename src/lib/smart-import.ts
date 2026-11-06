// Lecture d'une car policy client (n'importe quel Excel / CSV), 100 % dans le navigateur.
//
// Aucune donnée n'est envoyée à un service externe, aucune clé, aucun coût :
//   1) Moteur local : colonnes détectées par mots-clés, dictionnaire de modèles et
//      règles de motorisation (vehicle-recognizer.ts).
//   2) IA locale FACULTATIVE (local-llm.ts) : un petit modèle qui tourne sur le
//      poste du commercial (WebGPU) identifie les libellés que le dictionnaire ne
//      reconnaît pas. Elle n'est utilisée que si le commercial l'a activée.
//   3) Fichier sans en-têtes de colonnes : lecture ligne à ligne des libellés.
//   4) Données ouvertes (ADEME, Open EV Data, formule fiscale) complètent CO₂, CV
//      fiscaux, poids, autonomie… pour les champs restés vides.
//
// Les véhicules produits restent éphémères (state local, aucune écriture en base).

import * as XLSX from "xlsx";
import type { Vehicle } from "./catalog";
import {
  detectEnergy, importCarPolicy,
  type ImportReport, type ResolvedVehicle,
} from "./car-policy-importer";
import { inferEnergy, recognizeVehicle } from "./vehicle-recognizer";
import { enrichVehicles } from "./vehicle-reference";
import { isLocalAiEnabled, localAiReady, ensureLocalAi, resolveVehicleTexts } from "./local-llm";

/** Complète les champs vides : catalogue Beev d'abord, puis données ouvertes (ADEME, Open EV
 *  Data), puis calculs (CV fiscaux, recharge AC). Ne bloque jamais l'import. */
async function withReferenceSpecs(report: ImportReport, catalogue?: Vehicle[]): Promise<ImportReport> {
  try {
    const { list, enriched, unmatched } = await enrichVehicles(report.vehicles, catalogue);
    report.vehicles = list;
    if (enriched > 0) {
      report.warnings.push(`Champs vides complétés pour ${enriched} véhicule${enriched > 1 ? "s" : ""} (catalogue Beev, ADEME, Open EV Data) : CV fiscaux, coffre, dimensions, recharge, autonomie… Survolez la mention « Données » pour voir la source.`);
    }
    const names = [...new Set(unmatched)];
    if (names.length > 0) {
      report.warnings.push(`Aucune donnée trouvée pour : ${names.slice(0, 4).join(", ")}${names.length > 4 ? ` et ${names.length - 4} autre${names.length - 4 > 1 ? "s" : ""}` : ""}. Utilisez « Compléter » dans la fenêtre de modification après avoir corrigé la marque et le modèle, ou saisissez les champs à la main.`);
    }
  } catch { /* données de référence indisponibles : l'import reste tel quel */ }
  return report;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

/** Fichier SANS ligne d'en-têtes : chaque ligne est lue comme un libellé de véhicule
 *  (« Peugeot 308 SW 1.5 BlueHDi 130 »). Loyer, km et durée ne sont pas lus. */
async function importHeaderless(
  file: File,
  resolve?: (texts: string[]) => Promise<Map<string, ResolvedVehicle>>,
): Promise<ImportReport> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const texts: string[] = [];
  for (const name of wb.SheetNames) {
    const grid: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: false });
    for (const row of grid) {
      // Seules les cellules de texte portent un libellé : les nombres (loyers, km) sont écartés.
      const t = row.map((c) => String(c ?? "").trim()).filter((c) => c && !/^[\d\s.,€%]+$/.test(c)).join(" ").slice(0, 120);
      if (t && !/^(total|sous total|somme|moyenne|nombre total)\b/i.test(t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim())) texts.push(t);
    }
  }

  const found: Array<{ text: string; r: ReturnType<typeof recognizeVehicle> }> = [];
  const pending = new Set<string>();
  for (const text of texts) {
    const r = recognizeVehicle(text);
    found.push({ text, r });
    if (!(r && r.brand && r.model) && text.length >= 4) pending.add(text);
  }
  let llm = new Map<string, ResolvedVehicle>();
  if (resolve && pending.size > 0) {
    try { llm = await resolve([...pending]); } catch { /* IA locale indisponible */ }
  }

  const vehicles: Array<Vehicle & { quantity: number }> = [];
  const ids = new Set<string>();
  const unresolved: Array<{ line: number; text: string }> = [];
  let low = 0;
  found.forEach(({ text, r }, i) => {
    let brand = "", model = "", version = "", category = "", conf = 0.9;
    let energy = inferEnergy("", [text], r?.energyHint ?? null);
    const l = llm.get(text);
    const byDictionary = !!(r && r.brand && r.model);
    if (byDictionary && r) {
      brand = r.brand; model = r.model; version = r.version; category = r.category; conf = r.confidence;
    } else if (l && l.brand && l.model) {
      brand = l.brand.toUpperCase(); model = l.model; version = l.version ?? ""; category = l.category ?? ""; conf = Math.min(0.6, l.confidence ?? 0.6);
      if (!energy.known && l.energy) energy = { energy: detectEnergy(l.energy), confidence: 0.6, explicit: false, known: true };
    } else {
      if (text.length >= 4 && /[a-zA-ZÀ-ÿ]{3}/.test(text)) unresolved.push({ line: i + 1, text: text.slice(0, 80) });
      return;
    }
    const confidence = Math.min(conf, energy.confidence, category ? 0.9 : 0.6);
    if (confidence < 0.8) low++;
    let id = `imported_${slug(`${brand}_${model}_${version}`)}`;
    if (ids.has(id)) { let k = 2; while (ids.has(`${id}_${k}`)) k++; id = `${id}_${k}`; }
    ids.add(id);
    vehicles.push({
      id, brand, model, version, category: category || "Berline", energy: energy.energy,
      batteryKwh: 0, rangeWltp: 0, powerHp: 0, consumption: 0, co2: 0, fiscalHp: 0, priceTtc: 0, monthlyLld: 0,
      image: "", custom: true, isCurrentFleet: false, quantity: 1,
      aiMeta: { confidence, inferred: ["energy", "category"], source: byDictionary ? "local" : "llm" },
    });
  });

  const warnings = ["Fichier sans en-têtes de colonnes : seuls les libellés de véhicules ont été lus (loyer, km et durée ne sont pas repris)."];
  if (unresolved.length > 0) warnings.push(`${unresolved.length} ligne${unresolved.length > 1 ? "s" : ""} non reconnue${unresolved.length > 1 ? "s" : ""} (${unresolved.slice(0, 3).map((u) => `« ${u.text} »`).join(", ")}${unresolved.length > 3 ? "…" : ""}).`);
  return {
    vehicles, detectedColumns: {}, warnings, totalRows: texts.length,
    importedRows: vehicles.length, engine: "locale", needsReview: unresolved.length > 0 || low > 0, unresolved,
  };
}

/**
 * Lit une car policy. `catalogue` (catalogue Beev) sert à compléter les champs vides.
 * Si l'IA locale est activée, elle est chargée (depuis le cache du navigateur) et
 * identifie les libellés que le dictionnaire ne reconnaît pas.
 */
export async function smartImportCarPolicy(file: File, opts: { categories?: string[]; catalogue?: Vehicle[] } = {}): Promise<ImportReport> {
  let resolve: ((texts: string[]) => Promise<Map<string, ResolvedVehicle>>) | undefined;
  if (isLocalAiEnabled()) {
    try {
      if (!localAiReady()) await ensureLocalAi();
      if (localAiReady()) resolve = resolveVehicleTexts;
    } catch { /* IA locale indisponible (pas de WebGPU, modèle non téléchargé…) : moteur local seul */ }
  }

  let report: ImportReport;
  try {
    report = await importCarPolicy(file, { resolve });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    // Aucune ligne d'en-têtes / colonnes Marque et Modèle absentes : lecture par libellés.
    if (/en-tête|colonnes Marque ou Modèle/i.test(msg)) {
      report = await importHeaderless(file, resolve);
      if (report.vehicles.length === 0) throw e;
    } else {
      throw e;
    }
  }
  report.engine = "locale";
  return withReferenceSpecs(report, opts.catalogue);
}
