// Parser local de devis technicien (PDF). Aucune dépendance réseau,
// 100 % côté client. Utilise pdfjs-dist pour extraire le texte du PDF
// puis des heuristiques regex pour reconnaître les lignes de prestation.
//
// Calibré principalement sur le format Talent Tech (devis MOBILITAS),
// mais s'adapte aux formats similaires (5 colonnes Désignation/Qté/
// Unité/Prix unitaire/TVA/Montant HT).
//
// Si la détection échoue, le commercial peut toujours ajouter / éditer
// les lignes manuellement dans la dialog d'import.

import * as pdfjsLib from "pdfjs-dist";
// Vite gère ce worker via import.meta.url
// (https://github.com/mozilla/pdf.js/wiki/Setup-pdf.js-in-a-website#using-pdfjs-with-vite)
// @ts-expect-error -- import worker URL
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type ParsedQuoteLine = {
  label: string;
  qty: number;
  unit: string;
  unitHt: number;
};

export type ParsedQuote = {
  supplier: string;
  quoteNumber: string;
  quoteDate: string;
  totalHt: number;
  lines: ParsedQuoteLine[];
  /** Texte brut du PDF (utile pour debug et fallback affichage). */
  rawText: string;
  /** Liste des warnings non bloquants rencontrés pendant le parsing. */
  warnings: string[];
};

// Convertit un nombre au format FR "1 234,56" ou "798,00" en number JS
function parseFrNumber(s: string): number {
  const clean = s.replace(/\s| /g, "").replace(",", ".");
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : 0;
}

// Unités acceptées dans un devis IRVE typique
const UNIT_REGEX = "(?:forfait|forfaits|article|articles|m|ml|h|heure|heures|u|unité|unités|jour|jours|j|pièce|pieces|piece|ens|kit)";

// Pattern de fin de ligne : <qté>,XX <unité> <PU>,XX <TVA>% <Montant>,XX
//   - qty : 1 ou 2 décimales optionnelles, virgule ou point
//   - prix : peut contenir des espaces (séparateur milliers)
const LINE_TAIL = new RegExp(
  `(\\d+(?:[.,]\\d{1,3})?)\\s+(${UNIT_REGEX})\\s+([\\d\\s\\u00a0]+[.,]\\d{2})\\s+(\\d{1,2})\\s*%\\s+([\\d\\s\\u00a0]+[.,]\\d{2})`,
  "i",
);

// Lignes à exclure systématiquement
const EXCLUDE_LINE = /^(total ht|tva|total ttc|sous[- ]total|remise globale|net à payer|escompte|acompte|page \d|signature)/i;
const EXCLUDE_LABEL = /^(d[ée]signation|montant ht|prix unitaire|qte|qté|quantit|tva|unit[ée])$/i;

async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const allLines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    // On regroupe les items par ligne (même Y, à 2 pixels près)
    const byY = new Map<number, { x: number; str: string }[]>();
    for (const it of tc.items as Array<{ str: string; transform: number[] }>) {
      if (!it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      const bucket = Array.from(byY.entries()).find(([by]) => Math.abs(by - y) <= 2);
      const key = bucket ? bucket[0] : y;
      const arr = byY.get(key) ?? [];
      arr.push({ x, str: it.str });
      byY.set(key, arr);
    }
    // Tri descendant par Y (haut → bas), puis ascendant par X (gauche → droite)
    const ys = Array.from(byY.keys()).sort((a, b) => b - a);
    for (const y of ys) {
      const items = byY.get(y)!.sort((a, b) => a.x - b.x);
      const line = items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
      if (line) allLines.push(line);
    }
  }
  return allLines.join("\n");
}

function detectMeta(text: string): { supplier: string; quoteNumber: string; quoteDate: string; totalHt: number } {
  const supplierM = text.match(/^([A-ZÉÈÀÂÊÎÔÛÇ][A-Za-zÀ-ÿ&'.\- ]{2,60}?)$/m);
  const supplier = supplierM?.[1]?.trim() ?? "";

  const numM = text.match(/Devis\s*N[°o]\s*[:.]?\s*([A-Z0-9\-_/]+)/i);
  const quoteNumber = numM?.[1] ?? "";

  const dateM = text.match(/Date d'?[ée]mission\s*[:.]?\s*(\d{2}\/\d{2}\/\d{4})/i)
    ?? text.match(/(\d{2}\/\d{2}\/\d{4})/);
  let quoteDate = "";
  if (dateM?.[1]) {
    const [d, m, y] = dateM[1].split("/");
    quoteDate = `${y}-${m}-${d}`;
  }

  const totalM = text.match(/Total\s+HT\s+([\d\s ]+[.,]\d{2})/i);
  const totalHt = totalM ? parseFrNumber(totalM[1]) : 0;

  return { supplier, quoteNumber, quoteDate, totalHt };
}

// Découpe le texte brut en blocs "ligne de prestation" avec leur label
// multi-lignes accumulé. Une nouvelle ligne de prestation est détectée
// quand le pattern LINE_TAIL est rencontré ; les lignes précédentes
// non-numériques deviennent le label.
function detectLines(rawText: string): { lines: ParsedQuoteLine[]; warnings: string[] } {
  const warnings: string[] = [];
  const lines: ParsedQuoteLine[] = [];
  const textLines = rawText.split("\n");
  let labelBuffer: string[] = [];

  for (const rawLine of textLines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (EXCLUDE_LINE.test(line)) {
      labelBuffer = [];
      continue;
    }
    // Skip en-tête de colonnes
    if (EXCLUDE_LABEL.test(line)) {
      labelBuffer = [];
      continue;
    }

    // La queue numérique peut être sur la même ligne que le début du label,
    // ou sur sa propre ligne après plusieurs lignes de label.
    const tail = line.match(LINE_TAIL);
    if (tail) {
      const [, qtyStr, unitStr, puStr, , totalStr] = tail;
      const qty = parseFrNumber(qtyStr);
      const unitHt = parseFrNumber(puStr);
      const total = parseFrNumber(totalStr);

      // Label = ce qui précède le pattern sur cette même ligne + buffer accumulé
      const beforeMatch = line.slice(0, tail.index!).trim();
      const label = [...labelBuffer, beforeMatch].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      labelBuffer = [];

      if (!label) {
        warnings.push("Ligne détectée sans désignation, ignorée.");
        continue;
      }

      // Cohérence qty × PU ≈ total : si écart > 1 €, on garde quand même
      // mais on ajoute un warning
      if (Math.abs(qty * unitHt - total) > 1 && total > 0) {
        warnings.push(`Ligne "${label.slice(0, 40)}…" : qté×PU (${(qty * unitHt).toFixed(2)}) ≠ total devis (${total.toFixed(2)}).`);
      }

      lines.push({
        label,
        qty: qty || 1,
        unit: unitStr.toLowerCase(),
        unitHt: unitHt,
      });
    } else {
      // Pas de queue numérique → c'est du label en construction
      // On limite à 5 lignes consécutives pour éviter d'accumuler les
      // paragraphes hors tableau
      if (labelBuffer.length < 5) labelBuffer.push(line);
    }
  }
  return { lines, warnings };
}

export async function parseTechnicianQuote(file: File): Promise<ParsedQuote> {
  if (!file) throw new Error("Fichier manquant.");
  if (file.type && !file.type.includes("pdf")) {
    throw new Error("Seuls les PDF sont supportés en extraction automatique.");
  }
  const rawText = await extractPdfText(file);
  if (!rawText.trim()) {
    throw new Error("Aucun texte extrait du PDF. Probablement un PDF scanné (image) — saisissez les lignes à la main.");
  }
  const meta = detectMeta(rawText);
  const { lines, warnings } = detectLines(rawText);

  if (lines.length === 0) {
    warnings.unshift("Aucune ligne de prestation détectée. Vérifiez le format du devis ou ajoutez manuellement.");
  }

  return {
    ...meta,
    lines,
    rawText,
    warnings,
  };
}

// Téléchargement du PDF depuis une URL Supabase Storage puis parsing.
// Utilisé quand le PDF est déjà uploadé dans technicianQuoteUrl.
export async function parseTechnicianQuoteFromUrl(pdfUrl: string): Promise<ParsedQuote> {
  if (!pdfUrl) throw new Error("URL manquante.");
  const resp = await fetch(pdfUrl);
  if (!resp.ok) throw new Error(`Téléchargement du PDF échoué (${resp.status}).`);
  const blob = await resp.blob();
  const file = new File([blob], "devis.pdf", { type: blob.type || "application/pdf" });
  return parseTechnicianQuote(file);
}
