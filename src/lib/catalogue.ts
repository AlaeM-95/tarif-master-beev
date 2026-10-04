// Catalogue d'offre — rendu éditorial PAYSAGE (A4 landscape), généré en HTML puis
// imprimé via window.print() (même mécanique que le BPU partenariat et l'audit &
// conseil). Distinct du devis portrait (generateProposalPdf) : c'est une
// présentation « catalogue » premium, inspirée des brochures constructeur.
//
// Trois variantes, déduites du contenu du devis :
//   - véhicule(s) seuls      → catalogue véhicules (cover, sélection, fiches,
//                              comparateur, synthèse TCO, bilan carbone, fiscalité)
//   - borne(s) seules        → catalogue recharge (cover, fiches, installation)
//   - véhicules + bornes      → catalogue électrification (cover, projet, coût global)
//
// Charte Beev : accent ROSE (véhicules), VIOLET (recharge). Police Roobert
// embarquée en data-URL pour un rendu fidèle à l'impression.

import { MANDATORY_SERVICES, type Vehicle } from "./catalog";
import { calculateTcoFull, type TcoContractParams } from "./tco-calculator";
import type { SelectedVehicle, SelectedCharger } from "./pdf";
import type { EnergyParams } from "./store";

export type CatalogueClient = { company?: string; contact?: string; email?: string };

export type CatalogueOpts = {
  client: CatalogueClient;
  vehicles: SelectedVehicle[];
  chargers: SelectedCharger[];
  energy: EnergyParams;
};

// ---- Formatage ----
const NBSP = " "; // fine insécable
const clean = (s: string) => s.replace(/ /g, NBSP).replace(/ /g, NBSP);
const eur = (n: number) =>
  clean(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(n)));
const eur2 = (n: number) =>
  clean(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n));
const fmt = (n: number) => clean(Math.round(n).toLocaleString("fr-FR"));
const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const todayFr = () =>
  new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// ---- Données TCO par véhicule ----
type VehRow = {
  sv: SelectedVehicle;
  loyer: number;            // loyer mensuel négocié
  apport: number;
  loyerTotal: number;       // (loyer + assurance) × durée + apport
  energie: number;
  tvs: number;
  malus: number;
  andTotal: number;
  aenEmployeur: number;
  fisc: number;             // tvs + malus
  empl: number;             // coutFiscalAND + aenEmployeur (approx via total)
  coutEmployeur: number;    // tcoEmployeurComplet
  tcoParKm: number;
  co2EviteKg: number;
  img?: string;             // data-url photo
};

const CO2_THERMIQUE_REF = 120; // g/km moyen d'un équivalent thermique (estimation)

function buildVehRow(sv: SelectedVehicle, energy: EnergyParams, img?: string): VehRow {
  const optionsTotalTtc = sv.options.reduce((s, o) => s + o.qty * o.unitHt, 0);
  const duree = sv.durationMonths / 12;
  const kmContrat = (sv.kmPerYear * sv.durationMonths) / 12;
  const contract: TcoContractParams = {
    dureeAnnees: duree,
    kmContrat,
    prixEssenceLitre: energy.fuelPriceL,
    prixKwhDomicile: energy.kWhHome,
    prixKwhPublic: energy.kWhPublic,
    optionsTotalTtc,
    remisePctOverride: sv.discountPct,
    apport: Math.max(0, sv.apport ?? 0),
    assuranceMensuelle: sv.assuranceTousRisques ? Math.max(0, sv.assuranceMonthly ?? 0) : 0,
  };
  const r = calculateTcoFull(sv.vehicle, contract, sv.negotiatedMonthly);
  const co2Veh = sv.vehicle.co2 ?? 0;
  const co2EviteKg = Math.max(0, ((CO2_THERMIQUE_REF - co2Veh) * kmContrat) / 1000) * sv.quantity;
  return {
    sv,
    loyer: sv.negotiatedMonthly,
    apport: Math.max(0, sv.apport ?? 0),
    loyerTotal: r.loyerTotal,
    energie: r.coutEnergie,
    tvs: r.tvsTotal,
    malus: r.malusCO2 + r.malusPoids,
    andTotal: r.andTotal,
    aenEmployeur: r.aenEmployeurTotal ?? 0,
    fisc: r.tvsTotal + r.malusCO2 + r.malusPoids,
    empl: Math.max(0, r.tcoEmployeurComplet - r.tcoTotal),
    coutEmployeur: r.tcoEmployeurComplet,
    tcoParKm: r.tcoParKm,
    co2EviteKg,
    img,
  };
}

// ---- Prix borne ----
function chargerUnitHt(sc: SelectedCharger): number {
  const items = sc.lineItems ?? [];
  if (items.length) return items.reduce((s, li) => s + li.qty * li.unitHt, 0);
  return (sc.charger.priceHt ?? 0) + (sc.installIncluded ? (sc.charger.installPriceHt ?? 0) : 0);
}
function chargerTotalHt(sc: SelectedCharger): number {
  const unit = chargerUnitHt(sc);
  const mult = sc.multiplyPriceByQty !== false ? Math.max(1, sc.quantity) : 1;
  return unit * mult;
}

// ---- SVG placeholders (si pas de photo) ----
const carSilhouette = (stroke: string) =>
  `<svg viewBox="0 0 400 180"><g fill="none" stroke="${stroke}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M40 125 Q50 80 110 74 L180 68 Q230 40 300 40 Q370 40 396 74 L430 84"/><path d="M40 125 L420 125"/><circle cx="120" cy="128" r="30" fill="#EDF6FF"/><circle cx="330" cy="128" r="30" fill="#EDF6FF"/></g><g fill="#1D1D1D"><circle cx="120" cy="128" r="11"/><circle cx="330" cy="128" r="11"/></g></svg>`;
const chargerSilhouette = () =>
  `<svg width="190" height="320" viewBox="0 0 190 320"><rect x="55" y="30" width="80" height="230" rx="16" fill="none" stroke="#1D1D1D" stroke-width="4"/><rect x="72" y="58" width="46" height="62" rx="6" fill="#D3CCD8"/><path d="M82 150 h26 M82 170 h26 M82 190 h16" stroke="#1D1D1D" stroke-width="5" stroke-linecap="round"/><path d="M135 140 q36 8 36 46 v40 q0 20 20 20" fill="none" stroke="#6A5478" stroke-width="4"/><circle cx="95" cy="290" r="8" fill="#6A5478"/></svg>`;

// ---- CSS commun ----
function baseCss(fonts: { regular?: string; medium?: string; semibold?: string }): string {
  const ff = (url?: string, weight?: number) =>
    url ? `@font-face{font-family:'Roobert';font-style:normal;font-weight:${weight};src:url(${url}) format('truetype');}` : "";
  return `
  ${ff(fonts.regular, 400)}${ff(fonts.medium, 500)}${ff(fonts.semibold, 700)}
  :root{--ink:#1D1D1D;--beige:#FCF9F2;--white:#fff;--rose:#F4B8AA;--rose-deep:#B5604F;--rose-soft:#FDF1EE;--violet:#D3CCD8;--violet-deep:#6A5478;--violet-soft:#F3F0F5;--bleu:#A5D2FF;--bleu-deep:#1E5A99;--bleu-soft:#EDF6FF;--grey:#8A8A8A;--rule:#E7E2D8;--sub:#5F5F64;--green:#5FA97E;}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#3a3a3a}
  body{font-family:'Roobert','Helvetica Neue',Arial,sans-serif;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .toolbar{position:fixed;top:0;left:0;right:0;background:#1D1D1D;color:#FCF9F2;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;z-index:999;font-size:13px}
  .toolbar button{font:inherit;font-weight:600;background:var(--rose);color:#1D1D1D;border:0;border-radius:8px;padding:8px 16px;cursor:pointer}
  .sheets{padding:52px 0 40px}
  .page{width:297mm;height:210mm;margin:0 auto 20px;background:var(--white);position:relative;overflow:hidden;page-break-after:always;box-shadow:0 6px 24px rgba(0,0,0,.3)}
  .pad{padding:16mm 18mm}
  .logo{font-weight:700;font-size:22px;font-style:italic;letter-spacing:-.5px}
  .logo .dot{font-style:normal}
  .eyebrow{font-size:11px;font-weight:700;letter-spacing:2px}
  .foot{position:absolute;left:18mm;right:18mm;bottom:9mm;display:flex;justify-content:space-between;font-size:11px;color:var(--grey);border-top:1px solid var(--rule);padding-top:10px}
  .shead{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid var(--ink);padding-bottom:12px}
  .shead h2{font-size:30px;letter-spacing:-.6px}
  .shead .rt{font-size:12px;color:var(--grey)}
  .lede{font-size:13px;color:var(--sub);margin-top:13px;max-width:84ch;line-height:1.5}
  /* cover */
  .cover{color:var(--beige)}
  .cover .glow{position:absolute;right:-160px;top:-120px;width:600px;height:600px;border-radius:50%}
  .cover .top{position:relative;display:flex;justify-content:space-between;align-items:center;z-index:3}
  .cover .logo,.cover .eyebrow{color:var(--beige)}
  .cover h1{position:absolute;left:18mm;bottom:52mm;font-size:58px;line-height:1.03;letter-spacing:-1.4px;max-width:16ch;z-index:3}
  .cover .cvsub{position:absolute;left:18mm;bottom:44mm;font-size:16px;color:rgba(252,249,242,.72);z-index:3}
  .pill-row{display:flex;gap:10px;position:absolute;left:18mm;bottom:26mm;z-index:3}
  .pill{font-size:12px;font-weight:500;background:rgba(252,249,242,.1);border:1px solid rgba(252,249,242,.25);border-radius:20px;padding:6px 14px;color:var(--beige)}
  .cvfoot{position:absolute;left:18mm;right:18mm;bottom:14mm;display:flex;justify-content:space-between;font-size:12px;color:rgba(252,249,242,.6);border-top:1px solid rgba(252,249,242,.18);padding-top:12px;z-index:3}
  .cover .art{position:absolute;z-index:1}
  /* grille sélection */
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:22px}
  .vc{border:1px solid var(--rule);border-radius:16px;overflow:hidden}
  .vc .ph{height:120px;background:var(--bleu-soft);display:flex;align-items:center;justify-content:center}
  .vc .ph img{max-height:108px;max-width:88%;object-fit:contain}
  .vc .ph svg{width:70%}
  .vc .bd{padding:12px 15px 15px}
  .vc .nm{font-size:16px;font-weight:700}
  .vc .ver{font-size:11px;color:var(--grey);margin-top:2px}
  .vc .chips{display:flex;gap:6px;margin:9px 0 11px;flex-wrap:wrap}
  .vc .chip{font-size:10px;background:#F4F1EA;border-radius:7px;padding:4px 8px;font-weight:600}
  .vc .pr{display:flex;align-items:baseline;justify-content:space-between;border-top:1px solid var(--rule);padding-top:9px}
  .vc .pr b{font-size:20px;font-weight:700;color:var(--rose-deep)}
  .vc .pr span{font-size:11px;color:var(--grey)}
  /* spread fiche */
  .spread{display:grid;grid-template-columns:1.05fr 1fr;gap:34px;margin-top:22px;align-items:start}
  .hero{background:linear-gradient(135deg,var(--bleu-soft),var(--rose-soft));border-radius:18px;height:360px;display:flex;align-items:center;justify-content:center;position:relative}
  .hero img{max-height:320px;max-width:90%;object-fit:contain}
  .hero svg{width:86%}
  .hero .tag{position:absolute;top:16px;left:16px;font-size:11px;font-weight:700;background:var(--rose);color:#7a3527;padding:6px 13px;border-radius:20px}
  .hero .cap{position:absolute;bottom:12px;right:16px;font-size:11px;color:var(--grey)}
  .specs{display:grid;grid-template-columns:1fr 1fr;gap:0 26px;margin-top:12px}
  .sp{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--rule);font-size:13px}
  .sp .k{color:var(--sub)} .sp .v{font-weight:700}
  .price-box{background:var(--ink);border-radius:16px;color:#fff;padding:16px 18px;margin-top:14px}
  .pb-row{display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;color:rgba(255,255,255,.82)}
  .pb-row.ap{color:#fff} .pb-row.ap .v{color:var(--rose);font-weight:700}
  .pb-hr{height:1px;background:rgba(255,255,255,.14);margin:7px 0}
  .pb-loyer{display:flex;align-items:baseline;gap:8px;margin-top:4px}
  .pb-loyer b{font-size:32px;font-weight:700;letter-spacing:-1px}
  .pb-loyer span{font-size:12px;color:rgba(255,255,255,.65)}
  .tco-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
  .tco-k{background:var(--rose-soft);border-radius:12px;padding:11px 13px}
  .tco-k .l{font-size:9.5px;font-weight:700;letter-spacing:.3px;color:var(--rose-deep);text-transform:uppercase}
  .tco-k .v{font-size:18px;font-weight:700;margin-top:3px}
  .inc{display:grid;grid-template-columns:1fr 1fr;gap:5px 16px;margin-top:8px;font-size:12px}
  .lbl{font-size:9px;font-weight:700;letter-spacing:.8px;color:var(--grey)}
  /* comparateur */
  table.cmp{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}
  table.cmp th{text-align:left;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--sub);font-weight:700;padding:10px 10px;border-bottom:2px solid var(--ink)}
  table.cmp td{padding:10px 10px;border-bottom:1px solid var(--rule)}
  table.cmp td.num,table.cmp th.num{text-align:right}
  table.cmp .mdl{font-weight:700}
  table.cmp tr:nth-child(even) td{background:#FAF8F3}
  /* kpis + barres */
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:20px}
  .kpi{border:1px solid var(--rule);border-radius:14px;padding:14px 16px}
  .kpi .l{font-size:10px;font-weight:700;letter-spacing:.3px;color:var(--grey);text-transform:uppercase}
  .kpi .v{font-size:24px;font-weight:700;margin-top:6px}
  .kpi .v.g{color:var(--green)} .kpi .v.r{color:var(--rose-deep)}
  .bars{margin-top:22px}
  .barrow{display:grid;grid-template-columns:160px 1fr 100px;align-items:center;gap:14px;margin-bottom:12px}
  .barrow .nm{font-size:13px;font-weight:700}
  .track{height:24px;border-radius:7px;background:#F4F1EA;overflow:hidden;display:flex}
  .seg{height:100%}
  .barrow .tot{font-size:14px;font-weight:700;text-align:right}
  .legend{display:flex;gap:16px;margin-top:8px;font-size:11px;color:var(--sub)}
  .legend i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;vertical-align:middle}
  /* fiscal / carbone cards */
  .cards3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:22px}
  .infocard{border:1px solid var(--rule);border-radius:16px;padding:20px}
  .infocard .ic{width:42px;height:42px;border-radius:11px;display:flex;align-items:center;justify-content:center;margin-bottom:12px}
  .infocard h3{font-size:16px;margin-bottom:6px}
  .infocard p{font-size:12px;color:var(--sub);line-height:1.5}
  .carbon-hero{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:22px;align-items:center}
  .carbon-big{background:var(--ink);border-radius:18px;color:#fff;padding:28px 30px}
  .carbon-big .l{font-size:12px;letter-spacing:.6px;text-transform:uppercase;color:rgba(255,255,255,.65)}
  .carbon-big .v{font-size:48px;font-weight:700;letter-spacing:-1px;margin-top:6px;color:var(--rose)}
  .carbon-big .s{font-size:12px;color:rgba(255,255,255,.7);margin-top:4px}
  .equiv{display:flex;flex-direction:column;gap:14px}
  .eqrow{display:flex;gap:14px;align-items:center}
  .eqrow .ic{width:40px;height:40px;border-radius:10px;background:var(--rose-soft);flex:none;display:flex;align-items:center;justify-content:center}
  .eqrow .t{font-size:13.5px;font-weight:700} .eqrow .t span{display:block;font-weight:400;color:var(--sub);font-size:12px}
  /* borne */
  .duo{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:22px}
  .panel{border:1px solid var(--rule);border-radius:18px;overflow:hidden}
  .panel .ph{padding:15px 18px;display:flex;align-items:center;justify-content:space-between;color:#fff}
  .panel.v .ph{background:var(--rose-deep)} .panel.b .ph{background:var(--violet-deep)}
  .panel .ph .t{font-size:17px;font-weight:700} .panel .ph .c{font-size:12px;opacity:.85}
  .panel .bd{padding:12px 18px 16px}
  .li{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--rule);font-size:13px}
  .li:last-child{border-bottom:0}
  .li .nm{font-weight:500} .li .nm small{display:block;color:var(--grey);font-weight:400;font-size:11px;margin-top:1px}
  .li .amt{font-weight:700} .li .amt small{font-weight:400;color:var(--grey);font-size:10px}
  .sub-tot{display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:2px solid var(--ink);font-size:14px;font-weight:700}
  .v .sub-tot span.k{color:var(--rose-deep)} .b .sub-tot span.k{color:var(--violet-deep)}
  .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:22px}
  .step{border:1px solid var(--rule);border-radius:14px;padding:16px}
  .step .n{width:32px;height:32px;border-radius:50%;background:var(--violet-soft);color:var(--violet-deep);font-weight:700;display:flex;align-items:center;justify-content:center;font-size:15px}
  .step .t{font-weight:700;font-size:14px;margin-top:10px}
  .step .d{font-size:11.5px;color:var(--sub);margin-top:5px;line-height:1.5}
  .totbox{background:var(--violet-soft);border-radius:16px;padding:20px;margin-top:22px}
  .totbox .l{font-size:11px;font-weight:700;letter-spacing:.6px;color:var(--violet-deep);text-transform:uppercase}
  .totbox .v{font-size:34px;font-weight:700;margin-top:6px}
  .totbox .s{font-size:12px;color:var(--sub);margin-top:4px}
  .hero-total{background:var(--ink);color:#fff;border-radius:20px;padding:26px 32px;margin-top:22px;display:flex;justify-content:space-between;align-items:center}
  .hero-total .l{font-size:12px;letter-spacing:1px;color:rgba(255,255,255,.7);text-transform:uppercase}
  .hero-total .v{font-size:46px;font-weight:700;letter-spacing:-1.3px;margin-top:6px;color:var(--rose)}
  .hero-total .r{text-align:right;font-size:12.5px;color:rgba(255,255,255,.72);line-height:1.7}
  .hero-total .r b{color:#fff}
  .split{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}
  .scard{border:1px solid var(--rule);border-radius:16px;padding:18px 20px}
  .scard .l{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
  .scard.v .l{color:var(--rose-deep)} .scard.b .l{color:var(--violet-deep)}
  .scard .v{font-size:28px;font-weight:700;margin-top:6px}
  .scard .rows{margin-top:10px;font-size:12.5px}
  .scard .rows div{display:flex;justify-content:space-between;padding:5px 0;color:var(--sub)}
  .note{margin-top:16px;font-size:11px;color:var(--grey);line-height:1.5}
  /* page DESIGN (pleine image) */
  .dpage{background:#1D1D1D}
  .dphoto{position:absolute;inset:0;background-size:cover;background-position:center;background-repeat:no-repeat}
  .dphoto.fallback{background:radial-gradient(120% 90% at 70% 35%,rgba(214,188,150,.5),rgba(40,34,30,.92) 70%),linear-gradient(180deg,#2b2621,#1b1714)}
  .dphoto .car{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);width:62%;opacity:.95}
  .dscrim-top{position:absolute;left:0;right:0;top:0;height:150px;background:linear-gradient(180deg,rgba(0,0,0,.45),transparent)}
  .dscrim-bot{position:absolute;left:0;right:0;bottom:0;height:300px;background:linear-gradient(0deg,rgba(0,0,0,.78),rgba(0,0,0,.2) 55%,transparent)}
  .dlabel{position:absolute;left:18mm;top:14mm;z-index:3;color:#FCF9F2}
  .dlabel .bar{width:34px;height:4px;background:var(--rose);border-radius:2px;margin-bottom:11px}
  .dlabel .t{font-size:28px;font-weight:700;letter-spacing:4px}
  .dcallouts{position:absolute;left:18mm;right:18mm;bottom:24mm;z-index:3;display:grid;gap:0}
  .dco{padding:0 24px;color:#FCF9F2;position:relative}
  .dco:not(:first-child)::before{content:"";position:absolute;left:0;top:5px;bottom:5px;width:1px;background:rgba(252,249,242,.35)}
  .dco:first-child{padding-left:0}
  .dco .top{font-size:14px;color:rgba(252,249,242,.75)}
  .dco .btm{font-size:19px;font-weight:700;line-height:1.15;margin-top:2px}
  .dfoot{position:absolute;left:18mm;right:18mm;bottom:9mm;z-index:3;display:flex;align-items:center;justify-content:space-between;color:#FCF9F2;border-top:1px solid rgba(252,249,242,.18);padding-top:11px}
  .dfoot .logo{color:#FCF9F2} .dfoot .mdl{font-size:13px;font-weight:500;color:rgba(252,249,242,.85)} .dfoot .pg{font-size:13px;font-weight:700}
  @media print{ .toolbar{display:none} .sheets{padding:0} .page{margin:0;box-shadow:none} }
  @page{ size:A4 landscape; margin:0 }
  `;
}

const logoMark = (light: boolean) =>
  `<span class="logo">Beev<span class="dot" style="color:${light ? "#F4B8AA" : "#F4B8AA"}"> ●</span></span>`;

// ---- Pages véhicules ----
function vehSpecRows(v: Vehicle): [string, string][] {
  const rows: [string, string][] = [];
  rows.push(["Énergie", v.energy]);
  if ((v.rangeWltp ?? 0) > 0) rows.push(["Autonomie WLTP", `${fmt(v.rangeWltp)} km`]);
  if ((v.batteryKwh ?? 0) > 0) rows.push(["Batterie", `${fmt(v.batteryKwh)} kWh`]);
  if ((v.powerHp ?? 0) > 0) rows.push(["Puissance", `${fmt(v.powerHp)} ch`]);
  if ((v.trunkLitres ?? 0) > 0) rows.push(["Coffre", `${fmt(v.trunkLitres!)} L`]);
  if (v.chargeTime2080Dc) rows.push(["Recharge DC 20-80 %", v.chargeTime2080Dc]);
  if (v.chargeTime2080Ac) rows.push(["Recharge AC 20-80 %", v.chargeTime2080Ac]);
  return rows.slice(0, 6);
}

function vehSpreadPage(row: VehRow, idx: number, total: number, client: CatalogueClient, pageNo: number): string {
  const v = row.sv.vehicle;
  const title = `${v.brand} ${v.model}`;
  const sub = [v.version, v.category, v.energy].filter(Boolean).join(" · ");
  const photo = row.img
    ? `<img src="${esc(row.img)}" alt="">`
    : carSilhouette("#1D1D1D");
  const optionsTotal = row.sv.options.reduce((s, o) => s + o.qty * o.unitHt, 0);
  const svcs = [...MANDATORY_SERVICES, ...row.sv.services];
  if (row.sv.assuranceTousRisques) svcs.unshift("Assurance tous risques");
  const incHtml = svcs.slice(0, 6).map((s) => `<div>✓ ${esc(s)}</div>`).join("");
  const specs = vehSpecRows(v).map(([k, val]) => `<div class="sp"><span class="k">${esc(k)}</span><span class="v">${esc(val)}</span></div>`).join("");
  const apportRow = row.apport > 0
    ? `<div class="pb-row ap"><span>Apport (1er loyer majoré)</span><span class="v">${eur2(row.apport)}</span></div>`
    : "";
  const optRow = optionsTotal > 0
    ? `<div class="pb-row"><span>Total options TTC</span><span>+ ${eur(optionsTotal)}</span></div>`
    : "";
  const kmContrat = fmt((row.sv.kmPerYear * row.sv.durationMonths) / 12);
  return `
  <div class="page"><div class="pad">
    <div class="shead"><h2>${esc(title)}</h2><div class="rt">Fiche ${idx} / ${total} · ${esc(sub)}</div></div>
    <div class="spread">
      <div>
        <div class="hero"><span class="tag">PROPOSITION BEEV</span>${photo}<span class="cap">Photo non contractuelle</span></div>
        <div class="specs">${specs}</div>
      </div>
      <div>
        <div class="price-box">
          <div class="pb-row"><span>Prix catalogue TTC</span><span>${eur(v.priceTtc)}</span></div>
          ${optRow}${apportRow}
          <div class="pb-hr"></div>
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--rose);margin-top:4px">LOYER MENSUEL TTC</div>
          <div class="pb-loyer"><b>${eur2(row.loyer)}</b><span>/ mois · ${row.sv.durationMonths} mois · ${kmContrat} km</span></div>
        </div>
        <div class="tco-strip">
          <div class="tco-k"><div class="l">Loyer total</div><div class="v">${eur(row.loyerTotal)}</div></div>
          <div class="tco-k"><div class="l">Énergie</div><div class="v">${eur(row.energie)}</div></div>
          <div class="tco-k"><div class="l">TCO / km</div><div class="v">${eur2(row.tcoParKm)}</div></div>
        </div>
        <div class="lbl" style="margin-top:14px">COMPRIS DANS LE LOYER</div>
        <div class="inc">${incHtml}</div>
      </div>
    </div>
    ${footer("Catalogue véhicules électriques", pageNo, client)}
  </div></div>`;
}

// Accents design : curatés (vehicle.designHighlights) sinon dérivés des specs.
function designCallouts(v: Vehicle): { top?: string; btm: string }[] {
  if (v.designHighlights && v.designHighlights.length) {
    return v.designHighlights.slice(0, 4).map((h) => ({ btm: h }));
  }
  const out: { top?: string; btm: string }[] = [];
  if ((v.rangeWltp ?? 0) > 0) out.push({ top: "Autonomie WLTP", btm: `${fmt(v.rangeWltp)} km` });
  if (v.chargeTime2080Dc) out.push({ top: "Recharge 20-80 %", btm: v.chargeTime2080Dc });
  if ((v.powerHp ?? 0) > 0) out.push({ top: "Puissance", btm: `${fmt(v.powerHp)} ch` });
  if ((v.batteryKwh ?? 0) > 0) out.push({ top: "Batterie", btm: `${fmt(v.batteryKwh)} kWh` });
  return out.slice(0, 4);
}

// Page DESIGN : grande image lifestyle pleine page + label + accents design.
function designPage(row: VehRow, client: CatalogueClient, pageNo: number, designImg?: string): string {
  const v = row.sv.vehicle;
  const callouts = designCallouts(v);
  const n = Math.max(1, callouts.length);
  const coHtml = callouts.map((c) => `<div class="dco">${c.top ? `<div class="top">${esc(c.top)}</div>` : ""}<div class="btm">${esc(c.btm)}</div></div>`).join("");
  const photo = designImg
    ? `<div class="dphoto" style="background-image:url('${esc(designImg)}')"></div>`
    : `<div class="dphoto fallback">${carSilhouette("rgba(252,249,242,.9)")}</div>`;
  const co = client.company ? esc(client.company) : "Beev";
  return `
  <div class="page dpage">
    ${photo}
    <div class="dscrim-top"></div><div class="dscrim-bot"></div>
    <div class="dlabel"><div class="bar"></div><div class="t">DESIGN</div></div>
    <div class="dcallouts" style="grid-template-columns:repeat(${n},1fr)">${coHtml}</div>
    <div class="dfoot"><span class="logo">Beev<span class="dot" style="color:#F4B8AA"> ●</span></span><span class="mdl">${esc(v.brand)} ${esc(v.model)}${v.version ? " · " + esc(v.version) : ""}</span><span class="pg">${String(pageNo).padStart(2, "0")} · ${co}</span></div>
  </div>`;
}

function footer(label: string, pageNo: number, client: CatalogueClient): string {
  const co = client.company ? esc(client.company) : "Beev";
  return `<div class="foot"><span>Beev · ${esc(label)}</span><span>${String(pageNo).padStart(2, "0")} · ${co}</span></div>`;
}

function selectionPage(rows: VehRow[], client: CatalogueClient, pageNo: number): string {
  const cards = rows.map((r) => {
    const v = r.sv.vehicle;
    const ph = r.img ? `<img src="${esc(r.img)}" alt="">` : carSilhouette("#1E5A99");
    const chips = [
      (v.rangeWltp ?? 0) > 0 ? `${fmt(v.rangeWltp)} km` : "",
      (v.powerHp ?? 0) > 0 ? `${fmt(v.powerHp)} ch` : "",
      (v.batteryKwh ?? 0) > 0 ? `${fmt(v.batteryKwh)} kWh` : "",
    ].filter(Boolean).map((c) => `<span class="chip">${esc(c)}</span>`).join("");
    return `<div class="vc"><div class="ph">${ph}</div><div class="bd"><div class="nm">${esc(v.brand)} ${esc(v.model)}</div><div class="ver">${esc(v.version || v.category)}</div><div class="chips">${chips}</div><div class="pr"><div><span>à partir de</span></div><div><b>${eur(r.loyer)}</b> <span>/mois</span></div></div></div></div>`;
  }).join("");
  return `
  <div class="page"><div class="pad">
    <div class="shead"><h2>La sélection Beev</h2><div class="rt">${rows.length} véhicule${rows.length > 1 ? "s" : ""} · classés par loyer croissant</div></div>
    <p class="lede">Une sélection de véhicules 100 % électriques adaptés à vos usages, avec un loyer tout compris (maintenance, assistance, assurance, pneumatiques). Chaque fiche détaille les caractéristiques, le prix et le coût total de possession.</p>
    <div class="grid">${cards}</div>
    ${footer("Catalogue véhicules électriques", pageNo, client)}
  </div></div>`;
}

function comparateurPage(rows: VehRow[], client: CatalogueClient, pageNo: number): string {
  const body = rows.map((r) => {
    const v = r.sv.vehicle;
    return `<tr><td class="mdl">${esc(v.brand)} ${esc(v.model)}</td><td class="num">${eur(v.priceTtc)}</td><td class="num">${eur(r.loyer)}</td><td class="num">${(v.rangeWltp ?? 0) > 0 ? fmt(v.rangeWltp) + " km" : "—"}</td><td class="num">${(v.powerHp ?? 0) > 0 ? fmt(v.powerHp) + " ch" : "—"}</td><td class="num">${(v.consumption ?? 0) > 0 ? v.consumption + " kWh/100" : "—"}</td><td class="num">${eur(r.coutEmployeur)}</td></tr>`;
  }).join("");
  return `
  <div class="page"><div class="pad">
    <div class="shead"><h2>Comparateur</h2><div class="rt">Caractéristiques et coûts côte à côte</div></div>
    <p class="lede">Vue d'ensemble des modèles de la sélection : prix, loyer, autonomie, puissance, consommation et coût employeur complet sur la durée du contrat.</p>
    <table class="cmp"><thead><tr><th>Véhicule</th><th class="num">Prix TTC</th><th class="num">Loyer/mois</th><th class="num">Autonomie</th><th class="num">Puissance</th><th class="num">Conso</th><th class="num">Coût employeur</th></tr></thead><tbody>${body}</tbody></table>
    ${footer("Catalogue véhicules électriques", pageNo, client)}
  </div></div>`;
}

function tcoSynthesePage(rows: VehRow[], client: CatalogueClient, pageNo: number): string {
  const sorted = [...rows].sort((a, b) => a.coutEmployeur - b.coutEmployeur);
  const maxTot = Math.max(...sorted.map((r) => r.coutEmployeur), 1);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const moyParKm = rows.reduce((s, r) => s + r.tcoParKm, 0) / Math.max(1, rows.length);
  const bars = sorted.map((r) => {
    const w = (x: number) => `${(x / maxTot) * 100}%`;
    return `<div class="barrow"><div class="nm">${esc(r.sv.vehicle.brand)} ${esc(r.sv.vehicle.model)}</div><div class="track"><div class="seg" style="width:${w(r.loyerTotal)};background:#1D1D1D"></div><div class="seg" style="width:${w(r.energie)};background:#A5D2FF"></div><div class="seg" style="width:${w(r.fisc)};background:#967AA8"></div><div class="seg" style="width:${w(r.empl)};background:#F4B8AA"></div></div><div class="tot">${eur(r.coutEmployeur)}</div></div>`;
  }).join("");
  return `
  <div class="page"><div class="pad">
    <div class="shead"><h2>Coût total de possession</h2><div class="rt">Coût employeur complet sur la durée du contrat</div></div>
    <p class="lede">Loyer, énergie, fiscalité (TVS, malus, AND) et charges employeur (AEN) réunis pour chaque modèle, classés du coût total le plus bas au plus élevé.</p>
    <div class="kpis">
      <div class="kpi"><div class="l">Meilleur coût total</div><div class="v g">${eur(best.coutEmployeur)}</div></div>
      <div class="kpi"><div class="l">Coût le + élevé</div><div class="v r">${eur(worst.coutEmployeur)}</div></div>
      <div class="kpi"><div class="l">Écart flotte</div><div class="v">${eur(worst.coutEmployeur - best.coutEmployeur)}</div></div>
      <div class="kpi"><div class="l">TCO moyen / km</div><div class="v">${eur2(moyParKm)}</div></div>
    </div>
    <div class="bars">${bars}
      <div class="legend"><span><i style="background:#1D1D1D"></i>Loyer total</span><span><i style="background:#A5D2FF"></i>Énergie</span><span><i style="background:#967AA8"></i>Fiscalité</span><span><i style="background:#F4B8AA"></i>Charges employeur</span></div>
    </div>
    ${footer("Catalogue véhicules électriques", pageNo, client)}
  </div></div>`;
}

function carbonePage(rows: VehRow[], client: CatalogueClient, pageNo: number): string {
  const totalKg = rows.reduce((s, r) => s + r.co2EviteKg, 0);
  const tonnes = totalKg / 1000;
  const tonnesStr = tonnes >= 10 ? fmt(tonnes) : (Math.round(tonnes * 10) / 10).toLocaleString("fr-FR");
  const arbres = Math.round(totalKg / 25);          // ~25 kg CO2/an/arbre
  const parisNy = (totalKg / 1000 / 1.0).toFixed(1); // ~1 t CO2 / vol Paris-NY aller simple (approx)
  const kmThermique = Math.round(totalKg / (CO2_THERMIQUE_REF / 1000));
  return `
  <div class="page"><div class="pad">
    <div class="shead"><h2>Bilan carbone</h2><div class="rt">Émissions évitées vs équivalent thermique</div></div>
    <p class="lede">Estimation des émissions de CO₂ évitées en remplaçant des véhicules thermiques (base ${CO2_THERMIQUE_REF} g/km) par cette flotte 100 % électrique, sur la durée des contrats et le kilométrage prévu.</p>
    <div class="carbon-hero">
      <div class="carbon-big"><div class="l">CO₂ évité sur la flotte</div><div class="v">${tonnesStr} t</div><div class="s">soit ${fmt(totalKg)} kg de CO₂ sur la durée des contrats</div></div>
      <div class="equiv">
        <div class="eqrow"><div class="ic">🌳</div><div class="t">${fmt(arbres)} arbres<span>captation annuelle équivalente</span></div></div>
        <div class="eqrow"><div class="ic">✈️</div><div class="t">${parisNy} vols Paris–New York<span>aller simple, en équivalent CO₂</span></div></div>
        <div class="eqrow"><div class="ic">🚗</div><div class="t">${fmt(kmThermique)} km thermiques<span>évités en équivalent émissions</span></div></div>
      </div>
    </div>
    <p class="note">Estimation indicative à vocation pédagogique. Le CO₂ réellement évité dépend du mix électrique de recharge et des émissions réelles des véhicules remplacés.</p>
    ${footer("Catalogue véhicules électriques", pageNo, client)}
  </div></div>`;
}

function fiscalPage(client: CatalogueClient, pageNo: number): string {
  const card = (bg: string, icon: string, title: string, text: string) =>
    `<div class="infocard"><div class="ic" style="background:${bg}">${icon}</div><h3>${title}</h3><p>${text}</p></div>`;
  return `
  <div class="page"><div class="pad">
    <div class="shead"><h2>Avantages fiscaux 2026</h2><div class="rt">Ce que l'électrique change pour votre entreprise</div></div>
    <p class="lede">Les véhicules 100 % électriques bénéficient d'un cadre fiscal avantageux, intégré au calcul du coût total de possession de ce catalogue.</p>
    <div class="cards3">
      ${card("#F3F0F5", "🏛️", "TVS exonérée", "Les véhicules 100 % électriques sont exonérés des deux taxes annuelles sur les véhicules de société (émissions CO₂ et émissions de polluants).")}
      ${card("#FDF1EE", "⚡", "Aucun malus", "Pas de malus CO₂ ni de malus au poids pour un véhicule électrique, contrairement aux équivalents thermiques lourds.")}
      ${card("#EDF6FF", "📉", "AEN allégé", "L'avantage en nature est calculé sur une base réduite, avec abattement pour les véhicules électriques éligibles à l'éco-score.")}
    </div>
    <div class="cards3">
      ${card("#FDF1EE", "💶", "Amortissement", "Plafond de déduction (AND) plus favorable pour les véhicules les moins émetteurs ; la part batterie peut être déduite en complément.")}
      ${card("#EDF6FF", "🔌", "TVA récupérable", "Sur les utilitaires 100 % électriques et sur l'électricité de recharge, la TVA est récupérable par l'entreprise.")}
      ${card("#F3F0F5", "🅿️", "Aides locales", "Stationnement, ZFE, aides régionales : l'électrique ouvre des avantages d'usage selon les territoires.")}
    </div>
    <p class="note">Information générale 2026, non contractuelle. À valider avec votre expert-comptable selon votre situation.</p>
    ${footer("Catalogue véhicules électriques", pageNo, client)}
  </div></div>`;
}

function vehicleCover(client: CatalogueClient, count: number): string {
  return `
  <div class="page cover" style="background:linear-gradient(120deg,#1D1D1D 0%,#262422 55%,#3a3330 100%)">
    <div class="glow" style="background:radial-gradient(circle,rgba(244,184,170,.42),transparent 62%)"></div>
    <div class="pad top">${logoMark(true)}<span class="eyebrow" style="color:#F4B8AA">CATALOGUE VÉHICULES ÉLECTRIQUES</span></div>
    <svg class="art" style="right:40px;top:250px;width:620px" viewBox="0 0 700 300"><g fill="none" stroke="rgba(252,249,242,.9)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M60 215 Q70 150 150 142 L250 134 Q310 92 430 92 Q560 92 606 142 L650 152 Q672 160 672 200 L672 215"/><path d="M60 215 L672 215"/><circle cx="195" cy="218" r="46" fill="#1D1D1D"/><circle cx="545" cy="218" r="46" fill="#1D1D1D"/></g><g fill="rgba(244,184,170,.9)"><circle cx="195" cy="218" r="18"/><circle cx="545" cy="218" r="18"/></g></svg>
    <h1>Votre flotte électrique, clé en main.</h1>
    <div class="cvsub">Sélection véhicules · Tarification LLD · Analyse du coût total de possession</div>
    <div class="pill-row"><span class="pill">${count} modèle${count > 1 ? "s" : ""}</span><span class="pill">TCO inclus</span><span class="pill">Prestations tout compris</span></div>
    <div class="cvfoot"><span>Préparé pour ${esc(client.company || "votre entreprise")}</span><span>Tarifs au ${todayFr()}</span></div>
  </div>`;
}

// ---- Pages bornes ----
function borneCover(client: CatalogueClient): string {
  return `
  <div class="page cover" style="background:linear-gradient(120deg,#1D1D1D 0%,#2a2630 55%,#3a3340 100%)">
    <div class="glow" style="background:radial-gradient(circle,rgba(211,204,216,.42),transparent 62%)"></div>
    <div class="pad top">${logoMark(true)}<span class="eyebrow" style="color:#D3CCD8">CATALOGUE INFRASTRUCTURE DE RECHARGE</span></div>
    <div class="art" style="right:120px;top:150px">${chargerBig()}</div>
    <h1>Une recharge pilotée, à l'échelle de votre site.</h1>
    <div class="cvsub">Bornes · Installation clé en main · Supervision et refacturation</div>
    <div class="pill-row"><span class="pill">Étude technique</span><span class="pill">Pose certifiée IRVE</span><span class="pill">Supervision Beev Connect</span></div>
    <div class="cvfoot"><span>Préparé pour ${esc(client.company || "votre entreprise")}</span><span>Tarifs au ${todayFr()}</span></div>
  </div>`;
}
const chargerBig = () =>
  `<svg width="320" height="400" viewBox="0 0 320 400"><rect x="110" y="50" width="110" height="280" rx="18" fill="none" stroke="rgba(252,249,242,.85)" stroke-width="4"/><rect x="132" y="82" width="66" height="84" rx="8" fill="rgba(211,204,216,.35)"/><path d="M144 195 h40 M144 218 h40 M144 241 h24" stroke="rgba(252,249,242,.7)" stroke-width="5" stroke-linecap="round"/><path d="M220 140 q46 10 46 56 v64 q0 24 24 24" fill="none" stroke="rgba(252,249,242,.55)" stroke-width="4"/><path d="M160 282 l-13 32 h20 l-13 32" fill="none" stroke="rgba(211,204,216,.95)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;

function borneFichePage(sc: SelectedCharger, idx: number, total: number, client: CatalogueClient, pageNo: number, img?: string): string {
  const c = sc.charger;
  const photo = img ? `<img src="${esc(img)}" alt="">` : chargerSilhouette();
  const points = sc.chargePoints ?? 1;
  const specs: [string, string][] = [
    ["Puissance", `${fmt(c.powerKw)} kW${/triphas/i.test(c.type) ? " (AC triphasé)" : ""}`],
    ["Points de charge", `${points} × ${esc(c.type || "Type 2")}`],
    ["Modèle", `${esc(c.brand)} ${esc(c.model)}`],
    ["Déploiement", c.deployment === "site" ? "Site entreprise" : "Domicile collaborateur"],
  ];
  const feats = (c.features ?? []).slice(0, 6);
  const incHtml = (feats.length ? feats : ["Étude technique", "Mise en service", "Garantie 3 ans", "Application mobile", "Badges RFID", "Reporting"]).map((f) => `<div>✓ ${esc(f)}</div>`).join("");
  const specHtml = specs.map(([k, v]) => `<div class="sp"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("");
  const matos = c.priceHt ?? 0;
  const install = c.installPriceHt ?? 0;
  const totalUnit = chargerUnitHt(sc);
  const lease = sc.leaseEnabled && (sc.leaseMonthly ?? 0) > 0;
  const priceBlock = lease
    ? `<div class="pb-row"><span>Loyer mensuel (par borne)</span><span>${eur(sc.leaseMonthly!)} HT</span></div><div class="pb-row"><span>Durée</span><span>${sc.leaseDurationMonths ?? 36} mois</span></div><div class="pb-hr"></div><div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px"><div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--violet)">LOCATION PAR BORNE</div><b style="font-size:30px;font-weight:700">${eur(sc.leaseMonthly!)} <span style="font-size:13px;color:rgba(255,255,255,.6)">/mois HT</span></b></div>`
    : `<div class="pb-row"><span>Matériel (borne ${fmt(c.powerKw)} kW)</span><span>${eur(matos)} HT</span></div><div class="pb-row"><span>Installation & pose IRVE</span><span>+ ${eur(install)} HT</span></div><div class="pb-hr"></div><div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px"><div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--violet)">INVESTISSEMENT PAR BORNE</div><b style="font-size:30px;font-weight:700">${eur(totalUnit)} <span style="font-size:13px;color:rgba(255,255,255,.6)">HT</span></b></div>`;
  return `
  <div class="page"><div class="pad">
    <div class="shead"><h2>${esc(c.brand)} ${esc(c.model)}</h2><div class="rt">Borne ${idx} / ${total} · ${fmt(c.powerKw)} kW · ${c.deployment === "site" ? "site entreprise" : "domicile"}</div></div>
    <div class="spread" style="grid-template-columns:1fr 1.1fr">
      <div class="hero" style="background:linear-gradient(135deg,var(--violet-soft),var(--bleu-soft))"><span class="tag" style="background:var(--violet);color:#4a3a56">${esc(c.deployment === "site" ? "SITE ENTREPRISE" : "DOMICILE")}</span>${photo}</div>
      <div>
        <div class="specs" style="grid-template-columns:1fr">${specHtml}</div>
        <div class="price-box">${priceBlock}</div>
        <div class="lbl" style="margin-top:12px;font-size:9px;font-weight:700;letter-spacing:.8px;color:var(--grey)">COMPRIS</div>
        <div class="inc">${incHtml}</div>
      </div>
    </div>
    ${footer("Catalogue infrastructure de recharge", pageNo, client)}
  </div></div>`;
}

function installationPage(chargers: SelectedCharger[], client: CatalogueClient, pageNo: number): string {
  const totalInvest = chargers.reduce((s, sc) => s + (sc.leaseEnabled ? 0 : chargerTotalHt(sc)), 0);
  const totalBornes = chargers.reduce((s, sc) => s + Math.max(1, sc.quantity), 0);
  return `
  <div class="page"><div class="pad">
    <div class="shead"><h2>Installation & supervision</h2><div class="rt">De l'étude à la refacturation</div></div>
    <div class="steps">
      <div class="step"><div class="n">1</div><div class="t">Étude technique</div><div class="d">Visite du site, relevé électrique, dimensionnement de l'infrastructure.</div></div>
      <div class="step"><div class="n">2</div><div class="t">Chiffrage</div><div class="d">Devis détaillé : bornes, travaux, raccordement, supervision.</div></div>
      <div class="step"><div class="n">3</div><div class="t">Pose certifiée</div><div class="d">Installation par un technicien IRVE, mise en service et tests.</div></div>
      <div class="step"><div class="n">4</div><div class="t">Supervision</div><div class="d">Pilotage à distance, alerting, reporting et refacturation kWh.</div></div>
    </div>
    <div class="totbox">
      <div class="l">Investissement global · ${totalBornes} borne${totalBornes > 1 ? "s" : ""}</div>
      <div class="v">${eur(totalInvest)} HT</div>
      <div class="s">installation incluse · supervision Beev Connect · garantie 3 ans</div>
    </div>
    ${footer("Catalogue infrastructure de recharge", pageNo, client)}
  </div></div>`;
}

// ---- Pages mixte ----
function mixteCover(client: CatalogueClient): string {
  return `
  <div class="page cover" style="background:linear-gradient(120deg,#1D1D1D 0%,#2a2724 50%,#352e33 100%)">
    <div class="glow" style="background:radial-gradient(circle,rgba(244,184,170,.4),transparent 62%)"></div>
    <div class="glow" style="right:160px;top:160px;width:460px;height:460px;background:radial-gradient(circle,rgba(211,204,216,.34),transparent 62%)"></div>
    <div class="pad top">${logoMark(true)}<span class="eyebrow" style="color:#F4B8AA">CATALOGUE ÉLECTRIFICATION COMPLÈTE</span></div>
    <h1>Votre électrification, de bout en bout.</h1>
    <div class="cvsub">Véhicules électriques · Infrastructure de recharge · Pilotage unifié</div>
    <div class="pill-row"><span class="pill">Véhicules + bornes</span><span class="pill">TCO consolidé</span><span class="pill">Un seul interlocuteur</span></div>
    <div class="cvfoot"><span>Préparé pour ${esc(client.company || "votre entreprise")}</span><span>Tarifs au ${todayFr()}</span></div>
  </div>`;
}

function projetPage(rows: VehRow[], chargers: SelectedCharger[], client: CatalogueClient, pageNo: number): string {
  const vehLis = rows.slice(0, 6).map((r) => `<div class="li"><span class="nm">${esc(r.sv.vehicle.brand)} ${esc(r.sv.vehicle.model)} <small>${esc(r.sv.vehicle.version || r.sv.vehicle.category)}</small></span><span class="amt">${eur(r.loyer)} <small>/mois</small></span></div>`).join("");
  const loyerFlotte = rows.reduce((s, r) => s + r.loyer * Math.max(1, r.sv.quantity), 0);
  const borneLis = chargers.slice(0, 6).map((sc) => `<div class="li"><span class="nm">${esc(sc.charger.brand)} ${esc(sc.charger.model)} <small>${fmt(sc.charger.powerKw)} kW · ×${Math.max(1, sc.quantity)}</small></span><span class="amt">${eur(chargerTotalHt(sc))} <small>HT</small></span></div>`).join("");
  const investBornes = chargers.reduce((s, sc) => s + (sc.leaseEnabled ? 0 : chargerTotalHt(sc)), 0);
  return `
  <div class="page"><div class="pad">
    <div class="shead"><h2>Votre projet d'électrification</h2><div class="rt">${rows.length} véhicule${rows.length > 1 ? "s" : ""} · ${chargers.length} borne${chargers.length > 1 ? "s" : ""}</div></div>
    <p class="lede">Beev réunit sur une même offre les véhicules électriques et l'infrastructure de recharge. Vous pilotez un projet unique, avec un interlocuteur unique, de la commande à l'exploitation.</p>
    <div class="duo">
      <div class="panel v"><div class="ph"><span class="t">Véhicules</span><span class="c">${rows.length} modèle${rows.length > 1 ? "s" : ""} · LLD</span></div><div class="bd">${vehLis}<div class="sub-tot"><span class="k">Loyer mensuel flotte</span><span>${eur(loyerFlotte)} /mois</span></div></div></div>
      <div class="panel b"><div class="ph"><span class="t">Recharge</span><span class="c">${chargers.length} borne${chargers.length > 1 ? "s" : ""}</span></div><div class="bd">${borneLis}<div class="sub-tot"><span class="k">Investissement bornes</span><span>${eur(investBornes)} HT</span></div></div></div>
    </div>
    ${footer("Catalogue électrification complète", pageNo, client)}
  </div></div>`;
}

function coutGlobalPage(rows: VehRow[], chargers: SelectedCharger[], client: CatalogueClient, pageNo: number): string {
  const loyersTotal = rows.reduce((s, r) => s + r.loyerTotal * Math.max(1, r.sv.quantity), 0);
  const apportsTotal = rows.reduce((s, r) => s + r.apport * Math.max(1, r.sv.quantity), 0);
  const energieTotal = rows.reduce((s, r) => s + r.energie * Math.max(1, r.sv.quantity), 0);
  const investBornes = chargers.reduce((s, sc) => s + (sc.leaseEnabled ? 0 : chargerTotalHt(sc)), 0);
  const budget = loyersTotal + energieTotal + investBornes;
  return `
  <div class="page"><div class="pad">
    <div class="shead"><h2>Coût global de l'électrification</h2><div class="rt">Véhicules + recharge</div></div>
    <div class="hero-total">
      <div><div class="l">Budget total du projet</div><div class="v">${eur(budget)}</div></div>
      <div class="r"><b>Véhicules</b> : ${eur(loyersTotal)} (loyers + apports)<br><b>Recharge</b> : ${eur(investBornes)} HT (matériel + installation)<br><b>Énergie estimée</b> : ${eur(energieTotal)}</div>
    </div>
    <div class="split">
      <div class="scard v"><div class="l">Volet véhicules</div><div class="v">${eur(loyersTotal + energieTotal)}</div><div class="rows"><div><span>Loyers totaux (avec apports)</span><span>${eur(loyersTotal)}</span></div><div><span>dont apports (1ers loyers majorés)</span><span>${eur(apportsTotal)}</span></div><div><span>Énergie de recharge estimée</span><span>${eur(energieTotal)}</span></div></div></div>
      <div class="scard b"><div class="l">Volet recharge</div><div class="v">${eur(investBornes)}</div><div class="rows"><div><span>Matériel + installation (${chargers.reduce((s, sc) => s + Math.max(1, sc.quantity), 0)} bornes)</span><span>${eur(investBornes)} HT</span></div><div><span>Supervision & garantie</span><span>incluses</span></div></div></div>
    </div>
    <p class="note">Montants calculés depuis le devis en cours. L'énergie rechargée sur les bornes du site (coût maîtrisé) remplace la recharge publique et réduit le poste énergie du TCO véhicules. Un seul contrat, un seul interlocuteur, un pilotage unifié.</p>
    ${footer("Catalogue électrification complète", pageNo, client)}
  </div></div>`;
}

// ---- Assemblage HTML ----
function buildHtml(opts: CatalogueOpts, assets: { fonts: any; vehImgs: Map<string, string>; chgImgs: Map<string, string>; designImgs: Map<string, string> }): string {
  const { client, vehicles, chargers, energy } = opts;
  const rows = vehicles
    .filter((sv) => !sv.vehicle.isCurrentFleet)
    .map((sv) => buildVehRow(sv, energy, assets.vehImgs.get(sv.vehicle.image || "")))
    .sort((a, b) => a.loyer - b.loyer);
  const hasVeh = rows.length > 0;
  const hasChg = chargers.length > 0;
  let p = 1;
  const pages: string[] = [];

  if (hasVeh && hasChg) {
    pages.push(mixteCover(client)); p++;
    pages.push(projetPage(rows, chargers, client, p)); p++;
    pages.push(coutGlobalPage(rows, chargers, client, p)); p++;
    // suivi des fiches véhicule puis bornes
    pages.push(selectionPage(rows, client, p)); p++;
    rows.forEach((r, i) => {
      pages.push(vehSpreadPage(r, i + 1, rows.length, client, p)); p++;
      pages.push(designPage(r, client, p, assets.designImgs.get(r.sv.vehicle.id))); p++;
    });
    if (rows.length >= 2) { pages.push(tcoSynthesePage(rows, client, p)); p++; }
    chargers.forEach((sc, i) => { pages.push(borneFichePage(sc, i + 1, chargers.length, client, p, assets.chgImgs.get(sc.charger.image || ""))); p++; });
    pages.push(installationPage(chargers, client, p)); p++;
  } else if (hasVeh) {
    pages.push(vehicleCover(client, rows.length)); p++;
    pages.push(selectionPage(rows, client, p)); p++;
    rows.forEach((r, i) => {
      pages.push(vehSpreadPage(r, i + 1, rows.length, client, p)); p++;
      pages.push(designPage(r, client, p, assets.designImgs.get(r.sv.vehicle.id))); p++;
    });
    if (rows.length >= 2) { pages.push(comparateurPage(rows, client, p)); p++; }
    if (rows.length >= 2) { pages.push(tcoSynthesePage(rows, client, p)); p++; }
    pages.push(carbonePage(rows, client, p)); p++;
    pages.push(fiscalPage(client, p)); p++;
  } else {
    pages.push(borneCover(client)); p++;
    chargers.forEach((sc, i) => { pages.push(borneFichePage(sc, i + 1, chargers.length, client, p, assets.chgImgs.get(sc.charger.image || ""))); p++; });
    pages.push(installationPage(chargers, client, p)); p++;
  }

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catalogue Beev — ${esc(client.company || "offre")}</title><style>${baseCss(assets.fonts)}</style></head>
<body>
<div class="toolbar"><span>Catalogue Beev — prêt à imprimer en PDF (format paysage). Dans la boîte d'impression : destination « Enregistrer au format PDF », mise en page « Paysage », marges « Aucune ».</span><button onclick="window.print()">Télécharger le PDF</button></div>
<div class="sheets">${pages.join("\n")}</div>
<script>window.addEventListener('load',function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},600);});</script>
</body></html>`;
}

// ---- Chargement ressources ----
async function toDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string | undefined>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : undefined);
      r.onerror = () => resolve(undefined);
      r.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

export async function generateCataloguePdf(opts: CatalogueOpts): Promise<void> {
  const win = window.open("", "_blank", "width=1280,height=900");
  if (!win) {
    alert("Le navigateur a bloqué la fenêtre. Autorisez les popups pour ce site puis relancez la génération du catalogue.");
    return;
  }
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Catalogue…</title></head><body style="font-family:system-ui;padding:48px;color:#5F5F64">Préparation du catalogue…</body></html>');

  const [regular, medium, semibold] = await Promise.all([
    toDataUrl("/fonts/Roobert-Regular.ttf"),
    toDataUrl("/fonts/Roobert-Medium.ttf"),
    toDataUrl("/fonts/Roobert-SemiBold.ttf"),
  ]);
  // Précharge les photos (véhicules + bornes + visuels design) en data-url pour
  // une impression fiable. La photo design privilégie designImageUrl, puis la
  // galerie, puis la photo produit.
  const vehImgs = new Map<string, string>();
  const chgImgs = new Map<string, string>();
  const designImgs = new Map<string, string>();
  const propVehicles = opts.vehicles.filter((sv) => !sv.vehicle.isCurrentFleet);
  await Promise.all([
    ...propVehicles.filter((sv) => sv.vehicle.image).map(async (sv) => {
      const u = sv.vehicle.image; const d = await toDataUrl(u); if (d) vehImgs.set(u, d);
    }),
    ...propVehicles.map(async (sv) => {
      const v = sv.vehicle;
      // Pleine image uniquement depuis un visuel dédié (designImageUrl) ou la
      // galerie : on évite d'étirer la photo produit détourée en plein cadre
      // (rendu médiocre). Sans visuel dédié, la page design utilise un fond
      // dégradé charte + silhouette (repli propre).
      const src = (v.designImageUrl && v.designImageUrl.trim())
        || (v.gallery && v.gallery.length ? v.gallery[0] : "");
      if (!src) return;
      const d = await toDataUrl(src); if (d) designImgs.set(v.id, d);
    }),
    ...opts.chargers.filter((sc) => sc.charger.image).map(async (sc) => {
      const u = sc.charger.image; const d = await toDataUrl(u); if (d) chgImgs.set(u, d);
    }),
  ]);

  const html = buildHtml(opts, { fonts: { regular, medium, semibold }, vehImgs, chgImgs, designImgs });
  win.document.open();
  win.document.write(html);
  win.document.close();
}
