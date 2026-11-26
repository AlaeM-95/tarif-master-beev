// « Catalogue client » — format A4 portrait (modèle Beev × Sicap, novembre 2026).
// Généré depuis la SÉLECTION en cours (véhicules proposés avec loyer négocié), le
// catalogue (photos, autonomie, coffre, stock, délai, éco-score) et le même moteur
// de calcul que le PDF (calculateTcoFull via analyseSelection). Le « Catalogue TCO »
// 16:9 et la « Proposition flotte » restent disponibles, inchangés.
//
// Pages :
//   1. Couverture (mosaïque des véhicules, borne, chiffres Beev)
//   2. Une page par gamme (catégorie du catalogue : citadines, compactes, SUV…)
//   3. Comparatif : la gamme en un coup d'œil + prestations incluses
//   4. Analyse TCO et fiscalité : coût employeur, AEN, part salarié indicative
//   5. Borne de recharge à domicile + Beev Home
//   6. Fleet Manager
//   7. Effort commercial et prochaines étapes

import { analyseSelection, displayName, displayVersion, type TcoLine } from "./catalogue-tco-deck";
import { AEN_ABATTEMENT_MAX_AN, AEN_TAUX_EMPLOYEUR, AEN_TAUX_SALARIE } from "./tco-calculator";
import { esc, fontFaceCss, fontToDataUrl, type AuditAssets, type RoobertFonts } from "./audit-conseil";
import type { Vehicle } from "./catalog";
import type { SelectedVehicle } from "./pdf";
import type { EnergyParams } from "./store";

// ── Configuration éditable ────────────────────────────────────────────────
export type CatalogueClientConfig = {
  dateLabel: string;
  coverTitle: string;
  coverText: string;
  /** Chiffres Beev de la couverture : « valeur | libellé », une ligne par chiffre. */
  stats: string;
  /** Description par gamme (clé : nom de la gamme, ex. « Citadines »). Vide = texte par défaut. */
  rangeText: Record<string, string>;
  included: string;
  /** Prix de l'électricité sans borne à domicile (€/kWh TTC) : base du TCO. */
  kwhNoBorne: number;
  /** Avec borne : prix domicile et part de recharge à domicile. */
  kwhHome: number;
  homeMixPct: number;
  borne: {
    enabled: boolean;
    chargerId: string;
    name: string;
    image: string;
    monoBase: number;
    triBase: number;
    discount: number;
    serviceName: string;
    servicePriceHt: number;
    installation: string;
    cabling: string;
    protections: string;
    footnote: string;
  };
  fleet: {
    enabled: boolean;
    priceHt: number;
    vehicles: number;
    firstYearFree: boolean;
    condition: string;
  };
  effort: {
    enabled: boolean;
    exampleBornes: number;
    steps: string;
  };
  show: { comparatif: boolean; tco: boolean };
};

export function defaultCatalogueClient(): CatalogueClientConfig {
  const month = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return {
    dateLabel: month.charAt(0).toUpperCase() + month.slice(1),
    coverTitle: "Le copilote de\nvotre flotte\nélectrique",
    coverText: "Véhicules en location longue durée, bornes de recharge à domicile et gestion de flotte avec Fleet Manager : Beev prend en charge tout le parcours.",
    stats: [
      "10 000+ | Entreprises et collaborateurs accompagnés",
      "4,5 / 5 | Sur 1 246 avis Google et Trustpilot",
      "350 | Techniciens IRVE en France",
      "250+ | Modèles électriques en LLD",
    ].join("\n"),
    rangeText: {},
    included: "Entretien et maintenance, assistance 0 km, garantie perte financière.",
    kwhNoBorne: 0.4,
    kwhHome: 0.25,
    homeMixPct: 80,
    borne: {
      enabled: true,
      chargerId: "",
      name: "Ohme ePod S",
      image: "",
      monoBase: 1300,
      triBase: 1700,
      discount: 100,
      serviceName: "Beev Home",
      servicePriceHt: 15,
      installation: ["Forfait installation", "1 percement de mur", "Mise en service et paramétrage"].join("\n"),
      cabling: [
        "5 m de câble H07RN-F | 3G10 mm² en monophasé, 5G10 mm² en triphasé",
        "Tube IRL tulipe gris | Diam. 20 mm, avec fixation",
        "Accessoires de raccordement",
      ].join("\n"),
      protections: [
        "Disjoncteur bipolaire 2P | Courbe C, 6 kA, calibre 40 A",
        "Interrupteur différentiel bipolaire 2P | 40 A, 30 mA, type A",
      ].join("\n"),
      footnote: "Prix d'appel HT, confirmé après étude du logement et selon BPU mis en place",
    },
    fleet: {
      enabled: true,
      priceHt: 6,
      vehicles: 0,
      firstYearFree: true,
      condition: "Offre soumise à condition : sélection de Beev comme acteur sur vos commandes de véhicules.",
    },
    effort: {
      enabled: true,
      exampleBornes: 10,
      steps: [
        "Choix des véhicules | Validation des modèles retenus par catégorie et du nombre de véhicules à commander.",
        "Signature des offres de location | Retour des propositions loueur signées, valables 15 jours.",
        "Étude des logements | Vérification de l'installation électrique des collaborateurs équipés d'une borne.",
        "Ouverture de Fleet Manager | Import de la flotte et des collaborateurs.",
        "Livraisons et installations | Livraison des véhicules et pose des bornes, coordonnées par Beev.",
      ].join("\n"),
    },
    show: { comparatif: true, tco: true },
  };
}

// ── Gammes ────────────────────────────────────────────────────────────────
const RANGES: Array<{ name: string; test: RegExp; text: string; tint: string }> = [
  { name: "Citadines", test: /citad/i, text: "Compactes et agiles, pour les trajets urbains et périurbains.", tint: "rose" },
  { name: "Compactes", test: /compact/i, text: "De l'autonomie pour les collaborateurs qui roulent beaucoup, dans un gabarit facile à vivre.", tint: "blue" },
  { name: "Berlines", test: /berlin/i, text: "Confort et efficacité sur longue distance.", tint: "lav" },
  { name: "Breaks", test: /break/i, text: "Le volume d'un break, l'efficacité de l'électrique.", tint: "lav" },
  { name: "SUV", test: /suv|crossover|4x4/i, text: "Les plus grandes autonomies et les plus grands coffres de la gamme.", tint: "lav" },
  { name: "Monospaces", test: /monospace/i, text: "Place et modularité pour les usages familiaux et professionnels.", tint: "lav" },
  { name: "Utilitaires", test: /utilit/i, text: "Volume de chargement et coût d'usage maîtrisé pour les métiers terrain.", tint: "blue" },
];
const OTHER = { name: "Autres modèles", text: "", tint: "lav" };
const rangeOf = (v: Vehicle) => RANGES.find((r) => r.test.test(v.category ?? "")) ?? OTHER;

export type ClientLine = TcoLine & { range: string };
export type ClientRange = { name: string; text: string; tint: string; lines: ClientLine[]; contract: string };

const kmTotalTxt = (l: TcoLine) => `${fmt(Math.round(l.kmTotal / 1000) * 1000)} km`;
const contractOf = (l: TcoLine) => `${l.months} mois · ${kmTotalTxt(l)}`;

export function analyseCatalogueClient(selection: SelectedVehicle[], e: EnergyParams, cfg: CatalogueClientConfig) {
  // Énergie au prix « sans borne » : toute la recharge au même prix (hypothèse prudente).
  const p = cfg.kwhNoBorne > 0 ? cfg.kwhNoBorne : e.kWhPublic;
  const energy: EnergyParams = { ...e, kWhHome: p, kWhPublic: p, mixHomePct: 0 };
  const { lines, skipped } = analyseSelection(selection.filter((s) => !s.vehicle.isCurrentFleet), energy);
  const ranges: ClientRange[] = [];
  for (const def of [...RANGES, OTHER]) {
    const ls = lines.filter((l) => rangeOf(l.sv.vehicle).name === def.name).sort((a, b) => a.sv.negotiatedMonthly - b.sv.negotiatedMonthly);
    if (!ls.length) continue;
    const contracts = [...new Set(ls.map(contractOf))];
    ranges.push({
      name: def.name,
      text: cfg.rangeText[def.name]?.trim() || def.text,
      tint: def.tint,
      lines: ls.map((l) => ({ ...l, range: def.name })),
      contract: contracts.length === 1 ? contracts[0] : "",
    });
  }
  return { ranges, lines: ranges.flatMap((r) => r.lines), skipped };
}

// ── Mise en forme ─────────────────────────────────────────────────────────
/** « 1 944 », « 337,39 » : espace insécable entre les milliers, y compris à 4 chiffres
 *  (Intl fr-FR ne groupe pas « 1944 » dans tous les navigateurs). */
const fmt = (n: number, d = 0) => {
  const v = Math.round(n * 10 ** d) / 10 ** d;
  const [i, f] = Math.abs(v).toFixed(d).split(".");
  return `${v < 0 ? "−" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")}${f ? `,${f}` : ""}`;
};
const eur = (n: number) => `${fmt(n)} €`;
const eur2 = (n: number) => `${fmt(n, 2)} €`;
const pad2 = (n: number) => String(n).padStart(2, "0");
const lines2 = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const pair = (s: string): [string, string] => { const [a, ...b] = s.split("|"); return [a.trim(), b.join("|").trim()]; };

const abs = (url: string): string => {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
};
const img = (src: string, cls: string, alt = "") =>
  src ? `<img class="${cls}" src="${esc(abs(src))}" alt="${esc(alt)}" onerror="this.style.visibility='hidden'" />` : `<div class="${cls}"></div>`;

const shortName = (l: TcoLine) => displayName(l.sv.vehicle);
const isEco = (v: Vehicle) => v.energy === "Électrique" && !!v.ecoScoreBool;
const seats7 = (v: Vehicle) => /\b7\s*(places|pl\b|p\b)/i.test(`${v.model} ${v.version}`);
const kwhOf = (v: Vehicle) => (v.batteryKwh > 0 ? `${fmt(v.batteryKwh, v.batteryKwh % 1 ? 1 : 0)} kWh` : "");
const trunkOf = (v: Vehicle) => (v.category && /utilit/i.test(v.category) && v.cargoVolumeM3 ? `${fmt(v.cargoVolumeM3, 1)} m³` : v.trunkLitres ? `${fmt(v.trunkLitres)} L` : "—");
const stockPill = (v: Vehicle) => `<span class="pill"><i class="dot ${v.availableStock ? "ok" : "wait"}"></i>${v.availableStock ? "En stock" : "Sur commande"}</span>`;
const delayPill = (v: Vehicle) => {
  const t = (v.leadTime ?? "").trim();
  return `<span class="pill">${t ? `Délai usine ${esc(t.replace(/^délai\s*(usine)?\s*/i, ""))}` : "Délai à confirmer"}</span>`;
};
const ecoPill = (v: Vehicle) => (v.energy !== "Électrique" ? "" : isEco(v) ? `<span class="pill eco">Éco-scoré</span>` : `<span class="pill noeco">Non éco-scoré</span>`);
/** Mensualités affichées : coût d'usage (loyer + énergie) par mois. */
const usageMonth = (l: TcoLine) => (l.r.loyerTotal + l.r.coutEnergie) / l.months;
const employerMonth = (l: TcoLine) => l.tco / l.months;
const chargesMonth = (l: TcoLine) => Math.max(0, l.tco - l.r.loyerTotal - l.r.coutEnergie) / l.months;

type Ctx = { cfg: CatalogueClientConfig; assets?: AuditAssets; client: string; total: number; maxRange: number; maxTrunk: number };

const logo = (ctx: Ctx) => (ctx.assets?.logoDark ? `<img class="logo" src="${ctx.assets.logoDark}" alt="Beev" />` : `<span class="logo wm">Beev</span>`);
const head = (ctx: Ctx, right: string) => `<div class="hd">${logo(ctx)}<span>${esc(right)}</span></div>`;
const foot = (ctx: Ctx, n: number, note: string) => `<div class="ft"><span>${esc(`Beev x ${ctx.client || "Client"}`)} · ${esc(note)}</span><span>${pad2(n)} / ${pad2(ctx.total)}</span></div>`;
const page = (inner: string, cls = "") => `<section class="pg ${cls}">${inner}</section>`;
const catLabel = (ctx: Ctx, s: string) => `Catalogue ${ctx.client || "client"} · ${s}`;

// ── Pages ─────────────────────────────────────────────────────────────────
function coverPage(ctx: Ctx, a: ReturnType<typeof analyseCatalogueClient>): string {
  const c = ctx.cfg;
  // Mosaïque : 10 emplacements autour du bloc central (véhicules uniques, puis borne et logo).
  const seen = new Set<string>();
  const cars = a.lines.filter((l) => l.sv.vehicle.image && !seen.has(l.sv.vehicle.image) && seen.add(l.sv.vehicle.image)).map((l) => l.sv.vehicle);
  const slot = (i: number, cls: string) => {
    const v = cars.length ? cars[i % cars.length] : undefined;
    return `<div class="tile ${cls}">${v ? img(v.image, "tcar", displayName(v)) : ""}</div>`;
  };
  const borneTile = c.borne.enabled && c.borne.image ? `<div class="tile t2 sand">${img(c.borne.image, "tborne", c.borne.name)}</div>` : slot(9, "t2 sand");
  const logoTile = `<div class="tile t3 sand"><div class="ring"><div class="disc">${ctx.assets?.logoLight ? `<img src="${ctx.assets.logoLight}" alt="Beev" />` : "Beev"}</div></div></div>`;
  const models = a.lines.length;
  const stats = lines2(c.stats).map(pair).slice(0, 4);
  return page(`
    <div class="hd cover-hd">${logo(ctx)}<span class="cpill">Catalogue préparé pour ${esc(ctx.client || "vous")} · ${esc(c.dateLabel)}</span></div>
    <div class="mosaic">
      ${slot(0, "t1 blue")}${borneTile}${logoTile}
      ${slot(1, "l1 sand")}${slot(2, "l2 blue")}${slot(3, "l3 sand")}
      <div class="hero">
        <div class="hk">TIME FOR ELECTRIC</div>
        <h1>${lines2(c.coverTitle).map(esc).join("<br/>")}</h1>
        <p>${esc(c.coverText)}</p>
        <div class="hchips"><span class="on">${models} modèle${models > 1 ? "s" : ""} électrique${models > 1 ? "s" : ""}</span>${c.borne.enabled || c.fleet.enabled ? `<span>${[c.borne.enabled ? "Borne" : "", c.fleet.enabled ? "Fleet Manager" : ""].filter(Boolean).join(" et ")}</span>` : ""}</div>
      </div>
      ${slot(4, "r1 blue")}${slot(5, "r2 sand")}${slot(6, "r3 blue")}
      ${slot(7, "b1 sand")}${slot(8, "b2 blue")}${slot(10, "b3 blue")}
    </div>
    ${stats.length ? `<div class="stats">${stats.map(([v, k]) => `<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("")}</div>` : ""}`, "cover");
}

function carCard(ctx: Ctx, l: ClientLine, badge: string, compact: boolean, showContract: boolean): string {
  const v = l.sv.vehicle;
  const ver = displayVersion(v.version ?? "");
  const rangeW = ctx.maxRange > 0 ? Math.min(100, (v.rangeWltp / ctx.maxRange) * 100) : 0;
  const trunkW = ctx.maxTrunk > 0 && v.trunkLitres ? Math.min(100, (v.trunkLitres / ctx.maxTrunk) * 100) : 0;
  const qty = Math.max(1, Math.round(l.sv.quantity || 1));
  return `<div class="car${compact ? " sm" : ""}">
    <div class="cph">${badge ? `<span class="badge">${esc(badge)}</span>` : ""}${img(v.image, "cimg", displayName(v))}</div>
    <div class="cbody">
      <div class="ctop">
        <div class="cname">${compact ? `<b>${esc(shortName(l))}</b><small>${esc(ver)}</small>` : `<b>${esc(shortName(l))} ${esc(ver)}</b>`}
          <div class="pills">${stockPill(v)}${delayPill(v)}${compact ? ecoPill(v) : ""}</div>
          ${compact ? "" : `<div class="pills">${ecoPill(v)}${qty > 1 ? `<span class="pill">${qty} véhicules</span>` : ""}</div>`}
        </div>
        <div class="cprice"><b>${eur2(l.sv.negotiatedMonthly)}</b><span>TTC / mois</span><em>TCO ${eur(usageMonth(l))} / mois</em>${showContract ? `<small>${esc(contractOf(l))}</small>` : ""}</div>
      </div>
      <div class="cbars">
        <div><div class="cl"><span>Autonomie</span><b>${v.rangeWltp ? `${fmt(v.rangeWltp)} km` : "—"}</b></div><div class="track"><i style="width:${rangeW}%"></i></div></div>
        <div><div class="cl"><span>${/utilit/i.test(v.category ?? "") ? "Volume utile" : "Volume de coffre"}</span><b>${trunkOf(v)}</b></div><div class="track"><i style="width:${trunkW}%"></i></div></div>
      </div>
    </div>
  </div>`;
}

function rangePages(ctx: Ctx, r: ClientRange, idx: number, start: number): string[] {
  const PER = 5;
  const out: string[] = [];
  const many = r.lines.length >= 3;
  const best = (f: (v: Vehicle) => number) => {
    const xs = r.lines.filter((l) => f(l.sv.vehicle) > 0);
    if (r.lines.length < 4 || xs.length < 3) return "";
    return xs.reduce((a, b) => (f(b.sv.vehicle) > f(a.sv.vehicle) ? b : a)).key;
  };
  const bigTrunk = best((v) => v.trunkLitres ?? 0);
  const bigRange = best((v) => v.rangeWltp);
  const badgeOf = (l: ClientLine) => (seats7(l.sv.vehicle) ? "7 places" : l.key === bigTrunk ? "Plus grand coffre" : l.key === bigRange ? "Plus grande autonomie" : "");
  for (let i = 0; i < r.lines.length; i += PER) {
    const chunk = r.lines.slice(i, i + PER);
    const compact = chunk.length > 3;
    const cont = i > 0 ? " (suite)" : "";
    out.push(page(`
      ${head(ctx, catLabel(ctx, "Véhicules"))}
      <div class="kick">Gamme ${pad2(idx + 1)}</div>
      <div class="ttl"><h2>${esc(r.name)}${cont}</h2>${r.contract ? `<span class="cpill2 ${r.tint}">${esc(r.contract)}</span>` : ""}</div>
      <p class="lede">${esc(r.text)}${many && r.lines.length > 3 ? " Classés par loyer mensuel." : ""}</p>
      <div class="cars${compact ? " sm" : ""}">${chunk.map((l) => carCard(ctx, l, badgeOf(l), compact, !r.contract)).join("")}</div>
      ${!compact && ctx.cfg.included.trim() ? `<div class="incl ${r.tint}"><b>Inclus dans chaque loyer :</b> ${esc(ctx.cfg.included)}</div>` : ""}
      ${foot(ctx, start + out.length, `Loyers mensuels TTC${ctx.cfg.show.tco ? " · TCO détaillé dans l'analyse TCO" : ""} · Images non contractuelles`)}`));
  }
  return out;
}

function comparatifPages(ctx: Ctx, a: ReturnType<typeof analyseCatalogueClient>, start: number): string[] {
  // ~14 lignes véhicules par page avec les en-têtes de gamme.
  const rows: string[][] = [[]];
  let budget = 0;
  const MAX = 15;
  for (const r of a.ranges) {
    if (budget + 2 > MAX) { rows.push([]); budget = 0; }
    rows[rows.length - 1].push(`<tr class="grp"><td colspan="5"><i class="dot ${r.tint}"></i><b>${esc(r.name)}</b>${r.contract ? ` <span>${esc(r.contract.replace(" · ", " / "))}</span>` : ""}</td></tr>`);
    budget += 0.6;
    for (const l of r.lines) {
      if (budget + 1 > MAX) { rows.push([]); budget = 0; }
      const v = l.sv.vehicle;
      const w = ctx.maxRange > 0 ? Math.min(100, (v.rangeWltp / ctx.maxRange) * 100) : 0;
      const sub = [kwhOf(v) || displayVersion(v.version ?? "").slice(0, 24)].filter(Boolean).join("");
      rows[rows.length - 1].push(`<tr>
        <td class="m">${img(v.image, "thumb", displayName(v))}<div><b>${esc(shortName(l))} ${esc(displayVersion(v.version ?? "").split(" ").slice(0, 2).join(" "))}</b><small>${esc(sub)} ${ecoPill(v)}</small>${r.contract ? "" : `<small>${esc(contractOf(l))}</small>`}</div></td>
        <td class="r"><b>${eur2(l.sv.negotiatedMonthly)}</b></td>
        <td><span class="rk">${v.rangeWltp ? `${fmt(v.rangeWltp)} km` : "—"}</span><div class="track sm"><i style="width:${w}%"></i></div></td>
        <td class="r">${trunkOf(v)}</td>
        <td>${stockPill(v)}</td>
      </tr>`);
      budget += 1;
    }
  }
  const services = [
    ["Maintenance tous réseaux", "Entretien du véhicule dans le réseau de votre choix", "wrench", "rose"],
    ["Assistance 24h/24, 7j/7", "Dépannage et remorquage en cas de panne, d'accident ou de vol en France", "phone", "blue"],
    ["Garantie perte financière", "Couverture de l'écart avec l'indemnisation de l'assureur", "shield", "lav"],
  ];
  return rows.map((rs, i) => page(`
    ${head(ctx, catLabel(ctx, "Synthèse"))}
    <div class="kick">Comparatif</div>
    <h2 class="h2">La gamme en un coup d'œil${i > 0 ? " (suite)" : ""}</h2>
    <p class="lede">${a.lines.length} modèle${a.lines.length > 1 ? "s" : ""} par catégorie : ${a.ranges.map((r) => r.name.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " et $1")}.</p>
    <table class="cmp"><thead><tr><th>Modèle</th><th class="r">Loyer TTC / mois</th><th>Autonomie</th><th class="r">Coffre</th><th>Disponibilité</th></tr></thead><tbody>${rs.join("")}</tbody></table>
    ${i === rows.length - 1 ? `<div class="svc"><div class="svch"><b>Vous roulez, on s'occupe du reste</b><span>Inclus dans tous les loyers</span></div><div class="svcg">${services.map(([t, d, ic, tint]) => `<div><i class="ico ${tint}">${ICONS[ic]}</i><div><b>${t}</b><p>${d}</p></div></div>`).join("")}</div></div>` : ""}
    ${foot(ctx, start + i, "Loyers mensuels TTC")}`));
}

function tcoPages(ctx: Ctx, a: ReturnType<typeof analyseCatalogueClient>, start: number, e: EnergyParams): string[] {
  const c = ctx.cfg;
  const p = c.kwhNoBorne > 0 ? c.kwhNoBorne : e.kWhPublic;
  const bests = a.ranges.map((r) => ({ r, l: r.lines.reduce((x, y) => (employerMonth(y) < employerMonth(x) ? y : x)) })).slice(0, 3);
  const maxEmp = Math.max(1, ...a.lines.map(employerMonth));
  const bar = (l: TcoLine) => {
    const w = (v: number) => `${Math.max(0, (v / maxEmp) * 100)}%`;
    return `<div class="sbar"><i class="s1" style="width:${w(l.r.loyerTotal / l.months)}"></i><i class="s2" style="width:${w(l.r.coutEnergie / l.months)}"></i><i class="s3" style="width:${w(chargesMonth(l))}"></i></div>`;
  };
  const per100 = (l: TcoLine) => (l.kmTotal > 0 ? ((l.r.loyerTotal + l.r.coutEnergie) / l.kmTotal) * 100 : 0);
  // Pagination : 19 lignes sous les cartes « meilleur coût » de la 1re page, 25 ensuite ;
  // les encadrés AEN et borne (≈ 6 lignes) vont sur la dernière page.
  const rowsAll: string[][] = [[]];
  const used: number[] = [0];
  let budget = 0;
  const cap = () => (rowsAll.length === 1 ? 19 : 25);
  const brk = () => { rowsAll.push([]); used.push(0); budget = 0; };
  for (const r of a.ranges) {
    if (budget + 2 > cap()) brk();
    used[used.length - 1] = budget + 0.6;
    rowsAll[rowsAll.length - 1].push(`<tr class="grp"><td colspan="6"><i class="dot ${r.tint}"></i><b>${esc(r.name)}</b> <span>${esc(r.contract ? `${r.contract.replace(" · ", " / ")} · ` : "")}montants TTC par mois</span></td></tr>`);
    budget += 0.6;
    const sorted = [...r.lines].sort((x, y) => employerMonth(x) - employerMonth(y));
    for (const l of sorted) {
      if (budget + 1 > cap()) brk();
      const v = l.sv.vehicle;
      const isBest = bests.some((b) => b.l.key === l.key);
      const andTag = l.r.coutFiscalANDTotal > 0 ? " · avec AND" : "";
      rowsAll[rowsAll.length - 1].push(`<tr class="${isBest ? "best" : ""}">
        <td class="m"><b>${esc(shortName(l))}</b> ${v.energy === "Électrique" ? (isEco(v) ? `<span class="pill eco">Éco</span>` : `<span class="pill noeco">Non éco</span>`) : ""}<small>${v.consumption ? `${fmt(v.consumption, 1)} kWh · ` : ""}${fmt(per100(l), 2)} € / 100 km${r.contract ? "" : ` · ${esc(contractOf(l))}`}</small></td>
        <td>${bar(l)}</td>
        <td class="r"><b>${eur(usageMonth(l))}</b><small>${eur(l.r.loyerTotal + l.r.coutEnergie)} sur ${l.months} mois</small></td>
        <td class="r">${eur(l.r.aenMensuel)}</td>
        <td class="r"><span class="sal${l.r.aenMensuel > 200 ? " hi" : ""}">${eur(l.r.partSalarialeMensuelle)}</span></td>
        <td class="r"><b class="big">${eur(employerMonth(l))}</b><small>dont charges ${eur(chargesMonth(l))}${andTag}</small></td>
      </tr>`);
      budget += 1;
      used[used.length - 1] = budget;
    }
  }
  if (used[used.length - 1] > cap() - 6) brk();
  // Exemple « avec borne » : premier véhicule de la 2e gamme (ou de la première).
  const exL = (a.ranges[1] ?? a.ranges[0])?.lines[0];
  const avg = (c.homeMixPct / 100) * c.kwhHome + (1 - c.homeMixPct / 100) * p;
  const exE = exL ? exL.r.coutEnergie / exL.months : 0;
  const exB = p > 0 ? (exE * avg) / p : exE;
  return rowsAll.map((rs, i) => page(`
    ${head(ctx, catLabel(ctx, "Analyse TCO"))}
    <div class="kick">Analyse TCO et fiscalité</div>
    <h2 class="h2">Coût total de possession${i > 0 ? " (suite)" : ""}</h2>
    <p class="lede">Loyer, énergie et avantage en nature : le coût réel pour l'entreprise et pour le collaborateur.</p>
    ${i === 0 ? `<div class="bests n${bests.length}">${bests.map(({ r, l }) => `<div class="bcard ${r.tint}"><div class="bh"><span>${esc(r.name)}</span><em>Meilleur coût</em></div><b>${esc(shortName(l))}</b><div class="bv">${eur(employerMonth(l))}<small>coût employeur / mois</small></div><p>Part salarié indicative : ${eur(l.r.partSalarialeMensuelle)} / mois</p></div>`).join("")}</div>` : ""}
    ${rs.length ? `<table class="tco${i === 0 ? "" : " top"}"><thead><tr><th>Modèle</th><th>Répartition</th><th class="r">TCO</th><th class="r">AEN</th><th class="r">Part salarié*</th><th class="r">Coût employeur</th></tr></thead><tbody>${rs.join("")}</tbody></table>
    <div class="legend"><span><i class="s1"></i>Loyer</span><span><i class="s2"></i>Énergie</span><span><i class="s3"></i>Charges employeur sur AEN</span><em>* Part salarié indicative, hors coût employeur · ${fmt(p, 2)} €/kWh</em></div>` : ""}
    ${i === rowsAll.length - 1 ? `<div class="tbot">
      <div class="aen"><div class="ah"><b>Avantage en nature ${new Date().getFullYear()}</b><span>Barème URSSAF</span></div>
        <div class="ag"><div class="eco"><span>Éco-scoré</span><b>15 %<small> du loyer</small></b><p>50 % moins 70 % d'abattement, plafond ${fmt(AEN_ABATTEMENT_MAX_AN, 2)} € / an</p></div>
        <div class="noeco"><span>Non éco-scoré</span><b>50 %<small> du loyer</small></b><p>Barème plein, sans abattement</p></div></div>
        <div class="tags"><span>* Part salarié : ${Math.round(AEN_TAUX_SALARIE * 100)} % de l'AEN, à titre indicatif, hors coût employeur</span><span>Charges employeur : ${Math.round(AEN_TAUX_EMPLOYEUR * 100)} %</span><span>Électricité employeur exclue</span><span>AND : 25 % de la réintégration fiscale</span></div></div>
      ${c.borne.enabled ? `<div class="hb"><div class="hbh"><i class="ico blue">${ICONS.bolt}</i><b>Avec une borne à domicile</b></div><p>Recharge ${c.homeMixPct} % domicile, ${100 - c.homeMixPct} % itinérance</p>
        <div class="hbp"><span>Prix moyen</span><div><s>${fmt(p, 2)} €/kWh</s> → <b>${fmt(avg, 2)} €/kWh</b></div></div>
        ${exL ? `<div class="hbx"><div><span>${esc(shortName(exL))} : énergie</span><p>${eur(exE)} → ${eur(exB)} TTC / mois</p></div><b>${exB < exE ? "−" : "+"}${eur(Math.abs(exE - exB))}</b></div>` : ""}</div>` : ""}
    </div>` : ""}
    ${foot(ctx, start + i, `Montants TTC · Simulation, calculateur TCO Beev, règles fiscales ${new Date().getFullYear()}`)}`));
}

function bornePage(ctx: Ctx, n: number): string {
  const b = ctx.cfg.borne;
  const price = (label: string, kw: string, base: number) => `<div class="bp${label === "Monophasé" ? " on" : ""}">
    <div class="bph"><b>${label}</b><span class="kw">${kw}</span></div>
    <div class="bpo">À partir de ${b.discount > 0 ? `<s>${fmt(base)} € HT</s> <span class="dsc">−${fmt(b.discount)} € HT</span>` : ""}</div>
    <div class="bpv">${fmt(base - b.discount)} € HT</div>${img(b.image, "bpi", b.name)}</div>`;
  const list = (s: string) => lines2(s).map(pair).map(([t, d]) => `<div class="li"><b>${esc(t)}</b>${d ? `<span>${esc(d)}</span>` : ""}</div>`).join("");
  const rows = [["Collaborateur A", "En charge", 70], ["Collaborateur B", "Disponible", 0], ["Collaborateur C", "En charge", 35]] as const;
  return page(`
    ${head(ctx, catLabel(ctx, "Recharge"))}
    <div class="bhero"><div><div class="bk">Borne de recharge à domicile <span>${esc(b.name)}</span></div><h2>Rechargez chez vous,<br/>en sérénité</h2><p>Installée par Beev au domicile de vos collaborateurs.</p></div>${img(b.image, "bhimg", b.name)}</div>
    <div class="bprices">${price("Monophasé", "7,4 kW", b.monoBase)}${price("Triphasé", "11 kW", b.triBase)}</div>
    <div class="home"><div class="hh"><div><b>${esc(b.serviceName)}</b><p>Le service qui accompagne chaque borne, une fois installée</p></div><div class="hp"><b>${fmt(b.servicePriceHt)} € HT</b><span>par point de charge</span></div></div>
      <div class="hg">
        <div class="sup"><div class="suph"><i class="ico dk">${ICONS.eye}</i><div><b>Supervision à distance</b><p>Vous savez qui s'est rechargé, et avec quel véhicule</p></div></div>
          ${rows.map(([who, st, w]) => `<div class="sr"><i>${ICONS.bolt}</i><span>${who}</span><div class="track sm"><i style="width:${w}%"></i></div><em class="${st === "Disponible" ? "ok" : ""}">${st}</em></div>`).join("")}
          <div class="ticks"><span>Chaque session identifiée : collaborateur et véhicule</span><span>Consommations suivies borne par borne</span><span>Anomalie détectée, SAV déclenché</span><span>Remboursement automatisé, géré par Beev</span></div></div>
        <div class="hside"><div class="hs"><i class="ico blue">€</i><div><b>Remboursement de la recharge</b><p>Automatisé et entièrement géré par Beev : le collaborateur est remboursé de l'électricité rechargée pour son véhicule de fonction.</p></div></div>
          <div class="hs"><i class="ico blue">${ICONS.wrench}</i><div><b>Maintenance et SAV</b><p>Assistance et intervention en cas de panne de la borne.</p></div></div></div>
      </div></div>
    <div class="binc"><div class="bih"><b>Inclus dans le prix de la borne</b><span>Installation clé en main</span></div>
      <div class="big3"><div><div class="bt"><i class="ico blue">${ICONS.wrench}</i>Installation</div>${list(b.installation)}</div><div><div class="bt"><i class="ico blue">${ICONS.plug}</i>Câblage et raccordement</div>${list(b.cabling)}</div><div><div class="bt"><i class="ico blue">${ICONS.shield}</i>Protections électriques</div>${list(b.protections)}</div></div></div>
    ${foot(ctx, n, `${b.footnote} · Image non contractuelle`)}`);
}

const fleetCount = (ctx: Ctx, a: ReturnType<typeof analyseCatalogueClient>) =>
  ctx.cfg.fleet.vehicles > 0 ? ctx.cfg.fleet.vehicles : a.lines.reduce((s, l) => s + Math.max(1, Math.round(l.sv.quantity || 1)), 0);

function fleetPage(ctx: Ctx, n: number, a: ReturnType<typeof analyseCatalogueClient>): string {
  const f = ctx.cfg.fleet;
  const nb = fleetCount(ctx, a);
  const month = f.priceHt * nb;
  const menu = ["Véhicules", "Collaborateurs", "Recharges", "Contrats et documents", "Amendes"];
  return page(`
    ${head(ctx, "Logiciel de gestion de flotte")}
    <div class="fmh"><div class="fk">Fleet Manager</div><h2>Pilotez votre flotte<br/>depuis un seul outil</h2><p>Véhicules, collaborateurs, recharges et documents réunis dans une même plateforme.</p>
      <div class="screen"><div class="dots"><i></i><i></i><i></i></div><div class="sg"><div class="side">${menu.map((m, i) => `<span class="${i === 0 ? "on" : ""}">${m}</span>`).join("")}</div>
        <div class="main"><b>Ma flotte</b><div class="kpis"><div><span>Véhicules</span><i></i></div><div><span>Recharges du mois</span><i></i></div><div><span>Échéances</span><i></i></div></div>
          ${["En service", "En service", "À livrer"].map((s, i) => `<div class="row"><i class="sq t${i}"></i><i class="ln"></i><em class="${i === 2 ? "rose" : ""}">${s}</em></div>`).join("")}</div></div></div></div>
    <div class="fsub"><div><div class="fsh"><b>Abonnement</b><span class="tag">Amendes incluses</span></div><div class="fsv">${fmt(f.priceHt)} € HT<small>/ véhicule / mois</small></div><p>Gestion des amendes comprise, sans supplément.</p></div>
      <div class="fcalc"><span>Pour ${nb} véhicule${nb > 1 ? "s" : ""}</span><div><span>Par mois</span><b>${fmt(month)} € HT</b></div><div><span>Par an</span><b>${fmt(month * 12)} € HT</b></div></div></div>
    ${f.firstYearFree ? `<div class="foffer"><div class="foh"><span class="tag light">Offre ${esc(ctx.client || "client")}</span><span>Pour ${nb} véhicule${nb > 1 ? "s" : ""} : ${fmt(month * 12)} € HT offerts</span></div><h3>1re année offerte sur 100 % de votre flotte</h3><p>Tous vos véhicules sont inclus, y compris ceux qui n'ont pas été commandés avec Beev.</p>${f.condition ? `<div class="fcond"><i>i</i>${esc(f.condition)}</div>` : ""}</div>` : ""}
    ${foot(ctx, n, "Tarifs HT · Écran Fleet Manager illustratif")}`);
}

function effortPage(ctx: Ctx, n: number, a: ReturnType<typeof analyseCatalogueClient>): string {
  const c = ctx.cfg;
  const nb = fleetCount(ctx, a);
  const fm = c.fleet.enabled && c.fleet.firstYearFree ? c.fleet.priceHt * nb * 12 : 0;
  const k = Math.max(0, Math.round(c.effort.exampleBornes));
  const bd = c.borne.enabled ? c.borne.discount * k : 0;
  const total = fm + bd;
  const steps = lines2(c.effort.steps).map(pair);
  const boxes = [
    fm > 0 ? `<div class="eb"><div class="ebh"><b>Fleet Manager offert</b><span class="tag">1re année</span></div><div class="ebv">${fmt(fm)} € HT</div><p>${nb} véhicule${nb > 1 ? "s" : ""} × ${fmt(c.fleet.priceHt)} € HT × 12 mois, gestion des amendes incluse. 100 % de la flotte, y compris les véhicules non commandés avec Beev.</p></div>` : "",
    bd > 0 ? `<div class="eb"><div class="ebh"><b>Remise sur les bornes</b><span class="tag blue">−${fmt(c.borne.discount)} € HT / borne</span></div><div class="ebv blue">${fmt(bd)} € HT</div><p>Exemple de ${k} installations à domicile ${esc(c.borne.name)} au forfait, hors BPU. Détail ci-dessous.</p></div>` : "",
  ].filter(Boolean);
  const ex = (label: string, base: number) => `<tr><td><b>${label}</b><small>${k} × ${fmt(base - c.borne.discount)} € HT au lieu de ${fmt(base)} €</small></td><td class="r"><s>${fmt(base * k)} €</s></td><td class="r"><b>${fmt((base - c.borne.discount) * k)} €</b></td><td class="r g">−${fmt(c.borne.discount * k)} €</td></tr>`;
  return page(`
    ${head(ctx, catLabel(ctx, "Proposition"))}
    <div class="kick">Effort commercial et prochaines étapes</div>
    <h2 class="h2">Notre engagement pour ${esc(ctx.client || "vous")}</h2>
    ${total > 0 ? `<div class="effort"><div class="eh"><div><span>Effort commercial Beev</span><p>Pour ${nb} véhicule${nb > 1 ? "s" : ""} en parc${bd > 0 ? ` et un exemple de ${k} bornes installées à domicile` : ""}</p></div><div class="et"><b>${fmt(total)} € HT</b><span>d'économies la première année</span></div></div><div class="eg n${boxes.length}">${boxes.join("")}</div></div>` : ""}
    ${bd > 0 ? `<div class="exb"><div class="exh"><b>Exemple : ${k} bornes installées à domicile</b><span>Montants HT · hors BPU</span></div>
      <table class="ext"><thead><tr><th>Si les ${k} bornes sont en</th><th class="r">Prix de base</th><th class="r">Prix ${esc(ctx.client || "client")}</th><th class="r">Économie</th></tr></thead><tbody>${ex("Monophasé 7,4 kW", c.borne.monoBase)}${ex("Triphasé 11 kW", c.borne.triBase)}</tbody></table>
      <div class="note"><i>i</i>Exemple calculé sur le forfait d'installation, hors BPU. Les travaux qui dépassent ce forfait (distance supérieure à 5 m, matériel complémentaire) sont facturés en plus, selon le BPU mis en place.</div></div>` : ""}
    ${steps.length ? `<div class="steps"><div class="sth"><b>Prochaines étapes</b><span>Beev coordonne chaque étape</span></div>${steps.map(([t, d], i) => `<div class="st"><i>${i + 1}</i><div><b>${esc(t)}</b>${d ? `<p>${esc(d)}</p>` : ""}</div></div>`).join("")}</div>` : ""}
    ${foot(ctx, n, `Montants HT${fm > 0 && c.fleet.condition ? " · Fleet Manager offert sous condition de sélection de Beev sur les commandes de véhicules" : ""}`)}`);
}

// Icônes au trait (SVG inline, 24×24).
const sv = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS: Record<string, string> = {
  wrench: sv('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
  phone: sv('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  shield: sv('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  bolt: sv('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  eye: sv('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  plug: sv('<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>'),
};

// ── Assemblage ────────────────────────────────────────────────────────────
export type CatalogueClientInput = { cfg: CatalogueClientConfig; selection: SelectedVehicle[]; energy: EnergyParams; clientName: string };

export function buildCatalogueClientHtml(input: CatalogueClientInput, fonts?: RoobertFonts, assets?: AuditAssets): string {
  const { cfg, energy: e } = input;
  const a = analyseCatalogueClient(input.selection, e, cfg);
  const ctx: Ctx = {
    cfg, assets, client: input.clientName.trim(), total: 0,
    maxRange: Math.max(1, ...a.lines.map((l) => l.sv.vehicle.rangeWltp || 0)) * 1.08,
    maxTrunk: Math.max(1, ...a.lines.map((l) => l.sv.vehicle.trunkLitres || 0)) * 1.08,
  };
  const builders: Array<(n: number) => string> = [() => coverPage(ctx, a)];
  a.ranges.forEach((r, i) => {
    const count = rangePages(ctx, r, i, 0).length;
    for (let k = 0; k < count; k++) builders.push((n) => rangePages(ctx, r, i, n - k)[k]);
  });
  if (cfg.show.comparatif) {
    const count = comparatifPages(ctx, a, 0).length;
    for (let k = 0; k < count; k++) builders.push((n) => comparatifPages(ctx, a, n - k)[k]);
  }
  if (cfg.show.tco) {
    const count = tcoPages(ctx, a, 0, e).length;
    for (let k = 0; k < count; k++) builders.push((n) => tcoPages(ctx, a, n - k, e)[k]);
  }
  if (cfg.borne.enabled) builders.push((n) => bornePage(ctx, n));
  if (cfg.fleet.enabled) builders.push((n) => fleetPage(ctx, n, a));
  if (cfg.effort.enabled) builders.push((n) => effortPage(ctx, n, a));
  ctx.total = builders.length;
  const pages = builders.map((b, i) => `<div class="sheet">${b(i + 1)}</div>`).join("\n");

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" />
<title>Catalogue ${esc(ctx.client)} × Beev</title>
<style>
${fontFaceCss(fonts)}
:root{--ink:#1E1E1E;--bg:#F9F7F2;--card:#fff;--line:#E7E2D8;--muted:#6E6B66;--rose:#EBB8AA;--rose2:#F6E4DF;--blue:#A8CDFB;--blue2:#DDEBFD;--lav:#D3CCD8;--lav2:#ECE8EE;--sand:#EFECE4;--green:#DDF1DF;--greenT:#2E7D3A;--red:#FBE3DC;--redT:#C0503A;--font:'Roobert','Inter',-apple-system,BlinkMacSystemFont,sans-serif;--s:1;}
*{box-sizing:border-box;} html,body{margin:0;padding:0;}
section.pg{position:relative;width:794px;height:1123px;padding:42px 46px 0;overflow:hidden;font-family:var(--font);background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;font-size:11px;}
b{font-weight:600;}
.hd{display:flex;justify-content:space-between;align-items:center;font-size:11px;} .logo{height:22px;width:auto;} .wm{font-size:22px;font-weight:700;}
.ft{position:absolute;left:46px;right:46px;bottom:28px;padding-top:10px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:9px;color:#444;}
.kick{margin-top:18px;font-size:10px;} h2{margin:4px 0 0;font-size:38px;line-height:1.05;font-weight:600;letter-spacing:-.02em;} .h2{font-size:30px;}
.ttl{display:flex;justify-content:space-between;align-items:center;margin-top:4px;} .ttl h2{margin:0;}
.lede{margin:8px 0 0;font-size:13px;line-height:1.4;color:#333;}
.cpill{background:var(--ink);color:#fff;border-radius:99px;padding:6px 14px;font-size:10.5px;font-weight:500;}
.cpill2{border-radius:10px;padding:8px 14px;font-size:12px;} .cpill2.rose{background:var(--rose);} .cpill2.blue{background:var(--blue);} .cpill2.lav{background:var(--lav);}
.pill{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);background:#fff;border-radius:99px;padding:3px 9px;font-size:9.5px;white-space:nowrap;}
.pill.eco{background:var(--green);border-color:var(--green);color:var(--greenT);} .pill.noeco{background:var(--red);border-color:var(--red);color:var(--redT);}
.dot{display:inline-block;width:6px;height:6px;border-radius:50%;} .dot.ok{background:#3FB45A;} .dot.wait{background:#E88A3A;} .dot.rose{background:var(--rose);} .dot.blue{background:var(--blue);} .dot.lav{background:#B9B0C0;}
.track{height:5px;border-radius:4px;background:var(--rose2);overflow:hidden;margin-top:5px;} .track i{display:block;height:100%;background:var(--ink);border-radius:4px;} .track.sm{height:4px;}
.tag{display:inline-block;background:var(--lav);border-radius:99px;padding:3px 9px;font-size:9px;font-weight:600;} .tag.blue{background:var(--blue);} .tag.light{background:var(--lav);color:var(--ink);}
.ico{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;flex:none;font-style:normal;font-weight:700;font-size:12px;} .ico svg{width:15px;height:15px;}
.ico.rose{background:var(--rose2);} .ico.blue{background:var(--blue2);} .ico.lav{background:var(--lav2);} .ico.dk{background:var(--ink);color:#fff;}
/* couverture */
.cover-hd{margin-bottom:16px;}
.mosaic{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:180px 132px 132px 132px 120px;gap:10px;height:732px;}
.tile{border-radius:14px;overflow:hidden;display:flex;align-items:center;justify-content:center;} .tile.blue{background:var(--blue);} .tile.sand{background:var(--sand);}
.tcar{width:92%;height:86%;object-fit:contain;mix-blend-mode:multiply;} .tborne{height:86%;width:auto;object-fit:contain;mix-blend-mode:multiply;}
.t1{grid-column:1/3;} .t2{grid-column:3;} .t3{grid-column:4;}
.l1{grid-column:1;grid-row:2;} .l2{grid-column:1;grid-row:3;} .l3{grid-column:1;grid-row:4;}
.r1{grid-column:4;grid-row:2;} .r2{grid-column:4;grid-row:3;} .r3{grid-column:4;grid-row:4;}
.b1{grid-column:1;grid-row:5;} .b2{grid-column:2;grid-row:5;} .b3{grid-column:3/5;grid-row:5;}
.ring{width:118px;height:118px;border-radius:50%;background:var(--blue2);display:flex;align-items:center;justify-content:center;} .disc{width:80px;height:80px;border-radius:50%;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;} .disc img{width:56px;}
.hero{grid-column:2/4;grid-row:2/5;background:var(--ink);color:#fff;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:22px;}
.hk{font-size:10px;letter-spacing:.12em;} .hero h1{margin:12px 0 0;font-size:36px;line-height:1.08;font-weight:600;letter-spacing:-.02em;} .hero p{margin:12px 0 0;font-size:11.5px;line-height:1.5;color:#E7E4DE;}
.hchips{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;justify-content:center;} .hchips span{border:1px solid #fff;border-radius:99px;padding:6px 12px;font-size:10.5px;} .hchips .on{background:#fff;color:var(--ink);}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px;} .stats div{border-top:1.5px solid var(--ink);padding-top:8px;} .stats b{display:block;font-size:20px;letter-spacing:-.02em;} .stats span{font-size:9.5px;color:var(--muted);}
/* gammes */
.cars{display:flex;flex-direction:column;gap:12px;margin-top:20px;} .cars.sm{gap:10px;margin-top:16px;}
.car{display:grid;grid-template-columns:250px 1fr;gap:18px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px;}
.car.sm{grid-template-columns:150px 1fr;gap:14px;padding:10px 12px;border-radius:14px;}
.cph{position:relative;background:var(--rose2);border-radius:12px;display:flex;align-items:center;justify-content:center;height:180px;} .car.sm .cph{height:86px;background:#F4F2EE;border-radius:10px;}
.cimg{width:92%;height:88%;object-fit:contain;mix-blend-mode:multiply;} .badge{position:absolute;top:6px;left:6px;background:var(--ink);color:#fff;border-radius:99px;padding:2px 8px;font-size:8px;font-weight:600;}
.cbody{display:flex;flex-direction:column;justify-content:space-between;}
.ctop{display:flex;justify-content:space-between;gap:10px;} .cname b{display:block;font-size:16px;line-height:1.25;} .car.sm .cname b{font-size:13px;} .cname small{display:block;font-size:9.5px;color:var(--muted);}
.pills{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px;} .car.sm .pills{margin-top:4px;} .car.sm .pill{font-size:8.5px;padding:2px 7px;}
.cprice{text-align:right;white-space:nowrap;} .cprice b{display:block;font-size:26px;letter-spacing:-.02em;} .car.sm .cprice b{font-size:20px;}
.cprice span{display:block;font-size:9.5px;color:var(--muted);} .cprice em{display:inline-block;margin-top:5px;background:var(--ink);color:#fff;border-radius:99px;padding:3px 9px;font-size:9px;font-style:normal;} .cprice small{display:block;font-size:9px;color:var(--muted);margin-top:4px;}
.cbars{display:grid;grid-template-columns:1fr 1fr;gap:16px;border-top:1px solid var(--line);padding-top:10px;margin-top:10px;} .car.sm .cbars{padding-top:6px;margin-top:6px;}
.cl{display:flex;justify-content:space-between;font-size:10px;color:#444;} .cl b{font-size:12.5px;color:var(--ink);}
.incl{margin-top:16px;border-radius:12px;padding:12px 16px;font-size:10.5px;} .incl.rose{background:var(--rose2);} .incl.blue{background:var(--blue2);} .incl.lav{background:var(--lav2);}
/* comparatif */
.cmp,.tco{width:100%;border-collapse:separate;border-spacing:0;margin-top:16px;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:10px;}
.cmp thead th,.tco thead th{background:var(--ink);color:#fff;text-align:left;font-weight:500;padding:9px 10px;font-size:9.5px;} .r{text-align:right !important;}
.cmp td,.tco td{padding:6px 10px;border-top:1px solid var(--line);vertical-align:middle;} .tco td{padding:4px 9px;}
tr.grp td{background:#F4F2EE;font-size:10px;padding:6px 10px;} tr.grp span{color:var(--muted);} tr.grp .dot{margin-right:6px;}
.cmp .m{display:flex;align-items:center;gap:9px;} .thumb{width:44px;height:28px;object-fit:contain;background:#F4F2EE;border-radius:5px;flex:none;mix-blend-mode:multiply;}
.cmp .m b{display:block;font-size:10.5px;} .cmp .m small{display:block;font-size:8.5px;color:var(--muted);} .cmp .m .pill{font-size:7.5px;padding:1px 5px;}
.cmp td.r b{font-size:12px;} .rk{font-size:9.5px;} .cmp .track{width:90px;}
.svc{margin-top:16px;background:var(--ink);color:#fff;border-radius:16px;padding:14px 16px;} .svch{display:flex;justify-content:space-between;align-items:center;} .svch b{font-size:14px;} .svch span{font-size:10px;color:#DDD;}
.svcg{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px;} .svcg>div{background:#2C2C2C;border-radius:10px;padding:10px;display:flex;gap:9px;} .svcg .ico{color:var(--ink);}
.svcg b{font-size:10.5px;} .svcg p{margin:3px 0 0;font-size:9px;color:#CFCBC4;line-height:1.35;}
/* TCO */
.bests{display:grid;gap:10px;margin-top:14px;} .bests.n1{grid-template-columns:1fr;} .bests.n2{grid-template-columns:1fr 1fr;} .bests.n3{grid-template-columns:repeat(3,1fr);}
.bcard{border-radius:14px;padding:11px 13px;} .bcard.rose{background:var(--rose);} .bcard.blue{background:var(--blue);} .bcard.lav{background:var(--lav);}
.bh{display:flex;justify-content:space-between;align-items:center;font-size:10px;} .bh em{background:#fff;border-radius:99px;padding:2px 8px;font-style:normal;font-weight:600;font-size:9px;}
.bcard>b{display:block;font-size:13px;margin-top:3px;} .bv{font-size:22px;font-weight:600;letter-spacing:-.02em;} .bv small{font-size:9px;font-weight:400;margin-left:5px;} .bcard p{margin:2px 0 0;font-size:9px;}
.tco{margin-top:12px;} .tco.top{margin-top:16px;} .tco .m b{font-size:10.5px;} .tco .m small{display:block;font-size:8.5px;color:var(--muted);} .tco .m .pill{font-size:7.5px;padding:1px 5px;}
.tco td.r b{font-size:11px;} .tco td small{display:block;font-size:7.5px;color:var(--muted);} .tco b.big{font-size:12.5px;} .tco td em{display:block;font-size:7.5px;color:var(--muted);font-style:normal;}
.tco tr.best td{background:#F2F8F1;}
.sbar{display:flex;height:9px;width:120px;} .sbar i{display:block;height:100%;} .sbar i:first-child{border-radius:4px 0 0 4px;} .sbar i:last-child{border-radius:0 4px 4px 0;}
.s1{background:var(--ink);} .s2{background:var(--rose);} .s3{background:#5B8FD9;}
.sal{display:inline-block;background:var(--green);color:var(--greenT);border-radius:99px;padding:2px 8px;font-weight:600;} .sal.hi{background:var(--red);color:var(--redT);}
.legend{display:flex;gap:14px;align-items:center;margin-top:8px;font-size:9px;} .legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:-1px;} .legend em{margin-left:auto;font-style:normal;color:var(--muted);}
.tbot{display:grid;grid-template-columns:1.1fr 1fr;gap:12px;margin-top:12px;}
.aen{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;} .ah{display:flex;justify-content:space-between;align-items:center;} .ah b{font-size:12.5px;} .ah span{background:#F4F2EE;border-radius:99px;padding:3px 9px;font-size:8.5px;}
.ag{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;} .ag>div{border-radius:10px;padding:8px 10px;} .ag .eco{background:var(--green);} .ag .noeco{background:var(--red);}
.ag span{font-size:9px;font-weight:600;} .ag .eco span{color:var(--greenT);} .ag .noeco span{color:var(--redT);} .ag b{display:block;font-size:19px;} .ag b small{font-size:9px;font-weight:400;} .ag p{margin:0;font-size:8px;line-height:1.35;}
.tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;} .tags span{background:#F4F2EE;border-radius:99px;padding:3px 8px;font-size:7.5px;}
.hb{background:var(--ink);color:#fff;border-radius:14px;padding:12px 14px;} .hbh{display:flex;align-items:center;gap:8px;} .hbh b{font-size:12.5px;} .hb>p{margin:6px 0 0;font-size:9px;color:#CFCBC4;text-align:center;}
.hbp{margin-top:8px;} .hbp span{font-size:9px;color:#CFCBC4;} .hbp div{font-size:13px;} .hbp s{color:#9A968F;} .hbp b{font-size:19px;}
.hbx{display:flex;justify-content:space-between;align-items:center;margin-top:8px;background:#2C2C2C;border-radius:10px;padding:8px 10px;} .hbx span{font-size:9px;color:#CFCBC4;} .hbx p{margin:2px 0 0;font-size:9.5px;} .hbx b{font-size:18px;color:var(--blue);}
/* borne */
.bhero{margin-top:14px;background:var(--blue);border-radius:16px;padding:20px 22px;display:flex;justify-content:space-between;align-items:center;}
.bk{font-size:10px;} .bk span{background:var(--ink);color:#fff;border-radius:99px;padding:3px 10px;margin-left:6px;font-size:9.5px;} .bhero h2{font-size:28px;margin-top:8px;} .bhero p{margin:8px 0 0;font-size:11px;} .bhimg{height:120px;width:auto;object-fit:contain;mix-blend-mode:multiply;}
.bprices{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;} .bp{position:relative;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;} .bp.on{border:1.5px solid var(--ink);}
.bph{display:flex;align-items:center;gap:8px;} .bph b{font-size:14px;} .kw{background:var(--blue2);border-radius:6px;padding:2px 7px;font-size:9px;}
.bpo{margin-top:6px;font-size:9.5px;} .bpo s{color:var(--redT);} .dsc{background:#E65B4D;color:#fff;border-radius:99px;padding:1px 6px;font-size:8.5px;margin-left:3px;} .bpv{font-size:26px;font-weight:600;letter-spacing:-.02em;margin-top:2px;}
.bpi{position:absolute;right:12px;top:14px;height:56px;width:auto;object-fit:contain;mix-blend-mode:multiply;}
.home{margin-top:10px;background:var(--ink);color:#fff;border-radius:16px;padding:14px;} .hh{display:flex;justify-content:space-between;align-items:center;} .hh b{font-size:16px;} .hh p{margin:2px 0 0;font-size:9.5px;color:#DDD;}
.hp{background:var(--blue);color:var(--ink);border-radius:10px;padding:7px 12px;} .hp b{font-size:16px;} .hp span{font-size:8.5px;margin-left:5px;}
.hg{display:grid;grid-template-columns:1.35fr 1fr;gap:10px;margin-top:10px;} .sup,.hs{background:#fff;color:var(--ink);border-radius:12px;padding:10px 12px;}
.suph{display:flex;gap:9px;align-items:center;} .suph b{font-size:12px;} .suph p{margin:1px 0 0;font-size:9px;color:var(--muted);}
.sr{display:grid;grid-template-columns:16px 1fr 70px 60px;gap:6px;align-items:center;background:#F7F5F0;border-radius:8px;padding:5px 8px;margin-top:5px;font-size:9px;} .sr>i svg{width:11px;height:11px;} .sr .track{margin:0;background:#E7E2D8;}
.sr em{font-style:normal;font-size:8px;background:var(--blue2);border-radius:5px;padding:2px 4px;text-align:center;} .sr em.ok{background:var(--green);color:var(--greenT);}
.ticks{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;margin-top:8px;font-size:8.5px;} .ticks span:before{content:"✓ ";color:var(--greenT);font-weight:700;}
.hside{display:flex;flex-direction:column;gap:10px;} .hs{display:flex;gap:9px;flex:1;} .hs b{font-size:11.5px;} .hs p{margin:3px 0 0;font-size:9px;color:var(--muted);line-height:1.4;}
.binc{margin-top:10px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;} .bih{display:flex;justify-content:space-between;align-items:center;} .bih b{font-size:12px;} .bih span{background:var(--blue2);border-radius:99px;padding:3px 9px;font-size:8.5px;}
.big3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:8px;} .bt{display:flex;align-items:center;gap:6px;font-weight:600;font-size:10px;padding-bottom:6px;border-bottom:1px solid var(--line);} .bt .ico{width:20px;height:20px;} .bt .ico svg{width:12px;height:12px;}
.li{padding:6px 0;border-bottom:1px solid var(--line);font-size:9.5px;} .li:last-child{border-bottom:0;} .li b{font-weight:500;display:block;} .li span{display:block;font-size:8.5px;color:var(--muted);}
/* fleet */
.fmh{margin-top:14px;background:var(--lav);border-radius:20px;padding:22px 24px 0;overflow:hidden;} .fk{font-size:10px;} .fmh h2{font-size:34px;margin-top:6px;} .fmh p{margin:8px 0 0;font-size:12px;}
.screen{margin-top:18px;background:#fff;border:1.5px solid var(--ink);border-bottom:0;border-radius:12px 12px 0 0;height:236px;padding:8px 10px;}
.dots{display:flex;gap:4px;} .dots i{width:6px;height:6px;border-radius:50%;background:var(--rose);} .dots i:nth-child(2){background:var(--blue);} .dots i:nth-child(3){background:var(--lav);}
.sg{display:grid;grid-template-columns:130px 1fr;gap:12px;margin-top:8px;height:200px;} .side{border-right:1px solid var(--line);padding-right:10px;display:flex;flex-direction:column;gap:4px;} .side span{font-size:9.5px;padding:5px 8px;border-radius:6px;} .side span.on{background:#F4F2EE;font-weight:600;}
.main b{font-size:11px;} .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px;} .kpis div{background:#F7F5F0;border-radius:8px;padding:7px 8px;font-size:8.5px;} .kpis i{display:block;width:60%;height:6px;background:var(--ink);border-radius:4px;margin-top:6px;}
.row{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;padding:6px 8px;margin-top:6px;} .row .sq{width:14px;height:14px;border-radius:4px;background:var(--rose2);} .row .sq.t1{background:var(--blue2);} .row .sq.t2{background:#F4F2EE;}
.row .ln{flex:1;height:5px;background:#EDEAE4;border-radius:3px;} .row em{font-style:normal;font-size:8px;background:var(--blue2);border-radius:5px;padding:2px 6px;} .row em.rose{background:var(--rose2);}
.fsub{margin-top:12px;background:#fff;border:1.5px solid var(--ink);border-radius:16px;padding:14px 16px;display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:center;}
.fsh{display:flex;align-items:center;gap:8px;} .fsh b{font-size:13px;} .fsv{font-size:30px;font-weight:600;letter-spacing:-.02em;margin-top:4px;} .fsv small{font-size:10px;font-weight:400;margin-left:6px;} .fsub p{margin:4px 0 0;font-size:9.5px;}
.fcalc{background:#F4F2EE;border-radius:12px;padding:10px 14px;} .fcalc>span{font-size:9.5px;} .fcalc div{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid var(--line);margin-top:4px;font-size:10px;} .fcalc b{font-size:15px;}
.foffer{margin-top:12px;background:var(--ink);color:#fff;border-radius:16px;padding:16px 18px;} .foh{display:flex;justify-content:space-between;align-items:center;font-size:9.5px;} .foffer h3{margin:12px 0 0;font-size:20px;font-weight:600;} .foffer>p{margin:4px 0 0;font-size:10.5px;color:#DDD;}
.fcond{margin-top:12px;padding-top:10px;border-top:1px solid #444;font-size:9.5px;display:flex;gap:8px;align-items:center;} .fcond i,.note i{display:inline-flex;width:14px;height:14px;border-radius:50%;background:#fff;color:var(--ink);align-items:center;justify-content:center;font-style:normal;font-weight:700;font-size:9px;flex:none;}
/* effort */
.effort{margin-top:14px;background:var(--ink);color:#fff;border-radius:18px;padding:16px;} .eh{display:flex;justify-content:space-between;align-items:flex-start;} .eh span{font-size:10px;color:#DDD;} .eh p{margin:4px 0 0;font-size:11.5px;max-width:300px;}
.et{text-align:right;} .et b{display:block;font-size:32px;letter-spacing:-.02em;} .et span{font-size:9.5px;color:#DDD;}
.eg{display:grid;gap:10px;margin-top:12px;} .eg.n1{grid-template-columns:1fr;} .eg.n2{grid-template-columns:1fr 1fr;} .eb{background:#2C2C2C;border-radius:12px;padding:12px 14px;}
.ebh{display:flex;justify-content:space-between;align-items:center;} .ebh b{font-size:11px;} .ebh .tag{color:var(--ink);} .ebv{font-size:24px;font-weight:600;color:var(--lav);margin-top:6px;} .ebv.blue{color:var(--blue);} .eb p{margin:4px 0 0;font-size:8.5px;color:#CFCBC4;line-height:1.4;}
.exb,.steps{margin-top:12px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;} .exh,.sth{display:flex;justify-content:space-between;align-items:center;} .exh b,.sth b{font-size:12px;} .exh span,.sth span{font-size:9px;color:var(--muted);}
.ext{width:100%;border-collapse:collapse;margin-top:6px;font-size:10px;} .ext th{font-weight:400;color:var(--muted);text-align:left;padding:5px 0;border-bottom:1px solid var(--line);font-size:9px;} .ext td{padding:7px 0;border-bottom:1px solid var(--line);} .ext td small{display:block;font-size:8.5px;color:var(--muted);}
.ext s{color:var(--redT);} .ext .g{color:var(--greenT);font-weight:600;}
.note{display:flex;gap:8px;align-items:center;margin-top:8px;background:#F4F2EE;border-radius:8px;padding:7px 10px;font-size:8.5px;line-height:1.4;} .note i{background:var(--ink);color:#fff;}
.st{display:flex;gap:12px;align-items:center;padding:8px 0;border-top:1px solid var(--line);} .st:first-of-type{margin-top:6px;} .st i{width:22px;height:22px;border-radius:50%;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:10px;font-weight:600;flex:none;}
.st b{font-size:11.5px;} .st p{margin:2px 0 0;font-size:9.5px;color:#444;}
/* écran / impression */
.toolbar{position:fixed;top:16px;right:16px;z-index:100;} .toolbar button{font-family:var(--font);font-size:13px;font-weight:600;border:none;border-radius:10px;padding:10px 18px;cursor:pointer;background:#F7F5F0;color:#1E1E1E;}
@media screen{ body{background:#2a2a2a;padding:18px 0;} .sheet{width:calc(794px * var(--s));height:calc(1123px * var(--s));margin:0 auto 18px;position:relative;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,.4);} .sheet > section{position:absolute;top:0;left:0;transform:scale(var(--s));transform-origin:top left;} }
@media print{ @page{size:794px 1123px;margin:0;} html,body{background:#fff;} .toolbar{display:none;} .sheet{width:794px;height:1123px;position:relative;overflow:hidden;page-break-after:always;} .sheet:last-child{page-break-after:auto;} .sheet > section{position:absolute;top:0;left:0;} *{-webkit-print-color-adjust:exact;print-color-adjust:exact;} }
</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimer / PDF</button></div>
  ${pages}
  <script>function fit(){var s=Math.min((window.innerWidth-40)/794,1.25);document.documentElement.style.setProperty('--s',String(s));}window.addEventListener('resize',fit);fit();</script>
</body></html>`;
}

/** Ouvre le catalogue dans une nouvelle fenêtre (bouton « Imprimer / PDF » pour l'export A4). */
export async function generateCatalogueClientDeck(input: CatalogueClientInput): Promise<void> {
  const win = window.open("", "_blank", "width=1100,height=1000");
  if (!win) {
    alert("Le navigateur a bloqué la fenêtre. Autorisez les popups pour ce site puis relancez la génération.");
    return;
  }
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Catalogue…</title></head><body style="font-family:system-ui;padding:48px;color:#6A6A6F">Préparation du catalogue…</body></html>');
  const [regular, medium, semibold, logoDark, logoLight] = await Promise.all([
    fontToDataUrl("/fonts/Roobert-Regular.ttf"),
    fontToDataUrl("/fonts/Roobert-Medium.ttf"),
    fontToDataUrl("/fonts/Roobert-SemiBold.ttf"),
    fontToDataUrl("/images/logo-beev-noir.png"),
    fontToDataUrl("/images/logo-beev-white.png"),
  ]);
  const html = buildCatalogueClientHtml(input, { regular, medium, semibold }, { logoDark, logoLight });
  win.document.open();
  win.document.write(html);
  win.document.close();
}
