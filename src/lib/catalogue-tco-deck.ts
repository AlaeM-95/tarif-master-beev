// « Catalogue TCO » — présentation 16:9 générée depuis le catalogue ET la sélection
// du commercial. Même mécanique que la présentation Audit & conseil : slides
// 1920×1080 en HTML, mises à l'échelle à l'écran, une slide par page paysage à
// l'impression ; polices Roobert et logos Beev embarqués en base64.
//
// Structure (calquée sur l'analyse TCO Beev × Mecapack) :
//   1. Couverture
//   2. « Vos devis » : les loyers, modèle par modèle
//   3. Une slide par véhicule proposé : photo, loyers, caractéristiques du catalogue
//   4. « Ce que vous payez vraiment » : coût mensuel tout compris, par groupe, face à
//      la flotte actuelle
//   5. « Pourquoi c'est moins cher » : loyer / énergie / taxes du premier groupe
//   6. Annexe : détail de chaque composante sur la durée du contrat
//   7. Prochaines étapes + coordonnées du conseiller
//
// Les chiffres viennent de calculateTcoFull (même moteur que le PDF) : coût complet
// = loyers + énergie + TVS + malus + AND (impôt) + AEN employeur.

import { calculateTcoFull, type TcoFullResult } from "./tco-calculator";
import { MANDATORY_SERVICES, type Vehicle } from "./catalog";
import { vehicleGroups } from "./comparison-groups";
import { esc, nbsp, fontFaceCss, fontToDataUrl, type AuditAssets, type RoobertFonts } from "./audit-conseil";
import type { SelectedVehicle } from "./pdf";
import type { EnergyParams } from "./store";

// ── Configuration éditable ────────────────────────────────────────────────
export type CatalogueTcoStep = { when: string; text: string };

export type CatalogueTcoConfig = {
  title: string;
  subtitle: string;
  /** Libellé de date de la couverture et du pied de page (« Novembre 2026 »). */
  dateLabel: string;
  /** « Pour » : destinataires sur la couverture. */
  recipients: string;
  advisorName: string;
  advisorRole: string;
  advisorEmail: string;
  advisorPhone: string;
  advisorPhotoUrl: string;
  closingTitle: string;
  steps: CatalogueTcoStep[];
  /** Phrase d'accroche par véhicule (clé : vehicleKey). Vide = phrase automatique. */
  notes: Record<string, string>;
  show: { overview: boolean; vehicles: boolean; monthly: boolean; why: boolean; annex: boolean; steps: boolean };
};

export function defaultCatalogueTco(): CatalogueTcoConfig {
  const d = new Date();
  const month = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return {
    title: "Passer votre flotte à l'électrique",
    subtitle: "Vos devis · ce que ça change chaque mois · prochaines étapes",
    dateLabel: month.charAt(0).toUpperCase() + month.slice(1),
    recipients: "",
    advisorName: "",
    advisorRole: "Votre conseiller Beev",
    advisorEmail: "",
    advisorPhone: "",
    advisorPhotoUrl: "",
    closingTitle: "On prépare ensemble\nla décision ?",
    steps: [
      { when: "Cette semaine", text: "Présentation à votre direction. Je peux intervenir si c'est utile." },
      { when: "Sous deux semaines", text: "Point de décision : modèles, durées et loueur." },
      { when: "Après validation", text: "Commandes et délais de livraison confirmés par modèle." },
      { when: "Selon les délais", text: "Livraisons, en phase avec vos renouvellements." },
    ],
    notes: {},
    show: { overview: true, vehicles: true, monthly: true, why: true, annex: true, steps: true },
  };
}

// ── Données : sélection -> lignes chiffrées ───────────────────────────────
export type TcoLine = {
  sv: SelectedVehicle;
  key: string;
  /** « Skoda Enyaq Coupé ». */
  name: string;
  /** « 85 Clever ». */
  version: string;
  isCurrent: boolean;
  r: TcoFullResult;
  months: number;
  kmTotal: number;
  loyerMois: number;
  energieMois: number;
  taxesMois: number;
  /** Coût complet par mois : loyer + énergie + taxes et charges. */
  totalMois: number;
  /** Coût complet sur la durée du contrat. */
  tco: number;
  groups: string[];
};

export const vehicleKey = (sv: SelectedVehicle): string => sv.instanceId ?? sv.vehicle.id;

/** « SKODA », « ENYAQ COUPE » -> « Skoda », « Enyaq Coupe » ; sigles et mots à chiffres conservés. */
export function displayName(v: { brand: string; model: string }): string {
  const ACRONYMS = new Set(["BMW", "MG", "DS", "VW", "BYD", "GWM", "MAN", "GT", "SUV", "EV", "RS"]);
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const brand = (s: string) =>
    (s ?? "").trim().split(/\s+/).filter(Boolean)
      .map((w) => w.split("-").map((p) => (ACRONYMS.has(p.toUpperCase()) ? p.toUpperCase() : cap(p))).join("-")).join(" ");
  const ACCENTS: Record<string, string> = { coupe: "Coupé", electrique: "Électrique", modele: "Modèle" };
  const model = (s: string) =>
    (s ?? "").trim().split(/\s+/).filter(Boolean)
      .map((w) => ACCENTS[w.toLowerCase()] ?? (w.length <= 3 || /\d/.test(w) ? w : cap(w))).join(" ");
  return `${brand(v.brand)} ${model(v.model)}`.trim();
}

/** « PROPULSION (RWD) » -> « Propulsion (RWD) » ; une version déjà en casse mixte est laissée telle quelle. */
export function displayVersion(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s || s !== s.toUpperCase() || !/[A-ZÀ-Ý]{4,}/.test(s)) return s;
  return s.replace(/[A-Za-zÀ-ÿ0-9+]+/g, (w) => (w.length <= 3 || /\d/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()));
}

/** Chiffre la sélection. Une PROPOSITION sans loyer négocié ne peut pas être chiffrée :
 *  elle est écartée et renvoyée dans `skipped`. La flotte actuelle peut avoir un loyer
 *  nul (véhicules en propriété). */
export function analyseSelection(
  selection: SelectedVehicle[],
  e: EnergyParams,
): { lines: TcoLine[]; skipped: SelectedVehicle[] } {
  const lines: TcoLine[] = [];
  const skipped: SelectedVehicle[] = [];
  for (const sv of selection) {
    const isCurrent = !!sv.vehicle.isCurrentFleet;
    if (!isCurrent && !(sv.negotiatedMonthly > 0)) { skipped.push(sv); continue; }
    const months = Math.max(1, Math.round(sv.durationMonths || 0));
    const years = months / 12;
    const optionsTtc = (sv.options ?? []).reduce((s, o) => s + o.qty * o.unitHt, 0);
    const r = calculateTcoFull(sv.vehicle, {
      dureeAnnees: years,
      kmContrat: (sv.kmPerYear || 0) * years,
      prixEssenceLitre: e.fuelPriceL,
      prixKwhDomicile: e.kWhHome,
      prixKwhPublic: e.kWhPublic,
      mixDomicilePct: e.mixHomePct,
      optionsTotalTtc: optionsTtc,
      remisePctOverride: sv.discountPct,
      apport: Math.max(0, sv.apport ?? 0),
    }, sv.negotiatedMonthly);
    const tco = r.tcoEmployeurComplet;
    lines.push({
      sv,
      key: vehicleKey(sv),
      name: displayName(sv.vehicle),
      version: displayVersion(sv.vehicle.version ?? ""),
      isCurrent,
      r,
      months,
      kmTotal: (sv.kmPerYear || 0) * years,
      loyerMois: r.loyerTotal / months,
      energieMois: r.coutEnergie / months,
      taxesMois: (tco - r.loyerTotal - r.coutEnergie) / months,
      totalMois: tco / months,
      tco,
      groups: vehicleGroups(sv),
    });
  }
  return { lines, skipped };
}

type Group = { name: string; cur: TcoLine | null; props: TcoLine[] };

/** Groupes de comparaison dans l'ordre d'apparition ; sans groupe : un seul « Votre flotte ». */
export function buildGroups(lines: TcoLine[]): Group[] {
  const names: string[] = [];
  const by = new Map<string, TcoLine[]>();
  for (const l of lines) {
    for (const g of l.groups.length ? l.groups : [""]) {
      if (!by.has(g)) { by.set(g, []); names.push(g); }
      by.get(g)!.push(l);
    }
  }
  return names
    .map((g) => {
      const list = by.get(g)!;
      const cur = list.filter((l) => l.isCurrent).reduce<TcoLine | null>((a, b) => (!a || b.tco > a.tco ? b : a), null);
      const props = list.filter((l) => !l.isCurrent).sort((a, b) => a.totalMois - b.totalMois);
      return { name: g || "Votre flotte", cur, props };
    })
    .filter((g) => g.props.length > 0);
}

type Cfg = { months: number; kmTotal: number; monthly: number };
/** Un modèle proposé, quelles que soient ses durées : les instances du même véhicule
 *  (ex. 37 mois pour les techniciens, 49 mois pour les commerciaux) sont fusionnées en
 *  une carte à plusieurs pastilles de prix. */
export type ModelCard = { key: string; rep: TcoLine; lines: TcoLine[]; configs: Cfg[]; quantity: number };

const modelKeyOf = (l: TcoLine) => `${l.sv.vehicle.brand}|${l.sv.vehicle.model}|${l.version}`.toLowerCase();

export function buildModelCards(props: TcoLine[]): ModelCard[] {
  const cards: ModelCard[] = [];
  for (const l of props) {
    const k = modelKeyOf(l);
    let c = cards.find((x) => x.key === k);
    if (!c) { c = { key: k, rep: l, lines: [], configs: [], quantity: 0 }; cards.push(c); }
    c.lines.push(l);
    c.quantity += Math.max(1, Math.round(l.sv.quantity || 1));
    const all: Cfg[] = [
      { months: l.months, kmTotal: l.kmTotal, monthly: l.sv.negotiatedMonthly },
      ...(l.sv.additionalConfigs ?? []).filter((x) => x.negotiatedMonthly > 0).map((x) => ({
        months: Math.max(1, Math.round(x.durationMonths)),
        kmTotal: (x.kmPerYear || 0) * (x.durationMonths / 12),
        monthly: x.negotiatedMonthly,
      })),
    ];
    for (const cf of all) {
      if (!c.configs.some((o) => o.months === cf.months && Math.round(o.kmTotal / 100) === Math.round(cf.kmTotal / 100) && Math.round(o.monthly) === Math.round(cf.monthly))) c.configs.push(cf);
    }
  }
  for (const c of cards) c.configs.sort((a, b) => a.months - b.months || a.monthly - b.monthly);
  return cards;
}

// ── Mise en forme ─────────────────────────────────────────────────────────
const fmt = (n: number, d = 0) =>
  nbsp(new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.round(n * 10 ** d) / 10 ** d));
const eur = (n: number) => `${fmt(n)} €`;
const monthsTxt = (m: number) => `${m} mois`;
const MINUS = "−";

/** Kilométrage total du contrat, arrondi à la centaine : « 160 000 km ». */
const kmTxt = (km: number) => `${fmt(Math.round(km / 100) * 100)} km`;

const abs = (url: string): string => {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
};

const energyLabel = (v: Vehicle) => (v.energy === "Électrique" ? "100 % électrique" : v.energy);

function stats(v: Vehicle): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const trunk = (v.trunkLitres ?? 0) > 0 ? ["Coffre", `${fmt(v.trunkLitres!)} L`] as [string, string]
    : (v.cargoVolumeM3 ?? 0) > 0 ? ["Volume utile", `${fmt(v.cargoVolumeM3!, 1)} m³`] as [string, string] : null;
  if (v.energy === "Électrique") {
    if (v.rangeWltp > 0) out.push(["Autonomie WLTP", `${fmt(v.rangeWltp)} km`]);
    if (trunk) out.push(trunk);
    if (v.batteryKwh > 0) out.push(["Batterie", `${fmt(v.batteryKwh, v.batteryKwh % 1 ? 1 : 0)} kWh`]);
    if ((v.chargeDcMaxKw ?? 0) > 0) out.push(["Recharge rapide", `${fmt(v.chargeDcMaxKw!)} kW`]);
    if (v.powerHp > 0) out.push(["Puissance", `${fmt(v.powerHp)} ch`]);
  } else {
    if (v.powerHp > 0) out.push(["Puissance", `${fmt(v.powerHp)} ch`]);
    if (trunk) out.push(trunk);
    if (v.co2 > 0) out.push(["CO₂", `${fmt(v.co2)} g/km`]);
    if (v.consumption > 0) out.push(["Consommation", `${fmt(v.consumption, 1)} L/100`]);
  }
  return out.slice(0, 3);
}

/** Phrase d'accroche d'un modèle : celle du commercial, sinon un superlatif de la sélection
 *  (loyer le plus bas, meilleure autonomie, plus grand coffre), sinon un point fort du catalogue. */
function pullQuote(c: ModelCard, cards: ModelCard[], notes: Record<string, string>): string {
  const own = (notes[c.rep.key] ?? "").trim();
  if (own) return own;
  const v = c.rep.sv.vehicle;
  const parts: string[] = [];
  if (cards.length >= 2) {
    const minLoyer = (x: ModelCard) => Math.min(...x.configs.map((k) => k.monthly));
    if (minLoyer(c) <= Math.min(...cards.map(minLoyer)) && Math.max(...cards.map(minLoyer)) > Math.min(...cards.map(minLoyer))) parts.push("le loyer le plus bas");
    const ranges = cards.map((x) => x.rep.sv.vehicle.rangeWltp || 0);
    if ((v.rangeWltp || 0) > 0 && v.rangeWltp >= Math.max(...ranges) && Math.max(...ranges) > Math.min(...ranges)) parts.push("la meilleure autonomie");
    const trunks = cards.map((x) => x.rep.sv.vehicle.trunkLitres || 0);
    if ((v.trunkLitres || 0) > 0 && v.trunkLitres! >= Math.max(...trunks) && Math.max(...trunks) > Math.min(...trunks)) parts.push("le plus grand coffre");
  }
  if (parts.length) {
    const s = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}` : parts[0];
    return `${s.charAt(0).toUpperCase()}${s.slice(1)} de la sélection.`;
  }
  return v.designHighlights?.[0] ?? "";
}

// ── Gabarits de slides ────────────────────────────────────────────────────
const logo = (assets: AuditAssets | undefined, light: boolean, cls: string) => {
  const url = light ? assets?.logoLight : assets?.logoDark;
  return url
    ? `<img class="${cls}" src="${url}" alt="Beev" />`
    : `<span class="${cls} wordmark" style="color:${light ? "var(--beige)" : "var(--black)"}">Beev</span>`;
};

type Ctx = { cfg: CatalogueTcoConfig; assets?: AuditAssets; clientName: string; footerNote: string };

const photo = (v: Vehicle, cls: string) =>
  v.image
    ? `<img class="${cls}" src="${esc(abs(v.image))}" alt="${esc(displayName(v))}" onerror="var d=document.createElement('div');d.className=this.className+' noimg';d.textContent=this.alt;this.replaceWith(d)" />`
    : `<div class="${cls} noimg">${esc(displayName(v))}</div>`;

function lightFrame(ctx: Ctx, n: number, total: number, inner: string): string {
  return `<section>
    ${logo(ctx.assets, false, "brand-mark")}
    ${inner}
    <div class="sfoot"><span>${esc(ctx.footerNote)}</span><span>${String(n).padStart(2, "0")} / ${total}</span></div>
  </section>`;
}

function chipsHtml(c: ModelCard): string {
  return c.configs
    .map((k, i) => `<div class="chip ${i === 0 ? "c1" : "c2"}"><span class="chip-k">${monthsTxt(k.months)}\u00A0·\u00A0${kmTxt(k.kmTotal)}</span><span class="chip-p">${eur(k.monthly)}</span><span class="chip-u">TTC\u00A0/\u00A0mois</span></div>`)
    .join("");
}

function coverSlide(ctx: Ctx): string {
  const { cfg } = ctx;
  const who = ctx.clientName ? `${esc(ctx.clientName.toUpperCase())} · ` : "";
  const title = esc(cfg.title).replace(/\n/g, "<br>");
  return `<section class="dark cover">
    ${logo(ctx.assets, true, "brand-mark")}
    <div class="cover-body">
      <div class="cover-eyebrow">${who}${esc(cfg.dateLabel.toUpperCase())}</div>
      <h1>${title}</h1>
      <p class="cover-sub">${esc(cfg.subtitle)}</p>
      <div class="cover-meta">
        ${cfg.recipients ? `<div><span class="lbl">POUR</span><span>${esc(cfg.recipients)}</span></div>` : ""}
        ${cfg.advisorName ? `<div><span class="lbl">PAR</span><span>${esc(cfg.advisorName)} · Beev</span></div>` : ""}
      </div>
    </div>
    <div class="sfoot dark-foot"><span>beev.co</span></div>
  </section>`;
}

function overviewSlide(ctx: Ctx, n: number, total: number, items: ModelCard[], inclus: string): string {
  const cols = Math.min(3, items.length);
  const dense = items.length > 3;
  const cards = items.map((c) => `
    <div class="ocard${dense ? " dense" : ""}">
      ${photo(c.rep.sv.vehicle, "ophoto")}
      <div class="oname">${esc(c.rep.name)}</div>
      <div class="oversion">${esc(c.rep.version)}</div>
      <div class="chips">${chipsHtml(c)}</div>
    </div>`).join("");
  return lightFrame(ctx, n, total, `
    <div class="eyebrow">VOS DEVIS</div>
    <h2 class="t">Les loyers, modèle par modèle.</h2>
    <div class="ogrid" style="grid-template-columns:repeat(${cols},1fr)">${cards}</div>
    ${inclus ? `<div class="pill-note">${inclus}</div>` : ""}`);
}

function vehicleSlide(ctx: Ctx, n: number, total: number, c: ModelCard, idx: number, all: ModelCard[]): string {
  const l = c.rep;
  const count = all.length;
  const v = l.sv.vehicle;
  const tiles = stats(v).map(([k, val]) => `<div class="stat"><span class="stat-k">${esc(k)}</span><span class="stat-v">${val}</span></div>`).join("");
  const pills = [v.category, energyLabel(v), c.quantity > 1 ? `× ${c.quantity} véhicules` : ""]
    .filter(Boolean).map((p) => `<span class="tag">${esc(p)}</span>`).join("");
  const quote = pullQuote(c, all, ctx.cfg.notes);
  return lightFrame(ctx, n, total, `
    <div class="eyebrow">DEVIS ${idx + 1} / ${count}</div>
    <h2 class="t">${esc(l.name)} <span class="ver">${esc(l.version)}</span></h2>
    <div class="vgrid">
      <div class="vcard">${photo(v, "vphoto")}<div class="tags">${pills}</div></div>
      <div class="vside">
        <div class="chips big">${chipsHtml(c)}</div>
        ${tiles ? `<div class="stats">${tiles}</div>` : ""}
        ${quote ? `<p class="quote">${esc(quote)}</p>` : ""}
      </div>
    </div>`);
}

type MatrixCol = { key: string; label: string; sub: string };

function matrixSlides(ctx: Ctx, groups: Group[], startN: number, total: number, fine: string, order: string[]): string[] {
  const hasCur = groups.some((g) => g.cur);
  const modelKey = modelKeyOf;
  const cols: MatrixCol[] = [];
  for (const g of groups) for (const p of g.props) {
    const k = modelKey(p);
    if (!cols.some((c) => c.key === k)) cols.push({ key: k, label: p.name, sub: p.version });
  }
  // Colonnes dans l'ordre de la sélection du commercial (pas par coût).
  cols.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  // Deux versions du même modèle en colonnes : la version est précisée sous le nom.
  const showVer = (c: MatrixCol) => cols.filter((o) => o.label === c.label).length > 1;

  const MAX_COLS = 4;
  const MAX_ROWS = 3;
  const pages: string[] = [];
  const rowChunks: Group[][] = [];
  for (let i = 0; i < groups.length; i += MAX_ROWS) rowChunks.push(groups.slice(i, i + MAX_ROWS));
  const colChunks: MatrixCol[][] = [];
  for (let i = 0; i < cols.length; i += MAX_COLS) colChunks.push(cols.slice(i, i + MAX_COLS));

  for (const rows of rowChunks) {
    for (const cs of colChunks) {
      const head = `<div class="mh"></div>${hasCur ? `<div class="mh">Aujourd'hui</div>` : ""}${cs.map((c) => `<div class="mh">${esc(c.label)}${showVer(c) && c.sub ? `<span class="mh-v">${esc(c.sub)}</span>` : ""}</div>`).join("")}`;
      const body = rows.map((g) => {
        const cur = g.cur
          ? `<div class="mcell cur"><span class="mnm">${esc(g.cur.name)}<span class="mmo"> \u00B7 ${monthsTxt(g.cur.months)}</span></span><span class="mpr">${eur(g.cur.totalMois)}</span></div>`
          : `<div class="mcell empty">${MINUS}</div>`;
        const cells = cs.map((c) => {
          const p = g.props.filter((x) => modelKey(x) === c.key).sort((a, b) => a.totalMois - b.totalMois)[0];
          if (!p) return `<div class="mcell empty">${MINUS}</div>`;
          let delta = "";
          if (g.cur) {
            const d = Math.round(p.totalMois) - Math.round(g.cur.totalMois);
            delta = `<span class="delta ${d > 0 ? "up" : ""}">${d > 0 ? "+" : MINUS}${eur(Math.abs(d))} / mois</span>`;
          }
          return `<div class="mcell"><span class="mmo">${monthsTxt(p.months)}</span><span class="mpr">${eur(p.totalMois)}</span>${delta}</div>`;
        }).join("");
        return `<div class="mlabel">${esc(g.name)}</div>${hasCur ? cur : ""}${cells}`;
      }).join("");
      const tpl = `230px repeat(${cs.length + (hasCur ? 1 : 0)},1fr)`;
      const n = startN + pages.length;
      pages.push(lightFrame(ctx, n, total, `
        <div class="eyebrow">CE QUE VOUS PAYEZ VRAIMENT</div>
        <h2 class="t">Chaque mois, par véhicule, tout compris.</h2>
        <p class="lede">Tout compris = <b>loyer</b> + <b>carburant ou électricité</b> + <b>taxes et charges</b> (TVS, malus, avantage en nature).</p>
        <div class="matrix" style="grid-template-columns:${tpl}">${head}${body}</div>
        <p class="fine">${fine}</p>`));
    }
  }
  return pages;
}

function whySlide(ctx: Ctx, n: number, total: number, g: Group): string {
  const cur = g.cur!;
  const ref = g.props[0];
  const ev = ref.sv.vehicle.energy === "Électrique";
  const curEv = cur.sv.vehicle.energy === "Électrique";

  const dLoyer = ref.loyerMois - cur.loyerMois;
  const loyerNote = cur.loyerMois <= 0 ? "Le loyer de votre nouveau véhicule."
    : Math.abs(dLoyer) / cur.loyerMois < 0.03 ? "Un loyer équivalent."
    : dLoyer > 0 ? `Un peu plus cher${ev ? " en électrique" : ""}.`
    : `Moins cher${ev ? " en électrique" : ""}.`;

  const ratio = ref.energieMois > 0 ? cur.energieMois / ref.energieMois : 0;
  const energyNote = !curEv && ev && ratio >= 1.5 ? `Recharger coûte plus de ${Math.floor(ratio)} fois moins cher que faire le plein.`
    : ratio >= 1.15 ? `L'énergie coûte ${Math.round((1 - 1 / ratio) * 100)} % de moins.`
    : ratio > 0 && ratio < 0.95 ? "L'énergie coûte un peu plus cher."
    : "Un coût d'énergie équivalent.";

  const malus = ref.r.malusCO2 + ref.r.malusPoids;
  const abatPct = ref.r.aenBrut > 0 ? Math.round((ref.r.aenAbattement / ref.r.aenBrut) * 100) : 0;
  const taxNote = `${eur(ref.r.tvsTotal)} de TVS, ${eur(malus)} de malus${abatPct > 0 ? `, avantage en nature réduit de ${abatPct} %` : ""}.`;

  const strike = (v: number) => (v > 0 ? `<s>${eur(v)}</s>` : `<s>${MINUS}</s>`);
  const aen = cur.r.aenMensuel > 0 && Math.abs(cur.r.aenMensuel - ref.r.aenMensuel) >= 1
    ? `<div class="banner"><b>Pour le collaborateur aussi :</b> l'avantage en nature déclaré passe de ${eur(cur.r.aenMensuel)} à ${eur(ref.r.aenMensuel)} par mois.</div>` : "";

  return lightFrame(ctx, n, total, `
    <div class="eyebrow">POURQUOI C'EST MOINS CHER</div>
    <h2 class="t">Le loyer est proche. La différence vient d'ailleurs.</h2>
    <p class="lede">Exemple : ${esc(g.name.toLowerCase())}, ${esc(cur.name)} aujourd'hui, ${esc(ref.name)} demain. Montants par mois.</p>
    <div class="wgrid">
      <div class="wcard"><span class="wk">LOYER</span><div class="wv">${strike(cur.loyerMois)}<i>→</i><b>${eur(ref.loyerMois)}</b></div><p>${esc(loyerNote)}</p></div>
      <div class="wcard blue"><span class="wk">${!curEv && ev ? "CARBURANT → ÉLECTRICITÉ" : "ÉNERGIE"}</span><div class="wv">${strike(cur.energieMois)}<i>→</i><b>${eur(ref.energieMois)}</b></div><p>${esc(energyNote)}</p></div>
      <div class="wcard blue"><span class="wk">TAXES ET CHARGES</span><div class="wv">${strike(cur.taxesMois)}<i>→</i><b>${eur(ref.taxesMois)}</b></div><p>${taxNote}</p></div>
    </div>
    ${aen}`);
}

function annexSlides(ctx: Ctx, groups: Group[], startN: number, total: number, hypo: string, kmUniform: string): string[] {
  type Row = { kind: "band"; label: string } | { kind: "row"; l: TcoLine };
  const flat: Row[][] = [];
  const CAP = 13.9; // unités de hauteur par slide (bandeau = 0,85 ligne)
  let page: Row[] = [];
  let used = 0;
  const push = (r: Row) => {
    const h = r.kind === "band" ? 0.85 : 1;
    if (used + h > CAP && page.length) { flat.push(page); page = []; used = 0; }
    page.push(r); used += h;
  };
  for (const g of groups) {
    const rows = [...(g.cur ? [g.cur] : []), ...g.props];
    // Le bandeau ne reste jamais seul en bas de slide.
    if (used + 0.85 + 1 > CAP && page.length) { flat.push(page); page = []; used = 0; }
    push({ kind: "band", label: g.name });
    for (const l of rows) {
      if (page.length === 0) push({ kind: "band", label: `${g.name} (suite)` });
      push({ kind: "row", l });
    }
  }
  if (page.length) flat.push(page);

  const allNames = groups.flatMap((g) => [g.cur, ...g.props]).filter(Boolean) as TcoLine[];
  const dupName = (l: TcoLine) => allNames.filter((o) => o.name === l.name && o.version !== l.version).length > 0;
  const money = (v: number) => `${fmt(v)} €`;

  return flat.map((rows, i) => {
    const trs = rows.map((r) => {
      if (r.kind === "band") return `<tr class="band"><td colspan="10">${esc(r.label.toUpperCase())}</td></tr>`;
      const l = r.l;
      const x = l.r;
      return `<tr class="${l.isCurrent ? "cur" : ""}">
        <td class="vn"><b>${esc(l.name)}</b>${l.isCurrent ? ` <em>(actuel)</em>` : ""}${dupName(l) && l.version ? `<span class="vv">${esc(l.version)}</span>` : ""}</td>
        <td class="mut">${monthsTxt(l.months)}</td>
        <td>${money(x.loyerTotal)}</td><td>${money(x.coutEnergie)}</td><td>${money(x.tvsTotal)}</td>
        <td>${money(x.malusCO2 + x.malusPoids)}</td><td>${money(x.coutFiscalANDTotal)}</td><td>${money(x.aenEmployeurTotal)}</td>
        <td class="strong">${money(l.tco)}</td><td class="pm strong">${money(l.totalMois)}</td></tr>`;
    }).join("");
    return lightFrame(ctx, startN + i, total, `
      <div class="eyebrow">ANNEXE</div>
      <h2 class="t">Le détail de chaque composante, sur la durée du contrat.</h2>
      <table class="annex">
        <thead><tr><th class="vn">VÉHICULE</th><th>CONTRAT</th><th>LOYERS</th><th>ÉNERGIE</th><th>TVS</th><th>MALUS</th><th>AND 25 %</th><th>AEN EMPLOYEUR</th><th>COÛT COMPLET</th><th>PAR MOIS</th></tr></thead>
        <tbody>${trs}</tbody>
      </table>
      <p class="fine">${kmUniform} <b>AND 25 %</b> : impôt supplémentaire sur la part du prix au-dessus du plafond fiscal. <b>AEN employeur</b> : charges sociales sur l'avantage en nature (abattement de 70 % en électrique). ${hypo}</p>`);
  });
}

function stepsSlide(ctx: Ctx, n: number, total: number): string {
  const { cfg } = ctx;
  const steps = cfg.steps.filter((s) => s.when.trim() || s.text.trim())
    .map((s) => `<div class="step"><span class="when">${esc(s.when)}</span><p>${esc(s.text)}</p></div>`).join("");
  const initials = cfg.advisorName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
  const avatar = cfg.advisorPhotoUrl
    ? `<img class="avatar" src="${esc(abs(cfg.advisorPhotoUrl))}" alt="${esc(cfg.advisorName)}" />`
    : `<div class="avatar ini">${esc(initials || "B")}</div>`;
  return `<section class="dark steps">
    ${logo(ctx.assets, true, "brand-mark")}
    <div class="eyebrow light">PROCHAINES ÉTAPES</div>
    <h2 class="t light">${esc(cfg.closingTitle).replace(/\n/g, "<br>")}</h2>
    <div class="sgrid">${steps}</div>
    ${cfg.advisorName ? `<div class="advisor">${avatar}
      <div class="an">${esc(cfg.advisorName)}</div><div class="ar">${esc(cfg.advisorRole)}</div>
      ${cfg.advisorEmail ? `<div class="apill">${esc(cfg.advisorEmail)}</div>` : ""}
      ${cfg.advisorPhone ? `<div class="apill">${esc(cfg.advisorPhone)}</div>` : ""}</div>` : ""}
    <div class="sfoot dark-foot"><span>beev.co</span><span>${String(n).padStart(2, "0")} / ${total}</span></div>
  </section>`;
}

// ── Assemblage ────────────────────────────────────────────────────────────
export type CatalogueTcoInput = { cfg: CatalogueTcoConfig; selection: SelectedVehicle[]; energy: EnergyParams; clientName: string };

export function buildCatalogueTcoHtml(input: CatalogueTcoInput, fonts?: RoobertFonts, assets?: AuditAssets): string {
  const { cfg, energy: e } = input;
  const { lines } = analyseSelection(input.selection, e);
  const props = lines.filter((l) => !l.isCurrent);
  const cards = buildModelCards(props);
  const groups = buildGroups(lines);

  const kms = lines.map((l) => l.kmTotal);
  const uniformKm = kms.length > 0 && Math.max(...kms) - Math.min(...kms) < 100;
  const blend = (e.mixHomePct / 100) * e.kWhHome + (1 - e.mixHomePct / 100) * e.kWhPublic;
  const hypo = `Essence ${fmt(e.fuelPriceL, 2)} €/L · électricité ${fmt(blend, 2)} €/kWh (${fmt(e.mixHomePct)} % à domicile, ${fmt(100 - e.mixHomePct)} % sur borne publique) · fiscalité 2026, à confirmer par votre expert-comptable.`;
  const matrixFine = `${uniformKm ? `Même kilométrage partout : ${kmTxt(kms[0])}.` : "Kilométrage propre à chaque contrat."} Hypothèses : ${hypo.charAt(0).toLowerCase()}${hypo.slice(1)} Détail des calculs sur demande.`;
  const kmUniform = uniformKm ? `Tous les contrats : ${kmTxt(kms[0])}.` : "Kilométrage propre à chaque contrat.";

  const mandatory = [...MANDATORY_SERVICES].map((s) => s.toLowerCase());
  const common = props.length
    ? (props[0].sv.services ?? []).filter((s) => props.every((p) => (p.sv.services ?? []).includes(s))).filter((s) => !MANDATORY_SERVICES.includes(s as never))
    : [];
  const inclus = props.length ? `Inclus dans chaque loyer : <b>${[...mandatory, ...common.map((s) => s.toLowerCase())].map(esc).join("</b> · <b>")}</b>` : "";

  const footerNote = `${input.clientName || "Beev"} · Analyse TCO · ${cfg.dateLabel} · Loyers TTC${uniformKm ? ` · ${kmTxt(kms[0])}` : ""} · maintenance, assistance 24/24 et garantie perte financière inclus`;
  const ctx: Ctx = { cfg, assets, clientName: input.clientName, footerNote };

  const builders: Array<(n: number, total: number) => string> = [() => coverSlide(ctx)];
  if (cfg.show.overview && cards.length) {
    const PER = 6;
    for (let i = 0; i < cards.length; i += PER) {
      const chunk = cards.slice(i, i + PER);
      builders.push((n, t) => overviewSlide(ctx, n, t, chunk, inclus));
    }
  }
  if (cfg.show.vehicles) cards.forEach((c, i) => builders.push((n, t) => vehicleSlide(ctx, n, t, c, i, cards)));
  if (cfg.show.monthly && groups.length) {
    const order = cards.map((c) => c.key);
    const count = matrixSlides(ctx, groups, 0, 0, matrixFine, order).length; // nombre de pages seulement
    for (let i = 0; i < count; i++) builders.push((n, t) => matrixSlides(ctx, groups, n - i, t, matrixFine, order)[i]);
  }
  const whyGroup = groups.find((g) => g.cur && g.props.length);
  if (cfg.show.why && whyGroup) builders.push((n, t) => whySlide(ctx, n, t, whyGroup));
  if (cfg.show.annex && groups.length) {
    const count = annexSlides(ctx, groups, 0, 0, hypo, kmUniform).length;
    for (let i = 0; i < count; i++) builders.push((n, t) => annexSlides(ctx, groups, n - i, t, hypo, kmUniform)[i]);
  }
  if (cfg.show.steps) builders.push((n, t) => stepsSlide(ctx, n, t));

  const total = builders.length;
  const slides = builders.map((b, i) => `<div class="slide">${b(i + 1, total)}</div>`).join("\n");

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" />
<title>Analyse TCO ${esc(input.clientName)} × Beev</title>
<style>
${fontFaceCss(fonts)}
:root{
  --black:#1D1D1D; --beige:#FCF9F2; --white:#FFFFFF; --taupe:#EFE9DD; --taupe-2:#E6DFD0;
  --rose:#F4B8AA; --bleu:#A5D2FF; --bleu-50:#D7E9FB; --bleu-30:#E7F1FC;
  --fg-2:#4A4A4A; --fg-3:#7A7A7A; --fg-4:#9A978F;
  --font:'Roobert','Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  --s:.62;
}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
section{position:relative;font-family:var(--font);background:var(--beige);color:var(--black);-webkit-font-smoothing:antialiased;overflow:hidden;width:1920px;height:1080px;padding:0 96px;}
section.dark{background:var(--black);color:var(--beige);}
b{font-weight:600;}
.brand-mark{position:absolute;top:50px;left:96px;height:38px;width:auto;object-fit:contain;}
.wordmark{font-size:36px;font-weight:700;letter-spacing:-.02em;}
.eyebrow{position:absolute;top:150px;left:96px;font-size:19px;font-weight:600;letter-spacing:.16em;color:var(--fg-2);}
.eyebrow.light{color:rgba(252,249,242,.7);}
h2.t{position:absolute;top:186px;left:96px;right:96px;margin:0;font-size:64px;line-height:1.05;font-weight:600;letter-spacing:-.028em;}
h2.t .ver{color:var(--fg-3);font-weight:500;}
h2.t.light{color:var(--beige);font-weight:500;}
.lede{position:absolute;top:276px;left:96px;right:96px;margin:0;font-size:25px;color:var(--fg-2);}
.fine{position:absolute;left:96px;right:200px;bottom:120px;margin:0;font-size:19px;line-height:1.45;color:var(--fg-2);}
.sfoot{position:absolute;left:96px;right:96px;bottom:44px;display:flex;justify-content:space-between;font-size:16px;color:var(--fg-4);}
.sfoot.dark-foot{color:rgba(252,249,242,.5);}

/* couverture */
.cover-body{position:absolute;left:96px;right:96px;top:340px;}
.cover-eyebrow{font-size:21px;font-weight:600;letter-spacing:.16em;color:var(--beige);margin-bottom:34px;}
.cover h1{max-width:1280px;margin:0;font-size:150px;line-height:1.0;font-weight:500;letter-spacing:-.035em;color:#fff;}
.cover-sub{margin:44px 0 0;font-size:38px;color:rgba(252,249,242,.72);}
.cover-meta{display:flex;gap:140px;margin-top:150px;font-size:27px;color:#fff;}
.cover-meta .lbl{display:block;font-size:17px;font-weight:700;letter-spacing:.16em;color:var(--bleu);margin-bottom:12px;}

/* chips de prix */
.chips{display:flex;gap:18px;}
.chip{flex:1;border-radius:26px;padding:22px 26px 24px;display:flex;flex-direction:column;}
.chip.c1{background:var(--bleu);} .chip.c2{background:var(--bleu-50);}
.chip-k{font-size:19px;font-weight:600;color:var(--black);}
.chip-p{font-size:76px;line-height:1.05;font-weight:600;letter-spacing:-.03em;margin-top:10px;}
.chip-u{font-size:18px;color:var(--fg-2);margin-top:4px;}

/* vos devis */
.ogrid{position:absolute;top:282px;left:96px;right:96px;display:grid;gap:30px;}
.ocard{background:#fff;border-radius:34px;padding:34px 34px 34px;display:flex;flex-direction:column;height:624px;}
.ocard.dense{height:278px;padding:20px 26px;display:grid;grid-template-columns:230px 1fr;column-gap:22px;align-items:center;}
.ophoto{width:100%;height:270px;object-fit:contain;}
.ocard.dense .ophoto{height:130px;grid-row:1/4;}
.oname{font-size:40px;font-weight:600;letter-spacing:-.02em;margin-top:20px;}
.oversion{font-size:22px;color:var(--fg-3);margin:2px 0 22px;}
.ocard.dense .oname{font-size:30px;margin-top:0;} .ocard.dense .oversion{font-size:19px;margin-bottom:10px;}
.ocard.dense .chip-p{font-size:46px;} .ocard.dense .chip{padding:12px 16px;border-radius:18px;} .ocard.dense .chip-k{font-size:15px;} .ocard.dense .chip-u{font-size:14px;}
.ocard .chips{margin-top:auto;}
.ocard.dense .chips{margin-top:0;grid-column:2;}
.noimg{display:flex;align-items:center;justify-content:center;background:var(--taupe);border-radius:22px;color:var(--fg-3);font-size:26px;}
.pill-note{position:absolute;left:96px;bottom:104px;background:#fff;border-radius:99px;padding:20px 34px;font-size:24px;}
.pill-note b{font-weight:600;}

/* une slide par véhicule */
.vgrid{position:absolute;top:290px;left:96px;right:96px;display:grid;grid-template-columns:880px 1fr;gap:34px;}
.vcard{background:#fff;border-radius:38px;height:640px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:34px;}
.vphoto{width:100%;height:480px;object-fit:contain;}
.tags{display:flex;gap:12px;margin-top:26px;flex-wrap:wrap;justify-content:center;}
.tag{background:var(--taupe);border-radius:99px;padding:9px 20px;font-size:19px;color:var(--fg-2);}
.vside{display:flex;flex-direction:column;gap:22px;min-width:0;}
.vside .chips.big .chip-p{font-size:92px;} .vside .chips.big .chip{padding:26px 30px 28px;}
.stats{display:flex;gap:18px;}
.stat{flex:1;background:#fff;border-radius:24px;padding:20px 24px;display:flex;flex-direction:column;gap:6px;}
.stat-k{font-size:19px;color:var(--fg-3);} .stat-v{font-size:38px;font-weight:600;letter-spacing:-.02em;}
.quote{margin:8px 0 0;padding-left:22px;border-left:4px solid var(--black);font-size:27px;line-height:1.4;color:var(--black);}

/* ce que vous payez vraiment */
.matrix{position:absolute;top:340px;left:96px;right:96px;display:grid;gap:14px 18px;align-items:stretch;}
.mh{font-size:20px;font-weight:600;color:var(--black);align-self:end;padding-left:4px;}
.mh .mh-v{display:block;font-size:15px;font-weight:400;color:var(--fg-3);}
.mlabel{display:flex;align-items:center;font-size:36px;font-weight:600;letter-spacing:-.02em;}
.mcell{background:#fff;border-radius:24px;padding:16px 24px;display:flex;flex-direction:column;gap:4px;justify-content:center;min-height:138px;}
.mcell.cur{background:var(--taupe);}
.mcell.empty{background:transparent;color:var(--fg-4);font-size:40px;justify-content:center;}
.mnm{font-size:20px;font-weight:600;} .mmo{font-size:18px;font-weight:400;color:var(--fg-3);}
.mpr{font-size:52px;line-height:1.05;font-weight:600;letter-spacing:-.03em;}
.delta{align-self:flex-start;background:var(--bleu);border-radius:10px;padding:3px 12px;font-size:18px;font-weight:600;}
.delta.up{background:var(--rose);}

/* pourquoi c'est moins cher */
.wgrid{position:absolute;top:350px;left:96px;right:96px;display:grid;grid-template-columns:repeat(3,1fr);gap:26px;}
.wcard{background:#fff;border-radius:30px;padding:34px 38px 38px;min-height:330px;display:flex;flex-direction:column;}
.wcard.blue{background:var(--bleu);}
.wk{font-size:20px;font-weight:600;letter-spacing:.12em;}
.wv{display:flex;align-items:baseline;gap:20px;margin:30px 0 26px;}
.wv s{font-size:46px;color:var(--fg-3);} .wcard.blue .wv s{color:#5C6E80;}
.wv i{font-style:normal;font-size:38px;} .wv b{font-size:88px;line-height:1;letter-spacing:-.035em;font-weight:600;}
.wcard p{margin:0;font-size:25px;line-height:1.4;}
.banner{position:absolute;left:96px;right:96px;top:716px;background:#fff;border-radius:22px;padding:28px 38px;font-size:27px;}

/* annexe */
.annex{position:absolute;top:276px;left:96px;right:96px;width:calc(100% - 192px);border-collapse:separate;border-spacing:0;font-size:21px;background:#fff;border-radius:18px;overflow:hidden;}
.annex th{background:var(--black);color:#fff;font-size:16px;font-weight:500;letter-spacing:.08em;padding:17px 16px;text-align:right;white-space:nowrap;}
.annex th.vn,.annex td.vn{text-align:left;padding-left:26px;}
.annex td{padding:0 16px;height:40px;text-align:right;white-space:nowrap;border-bottom:1px solid #f0ece2;}
.annex td.mut{color:var(--fg-3);}
.annex td.strong{font-weight:600;}
.annex td.pm{background:var(--bleu-30);} .annex tr.cur td{background:var(--taupe);} .annex tr.cur td.pm{background:var(--taupe-2);}
.annex tr.band td{background:var(--bleu-50);height:34px;text-align:left;padding-left:26px;font-weight:600;font-size:19px;letter-spacing:.06em;}
.annex td.vn em{font-style:normal;color:var(--fg-3);font-weight:400;} .annex td.vn .vv{display:block;font-size:15px;color:var(--fg-3);line-height:1;}
.annex ~ .fine{bottom:96px;right:96px;}

/* prochaines étapes */
.steps h2.t{top:200px;font-size:84px;}
.sgrid{position:absolute;top:460px;left:96px;width:1140px;display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.step{background:#2A2A2A;border-radius:22px;padding:26px 30px;min-height:170px;}
.when{font-size:24px;font-weight:600;color:var(--bleu);}
.step p{margin:12px 0 0;font-size:24px;line-height:1.4;color:#DDD8CE;}
.advisor{position:absolute;right:150px;top:340px;width:420px;display:flex;flex-direction:column;align-items:center;text-align:center;}
.avatar{width:260px;height:260px;border-radius:50%;object-fit:cover;}
.avatar.ini{background:var(--bleu);color:var(--black);display:flex;align-items:center;justify-content:center;font-size:96px;font-weight:600;}
.an{font-size:38px;font-weight:500;margin-top:30px;color:#fff;} .ar{font-size:22px;color:rgba(252,249,242,.6);margin:6px 0 26px;}
.apill{background:#fff;color:var(--black);border-radius:99px;padding:14px 30px;font-size:24px;font-weight:500;margin-top:12px;}

/* écran + impression paysage */
.toolbar{position:fixed;top:16px;right:16px;z-index:100;display:flex;gap:8px;}
.toolbar button{font-family:var(--font);font-size:13px;font-weight:600;border:none;border-radius:10px;padding:10px 18px;cursor:pointer;background:var(--beige);color:var(--black);}
@media screen{
  body{background:#0c0c0c;padding:18px 0;}
  .slide{width:calc(1920px * var(--s));height:calc(1080px * var(--s));margin:0 auto 18px;position:relative;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.45);border-radius:6px;}
  .slide > section{position:absolute;top:0;left:0;transform:scale(var(--s));transform-origin:top left;}
}
@media print{
  @page{size:1920px 1080px;margin:0;}
  html,body{background:#fff;}
  .toolbar{display:none;}
  .slide{width:1920px;height:1080px;position:relative;overflow:hidden;page-break-after:always;}
  .slide:last-child{page-break-after:auto;}
  .slide > section{position:absolute;top:0;left:0;}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
}
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimer / PDF</button></div>
  ${slides}
  <script>
    function fitDeck(){ var s = Math.min((window.innerWidth - 24) / 1920, 0.92); document.documentElement.style.setProperty('--s', String(s)); }
    window.addEventListener('resize', fitDeck); fitDeck();
  </script>
</body></html>`;
}

/** Ouvre la présentation dans une nouvelle fenêtre (bouton « Imprimer / PDF » pour l'export). */
export async function generateCatalogueTcoDeck(input: CatalogueTcoInput): Promise<void> {
  const win = window.open("", "_blank", "width=1400,height=900");
  if (!win) {
    alert("Le navigateur a bloqué la fenêtre. Autorisez les popups pour ce site puis relancez la génération.");
    return;
  }
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Présentation…</title></head><body style="font-family:system-ui;padding:48px;color:#6A6A6F">Préparation de la présentation…</body></html>');
  const [regular, medium, semibold, logoDark, logoLight] = await Promise.all([
    fontToDataUrl("/fonts/Roobert-Regular.ttf"),
    fontToDataUrl("/fonts/Roobert-Medium.ttf"),
    fontToDataUrl("/fonts/Roobert-SemiBold.ttf"),
    fontToDataUrl("/images/logo-beev-noir.png"),
    fontToDataUrl("/images/logo-beev-white.png"),
  ]);
  const html = buildCatalogueTcoHtml(input, { regular, medium, semibold }, { logoDark, logoLight });
  win.document.open();
  win.document.write(html);
  win.document.close();
}
