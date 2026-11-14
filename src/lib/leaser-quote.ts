// Devis loueur → format Beev commun.
//
// Les loueurs (Ayvens, Arval, BPCE Car Lease, Alphabet…) envoient chacun un devis
// PDF avec leur propre vocabulaire. Ce module ramène ces devis à UN modèle
// (LeaserQuote), lu automatiquement depuis le texte du PDF, avec pour chaque
// information douteuse un drapeau « à vérifier » : une personne confirme avant
// l'envoi au client. Rien n'est inventé : une donnée absente reste absente.
//
// 100 % côté client : pdfjs-dist pour le texte, des expressions régulières pour
// la lecture, aucune API externe.

import type { Vehicle } from "./catalog";
import { AEN_ABATTEMENT_MAX_AN, AEN_PLAFOND_PCT_PRIX } from "./tco-calculator";

// ============================================================================
// Modèle commun
// ============================================================================

export type LeaserId = "ayvens" | "arval" | "bpce" | "alphabet" | "vwbank" | "autre";

export const LEASER_LABEL: Record<LeaserId, string> = {
  ayvens: "Ayvens",
  arval: "Arval",
  bpce: "BPCE Car Lease",
  alphabet: "Alphabet",
  vwbank: "Volkswagen Bank",
  autre: "Autre loueur",
};

/** Prestations suivies sur chaque devis : 1 = incluse, 0 = exclue / non proposée,
 *  null = non précisée sur le devis. */
export type ScopeValue = 1 | 0 | null;
export type ScopeKey = "maint" | "assist" | "pneus" | "dom" | "rc" | "pf" | "relais" | "cg";
export const SCOPE_LABELS: [ScopeKey, string][] = [
  ["maint", "Entretien"],
  ["assist", "Assistance 24/24"],
  ["pneus", "Pneumatiques"],
  ["dom", "Assurance dommages"],
  ["rc", "Responsabilité civile"],
  ["pf", "Perte financière"],
  ["relais", "Véhicule relais"],
  ["cg", "Carte grise"],
];
export type QuoteScope = Record<ScopeKey, ScopeValue>;

/** Catégorie d'une ligne de loyer : financement, entretien et assistance,
 *  assurance et garanties, gestion. */
export type RentCat = "fin" | "ent" | "ass" | "ges";
export const RENT_CAT_LABEL: Record<RentCat, string> = {
  fin: "Financement",
  ent: "Entretien et assistance",
  ass: "Assurance et garanties",
  ges: "Gestion",
};

export type RentLine = {
  cat: RentCat;
  label: string;
  detail?: string;
  amount: number; // TTC / mois
  /** Montant déduit par Beev (total − autres lignes), pas lu sur le devis. */
  derived?: boolean;
};

export type QuoteOption = { name: string; priceTtc: number | null };

/** Point à confirmer. `check` = lu mais incertain, `absent` = introuvable. */
export type QuoteFlag = { field: string; status: "check" | "absent"; note: string };

export type LeaserQuote = {
  id: string;
  leaser: LeaserId;
  leaserLabel: string;
  channel: string;
  fileName: string;
  offerNumber: string;
  dateIso: string; // AAAA-MM-JJ
  validityDays: number | null;
  validityMonths: number | null;
  validUntilIso: string | null;
  client: string;
  vehicle: {
    brand: string;
    model: string;
    finition: string;
    body: string;
    energy: string;
    gearbox: string;
    powerHp: number | null;
    fiscalHp: number | null;
    co2: number | null;
    weightKg: number | null;
    ecoScore: number | null;
    /** Éco-score ouvrant l'abattement de 70 % sur l'avantage en nature. */
    ecoScoreOk: boolean | null;
  };
  price: {
    catalogueTtc: number | null;
    optionsTtc: number | null;
    /** Total véhicule + options quand le devis ne sépare pas les deux. */
    totalTtc: number | null;
    options: QuoteOption[];
    note: string;
  };
  contract: { months: number; km: number; kmSuppTtc: number | null; tolerance: string };
  rent: { totalTtc: number; totalHt: number | null; lines: RentLine[] };
  downPayment: { amount: number; ceePrime: number; ambiguous: boolean };
  scope: QuoteScope;
  extras: string[];
  flags: QuoteFlag[];
  /** Champs confirmés par l'utilisateur (clés de `flags[].field`). */
  confirmed: string[];
};

export function emptyScope(): QuoteScope {
  return { maint: null, assist: null, pneus: null, dom: null, rc: null, pf: null, relais: null, cg: null };
}

let seq = 0;
export function blankQuote(leaser: LeaserId, fileName = ""): LeaserQuote {
  seq += 1;
  return {
    id: `lq-${Date.now().toString(36)}-${seq}`,
    leaser,
    leaserLabel: LEASER_LABEL[leaser],
    channel: "",
    fileName,
    offerNumber: "",
    dateIso: new Date().toISOString().slice(0, 10),
    validityDays: null,
    validityMonths: null,
    validUntilIso: null,
    client: "",
    vehicle: { brand: "", model: "", finition: "", body: "", energy: "Électrique", gearbox: "", powerHp: null, fiscalHp: null, co2: null, weightKg: null, ecoScore: null, ecoScoreOk: null },
    price: { catalogueTtc: null, optionsTtc: null, totalTtc: null, options: [], note: "" },
    contract: { months: 0, km: 0, kmSuppTtc: null, tolerance: "" },
    rent: { totalTtc: 0, totalHt: null, lines: [] },
    downPayment: { amount: 0, ceePrime: 0, ambiguous: false },
    scope: emptyScope(),
    extras: [],
    flags: [],
    confirmed: [],
  };
}

// ============================================================================
// Calculs et utilitaires
// ============================================================================

/** Nombre français ou à points : « 1.054,73 », « 46 990,00 », « 0.0923 ». */
export function toNum(s: string | null | undefined): number | null {
  if (s == null) return null;
  let t = String(s).replace(/[\s  €]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : null;
}

function dmyToIso(s: string): string {
  const m = s.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export function validUntil(q: LeaserQuote): Date | null {
  if (q.validUntilIso) return new Date(q.validUntilIso + "T12:00:00");
  if (!q.dateIso) return null;
  const d = new Date(q.dateIso + "T12:00:00");
  if (q.validityMonths) { d.setMonth(d.getMonth() + q.validityMonths); return d; }
  if (q.validityDays) { d.setDate(d.getDate() + q.validityDays); return d; }
  return null;
}

export function isExpired(q: LeaserQuote, now = new Date()): boolean {
  const d = validUntil(q);
  return !!d && d.getTime() < now.getTime();
}

export function validityText(q: LeaserQuote): string {
  if (q.validUntilIso) return `jusqu'au ${new Date(q.validUntilIso + "T12:00:00").toLocaleDateString("fr-FR")}`;
  if (q.validityMonths) return q.validityMonths === 1 ? "un mois" : `${q.validityMonths} mois`;
  if (q.validityDays) return `${q.validityDays} jours`;
  return "à confirmer";
}

/** Prix véhicule + options TTC (total du devis ou somme catalogue + options). */
export function priceTotal(q: LeaserQuote): number {
  if (q.price.totalTtc != null) return q.price.totalTtc;
  return (q.price.catalogueTtc ?? 0) + (q.price.optionsTtc ?? 0);
}

/** Ligne d'assurance du véhicule (dommages, RC, garanties, honoraires de gestion
 *  de l'assurance) ; la perte financière reste une ligne à part. */
function isInsuranceLine(l: RentLine): boolean {
  return l.cat === "ass" && !/perte/i.test(l.label);
}

export function assuranceMonthly(q: LeaserQuote): number {
  return q.rent.lines.filter(isInsuranceLine).reduce((s, l) => s + l.amount, 0);
}

/** Lignes du loyer pour l'affichage : toutes les lignes d'assurance sont regroupées
 *  dans un seul bloc « Assurance tous risques » (à la place de la 1re d'entre elles). */
export function groupRentLines(lines: RentLine[]): RentLine[] {
  const ins = lines.filter(isInsuranceLine);
  if (ins.length === 0) return lines;
  const grouped: RentLine = {
    cat: "ass",
    label: "Assurance tous risques",
    detail: ins.length > 1 ? ins.map((l) => l.label).join(" · ") : ins[0].detail ?? ins[0].label,
    amount: Math.round(ins.reduce((s, l) => s + l.amount, 0) * 100) / 100,
    derived: ins.some((l) => l.derived) || undefined,
  };
  const out: RentLine[] = [];
  let done = false;
  for (const l of lines) {
    if (!isInsuranceLine(l)) out.push(l);
    else if (!done) { out.push(grouped); done = true; }
  }
  return out;
}

export function rentLinesSum(q: LeaserQuote): number {
  return q.rent.lines.reduce((s, l) => s + l.amount, 0);
}

/** Apport net de la prime CEE : 1er loyer majoré − prime. */
export function netDownPayment(q: LeaserQuote): number {
  return Math.max(0, q.downPayment.amount - q.downPayment.ceePrime);
}

export function kmPerYear(q: LeaserQuote): number {
  return q.contract.months > 0 ? Math.round(q.contract.km / (q.contract.months / 12)) : 0;
}

/** Avantage en nature du collaborateur, méthode Beev (identique au calculateur
 *  TCO) : 50 % du loyer annuel, plafonné à 15 % du prix d'achat TTC, abattement
 *  de 70 % limité à 4 641,60 € par an si véhicule électrique éco-scoré. */
export function aenMonthly(q: LeaserQuote, ecoOk: boolean): { brutMonth: number; netMonth: number } {
  const loyerAn = q.rent.totalTtc * 12;
  const prix = priceTotal(q);
  let brut = loyerAn * 0.5;
  if (prix > 0) brut = Math.min(brut, prix * AEN_PLAFOND_PCT_PRIX);
  const abat = ecoOk ? Math.min(brut * 0.7, AEN_ABATTEMENT_MAX_AN) : 0;
  return { brutMonth: brut / 12, netMonth: (brut - abat) / 12 };
}

export function effectiveEcoOk(q: LeaserQuote, catalogueEco?: boolean): boolean {
  if (q.vehicle.ecoScoreOk != null) return q.vehicle.ecoScoreOk;
  return !!catalogueEco && /lectri/i.test(q.vehicle.energy);
}

// ---- Noms lisibles ----
const MULTI_BRANDS = ["MERCEDES BENZ", "MERCEDES-BENZ", "LAND ROVER", "ALFA ROMEO", "ASTON MARTIN", "ROLLS ROYCE", "DS AUTOMOBILES"];
const ACRONYMS = new Set(["BMW", "MG", "DS", "VW", "BYD", "GWM", "MINI", "SUV", "BEV", "EQ", "GT", "RS", "S", "ID", "EV", "XC", "EX", "CV", "AWD", "4X4", "LR"]);

function prettyToken(w: string): string {
  const kwh = w.match(/^(\d+(?:[.,]\d+)?)kwh$/i);
  if (kwh) return `${kwh[1]} kWh`;
  const up = w.toUpperCase();
  if (up === "E-TRON") return "e-tron";
  if (/\d/.test(w) || /[+®]/.test(w)) return up;
  if (ACRONYMS.has(up) || (w === up && /^[A-Z]{2,3}\.?$/.test(w))) return up;
  if (w.includes("'")) return w.split("'").map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p.toLowerCase())).join("'");
  return w.split("-").map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p)).join("-");
}

export function prettyWords(s: string): string {
  return s.trim().split(/\s+/).filter(Boolean).map(prettyToken).join(" ");
}

const OPTION_ACRONYMS = new Set(["MMI", "ESP", "LED", "USB", "GPS", "ACC", "HUD", "ARTICO", "ADAS"]);
/** Intitulé d'option lisible : « VITRAGE PRIVACY » → « Vitrage privacy ». Un
 *  libellé déjà en casse mixte est conservé tel quel. */
export function prettyOption(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t !== t.toUpperCase()) return t;
  const lower = t.toLowerCase().split(" ").map((w) => (OPTION_ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w)).join(" ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function prettyBrand(s: string): string {
  const up = s.trim().toUpperCase();
  if (up === "MERCEDES BENZ" || up === "MERCEDES-BENZ") return "Mercedes-Benz";
  if (up === "BMW" || up === "MG" || up === "BYD" || up === "DS" || up === "VW") return up;
  return s.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

/** Sépare « BRAND MODEL … » : marque (éventuellement en 2 mots), modèle jusqu'au
 *  premier marqueur de motorisation, finition = le reste. */
function splitVehicle(full: string): { brand: string; model: string; finition: string } {
  const clean = full.replace(/\s+/g, " ").trim();
  let brand = "";
  let rest = clean;
  const up = clean.toUpperCase();
  const multi = MULTI_BRANDS.find((b) => up.startsWith(b + " "));
  if (multi) { brand = clean.slice(0, multi.length); rest = clean.slice(multi.length).trim(); }
  else { const i = clean.indexOf(" "); brand = i < 0 ? clean : clean.slice(0, i); rest = i < 0 ? "" : clean.slice(i + 1).trim(); }
  const words = rest.split(" ").filter(Boolean);
  const MARK = /^(BEV|HEV|PHEV|ELEC|ELECTRIC|ELECTRIQUE|ÉLECTRIQUE|\d+(?:[.,]\d+)?KWH|\d+KW)$/i;
  const cut = words.findIndex((w, i) => i > 0 && MARK.test(w));
  const modelWords = cut < 0 ? words.slice(0, 2) : words.slice(0, cut);
  const rem = cut < 0 ? words.slice(2) : words.slice(cut);
  const finWords = rem.filter((w) => !/^(BEV|HEV|PHEV|ELEC|ELECTRIC|ELECTRIQUE|ÉLECTRIQUE|VP|AUTO|SUV)$/i.test(w));
  return { brand: prettyBrand(brand), model: prettyWords(modelWords.join(" ")), finition: prettyWords(finWords.join(" ")) };
}

function detectBody(s: string): string {
  const m = s.match(/\b(SUV|Berline à hayon|Berline|Break|Compacte|Citadine|Monospace|Coupé|Cabriolet|Fourgon|Utilitaire)\b/i);
  if (!m) return "";
  return /^suv$/i.test(m[1]) ? "SUV" : m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
}

// ============================================================================
// Détection du loueur
// ============================================================================

export function detectLeaser(text: string): LeaserId {
  const t = text.toLowerCase();
  if (/ayvens|temsys|réseau partenaires/.test(t)) return "ayvens";
  if (/arval/.test(t)) return "arval";
  if (/bpce car lease|bpcecl|bpce/.test(t)) return "bpce";
  if (/alphabet france|alphabet\.com|www\.alphabet/.test(t)) return "alphabet";
  if (/volkswagen bank/.test(t)) return "vwbank";
  return "autre";
}

// ============================================================================
// Lecture des quatre loueurs
// ============================================================================

const M = "(\\d[\\d\\s.]*,\\d{2})"; // montant français

function rx(text: string, re: RegExp): RegExpMatchArray | null {
  return text.match(re);
}
function g1(text: string, re: RegExp): string {
  const m = text.match(re);
  return m ? m[1].trim() : "";
}
function num1(text: string, re: RegExp): number | null {
  const m = text.match(re);
  return m ? toNum(m[1]) : null;
}
function flag(q: LeaserQuote, field: string, status: "check" | "absent", note: string) {
  q.flags.push({ field, status, note });
}
function incl(s: string | undefined): ScopeValue {
  if (!s) return null;
  return /^(inclus|incluse)/i.test(s) ? 1 : /^(exclu|exclue)/i.test(s) ? 0 : null;
}

// ---- Ayvens ----
function parseAyvens(text: string, fileName: string): LeaserQuote {
  const q = blankQuote("ayvens", fileName);
  q.channel = /partenaires/i.test(text) ? "Réseau partenaires" : "";
  q.offerNumber = g1(text, /Offre\s+N°\s*([A-Z0-9]+)/i);
  q.dateIso = dmyToIso(g1(text, /\bDu\s+(\d{2}\/\d{2}\/\d{4})/));
  const days = num1(text, /Offre valable\s+(\d+)\s*jours/i);
  q.validityDays = days;

  const soc = g1(text, /Société\s*:\s*([^\n]+)/);
  if (soc && !/beev/i.test(soc)) q.client = soc.replace(/\s+Tel\s*:.*/i, "").trim();
  else flag(q, "client", "absent", `Le devis est au nom « ${soc || "—"} » (compte Beev) : client final à saisir`);

  const line = g1(text, /Véhicule\s*-\s*Détail[^\n]*\n\s*([^\n]+)/i);
  if (line) {
    const sp = splitVehicle(line.replace(/\s+Boite\s+\w+.*$/i, "").replace(/\s+VP\s*$/i, ""));
    Object.assign(q.vehicle, sp);
    q.vehicle.body = detectBody(line);
    q.vehicle.gearbox = /Automatique/i.test(line) ? "Automatique" : /Manuelle/i.test(line) ? "Manuelle" : "";
  }
  q.vehicle.energy = /Electrique/i.test(text) ? "Électrique" : q.vehicle.energy;
  q.vehicle.powerHp = num1(text, /(\d+)\s*chevaux/i);
  q.vehicle.fiscalHp = num1(text, /(\d+)\s*CV\b/);
  q.vehicle.co2 = num1(text, /CO2\s*:\s*(\d+)\s*g\/km/i);
  q.vehicle.weightKg = num1(text, /(\d{3,4})\s*Kg/i);
  const eco = num1(text, /Score environnemental\s*(\d+)/i);
  if (eco != null) { q.vehicle.ecoScore = eco; q.vehicle.ecoScoreOk = eco >= 60; }

  q.price.catalogueTtc = toNum(rx(text, new RegExp(`Prix catalogue du véhicule\\s*:\\s*${M}\\s+[\\d.,]+\\s+${M}`, "i"))?.[2]);
  q.price.optionsTtc = toNum(rx(text, new RegExp(`Montant total des options\\s*:\\s*${M}\\s+[\\d.,]+\\s+${M}`, "i"))?.[2]);
  // Les options peuvent courir sur deux pages (l'en-tête « Options comprises dans le
  // loyer » est répété) : on lit de la 1re mention jusqu'au dernier « Total Options »,
  // en ne gardant que les lignes « NOM  HT  TVA %  TTC ».
  const optStart = text.search(/Options comprises dans le loyer/i);
  let optSlice = optStart < 0 ? "" : text.slice(optStart);
  const optEnd = optSlice.search(/^Accessoires compris dans le loyer\s+HT/im);
  if (optEnd > 0) optSlice = optSlice.slice(0, optEnd);
  // Sur certains devis, le prix TTC d'une option tombe sur une ligne à part (lignes de
  // base décalées de < 1 pt) : « NOM  HT » puis « 20,00  TTC ». On les recolle.
  optSlice = optSlice.replace(new RegExp(`^(.+?\\s+${M})[ \\t]*\\n[ \\t]*((?:5,50|10,00|20,00)\\s+${M})[ \\t]*$`, "gm"), "$1 $3")
    .replace(new RegExp(`^((?:5,50|10,00|20,00)\\s+${M})[ \\t]*\\n[ \\t]*(.+?\\s+${M})[ \\t]*$`, "gm"), "$3 $1");
  const seenOpt = new Set<string>();
  for (const l of optSlice.split("\n")) {
    const m = l.trim().match(new RegExp(`^(.+?)\\s+${M}\\s+(?:5,50|10,00|20,00)\\s+${M}$`));
    if (!m || /^(total|montant|prix|loyer|ech[eé]ance)\b/i.test(m[1].trim())) continue;
    const key = `${m[1]}|${m[3]}`;
    if (seenOpt.has(key)) continue;
    seenOpt.add(key);
    q.price.options.push({ name: prettyOption(m[1]), priceTtc: toNum(m[3]) });
  }
  const optSum = Math.round(q.price.options.reduce((a, o) => a + (o.priceTtc ?? 0), 0) * 100) / 100;
  if ((q.price.optionsTtc ?? 0) > 0 && Math.abs(optSum - (q.price.optionsTtc ?? 0)) > 0.05) {
    flag(q, "options", "check", `Options lues : ${optSum.toLocaleString("fr-FR")} € pour un total de ${(q.price.optionsTtc ?? 0).toLocaleString("fr-FR")} € sur le devis : liste à vérifier`);
  }

  // « Durée 37 mois » ou « Durée variable 37 mois - Kilométrage variable 45.000 km » (offre Ayvens Essentiel).
  q.contract.months = num1(text, /Durée\s+(?:(?:variable|fixe)\s+)?(\d+)\s*mois/i) ?? 0;
  q.contract.km = toNum(g1(text, /Kilométrage\s+(?:(?:variable|fixe)\s+)?([\d.\s]+?)\s*km/i)) ?? 0;
  q.contract.kmSuppTtc = num1(text, /kilomètre supplémentaire\s*\(TTC\)\s*:\s*([\d,.]+)/i);
  const tol = g1(text, /Tolérance Kilométrique\s*:\s*(\d+)\s*km/i);
  q.contract.tolerance = tol ? `${Number(tol).toLocaleString("fr-FR")} km` : "";

  const ech = rx(text, new RegExp(`Echéance globale\\s+${M}\\s+[\\d.,]+\\s+${M}`, "i"));
  const base = ech ? toNum(ech[2]) : null;
  const tot = rx(text, new RegExp(`ECHEANCE MENSUELLE TOTALE[^\\n]*?${M}\\s+${M}\\s*(?:\\n|$)`, "i"));
  q.rent.totalHt = tot ? toNum(tot[1]) : null;
  q.rent.totalTtc = tot ? (toNum(tot[2]) ?? 0) : (base ?? 0);
  if (base != null) q.rent.lines.push({ cat: "fin", label: "Forfait de location", detail: "Financement, maintenance tous réseaux, assistance 24/24, forfait sécurité", amount: base });
  const domTtc = toNum(rx(text, new RegExp(`Dommages-Limitation[^\\n]*?${M}\\s+[\\d.,]+\\s+${M}`, "i"))?.[2]);
  if (domTtc != null) q.rent.lines.push({ cat: "ass", label: "Assurance dommages", detail: "Limitation de responsabilité du locataire", amount: domTtc });
  const a1 = toNum(rx(text, new RegExp(`Assurance\\(s\\)\\s+soumise\\(s\\)\\s+à la TVA\\s+${M}\\s+[\\d.,]+\\s+${M}`, "i"))?.[2]);
  const a2 = toNum(rx(text, new RegExp(`Assurance\\(s\\)\\s+hors TVA[^\\n]*?${M}\\s+${M}`, "i"))?.[2]);
  const rcTtc = (a1 ?? 0) + (a2 ?? 0);
  if (rcTtc > 0) q.rent.lines.push({ cat: "ass", label: "Responsabilité civile et garanties", detail: "RC, garantie conducteur, effets personnels, pertes", amount: Math.round(rcTtc * 100) / 100 });
  const hon = toNum(rx(text, new RegExp(`Honoraires de gestion assurance\\s+${M}\\s+[\\d.,]+\\s+${M}`, "i"))?.[2]);
  if (hon != null) q.rent.lines.push({ cat: "ass", label: "Honoraires de gestion assurance", amount: hon });
  if (domTtc != null || a1 != null || a2 != null || hon != null) flag(q, "loyer-assurance", "check", "Assurance additionnée par Beev à partir de 4 lignes (dommages, RC, garanties hors TVA, honoraires)");

  const pm = toNum(rx(text, new RegExp(`1er loyer majoré TTC\\s*${M}`, "i"))?.[1]) ?? toNum(rx(text, new RegExp(`Montant du premier loyer\\s*:\\s*${M}`, "i"))?.[1]);
  const cee = toNum(rx(text, new RegExp(`Prime Certificat d['’]Economie d['’]Energie[^\\n]*?-\\s*${M}`, "i"))?.[1]);
  q.downPayment = { amount: pm ?? 0, ceePrime: cee ?? 0, ambiguous: false };

  q.scope = {
    maint: /Maintenance\s+Tous réseaux/i.test(text) ? 1 : null,
    assist: /Assistance 24\/24/i.test(text) ? 1 : null,
    pneus: null,
    dom: domTtc != null ? 1 : null,
    rc: a1 != null || a2 != null ? 1 : null,
    pf: /Perte financi[eè]re/i.test(text) ? 1 : null,
    relais: /Forfait Sécurité/i.test(text) ? 1 : null,
    cg: /Certificat d['’]immatriculation inclus/i.test(text) ? 1 : null,
  };
  const cg = rx(text, new RegExp(`Certificat d['’]immatriculation inclus\\s*:\\s*${M}\\s*E?\\s*\\(dépt\\.\\s*(\\w+)\\)`, "i"));
  if (cg) q.extras.push(`Carte grise incluse : ${cg[1].trim()} € (dépt. ${cg[2]})`);
  const en = num1(text, /Energie à la livraison\s*:\s*([\d,]+)/i);
  if (en != null) q.extras.push(`Énergie à la livraison : ${en} € TTC`);
  const and = g1(text, /Amortissements Non Déductibles\s*\(\*\)\s*([\d.,]+)/i);
  if (and) flag(q, "fiscal", "check", `AND annoncé par le loueur : ${and} € (périodicité non indiquée, information seulement)`);
  return q;
}

// ---- Arval ----
function parseArval(text: string, fileName: string): LeaserQuote {
  const q = blankQuote("arval", fileName);
  q.channel = /ebroker|courtier/i.test(fileName) ? "Via courtier" : "";
  q.offerNumber = g1(text, /N°\s*(\d+\/\d+)/);
  q.dateIso = dmyToIso(g1(text, /\bLE\s+(\d{2}\/\d{2}\/\d{4})/));
  q.validityDays = num1(text, /Offre valable\s+(\d+)\s*jours/i);
  q.client = g1(text, /Client\s*\/\s*Locataire\s+([^\n]+?)(?:\s+Id Client[^\n]*)?\s*(?:\n|$)/i);
  if (!q.client) flag(q, "client", "absent", "Client introuvable sur le devis");

  const v = rx(text, new RegExp(`VEHICULE\\s*\\n?\\s*(.+?)\\s+Prix référence constructeur\\s+${M}`, "i"));
  if (v) {
    const segs = v[1].split("/").map((s) => s.trim());
    const brandModel = segs[0] ?? "";
    const parts = brandModel.split(" ");
    q.vehicle.brand = prettyBrand(parts[0] ?? "");
    q.vehicle.model = prettyWords(parts.slice(1).join(" "));
    const last = segs[segs.length - 1] ?? "";
    q.vehicle.body = detectBody(last);
    const fin = last.replace(/^(SUV|Berline|Break|Compacte|Citadine|Monospace)\s+/i, "").replace(/^(BEV|HEV|PHEV)\s+/i, "");
    q.vehicle.finition = prettyWords(fin);
    q.price.catalogueTtc = toNum(v[2]);
  }
  q.vehicle.energy = /Electrique/i.test(text) ? "Électrique" : q.vehicle.energy;
  q.vehicle.fiscalHp = num1(text, /Véhicule\s+Electrique\s+(\d+)\s*CV/i);
  q.vehicle.co2 = num1(text, /Particulier\s+(\d+)\s*g\/Km/i);
  q.vehicle.gearbox = /automatique/i.test(text) ? "Automatique" : "";

  const optTot = toNum(rx(text, new RegExp(`Options\\s*\\n?\\s*${M}\\s*€\\s*TTC`, "i"))?.[1]);
  q.price.optionsTtc = optTot;
  // Bloc « Options » (jusqu'à « Accessoires »). La puce « • » est lue avant OU après la ligne
  // de l'option selon le PDF : on l'ignore et on lit « [code JATO] NOM  prix € TTC ».
  const optPos = text.search(/^Options\b/m);
  let optRegion = optPos < 0 ? "" : text.slice(optPos);
  const optEnd = optRegion.search(/^Accessoires\b/m);
  if (optEnd > 0) optRegion = optRegion.slice(0, optEnd);
  optRegion = optRegion.replace(new RegExp(`^Options\\s*\\n?\\s*${M}\\s*€\\s*TTC`, "i"), "").replace(/•/g, " ");
  for (const l of optRegion.split("\n")) {
    const om = l.trim().match(new RegExp(`^(?:\\S*\\$\\S+\\s+)?(.+?)\\s+${M}\\s*€\\s*TTC$`));
    if (!om) continue;
    const name = om[1].trim();
    if (/loyer|accessoire/i.test(name)) continue;
    q.price.options.push({ name: prettyOption(name), priceTtc: toNum(om[2]) });
  }
  const optSum = Math.round(q.price.options.reduce((a, o) => a + (o.priceTtc ?? 0), 0) * 100) / 100;
  if ((optTot ?? 0) > 0 && Math.abs(optSum - (optTot ?? 0)) > 0.05) {
    flag(q, "options", "check", `Options lues : ${optSum.toLocaleString("fr-FR")} € pour un total de ${(optTot ?? 0).toLocaleString("fr-FR")} € sur le devis : liste à vérifier`);
  }

  const dk = rx(text, /(\d+)\s*mois\s*\/\s*([\d\s]+?)\s*km/i);
  if (dk) { q.contract.months = Number(dk[1]); q.contract.km = toNum(dk[2]) ?? 0; }
  q.contract.kmSuppTtc = toNum(rx(text, /(\d+,\d{2})\s*€\s*\n[^\n]*Prix du km supplémentaire/i)?.[1]);
  const prk = g1(text, /Prix de revient kilométrique\s+(\d+,\d{2})\s*€/i);

  q.rent.totalTtc = toNum(rx(text, new RegExp(`LOYER TOTAL MENSUEL\\s+${M}\\s*€\\s*TTC`, "i"))?.[1])
    ?? toNum(rx(text, new RegExp(`mois\\s*\\/\\s*[\\d\\s]+km\\s+${M}\\s*€\\s*TTC`, "i"))?.[1]) ?? 0;
  // Contrat Arval exprimé en HT seulement (« LOYER TOTAL MENSUEL 1 300,13 € HT ») :
  // on garde le HT et on calcule le TTC (TVA 20 %), signalé à vérifier.
  const rentHt = toNum(rx(text, new RegExp(`LOYER TOTAL MENSUEL\\s+${M}\\s*€\\s*HT`, "i"))?.[1])
    ?? toNum(rx(text, new RegExp(`mois\\s*\\/\\s*[\\d\\s]+km\\s+${M}\\s*€\\s*HT`, "i"))?.[1]);
  if (rentHt != null) q.rent.totalHt = rentHt;
  if (!(q.rent.totalTtc > 0) && rentHt != null && rentHt > 0) {
    q.rent.totalTtc = Math.round(rentHt * 1.2 * 100) / 100;
    flag(q, "loyer-ht", "check", `Loyer lu en HT (${rentHt.toLocaleString("fr-FR")} € HT) : TTC calculé avec une TVA de 20 %`);
  }
  const ass = toNum(rx(text, new RegExp(`Assurance Auto Multirisques\\s+${M}\\s*€\\s*TTC`, "i"))?.[1]);
  const franchise = g1(text, /franchise de\s+(\d[\d\s]*,\d{2})\s*€/i);
  if (ass != null) {
    q.rent.lines.push({ cat: "fin", label: "Forfait de location", detail: "Financement, maintenance, Assistance Plus (montant déduit du total)", amount: Math.round((q.rent.totalTtc - ass) * 100) / 100, derived: true });
    q.rent.lines.push({ cat: "ass", label: "Assurance auto multirisques", detail: franchise ? `Franchise ${franchise.replace(/\s/g, " ")} €` : undefined, amount: ass });
  } else if (q.rent.totalTtc > 0) {
    q.rent.lines.push({ cat: "fin", label: "Forfait de location", detail: "Financement, maintenance, Assistance Plus", amount: q.rent.totalTtc });
  }

  // Apport : deux libellés ambigus sur les devis Arval.
  const amb = /1er loyer financier|loyer financier majoré|1er loyer remboursé/i.test(text);
  q.downPayment = { amount: 0, ceePrime: 0, ambiguous: amb };
  if (amb) flag(q, "apport", "check", "Libellés d'apport ambigus (« 1er loyer financier majoré », « 1er loyer remboursé ») : vérifier dans le PDF");

  q.scope = {
    maint: /Maintenance/i.test(text) ? 1 : null,
    assist: /Assistance/i.test(text) ? 1 : null,
    pneus: null,
    dom: ass != null ? 1 : null,
    rc: ass != null ? 1 : null,
    pf: null,
    relais: null,
    cg: /Inclus dans le financement/i.test(text) ? 1 : null,
  };
  const cg = rx(text, new RegExp(`Certificat d['’]immatriculation\\s+${M}\\s*€`, "i"));
  const dpt = g1(text, /Dpt\.\s*d['’]immatriculation\s+(\d+)/i);
  if (cg) q.extras.push(`Carte grise incluse dans le financement : ${cg[1].replace(/\s/g, " ")} €${dpt ? ` (dépt. ${dpt})` : ""}`);
  if (prk) q.extras.push(`Prix de revient kilométrique annoncé : ${prk} € TTC / km`);
  const rei = g1(text, new RegExp(`Réintégration fiscale\\s+${M}\\s*€`, "i"));
  if (rei) flag(q, "fiscal", "check", `Réintégration fiscale annoncée par le loueur : ${rei} € TTC (périodicité non indiquée, information seulement)`);
  flag(q, "ecoscore", "absent", "Éco-score et puissance absents du devis : repris du catalogue Beev");
  return q;
}

// ---- BPCE Car Lease ----
function parseBpce(text: string, fileName: string): LeaserQuote {
  const q = blankQuote("bpce", fileName);
  q.channel = g1(text, /^\s*(DR [A-ZÉ -]+?)\s+Date\s*:/m);
  q.offerNumber = g1(text, /Numéro\s+([\d\s]+?)\s*\(\s*en Euros/i).replace(/\s+/g, " ");
  q.dateIso = dmyToIso(g1(text, /Date\s*:\s*(\d{2}\/\d{2}\/\d{4})/));
  if (/Valable un mois/i.test(text)) q.validityMonths = 1;

  const after = rx(text, /Place de La Coupole\s*\n\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  if (after && /^[A-Z0-9 &'.-]{4,}$/.test(after) && !/\d{4,}/.test(after)) q.client = after;
  else flag(q, "client", "check", "Client à vérifier : repéré dans le bloc adresse du loueur");

  const vline = g1(text, /AFFECTATION\s*\n\s*([^\n]+)/i);
  if (vline) {
    const sp = splitVehicle(vline.replace(/\s+AUTO\s*$/i, ""));
    Object.assign(q.vehicle, sp);
  }
  q.vehicle.body = g1(text, /Carrosserie\s*:\s*(\w+)/i).replace(/^./, (c) => c.toUpperCase());
  q.vehicle.energy = /Electricit/i.test(text) ? "Électrique" : q.vehicle.energy;
  q.vehicle.gearbox = /Auto\./i.test(text) ? "Automatique" : "";
  q.vehicle.fiscalHp = num1(text, /(\d+)\s*CV Fiscaux/i);
  q.vehicle.powerHp = num1(text, /(\d+(?:,\d+)?)\s*CV DIN/i);
  q.vehicle.co2 = num1(text, /CO2\*?\s*:\s*(\d+)\s*g\/Km/i);

  q.price.totalTtc = toNum(rx(text, new RegExp(`PRIX CATALOGUE ET OPTIONS TTC\\s+${M}`, "i"))?.[1]);
  q.price.note = "Le devis donne un seul total pour le véhicule et ses options.";
  const optBlock = rx(text, /Options\s*:\s*\n([\s\S]*?)PRIX CATALOGUE ET OPTIONS/i)?.[1] ?? "";
  const reOpt = /\s*(.+?)-((?:JATO\w+)|(?:R\d{1,3})|(?:\d{3}))(?=\s|$)/g;
  for (const l of optBlock.split("\n")) {
    let m: RegExpExecArray | null;
    reOpt.lastIndex = 0;
    while ((m = reOpt.exec(l)) !== null) {
      const name = m[1].replace(/\s*(Adresse de livraison|\d+ avenue.*)$/i, "").trim();
      if (name && !/Adresse|Carburant|Frais|Gestion/i.test(name)) q.price.options.push({ name: prettyOption(name), priceTtc: null });
    }
  }
  if (q.price.totalTtc != null) flag(q, "prix", "check", "Prix catalogue et options non séparés, options sans prix");

  const dk = rx(text, /Durée\s+(\d+)\s*mois\s+Kilométrage contractuel\s+([\d\s]+?)(?:\n|\s{2,}|$)/i);
  if (dk) { q.contract.months = Number(dk[1]); q.contract.km = toNum(dk[2]) ?? 0; }
  const per100 = toNum(rx(text, /km supplémentaire x100[^\n]*?(\d+,\d{2})\s*$/im)?.[1]);
  if (per100 != null) { q.contract.kmSuppTtc = per100 / 100; flag(q, "kmSupp", "check", "Coût du km supplémentaire donné pour 100 km : divisé par 100"); }

  const fin = toNum(rx(text, new RegExp(`Loyer périodique\\s+${M}`, "i"))?.[1]);
  const ent = toNum(rx(text, new RegExp(`Entretien\\s+Inclus\\s+${M}`, "i"))?.[1]);
  const pf = toNum(rx(text, new RegExp(`Perte Financière\\s+Incluse\\s+${M}`, "i"))?.[1]);
  q.rent.totalTtc = toNum(rx(text, new RegExp(`MONTANT PERIODIQUE TOTAL\\s+${M}`, "i"))?.[1]) ?? 0;
  if (fin != null) q.rent.lines.push({ cat: "fin", label: "Financement du véhicule", amount: fin });
  if (ent != null) q.rent.lines.push({ cat: "ent", label: "Entretien", amount: ent });
  if (pf != null) q.rent.lines.push({ cat: "ass", label: "Garantie perte financière", amount: pf });

  q.scope = {
    maint: incl(g1(text, /Entretien\s+(Inclus\w*|Exclu\w*)/i)),
    assist: incl(g1(text, /Assistance\s+(Incluse|Exclue)/i)),
    pneus: incl(g1(text, /Pneus\s+(Inclus\w*|Exclu\w*)/i)),
    dom: /ASSURANCE/.test(text) ? 0 : null,
    rc: incl(g1(text, /responsabilité civile\.?\s+(Incluse|Exclue)/i)),
    pf: incl(g1(text, /Perte Financière\s+(Incluse|Exclue)/i)),
    relais: incl(g1(text, /Relais\s+(Inclus\w*|Exclu\w*)/i)),
    cg: /Carte Grise[^\n]*incluse/i.test(text) ? 1 : null,
  };
  const cg = rx(text, new RegExp(`Carte Grise\\s*\\(\\s*${M}\\s*€\\s*Dépt\\.\\s*(\\d+)\\)\\s*incluse`, "i"));
  if (cg) q.extras.push(`Carte grise incluse : ${cg[1].replace(/\s/g, " ")} € (dépt. ${cg[2]})`);
  const excl: string[] = [];
  if (q.scope.pneus === 0) excl.push("pneus");
  if (/Pneus Hiver\s+Exclu/i.test(text)) excl.push("pneus hiver");
  if (q.scope.relais === 0) excl.push("véhicule relais");
  if (excl.length) q.extras.push(`Exclus : ${excl.join(", ")}`);
  if (q.scope.rc === 0) q.extras.push("Responsabilité civile exclue");
  const and = g1(text, /([\d\s]+,\d{2})\s*\n\s*AND\s*\(hors déduction/i);
  if (and) flag(q, "fiscal", "check", `AND annoncé par le loueur : ${and.replace(/\s/g, " ")} € (périodicité non indiquée, information seulement)`);
  flag(q, "ecoscore", "absent", "Éco-score absent du devis : repris du catalogue Beev");
  return q;
}

// ---- Alphabet ----
function parseAlphabet(text: string, fileName: string): LeaserQuote {
  const q = blankQuote("alphabet", fileName);
  q.channel = "Direct";
  const hdr = rx(text, /(\d{6,})\s+(\d{2}-\d{2}-\d{4})\s+(\d{2}-\d{2}-\d{4})/);
  if (hdr) { q.offerNumber = hdr[1]; q.dateIso = dmyToIso(hdr[2]); q.validUntilIso = dmyToIso(hdr[3]); }
  q.client = g1(text, /Locataire\s+([^\n]+?)(?:\s*\n|$)/);
  if (!q.client) flag(q, "client", "absent", "Locataire introuvable sur le devis");

  const title = g1(text, /Offre de Location Longue Durée\s*\n\s*([^\n]+)/i);
  const full = g1(text, /Marque et modèle\s+([^\n]+?)\s*(?:\n|$)/i);
  if (full) {
    const sp = splitVehicle(full);
    Object.assign(q.vehicle, sp);
    if (title) {
      const t = splitVehicle(title);
      if (t.model) q.vehicle.model = t.model.replace(/\.$/, ".");
    }
  }
  const kw = num1(text, /(\d+)\s*kW\b/i);
  if (kw != null) { q.vehicle.powerHp = Math.round(kw * 1.36); flag(q, "puissance", "check", `Puissance donnée en kW (${kw} kW) : convertie en chevaux par Beev`); }
  q.vehicle.body = detectBody(g1(text, /(berline[^\n]*?|SUV|break|compacte)\s+\d+\s*kW/i) || text.slice(0, 600));
  q.vehicle.gearbox = /automatic/i.test(text) ? "Automatique" : "";
  q.vehicle.energy = /Électricité|Electricité/i.test(text) ? "Électrique" : q.vehicle.energy;
  q.vehicle.fiscalHp = num1(text, /Puissance fiscale\s+(\d+)/i);
  q.vehicle.co2 = num1(text, /Emission de CO2\s*(\d+)/i);

  const tot = rx(text, new RegExp(`\\nTotal\\s+${M}\\s*€\\s+${M}\\s*€\\s+${M}\\s*€\\s+${M}\\s*€\\s+${M}\\s*€\\s+${M}\\s*€`));
  if (tot) {
    const baseHt = toNum(tot[1]) ?? 0, optHt = toNum(tot[2]) ?? 0;
    q.price.catalogueTtc = Math.round(baseHt * 1.2 * 100) / 100;
    q.price.optionsTtc = Math.round(optHt * 1.2 * 100) / 100;
    q.price.totalTtc = toNum(tot[6]);
    const liv = toNum(rx(text, new RegExp(`Dont\\s+${M}\\s*€\\s*frais de livraison`, "i"))?.[1]);
    if (liv != null) q.price.note = `Le prix de base inclut ${Math.round(liv * 1.2)} € TTC de frais de livraison.`;
    flag(q, "prix", "check", "Prix catalogue calculé : prix de base HT × 1,20, frais de livraison inclus");
  }
  const optBlock = rx(text, /Options - prix catalogue[^\n]*\n([\s\S]*?)(?:Conformément|CGL applicable)/i)?.[1] ?? "";
  for (const l of optBlock.split("\n")) {
    const m = l.trim().match(new RegExp(`^(.+?)\\s+(?:\\d+\\s*%\\s+)?${M}\\s*€\\s+${M}\\s*€$`));
    if (m && (toNum(m[3]) ?? 0) > 0) q.price.options.push({ name: prettyOption(m[1].replace(/\[[^\]]*\]/g, "").replace(/^Extérieur\s+/i, "")), priceTtc: toNum(m[3]) });
  }

  q.contract.months = num1(text, /Durée du contrat\s+(\d+)\s*Mois/i) ?? 0;
  q.contract.km = toNum(g1(text, /Kilométrage du contrat\s+([\d\s]+?)\s*km/i)) ?? 0;
  const kmS = rx(text, /De 0 à \d+ km\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i);
  q.contract.kmSuppTtc = kmS ? toNum(kmS[3]) : null;

  q.rent.totalTtc = toNum(rx(text, new RegExp(`Loyer total TTC\\s+${M}\\s*€`, "i"))?.[1]) ?? 0;
  q.rent.totalHt = toNum(rx(text, new RegExp(`Loyer mensuel HT\\s+${M}`, "i"))?.[1]);
  // Page « Prestations » : les montants précèdent les libellés.
  const block = rx(text, /Prestations souscrites[^\n]*\n([\s\S]*?)\nCoûts/i)?.[1] ?? "";
  const LABELS: [RegExp, RentCat, string][] = [
    [/Loyer Financier/i, "fin", "Loyer financier"],
    [/Entretien/i, "ent", "Entretien"],
    [/Contrôle Technique/i, "ent", "Contrôle technique"],
    [/Assistance 24\/24/i, "ent", "Assistance 24/24"],
    [/Perte Financière/i, "ass", "Garantie perte financière"],
    [/Honoraires de Gestion/i, "ges", "Honoraires de gestion"],
  ];
  let pending: number | null = null;
  for (const raw of block.split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    const onlyAmounts = l.match(new RegExp(`^(?:\\d+\\s*%\\s+)?(?:${M}\\s*€\\s+)?${M}\\s*€$`));
    if (onlyAmounts) { pending = toNum(onlyAmounts[2]); continue; }
    const lab = LABELS.find(([r]) => r.test(l));
    if (!lab) continue;
    const own = l.match(new RegExp(`${M}\\s*€\\s*$`));
    const amount = own && !/^\s*$/.test(l.replace(/[\d\s,.%€]/g, "").replace(/Perte Financière/i, "")) ? toNum(own[1]) : pending;
    if (amount == null) continue;
    if (/Contrôle Technique/i.test(l) && amount === 0) { pending = null; continue; }
    q.rent.lines.push({ cat: lab[1], label: lab[2], amount });
    pending = null;
  }
  const alphaScope = (re: RegExp): ScopeValue => (re.test(text) ? 1 : null);
  q.scope = {
    maint: alphaScope(/Entretien/i),
    assist: alphaScope(/Assistance 24\/24/i),
    pneus: null,
    dom: 0,
    rc: 0,
    pf: alphaScope(/Perte Financière/i),
    relais: null,
    cg: /Certificat d['’]immatriculation\*?\s+[\d\s]+,\d{2}\s*€\s*\(inclus/i.test(text) ? 1 : null,
  };
  const cg = rx(text, new RegExp(`Certificat d['’]immatriculation\\*?\\s+${M}\\s*€\\s*\\(inclus dans le loyer\\)`, "i"));
  if (cg) q.extras.push(`Carte grise incluse : ${cg[1].replace(/\s/g, " ")} €`);
  const en = toNum(rx(text, new RegExp(`Charge électrique à la livraison TTC\\s+${M}`, "i"))?.[1]);
  if (en != null) q.extras.push(`Énergie à la livraison : ${Math.round(en)} € TTC`);
  q.extras.push("Assurance dommages non proposée sur ce devis");
  flag(q, "ecoscore", "absent", "Éco-score absent du devis : repris du catalogue Beev");
  if (!q.vehicle.brand && /valant Bon de commande|Loyer TOTAL\s*:/i.test(text)) return parseAlphabetDealer(text, fileName);
  return q;
}

// ---- Volkswagen Bank ----
// Contrat de location longue durée (conditions particulières) émis par le
// distributeur. Montants en colonnes « HT  TTC ». La page « Étude tarifaire »
// (remise distributeur) est interne : elle n'est pas reprise.
function parseVwBank(text: string, fileName: string): LeaserQuote {
  const q = blankQuote("vwbank", fileName);
  const pair = (label: string) => rx(text, new RegExp(`${label}\\s*:?\\s*${M}\\s*€\\s+${M}\\s*€`, "i"));
  q.offerNumber = g1(text, /CONTRAT DE LOCATION LONGUE DUR[ÉE]E\s+(\d{6,})/i);
  const d = g1(text, /CONDITIONS PARTICULI[ÈE]RES[^\n]*?du\s+(\d{2}\/\d{2}\/\d{4})/i) || g1(text, /\bdu\s+(\d{2}\/\d{2}\/\d{4})/i);
  if (d) q.dateIso = dmyToIso(d);
  const vd = num1(text, /valable\s+(\d+)\s+jours/i);
  if (vd) q.validityDays = vd;
  // « Raison Sociale : <distributeur> Raison Sociale : <client> »
  const rs = rx(text, /Raison Sociale\s*:\s*(.+?)\s+Raison Sociale\s*:\s*([^\n]+)/i);
  if (rs) { q.channel = `Distributeur ${prettyWords(rs[1].trim())}`; q.client = rs[2].trim(); }
  if (!q.client) flag(q, "client", "absent", "Client introuvable sur le contrat");

  const brand = g1(text, /Marque\s*:\s*(.+?)\s+Genre\s*:/i);
  const modelLine = g1(text, /Modèle\s*:\s*(.+?)\s+Options\s*:/i) || g1(text, /MODELE\s*:\s*([^\n]+)/i);
  if (brand || modelLine) {
    // « POLO 6 FL LIFE PLUS 1.0 TSI 95 CH BVM5 0CV » : modèle = premier mot ;
    // « NOUVELLE ID.3 NEO … » / « NOUVEAU ID. CROSS … » : « Nouveau » écarté,
    // « ID. » rattaché au mot suivant.
    const words = modelLine.replace(/\s+\d+CV$/i, "").replace(/^(NOUVEAU|NOUVELLE|NEW)\s+/i, "").split(/\s+/).filter(Boolean);
    const nModel = /\.$/.test(words[0] ?? "") && words.length > 1 ? 2 : 1;
    q.vehicle.brand = prettyBrand(brand || "Volkswagen");
    q.vehicle.model = prettyWords(words.slice(0, nModel).join(" ")).replace(/^Id\b/, "ID");
    q.vehicle.finition = prettyWords(words.slice(nModel).join(" "));
    const ch = modelLine.match(/(\d{2,3})\s*CH\b/i);
    if (ch) q.vehicle.powerHp = Number(ch[1]);
    q.vehicle.gearbox = /\b(DSG|BVA|AUTO)/i.test(modelLine) ? "Automatique" : /\bBVM/i.test(modelLine) ? "Manuelle" : "";
  }
  const en = g1(text, /Energie\s*:\s*([A-Za-zÉé]+)/i).toUpperCase();
  q.vehicle.energy = /^(EL|ELEC|ÉLEC|ELECTRIQUE|ÉLECTRIQUE)/.test(en) ? "Électrique"
    : /^(HR|PHEV|EH|HYBRIDE?R)/.test(en) ? "Hybride Rechargeable"
    : /^(HYB|HEV|EE)/.test(en) ? "Hybride"
    : /^(GO|GAZ|DIE)/.test(en) ? "Diesel"
    : /^(ES|SP)/.test(en) ? "Essence" : q.vehicle.energy;
  if (!q.vehicle.gearbox && q.vehicle.energy === "Électrique") q.vehicle.gearbox = "Automatique";
  q.vehicle.fiscalHp = num1(text, /Puissance Fiscale\s*:\s*(\d+)/i);
  q.vehicle.co2 = num1(text, /CO\s?2\s*:[^\n]*\n(?:[^\n]*\n)?\s*(\d{1,3})\s*$/im);
  q.vehicle.body = detectBody(g1(text, /Carrosserie\s*:\s*([^\n]*?)\s+Energie/i));

  const cat = pair("Prix catalogue");
  if (cat) q.price.catalogueTtc = toNum(cat[2]);
  const opt = pair("Options");
  if (opt) q.price.optionsTtc = toNum(opt[2]);
  const acc = pair("Accessoires");
  if (acc && (toNum(acc[2]) ?? 0) > 0) q.price.options.push({ name: "Accessoires", priceTtc: toNum(acc[2]) });

  q.contract.months = num1(text, /Durée du contrat\s*:\s*(\d+)\s*mois/i) ?? 0;
  q.contract.km = toNum(g1(text, /Kilométrage total souscrit\s*:\s*([\d\s.]+?)(?:\s*km)?\s*(?:\n|$)/i)) ?? 0;
  const supp = rx(text, /km supplémentaire\s+([\d,]+)\s+([\d,]+)/i);
  if (supp) q.contract.kmSuppTtc = toNum(supp[2]);

  const tot = pair("Loyer mensuel total");
  if (tot) { q.rent.totalHt = toNum(tot[1]); q.rent.totalTtc = toNum(tot[2]) ?? 0; }
  const fin = pair("Loyer financier");
  if (fin) q.rent.lines.push({ cat: "fin", label: "Loyer financier", amount: toNum(fin[2]) ?? 0 });
  const svc = pair("Services");
  if (svc) q.rent.lines.push({ cat: "ent", label: "Maintenance et assistance", detail: "Entretien constructeur, réparations mécaniques, assistance 24h/24", amount: toNum(svc[2]) ?? 0 });
  const pf = rx(text, new RegExp(`Perte financière\\s+inclus\\w*\\s+${M}\\s*€\\s+${M}\\s*€`, "i"));
  if (pf) q.rent.lines.push({ cat: "ass", label: "Garantie perte financière", amount: toNum(pf[2]) ?? 0 });
  const first = toNum(rx(text, new RegExp(`1\\s*(?:er)?\\s*loyer TTC\\s*:\\s*${M}`, "i"))?.[1]);
  if (first != null && first > q.rent.totalTtc + 1) q.extras.push(`Premier loyer TTC : ${first.toLocaleString("fr-FR")} € (dépôt de garantie, prestations et assurances inclus)`);

  q.scope = {
    maint: /Maintenance[^\n]*Entretien/i.test(text) || /Services[^\n]*\n\s*inclus/i.test(text) ? 1 : null,
    assist: /Assistance constructeur/i.test(text) ? 1 : null,
    pneus: /Pneumatiques[^\n]*non inclus/i.test(text) ? 0 : null,
    dom: /dommages tous risques\s*\n?\s*non inclus/i.test(text) ? 0 : null,
    rc: /RC & dommages tous risques\s*\n?\s*non inclus/i.test(text) ? 0 : null,
    pf: /Perte financière\s+inclus/i.test(text) ? 1 : null,
    relais: /Véhicule de remplacement[^\n]*inclus/i.test(text) ? 1 : null,
    cg: /Carte grise, immatriculation inclus/i.test(text) ? 1 : null,
  };
  if (q.scope.pneus === 0) q.extras.push("Pneumatiques non inclus");
  if (q.scope.rc === 0) q.extras.push("RC et dommages tous risques non inclus");
  flag(q, "ecoscore", "absent", "Éco-score absent du devis : repris du catalogue Beev");
  return q;
}

// Offre Alphabet émise par un concessionnaire (« Offre de location valant Bon de
// commande ») : mise en page différente du devis Alphabet direct.
function parseAlphabetDealer(text: string, fileName: string): LeaserQuote {
  const q = blankQuote("alphabet", fileName);
  q.channel = "Concessionnaire";
  q.offerNumber = g1(text, /Bon de commande\s*\n?\s*N°\s*(\d+)/i);
  const d = g1(text, /Date de l['’]offre\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (d) q.dateIso = dmyToIso(d);
  // « Locataire » seul sur sa ligne (sinon les colonnes concessionnaire / locataire sont mêlées).
  q.client = g1(text, /^Locataire\s*\n\s*([^\n(]+?)\s*(?:\(SIREN[^)]*\))?\s*(?:\n|$)/im);
  if (!q.client) flag(q, "client", "absent", "Locataire introuvable sur le devis");

  // « SKODA ELROQ 85 Sportline VP [5P] bva 1-286CH-6cv (SUV) »
  // « Véhicule » seul ou suivi de « Prix Catalogue TTC » ; la ligne suivante peut se
  // terminer par le prix catalogue (« … (SUV) 45 720,00 »).
  const vRaw = g1(text, /\nVéhicule(?:\s+Prix Catalogue TTC)?\s*\n\s*([^\n]+)/i);
  const vPrice = vRaw.match(new RegExp(`\\s${M}$`));
  const vl = vPrice ? vRaw.slice(0, vPrice.index).trim() : vRaw;
  if (vl) {
    const clean = vl.replace(/\s+(VP|VU|VUL)\b.*$/i, "").trim();
    Object.assign(q.vehicle, splitVehicle(clean));
    const ch = vl.match(/(\d{2,3})\s*CH\b/i);
    if (ch) q.vehicle.powerHp = Number(ch[1]);
    const cv = vl.match(/(\d{1,2})\s*cv\b/i);
    if (cv) q.vehicle.fiscalHp = Number(cv[1]);
    q.vehicle.body = detectBody(vl);
    q.vehicle.gearbox = /\bbva\b|automati/i.test(vl) ? "Automatique" : "";
  }
  const typeFiscal = g1(text, /Type fiscal\s*:\s*([^\n]+)/i);
  if (typeFiscal) q.vehicle.energy = /lectri/i.test(typeFiscal) ? "Électrique" : /hybride/i.test(typeFiscal) ? "Hybride" : /diesel|gazole/i.test(typeFiscal) ? "Diesel" : /essence/i.test(typeFiscal) ? "Essence" : q.vehicle.energy;

  q.price.catalogueTtc = (vPrice ? toNum(vPrice[1]) : null) ?? toNum(rx(text, new RegExp(`Prix Catalogue TTC\\s*${M}`, "i"))?.[1]);
  q.price.optionsTtc = toNum(rx(text, new RegExp(`TOTAL OPTIONS & ACCESSOIRES TTC[^\\d\\n]*${M}`, "i"))?.[1]);
  q.price.totalTtc = toNum(rx(text, new RegExp(`PRIX TOTAL VEHICULE TTC[^\\d\\n]*${M}`, "i"))?.[1]);
  // Options entre la ligne du véhicule et « TOTAL OPTIONS » (une ou plusieurs par ligne).
  const optStart = vRaw ? text.indexOf(vRaw) + vRaw.length : -1;
  const optEnd = text.search(/TOTAL OPTIONS/i);
  const optBlock = optStart > 0 && optEnd > optStart ? text.slice(optStart, optEnd) : "";
  for (const l of optBlock.split("\n")) {
    if (/^(Type fiscal|Consommation)/i.test(l.trim())) continue;
    for (const m of l.matchAll(/([^\d\n][^\n]*?)\s+(\d{1,3}(?:\s\d{3})*,\d{2})(?=\s|$)/g)) {
      const name = m[1].trim().replace(/\s+-\s*[A-Z0-9]*$/, "").trim();
      const price = toNum(m[2]) ?? 0;
      if (price > 0 && name && !/mise a la route|mise à la route/i.test(name)) q.price.options.push({ name: prettyOption(name), priceTtc: price });
    }
  }

  // « Durée : 37 Mois Kilométrage : 30 000 km » (kilométrage total du contrat)
  q.contract.months = num1(text, /Durée\s*:\s*(\d+)\s*Mois/i) ?? 0;
  q.contract.km = toNum(g1(text, /Kilométrage\s*:\s*([\d\s.]+?)\s*km/i)) ?? 0;

  // « Loyer TOTAL: 436,69 518,20 » (HT puis TTC)
  const tot = rx(text, new RegExp(`Loyer TOTAL\\s*:\\s*${M}\\s+${M}`, "i"));
  if (tot) { q.rent.totalHt = toNum(tot[1]); q.rent.totalTtc = toNum(tot[2]) ?? 0; }
  const LINES: [string, RentCat, string][] = [
    ["Loyer financier", "fin", "Loyer financier"],
    ["Entretien\\s*\\/\\s*Assistance", "ent", "Entretien et assistance"],
    ["Perte Financière", "ass", "Garantie perte financière"],
  ];
  for (const [src, cat, label] of LINES) {
    const m = rx(text, new RegExp(`${src}\\s+[\\d,]+\\s+${M}\\s+${M}`, "i"));
    if (m) q.rent.lines.push({ cat, label, amount: toNum(m[2]) ?? 0 });
  }
  q.scope = { maint: /Entretien/i.test(text) ? 1 : null, assist: /Assistance/i.test(text) ? 1 : null, pneus: null, dom: null, rc: null, pf: /Perte Financière/i.test(text) ? 1 : null, relais: null, cg: null };
  flag(q, "ecoscore", "absent", "Éco-score absent du devis : repris du catalogue Beev");
  return q;
}

// ============================================================================
// Point d'entrée : texte brut → devis normalisé
// ============================================================================

export function parseLeaserQuoteText(text: string, fileName = ""): LeaserQuote {
  const leaser = detectLeaser(text);
  const q =
    leaser === "ayvens" ? parseAyvens(text, fileName)
    : leaser === "arval" ? parseArval(text, fileName)
    : leaser === "bpce" ? parseBpce(text, fileName)
    : leaser === "alphabet" ? parseAlphabet(text, fileName)
    : leaser === "vwbank" ? parseVwBank(text, fileName)
    : blankQuote("autre", fileName);
  return finalizeQuote(q, leaser === "autre");
}

/** Drapeaux communs : champs indispensables manquants, cohérence du loyer. */
export function finalizeQuote(q: LeaserQuote, unknownLeaser = false): LeaserQuote {
  // Énergie « Électrique » par défaut alors que le libellé indique un moteur
  // thermique (« Dci », « TSI »…) : on corrige.
  const thermal = ENERGY_FROM_QUOTE.find(([re, e]) => e !== "Électrique" && re.test(`${q.vehicle.model} ${q.vehicle.finition}`));
  if (thermal && /lectri/i.test(q.vehicle.energy)) q.vehicle.energy = thermal[1];
  const has = (f: string) => q.flags.some((x) => x.field === f);
  if (unknownLeaser) flag(q, "loueur", "check", "Loueur non reconnu : saisissez les champs à la main");
  if (!q.vehicle.brand || !q.vehicle.model) { if (!has("vehicule")) flag(q, "vehicule", "check", "Véhicule non lu : à saisir"); }
  if (!(q.rent.totalTtc > 0)) { if (!has("loyer")) flag(q, "loyer", "check", "Loyer total TTC non lu : à saisir"); }
  if (!(q.contract.months > 0) || !(q.contract.km > 0)) { if (!has("contrat")) flag(q, "contrat", "check", "Durée ou kilométrage non lus : à saisir"); }
  if (q.rent.lines.length > 0 && q.rent.totalTtc > 0 && Math.abs(rentLinesSum(q) - q.rent.totalTtc) > 0.05) {
    if (!has("loyer-lignes")) flag(q, "loyer-lignes", "check", `Les lignes du loyer (${rentLinesSum(q).toFixed(2)} €) ne donnent pas le total (${q.rent.totalTtc.toFixed(2)} €)`);
  }
  if (q.leaser !== "autre" && !q.offerNumber) flag(q, "offre", "check", "N° d'offre non lu");
  return q;
}

/** Un drapeau est levé quand l'utilisateur l'a confirmé, ou quand la donnée
 *  manquante a été saisie depuis. */
export function flagResolved(q: LeaserQuote, f: QuoteFlag): boolean {
  if (q.confirmed.includes(f.field)) return true;
  switch (f.field) {
    case "vehicule": return !!q.vehicle.brand && !!q.vehicle.model;
    case "loyer": return q.rent.totalTtc > 0;
    case "contrat": return q.contract.months > 0 && q.contract.km > 0;
    case "offre": return !!q.offerNumber;
    case "client": return !!q.client;
    case "apport": return !q.downPayment.ambiguous;
    case "loueur": return q.leaser !== "autre";
    case "loyer-lignes": return q.rent.lines.length === 0 || Math.abs(rentLinesSum(q) - q.rent.totalTtc) <= 0.05;
    default: return false;
  }
}

/** Les drapeaux qui bloquent l'envoi tant qu'ils ne sont pas levés. */
export function blockingFlags(q: LeaserQuote): QuoteFlag[] {
  return q.flags.filter((f) => f.status === "check" && !flagResolved(q, f));
}

/** Drapeaux dont la levée est automatique (donnée à saisir) : pas de case à cocher. */
export const AUTO_FLAGS = new Set(["vehicule", "loyer", "contrat", "offre", "loueur", "loyer-lignes"]);

// ============================================================================
// Extraction du texte d'un PDF (pdfjs-dist, chargé à la demande)
// ============================================================================

export async function extractPdfLines(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // @ts-expect-error -- worker import URL Vite-style
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default as string;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const out: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const items = (tc.items as Array<{ str: string; transform: number[] }>).filter((it) => it.str && it.str.trim().length > 0);
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of items) {
      const y = Math.round(it.transform[5] / 3);
      const arr = rows.get(y) ?? [];
      arr.push({ x: it.transform[4], s: it.str });
      rows.set(y, arr);
    }
    out.push(`=== PAGE ${p} ===`);
    for (const y of Array.from(rows.keys()).sort((a, b) => b - a)) {
      out.push(rows.get(y)!.sort((a, b) => a.x - b.x).map((c) => c.s).join(" ").replace(/\s+/g, " ").trim());
    }
  }
  return out.join("\n");
}

export async function parseLeaserQuotePdf(file: File): Promise<LeaserQuote> {
  const text = await extractPdfLines(await file.arrayBuffer());
  return parseLeaserQuoteText(text, file.name);
}

// ============================================================================
// Rapprochement avec le catalogue Beev
// ============================================================================

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9+]+/g, " ").trim();

// Alias de marques (devis loueur ↔ catalogue Beev) : formes courtes ou longues.
const BRAND_ALIASES: Record<string, string> = {
  vw: "volkswagen", mercedesbenz: "mercedes", mb: "mercedes", dsautomobiles: "ds", ds: "ds",
  mini: "mini", bmwi: "bmw", lynkco: "lynkco", alfa: "alfaromeo", landrover: "landrover",
};
const brandKey = (s: string) => {
  const k = norm(s).replace(/ /g, "");
  return BRAND_ALIASES[k] ?? k;
};
const compact = (s: string) => norm(s).replace(/ /g, "");
/** Mot du devis présent dans la cible : égalité, ou préfixe commun d'au moins 4 lettres
 *  (« perf » ↔ « performance », « grandlong » ↔ « grand long »). */
const tokenHit = (t: string, targetTokens: string[], targetCompact: string) =>
  targetTokens.includes(t) ||
  (t.length >= 4 && targetTokens.some((x) => x.length >= 4 && (x.startsWith(t) || t.startsWith(x)))) ||
  (t.length >= 3 && targetCompact.includes(t));

export type CatalogueMatch = { vehicle: Vehicle; score: number };

/** Classe les véhicules du catalogue par proximité avec le devis : marque (obligatoire),
 *  modèle (jusqu'à 3 pts), version / finition (jusqu'à 2 pts), batterie et puissance
 *  (1 pt chacune). Score ≥ 3 : correspondance fiable. */
export function matchCatalogue(q: LeaserQuote, vehicles: Vehicle[]): CatalogueMatch[] {
  const brand = brandKey(q.vehicle.brand);
  if (!brand) return [];
  const qModel = compact(q.vehicle.model);
  const modelTok = norm(q.vehicle.model).split(" ").filter(Boolean);
  const finTok = norm(q.vehicle.finition).split(" ").filter((t) => t.length > 1 && !/^\d+(kw|ch|cv)?$/.test(t));
  // « 82.5 kWh » devient « 82 5 kwh » après normalisation ; « 204 77 kwh » (ch puis kWh) : on garde 77.
  const kwh = norm(`${q.vehicle.finition} ${q.vehicle.model}`).match(/(\d+)(?: (\d{1,2}))?\s*kwh/);
  const kwhVal = kwh ? (kwh[2] && Number(kwh[1]) > 150 ? Number(kwh[2]) : Number(kwh[2] ? `${kwh[1]}.${kwh[2]}` : kwh[1])) : null;
  return vehicles
    .map((v) => {
      const vb = brandKey(v.brand);
      if (vb !== brand && !vb.includes(brand) && !brand.includes(vb)) return { vehicle: v, score: 0 };
      // Énergie : un devis thermique ne se rapproche jamais d'un véhicule électrique
      // (Polo TSI ≠ ID. Polo). L'énergie « Électrique » d'un devis peut être une valeur
      // par défaut : l'écart inverse ne fait que baisser le score.
      const qEv = /lectri/i.test(q.vehicle.energy);
      const vEv = v.energy === "Électrique";
      if (!qEv && vEv) return { vehicle: v, score: 0 };
      let score = qEv && !vEv ? -1 : 1;
      // Modèle : comparaison compacte (« model3 » = « model 3 », « e208 » = « e-208 »).
      const vModel = compact(v.model);
      if (qModel && vModel === qModel) score += 3;
      else if (qModel && vModel && (qModel.includes(vModel) || vModel.includes(qModel))) score += 2.5;
      else if (modelTok.length > 0) {
        const vmTok = norm(v.model).split(" ");
        score += (modelTok.filter((t) => tokenHit(t, vmTok, vModel)).length / modelTok.length) * 3;
      }
      // Version / finition : les mots du devis retrouvés dans la version (ou le modèle) Beev.
      if (finTok.length > 0) {
        const target = `${v.version} ${v.model}`;
        const vTok = norm(target).split(" ");
        const vCompact = compact(target);
        score += (finTok.filter((t) => tokenHit(t, vTok, vCompact)).length / finTok.length) * 2;
      }
      if (kwhVal && v.batteryKwh && Math.abs(v.batteryKwh - kwhVal) < 1.5) score += 1;
      if (q.vehicle.powerHp && v.powerHp && Math.abs(v.powerHp - q.vehicle.powerHp) / q.vehicle.powerHp <= 0.05) score += 1;
      return { vehicle: v, score };
    })
    .filter((x) => x.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

/** Véhicule retenu automatiquement : le meilleur s'il est fiable (score ≥ 3), ou
 *  s'il devance nettement le suivant (score ≥ 2,5 et 1 point d'avance). */
export function autoMatch(matches: CatalogueMatch[]): { match: CatalogueMatch; confidence: "high" | "medium" } | null {
  const [a, b] = matches;
  if (!a) return null;
  const gap = a.score - (b?.score ?? 1);
  if (a.score >= 4 && gap >= 0.5) return { match: a, confidence: "high" };
  if (a.score >= 3 || (a.score >= 2.5 && gap >= 1)) return { match: a, confidence: "medium" };
  return null;
}

const ENERGY_FROM_QUOTE: [RegExp, Vehicle["energy"]][] = [
  [/rechargeable|plug-?in|\bphev\b|\be-hybrid\b/i, "Hybride Rechargeable"],
  [/\bmild\b|\bmhev\b|micro-?hybrid/i, "Mild Hybrid"],
  [/\bhybride\b|\bhybrid\b|\bhev\b|full hybrid/i, "Hybride"],
  [/diesel|gazole|gasoil|\b(dci|hdi|bluehdi|tdi|crdi|cdi|jtd|multijet|ecoblue)\b/i, "Diesel"],
  [/essence|petrol|sp95|sp98|\b(tsi|tfsi|tce|puretech|ecoboost|vti|thp)\b/i, "Essence"],
  [/lectri/i, "Électrique"],
];

/** Véhicule absent de la base Beev : fiche créée à partir des données du devis
 *  loueur (propre à ce devis, ne touche pas au catalogue). Les champs non lus
 *  restent à 0 et sont complétés ensuite par les données ouvertes si possible. */
export function vehicleFromQuote(q: LeaserQuote): Vehicle {
  // Motorisation lue dans le libellé (« Dci », « TSI »…) avant l'énergie du devis,
  // qui vaut « Électrique » par défaut quand le loueur ne la précise pas.
  const label = `${q.vehicle.model} ${q.vehicle.finition}`;
  const energy = ENERGY_FROM_QUOTE.find(([re]) => re.test(label))?.[1]
    ?? ENERGY_FROM_QUOTE.find(([re]) => re.test(q.vehicle.energy))?.[1]
    ?? "Électrique";
  return {
    id: `devis-${q.id}`,
    brand: q.vehicle.brand,
    model: q.vehicle.model,
    version: q.vehicle.finition,
    category: "À confirmer",
    energy,
    batteryKwh: 0,
    rangeWltp: 0,
    powerHp: q.vehicle.powerHp ?? 0,
    consumption: 0,
    co2: q.vehicle.co2 ?? 0,
    fiscalHp: q.vehicle.fiscalHp ?? 0,
    priceTtc: q.price.catalogueTtc ?? q.price.totalTtc ?? 0,
    monthlyLld: q.rent.totalTtc,
    image: "",
    custom: true,
    ecoScoreBool: q.vehicle.ecoScoreOk ?? undefined,
    poidsVide: q.vehicle.weightKg ?? undefined,
  } as Vehicle;
}
