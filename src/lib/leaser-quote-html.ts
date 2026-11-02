// Rendu HTML du devis Beev issu d'un devis loueur. Une seule mise en page pour
// tous les loueurs : le loyer total, sa décomposition telle que le loueur la
// donne, les prestations incluses / exclues / à confirmer, le prix du véhicule,
// l'avantage en nature. Utilisé pour l'aperçu dans l'outil ET pour l'impression
// en PDF (même mécanique que le catalogue et le BPU : HTML → window.print()).

import {
  RENT_CAT_LABEL,
  SCOPE_LABELS,
  aenMonthly,
  groupRentLines,
  kmPerYear,
  netDownPayment,
  priceTotal,
  validityText,
  type LeaserQuote,
  type RentCat,
} from "./leaser-quote";

export type QuoteRenderOpts = {
  /** Éco-score validé (abattement de 70 % sur l'avantage en nature). */
  ecoOk: boolean;
  logoSrc?: string;
  photoSrc?: string;
  /** Client affiché si le devis du loueur n'en porte pas. */
  clientName?: string;
  advisor?: { name?: string; email?: string; phone?: string };
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const nb = (n: number, d = 0) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/[  ]/g, " ");
const eur = (n: number, d = 0) => `${nb(n, d)} €`;
const eur2 = (n: number) => eur(n, 2);
const dFr = (iso: string) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("fr-FR") : "—");

const CAT_COLOR: Record<RentCat, string> = { fin: "#1D1D1D", ent: "#F4B8AA", ass: "#A5D2FF", ges: "#D3CCD8" };

const SILHOUETTE =
  '<svg viewBox="0 0 400 150" aria-hidden="true"><g fill="none" stroke="#1E5A99" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M30 108 Q42 66 100 60 L165 55 Q212 30 280 30 Q345 31 372 62 L392 70"/><path d="M30 108 L392 108"/><circle cx="110" cy="110" r="26" fill="#EDF6FF"/><circle cx="312" cy="110" r="26" fill="#EDF6FF"/></g><g fill="#1D1D1D"><circle cx="110" cy="110" r="9"/><circle cx="312" cy="110" r="9"/></g></svg>';

export const LEASER_QUOTE_CSS = `
.lq-wrap{container-type:inline-size}
.lq-paper{--ink:#1D1D1D;--muted:#6B6A66;--line:#E7E2D8;--rose:#F4B8AA;--rose-deep:#B5604F;width:100%;max-width:794px;margin:0 auto;background:#fff;color:var(--ink);padding:40px 44px 30px;display:flex;flex-direction:column;gap:20px;font-size:13px;line-height:1.45;font-family:'Roobert','DM Sans','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.lq-paper *{box-sizing:border-box}
.lq-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid var(--ink);padding-bottom:14px}
.lq-logo{height:28px;width:auto;display:block}
.lq-wm{font-size:30px;font-weight:700;letter-spacing:-.04em;line-height:1}
.lq-tag{font-size:10px;color:var(--muted);margin-top:5px}
.lq-meta{text-align:right;font-size:12px;color:var(--muted);line-height:1.5;font-variant-numeric:tabular-nums}
.lq-meta b{color:var(--ink)}
.lq-eyebrow{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.lq-hero h2{font-size:30px;line-height:1.08;letter-spacing:-.03em;margin:6px 0 0;font-weight:700}
.lq-sub{color:var(--muted);margin-top:4px;font-size:14px}
.lq-for{margin-top:10px}
.lq-for i{font-style:normal;color:var(--rose-deep);font-weight:700}
.lq-veh{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:20px;align-items:stretch}
.lq-photo{background:#EDF6FF;border-radius:12px;min-height:150px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.lq-photo svg{width:78%;height:auto}
.lq-photo img{max-width:92%;max-height:170px;object-fit:contain;mix-blend-mode:multiply}
.lq-photo span{position:absolute;bottom:8px;right:12px;font-size:10px;color:#5b7a99}
.lq-specs{display:grid;grid-template-columns:1fr 1fr;gap:0 18px;align-content:center}
.lq-spec{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums}
.lq-spec span:first-child{color:var(--muted)}
.lq-spec span:last-child{font-weight:700;text-align:right}
.lq-loyer{background:var(--ink);color:#FCF9F2;border-radius:14px;padding:20px 24px;display:grid;gap:16px}
.lq-k{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.65}
.lq-big{font-size:46px;font-weight:700;letter-spacing:-.04em;line-height:1.05;font-variant-numeric:tabular-nums}
.lq-big small{font-size:15px;font-weight:500;letter-spacing:0;opacity:.7;margin-left:4px}
.lq-ht{font-size:12px;opacity:.65;margin-top:2px}
.lq-cond{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;border-top:1px solid rgba(252,249,242,.2);padding-top:14px}
.lq-cond>div{border-left:1px solid rgba(252,249,242,.2);padding-left:12px}
.lq-cond>div:first-child{border-left:0;padding-left:0}
.lq-cond .v{font-weight:700;font-size:15px;margin-top:2px;font-variant-numeric:tabular-nums}
.lq-cond .s{font-size:10.5px;opacity:.6}
.lq-sec{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 9px}
.lq-bar{display:flex;height:14px;border-radius:7px;overflow:hidden;gap:2px}
.lq-bar i{display:block;min-width:3px}
.lq-lines{margin-top:10px;display:flex;flex-direction:column}
.lq-line{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);align-items:baseline}
.lq-line:last-child{border-bottom:0}
.lq-dot{width:10px;height:10px;border-radius:3px;align-self:center}
.lq-line .t{font-weight:500}
.lq-line .t small{display:block;font-weight:400;color:var(--muted);font-size:11.5px}
.lq-line .a{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.lq-scope{display:flex;flex-wrap:wrap;gap:6px}
.lq-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:99px;font-size:12px;font-weight:500;background:#E3F1E8;color:#1F5C39}
.lq-pill.no{background:#ECE8DF;color:#6B685F;text-decoration:line-through;text-decoration-color:#9a968c}
.lq-pill.na{background:#FBEBD6;color:#8C4A09}
.lq-pill b{font-weight:700}
.lq-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px}
.lq-rows .r{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums}
.lq-rows .r:last-child{border-bottom:0}
.lq-rows .r span:first-child{color:var(--muted)}
.lq-rows .r.p span:first-child{color:var(--ink)}
.lq-rows .r.tot{border-top:2px solid var(--ink);border-bottom:0;margin-top:4px;padding-top:9px}
.lq-rows .r.tot span{color:var(--ink);font-weight:700}
.lq-rows .r b{font-weight:700;text-align:right}
.lq-note{font-size:10.5px;color:var(--muted);line-height:1.45}
.lq-aen{background:#EDF6FF;border-radius:12px;padding:14px 16px;display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap}
.lq-aen .t{font-weight:700}
.lq-aen .s{font-size:11.5px;color:#4d5f73;max-width:46ch}
.lq-aen .v{font-size:22px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:#173E66}
.lq-aen .v em{font-size:12px;font-weight:500;font-style:normal;color:#4d5f73}
.lq-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.lq-step{border:1px solid var(--line);border-radius:12px;padding:11px 13px}
.lq-step b{display:block;font-size:13px;margin-bottom:2px}
.lq-step span{color:var(--muted);font-size:11.5px;line-height:1.4;display:block}
.lq-foot{display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:14px}
.lq-adv{display:flex;gap:12px;align-items:center}
.lq-av{width:38px;height:38px;border-radius:50%;background:var(--rose);color:#1D1D1D;font-weight:700;display:flex;align-items:center;justify-content:center}
.lq-adv b{display:block}
.lq-adv span{color:var(--muted);font-size:11.5px}
.lq-src{font-size:10.5px;color:var(--muted);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.lq-sec-wrap{break-inside:avoid}
@container (max-width: 640px){
  .lq-paper{padding:24px 18px}
  .lq-veh,.lq-two,.lq-steps,.lq-cond{grid-template-columns:minmax(0,1fr)}
  .lq-cond>div{border-left:0;padding-left:0}
  .lq-big{font-size:38px}
}
`;

function specRows(q: LeaserQuote, o: QuoteRenderOpts): string {
  const v = q.vehicle;
  const eco = v.ecoScore != null ? String(v.ecoScore) : o.ecoOk ? "validé" : "à confirmer";
  const rows: [string, string][] = [
    ["Énergie", v.energy || "—"],
    ["Boîte", v.gearbox || "—"],
    ["Puissance", v.powerHp ? `${nb(v.powerHp)} ch` : "—"],
    ["CV fiscaux", v.fiscalHp ? `${nb(v.fiscalHp)} CV` : "—"],
    ["CO2", v.co2 != null ? `${nb(v.co2)} g/km` : "—"],
    ["Éco-score", eco],
  ];
  return rows.map(([k, x]) => `<div class="lq-spec"><span>${k}</span><span>${esc(x)}</span></div>`).join("");
}

/** HTML interne du devis (sans <style>) : à placer dans `.lq-wrap > .lq-paper`. */
export function renderLeaserQuoteHtml(q: LeaserQuote, o: QuoteRenderOpts): string {
  const v = q.vehicle;
  const L = q.rent;
  const total = priceTotal(q);
  const aen = aenMonthly(q, o.ecoOk);
  const client = q.client || o.clientName || "";
  const net = netDownPayment(q);

  const rentLines = groupRentLines(L.lines);
  const bar = rentLines.map((l) => `<i style="flex:${Math.max(l.amount, 0.01)};background:${CAT_COLOR[l.cat]}" title="${esc(l.label)}"></i>`).join("");
  const lines = rentLines
    .map((l) => `<div class="lq-line"><span class="lq-dot" style="background:${CAT_COLOR[l.cat]}"></span><span class="t">${esc(l.label)}${l.detail ? `<small>${esc(l.detail)}</small>` : ""}</span><span class="a">${eur2(l.amount)}</span></div>`)
    .join("");
  const legend = Array.from(new Set(rentLines.map((l) => l.cat))).map((c) => RENT_CAT_LABEL[c]).join(" · ");

  const scope = SCOPE_LABELS.map(([k, label]) => {
    const s = q.scope[k];
    // Pneumatiques : absent du devis = on n'en parle pas (ni « à confirmer »).
    if (k === "pneus" && s == null) return "";
    return s === 1 ? `<span class="lq-pill"><b>✓</b> ${label}</span>` : s === 0 ? `<span class="lq-pill no">${label}</span>` : `<span class="lq-pill na">${label} : à confirmer</span>`;
  }).join("");

  const opts = q.price.options
    .map((x) => `<div class="r"><span>${esc(x.name)}</span><b>${x.priceTtc == null ? "inclus au total" : eur(x.priceTtc)}</b></div>`)
    .join("");
  const prixRows =
    q.price.catalogueTtc != null
      ? `<div class="r"><span>Prix catalogue TTC</span><b>${eur(q.price.catalogueTtc)}</b></div>${opts}<div class="r tot"><span>Total véhicule et options</span><b>${eur(total)}</b></div>`
      : `${opts ? `<div class="r"><span>Options</span><b></b></div>${opts}` : ""}<div class="r tot"><span>Catalogue et options TTC</span><b>${eur(total)}</b></div>`;

  const apport = q.downPayment.ambiguous
    ? `<div class="v">à confirmer</div><div class="s">libellé ambigu sur le devis</div>`
    : q.downPayment.amount > 0
      ? q.downPayment.ceePrime >= q.downPayment.amount
        ? `<div class="v">0 €</div><div class="s">1er loyer ${eur(q.downPayment.amount)} compensé par la prime CEE</div>`
        : `<div class="v">${eur(net)}</div><div class="s">1er loyer majoré</div>`
      : `<div class="v">0 €</div><div class="s">sans apport</div>`;

  const aenTxt = o.ecoOk
    ? "50 % du loyer annuel, abattement de 70 % pour véhicule électrique éco-scoré (limité à 4 641,60 € par an)."
    : "Éco-score non confirmé : l'abattement de 70 % n'est pas appliqué.";

  const adv = o.advisor ?? {};
  const initials = (adv.name || "Beev").split(/\s+/).map((w) => w.charAt(0)).join("").slice(0, 2).toUpperCase();
  const contact = [adv.email, adv.phone].filter(Boolean).join(" · ");

  const kmSupp = q.contract.kmSuppTtc != null ? `<div class="r"><span>Km supplémentaire</span><b>${nb(q.contract.kmSuppTtc, q.contract.kmSuppTtc < 0.1 ? 4 : 2)} € / km</b></div>` : "";
  const tol = q.contract.tolerance ? `<div class="r"><span>Tolérance kilométrique</span><b>${esc(q.contract.tolerance)}</b></div>` : "";
  const extras = q.extras.map((e) => `<div class="r p"><span>${esc(e)}</span><b></b></div>`).join("");

  const logo = o.logoSrc ? `<img class="lq-logo" src="${esc(o.logoSrc)}" alt="Beev">` : `<div class="lq-wm">Beev</div>`;
  const photo = o.photoSrc ? `<img src="${esc(o.photoSrc)}" alt="">` : SILHOUETTE;
  const body = [v.body, v.energy].filter(Boolean).join(" · ");

  return `
  <header class="lq-head">
    <div>${logo}<div class="lq-tag">Time for electric</div></div>
    <div class="lq-meta"><b>Proposition de location</b><br>Offre ${esc(q.leaserLabel)} n° ${esc(q.offerNumber || "—")}<br>du ${dFr(q.dateIso)} · valable ${esc(validityText(q))}</div>
  </header>
  <section class="lq-hero">
    <div class="lq-eyebrow">Location longue durée · ${esc(q.leaserLabel)}</div>
    <h2>${esc(v.brand)} ${esc(v.model)}</h2>
    <div class="lq-sub">${esc([v.finition, body].filter(Boolean).join(" · "))}</div>
    <div class="lq-for">Préparée pour <i>${client ? esc(client) : "[client à renseigner]"}</i></div>
  </section>
  <section class="lq-veh">
    <div class="lq-photo">${photo}<span>Photo non contractuelle</span></div>
    <div class="lq-specs">${specRows(q, o)}</div>
  </section>
  <section class="lq-loyer">
    <div><div class="lq-k">Loyer mensuel TTC</div><div class="lq-big">${nb(L.totalTtc, 2)}<small>€ / mois</small></div>${L.totalHt ? `<div class="lq-ht">soit ${eur2(L.totalHt)} HT</div>` : ""}</div>
    <div class="lq-cond">
      <div><div class="lq-k">Durée</div><div class="v">${q.contract.months} mois</div></div>
      <div><div class="lq-k">Kilométrage</div><div class="v">${nb(q.contract.km)} km</div><div class="s">${nb(kmPerYear(q))} km / an</div></div>
      <div><div class="lq-k">Apport</div>${apport}</div>
    </div>
  </section>
  ${L.lines.length ? `<section class="lq-sec-wrap">
    <h3 class="lq-sec">Ce que contient votre loyer</h3>
    <div class="lq-bar">${bar}</div>
    <div class="lq-note" style="margin-top:6px">${esc(legend)}</div>
    <div class="lq-lines">${lines}</div>
  </section>` : ""}
  <section class="lq-sec-wrap">
    <h3 class="lq-sec">Prestations</h3>
    <div class="lq-scope">${scope}</div>
  </section>
  <section class="lq-two lq-sec-wrap">
    <div class="lq-rows"><h3 class="lq-sec">Votre véhicule</h3>${prixRows}${q.price.note ? `<div class="lq-note" style="margin-top:6px">${esc(q.price.note)}</div>` : ""}</div>
    <div class="lq-rows"><h3 class="lq-sec">Conditions</h3>${kmSupp}${tol}${extras}</div>
  </section>
  <section class="lq-aen lq-sec-wrap">
    <div><div class="t">Avantage en nature du collaborateur</div><div class="s">${esc(aenTxt)}</div></div>
    <div class="v">${eur(Math.round(aen.netMonth))}<em> / mois imposable</em></div>
  </section>
  <section class="lq-sec-wrap">
    <h3 class="lq-sec">Prochaines étapes</h3>
    <div class="lq-steps">
      <div class="lq-step"><b>1. Validez</b><span>Bon pour accord sur cette proposition.</span></div>
      <div class="lq-step"><b>2. Envoyez</b><span>Pièce d'identité du gérant, RIB, KBIS de moins de 3 mois, derniers bilans.</span></div>
      <div class="lq-step"><b>3. Livraison</b><span>Étude du dossier par le loueur, commande puis livraison.</span></div>
    </div>
  </section>
  <footer class="lq-foot">
    <div class="lq-adv"><div class="lq-av">${esc(initials)}</div><div><b>${esc(adv.name || "Votre conseiller Beev")}</b><span>${esc(contact || "beev.co")}</span></div></div>
    <div class="lq-note" style="max-width:340px">Proposition établie à partir de l'offre ${esc(q.leaserLabel)} n° ${esc(q.offerNumber || "—")}. Les montants fiscaux sont indicatifs et dépendent de la situation de l'entreprise.</div>
  </footer>`;
}

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

/** Ouvre le devis Beev dans une fenêtre prête à imprimer (« Enregistrer au
 *  format PDF »). Les polices, le logo et la photo sont embarqués en data-URL. */
export async function printLeaserQuote(q: LeaserQuote, o: QuoteRenderOpts): Promise<void> {
  const win = window.open("", "_blank", "width=980,height=1100");
  if (!win) {
    alert("Le navigateur a bloqué la fenêtre. Autorisez les popups pour ce site puis relancez l'export.");
    return;
  }
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Devis…</title></head><body style="font-family:system-ui;padding:48px;color:#5F5F64">Préparation du devis…</body></html>');
  const [regular, medium, semibold, logo, photo] = await Promise.all([
    toDataUrl("/fonts/Roobert-Regular.ttf"),
    toDataUrl("/fonts/Roobert-Medium.ttf"),
    toDataUrl("/fonts/Roobert-SemiBold.ttf"),
    toDataUrl("/images/logo-beev-noir.png"),
    o.photoSrc ? toDataUrl(o.photoSrc) : Promise.resolve(undefined),
  ]);
  const ff = (url: string | undefined, weight: number) =>
    url ? `@font-face{font-family:'Roobert';font-weight:${weight};src:url(${url}) format('truetype');}` : "";
  const inner = renderLeaserQuoteHtml(q, { ...o, logoSrc: logo, photoSrc: photo });
  const title = `Devis Beev ${q.vehicle.brand} ${q.vehicle.model}`.trim();
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
${ff(regular, 400)}${ff(medium, 500)}${ff(semibold, 700)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bar{position:fixed;top:0;left:0;right:0;background:#1D1D1D;color:#FCF9F2;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;font:13px system-ui;z-index:9}
.bar button{font:inherit;font-weight:600;background:#F4B8AA;color:#1D1D1D;border:0;border-radius:8px;padding:8px 16px;cursor:pointer}
.sheet{padding-top:52px}
${LEASER_QUOTE_CSS}
.lq-paper{max-width:794px}
@page{size:A4 portrait;margin:8mm}
@media print{.bar{display:none}.sheet{padding-top:0}.lq-paper{max-width:none;padding:6mm 8mm;gap:14px;zoom:.9}}
</style></head><body>
<div class="bar"><span>Devis Beev prêt à imprimer. Destination « Enregistrer au format PDF », marges « Aucune ».</span><button onclick="window.print()">Télécharger le PDF</button></div>
<div class="sheet"><div class="lq-wrap"><article class="lq-paper">${inner}</article></div></div>
<script>window.addEventListener('load',function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},600);});</script>
</body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
