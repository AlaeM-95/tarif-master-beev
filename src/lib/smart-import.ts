// Lecture intelligente d'une car policy client (n'importe quel Excel / CSV).
//
// 1) Moteur LOCAL d'abord (gratuit, sans clé, sans réseau) : colonnes détectées
//    par mots-clés + dictionnaire de modèles + règles de motorisation (voir
//    vehicle-recognizer.ts). Si toutes les lignes sont reconnues avec certitude,
//    on s'arrête là : aucun appel IA, aucun coût, rien ne quitte le navigateur.
// 2) Sinon, l'IA prend le relais : on épure les données personnelles (colonnes
//    nom, prénom, e-mail, téléphone, plaque… + e-mails / téléphones / plaques
//    repérés dans les cellules), on regroupe les lignes identiques (×N) et
//    l'Edge Function « smart-import » demande à Claude d'identifier chaque
//    véhicule et de compléter les caractéristiques absentes, avec une confiance.
// 3) Si l'IA est indisponible (pas déployée, pas de clé, crédit épuisé, erreur),
//    on garde le résultat du moteur local : l'import ne casse jamais.
//
// Les véhicules produits ont la même forme que ceux de l'import classique, et
// restent éphémères (state local, aucune écriture en base).

import * as XLSX from "xlsx";
import { supabase } from "./supabase";
import type { Vehicle } from "./catalog";
import { detectEnergy, importCarPolicy, type ImportReport } from "./car-policy-importer";
import { enrichVehicles } from "./vehicle-reference";

type PreparedRow = { ref: string; n: number; cells: string[] };
type PreparedSheet = { name: string; head: string[][]; rows: PreparedRow[] };

type AiVehicle = {
  ref: string;
  brand: string;
  model: string;
  version?: string;
  energy?: string;
  category?: string;
  quantity?: number;
  section?: string;
  monthly_lease?: number;
  km_per_year?: number;
  duration_months?: number;
  price_ttc?: number;
  co2?: number;
  fiscal_hp?: number;
  power_hp?: number;
  battery_kwh?: number;
  range_wltp?: number;
  consumption?: number;
  confidence?: number;
  inferred?: string[];
  note?: string;
};

const MAX_SHEETS = 4;
const MAX_ROWS = 240;
const MAX_COLS = 30;

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

// En-têtes de colonnes personnelles (jamais transmises). « nom » seul est un
// mot entier : « Nom du véhicule » est protégé par VEHICLE_HEADER.
const PERSONAL_HEADER =
  /(^| )(nom|prenom|collaborateur|conducteur|salarie|employe|utilisateur|beneficiaire|porteur|titulaire|driver|matricule)( |$)|e ?mail|mail|telephone|(^| )tel( |$)|mobile|adresse|iban|(^| )rib( |$)|immat|plaque|(^| )plates?( |$)|(^| )vin( |$)|chassis/;
const VEHICLE_HEADER = /vehicule|modele|marque|model|brand|version|categorie|energie|carburant/;
const PLATE_HEADER = /immat|plaque|(^| )plates?( |$)/;

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /(?:\+33|0033|0)\s?[1-9](?:[\s.-]?\d{2}){4}/g;
// Plaque au format SIV (AB-123-CD) — le format ancien n'est traité que dans les
// colonnes « immatriculation » (sinon « 1.6 HDi 90 » serait pris pour une plaque).
const PLATE_RE = /\b[A-Z]{2}[\s-]?\d{3}[\s-]?[A-Z]{2}\b/g;

function isPersonalColumn(headerCells: string[]): { personal: boolean; plate: boolean } {
  let personal = false;
  let plate = false;
  for (const c of headerCells) {
    if (!c || c.length > 40) continue;
    const n = norm(c);
    if (PERSONAL_HEADER.test(n) && !VEHICLE_HEADER.test(n)) {
      personal = true;
      if (PLATE_HEADER.test(n)) plate = true;
    }
  }
  return { personal, plate };
}

/** Épure et compacte les feuilles avant envoi. Exporté pour les tests. */
export function prepareSheets(wb: XLSX.WorkBook): {
  sheets: PreparedSheet[];
  plates: number;
  droppedColumns: number;
  truncated: boolean;
} {
  const sheets: PreparedSheet[] = [];
  let plates = 0;
  let droppedColumns = 0;
  let truncated = false;
  let budget = MAX_ROWS;

  wb.SheetNames.forEach((name, sIdx) => {
    if (sheets.length >= MAX_SHEETS || budget <= 0) return;
    const grid: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: false });
    if (grid.length < 2) return;
    const width = Math.min(MAX_COLS, grid.reduce((m, r) => Math.max(m, r.length), 0));

    // Colonnes personnelles : repérées sur les 12 premières lignes (en-têtes).
    const personalCols = new Set<number>();
    const plateCols = new Set<number>();
    // Seules les lignes à ≥ 3 cellules comptent comme en-têtes : un titre isolé
    // (« Nom du client : ACME ») ne doit pas faire retirer toute une colonne.
    const headerRows = grid.slice(0, 12).filter((r) => r.filter((x) => String(x ?? "").trim() !== "").length >= 3);
    for (let c = 0; c < width; c++) {
      const headerCells = headerRows.map((r) => String(r[c] ?? "").trim());
      const { personal, plate } = isPersonalColumn(headerCells);
      if (personal) personalCols.add(c);
      if (plate) plateCols.add(c);
    }

    const cleaned: Array<{ ref: string; cells: string[] }> = [];
    grid.forEach((row, i) => {
      const cells: string[] = [];
      for (let c = 0; c < width; c++) {
        let v = String(row[c] ?? "").trim().slice(0, 80);
        if (v && plateCols.has(c) && /\d/.test(v)) plates++;
        else if (v && !personalCols.has(c)) {
          const found = v.match(PLATE_RE);
          if (found) plates += found.length;
        }
        if (personalCols.has(c)) v = "";
        else if (v) v = v.replace(EMAIL_RE, "").replace(PHONE_RE, "").replace(PLATE_RE, "").trim();
        cells.push(v);
      }
      if (cells.some((x) => x !== "")) cleaned.push({ ref: `${sIdx + 1}:${i + 1}`, cells });
    });
    if (cleaned.length < 2) return;

    // Colonnes entièrement vides (ou personnelles vidées) retirées.
    const keep: number[] = [];
    for (let c = 0; c < width; c++) if (cleaned.some((r) => r.cells[c] !== "")) keep.push(c);
    droppedColumns += personalCols.size;
    const compact = cleaned.map((r) => ({ ref: r.ref, cells: keep.map((c) => r.cells[c]) }));

    // Regroupement des lignes strictement identiques (×N).
    const byKey = new Map<string, PreparedRow>();
    const rows: PreparedRow[] = [];
    for (const r of compact) {
      const key = r.cells.join("\u0001");
      const ex = byKey.get(key);
      if (ex) ex.n += 1;
      else {
        const pr = { ref: r.ref, n: 1, cells: r.cells };
        byKey.set(key, pr);
        rows.push(pr);
      }
    }
    let kept = rows;
    if (kept.length > budget) { kept = kept.slice(0, budget); truncated = true; }
    budget -= kept.length;
    sheets.push({ name, head: rows.slice(0, 6).map((r) => r.cells), rows: kept });
  });

  return { sheets, plates, droppedColumns, truncated };
}

async function errorMessage(error: unknown): Promise<string> {
  const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context;
  if (ctx?.json) {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch { /* corps illisible : message générique */ }
  }
  return error instanceof Error ? error.message : "service indisponible";
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

function toVehicle(a: AiVehicle, id: string, n: number): Vehicle & { quantity: number; kmPerYear?: number; durationMonths?: number } {
  const energy = detectEnergy(a.energy);
  const v: Vehicle & { quantity: number; kmPerYear?: number; durationMonths?: number } = {
    id,
    brand: a.brand,
    model: a.model,
    version: a.version ?? "",
    category: a.category || "Berline",
    energy,
    batteryKwh: a.battery_kwh ?? 0,
    rangeWltp: a.range_wltp ?? 0,
    powerHp: a.power_hp ?? 0,
    consumption: a.consumption ?? 0,
    co2: energy === "Électrique" ? 0 : a.co2 ?? 0,
    fiscalHp: a.fiscal_hp ?? 0,
    priceTtc: a.price_ttc ?? 0,
    monthlyLld: a.monthly_lease ?? 0,
    image: "",
    custom: true,
    isCurrentFleet: a.section === "current",
    aiMeta: {
      confidence: typeof a.confidence === "number" ? a.confidence : 0.5,
      inferred: a.inferred ?? [],
      note: a.note || undefined,
      source: "ia",
    },
    quantity: Math.max(1, Math.round(a.quantity ?? 1)) * n,
  };
  if ((a.km_per_year ?? 0) > 0) v.kmPerYear = a.km_per_year;
  if ((a.duration_months ?? 0) > 0) v.durationMonths = a.duration_months;
  return v;
}

/** Complète CO₂, CV fiscaux, poids, autonomie… depuis les données ouvertes
 *  (ADEME Car Labelling, Open EV Data). Ne bloque jamais l'import. */
async function withReferenceSpecs(report: ImportReport): Promise<ImportReport> {
  try {
    const { list, enriched } = await enrichVehicles(report.vehicles);
    if (enriched > 0) {
      report.vehicles = list;
      report.warnings.push(`Caractéristiques complétées pour ${enriched} véhicule${enriched > 1 ? "s" : ""} depuis les données ouvertes (ADEME, Open EV Data) : CO₂, CV fiscaux, autonomie… Survolez la mention « Données » pour voir la source.`);
    }
  } catch { /* données de référence indisponibles : l'import reste tel quel */ }
  return report;
}

/**
 * Lit une car policy : moteur local d'abord, IA seulement si une ligne n'est pas
 * reconnue avec certitude. `categories` aligne le vocabulaire de l'IA sur celui
 * du catalogue.
 */
export async function smartImportCarPolicy(file: File, opts: { categories?: string[] } = {}): Promise<ImportReport> {
  // 1) Moteur local (jamais bloquant : une erreur de lecture passe la main à l'IA).
  let local: ImportReport | null = null;
  let localError = "";
  try {
    local = await importCarPolicy(file);
  } catch (e) {
    localError = e instanceof Error ? e.message : "fichier illisible";
  }
  if (local && local.vehicles.length > 0 && !local.needsReview) {
    local.engine = "locale";
    return withReferenceSpecs(local);
  }

  // 2) IA pour les lignes douteuses.
  let aiError = "";
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const { sheets, plates, droppedColumns, truncated } = prepareSheets(wb);
    if (sheets.length === 0) throw new Error("fichier vide");

    const categories = Array.from(new Set((opts.categories ?? []).map((c) => c.trim()).filter(Boolean))).slice(0, 30);
    const { data, error } = await supabase.functions.invoke("smart-import", { body: { sheets, categories } });
    if (error) throw new Error(await errorMessage(error));
    const list: AiVehicle[] = Array.isArray(data?.vehicles) ? data.vehicles : [];
    if (list.length === 0) throw new Error("aucun véhicule reconnu par l'IA");

    const nByRef = new Map<string, number>();
    sheets.forEach((s) => s.rows.forEach((r) => nByRef.set(r.ref, r.n)));

    const seen = new Set<string>();
    const vehicles = list.map((a) => {
      let id = `imported_${slug(`${a.brand}_${a.model}_${a.version ?? ""}`)}`;
      if (seen.has(id)) {
        let k = 2;
        while (seen.has(`${id}_${k}`)) k++;
        id = `${id}_${k}`;
      }
      seen.add(id);
      return toVehicle(a, id, nByRef.get(a.ref) ?? 1);
    });

    const warnings: string[] = [...(Array.isArray(data?.warnings) ? data.warnings : [])];
    const low = vehicles.filter((v) => (v.aiMeta?.confidence ?? 1) < 0.7).length;
    if (low > 0) warnings.push(`${low} véhicule${low > 1 ? "s" : ""} identifié${low > 1 ? "s" : ""} avec une confiance faible : à vérifier avant de chiffrer.`);
    if (droppedColumns > 0) warnings.push(`${droppedColumns} colonne${droppedColumns > 1 ? "s" : ""} personnelle${droppedColumns > 1 ? "s" : ""} (nom, e-mail, téléphone, plaque…) non transmise${droppedColumns > 1 ? "s" : ""} à l'IA.`);
    if (plates > 0) warnings.push(`${plates} plaque${plates > 1 ? "s" : ""} détectée${plates > 1 ? "s" : ""} : non transmise${plates > 1 ? "s" : ""} à l'IA (la lecture par plaque n'est pas encore active).`);
    if (truncated) warnings.push(`Seules les ${MAX_ROWS} premières lignes distinctes ont été lues.`);

    const totalRows = sheets.reduce((s, sh) => s + sh.rows.reduce((t, r) => t + r.n, 0), 0);
    return withReferenceSpecs({
      vehicles,
      detectedColumns: {},
      warnings,
      totalRows,
      importedRows: vehicles.reduce((s, v) => s + v.quantity, 0),
      engine: "ia",
      plates,
    });
  } catch (e) {
    aiError = e instanceof Error ? e.message : "erreur inconnue";
  }

  // 3) IA indisponible : on garde ce que le moteur local a compris.
  if (local) {
    local.engine = "locale";
    if (local.vehicles.length > 0) {
      local.warnings.unshift(`Lecture locale sans IA (lecture intelligente indisponible : ${aiError}) : vérifiez les lignes signalées « À vérifier ».`);
    }
    return withReferenceSpecs(local);
  }
  throw new Error(localError || aiError || "fichier illisible");
}
