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

// `uni\b` couvre l'abréviation "Uni" (3 lettres) utilisée par certains
// devis (ex. IRO Energie Bretagne) sans matcher "univers", "uniforme", etc.
const UNIT_REGEX = "(?:forfait|forfaits|article|articles|ml|ens|kit|jours?|j|heures?|h|pi[èe]ces?|unit[ée]s?|uni\\b|m[èe]tres?|u\\b|m\\b)";

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

// Queue de ligne format C : UNIT PU€ qty total€ (style IRO Energie Bretagne)
// - Pas de colonne TVA % (TVA calculée globalement en bas du devis)
// - Montants entiers ou décimaux acceptés (« 870€ », « 96,50€ »)
// - Symbole € obligatoire sur PU ET sur total pour cibler ce format précisément
//   (sans le €, on matcherait des séquences numériques bénignes du label)
// - Ordre des colonnes : Unité, PU, Qté, Total (contrairement aux formats A/B)
const LINE_TAIL_UNIT_NO_VAT = new RegExp(
  `\\b(${UNIT_REGEX})\\s+([\\d\\s\\u00a0]+(?:[.,]\\d{1,2})?)\\s*€\\s+(\\d+(?:[.,]\\d{1,3})?)\\s+([\\d\\s\\u00a0]+(?:[.,]\\d{1,2})?)\\s*€`,
  "i",
);

// Format E : PU€ QTÉ [unité] MONTANT€ — deux marqueurs € par ligne, sans
// colonne TVA (style Axonaut, Gs Network, Henrri…). C'est le format le plus
// courant des devis IRVE PME. Particularités gérées :
//  - PU avec 2 ou 3 décimales (« 552,162 € », « 45,710 € »)
//  - séparateur de milliers en groupes de 3 chiffres EXACTS (« 2 786,000 »),
//    pour ne pas avaler les chiffres d'une référence collée (« RAL9010 »)
//  - ambiguïté de l'espace (« 18 822,78 » = qté 18 + montant 822,78) levée par
//    l'invariant qté × PU ≈ montant au moment de la validation
//  - regex GLOBALE : plusieurs lignes de devis fusionnées dans un même bloc de
//    texte (extraction PDF imparfaite) produisent plusieurs lignes détectées.
const NUM3 = "\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})*"; // entier + séparateur milliers
const LINE_E_GLOBAL = new RegExp(
  `(${NUM3},\\d{2,3})\\s*€\\s+(\\d+)\\s*([a-zà-ÿ²]{1,4})?\\s+(${NUM3},\\d{2})\\s*€`,
  "gi",
);

const EXCLUDE_LINE = /^(total ht|tva\b|total ttc|sous[- ]total|base ht|base d'imposition|remise globale|net à payer|escompte|acompte|page \d|signature|sas au capital|siren\b|siret\b|tva intr|description\b.*(prix|quantit|montant))/i;
const EXCLUDE_LABEL = /^(d[ée]signation|montant ht|prix unitaire|qte|qté|quantit|tva|unit[ée])$/i;

// Certains devis (ex. RIEUX&CO) terminent par une page « Récapitulatif » qui
// reliste, sous forme de lignes qté×PU=total, les MÊMES sous-totaux déjà
// détectés dans le détail des prestations (ex. « 1 Prestations 1,00
// 10 790,00 10 790,00 » = le total du devis entier présenté comme une ligne
// « qté 1 »). Sans coupure, le format D générique les détecte comme des
// lignes valides et double-compte tout le devis. Dès qu'on rencontre ce
// marqueur, on arrête la détection : tout ce qui suit est un doublon.
const RECAP_SECTION = /\br[ée]capitulatif\b/i;

// Numéro de repère en tête de ligne (« 1.1.1 », « 1.4 », « 1 ») utilisé par
// les devis à plan numéroté (TGBT, Tranchée, Tirage de câble...). Ce n'est
// pas une donnée de quantité/prix — mais un fragment comme « 1.2.2 » se
// tokenise en deux nombres parasites (1.2 et 2) qui peuvent se faire passer
// pour qté/PU par le format D générique sur une ligne SANS prix réel (ex.
// prestation non chiffrée), au lieu d'être correctement ignorée. Retiré
// uniquement pour le format D — les formats A/B/C/E exigent un marqueur
// (unité, €, %) qu'un numéro de repère ne peut jamais produire.
const LEADING_REF_NUM = /^\d+(?:\.\d+){0,4}\s+/;

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

  // Total HT — accepte montants avec ou sans décimales (« 3 646,00 € »
   // ou « 3646 € »). On essaie en priorité les variantes avec décimales pour
   // éviter de matcher accidentellement un fragment de numéro de TVA / SIRET.
  const totalCandidates = [
    /Total\s+HT\s*[:.]?\s*([\d\s ]+[.,]\d{2})\s*€?/i,
    /Montant\s+HT\s*[:.]?\s*([\d\s ]+[.,]\d{2})\s*€?/i,
    /Total\s+HT\s*[:.]?\s*([\d\s ]+)\s*€/i,
    /Montant\s+HT\s*[:.]?\s*([\d\s ]+)\s*€/i,
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

// ─── Format D : détecteur générique (dernier recours) ──────────────────
// Les devis techniciens sont tous différents : ordre de colonnes variable,
// présence ou non d'une colonne unité, d'une colonne TVA %, du symbole €…
// Plutôt que d'ajouter un Nième regex par format, ce détecteur extrait les
// nombres en fin de ligne et identifie qté / PU / total via l'invariant
// arithmétique qté × PU ≈ total. Il couvre notamment le format « qté PU€
// total€ » (sans unité ni TVA par ligne) qui échappait aux formats A/B/C.

type ValueToken = {
  value: number;
  euro: boolean;
  pct: boolean;
  decimals: boolean;
  start: number;
};

// Extrait tous les nombres d'une ligne, avec leur position et leurs signaux
// (€, %, décimales). Gère le séparateur de milliers FR (espace/insécable).
function extractValueTokens(line: string): ValueToken[] {
  const re = /(\d{1,3}(?:[\s ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,3})?)\s*(€|%)?/g;
  const tokens: ValueToken[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const raw = m[1];
    const sym = m[2];
    tokens.push({
      value: parseFrNumber(raw),
      euro: sym === "€",
      pct: sym === "%",
      decimals: /[.,]\d/.test(raw),
      start: m.index,
    });
  }
  return tokens;
}

function tryGenericLine(
  line: string,
): { qty: number; unit: string; unitHt: number; total: number; labelEnd: number } | null {
  const tokens = extractValueTokens(line);
  // On ignore les pourcentages (colonne TVA) pour ne garder que quantités
  // et montants.
  const amounts = tokens.filter((t) => !t.pct);
  if (amounts.length < 2) return null;

  const total = amounts[amounts.length - 1];
  const pu = amounts[amounts.length - 2];
  if (pu.value <= 0 || total.value <= 0) return null;
  // Signal monétaire : € ou 2 décimales sur PU ou total. Sa présence permet
  // une tolérance d'arrondi ; son absence (montants entiers nus) impose une
  // égalité quasi exacte pour rester sûr face aux références techniques.
  const monetarySignal = pu.euro || pu.decimals || total.euro || total.decimals;

  // Cas le plus courant : 3 valeurs en fin de ligne = qté, PU, total.
  // On valide par l'invariant qté × PU ≈ total.
  if (amounts.length >= 3) {
    const qtyTok = amounts[amounts.length - 3];
    const qtyVal = qtyTok.value;
    // Sans signal monétaire, on n'accepte ce chemin que sous garde renforcée :
    // PU ≥ 10 et qté entière. Ces gardes éliminent les coïncidences de
    // comptage (« Coffret 3 phases 4 modules 12 » → 3×4=12) sans perdre les
    // forfaits réels en euros ronds (PU généralement ≥ 50 €).
    const pathOk = qtyVal > 0 && qtyVal <= 100000
      && (monetarySignal || (pu.value >= 10 && Number.isInteger(qtyVal)));
    if (pathOk) {
      // Avec signal monétaire : tolérance 8 % (arrondis). Sans signal
      // (ex. « Forfait mise en service 1 350 350 ») : égalité exacte (≤ 1 €).
      const tol = monetarySignal ? Math.max(2, total.value * 0.08) : 1;
      if (Math.abs(qtyVal * pu.value - total.value) <= tol) {
        // Détecte une unité (ml, h, jour…) située entre la qté et le PU,
        // sinon "u" par défaut. Préserve l'unité que les formats stricts
        // auraient reconnue (ex. « 45 ml 32,50 1 462,50 »).
        const between = line.slice(qtyTok.start, pu.start);
        const um = between.match(new RegExp(`\\b(${UNIT_REGEX})\\b`, "i"));
        const unit = um ? um[1].toLowerCase() : "u";
        return { qty: qtyVal, unit, unitHt: pu.value, total: total.value, labelEnd: qtyTok.start };
      }
    }
  }
  // Repli : 2 valeurs (PU, total) avec qté implicite 1, si PU ≈ total. Exige
  // un signal monétaire (sans lui, deux entiers proches sont trop ambigus).
  if (monetarySignal) {
    const tol = Math.max(2, total.value * 0.08);
    if (Math.abs(pu.value - total.value) <= tol) {
      return { qty: 1, unit: "u", unitHt: pu.value, total: total.value, labelEnd: pu.start };
    }
  }
  return null;
}

function detectLines(rawText: string): { lines: ParsedQuoteLine[]; warnings: string[] } {
  const warnings: string[] = [];
  const lines: ParsedQuoteLine[] = [];
  const textLines = rawText.split("\n");
  let labelBuffer: string[] = [];

  for (const rawLine of textLines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (RECAP_SECTION.test(line)) break;
    if (EXCLUDE_LINE.test(line)) {
      labelBuffer = [];
      continue;
    }
    if (EXCLUDE_LABEL.test(line)) {
      labelBuffer = [];
      continue;
    }
    const refM = line.match(LEADING_REF_NUM);
    const refPrefixLen = refM ? refM[0].length : 0;
    const lineForNumbers = line.slice(refPrefixLen);

    // Format E (PU€ qté montant€) — testé EN PREMIER car le plus courant et
    // le plus discriminant (2 marqueurs €, pas de TVA par ligne). Regex
    // globale : émet une ligne par couple détecté, ce qui récupère aussi les
    // cas où l'extraction PDF a fusionné plusieurs lignes du devis en un bloc.
    const eMatches = [...line.matchAll(LINE_E_GLOBAL)];
    if (eMatches.length > 0) {
      const accepted: ParsedQuoteLine[] = [];
      let cursor = 0;
      for (const mm of eMatches) {
        const pu = parseFrNumber(mm[1]);
        const qty = parseFrNumber(mm[2]);
        const unit = (mm[3] || "u").toLowerCase();
        const montant = parseFrNumber(mm[4]);
        // Invariant qté × PU ≈ montant : valide la découpe des espaces
        // (« 18 822,78 » → qté 18 / montant 822,78). Tolérance arrondi 6 %.
        if (montant > 0 && Math.abs(qty * pu - montant) > Math.max(2, montant * 0.06)) {
          continue;
        }
        const labelSeg = line.slice(cursor, mm.index!).trim();
        cursor = mm.index! + mm[0].length;
        const labelParts = accepted.length === 0 ? [...labelBuffer, labelSeg] : [labelSeg];
        const label = softCleanLabel(labelParts.filter(Boolean).join(" ")).replace(/^\*\s*/, "").trim();
        if (!label) continue;
        accepted.push({ label, qty: qty || 1, unit, unitHt: pu });
      }
      if (accepted.length > 0) {
        lines.push(...accepted);
        labelBuffer = [];
        continue;
      }
    }

    // On essaie ensuite successivement les formats à colonne TVA / unité :
    //  A : qty UNIT PU TVA% total  (Talent Tech)
    //  B : qty PU TVA% total       (FIR Energies, sans colonne unité)
    //  C : UNIT PU€ qty total€     (IRO Energie Bretagne, sans TVA par ligne)
    //  D : générique (dernier recours, invariant qté × PU ≈ total)
    // Le premier qui matche gagne.
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
      const tailC = line.match(LINE_TAIL_UNIT_NO_VAT);
      if (tailC) {
        // Format C : on extrait UNIT, PU, QTÉ, TOTAL (dans cet ordre)
        [, unitStr, puStr, qtyStr, totalStr] = tailC;
        matchIndex = tailC.index!;
        // Cohérence : qty × PU doit approcher total (tolérance 5 % ou 1 €
        // selon le plus grand) — sinon on rejette pour éviter un faux positif
        const qtyCheck = parseFrNumber(qtyStr);
        const puCheck = parseFrNumber(puStr);
        const totCheck = parseFrNumber(totalStr);
        if (totCheck > 0) {
          const expected = qtyCheck * puCheck;
          const tolerance = Math.max(1, totCheck * 0.05);
          if (Math.abs(expected - totCheck) > tolerance) {
            // pas cohérent → on retombe sur le format B
            qtyStr = unitStr = puStr = totalStr = undefined;
            matchIndex = -1;
          }
        }
      }
      if (!qtyStr) {
        const tailB = line.match(LINE_TAIL_NO_UNIT);
        if (tailB) {
          [, qtyStr, puStr, , totalStr] = tailB;
          unitStr = "u"; // unité par défaut quand le devis n'en fournit pas
          matchIndex = tailB.index!;
        }
      }
      // Format D générique — dernier recours pour les devis non standard.
      // On retire le numéro de repère de tête (cf. LEADING_REF_NUM) avant
      // extraction pour ne pas le confondre avec qté/PU, puis on rajoute sa
      // longueur à labelEnd pour repositionner la coupure sur la ligne
      // ORIGINALE (matchIndex sert plus bas à découper `line`, pas
      // `lineForNumbers`).
      if (!qtyStr) {
        const gen = tryGenericLine(lineForNumbers);
        if (gen) {
          qtyStr = String(gen.qty);
          puStr = String(gen.unitHt);
          totalStr = String(gen.total);
          unitStr = gen.unit;
          matchIndex = gen.labelEnd + refPrefixLen;
        }
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
