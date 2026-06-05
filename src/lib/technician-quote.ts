// Parser local de devis technicien (PDF). Aucune dépendance réseau,
// 100 % côté client. Utilise pdfjs-dist pour extraire le texte du PDF
// puis des heuristiques regex pour reconnaître les lignes de prestation.
//
// Cas géré spécifiquement : certains PDFs (ex. Talent Tech) sortent
// les glyphes individuellement avec des espaces parasites entre lettres
// d'un même mot ("F orf a it" au lieu de "Forfait"). Le parser répare
// ciblement les unités IRVE et les marqueurs avant matching.

import * as pdfjsLib from "pdfjs-dist";
// @ts-expect-error -- worker import URL Vite-style
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
  rawText: string;
  warnings: string[];
};

function parseFrNumber(s: string): number {
  const clean = s.replace(/[\s  ]/g, "").replace(",", ".");
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : 0;
}

// Construit un pattern qui matche un mot avec espaces optionnels entre
// chaque lettre (utile pour les PDFs glyphés individuellement).
// loose("forfait") → /\bf[\s ]*o[\s ]*r[\s ]*f[\s ]*a[\s ]*i[\s ]*t\b/i
function looseWord(word: string): string {
  return word.split("").map((c) => {
    // Échappe les caractères regex spéciaux
    if (/[.*+?^${}()|[\]\\]/.test(c)) return "\\" + c;
    // Variantes accentuées tolérées
    if (c === "e") return "[ee\\xe9\\xe8\\xea]";
    return c;
  }).join("[\\s ]*");
}

function caseRespecting(original: string, replacement: string): string {
  const firstLetter = original.replace(/\s/g, "")[0] ?? "";
  if (firstLetter && firstLetter === firstLetter.toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

// Réparation des fragments les plus fréquents : unités IRVE + marqueurs
// du devis. Ciblé et non destructif (ne touche pas aux mots du label).
function repairCommonFragments(text: string): string {
  const unitRepairs: Array<[RegExp, string]> = [
    [new RegExp(`\\b${looseWord("forfait")}s?\\b`, "gi"), "forfait"],
    [new RegExp(`\\b${looseWord("article")}s?\\b`, "gi"), "article"],
    [new RegExp(`\\b${looseWord("piece")}s?\\b`, "gi"), "pièce"],
    [new RegExp(`\\b${looseWord("pièce")}s?\\b`, "gi"), "pièce"],
    [new RegExp(`\\b${looseWord("unite")}s?\\b`, "gi"), "unité"],
    [new RegExp(`\\b${looseWord("unité")}s?\\b`, "gi"), "unité"],
    [new RegExp(`\\b${looseWord("heure")}s?\\b`, "gi"), "heure"],
    [new RegExp(`\\b${looseWord("jour")}s?\\b`, "gi"), "jour"],
    [new RegExp(`\\b${looseWord("metre")}s?\\b`, "gi"), "mètre"],
    [new RegExp(`\\b${looseWord("mètre")}s?\\b`, "gi"), "mètre"],
  ];
  let out = text;
  for (const [re, repl] of unitRepairs) {
    out = out.replace(re, (match) => {
      const isPlural = /s\b/i.test(match);
      const word = isPlural ? repl + "s" : repl;
      return caseRespecting(match, word);
    });
  }
  // Termes IRVE/électriques courants — apparaissent dans la majorité des
  // devis techniciens donc valent une réparation ciblée pour rendre les
  // labels lisibles dès le 1er affichage.
  const techTerms = [
    "triphasé", "triphase", "monophasé", "monophase", "tranchée", "tranchee",
    "répartiteur", "repartiteur", "bornier", "borne", "tableau", "câble",
    "cable", "dalle", "béton", "beton", "regard", "fourniture", "réalisation",
    "realisation", "création", "creation", "installation", "raccordement",
    "électrique", "electrique", "disjoncteur", "compteur", "armoire",
    "passage", "fixation", "pose", "câblage", "cablage", "section",
  ];
  for (const term of techTerms) {
    const re = new RegExp(`\\b${looseWord(term)}s?\\b`, "gi");
    out = out.replace(re, (match) => {
      const isPlural = /s\b/i.test(match);
      const word = isPlural ? term + "s" : term;
      return caseRespecting(match, word);
    });
  }
  // Marqueurs de devis (préservent la casse)
  const markerRepairs: Array<[RegExp, string]> = [
    [new RegExp(`\\b${looseWord("Total")}\\s+${looseWord("HT")}\\b`, "gi"), "Total HT"],
    [new RegExp(`\\b${looseWord("Total")}\\s+${looseWord("TTC")}\\b`, "gi"), "Total TTC"],
    [new RegExp(`\\b${looseWord("Montant")}\\s+${looseWord("HT")}\\b`, "gi"), "Montant HT"],
    [new RegExp(`\\b${looseWord("Devis")}\\s+N\\s*[°o]`, "gi"), "Devis N°"],
    [new RegExp(`\\b${looseWord("Date")}\\s+d['\\u2019\\s]*${looseWord("emission")}`, "gi"), "Date d'émission"],
    [new RegExp(`\\b${looseWord("Date")}\\s+d['\\u2019\\s]*${looseWord("émission")}`, "gi"), "Date d'émission"],
    [new RegExp(`\\b${looseWord("Designation")}\\b`, "gi"), "Désignation"],
    [new RegExp(`\\b${looseWord("Désignation")}\\b`, "gi"), "Désignation"],
    [new RegExp(`\\b${looseWord("Quantite")}\\b`, "gi"), "Quantité"],
    [new RegExp(`\\b${looseWord("Quantité")}\\b`, "gi"), "Quantité"],
  ];
  for (const [re, repl] of markerRepairs) {
    out = out.replace(re, repl);
  }
  return out;
}

const UNIT_REGEX = "(?:forfait|forfaits|article|articles|ml|ens|kit|jours?|j|heures?|h|pi[èe]ces?|unit[ée]s?|m[èe]tres?|u\\b|m\\b)";

// Queue de ligne format A : qty UNIT PU TVA% total (style Talent Tech)
const LINE_TAIL_WITH_UNIT = new RegExp(
  `(\\d+(?:[.,]\\d{1,3})?)\\s+(${UNIT_REGEX})\\s+([\\d\\s\\u00a0]+[.,]\\d{2})\\s+(\\d{1,2})\\s*%\\s+([\\d\\s\\u00a0]+[.,]\\d{2})`,
  "i",
);

// Queue de ligne format B : qty PU TVA% total (sans colonne unité —
// style FIR Energies & Services). Le PU et le total doivent avoir 2
// décimales pour éviter de matcher de fausses lignes (ex. adresse postale).
const LINE_TAIL_NO_UNIT = new RegExp(
  `(\\d+(?:[.,]\\d{1,3})?)\\s+([\\d\\s\\u00a0]+[.,]\\d{2})\\s+(\\d{1,2})\\s*%\\s+([\\d\\s\\u00a0]+[.,]\\d{2})`,
  "i",
);

const EXCLUDE_LINE = /^(total ht|tva\b|total ttc|sous[- ]total|remise globale|net à payer|escompte|acompte|page \d|signature|sas au capital|siren\b|siret\b|tva intr)/i;
const EXCLUDE_LABEL = /^(d[ée]signation|montant ht|prix unitaire|qte|qté|quantit|tva|unit[ée])$/i;

async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const allLines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const items = (tc.items as Array<{ str: string; transform: number[]; height?: number; width?: number }>).filter((it) => it.str.length > 0);
    if (items.length === 0) continue;
    const avgH = items.reduce((s, it) => s + (it.height ?? 10), 0) / items.length;
    const yTol = Math.max(3, avgH * 0.4);
    const spaceW = avgH * 0.3;
    const colW = avgH * 1.4;

    const byY = new Map<number, { x: number; w: number; str: string }[]>();
    for (const it of items) {
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      const w = it.width ?? it.str.length * avgH * 0.5;
      const bucket = Array.from(byY.entries()).find(([by]) => Math.abs(by - y) <= yTol);
      const key = bucket ? bucket[0] : y;
      const arr = byY.get(key) ?? [];
      arr.push({ x, w, str: it.str });
      byY.set(key, arr);
    }
    const ys = Array.from(byY.keys()).sort((a, b) => b - a);
    for (const y of ys) {
      const cells = byY.get(y)!.sort((a, b) => a.x - b.x);
      let line = "";
      let prevEnd = -Infinity;
      for (const it of cells) {
        const s = it.str;
        if (!s) continue;
        const gap = it.x - prevEnd;
        if (line === "") {
          line = s;
        } else if (gap < spaceW * 0.5) {
          line += s;
        } else if (gap < colW) {
          line += (line.endsWith(" ") ? "" : " ") + s.replace(/^\s+/, "");
        } else {
          line += "  " + s.replace(/^\s+/, "");
        }
        prevEnd = it.x + it.w;
      }
      line = line.replace(/[ \t]+/g, " ").trim();
      if (line) allLines.push(line);
    }
  }
  // Réparation ciblée des fragments connus (unités, marqueurs)
  return repairCommonFragments(allLines.join("\n"));
}

function detectMeta(text: string): { supplier: string; quoteNumber: string; quoteDate: string; totalHt: number } {
  let supplier = "";
  const allLines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const siretIdx = allLines.findIndex((l) => /SIRET\s*[:.]?\s*\d/i.test(l));
  if (siretIdx > 0) {
    for (let i = siretIdx - 1; i >= Math.max(0, siretIdx - 8); i--) {
      const cand = allLines[i];
      if (/^(SAS|SARL|SA|SASU|EURL|EI|SCI|SCOP|GIE)\b/i.test(cand) && !/^beev\b/i.test(cand)) {
        supplier = cand;
        break;
      }
    }
  }
  if (!supplier) {
    supplier = allLines.find((l) => /^(SAS|SARL|SA|SASU|EURL)\b/i.test(l) && !/^beev/i.test(l)) ?? "";
  }

  const numM = text.match(/Devis\s*N[°o]?\s*[:.]?\s*([A-Z0-9\-_/]+)/i);
  const quoteNumber = numM?.[1] ?? "";

  const dateM = text.match(/Date\s+d['’]?\s*[ée]mission\s*[:.]?\s*(\d{2}\/\d{2}\/\d{4})/i)
    ?? text.match(/(\d{2}\/\d{2}\/\d{4})/);
  let quoteDate = "";
  if (dateM?.[1]) {
    const [d, m, y] = dateM[1].split("/");
    quoteDate = `${y}-${m}-${d}`;
  }

  const totalCandidates = [
    /Total\s+HT\s*[:.]?\s*([\d\s ]+[.,]\d{2})\s*€?/i,
    /Montant\s+HT\s*[:.]?\s*([\d\s ]+[.,]\d{2})\s*€?/i,
  ];
  let totalHt = 0;
  for (const re of totalCandidates) {
    const m = text.match(re);
    if (m) {
      totalHt = parseFrNumber(m[1]);
      if (totalHt > 0) break;
    }
  }

  return { supplier, quoteNumber, quoteDate, totalHt };
}

// Nettoie les espaces parasites isolés dans un label déjà bien structuré.
// On retire les espaces simples entre une lettre seule et une lettre seule
// (heuristique très conservatrice : ne touche qu'aux séquences A B C de
// lettres isolées). Utile pour rendre "T riph a sé" → "Triphasé" sans
// affecter "5 Rue Pleyel" ou "de la borne".
function softCleanLabel(label: string): string {
  // Coller un caractère seul à son voisin gauche si voisin gauche fait > 1 char lettres
  let out = label;
  for (let iter = 0; iter < 10; iter++) {
    const before = out;
    out = out.replace(/([A-Za-zÀ-ÿ]{2,})\s+([A-Za-zÀ-ÿ])\s+([A-Za-zÀ-ÿ]{1,3})\b/g, (_, a, b, c) => `${a}${b}${c}`);
    if (out === before) break;
  }
  return out;
}

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
    if (EXCLUDE_LABEL.test(line)) {
      labelBuffer = [];
      continue;
    }

    // On essaie d'abord le format A (avec unité forfait/article/…), puis le
    // format B (sans unité, ex. SASU FIR Energies). Le premier qui matche
    // gagne. Le format B est plus permissif donc on le teste en second pour
    // éviter de faux positifs.
    let qtyStr: string | undefined;
    let unitStr: string | undefined;
    let puStr: string | undefined;
    let totalStr: string | undefined;
    let matchIndex = -1;
    const tailA = line.match(LINE_TAIL_WITH_UNIT);
    if (tailA) {
      [, qtyStr, unitStr, puStr, , totalStr] = tailA;
      matchIndex = tailA.index!;
    } else {
      const tailB = line.match(LINE_TAIL_NO_UNIT);
      if (tailB) {
        [, qtyStr, puStr, , totalStr] = tailB;
        unitStr = "u"; // unité par défaut quand le devis n'en fournit pas
        matchIndex = tailB.index!;
      }
    }

    if (qtyStr && puStr && totalStr && unitStr) {
      const qty = parseFrNumber(qtyStr);
      const unitHt = parseFrNumber(puStr);
      const total = parseFrNumber(totalStr);

      const beforeMatch = line.slice(0, matchIndex).trim();
      const labelRaw = [...labelBuffer, beforeMatch].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      // Retire l'astérisque de début de ligne typique de certains devis
      const label = softCleanLabel(labelRaw).replace(/^\*\s*/, "").trim();
      labelBuffer = [];

      if (!label) {
        warnings.push("Ligne détectée sans désignation, ignorée.");
        continue;
      }

      if (Math.abs(qty * unitHt - total) > 1 && total > 0) {
        warnings.push(`Ligne "${label.slice(0, 40)}…" : qté×PU (${(qty * unitHt).toFixed(2)}) ≠ total devis (${total.toFixed(2)}).`);
      }

      lines.push({
        label,
        qty: qty || 1,
        unit: unitStr.toLowerCase(),
        unitHt,
      });
    } else {
      if (labelBuffer.length < 6) labelBuffer.push(line);
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
    warnings.unshift("Aucune ligne de prestation détectée automatiquement. Format non standard — ajoutez les lignes manuellement via le bouton + ci-dessous.");
  }

  return { ...meta, lines, rawText, warnings };
}

export async function parseTechnicianQuoteFromUrl(pdfUrl: string): Promise<ParsedQuote> {
  if (!pdfUrl) throw new Error("URL manquante.");
  const resp = await fetch(pdfUrl);
  if (!resp.ok) throw new Error(`Téléchargement du PDF échoué (${resp.status}).`);
  const blob = await resp.blob();
  const file = new File([blob], "devis.pdf", { type: blob.type || "application/pdf" });
  return parseTechnicianQuote(file);
}
