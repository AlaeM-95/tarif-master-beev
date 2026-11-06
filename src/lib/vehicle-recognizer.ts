// Moteur local de reconnaissance de véhicules — sans IA, sans clé, sans réseau.
//
// À partir d'un libellé libre (« Peugeot 308 SW 1.5 BlueHDi 130 EAT8 »), il
// retrouve la marque, le modèle, la catégorie et l'énergie grâce à :
//   - un dictionnaire des modèles courants en flotte en France ;
//   - des règles sur la motorisation (BlueHDi, TDI, dCi, TCe, PHEV, kWh…).
// Il alimente l'import car policy : l'IA n'est appelée que pour les lignes que
// ce moteur ne reconnaît pas avec assez de certitude.
//
// Entretien : pour ajouter un modèle, ajouter une ligne dans RAW sous sa marque
// (format « Nom|Catégorie|ev si 100 % électrique|alias séparés par des virgules »).
// Les catégories sont celles du catalogue : Citadine, Compacte, Berline, Break,
// SUV, SUV Coupé, Monospace, Utilitaire.

import type { Energy } from "./catalog";

// Une marque : « @NOM|alias,alias ». Un modèle : « Nom|Catégorie|ev|alias,alias ».
const RAW = `
@PEUGEOT|peugeot
108|Citadine
208|Citadine
E-208|Citadine|ev
2008|SUV
E-2008|SUV|ev
308|Compacte
308 SW|Break
E-308|Compacte|ev
E-308 SW|Break|ev
408|SUV Coupé
E-408|SUV Coupé|ev
508|Berline
508 SW|Break
3008|SUV
E-3008|SUV|ev
5008|SUV
E-5008|SUV|ev
Rifter|Monospace
E-Rifter|Monospace|ev
Partner|Utilitaire
E-Partner|Utilitaire|ev
Expert|Utilitaire
E-Expert|Utilitaire|ev
Boxer|Utilitaire
E-Boxer|Utilitaire|ev
Traveller|Monospace
E-Traveller|Monospace|ev
@RENAULT|renault
Twingo|Citadine
Clio|Citadine
Captur|SUV
Symbioz|SUV
Megane|Compacte
Megane E-Tech|Compacte|ev|megane electric
Scenic|SUV
Scenic E-Tech|SUV|ev|scenic electric
Arkana|SUV Coupé
Austral|SUV
Rafale|SUV Coupé
Espace|SUV
Talisman|Berline
Kadjar|SUV
Zoe|Citadine|ev|zoe e tech
R5|Citadine|ev|5,5 e tech,5 electric
R4|SUV|ev|4,4 e tech
Kangoo|Utilitaire|-|kangoo van
Kangoo E-Tech|Utilitaire|ev|kangoo van e tech,kangoo electric
Trafic|Utilitaire
Master|Utilitaire
Master E-Tech|Utilitaire|ev|master electric
Express|Utilitaire
@DACIA|dacia
Sandero|Citadine
Sandero Stepway|Citadine
Spring|Citadine|ev
Duster|SUV
Jogger|Break
Logan|Berline
Bigster|SUV
@CITROËN|citroen,citroën
C1|Citadine
C3|Citadine
Ë-C3|Citadine|ev|e c3,ec3
C3 Aircross|SUV
C4|Compacte
Ë-C4|Compacte|ev|e c4,ec4
C4 X|Berline
Ë-C4 X|Berline|ev|e c4 x
C5 Aircross|SUV
C5 X|Berline
Berlingo|Monospace
Berlingo Van|Utilitaire
Ë-Berlingo|Monospace|ev|e berlingo
Ë-Berlingo Van|Utilitaire|ev|e berlingo van
Jumpy|Utilitaire
Ë-Jumpy|Utilitaire|ev|e jumpy
Jumper|Utilitaire
Ë-Jumper|Utilitaire|ev|e jumper
SpaceTourer|Monospace
Ë-SpaceTourer|Monospace|ev|e spacetourer
Ami|Citadine|ev
@DS|ds,ds automobiles
DS 3|Citadine
DS 3 E-Tense|Citadine|ev
DS 4|Compacte
DS 7|SUV
DS 9|Berline
@OPEL|opel
Corsa|Citadine
Corsa Electric|Citadine|ev|corsa e
Mokka|SUV
Mokka Electric|SUV|ev|mokka e
Crossland|SUV
Astra|Compacte
Astra Sports Tourer|Break|-|astra st
Astra Electric|Compacte|ev
Grandland|SUV
Frontera|SUV
Insignia|Berline
Insignia Sports Tourer|Break
Combo|Utilitaire
Combo Electric|Utilitaire|ev|combo e
Vivaro|Utilitaire
Vivaro Electric|Utilitaire|ev|vivaro e
Movano|Utilitaire
Zafira Life|Monospace
@FORD|ford
Fiesta|Citadine
Focus|Compacte
Focus SW|Break|-|focus sw,focus clipper
Puma|SUV
Kuga|SUV
Mustang Mach-E|SUV|ev|mach e
Capri|SUV Coupé|ev
Explorer|SUV
Mondeo|Berline
Mondeo SW|Break
S-Max|Monospace
Galaxy|Monospace
Tourneo Connect|Monospace
Tourneo Courier|Monospace
Tourneo Custom|Monospace
Transit|Utilitaire
Transit Custom|Utilitaire
Transit Connect|Utilitaire
Transit Courier|Utilitaire
E-Transit|Utilitaire|ev
E-Transit Custom|Utilitaire|ev
Ranger|Utilitaire
@VW|vw,volkswagen
Polo|Citadine
Up|Citadine
E-Up|Citadine|ev
Golf|Compacte
Golf SW|Break|-|golf variant
E-Golf|Compacte|ev
ID.3|Compacte|ev
ID.4|SUV|ev
ID.5|SUV Coupé|ev
ID.7|Berline|ev
ID.7 Tourer|Break|ev
ID. Buzz|Monospace|ev
ID. Buzz Cargo|Utilitaire|ev
T-Roc|SUV
T-Cross|SUV
Taigo|SUV Coupé
Tiguan|SUV
Touareg|SUV
Passat|Berline
Passat SW|Break|-|passat variant
Arteon|Berline
Arteon Shooting Brake|Break
Touran|Monospace
Caddy|Utilitaire
Caddy Cargo|Utilitaire
Transporter|Utilitaire
Crafter|Utilitaire
Multivan|Monospace
Amarok|Utilitaire
@SKODA|skoda,škoda
Fabia|Citadine
Citigo|Citadine
Scala|Compacte
Kamiq|SUV
Karoq|SUV
Kodiaq|SUV
Octavia|Berline
Octavia Combi|Break
Superb|Berline
Superb Combi|Break
Enyaq|SUV|ev
Enyaq Coupé|SUV Coupé|ev
Elroq|SUV|ev
@SEAT|seat
Ibiza|Citadine
Leon|Compacte
Leon Sportstourer|Break
Arona|SUV
Ateca|SUV
Tarraco|SUV
@CUPRA|cupra
Born|Compacte|ev
Formentor|SUV Coupé
Leon|Compacte
Leon Sportstourer|Break
Ateca|SUV
Tavascan|SUV Coupé|ev
Terramar|SUV
@AUDI|audi
A1|Citadine
A3|Compacte
A3 Sportback|Compacte
A4|Berline
A4 Avant|Break
A5|Berline
A5 Avant|Break
A6|Berline
A6 Avant|Break
A6 e-tron|Berline|ev
A6 Avant e-tron|Break|ev
A7|Berline
A8|Berline
Q2|SUV
Q3|SUV
Q3 Sportback|SUV Coupé
Q4 e-tron|SUV|ev
Q4 Sportback e-tron|SUV Coupé|ev
Q5|SUV
Q5 Sportback|SUV Coupé
Q7|SUV
Q8|SUV Coupé
Q8 e-tron|SUV|ev
e-tron GT|Berline|ev
e-tron|SUV|ev
@BMW|bmw
Série 1|Compacte|-|serie 1,1 series
Série 2 Active Tourer|Monospace|-|serie 2 active tourer
Série 2 Gran Coupé|Berline|-|serie 2 gran coupe
Série 3|Berline|-|serie 3,3 series
Série 3 Touring|Break|-|serie 3 touring
Série 4|Berline|-|serie 4
Série 5|Berline|-|serie 5
Série 5 Touring|Break|-|serie 5 touring
Série 7|Berline|-|serie 7
X1|SUV
X2|SUV Coupé
X3|SUV
X4|SUV Coupé
X5|SUV
X6|SUV Coupé
X7|SUV
iX1|SUV|ev
iX2|SUV Coupé|ev
iX3|SUV|ev
iX|SUV|ev
i4|Berline|ev
i5|Berline|ev
i5 Touring|Break|ev
i7|Berline|ev
@MERCEDES|mercedes,mercedes benz,mercedes-benz,mb
Classe A|Compacte|-|a class,a klasse
Classe B|Monospace|-|b class
Classe C|Berline|-|c class,c klasse
Classe C Break|Break|-|classe c sw,c break
Classe E|Berline|-|e class
Classe E Break|Break|-|classe e sw,e break
Classe S|Berline|-|s class
Classe V|Monospace|-|v class
Classe G|SUV|-|g class
CLA|Berline
CLA Shooting Brake|Break
GLA|SUV
GLB|SUV
GLC|SUV
GLC Coupé|SUV Coupé|-|glc coupe
GLE|SUV
GLS|SUV
EQA|SUV|ev
EQB|SUV|ev
EQC|SUV|ev
EQE|Berline|ev
EQE SUV|SUV|ev
EQS|Berline|ev
EQS SUV|SUV|ev
Citan|Utilitaire
eCitan|Utilitaire|ev
Vito|Utilitaire
eVito|Utilitaire|ev
Sprinter|Utilitaire
eSprinter|Utilitaire|ev
@VOLVO|volvo
XC40|SUV
EX40|SUV|ev
EC40|SUV Coupé|ev
C40|SUV Coupé|ev
XC60|SUV
XC90|SUV
EX90|SUV|ev
EX30|SUV|ev
V60|Break
V90|Break
S60|Berline
S90|Berline
@TOYOTA|toyota
Aygo X|Citadine
Yaris|Citadine
Yaris Cross|SUV
Corolla|Compacte
Corolla Touring Sports|Break|-|corolla ts,corolla touring
C-HR|SUV
RAV4|SUV
Camry|Berline
Prius|Compacte
Highlander|SUV
Land Cruiser|SUV
bZ4X|SUV|ev
Urban Cruiser|SUV|ev
Proace|Utilitaire
Proace City|Utilitaire
Proace Verso|Monospace
Proace Electric|Utilitaire|ev
Hilux|Utilitaire
@HYUNDAI|hyundai
i10|Citadine
i20|Citadine
i30|Compacte
i30 SW|Break
Bayon|SUV
Kona|SUV
Kona Electric|SUV|ev
Tucson|SUV
Santa Fe|SUV
Ioniq|Berline
Ioniq 5|SUV|ev
Ioniq 6|Berline|ev
Ioniq 9|SUV|ev
Inster|Citadine|ev
Staria|Monospace
@KIA|kia
Picanto|Citadine
Ceed|Compacte
Ceed SW|Break
XCeed|SUV
Stonic|SUV
Niro|SUV
Niro EV|SUV|ev|e niro
Sportage|SUV
Sorento|SUV
EV3|SUV|ev
EV6|SUV|ev
EV9|SUV|ev
PV5|Utilitaire|ev
@NISSAN|nissan
Micra|Citadine
Juke|SUV
Qashqai|SUV
X-Trail|SUV
Leaf|Compacte|ev
Ariya|SUV|ev
Townstar|Utilitaire
Townstar EV|Utilitaire|ev
Primastar|Utilitaire
Interstar|Utilitaire
Navara|Utilitaire
@MAZDA|mazda
Mazda2|Citadine|-|2
Mazda3|Compacte|-|3
CX-30|SUV
CX-5|SUV
CX-60|SUV
MX-30|SUV|ev
@HONDA|honda
Jazz|Citadine
Civic|Compacte
HR-V|SUV
CR-V|SUV
ZR-V|SUV
e:Ny1|SUV|ev
@MITSUBISHI|mitsubishi
Space Star|Citadine
ASX|SUV
Eclipse Cross|SUV
Outlander|SUV
L200|Utilitaire
@SUZUKI|suzuki
Swift|Citadine
Ignis|Citadine
Vitara|SUV
S-Cross|SUV
Across|SUV
@LEXUS|lexus
UX|SUV
NX|SUV
RX|SUV
ES|Berline
LBX|SUV
RZ|SUV|ev
@FIAT|fiat
500|Citadine
500e|Citadine|ev|500 electrique,e 500,500 e
500X|SUV
Panda|Citadine
Tipo|Compacte
Tipo SW|Break
600|SUV
600e|SUV|ev|600 electrique
Doblo|Utilitaire
E-Doblo|Utilitaire|ev
Scudo|Utilitaire
E-Scudo|Utilitaire|ev
Ducato|Utilitaire
E-Ducato|Utilitaire|ev
Fiorino|Utilitaire
@JEEP|jeep
Avenger|SUV
Renegade|SUV
Compass|SUV
Wrangler|SUV
Grand Cherokee|SUV
@ALFA ROMEO|alfa romeo,alfa
Giulia|Berline
Stelvio|SUV
Tonale|SUV
Junior|SUV
@MINI|mini
Cooper|Citadine
Cooper SE|Citadine|ev
Countryman|SUV
Aceman|SUV|ev
Clubman|Break
@LAND ROVER|land rover,range rover,landrover
Defender|SUV
Discovery|SUV
Discovery Sport|SUV
Range Rover Evoque|SUV|-|evoque
Range Rover Velar|SUV|-|velar
Range Rover Sport|SUV
Range Rover|SUV
@PORSCHE|porsche
Macan|SUV
Macan Electric|SUV|ev
Cayenne|SUV
Panamera|Berline
Taycan|Berline|ev
Taycan Cross Turismo|Break|ev
911|Berline
@TESLA|tesla
Model 3|Berline|ev
Model Y|SUV|ev
Model S|Berline|ev
Model X|SUV|ev
@POLESTAR|polestar
Polestar 2|Berline|ev|2
Polestar 3|SUV|ev|3
Polestar 4|SUV Coupé|ev|4
@MG|mg,mg motor
MG3|Citadine|-|3
MG4|Compacte|ev|4
MG5|Break|ev|5
ZS|SUV
HS|SUV
Marvel R|SUV|ev
@BYD|byd
Dolphin|Compacte|ev
Atto 3|SUV|ev
Seal|Berline|ev
Seal U|SUV
Han|Berline|ev
@SMART|smart
#1|SUV|ev
#3|SUV Coupé|ev
@LEAPMOTOR|leapmotor
T03|Citadine|ev
C10|SUV|ev
`;

type ModelDef = { name: string; category: string; ev: boolean; seqs: string[][] };
type BrandDef = { name: string; seqs: string[][]; models: ModelDef[] };

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const toks = (s: string): string[] => {
  const n = norm(s);
  return n ? n.split(" ") : [];
};

const BRANDS: BrandDef[] = (() => {
  const out: BrandDef[] = [];
  for (const line of RAW.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    if (l.startsWith("@")) {
      const [name, al = ""] = l.slice(1).split("|");
      const seqs = [name, ...al.split(",")].map(toks).filter((s) => s.length > 0);
      out.push({ name, seqs, models: [] });
      continue;
    }
    const brand = out[out.length - 1];
    if (!brand) continue;
    const [name, category, flags = "", al = ""] = l.split("|");
    const seqs: string[][] = [];
    for (const raw of [name, ...al.split(",")]) {
      const s = toks(raw);
      if (s.length === 0) continue;
      seqs.push(s);
      // forme compacte : « ID.4 » = « ID4 », « E-208 » = « E208 »
      if (s.length === 2) seqs.push([s.join("")]);
    }
    brand.models.push({ name: name.toUpperCase(), category, ev: flags === "ev", seqs });
  }
  return out;
})();

export const DICTIONARY_MODELS = BRANDS.reduce((n, b) => n + b.models.length, 0);

export type Recognized = {
  brand: string;
  /** Vide si la marque est reconnue mais pas le modèle. */
  model: string;
  /** Reste du libellé (motorisation, finition…). */
  version: string;
  category: string;
  /** Modèle 100 % électrique d'après le dictionnaire. */
  ev: boolean;
  /** Énergie suggérée par le dictionnaire ou par une désignation (330e = PHEV). */
  energyHint: Energy | null;
  confidence: number;
};

const BREAK_WORDS = new Set(["sw", "break", "touring", "avant", "combi", "variant", "sportswagon", "sportbreak", "tourer", "estate", "sportstourer", "shooting"]);

function find(tk: string[], seq: string[], taken: boolean[]): number {
  outer: for (let i = 0; i + seq.length <= tk.length; i++) {
    for (let j = 0; j < seq.length; j++) {
      if (tk[i + j] !== seq[j] || taken[i + j]) continue outer;
    }
    return i;
  }
  return -1;
}

// Désignations numériques BMW (320d, 118i, 530e…) et Mercedes (A180, C220d, GLC300e…).
function suffixEnergy(suffix: string): Energy | null {
  if (suffix === "e" || suffix === "xe") return "Hybride Rechargeable";
  if (suffix === "d" || suffix === "xd" || suffix === "ed") return "Diesel";
  if (suffix === "i" || suffix === "xi" || suffix === "li") return "Essence";
  return null;
}
function patternModel(brand: string, tk: string[]): { name: string; category: string; energy: Energy | null; i: number } | null {
  for (let i = 0; i < tk.length; i++) {
    const t = tk[i];
    if (brand === "BMW") {
      const m = t.match(/^([1-8])\d{2}(d|i|e|xd|xi|xe|ed|li)?$/);
      if (m) return { name: `SÉRIE ${m[1]}`, category: m[1] === "1" ? "Compacte" : "Berline", energy: suffixEnergy(m[2] ?? ""), i };
    }
    if (brand === "MERCEDES") {
      const m = t.match(/^(a|b|c|e|s)\d{3}(d|e|de)?$/);
      if (m) {
        const cat = { a: "Compacte", b: "Monospace", c: "Berline", e: "Berline", s: "Berline" }[m[1] as "a"];
        return { name: `CLASSE ${m[1].toUpperCase()}`, category: cat, energy: m[2] === "d" ? "Diesel" : m[2] ? "Hybride Rechargeable" : "Essence", i };
      }
      const g = t.match(/^(gla|glb|glc|gle|gls|cla)\d{3}(d|e|de)?$/);
      if (g) return { name: g[1].toUpperCase(), category: g[1] === "cla" ? "Berline" : "SUV", energy: g[2] === "d" ? "Diesel" : g[2] ? "Hybride Rechargeable" : "Essence", i };
    }
  }
  return null;
}

/** Reconnaît marque + modèle dans un libellé libre. Renvoie null si rien n'est
 *  reconnu. Ne devine jamais une marque ambiguë (« Expert » existe chez
 *  plusieurs constructeurs). */
export function recognizeVehicle(text: string): Recognized | null {
  const pieces = (text ?? "").split(/[\s/,;()]+/).filter(Boolean);
  const tk: string[] = [];
  const owner: number[] = [];
  pieces.forEach((p, pi) => {
    for (const t of toks(p)) {
      tk.push(t);
      owner.push(pi);
    }
  });
  if (tk.length === 0) return null;
  const none = new Array<boolean>(tk.length).fill(false);

  // 1) marque explicite (alias le plus long)
  let brand: BrandDef | null = null;
  let bPos = -1;
  let bLen = 0;
  for (const b of BRANDS) {
    for (const seq of b.seqs) {
      const i = find(tk, seq, none);
      if (i >= 0 && seq.length > bLen) { brand = b; bPos = i; bLen = seq.length; }
    }
  }

  type Cand = { brand: BrandDef; name: string; category: string; ev: boolean; hint: Energy | null; i: number; len: number };
  let best: Cand | null = null;
  const brandless: Cand[] = [];

  if (brand) {
    // Les jetons de la marque peuvent faire partie du nom du modèle (« DS 3 »,
    // « Range Rover Evoque ») : on ne les bloque pas, le plus long gagne.
    for (const m of brand.models) {
      for (const seq of m.seqs) {
        const i = find(tk, seq, none);
        if (i < 0) continue;
        if (!best || seq.length > best.len || (seq.length === best.len && i < best.i)) {
          best = { brand, name: m.name, category: m.category, ev: m.ev, hint: m.ev ? "Électrique" : null, i, len: seq.length };
        }
      }
    }
    if (!best) {
      const p = patternModel(brand.name, tk);
      // len 0 : la désignation (320d, A200…) reste dans la version, elle précise le modèle exact.
      if (p) best = { brand, name: p.name, category: p.category, ev: false, hint: p.energy, i: p.i, len: 0 };
    }
  } else {
    // 2) pas de marque : un modèle distinctif suffit s'il n'appartient qu'à une marque
    for (const b of BRANDS) {
      for (const m of b.models) {
        for (const seq of m.seqs) {
          const joined = seq.join("");
          const distinctive = joined.length >= 3 || /\d/.test(joined);
          if (!distinctive) continue;
          const i = find(tk, seq, none);
          if (i < 0) continue;
          if (/^\d+$/.test(joined) && i !== 0) continue; // « 500 » seul en milieu de phrase
          brandless.push({ brand: b, name: m.name, category: m.category, ev: m.ev, hint: m.ev ? "Électrique" : null, i, len: seq.length });
        }
      }
    }
    if (brandless.length > 0) {
      const maxLen = Math.max(...brandless.map((c) => c.len));
      const top = brandless.filter((c) => c.len === maxLen);
      const brands = new Set(top.map((c) => c.brand.name));
      if (brands.size === 1) best = top.sort((a, b) => a.i - b.i)[0];
    }
  }

  if (!best && !brand) return null;

  const used = new Array<boolean>(tk.length).fill(false);
  if (brand) for (let k = 0; k < bLen; k++) used[bPos + k] = true;
  if (best) for (let k = 0; k < best.len; k++) used[best.i + k] = true;

  const rest = pieces.filter((_, pi) => {
    let total = 0;
    let u = 0;
    owner.forEach((o, ti) => { if (o === pi) { total++; if (used[ti]) u++; } });
    return total > 0 && u < total;
  });

  if (!best) {
    return { brand: brand!.name, model: "", version: rest.join(" "), category: "", ev: false, energyHint: null, confidence: 0.5 };
  }

  let category = best.category;
  if (["Compacte", "Berline", "Citadine"].includes(category)) {
    const hasBreak = tk.some((t, ti) => !used[ti] && BREAK_WORDS.has(t));
    if (hasBreak) category = "Break";
  }
  return {
    brand: best.brand.name,
    model: best.name,
    version: rest.join(" "),
    category,
    ev: best.ev,
    energyHint: best.hint,
    confidence: brand ? 0.9 : 0.85,
  };
}

// ── Énergie ───────────────────────────────────────────────────────────────
const RE = {
  phev: /(^| )(phev|plug in|rechargeable|gte|ehybrid|e hybrid|hybride rechargeable|hybrid rechargeable)( |$)/,
  electric: /(^| )(electrique|electric|elektrik|elec|bev|ev|zero emission|tout electrique|\d{2,3} kwh|kwh|e tense|e tron)( |$)/,
  mild: /(^| )(mhev|mild hybrid|mild|micro hybrid|48v|hybrid 48v)( |$)/,
  hybrid: /(^| )(hybrid|hybride|hev|full hybrid)( |$)|(^| )\d{2,3}h( |$)/,
  diesel: /(^| )(diesel|gazole|hdi|bluehdi|blue hdi|tdi|dci|blue dci|tdci|crdi|cdti|jtd|multijet|ecoblue|sdi|d4d|dtec|\d{2,3}d|d[2-6])( |$)/,
  essence: /(^| )(essence|petrol|gasoline|sp95|sp98|e85|gpl|tce|puretech|pure tech|tsi|tfsi|mpi|vti|thp|gdi|t gdi|ecoboost|eco boost|\d{2,3}i)( |$)/,
};

function detectEnergy(s: string): Energy | null {
  const n = norm(s);
  if (!n) return null;
  if (RE.phev.test(n)) return "Hybride Rechargeable";
  if (RE.electric.test(n)) return "Électrique";
  if (RE.mild.test(n)) return "Mild Hybrid";
  if (RE.hybrid.test(n)) return "Hybride";
  if (RE.diesel.test(n)) return "Diesel";
  if (RE.essence.test(n)) return "Essence";
  return null;
}

export type EnergyGuess = { energy: Energy; confidence: number; explicit: boolean; known: boolean };

/** Énergie d'un véhicule : colonne « énergie » du fichier d'abord, puis
 *  motorisation lue dans le libellé, puis dictionnaire (modèle 100 % électrique).
 *  Sans aucun indice : Diesel avec une confiance faible (à vérifier). */
export function inferEnergy(explicit: string, rest: string[], hint: Energy | null): EnergyGuess {
  const fromCol = explicit ? detectEnergy(explicit) : null;
  if (fromCol) return { energy: fromCol, confidence: 0.95, explicit: true, known: true };
  const fromText = detectEnergy(rest.join(" "));
  if (fromText) return { energy: fromText, confidence: 0.85, explicit: false, known: true };
  if (hint) return { energy: hint, confidence: 0.9, explicit: false, known: true };
  return { energy: "Diesel", confidence: 0.5, explicit: false, known: false };
}
