// Importeur de car policy client (Excel libre).
//
// Le commercial uploade un fichier Excel (.xlsx, .xls, .csv) issu de la
// car policy actuelle de son prospect. On détecte automatiquement les
// colonnes via des mots-clés FR/EN puis on transforme chaque ligne en
// Vehicle utilisable comme n'importe quel véhicule du catalogue (avec
// le flag `custom: true` pour le distinguer visuellement).
//
// IMPORTANT — ISOLATION DU CATALOGUE :
// Les véhicules importés vivent UNIQUEMENT dans le state React local de
// la page (pas de localStorage, pas de Supabase). Au refresh ou changement
// de projet, ils disparaissent. Aucun risque de polluer le catalogue
// officiel partagé entre commerciaux.

import * as XLSX from "xlsx";
import type { Vehicle, Energy } from "./catalog";
import { inferEnergy, recognizeVehicle } from "./vehicle-recognizer";

export type ImportReport = {
  vehicles: Vehicle[];
  detectedColumns: Record<string, string | null>; // map "brand" -> "Marque" (en-tête détecté)
  warnings: string[];
  totalRows: number;
  importedRows: number;
  /** Moteur de lecture : « ia » (lecture intelligente) ou « locale » (colonnes,
   *  dictionnaire de modèles et règles de motorisation, sans IA). */
  engine?: "ia" | "locale";
  /** Vrai si au moins une ligne n'a pas été reconnue avec certitude : la lecture
   *  intelligente est alors utile pour la compléter. */
  needsReview?: boolean;
  /** Nombre de plaques détectées dans le fichier (jamais transmises à l'IA). */
  plates?: number;
};

// Synonymes par champ — recherche case-insensitive, accents ignorés,
// match partiel (contains). L'ordre compte : on prend le premier match.
const COLUMN_SYNONYMS: Record<keyof typeof FIELD_MAP, string[]> = {
  brand: ["marque", "brand", "constructeur", "make", "manufacturer"],
  model: ["modele", "model", "vehicule", "vehicle"],
  version: ["version", "finition", "trim", "variant", "déclinaison", "declinaison"],
  category: ["categorie", "category", "segment", "type", "carrosserie", "body"],
  energy: ["energie", "energy", "carburant", "fuel", "motorisation", "propulsion"],
  batteryKwh: ["batterie", "battery", "kwh", "capacite batterie", "capacité batterie"],
  rangeWltp: ["autonomie", "range", "wltp", "km", "distance"],
  powerHp: ["puissance", "power", "ch", "hp", "chevaux", "kw moteur"],
  consumption: ["consommation", "consumption", "conso", "kwh 100", "kwh/100", "l 100", "l/100"],
  co2: ["co2", "co₂", "co 2", "emissions"],
  fiscalHp: ["cv fiscal", "puissance fiscale", "fiscal hp", "fiscal", "chevaux fiscaux"],
  priceTtc: ["prix ttc", "prix catalogue", "price ttc", "prix vehicule", "prix véhicule", "tarif"],
  monthlyLld: ["loyer", "lld", "leasing", "monthly", "mensualite", "mensualité"],
  durationMonths: ["duree", "durée", "duration", "mois", "months"],
  quantity: ["quantite", "quantité", "qte", "qté", "nombre", "quantity", "qty"],
  kmPerYear: ["km/an", "kilometrage", "kilométrage", "km par an", "annual km"],
  trunkLitres: ["coffre", "trunk", "volume coffre", "litres coffre"],
  chargeDcMaxKw: ["recharge dc", "dc max", "puissance dc", "fast charge"],
  chargeAcMaxKw: ["recharge ac", "ac max", "puissance ac"],
  dimensions: ["dimensions", "lxlxh", "l x l x h", "longueur"],
  chargeTime2080Ac: ["recharge ac 20", "temps ac", "20-80 ac"],
  chargeTime2080Dc: ["recharge dc 20", "temps dc", "20-80 dc"],
};

// Sentinel pour TypeScript : recense tous les champs supportés.
const FIELD_MAP = {
  brand: true, model: true, version: true, category: true, energy: true,
  batteryKwh: true, rangeWltp: true, powerHp: true, consumption: true,
  co2: true, fiscalHp: true, priceTtc: true, monthlyLld: true,
  durationMonths: true, quantity: true, kmPerYear: true, trunkLitres: true,
  chargeDcMaxKw: true, chargeAcMaxKw: true, dimensions: true,
  chargeTime2080Ac: true, chargeTime2080Dc: true,
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9\s/]/g, " ") // strip punctuation, keep / for kWh/100km
    .replace(/\s+/g, " ")
    .trim();
}

function detectColumn(headerNormalized: string, synonyms: string[]): number {
  // Retourne le score (0 = aucun match, sinon plus le score est haut, mieux c'est).
  for (const syn of synonyms) {
    const synN = normalize(syn);
    if (headerNormalized === synN) return 100; // match exact
    if (headerNormalized.includes(synN)) return 50; // contient
  }
  return 0;
}

function parseFrNumber(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const s = String(raw)
    .replace(/[\s €$£]/g, "")
    .replace(/,/g, ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function detectEnergy(raw: unknown): Energy {
  if (!raw) return "Électrique";
  const s = normalize(String(raw));
  if (/^(ev|bev|elect|100%|electric)/i.test(s) || s.includes("electrique")) return "Électrique";
  if (s.includes("phev") || (s.includes("hybride") && s.includes("rechargeable"))) return "Hybride Rechargeable";
  if (s.includes("mild") || s.includes("mhev")) return "Mild Hybrid";
  if (s.includes("hybride") || s.includes("hev") || s.includes("hybrid")) return "Hybride";
  if (s.includes("essence") || s.includes("gasoline") || s.includes("petrol")) return "Essence";
  if (s.includes("diesel") || s.includes("gazole")) return "Diesel";
  return "Électrique"; // par défaut on suppose EV — la car policy moderne l'est majoritairement
}

/**
 * Score une feuille selon son adéquation à l'import car policy :
 * - Bonus si le nom contient « import », « lovable », « tco », « beev »
 * - Bonus si elle contient beaucoup d'en-têtes reconnus (Marque, Modèle, etc.)
 * - Bonus si elle a beaucoup de lignes de données
 * Retourne 0 pour les feuilles d'analyse / synthèse non importables.
 */
function scoreSheet(name: string, rows: unknown[][]): number {
  let score = 0;
  const nameN = normalize(name);
  if (/\b(import|lovable|tco)\b/.test(nameN)) score += 100;
  if (/\bbeev\b/.test(nameN)) score += 20;
  if (/\b(analyse|synthese|recap|comparatif)\b/.test(nameN)) score -= 30;
  // Scan des 10 premières lignes pour compter les en-têtes reconnus
  const headerKeywords = ["marque", "modele", "modèle", "version", "energie", "énergie",
    "batterie", "autonomie", "puissance", "consommation", "co2", "fiscal", "prix", "loyer"];
  let hits = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    for (const cell of row) {
      if (!cell) continue;
      const cellN = normalize(String(cell));
      for (const kw of headerKeywords) {
        if (cellN === kw || cellN.includes(kw)) {
          hits += cellN === kw ? 3 : 1;
        }
      }
    }
  }
  score += hits;
  score += Math.min(20, rows.length / 5);
  return score;
}

/**
 * Détecte si une ligne est un séparateur (titre de section, ligne décorative)
 * et doit être ignorée. Critères :
 * - Une seule cellule non-vide qui commence par « ▼ », « ▶ », « ━ » ou est
 *   en MAJUSCULES (titre type « FLOTTE ACTUELLE »)
 * - Contient les mots-clés section connus
 */
function isSeparatorRow(row: unknown[]): boolean {
  const nonEmpty = row.filter((c) => c != null && String(c).trim() !== "");
  if (nonEmpty.length === 0) return true;
  if (nonEmpty.length <= 2) {
    const text = nonEmpty.map((c) => String(c).trim()).join(" ");
    if (/^[▼▶►━─]+/.test(text)) return true;
    if (/^(flotte actuelle|propositions? beev|veh icules? actuels?|veh icules? cibles?)/i.test(text)) return true;
    if (/^[A-ZÉÈÀÇ\s]{8,}$/.test(text) && !/[a-z]/.test(text)) return true;
  }
  return false;
}

/**
 * Parse un fichier Excel/CSV et retourne la liste des véhicules détectés.
 * Choisit automatiquement la meilleure feuille (préfère « Import TCO Lovable »
 * sur une éventuelle feuille de synthèse / matrice comparative).
 */
export async function importCarPolicy(file: File): Promise<ImportReport> {
  const warnings: string[] = [];
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  if (wb.SheetNames.length === 0) {
    throw new Error("Le fichier ne contient aucune feuille.");
  }
  // Si plusieurs feuilles, on choisit celle qui maximise un score d'adéquation
  // à un import car policy (nom + densité d'en-têtes reconnus).
  let bestSheetName = wb.SheetNames[0];
  let bestScore = -Infinity;
  for (const sheetName of wb.SheetNames) {
    const sh = wb.Sheets[sheetName];
    const rs: unknown[][] = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: false });
    const sc = scoreSheet(sheetName, rs);
    if (sc > bestScore) {
      bestScore = sc;
      bestSheetName = sheetName;
    }
  }
  const sheet = wb.Sheets[bestSheetName];
  if (wb.SheetNames.length > 1) {
    warnings.push(`Feuille utilisée : « ${bestSheetName} » (sur ${wb.SheetNames.length} feuilles, choisie automatiquement)`);
  }
  // header:1 → renvoie un tableau de tableaux (lignes), pas un AOS.
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
  if (rows.length === 0) {
    throw new Error("La feuille est vide.");
  }

  // Détection de la ligne d'en-tête : on prend la ligne qui contient le PLUS
  // de matches exacts (=) avec les mots-clés synonymes. On évite les matches
  // partiels (.includes) ici pour ne pas être trompé par une ligne du genre
  // « F. Desnoyers (3008 Hybrid …) » qui pourrait contenir « hybrid ».
  let headerRowIdx = -1;
  let bestHits = 0;
  // On scanne jusqu'à 20 lignes pour gérer les feuilles avec titre + sous-titre
  // + séparateur de section avant les vrais en-têtes (cas Axiences × Beev).
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i];
    if (isSeparatorRow(row)) continue;
    const hits = row.reduce<number>((sum, cell) => {
      if (!cell) return sum;
      const cellN = normalize(String(cell));
      let cellScore = 0;
      for (const synonyms of Object.values(COLUMN_SYNONYMS)) {
        for (const syn of synonyms) {
          const synN = normalize(syn);
          if (cellN === synN) { cellScore = Math.max(cellScore, 3); continue; }
          // match partiel uniquement si la cellule est courte (vrai en-tête)
          if (cellN.length <= 30 && cellN.includes(synN)) {
            cellScore = Math.max(cellScore, 1);
          }
        }
      }
      return sum + cellScore;
    }, 0);
    if (hits > bestHits) {
      bestHits = hits;
      headerRowIdx = i;
    }
  }
  if (headerRowIdx < 0 || bestHits < 3) {
    throw new Error("Aucune ligne d'en-tête reconnue. Vérifiez que le fichier contient au moins une ligne avec « Marque », « Modèle », « Prix » ou équivalents.");
  }

  const headerRow = rows[headerRowIdx];
  const dataRows = rows.slice(headerRowIdx + 1);

  // Pour chaque colonne du fichier, on essaie de la mapper à un champ Vehicle.
  // Si plusieurs colonnes matchent le même champ, on garde le meilleur score.
  const fieldToColIdx: Record<string, number> = {};
  const detectedColumns: Record<string, string | null> = {};

  for (const field of Object.keys(COLUMN_SYNONYMS) as Array<keyof typeof COLUMN_SYNONYMS>) {
    let bestIdx = -1;
    let bestScore = 0;
    headerRow.forEach((cell, idx) => {
      if (!cell) return;
      const cellN = normalize(String(cell));
      const score = detectColumn(cellN, COLUMN_SYNONYMS[field]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0 && field === "quantity" && /place|porte|km|jour|mois|cv|kw|cylindre/.test(normalize(String(headerRow[bestIdx])))) {
      bestIdx = -1;
    }
    if (bestIdx >= 0) {
      fieldToColIdx[field] = bestIdx;
      detectedColumns[field] = String(headerRow[bestIdx]);
    } else {
      detectedColumns[field] = null;
    }
  }

  if (fieldToColIdx.brand === undefined && fieldToColIdx.model === undefined) {
    throw new Error("Impossible de trouver les colonnes Marque ou Modèle. Renommez vos colonnes ou vérifiez l'en-tête.");
  }

  // Conversion ligne par ligne
  const vehicles: Vehicle[] = [];
  const seenIds = new Set<string>();
  let unresolved = 0; // lignes non reconnues, ignorées
  let lowRows = 0; // lignes reconnues avec une confiance faible

  // Marqueur de section : si la dernière ligne séparateur traitée contient
  // "flotte actuelle" / "véhicules actuels", les véhicules qui suivent sont
  // de la flotte client à remplacer (isCurrentFleet=true). Sinon (propositions
  // Beev, futur, etc.) → propositions, isCurrentFleet=false.
  let currentSection: "current" | "proposed" = "proposed";

  // Détection des "re-headers" : certains classeurs Excel répètent l'en-tête
  // après chaque sous-section (ex. R4 ET R8 sont des en-têtes dans Axiences ×
  // Beev). On considère qu'une ligne est un re-header si elle a au moins 3
  // cellules qui correspondent à des cellules de l'en-tête de référence.
  const headerCellsNormalized = headerRow.map((c) => c != null ? normalize(String(c)) : "");

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.every((c) => c == null || c === "")) continue; // ligne vide

    // Détection du séparateur de section → met à jour currentSection puis skip
    if (isSeparatorRow(row)) {
      const text = row.filter(Boolean).map((c) => normalize(String(c))).join(" ");
      if (/flotte actuelle|veh icules? actuels?|veh icules? thermiques?|flotte thermique/.test(text)) {
        currentSection = "current";
      } else if (/propositions? beev|veh icules? cibles?|propositions? ev|nouvelle flotte/.test(text)) {
        currentSection = "proposed";
      }
      continue;
    }

    // Détection de re-header : skip si la ligne réplique l'en-tête initial
    const rowNormalized = row.map((c) => c != null ? normalize(String(c)) : "");
    let matchingHeaderCells = 0;
    for (let j = 0; j < Math.min(rowNormalized.length, headerCellsNormalized.length); j++) {
      if (rowNormalized[j] && rowNormalized[j] === headerCellsNormalized[j]) matchingHeaderCells++;
    }
    if (matchingHeaderCells >= 3) continue;

    const get = (field: keyof typeof COLUMN_SYNONYMS): unknown => {
      const idx = fieldToColIdx[field];
      return idx !== undefined ? row[idx] : null;
    };

    const brandCell = String(get("brand") ?? "").trim();
    const modelCell = String(get("model") ?? "").trim();
    if (!brandCell && !modelCell) continue; // ligne sans identification
    if (/^(total|sous total|somme|moyenne|nombre total)\b/.test(normalize(brandCell || modelCell))) continue; // ligne de total
    const versionCell = String(get("version") ?? "").trim();
    const categoryCell = String(get("category") ?? "").trim();
    const lineNo = headerRowIdx + 2 + i;

    // Identification : marque + modèle explicites, sinon reconnaissance du
    // libellé libre (« Peugeot 308 SW 1.5 BlueHDi 130 ») par le dictionnaire.
    const rec = recognizeVehicle([brandCell, modelCell, versionCell].filter(Boolean).join(" "));
    let brand = brandCell;
    let model = modelCell;
    let version = versionCell;
    let identityConf = 0.95;
    if (!(brand && model)) {
      if (rec && rec.brand && rec.model) {
        brand = rec.brand;
        model = rec.model;
        version = rec.version;
        identityConf = rec.confidence;
      } else {
        warnings.push(`Ligne ${lineNo} : véhicule non reconnu (« ${[brandCell, modelCell].filter(Boolean).join(" ").slice(0, 40)} »), ignoré.`);
        unresolved++;
        continue;
      }
    }

    // Segment : colonne du fichier, sinon dictionnaire, sinon « Berline » (à vérifier).
    let category = categoryCell;
    let catConf = categoryCell ? 0.95 : 0;
    const inferred: string[] = [];
    if (!category) {
      if (rec && rec.model && rec.category) { category = rec.category; catConf = 0.9; inferred.push("category"); }
      else { category = "Berline"; catConf = 0.6; }
    }

    // Énergie : colonne du fichier, sinon motorisation du libellé, sinon dictionnaire.
    const guess = inferEnergy(String(get("energy") ?? ""), [modelCell, versionCell, brandCell], rec?.energyHint ?? null);
    if (!guess.explicit) inferred.push("energy");
    const confidence = Math.min(identityConf, guess.confidence, catConf);
    if (confidence < 0.8) lowRows++;

    let id = `imported_${brand}_${model}_${version}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    // Déduplication : si même clé, suffixe numérique
    if (seenIds.has(id)) {
      let n = 2;
      while (seenIds.has(`${id}_${n}`)) n++;
      id = `${id}_${n}`;
    }
    seenIds.add(id);

    const vehicle: Vehicle = {
      id,
      brand,
      model,
      version,
      category,
      energy: guess.energy,
      batteryKwh: parseFrNumber(get("batteryKwh")),
      rangeWltp: parseFrNumber(get("rangeWltp")),
      powerHp: parseFrNumber(get("powerHp")),
      consumption: parseFrNumber(get("consumption")),
      co2: parseFrNumber(get("co2")),
      fiscalHp: parseFrNumber(get("fiscalHp")),
      priceTtc: parseFrNumber(get("priceTtc")),
      monthlyLld: parseFrNumber(get("monthlyLld")),
      image: "", // pas d'image → placeholder côté UI
      custom: true, // marque le véhicule comme issu d'un import (badge dans VehicleCard)
      isCurrentFleet: currentSection === "current", // détecté via section "▼ FLOTTE ACTUELLE"
      trunkLitres: parseFrNumber(get("trunkLitres")) || undefined,
      chargeDcMaxKw: parseFrNumber(get("chargeDcMaxKw")) || undefined,
      chargeAcMaxKw: parseFrNumber(get("chargeAcMaxKw")) || undefined,
      dimensions: String(get("dimensions") ?? "").trim() || undefined,
      chargeTime2080Ac: String(get("chargeTime2080Ac") ?? "").trim() || undefined,
      chargeTime2080Dc: String(get("chargeTime2080Dc") ?? "").trim() || undefined,
    };

    // Km/an et durée du contrat, par véhicule, si les colonnes existent — pour
    // que le Mode Flotte affiche les valeurs réelles de l'Excel (pas une valeur
    // unique pour toute la flotte). Attachés en extra (hors type Vehicle).
    const kmImp = parseFrNumber(get("kmPerYear"));
    const durImp = parseFrNumber(get("durationMonths"));
    if (kmImp > 0) (vehicle as Vehicle & { kmPerYear?: number }).kmPerYear = kmImp;
    if (durImp > 0) (vehicle as Vehicle & { durationMonths?: number }).durationMonths = durImp;
    const qtyImp = Math.round(parseFrNumber(get("quantity")));
    if (qtyImp > 1) (vehicle as Vehicle & { quantity?: number }).quantity = qtyImp;
    // Pastille « reconnu automatiquement » seulement si quelque chose a été déduit.
    if (inferred.length > 0) vehicle.aiMeta = { confidence, inferred, source: "local" };

    vehicles.push(vehicle);
  }

  if (vehicles.length === 0) {
    warnings.unshift("Aucun véhicule importé. Vérifiez le contenu des colonnes Marque et Modèle.");
  }

  return {
    vehicles,
    detectedColumns,
    warnings,
    totalRows: dataRows.length,
    importedRows: vehicles.length,
    engine: "locale",
    needsReview: unresolved > 0 || lowRows > 0,
  };
}
