// « Proposition flotte » — nouveau format de catalogue (modèle Beev × HEMC-37).
// Présentation 16:9 générée depuis la SÉLECTION du devis : flotte actuelle, véhicules
// proposés, groupes de comparaison, loyers, durées, km. Même moteur de calcul que le PDF
// et que le « Catalogue TCO » (calculateTcoFull via analyseSelection), qui reste
// disponible tel quel.
//
// Pages :
//   1. Couverture
//   2. L'essentiel : coût complet aujourd'hui / avec Beev, économie totale
//   3. D'où vient l'économie : loyers / énergie / fiscalité, groupe par groupe
//   4. Une page par groupe : véhicule actuel, recommandé, alternatives (barres empilées)
//   5. Recharge à domicile (option) : borne posée au forfait + supervision Beev Home Connect
//   6. Pourquoi Beev
//   7. Glossaire
//   8. Annexe : tous les chiffres, véhicule par véhicule
//   9. Annexe : méthode de calcul
//
// L'offre borne est facultative ; quand elle est cochée « comptée dans l'économie », son
// coût (forfait de pose + supervision sur la durée) est ajouté une seule fois au total
// « avec Beev ». Borne et supervision sont en HT (TVA récupérable), les loyers en TTC.

import { analyseSelection, buildGroups, displayName, type TcoLine } from "./catalogue-tco-deck";
import { esc, nbsp, fontFaceCss, fontToDataUrl, type AuditAssets, type RoobertFonts } from "./audit-conseil";
import type { Vehicle } from "./catalog";
import type { SelectedVehicle } from "./pdf";
import type { EnergyParams } from "./store";

// ── Configuration éditable ────────────────────────────────────────────────
export type BorneLine = { label: string; priceHt: number };

export type PropositionFlotteConfig = {
  title: string;
  subtitle: string;
  reference: string;
  dateLabel: string;
  validityDays: number;
  advisorName: string;
  advisorEmail: string;
  advisorPhone: string;
  borne: {
    enabled: boolean;
    /** Compter borne + supervision dans l'économie (ajoutées une seule fois). */
    inSavings: boolean;
    chargerId: string;
    name: string;
    image: string;
    lines: BorneLine[];
    /** Ligne de prix retenue dans le calcul (0 = première). */
    lineIndex: number;
    /** Nombre de bornes comptées dans le calcul. */
    count: number;
    included: string;
    supervisionName: string;
    supervisionPriceHt: number;
    /** Véhicules supervisés comptés dans le calcul. */
    supervisedVehicles: number;
    supervisionAdvantages: string;
  };
  quote: { text: string; author: string };
  show: { recharge: boolean; why: boolean; glossary: boolean; annex: boolean; method: boolean };
};

const pad = (n: number) => String(n).padStart(2, "0");

export function defaultPropositionFlotte(): PropositionFlotteConfig {
  const d = new Date();
  return {
    title: "Électrifier votre flotte,\nsans la complexité",
    subtitle: "Véhicules électriques, borne à domicile supervisée et financement LLD négocié, avec un interlocuteur unique.",
    reference: `BEEV-${d.getFullYear()}-${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`,
    dateLabel: d.toLocaleDateString("fr-FR"),
    validityDays: 30,
    advisorName: "",
    advisorEmail: "",
    advisorPhone: "",
    borne: {
      enabled: true,
      inSavings: true,
      chargerId: "",
      name: "V2C Trydan Pro",
      image: "",
      lines: [
        { label: "Monophasé 7,4 kW", priceHt: 1499 },
        { label: "Triphasé 11 kW", priceHt: 1799 },
      ],
      lineIndex: 0,
      count: 1,
      included: [
        "Étude technique du domicile",
        "Fourniture de la borne, câble Type 2 attaché",
        "Jusqu'à 10 m de câble depuis le tableau : 3G10 en monophasé, 5G10 en triphasé",
        "Protections dédiées au tableau",
        "Pose par un installateur certifié IRVE",
        "Mise en service et attestation de conformité",
      ].join("\n"),
      supervisionName: "Beev Home Connect",
      supervisionPriceHt: 15,
      supervisedVehicles: 1,
      supervisionAdvantages: [
        "Aucune borne connectée nécessaire : prise renforcée, borne existante ou V2C Trydan PRO",
        "Recharge certifiée par le compteur Linky et les données du véhicule",
        "Activation en quelques minutes par le collaborateur, sans intervention",
        "Remboursement au kWh réel, sans note de frais",
        "Justificatif mensuel prêt pour la paie, conforme URSSAF",
        "Données hébergées en France, sans géolocalisation",
      ].join("\n"),
    },
    quote: { text: "Beev nous a permis d'électrifier 30 véhicules en 2 mois, avec un interlocuteur unique et un suivi sans faille.", author: "DAF · ETI logistique" },
    show: { recharge: true, why: true, glossary: true, annex: true, method: true },
  };
}

// ── Données ───────────────────────────────────────────────────────────────
type Group = ReturnType<typeof buildGroups>[number];
export type FlotteGroup = {
  name: string;
  cur: TcoLine | null;
  best: TcoLine;
  alts: TcoLine[];
  /** Véhicules concernés (quantité de la flotte actuelle, sinon du recommandé). */
  qty: number;
  today: number;
  beev: number;
  saving: number;
};

const qtyOf = (l: TcoLine) => Math.max(1, Math.round(l.sv.quantity || 1));

export function analyseFlotte(selection: SelectedVehicle[], e: EnergyParams) {
  const { lines, skipped } = analyseSelection(selection, e);
  const groups: FlotteGroup[] = buildGroups(lines).map((g: Group) => {
    const props = [...g.props].sort((a, b) => a.tco - b.tco);
    const best = props[0];
    const qty = g.cur ? qtyOf(g.cur) : qtyOf(best);
    const today = g.cur ? g.cur.tco * qty : 0;
    const beev = best.tco * qty;
    // 4 lignes au plus par page : actuel + recommandé + 2 alternatives, ou recommandé + 3.
    return { name: g.name, cur: g.cur, best, alts: props.slice(1, g.cur ? 3 : 4), qty, today, beev, saving: g.cur ? today - beev : 0 };
  });
  return { lines, skipped, groups, compared: groups.filter((g) => g.cur) };
}

/** Coût de l'offre borne compté dans l'économie (HT, une seule fois). */
export function borneCost(cfg: PropositionFlotteConfig, months: number): { pose: number; supervision: number; total: number } {
  const b = cfg.borne;
  if (!b.enabled || !b.inSavings) return { pose: 0, supervision: 0, total: 0 };
  const line = b.lines[b.lineIndex] ?? b.lines[0];
  const pose = (line?.priceHt ?? 0) * Math.max(0, b.count);
  const supervision = b.supervisionPriceHt * Math.max(0, b.supervisedVehicles) * months;
  return { pose, supervision, total: pose + supervision };
}

// ── Mise en forme ─────────────────────────────────────────────────────────
const fmt = (n: number, d = 0) =>
  nbsp(new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.round(n * 10 ** d) / 10 ** d));
const eur = (n: number) => `${fmt(n)} €`;
const eur2 = (n: number) => `${fmt(n, 2)} €`;
const MINUS = "−";
const signed = (n: number) => `${n < 0 ? MINUS : "+"}${eur(Math.abs(n))}`;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const lines2 = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

const abs = (url: string): string => {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
};

const photo = (v: { image?: string; brand: string; model: string }, cls: string) =>
  v.image
    ? `<img class="${cls}" src="${esc(abs(v.image))}" alt="${esc(displayName(v))}" onerror="this.style.visibility='hidden'" />`
    : `<div class="${cls} noimg"></div>`;

const isEv = (v: Vehicle) => v.energy === "Électrique";
const nameOf = (l: TcoLine) => displayName(l.sv.vehicle);
const fiscal = (l: TcoLine) => l.tco - l.r.loyerTotal - l.r.coutEnergie;
const kmAn = (l: TcoLine) => Math.round(l.sv.kmPerYear || 0);
const contractTxt = (l: TcoLine) => `${l.months} mois${kmAn(l) ? ` · ${fmt(kmAn(l))} km/an` : ""}`;
/** « l'E-5008 » / « le Santa-Fe » : article devant un nom de modèle. */
const theModel = (l: TcoLine) => {
  const m = displayName({ brand: "", model: l.sv.vehicle.model }).trim() || nameOf(l);
  return /^[aeiouyhéèêàâîôûAEIOUYHÉÈ]/.test(m) ? `l'${m}` : `le ${m}`;
};
const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Section = "Synthèse" | "Véhicules" | "Recharge" | "Pourquoi Beev" | "Annexes";
const SECTIONS: Section[] = ["Synthèse", "Véhicules", "Recharge", "Pourquoi Beev", "Annexes"];

type Ctx = {
  cfg: PropositionFlotteConfig;
  assets?: AuditAssets;
  clientName: string;
  sections: Section[];
};

const logo = (ctx: Ctx, light: boolean) => {
  const url = light ? ctx.assets?.logoLight : ctx.assets?.logoDark;
  return url ? `<img class="logo" src="${url}" alt="Beev" />` : `<span class="logo wordmark">Beev</span>`;
};

function frame(ctx: Ctx, n: number, total: number, section: Section, note: string, inner: string, dark = false): string {
  const nav = ctx.sections.map((s) => `<span class="${s === section ? "on" : ""}">${esc(s)}</span>`).join("");
  return `<section class="${dark ? "dark" : ""}">
    ${inner}
    <div class="foot"><div class="nav">${nav}</div><div class="fnote">${note}</div><div class="pg">${n} / ${total}</div></div>
  </section>`;
}

// ── Slides ────────────────────────────────────────────────────────────────
function coverSlide(ctx: Ctx): string {
  const c = ctx.cfg;
  const by = [c.advisorName, c.advisorEmail].filter(Boolean).join(" · ") || "Beev";
  return `<section class="dark cover">
    ${logo(ctx, true)}
    <div class="cover-kicker">Proposition commerciale · Flotte véhicules</div>
    ${ctx.clientName ? `<div class="cover-pill">${esc(ctx.clientName)}</div>` : ""}
    <h1>${lines2(c.title).map(esc).join("<br/>")}</h1>
    <p class="cover-sub">${esc(c.subtitle)}</p>
    <div class="cover-meta">
      <div><span>Préparée pour</span><b>${esc(ctx.clientName || "—")}</b></div>
      <div><span>Préparée par</span><b>${esc(by)}</b></div>
      <div><span>Devis ${esc(c.reference)} · ${esc(c.dateLabel)}</span><b>Valable ${c.validityDays} jours</b></div>
    </div>
  </section>`;
}

function essentialSlide(ctx: Ctx, n: number, t: number, a: Totals): string {
  const max = Math.max(a.today, a.beev, 1);
  const wBeev = (a.beev / max) * 100;
  const props = a.compared.map((g) => g.best);
  const curs = a.compared.map((g) => g.cur!);
  const nbVeh = a.compared.reduce((s, g) => s + g.qty, 0);
  const allEv = props.every((p) => isEv(p.sv.vehicle));
  const list = (ls: TcoLine[]) => {
    const names = [...new Set(ls.map(nameOf))];
    return names.length <= 3 ? names.join(names.length === 2 ? " et " : ", ").replace(/, ([^,]*)$/, " et $1") : `${names.length} modèles`;
  };
  const b = ctx.cfg.borne;
  const facts = [
    `<div class="fact"><b>${nbVeh} véhicule${nbVeh > 1 ? "s" : ""}${allEv ? ` électrique${nbVeh > 1 ? "s" : ""}` : ""}</b><p>${esc(list(props))} remplace${props.length > 1 ? "nt" : ""} ${esc(list(curs))}</p></div>`,
    b.enabled
      ? `<div class="fact"><b>${b.count} borne${b.count > 1 ? "s" : ""} à domicile</b><p>${esc(b.name)} posée${b.count > 1 ? "s" : ""} et supervisée${b.count > 1 ? "s" : ""}${b.inSavings ? ", comprise dans le calcul" : ""}</p></div>`
      : `<div class="fact"><b>Coût complet</b><p>Loyers, énergie et fiscalité comparés véhicule par véhicule</p></div>`,
    `<div class="fact"><b>1 seul interlocuteur</b><p>Beev coordonne loueur, installateur et supervision</p></div>`,
  ].join("");
  const perMonth = a.months > 0 ? Math.round(a.saving / a.months / 50) * 50 : 0;
  const lower = a.saving >= 0;
  return frame(ctx, n, t, "Synthèse", `Montants TTC arrondis${b.enabled && b.inSavings ? " · borne et supervision HT (TVA récupérable)" : ""}`, `
    <div class="kicker">L'essentiel</div>
    <h2>${lower ? `Avec Beev, votre flotte coûte<br/>${pct(a.saving, a.today)} % de moins` : "Avec Beev, le coût complet de votre flotte"}</h2>
    <p class="lede">Même usage, même kilométrage. Coût complet employeur sur la durée des contrats : loyers, énergie, fiscalité${b.enabled && b.inSavings ? " et recharge à domicile" : ""}.</p>
    <div class="ess">
      <div class="bars">
        <div class="brow"><div class="bl"><span>Aujourd'hui</span><b>${eur(a.today)}</b></div><div class="bar dark" style="width:100%"></div></div>
        <div class="brow"><div class="bl" style="width:${Math.max(wBeev, 30)}%"><span>Avec Beev</span><b>${eur(a.beev)}</b></div>
          <div class="bar-wrap"><div class="bar rose" style="width:${wBeev}%"></div>${lower ? `<div class="bar gap" style="width:${100 - wBeev}%"><b>${signed(-a.saving)}</b></div>` : ""}</div></div>
      </div>
      <div class="savebox"><span>${lower ? "Économie totale" : "Écart total"}</span><b>${eur(Math.abs(a.saving))}</b><p>sur la durée des contrats${perMonth > 0 ? `, soit environ ${eur(perMonth)} TTC par mois` : ""}</p></div>
    </div>
    <div class="facts">${facts}</div>`);
}

type Row = { k: string; sub: string; cur: number; beev: number };
function groupCard(g: FlotteGroup, i: number): string {
  const c = g.cur!, b = g.best, q = g.qty;
  const rows: Row[] = [
    { k: "Loyers", sub: "loyer mensuel TTC × durée", cur: c.r.loyerTotal * q, beev: b.r.loyerTotal * q },
    { k: "Énergie", sub: "carburant / électricité", cur: c.r.coutEnergie * q, beev: b.r.coutEnergie * q },
    { k: "Fiscalité", sub: "TVS, AND, AEN", cur: fiscal(c) * q, beev: fiscal(b) * q },
  ];
  const max = Math.max(...rows.flatMap((r) => [r.cur, r.beev]), 1);
  const bar = (v: number, cls: string) => `<div class="mbar ${cls}" style="width:${Math.max(2, (v / max) * 100)}%"></div>`;
  const delta = (d: number) => `<span class="dpill ${d <= 0 ? "neg" : "pos"}">${signed(d)}</span>`;
  return `<div class="gcard">
    <div class="gk">Groupe ${i + 1} · ${q} véhicule${q > 1 ? "s" : ""}</div>
    <div class="gt">${esc(nameOf(c))} → ${esc(nameOf(b))}</div>
    <div class="gloyer"><span class="lk">Loyer</span>
      <div><b>${eur2(c.sv.negotiatedMonthly || 0)}</b> TTC / mois<small>${esc(contractTxt(c))}</small></div><i>→</i>
      <div><b>${eur2(b.sv.negotiatedMonthly)}</b> TTC / mois<small>${esc(contractTxt(b))}</small></div></div>
    <table class="gt2"><thead><tr><th></th><th>Aujourd'hui</th><th>Avec Beev</th><th class="r">Écart</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><b>${r.k}</b><small>${r.sub}</small></td><td>${eur(r.cur)}${bar(r.cur, "dark")}</td><td>${eur(r.beev)}${bar(r.beev, "rose")}</td><td class="r">${delta(r.beev - r.cur)}</td></tr>`).join("")}
      <tr class="tot"><td><b>Coût complet TTC</b></td><td><b>${eur(g.today)}</b></td><td><b>${eur(g.beev)}</b></td><td class="r"><span class="dpill total">${signed(g.beev - g.today)}</span></td></tr>
    </tbody></table>
  </div>`;
}

function originSlides(ctx: Ctx, a: Totals, start: number, total: number): string[] {
  const out: string[] = [];
  const PER = 2;
  const b = ctx.cfg.borne;
  for (let i = 0; i < a.compared.length; i += PER) {
    const chunk = a.compared.slice(i, i + PER);
    const last = i + PER >= a.compared.length;
    const ex = a.compared[0];
    const totalLabel = [...a.compared.map((_, k) => `groupe ${k + 1}`), ...(a.borne.total > 0 ? ["borne"] : [])].join(" + ");
    const bottom = last ? `<div class="obottom">
      <div><b>Loyers, comment ils sont calculés</b><p>Loyer mensuel TTC × durée du contrat.<br/>${esc(nameOf(ex.cur!))} : ${eur2(ex.cur!.sv.negotiatedMonthly || 0)} TTC × ${ex.cur!.months} mois.<br/>${esc(nameOf(ex.best))} : ${eur2(ex.best.sv.negotiatedMonthly)} TTC × ${ex.best.months} mois.</p></div>
      ${a.borne.total > 0 ? `<div><b>Borne à domicile, commune à la flotte</b><p>Forfait de pose et ${esc(b.supervisionName)} : +${eur(a.borne.total)}, ajoutés une seule fois.</p></div>` : "<div></div>"}
      <div class="obox"><span>${esc(cap1(totalLabel))}</span><b>${signed(-a.saving)}</b></div>
    </div>` : "";
    out.push(frame(ctx, start + out.length, total, "Synthèse", "Montants TTC", `
      <div class="kicker">D'où vient l'économie</div>
      <h2 class="one">${esc(originTitle(a))}</h2>
      <div class="ogrid${chunk.length === 1 ? " single" : ""}">${chunk.map((g, k) => groupCard(g, i + k)).join("")}</div>
      ${bottom}`));
  }
  return out;
}

function originTitle(a: Totals): string {
  const sum = (f: (g: FlotteGroup) => number) => a.compared.reduce((s, g) => s + f(g), 0);
  const dL = sum((g) => (g.best.r.loyerTotal - g.cur!.r.loyerTotal) * g.qty);
  const dE = sum((g) => (g.best.r.coutEnergie - g.cur!.r.coutEnergie) * g.qty);
  const dF = sum((g) => (fiscal(g.best) - fiscal(g.cur!)) * g.qty);
  if (dL > -Math.max(Math.abs(dE), Math.abs(dF)) / 3) return "L'économie vient de l'énergie et de la fiscalité, pas du loyer";
  const parts = [["du loyer", dL], ["de l'énergie", dE], ["de la fiscalité", dF]].filter(([, v]) => (v as number) < 0).sort((x, y) => (x[1] as number) - (y[1] as number)).map(([k]) => k as string);
  return parts.length ? `L'économie vient ${parts.join(", ").replace(/, ([^,]*)$/, " et $1")}` : "Le détail, poste par poste";
}

function stackBar(l: TcoLine, max: number): string {
  const w = (v: number) => `${Math.max(0, (v / max) * 100)}%`;
  return `<div class="stack"><i class="s1" style="width:${w(l.r.loyerTotal)}"></i><i class="s2" style="width:${w(l.r.coutEnergie)}"></i><i class="s3" style="width:${w(Math.max(0, fiscal(l)))}"></i></div>`;
}

function explain(g: FlotteGroup): string[] {
  const c = g.cur!, b = g.best;
  const dF = (fiscal(b) - fiscal(c)) * g.qty, dE = (b.r.coutEnergie - c.r.coutEnergie) * g.qty, dL = (b.r.loyerTotal - c.r.loyerTotal) * g.qty;
  const fis = (() => {
    const p: string[] = [];
    if (c.r.tvsTotal > 0 && b.r.tvsTotal === 0) p.push("plus de TVS");
    if (c.r.coutFiscalANDTotal > 0 && b.r.coutFiscalANDTotal === 0) p.push("plus d'AND");
    if (b.r.aenEmployeurTotal < c.r.aenEmployeurTotal) p.push(isEv(b.sv.vehicle) ? "un avantage en nature réduit de 70 %" : "un avantage en nature plus faible");
    if (dF > 0) return `${cap1(theModel(b))} supporte davantage de charges fiscales que ${theModel(c)}.`;
    return p.length ? `${cap1(p.join(", ").replace(/, ([^,]*)$/, " et $1"))}.` : `Moins de charges fiscales que ${theModel(c)}.`;
  })();
  const conso = c.sv.vehicle.consumptionThermal ?? c.sv.vehicle.consumption;
  const ene = dE > 0
    ? `L'énergie de ${theModel(b)} coûte plus cher sur la durée du contrat.`
    : !isEv(c.sv.vehicle) && isEv(b.sv.vehicle)
      ? `${cap1(theModel(c))}${conso ? ` consomme ${fmt(conso, 1)} L/100 km` : " roule au carburant"} ; ${theModel(b)} se recharge surtout à domicile.`
      : "L'électricité coûte moins cher que le carburant au kilomètre.";
  const loy = dL <= 0 ? "Moins cher que le contrat actuel, entretien et assistance inclus."
    : dE + dF < -dL ? "Un loyer plus élevé, largement compensé par les deux postes précédents." : "Un loyer plus élevé que le contrat actuel.";
  return ([["Fiscalité", dF, fis], ["Énergie", dE, ene], ["Loyer", dL, loy]] as Array<[string, number, string]>)
    .sort((x, y) => x[1] - y[1])
    .map(([k, d, txt]) => `<div class="ex"><p><b>${k} ${signed(d)}.</b> ${esc(txt)}</p></div>`);
}

function vehicleSlide(ctx: Ctx, n: number, t: number, g: FlotteGroup, idx: number, count: number): string {
  const rowsL: Array<{ l: TcoLine; label: string; cls: string }> = [
    ...(g.cur ? [{ l: g.cur, label: "Aujourd'hui", cls: "" }] : []),
    { l: g.best, label: g.cur ? "Recommandé" : "Proposition", cls: "reco" },
    ...g.alts.map((l) => ({ l, label: "Alternative", cls: "" })),
  ];
  const max = Math.max(...rowsL.map((r) => r.l.tco), 1);
  const sub = (l: TcoLine) => (isEv(l.sv.vehicle) && l.sv.vehicle.rangeWltp > 0 ? `${fmt(l.sv.vehicle.rangeWltp)} km d'autonomie` : `${l.months} mois`);
  const right = (l: TcoLine) => {
    if (!g.cur) {
      if (l === g.best) return `<b>${eur(l.tco * g.qty)}</b><span class="ref">meilleur coût</span>`;
      return `<b>${eur(l.tco * g.qty)}</b><span class="dpill outline">${signed((l.tco - g.best.tco) * g.qty)}</span>`;
    }
    if (l === g.cur) return `<b>${eur(l.tco * g.qty)}</b><span class="ref">référence</span>`;
    const d = (l.tco - g.cur.tco) * g.qty;
    return `<b>${eur(l.tco * g.qty)}</b><span class="dpill ${l === g.best ? "neg" : "outline"}">${signed(d)}</span>`;
  };
  const rows = rowsL.map(({ l, label, cls }) => `<div class="vrow ${cls}">
      ${photo(l.sv.vehicle, "vph")}
      <div class="vinfo"><span>${label}</span><b>${esc(nameOf(l))}</b><div class="ppill"><b>${eur2(l.sv.negotiatedMonthly || 0)}</b> TTC / mois</div><small>${esc(sub(l))}</small></div>
      ${stackBar(l, max)}
      <div class="vright">${right(l)}</div>
    </div>`).join("");
  const title = g.cur
    ? `${nameOf(g.best)} : ${eur(Math.max(0, g.saving))} économisés, soit ${MINUS}${pct(g.saving, g.today)} %`
    : rowsL.length > 1 ? `${nameOf(g.best)} : le coût complet le plus bas, ${eur(g.beev)}` : `${nameOf(g.best)} : ${eur(g.beev)} de coût complet`;
  const kicker = g.cur
    ? `Véhicule ${idx + 1} sur ${count} · remplace ${nameOf(g.cur)}`
    : `${count > 1 ? `Groupe ${idx + 1} sur ${count}` : "Votre sélection"}${g.name && g.name !== "Votre flotte" ? ` · ${g.name}` : ""}`;
  return frame(ctx, n, t, "Véhicules", "Montants TTC · détail chiffré en annexe", `
    <div class="kicker">${esc(kicker)}</div>
    <h2 class="one">${esc(title)}</h2>
    <div class="legend"><b>Coût complet sur la durée du contrat</b><i class="s1"></i>Loyers<i class="s2"></i>Énergie<i class="s3"></i>Fiscalité</div>
    <div class="vrows n${rowsL.length}">${rows}</div>
    ${g.cur && g.saving > 0 ? `<div class="exs">${explain(g).join("")}</div>` : ""}`);
}

function rechargeSlide(ctx: Ctx, n: number, t: number, a: Totals): string {
  const b = ctx.cfg.borne;
  const line = b.lines[b.lineIndex] ?? b.lines[0];
  const counted = b.inSavings && a.compared.length > 0;
  return frame(ctx, n, t, "Recharge", "Loyers TTC · borne et supervision HT, TVA récupérable", `
    <div class="kicker">Recharge à domicile</div>
    <h2 class="one">Une borne posée au forfait et une supervision sans matériel${counted ? ",<br/>déjà comptées dans l'économie" : ""}</h2>
    <div class="rgrid">
      <div class="rphoto">${b.image ? `<img src="${esc(abs(b.image))}" alt="${esc(b.name)}" onerror="this.style.visibility='hidden'" />` : ""}</div>
      <div class="rcard rose">
        <span class="rk">Borne · installation comprise</span><b class="rn">${esc(b.name)}</b>
        <div class="rlines">${b.lines.map((l) => `<div><span>${esc(l.label)}</span><b>${eur(l.priceHt)} HT</b></div>`).join("")}</div>
        <b class="rsub">Le forfait d'installation comprend</b>
        <ul>${lines2(b.included).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
      <div class="rcard dark">
        <span class="rk">Supervision</span><b class="rn">${esc(b.supervisionName)}</b>
        <div class="rlines"><div><span>Par véhicule et par mois</span><b>${eur(b.supervisionPriceHt)} HT</b></div></div>
        <b class="rsub">Les avantages</b>
        <ul>${lines2(b.supervisionAdvantages).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
    </div>
    <div class="rfoot"><span>${esc(line?.label ?? "Borne")} + ${esc(b.supervisionName)}${counted ? `, comptées dans l'économie de ${eur(Math.max(0, a.saving))}` : ""}</span><b>${eur(line?.priceHt ?? 0)} HT + ${eur(b.supervisionPriceHt)} HT / mois</b></div>`);
}

function whySlide(ctx: Ctx, n: number, t: number): string {
  const c = ctx.cfg;
  const contact = [c.advisorName, c.advisorEmail, c.advisorPhone].filter(Boolean).map(esc).join(" · ");
  const cards: Array<[string, string]> = [
    ["Un coût complet, pas un loyer", "Loyers, énergie et fiscalité comparés à votre flotte actuelle, véhicule par véhicule."],
    ["Des loyers mis en concurrence", "Ayvens, Arval, BPCE, Alphabet, Agilauto, VW Bank et tarifs grand compte constructeurs."],
    ["L'essentiel inclus", "Maintenance, assistance 24/24 et garantie perte financière dans chaque loyer."],
    ["Bornes et Fleet Manager", "Installation au bureau et à domicile, et le logiciel de suivi de votre flotte."],
  ];
  return frame(ctx, n, t, "Pourquoi Beev", contact, `
    <div class="kicker">Pourquoi Beev</div>
    <h2 class="one">Un seul interlocuteur pour les véhicules, les bornes et le suivi</h2>
    <div class="wgrid">${cards.map(([k, v]) => `<div class="wcard"><b>${esc(k)}</b><p>${esc(v)}</p></div>`).join("")}</div>
    ${c.quote.text.trim() ? `<div class="wquote"><p>« ${esc(c.quote.text.trim())} »</p><span>${esc(c.quote.author)}</span></div>` : ""}`, true);
}

function glossarySlide(ctx: Ctx, n: number, t: number): string {
  const items: Array<[string, string]> = [
    ["LLD", "Location longue durée. Un loyer mensuel fixe, sans achat du véhicule."],
    ["Coût complet", "Tout ce que le véhicule coûte à l'entreprise : loyers, énergie, taxes et charges."],
    ["TVS", "Taxe annuelle sur les véhicules de société. 0 € pour un électrique."],
    ["Malus", "Taxe à l'immatriculation liée au CO2 et au poids."],
    ["AND", "Amortissement non déductible. La part du prix au-dessus du plafond fiscal augmente l'impôt."],
    ["AEN", "Avantage en nature. L'usage perso du véhicule, soumis à charges sociales. −70 % en électrique."],
    ["WLTP", "Norme européenne de mesure de l'autonomie et de la consommation."],
    ["Supervision", "Suivi à distance des recharges, pour rembourser et piloter les coûts."],
  ];
  return frame(ctx, n, t, "Annexes", "Barèmes fiscaux 2026", `
    <div class="kicker">Glossaire</div>
    <h2 class="one">Les termes du document, en clair</h2>
    <div class="ggrid">${items.map(([k, v]) => `<div class="gl"><b>${esc(k)}</b><p>${esc(v)}</p></div>`).join("")}</div>`);
}

function annexSlides(ctx: Ctx, a: Totals, start: number, total: number): string[] {
  type Col = { l: TcoLine; role: string; hl: boolean; ref: TcoLine | null };
  const cols: Col[] = [];
  for (const g of a.groups) {
    if (g.cur) cols.push({ l: g.cur, role: "actuel", hl: false, ref: null });
    cols.push({ l: g.best, role: g.cur ? "recommandé" : "proposé", hl: true, ref: g.cur });
    for (const x of g.alts) cols.push({ l: x, role: "alternative", hl: false, ref: g.cur });
  }
  const PER = 5;
  const out: string[] = [];
  for (let i = 0; i < cols.length; i += PER) {
    const cs = cols.slice(i, i + PER);
    const short = (l: TcoLine) => displayName({ brand: "", model: l.sv.vehicle.model }).trim() || nameOf(l);
    const row = (k: string, f: (c: Col) => string, cls = "") => `<tr class="${cls}"><th>${k}</th>${cs.map((c) => `<td class="${c.hl ? "hl" : ""}">${f(c)}</td>`).join("")}</tr>`;
    const hasMalus = cs.some((c) => c.l.r.malusCO2 + c.l.r.malusPoids > 0);
    out.push(frame(ctx, start + out.length, total, "Annexes", "Montants TTC · hors borne et supervision", `
      <div class="kicker">Annexe · Détail chiffré</div>
      <h2 class="one">Tous les chiffres, véhicule par véhicule</h2>
      <table class="annex"><thead><tr><th></th>${cs.map((c) => `<th class="${c.hl ? "hl" : ""}"><b>${esc(short(c.l))}</b><span>${esc(c.role)}</span></th>`).join("")}</tr></thead><tbody>
        ${row("Version", (c) => esc(c.l.version || "—"))}
        ${row("Loyer mensuel TTC", (c) => eur2(c.l.sv.negotiatedMonthly || 0))}
        ${row("Durée · km/an", (c) => `${c.l.months} m · ${fmt(kmAn(c.l))}`)}
        ${row("<b>Loyers</b>", (c) => eur(c.l.r.loyerTotal))}
        ${row("<b>Énergie</b>", (c) => eur(c.l.r.coutEnergie))}
        ${row("dont TVS", (c) => eur(c.l.r.tvsTotal))}
        ${hasMalus ? row("dont malus", (c) => eur(c.l.r.malusCO2 + c.l.r.malusPoids)) : ""}
        ${row("dont AND (25 %)", (c) => eur(c.l.r.coutFiscalANDTotal))}
        ${row("dont charges sur AEN", (c) => eur(c.l.r.aenEmployeurTotal))}
        ${row("<b>Fiscalité</b>", (c) => eur(fiscal(c.l)))}
        ${row("<b>Coût complet TTC</b>", (c) => `<b>${eur(c.l.tco)}</b>`, "tot")}
        ${row("Écart", (c) => (c.ref ? `${signed(c.l.tco - c.ref.tco)} · ${MINUS}${pct(c.ref.tco - c.l.tco, c.ref.tco)} %`.replace(`${MINUS}-`, "+") : "·"))}
        ${row("Autonomie WLTP", (c) => (c.l.sv.vehicle.rangeWltp > 0 ? `${fmt(c.l.sv.vehicle.rangeWltp)} km` : "·"))}
        ${row("AEN collaborateur / mois", (c) => eur(c.l.r.aenMensuel))}
      </tbody></table>`));
  }
  return out;
}

function methodSlide(ctx: Ctx, n: number, t: number, a: Totals, e: EnergyParams): string {
  const ex = a.compared[0]?.cur ?? a.groups[0]?.best;
  if (!ex) return "";
  const v = ex.sv.vehicle;
  const years = ex.months / 12;
  const km = Math.round((ex.sv.kmPerYear || 0) * years);
  const conso = isEv(v) ? (v.consumptionElec ?? v.consumption) : (v.consumptionThermal ?? v.consumption);
  const eneRule = isEv(v)
    ? `Consommation × km × prix (${fmt(e.mixHomePct)} % domicile, ${fmt(100 - e.mixHomePct)} % public)`
    : `Consommation × km × prix du carburant (${fmt(e.fuelPriceL, 2)} €/L)`;
  const rows: Array<[string, string, string, number]> = [
    ["Loyers", "Loyer mensuel TTC × nombre de mois", `${eur(ex.sv.negotiatedMonthly || 0)} TTC × ${ex.months} mois`, ex.r.loyerTotal],
    ["Énergie", eneRule, `${fmt(conso || 0, 1)} ${isEv(v) ? "kWh" : "L"}/100 km × ${fmt(km)} km`, ex.r.coutEnergie],
    ["TVS", "Barème 2026", `sur ${fmt(years, years % 1 ? 1 : 0)} an${years > 1 ? "s" : ""}`, ex.r.tvsTotal],
    ...(ex.r.malusCO2 + ex.r.malusPoids > 0 ? [["Malus", "Barème 2026 (CO2 et poids)", "à l'immatriculation", ex.r.malusCO2 + ex.r.malusPoids] as [string, string, string, number]] : []),
    ["AND", "25 % de (prix − plafond) ÷ 5 ans, chaque année", `${eur(ex.r.coutFiscalANDAnnuel)} × ${fmt(years, years % 1 ? 1 : 0)} ans`, ex.r.coutFiscalANDTotal],
    ["Charges sur AEN", "Part employeur de l'avantage en nature", `${eur(ex.r.partEmployeurAnnuelle)} × ${fmt(years, years % 1 ? 1 : 0)} ans`, ex.r.aenEmployeurTotal],
  ];
  const cards: Array<[string, string, string]> = [
    ["TVS", "0 €", "Électriques exonérés"],
    ["Malus", "0 €", "Aucun malus à l'achat"],
    ["AND, plafond relevé", "25 %", "Seul le surcoût d'impôt compte"],
    ["Avantage en nature", "−70 %", "Abattement électrique"],
    ["TVA sur la recharge", "100 %", "Récupérable"],
  ];
  return frame(ctx, n, t, "Annexes", "Sources : CGI, barèmes 2026 · estimations à confirmer par votre expert-comptable", `
    <div class="kicker">Annexe · Méthode</div>
    <h2 class="one">Comment le coût complet est calculé</h2>
    <p class="lede sm">Exemple : ${esc(nameOf(ex))}${ex.version ? ` ${esc(ex.version)}` : ""}</p>
    <table class="method"><tbody>
      ${rows.map(([k, rule, calc, val]) => `<tr><th>${k}</th><td>${esc(rule)}</td><td>${esc(calc)}</td><td class="r">${eur(val)}</td></tr>`).join("")}
      <tr class="tot"><th>Coût complet TTC</th><td></td><td></td><td class="r"><b>${eur(ex.tco)}</b></td></tr>
    </tbody></table>
    <div class="mk">Ce que l'électrique change</div>
    <div class="mcards">${cards.map(([k, v, s]) => `<div class="mc"><span>${k}</span><b>${v}</b><p>${s}</p></div>`).join("")}</div>`);
}

// ── Assemblage ────────────────────────────────────────────────────────────
type Totals = ReturnType<typeof analyseFlotte> & { today: number; beev: number; saving: number; months: number; borne: ReturnType<typeof borneCost> };

export type PropositionFlotteInput = { cfg: PropositionFlotteConfig; selection: SelectedVehicle[]; energy: EnergyParams; clientName: string };

export function buildPropositionFlotteHtml(input: PropositionFlotteInput, fonts?: RoobertFonts, assets?: AuditAssets): string {
  const { cfg, energy: e } = input;
  const base = analyseFlotte(input.selection, e);
  const months = Math.max(0, ...base.compared.map((g) => g.best.months), ...base.groups.map((g) => g.best.months));
  const borne = base.compared.length ? borneCost(cfg, months) : { pose: 0, supervision: 0, total: 0 };
  const today = base.compared.reduce((s, g) => s + g.today, 0);
  const beev = base.compared.reduce((s, g) => s + g.beev, 0) + borne.total;
  const a: Totals = { ...base, today, beev, saving: today - beev, months, borne };

  const showRecharge = cfg.borne.enabled && cfg.show.recharge;
  const sections = SECTIONS.filter((s) => (s === "Synthèse" ? a.compared.length > 0 : s === "Recharge" ? showRecharge : s === "Pourquoi Beev" ? cfg.show.why : s === "Annexes" ? cfg.show.glossary || cfg.show.annex || cfg.show.method : true));
  const ctx: Ctx = { cfg, assets, clientName: input.clientName, sections };

  const builders: Array<(n: number, t: number) => string> = [() => coverSlide(ctx)];
  if (a.compared.length) {
    builders.push((n, t) => essentialSlide(ctx, n, t, a));
    const count = originSlides(ctx, a, 0, 0).length;
    for (let i = 0; i < count; i++) builders.push((n, t) => originSlides(ctx, a, n - i, t)[i]);
  }
  a.groups.forEach((g, i) => builders.push((n, t) => vehicleSlide(ctx, n, t, g, i, a.groups.length)));
  if (showRecharge) builders.push((n, t) => rechargeSlide(ctx, n, t, a));
  if (cfg.show.why) builders.push((n, t) => whySlide(ctx, n, t));
  if (cfg.show.glossary) builders.push((n, t) => glossarySlide(ctx, n, t));
  if (cfg.show.annex && a.groups.length) {
    const count = annexSlides(ctx, a, 0, 0).length;
    for (let i = 0; i < count; i++) builders.push((n, t) => annexSlides(ctx, a, n - i, t)[i]);
  }
  if (cfg.show.method && a.groups.length) builders.push((n, t) => methodSlide(ctx, n, t, a, e));

  const total = builders.length;
  const slides = builders.map((b, i) => `<div class="slide">${b(i + 1, total)}</div>`).join("\n");

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" />
<title>Proposition ${esc(input.clientName)} × Beev</title>
<style>
${fontFaceCss(fonts)}
:root{
  --ink:#1E1E1E; --bg:#F9F7F2; --card:#FFFFFF; --line:#E4E0D6; --muted:#6E6B66; --soft:#F1EFF1;
  --rose:#EBB8AA; --blue:#A8CDFB; --reco:#E6F0FC;
  --font:'Roobert','Inter',-apple-system,BlinkMacSystemFont,sans-serif; --s:.62;
}
*{box-sizing:border-box;} html,body{margin:0;padding:0;}
section{position:relative;width:1920px;height:1080px;padding:0 120px;overflow:hidden;font-family:var(--font);background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;}
section.dark{background:var(--ink);color:#F7F5F0;}
b{font-weight:600;}
.logo{position:absolute;top:92px;left:120px;height:58px;width:auto;} .wordmark{font-size:56px;font-weight:700;}
.kicker{position:absolute;top:82px;left:120px;font-size:22px;font-weight:500;}
h2{position:absolute;top:120px;left:120px;right:120px;margin:0;font-size:68px;line-height:1.06;font-weight:600;letter-spacing:-.025em;}
h2.one{font-size:56px;}
.lede{position:absolute;top:288px;left:120px;right:520px;margin:0;font-size:27px;line-height:1.4;}
.lede.sm{top:196px;font-size:23px;color:var(--muted);}
.foot{position:absolute;left:120px;right:120px;bottom:44px;padding-top:22px;border-top:1.5px solid var(--line);display:flex;align-items:center;gap:24px;font-size:19px;}
section.dark .foot{border-color:#444;}
.nav{display:flex;gap:26px;color:var(--muted);} .nav .on{color:var(--ink);font-weight:600;text-decoration:underline;text-underline-offset:8px;}
section.dark .nav{color:#9a978f;} section.dark .nav .on{color:#fff;}
.fnote{flex:1;text-align:center;} .pg{min-width:80px;text-align:right;}
/* couverture */
.cover-kicker{position:absolute;top:118px;right:120px;font-size:24px;}
.cover-pill{position:absolute;top:288px;left:120px;background:var(--rose);color:var(--ink);border-radius:99px;padding:10px 24px;font-size:22px;font-weight:500;}
.cover h1{position:absolute;top:360px;left:120px;margin:0;font-size:128px;line-height:1.03;font-weight:600;letter-spacing:-.03em;}
.cover-sub{position:absolute;top:676px;left:120px;width:1180px;margin:0;font-size:33px;line-height:1.4;}
.cover-meta{position:absolute;left:120px;right:120px;bottom:96px;padding-top:44px;border-top:1.5px solid #555;display:grid;grid-template-columns:1fr 1fr 1fr;font-size:24px;}
.cover-meta span{display:block;margin-bottom:12px;} .cover-meta b{font-weight:600;}
/* l'essentiel */
.ess{position:absolute;top:418px;left:120px;right:120px;display:grid;grid-template-columns:1fr 470px;gap:58px;align-items:center;}
.bars{display:flex;flex-direction:column;gap:42px;}
.bl{display:flex;justify-content:space-between;font-size:25px;margin-bottom:12px;} .bl b{font-size:26px;}
.bar{height:96px;border-radius:14px;} .bar.dark{background:var(--ink);} .bar.rose{background:var(--rose);border-radius:14px 0 0 14px;}
.bar-wrap{display:flex;height:96px;} .bar.gap{border:2px solid var(--ink);border-left:none;border-radius:0 14px 14px 0;display:flex;align-items:center;justify-content:center;font-size:30px;height:96px;}
.savebox{background:var(--rose);border-radius:34px;padding:40px 40px 44px;} .savebox span{font-size:23px;} .savebox b{display:block;font-size:96px;letter-spacing:-.035em;line-height:1.1;margin:10px 0;} .savebox p{margin:0;font-size:24px;line-height:1.35;}
.facts{position:absolute;left:120px;right:120px;top:770px;display:grid;grid-template-columns:repeat(3,1fr);gap:24px;}
.fact{border-top:2px solid var(--ink);padding-top:18px;} .fact b{font-size:32px;} .fact p{margin:8px 0 0;font-size:24px;line-height:1.35;}
/* d'où vient l'économie */
.ogrid{position:absolute;top:208px;left:120px;right:120px;display:grid;grid-template-columns:1fr 1fr;gap:26px;}
.ogrid.single{grid-template-columns:1fr;width:860px;}
.gcard{border:1.5px solid var(--line);border-radius:30px;padding:28px 34px 34px;background:var(--bg);}
.gk{font-size:21px;} .gt{font-size:31px;font-weight:600;margin:2px 0 14px;}
.gloyer{display:flex;align-items:center;gap:22px;background:#F2EEE6;border-radius:16px;padding:14px 20px;font-size:17px;}
.gloyer .lk{font-weight:600;font-size:18px;} .gloyer b{font-size:24px;} .gloyer small{display:block;font-size:16px;color:var(--muted);} .gloyer i{font-style:normal;font-size:24px;}
.gt2{width:100%;border-collapse:collapse;margin-top:16px;font-size:24px;}
.gt2 th{font-size:19px;font-weight:400;text-align:left;padding:8px 6px;border-bottom:1.5px solid var(--line);} .gt2 th.r,.gt2 td.r{text-align:right;}
.gt2 td{padding:14px 6px;border-bottom:1.5px solid var(--line);vertical-align:top;} .gt2 td small{display:block;font-size:16px;color:var(--muted);max-width:200px;}
.gt2 tr.tot td{border-bottom:none;border-top:2px solid var(--ink);font-size:26px;}
.mbar{height:10px;border-radius:6px;margin-top:10px;} .mbar.dark{background:var(--ink);} .mbar.rose{background:var(--rose);}
.dpill{display:inline-block;border-radius:99px;padding:8px 18px;font-size:23px;font-weight:600;white-space:nowrap;}
.dpill.neg{background:var(--rose);} .dpill.pos,.dpill.outline{border:2px solid var(--ink);} .dpill.total{background:var(--ink);color:#fff;font-size:25px;padding:12px 22px;}
.obottom{position:absolute;left:120px;right:120px;top:836px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:26px;align-items:start;}
.obottom b{font-size:22px;} .obottom p{margin:6px 0 0;font-size:21px;line-height:1.5;}
.obox{background:var(--rose);border-radius:24px;padding:22px 28px;} .obox span{font-size:22px;} .obox b{display:block;font-size:54px;margin-top:4px;}
/* page véhicule */
.legend{position:absolute;top:210px;left:120px;display:flex;align-items:center;gap:12px;font-size:21px;}
.legend b{margin-right:18px;} .legend i{display:inline-block;width:18px;height:18px;border-radius:5px;margin-left:16px;}
.s1{background:var(--ink);} .s2{background:var(--blue);} .s3{background:var(--rose);}
.vrows{position:absolute;top:262px;left:120px;right:120px;display:flex;flex-direction:column;gap:18px;}
.vrow{display:grid;grid-template-columns:270px 340px 1fr 240px;align-items:center;gap:28px;border:1.5px solid var(--line);border-radius:28px;padding:14px 30px;background:var(--bg);height:170px;}
.vrows.n2 .vrow{height:220px;} .vrows.n4 .vrow{height:132px;}
.vrow.reco{background:var(--reco);border-color:var(--reco);}
.vph{width:100%;height:140px;object-fit:contain;} .vrows.n2 .vph{height:190px;} .vrows.n4 .vph{height:104px;} .noimg{background:transparent;}
.vinfo span{font-size:20px;} .vinfo b{display:block;font-size:31px;line-height:1.15;} .vinfo small{display:block;font-size:19px;}
.vrows.n4 .vinfo b{font-size:27px;} .vrows.n4 .ppill{margin:3px 0;}
.ppill{display:inline-block;background:var(--ink);color:#fff;border-radius:12px;padding:6px 14px;margin:6px 0;font-size:18px;} .ppill b{display:inline;font-size:28px;}
.stack{display:flex;height:56px;} .stack i{display:block;height:100%;} .stack i:first-child{border-radius:12px 0 0 12px;} .stack i:last-child{border-radius:0 12px 12px 0;}
.vright{text-align:right;} .vright b{display:block;font-size:36px;} .vright .ref{font-size:20px;} .vright .dpill{font-size:20px;padding:5px 14px;margin-top:4px;}
.exs{position:absolute;left:120px;right:120px;top:836px;display:grid;grid-template-columns:repeat(3,1fr);gap:26px;}
.ex{border-top:2px solid var(--ink);padding-top:16px;} .ex p{margin:0;font-size:24px;line-height:1.4;}
/* recharge */
.rgrid{position:absolute;top:300px;left:120px;right:120px;display:grid;grid-template-columns:280px 1fr 1fr;gap:26px;height:600px;}
.rphoto{background:#F1E4E0;border-radius:18px;display:flex;align-items:center;justify-content:center;overflow:hidden;} .rphoto img{width:90%;max-height:80%;object-fit:contain;}
.rcard{border-radius:30px;padding:34px 38px;} .rcard.rose{background:var(--rose);} .rcard.dark{background:var(--ink);color:#fff;}
.rk{font-size:22px;} .rn{display:block;font-size:40px;margin:4px 0 18px;padding-bottom:16px;border-bottom:2px solid currentColor;}
.rlines div{display:flex;justify-content:space-between;font-size:25px;padding:12px 0;border-bottom:1px solid rgba(0,0,0,.18);} .rcard.dark .rlines div{border-color:rgba(255,255,255,.2);}
.rlines b{font-size:27px;} .rsub{display:block;font-size:23px;margin:20px 0 8px;}
.rcard ul{margin:0;padding:0;list-style:none;font-size:21px;line-height:1.45;} .rcard li:before{content:"· ";}
.rfoot{position:absolute;left:120px;right:120px;top:928px;padding-top:16px;border-top:2px solid var(--ink);display:flex;justify-content:space-between;font-size:27px;} .rfoot b{font-size:33px;}
/* pourquoi Beev */
.wgrid{position:absolute;top:232px;left:120px;right:120px;display:grid;grid-template-columns:1fr 1fr;gap:26px;}
.wcard{border:1.5px solid #555;border-radius:30px;padding:46px 40px;min-height:236px;} .wcard b{font-size:37px;} .wcard p{margin:10px 0 0;font-size:25px;line-height:1.45;color:#E5E2DC;}
.wquote{position:absolute;left:120px;right:120px;top:770px;background:var(--rose);color:var(--ink);border-radius:30px;padding:34px 46px;display:flex;justify-content:space-between;align-items:center;gap:40px;}
.wquote p{margin:0;font-size:31px;line-height:1.4;} .wquote span{font-size:22px;white-space:nowrap;}
/* glossaire */
.ggrid{position:absolute;top:232px;left:120px;right:120px;display:grid;grid-template-columns:repeat(4,1fr);gap:26px;}
.gl{background:var(--soft);border-radius:30px;padding:30px 34px;height:340px;} .gl b{font-size:44px;} .gl p{margin:10px 0 0;font-size:25px;line-height:1.45;}
/* annexe */
.annex{position:absolute;top:190px;left:120px;right:120px;width:calc(100% - 240px);border-collapse:separate;border-spacing:0;font-size:22px;}
.annex th{text-align:left;font-weight:400;padding:10px 14px;border-bottom:1.5px solid var(--line);white-space:nowrap;}
.annex thead th{border-bottom:2px solid var(--ink);vertical-align:bottom;} .annex thead th b{display:block;font-size:22px;} .annex thead th span{font-size:20px;}
.annex td{padding:10px 14px;border-bottom:1.5px solid var(--line);white-space:nowrap;}
.annex .hl{background:var(--reco);} .annex thead th.hl{border-radius:16px 16px 0 0;}
.annex tr.tot th,.annex tr.tot td{border-top:2px solid var(--ink);font-size:25px;padding-top:16px;padding-bottom:16px;}
/* méthode */
.method{position:absolute;top:248px;left:120px;right:120px;width:calc(100% - 240px);border-collapse:collapse;font-size:25px;}
.method th{text-align:left;font-weight:600;padding:22px 0;border-top:1.5px solid var(--line);width:300px;} .method td{padding:22px 10px;border-top:1.5px solid var(--line);} .method td.r{text-align:right;}
.method tr.tot th,.method tr.tot td{border-top:2px solid var(--ink);font-size:27px;}
.mk{position:absolute;left:120px;top:776px;font-size:25px;font-weight:600;}
.mcards{position:absolute;left:120px;right:120px;top:820px;display:grid;grid-template-columns:repeat(5,1fr);gap:20px;}
.mc{background:var(--reco);border-radius:24px;padding:22px 26px;height:160px;} .mc span{font-size:21px;} .mc b{display:block;font-size:50px;line-height:1.1;margin:6px 0;} .mc p{margin:0;font-size:19px;}
/* écran / impression */
.toolbar{position:fixed;top:16px;right:16px;z-index:100;} .toolbar button{font-family:var(--font);font-size:13px;font-weight:600;border:none;border-radius:10px;padding:10px 18px;cursor:pointer;background:#F7F5F0;color:#1E1E1E;}
@media screen{ body{background:#0c0c0c;padding:18px 0;} .slide{width:calc(1920px * var(--s));height:calc(1080px * var(--s));margin:0 auto 18px;position:relative;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.45);border-radius:6px;} .slide > section{position:absolute;top:0;left:0;transform:scale(var(--s));transform-origin:top left;} }
@media print{ @page{size:1920px 1080px;margin:0;} html,body{background:#fff;} .toolbar{display:none;} .slide{width:1920px;height:1080px;position:relative;overflow:hidden;page-break-after:always;} .slide:last-child{page-break-after:auto;} .slide > section{position:absolute;top:0;left:0;} *{-webkit-print-color-adjust:exact;print-color-adjust:exact;} }
</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimer / PDF</button></div>
  ${slides}
  <script>function fit(){var s=Math.min((window.innerWidth-24)/1920,0.92);document.documentElement.style.setProperty('--s',String(s));}window.addEventListener('resize',fit);fit();</script>
</body></html>`;
}

/** Ouvre la présentation dans une nouvelle fenêtre (bouton « Imprimer / PDF » pour l'export). */
export async function generatePropositionFlotteDeck(input: PropositionFlotteInput): Promise<void> {
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
  const html = buildPropositionFlotteHtml(input, { regular, medium, semibold }, { logoDark, logoLight });
  win.document.open();
  win.document.write(html);
  win.document.close();
}
