// Données de référence véhicules : ADEME « Car Labelling » + Open EV Data.
//
// Sert à compléter ce qu'un Excel client ou le catalogue ne donne pas :
//   - véhicules thermiques / hybrides (ADEME) : CO₂ WLTP, CV fiscaux, puissance,
//     consommation, poids à vide — les entrées du calcul de fiscalité (malus, TVS) ;
//   - véhicules électriques (Open EV Data + ADEME) : autonomie WLTP, batterie,
//     puissance, recharge AC / DC, consommation, CV fiscaux.
//
// Les deux jeux sont embarqués (public/data/*.json) et régénérés par
// scripts/refresh-reference-data.py à partir des sources officielles. Ils sont
// PARTIELS (ADEME : ~900 configurations ; Open EV Data : ~1 200 variantes) : une
// absence n'est jamais une erreur, le champ reste simplement vide.
//
// RÈGLE : on ne remplit que les champs vides (0 / absent). On n'écrase jamais une
// valeur venue du fichier client ou du catalogue.

import type { Energy, Vehicle } from "./catalog";

type RefFile = { meta?: { source?: string }; cols: string[]; rows: unknown[][] };

type AdemeRow = {
  brandKey: string;
  modelTokens: string[];
  desc: string;
  descTokens: string[];
  energy: string;
  body: string;
  fiscal: number;
  hp: number;
  co2: number;
  conso: number;
  consoElec: number;
  weight: number;
  /** Autonomie électrique (km) : voitures électriques et hybrides rechargeables. */
  elecRange: number;
};

type EvRow = {
  brandKey: string;
  make: string;
  model: string;
  tokens: string[];
  year: number;
  trim: string;
  variant: string;
  kw: number;
  kwh: number;
  wltp: number;
  dc: number;
  ac: number;
  curb: number;
  cargo: number;
  len: number;
  wid: number;
  hei: number;
  /** Vendu en France (marché FR déclaré). */
  fr: boolean;
};

export type VehicleReference = { ademe: AdemeRow[]; ev: EvRow[] };

/** Valeurs trouvées pour un véhicule (0 = inconnu). */
export type SpecPatch = {
  co2: number;
  fiscalHp: number;
  powerHp: number;
  consumption: number;
  poidsVide: number;
  rangeWltp: number;
  batteryKwh: number;
  chargeDcMaxKw: number;
  chargeAcMaxKw: number;
  trunkLitres: number;
  /** « 4 750 × 1 850 × 1 620 mm », vide si inconnu. */
  dimensions: string;
  /** Avertissement affiché quand une valeur paraît incohérente. */
  warn: string;
  sources: string[];
  label: string;
  approx: boolean;
};

const KW_TO_HP = 1.359;
/** 4750 -> « 4 750 » (espace insécable fine). */
const fmtMm = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");

const norm = (s: string) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (s: string) => norm(s).split(" ").filter(Boolean);
const n = (x: unknown): number => {
  const v = typeof x === "number" ? x : parseFloat(String(x ?? ""));
  return Number.isFinite(v) ? v : 0;
};

// Marque -> clé commune ADEME / Open EV Data / app (l'ADEME tronque à 10 signes
// et écrit « B.M.W. », « M.G. »).
const BRAND_ALIASES: Record<string, string> = {
  vw: "volkswagen",
  mercedesbenz: "mercedes",
  mgmotor: "mg",
  dsautomobiles: "ds",
  rangerover: "landrover",
};
export function brandKey(b: string): string {
  const c = norm(b).replace(/ /g, "");
  return (BRAND_ALIASES[c] ?? c).slice(0, 10);
}

const startsWith = (a: string[], b: string[]) => b.length > 0 && b.length <= a.length && b.every((t, i) => a[i] === t);
const sameTokens = (a: string[], b: string[]) => a.length === b.length && startsWith(a, b);

// ── Chargement ───────────────────────────────────────────────────────────
function parseAdeme(f: RefFile): AdemeRow[] {
  const c = (k: string) => f.cols.indexOf(k);
  const iBrand = c("Marque"), iModel = c("Modèle"), iDesc = c("Description_Commerciale"), iEn = c("Energie"), iBody = c("Carrosserie");
  const iFisc = c("Puissance_fiscale"), iKw = c("Puissance_maximale"), iKwE = c("Puissance_nominale_électrique");
  const iCo2 = c("CO2_vitesse_mixte_Max"), iCons = c("Conso_vitesse_mixte_Max"), iConsE = c("Conso_elec_Max"), iW = c("Poids_à_vide"), iER = c("Autonomie_elec_Max");
  return f.rows.map((r) => {
    const desc = String(r[iDesc] ?? "");
    const chInDesc = desc.match(/\((\d+)\s*ch/i);
    const kw = n(r[iKw]) || n(r[iKwE]);
    return {
      brandKey: brandKey(String(r[iBrand] ?? "")),
      modelTokens: tokens(String(r[iModel] ?? "")),
      desc,
      descTokens: tokens(desc.replace(/\(.*$/, "")),
      energy: String(r[iEn] ?? ""),
      body: String(r[iBody] ?? ""),
      fiscal: n(r[iFisc]),
      hp: chInDesc ? n(chInDesc[1]) : Math.round(kw * KW_TO_HP),
      co2: n(r[iCo2]),
      conso: n(r[iCons]),
      consoElec: n(r[iConsE]),
      weight: n(r[iW]),
      elecRange: n(r[iER]),
    };
  });
}

// Mots sans valeur discriminante pour rapprocher deux noms de modèle électrique.
const EV_NOISE = new Set(["electric", "ev", "e", "tech", "etech", "new", "nouvelle", "nouveau", "neo", "gen"]);
function evTokens(brand: string, model: string): string[] {
  let t = tokens(model).map((x) => (brand === "renault" && /^r\d$/.test(x) ? x.slice(1) : x));
  t = t.filter((x) => !EV_NOISE.has(x));
  return t;
}

function parseEv(f: RefFile): EvRow[] {
  const c = (k: string) => f.cols.indexOf(k);
  const iMake = c("make_name"), iModel = c("model_name"), iYear = c("year"), iTrim = c("trim_name"), iVar = c("variant_name");
  const iKw = c("system_power_kw"), iKwh = c("battery_capacity_net_kwh"), iR = c("range_wltp_km"), iDc = c("dc_max_power_kw"), iAc = c("ac_max_power_kw");
  const iCurb = c("curb_weight_kg"), iCargo = c("cargo_l"), iLen = c("length_mm"), iWid = c("width_mm"), iHei = c("height_mm"), iFr = c("fr_market");
  return f.rows.map((r) => {
    const make = String(r[iMake] ?? "");
    const bk = brandKey(make);
    return {
      brandKey: bk,
      make,
      model: String(r[iModel] ?? ""),
      tokens: evTokens(bk, String(r[iModel] ?? "")),
      year: n(r[iYear]),
      trim: String(r[iTrim] ?? ""),
      variant: String(r[iVar] ?? ""),
      kw: n(r[iKw]),
      kwh: n(r[iKwh]),
      wltp: n(r[iR]),
      dc: n(r[iDc]),
      ac: n(r[iAc]),
      curb: n(r[iCurb]),
      cargo: n(r[iCargo]),
      len: n(r[iLen]),
      wid: n(r[iWid]),
      hei: n(r[iHei]),
      fr: n(r[iFr]) > 0,
    };
  });
}

/** Construit la référence depuis les deux fichiers JSON (exporté pour les tests). */
export function buildVehicleReference(ademe: RefFile | null, ev: RefFile | null): VehicleReference {
  return { ademe: ademe ? parseAdeme(ademe) : [], ev: ev ? parseEv(ev) : [] };
}

let cache: Promise<VehicleReference> | null = null;
async function fetchJson(url: string): Promise<RefFile | null> {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as RefFile) : null;
  } catch {
    return null;
  }
}
/** Charge (une seule fois) les deux jeux de référence. Ne rejette jamais : en
 *  cas d'échec la référence est simplement vide. */
export function loadVehicleReference(): Promise<VehicleReference> {
  if (!cache) {
    cache = Promise.all([fetchJson("/data/ademe-car-labelling.json"), fetchJson("/data/open-ev-data.json")]).then(([a, e]) => {
      const ref = buildVehicleReference(a, e);
      if (ref.ademe.length === 0 && ref.ev.length === 0) cache = null; // réessaiera au prochain appel
      return ref;
    });
  }
  return cache;
}

// ── ADEME : thermique, hybride, PHEV ─────────────────────────────────────
// L'ADEME classe les diesels et essences à micro-hybridation 48 V (ex. BMW 320d)
// en « hybride non rechargeable » : ces lignes restent valables, mais la ligne de
// la bonne énergie passe devant (voir PRIMARY_ENERGY).
const ADEME_ENERGIES: Record<Energy, string[]> = {
  "Essence": ["ESSENCE", "ESS+G.P.L.", "SUPERETHANOL", "ESS+ELEC HNR"],
  "Diesel": ["GAZOLE", "GAZ+ELEC HNR"],
  "Hybride": ["ESS+ELEC HNR", "GAZ+ELEC HNR"],
  "Mild Hybrid": ["ESS+ELEC HNR", "GAZ+ELEC HNR", "ESSENCE", "GAZOLE"],
  "Hybride Rechargeable": ["ELEC+ESSENC HR", "ELEC+GAZOLE HR"],
  "Électrique": ["ELECTRIC"],
};

const PRIMARY_ENERGY: Partial<Record<Energy, string>> = {
  "Essence": "ESSENCE", "Diesel": "GAZOLE", "Électrique": "ELECTRIC",
};

function ademeModelScore(brand: string, app: string[], row: AdemeRow): number {
  const r = row.modelTokens;
  if (sameTokens(app, r)) return 100;
  if (startsWith(app, r)) return 80; // « 308 sw » ~ « 308 »
  if (startsWith(r, app) && r.slice(app.length).every((t) => /^\d+$/.test(t))) return 75; // « eqa » ~ « eqa 250 »
  if (brand === "bmw" && app[0] === "serie" && /^\d$/.test(app[1] ?? "") && new RegExp(`^${app[1]}\\d\\d$`).test(r[0] ?? "")) return 70;
  if (brand === "mercedes" && app[0] === "classe" && app[1] && r[0] === app[1]) return 70;
  return 0;
}

/** Puissances (ch) citées dans la version : « 130 ch », « 96 kW », ou un nombre
 *  seul de 55 à 600 (« BlueHDi 130 », « TCe 100 »). */
function hpHints(text: string): number[] {
  const out: number[] = [];
  const t = String(text ?? "");
  for (const m of t.matchAll(/(\d{2,3})\s*(?:ch|cv|hp|bhp)\b/gi)) out.push(n(m[1]));
  for (const m of t.matchAll(/(\d{2,3})\s*kw\b/gi)) out.push(Math.round(n(m[1]) * KW_TO_HP));
  if (out.length === 0) for (const m of t.matchAll(/\b(\d{2,3})h?\b/gi)) { const v = n(m[1]); if (v >= 55 && v <= 600) out.push(v); }
  return out;
}

function lookupAdeme(ref: VehicleReference, v: Pick<Vehicle, "brand" | "model" | "version" | "energy">): { row: AdemeRow; approx: boolean } | null {
  const bk = brandKey(v.brand);
  const app = tokens(v.model);
  const energies = ADEME_ENERGIES[v.energy] ?? [];
  let best = 0;
  const scored: Array<{ row: AdemeRow; s: number }> = [];
  for (const row of ref.ademe) {
    if (row.brandKey !== bk || !energies.includes(row.energy)) continue;
    let s = ademeModelScore(bk, app, row);
    if (s === 0) continue;
    if (PRIMARY_ENERGY[v.energy] === row.energy) s += 5;
    // Carrosserie : « 308 sw » préfère la ligne « 308 SW (…) » à « 308 (…) ».
    if (startsWith(row.descTokens, app)) s += 10 - Math.min(2, row.descTokens.length - app.length) * 5;
    scored.push({ row, s });
    if (s > best) best = s;
  }
  let top = scored.filter((x) => x.s === best).map((x) => x.row);
  if (top.length === 0) return null;

  // BMW (320d, 118i…) et Mercedes (E 220 d, A 200…) : la désignation numérique
  // de la version identifie le modèle exact dans la table ; absente, on s'abstient.
  const desig =
    bk === "bmw" ? v.version.match(/\b([1-8]\d{2})(?:d|i|e|xd|xi|xe|ed|li)?\b/i)?.[1]
    : bk === "mercedes" ? v.version.match(/\b(\d{3})\s?(?:d|e|de)?\b/i)?.[1]
    : undefined;
  if (desig) {
    const idx = bk === "bmw" ? 0 : 1;
    top = top.filter((r) => r.modelTokens[idx] === desig);
    if (top.length === 0) return null;
  }

  const hints = hpHints(v.version);
  if (hints.length > 0) {
    let pick = top[0];
    let diff = Infinity;
    let target = hints[0];
    for (const row of top) {
      for (const h of hints) {
        const d = Math.abs(row.hp - h);
        if (d < diff) { diff = d; pick = row; target = h; }
      }
    }
    if (diff > Math.max(12, target * 0.15)) return null; // cette puissance n'existe pas dans la table
    return { row: pick, approx: diff > Math.max(6, target * 0.08) };
  }

  // Aucune puissance citée : on ne remplit que si les versions connues du modèle
  // restent proches (sinon CO₂ et CV fiscaux seraient trompeurs).
  const co2s = top.map((r) => r.co2).filter((x) => x > 0);
  const fiscs = top.map((r) => r.fiscal).filter((x) => x > 0);
  const spreadCo2 = co2s.length ? Math.max(...co2s) / Math.min(...co2s) : 1;
  const spreadFisc = fiscs.length ? Math.max(...fiscs) - Math.min(...fiscs) : 0;
  if (spreadCo2 > 1.25 || spreadFisc > 2) return null;
  const sorted = [...top].sort((a, b) => a.hp - b.hp);
  return { row: sorted[Math.floor(sorted.length / 2)], approx: true };
}

// ── Open EV Data : électrique ────────────────────────────────────────────
function lookupEv(ref: VehicleReference, v: Pick<Vehicle, "brand" | "model" | "version">): { row: EvRow; approx: boolean } | null {
  const bk = brandKey(v.brand);
  const app = evTokens(bk, v.model);
  if (app.length === 0) return null;
  const scored: Array<{ row: EvRow; s: number }> = [];
  let best = 0;
  for (const row of ref.ev) {
    if (row.brandKey !== bk || row.wltp <= 0 || row.tokens.length === 0) continue;
    let s = 0;
    if (sameTokens(app, row.tokens)) s = 100;
    else if (startsWith(app, row.tokens)) s = 70; // « cla shooting brake 250 » ~ « cla shooting brake »
    else if (startsWith(row.tokens, app)) s = 60;
    if (s === 0) continue;
    s -= Math.abs(row.tokens.length - app.length); // moins de mots en trop = plus précis
    scored.push({ row, s });
    if (s > best) best = s;
  }
  let top = scored.filter((x) => x.s === best).map((x) => x.row);
  if (top.length === 0) return null;
  // Variantes déclarées vendues en France d'abord (évite une version chinoise ou américaine).
  const sold = top.filter((r) => r.fr);
  if (sold.length > 0) top = sold;

  // Variante : capacité (« 77 kWh »), mots de la finition, année la plus récente.
  const text = `${v.model} ${v.version}`;
  const kwhHints = [...text.matchAll(/(\d{2,3}(?:[.,]\d)?)\s*kwh/gi)].map((m) => n(m[1].replace(",", ".")));
  const words = new Set(tokens(v.version).filter((t) => t.length >= 3 && !/^\d+$/.test(t)));
  const maxYear = Math.max(...top.map((r) => r.year));
  let bestRow = top[0];
  let bestScore = -1;
  let matched = false;
  for (const row of top) {
    let sc = row.year === maxYear ? 1 : 0;
    if (row.kwh > 0 && kwhHints.some((k) => Math.abs(k - row.kwh) <= 3)) { sc += 10; matched = true; }
    const rowWords = new Set([...tokens(row.trim), ...tokens(row.variant)]);
    for (const w of words) if (rowWords.has(w)) { sc += 3; matched = true; }
    if (sc > bestScore) { bestScore = sc; bestRow = row; }
  }
  if (!matched) {
    // Aucune finition identifiable : variante médiane de l'année la plus récente.
    const recent = top.filter((r) => r.year === maxYear).sort((a, b) => a.wltp - b.wltp);
    bestRow = recent[Math.floor(recent.length / 2)];
  }
  return { row: bestRow, approx: !matched };
}

// ── API publique ─────────────────────────────────────────────────────────
/** Caractéristiques de référence d'un véhicule, ou null si aucune source ne le connaît. */
export function lookupSpecs(
  ref: VehicleReference,
  v: Pick<Vehicle, "brand" | "model" | "version" | "energy">,
): SpecPatch | null {
  const patch: SpecPatch = {
    co2: 0, fiscalHp: 0, powerHp: 0, consumption: 0, poidsVide: 0, rangeWltp: 0, batteryKwh: 0,
    chargeDcMaxKw: 0, chargeAcMaxKw: 0, trunkLitres: 0, dimensions: "", warn: "",
    sources: [], label: "", approx: false,
  };
  const labels: string[] = [];

  const a = lookupAdeme(ref, v);
  if (a) {
    const r = a.row;
    patch.fiscalHp = r.fiscal;
    patch.powerHp = r.hp;
    patch.poidsVide = r.weight;
    if (v.energy === "Électrique") {
      patch.consumption = r.consoElec > 0 ? Math.round(r.consoElec) / 10 : 0; // Wh/km -> kWh/100 km
      patch.rangeWltp = r.elecRange; // repli si Open EV Data ne connaît pas le modèle (écrasé plus bas sinon)
    } else {
      // Hybride rechargeable : autonomie 100 % électrique homologuée.
      if (v.energy === "Hybride Rechargeable") patch.rangeWltp = r.elecRange;
      patch.co2 = Math.round(r.co2);
      patch.consumption = Math.round(r.conso * 10) / 10;
    }
    patch.sources.push("ADEME");
    labels.push(`ADEME : ${r.desc}`);
    if (a.approx) patch.approx = true;
  }

  if (v.energy === "Électrique") {
    const e = lookupEv(ref, v);
    if (e) {
      const r = e.row;
      patch.rangeWltp = r.wltp;
      patch.batteryKwh = r.kwh;
      patch.trunkLitres = r.cargo;
      if (r.len > 0 && r.wid > 0 && r.hei > 0) patch.dimensions = `${fmtMm(r.len)} × ${fmtMm(r.wid)} × ${fmtMm(r.hei)} mm`;
      // Autonomie incohérente avec la batterie (kWh pour 100 km) : valeur à vérifier.
      if (r.kwh > 0 && r.wltp > 0) {
        const kwh100 = (r.kwh / r.wltp) * 100;
        if (kwh100 < 11.5 || kwh100 > 26) patch.warn = `Autonomie non reprise, à vérifier : ${Math.round(r.wltp)} km annoncés pour ${r.kwh} kWh de batterie (${kwh100.toFixed(1).replace(".", ",")} kWh/100 km), écart inhabituel.`;
      }
      // Puissance et recharge ne sont reprises que si la finition est identifiée
      // (une variante « médiane » peut avoir une toute autre puissance).
      if (!e.approx) {
        if (!patch.poidsVide && r.curb > 0) patch.poidsVide = r.curb;
        if (!patch.powerHp && r.kw > 0) patch.powerHp = Math.round(r.kw * KW_TO_HP);
        patch.chargeDcMaxKw = r.dc;
        patch.chargeAcMaxKw = r.ac;
      }
      patch.sources.push("Open EV Data");
      labels.push(`Open EV Data : ${r.make} ${r.model}${r.variant || r.trim ? ` ${r.variant || r.trim}` : ""} ${r.year}`);
      if (e.approx) patch.approx = true;
    }
  }

  if (patch.sources.length === 0) return null;
  patch.label = labels.join(" · ");
  return patch;
}

const FIELDS: Array<keyof Pick<SpecPatch, "co2" | "fiscalHp" | "powerHp" | "consumption" | "poidsVide" | "rangeWltp" | "batteryKwh" | "chargeDcMaxKw" | "chargeAcMaxKw" | "trunkLitres">> = [
  "co2", "fiscalHp", "powerHp", "consumption", "poidsVide", "rangeWltp", "batteryKwh", "chargeDcMaxKw", "chargeAcMaxKw", "trunkLitres",
];

/** Complète les champs VIDES d'un véhicule depuis la référence. Renvoie une copie
 *  (jamais l'original) avec `specsMeta`, ou le même objet si rien n'a été ajouté. */
/** Puissance fiscale française (véhicules à moteur thermique, depuis 1998) :
 *  P = CO₂ (g/km) ÷ 45 + (puissance kW ÷ 40)^1,6, arrondie à l'entier le plus proche.
 *  Renvoie 0 si une des deux données manque. */
export function computeFiscalHp(co2: number, powerHp: number): number {
  if (!(co2 > 0) || !(powerHp > 0)) return 0;
  const kw = powerHp / KW_TO_HP;
  return Math.max(1, Math.round(co2 / 45 + Math.pow(kw / 40, 1.6)));
}

export function enrichVehicle<T extends Vehicle>(v: T, ref: VehicleReference | null): T {
  const spec = ref ? lookupSpecs(ref, v) : null;
  const next = { ...v } as T & Record<string, unknown>;
  const filled: string[] = [];
  // Une valeur du fichier ou du catalogue n'est jamais écrasée.
  if (spec) {
    for (const f of FIELDS) {
      const val = spec[f];
      if (!(val > 0)) continue;
      if (f === "co2" && v.energy === "Électrique") continue;
      if (f === "rangeWltp" && spec.warn) continue; // autonomie suspecte : non reprise
      const cur = (v as unknown as Record<string, unknown>)[f];
      if (typeof cur === "number" && cur > 0) continue;
      next[f] = val;
      filled.push(f);
    }
  }
  if (spec?.dimensions && !(typeof v.dimensions === "string" && v.dimensions.trim())) {
    next.dimensions = spec.dimensions;
    filled.push("dimensions");
  }
  const sources = spec ? [...spec.sources] : [];
  let label = spec ? spec.label : "";

  // CV fiscaux : si aucune source ne les donne mais que CO₂ et puissance sont connus
  // (fichier client ou source de référence), on les calcule avec la formule officielle.
  if (v.energy !== "Électrique" && !(Number(next.fiscalHp) > 0)) {
    const calc = computeFiscalHp(Number(next.co2), Number(next.powerHp));
    if (calc > 0) {
      next.fiscalHp = calc;
      filled.push("fiscalHp");
      sources.push("Formule fiscale");
      label = `${label ? `${label} · ` : ""}CV fiscaux calculés : CO₂ ÷ 45 + (kW ÷ 40)^1,6`;
    }
  }

  if (filled.length === 0 && !spec?.warn) return v;
  next.specsMeta = { sources, fields: filled, label, approx: spec?.approx ?? false, ...(spec?.warn ? { warn: spec.warn } : {}) };
  return next as T;
}

/** Charge la référence puis complète une liste de véhicules. */
export async function enrichVehicles<T extends Vehicle>(list: T[]): Promise<{ list: T[]; enriched: number }> {
  const loaded = await loadVehicleReference();
  const ref = loaded.ademe.length === 0 && loaded.ev.length === 0 ? null : loaded;
  let enriched = 0;
  const out = list.map((v) => {
    const e = enrichVehicle(v, ref);
    if (e !== v) enriched++;
    return e;
  });
  return { list: out, enriched };
}

/** Catalogue dont les EV sans autonomie reçoivent celle d'Open EV Data (copie ; le
 *  catalogue en base n'est jamais modifié). Sert au classement par autonomie. */
export function fillMissingRanges(catalogue: Vehicle[], ref: VehicleReference | null): Vehicle[] {
  if (!ref || ref.ev.length === 0) return catalogue;
  return catalogue.map((v) => {
    if (v.energy !== "Électrique" || v.rangeWltp > 0) return v;
    const e = lookupEv(ref, v);
    if (!e) return v;
    const r = e.row;
    // Une autonomie incohérente avec la batterie ne sert pas au classement.
    if (r.kwh > 0 && ((r.kwh / r.wltp) * 100 < 11.5 || (r.kwh / r.wltp) * 100 > 26)) return v;
    return {
      ...v,
      rangeWltp: r.wltp,
      batteryKwh: v.batteryKwh > 0 ? v.batteryKwh : r.kwh,
      specsMeta: {
        sources: ["Open EV Data"],
        fields: v.batteryKwh > 0 ? ["rangeWltp"] : ["rangeWltp", "batteryKwh"],
        label: `Open EV Data : ${r.make} ${r.model}${r.variant || r.trim ? ` ${r.variant || r.trim}` : ""} ${r.year}`,
        approx: e.approx,
      },
    };
  });
}
