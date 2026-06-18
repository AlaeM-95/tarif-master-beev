// Audit & conseil — PRÉSENTATION (deck 16:9).
// Reprend la maquette Beev fournie par le client : 7 slides 1920×1080, charte
// 2026, police Roobert, pictogrammes Lucide. Le contenu est branché sur la même
// configuration que le PDF A4 (AuditConseilConfig) : client, périmètre, enjeux,
// livrables, tarif, étapes, comparaison TCO, signataire.
//
// Rendu : fenêtre navigateur (comme le PDF). À l'écran les slides sont mises à
// l'échelle pour tenir dans la fenêtre ; à l'impression, une slide par page
// paysage. Polices et logos Beev embarqués en base64 ; icônes Lucide via CDN.

import type { AuditConseilConfig, AuditAssets, RoobertFonts } from "./audit-conseil";

const nbsp = (s: string) => s.replace(/ /g, " ").replace(/ /g, " ");
const eurInt = (n: number) =>
  nbsp(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0));
const esc = (s: string): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const isOn = <T extends { enabled?: boolean }>(x: T): boolean => x.enabled !== false;

function fontFaceCss(fonts?: RoobertFonts): string {
  const src = (dataUrl: string | undefined, path: string) =>
    dataUrl ? `url('${dataUrl}') format('truetype')` : `url('${path}') format('truetype')`;
  return `
  @font-face { font-family: 'Roobert'; src: ${src(fonts?.regular, "/fonts/Roobert-Regular.ttf")}; font-weight: 400; font-display: swap; }
  @font-face { font-family: 'Roobert'; src: ${src(fonts?.medium, "/fonts/Roobert-Medium.ttf")}; font-weight: 500; font-display: swap; }
  @font-face { font-family: 'Roobert'; src: ${src(fonts?.semibold, "/fonts/Roobert-SemiBold.ttf")}; font-weight: 600; font-display: swap; }
  @font-face { font-family: 'Roobert'; src: ${src(fonts?.semibold, "/fonts/Roobert-SemiBold.ttf")}; font-weight: 700; font-display: swap; }`;
}

function logoImg(url: string | undefined, cls: string, fallbackDark: boolean): string {
  if (url) return `<img class="${cls}" src="${url}" alt="Beev" />`;
  return `<span class="${cls} wordmark" style="font-weight:700;letter-spacing:-.02em;color:${fallbackDark ? "var(--black)" : "var(--beige)"}">beev</span>`;
}

// Icônes Lucide cyclées pour les cartes (data-lucide rendu côté client).
const ENJEU_ICONS = ["users", "banknote", "battery-charging", "shield-alert", "route", "fuel"];
const SCOPE_ICONS = ["clipboard-list", "calculator", "car-front", "trending-up", "plug-zap", "presentation"];

function head(numStr: string, label: string, assets: AuditAssets | undefined, dark = false): string {
  const labelColor = dark ? ' style="color:rgba(252,249,242,.6);"' : "";
  return `
    <div class="shead">
      <div class="eyebrow"><span class="eynum">${esc(numStr)}</span><span class="eylabel"${labelColor}>${esc(label)}</span></div>
      ${logoImg(dark ? assets?.logoLight : assets?.logoDark, "brand-mark", !dark)}
    </div>`;
}

function foot(cfg: AuditConseilConfig, n: number, dark = false): string {
  const cls = dark ? "sfoot dark-foot" : "sfoot";
  const who = cfg.clientName ? `${esc(cfg.clientName)} × Beev` : "Beev";
  return `<div class="${cls}"><span>Audit &amp; conseil flotte&nbsp;<span class="dot">·</span>&nbsp;${who}</span><span class="pageno">${String(n).padStart(2, "0")}</span></div>`;
}

function coverSlide(cfg: AuditConseilConfig, assets?: AuditAssets): string {
  const chips = [cfg.fleetSize, cfg.sites, "Sans engagement"]
    .filter((c) => c && c.trim())
    .map((c) => `<span>${esc(c)}</span>`)
    .join("");
  // Cobranding : on privilégie le LOGO du client (uploadé dans l'éditeur) ;
  // à défaut seulement, on retombe sur son nom en toutes lettres.
  const cobrandInner = cfg.clientLogoUrl
    ? `<img class="cb-logo" src="${esc(cfg.clientLogoUrl)}" alt="${esc(cfg.clientName || "Logo client")}" />`
    : (cfg.clientName ? `<span class="cb-wordmark">${esc(cfg.clientName)}</span>` : "");
  const cobrand = cobrandInner
    ? `<div class="cobrand"><span class="cb-label">En partenariat avec</span><span class="cb-sep"></span>${cobrandInner}</div>`
    : "";
  const prep = cfg.preparedBy ? `<p class="cover-prep">Préparé par <b>${esc(cfg.preparedBy)}</b>, votre interlocuteur Beev.</p>` : "";
  const meta = `${cfg.clientName ? esc(cfg.clientName) + "&nbsp;× Beev&nbsp;· " : ""}${esc(cfg.date)}`;
  return `
  <section data-accent="rose" class="cover">
    <div class="cover-content">
      <div class="cover-top">
        ${logoImg(assets?.logoLight, "cover-logo", false)}
        ${cobrand}
      </div>
      <div class="cover-eyebrow">Proposition commerciale</div>
      <h1 class="cover-title">Audit &amp;<br>recommandation<br>flotte</h1>
      <p class="cover-meta">${meta}</p>
      <div class="cover-rule"></div>
      <p class="cover-lead">Approche TCO, du diagnostic aux économies.</p>
      <p class="cover-detail">${esc(cfg.approach)}</p>
      ${chips ? `<div class="cover-tags">${chips}</div>` : ""}
      ${prep}
    </div>
    <div class="cover-legal">Beev&nbsp;· 5 rue Pleyel, 93200 Saint-Denis&nbsp;· SAS au capital de 63&nbsp;245,02&nbsp;€&nbsp;· RCS Bobigny 851&nbsp;682&nbsp;807&nbsp;· prix HT</div>
  </section>`;
}

function enjeuxSlide(cfg: AuditConseilConfig, n: number, assets?: AuditAssets): string {
  const list = cfg.enjeux.filter(isOn);
  const cards = list.map((e, i) => `
      <div class="enjeu">
        <div class="en-head"><span class="beev-chip rose"><i data-lucide="${ENJEU_ICONS[i % ENJEU_ICONS.length]}"></i></span><span class="en-idx">${String(i + 1).padStart(2, "0")}</span></div>
        <h3>${esc(e.title)}</h3>
        <p>${esc(e.text)}</p>
      </div>`).join("");
  return `
  <section data-accent="rose">
    <div class="frame">
      ${head("01", "Contexte & enjeux", assets)}
      <h2 class="stitle sm">Ce que votre flotte vous coûte aujourd'hui</h2>
      <p class="ssub">Sans pilotage, ces postes pèsent sur le parc chaque mois, et l'écart se creuse à chaque véhicule renouvelé au prix fort.</p>
      <div class="body">
        <div class="enjeux">${cards}</div>
        <p class="audit-disclaimer">Estimations de marché, affinées segment par segment lors de l'audit.</p>
      </div>
    </div>
    ${foot(cfg, n)}
  </section>`;
}

function scopeSlide(cfg: AuditConseilConfig, n: number, assets?: AuditAssets): string {
  const list = cfg.livrables.filter(isOn);
  const cards = list.map((l, i) => `
      <div class="scope">
        <div class="sc-top"><span class="beev-chip rose"><i data-lucide="${SCOPE_ICONS[i % SCOPE_ICONS.length]}"></i></span><div class="sc-titles"><span class="sc-idx">${String(i + 1).padStart(2, "0")}</span><h3>${esc(l.title)}</h3></div></div>
        <p>${esc(l.text)}</p>
      </div>`).join("");
  return `
  <section data-accent="rose">
    <div class="frame">
      ${head("02", "Périmètre", assets)}
      <h2 class="stitle sm">Ce que comprend l'audit</h2>
      <div class="body">
        <div class="scope-grid">${cards}</div>
      </div>
    </div>
    ${foot(cfg, n)}
  </section>`;
}

function comparisonSlide(cfg: AuditConseilConfig, n: number, assets?: AuditAssets): string {
  const c = cfg.comparison;
  const sizes = (c.fleetSizes || []).filter((s) => s > 0).slice(0, 4);
  const ecoUnit = Math.max(0, c.costThermique - c.costElectrique);
  const data = sizes.map((s) => ({ s, eco: s * ecoUnit }));
  const maxEco = Math.max(...data.map((d) => d.eco), 1);
  const max = data[data.length - 1];
  const bars = data.map((d) => `
            <div class="bar-col">
              <span class="bar-val">− ${eurInt(d.eco)}</span>
              <div class="bar" style="height:${Math.max(8, Math.round((d.eco / maxEco) * 100))}%;"></div>
              <span class="bar-lbl"><b>${d.s} véhicules</b>économie&nbsp;/ an</span>
            </div>`).join("");
  const elecFill = c.costThermique > 0 ? Math.round((c.costElectrique / c.costThermique) * 100) : 78;
  return `
  <section data-accent="rose">
    <div class="frame">
      ${head("03", "Projection économique", assets)}
      <h2 class="stitle sm">Thermique vs électrique</h2>
      <div class="body split" style="margin-top:34px;">
        <div style="display:flex; flex-direction:column; min-width:0;">
          <div class="savings-hero">
            <span class="beev-chip ghost sh-chip"><i data-lucide="piggy-bank"></i></span>
            <div class="sh-text">
              <span class="sh-big">jusqu'à ${eurInt(max ? max.eco : 0)}</span>
              <span class="sh-txt">d'économies&nbsp;/ an sur ${max ? max.s : 0} véhicules</span>
            </div>
          </div>
          <div class="chart">${bars}</div>
        </div>
        <div class="tco-compare">
          <span class="tco-head">TCO moyen par véhicule&nbsp;/ an</span>
          <div class="tco-rows">
            <div class="tcr">
              <div class="tcr-line"><span class="tcr-l">Thermique</span><span class="tcr-v">${eurInt(c.costThermique)}</span></div>
              <div class="tcr-track"><span class="tcr-fill therm" style="width:100%;"></span></div>
            </div>
            <div class="tcr">
              <div class="tcr-line"><span class="tcr-l">Électrique</span><span class="tcr-v">${eurInt(c.costElectrique)}</span></div>
              <div class="tcr-track"><span class="tcr-fill elec" style="width:${elecFill}%;"></span></div>
            </div>
          </div>
          <div class="tco-eco">
            <span class="te-k">Économie électrique</span>
            <span class="te-v">− ${eurInt(ecoUnit)}</span>
            <span class="te-l">par véhicule et par an</span>
          </div>
        </div>
      </div>
      <p class="note">Économie = écart de TCO moyen annuel (thermique − électrique) × nombre de véhicules, soit (${eurInt(c.costThermique)} − ${eurInt(c.costElectrique)}) = ${eurInt(ecoUnit)} par véhicule et par an. Le TCO intègre le loyer (LLD), l'énergie, l'entretien, l'assurance et la fiscalité (TVS, malus, avantage en nature). Moyennes de marché, affinées par segment lors de l'audit.</p>
    </div>
    ${foot(cfg, n)}
  </section>`;
}

function tarifSlide(cfg: AuditConseilConfig, n: number, assets?: AuditAssets): string {
  const main = cfg.tarifsSansEngagement.filter(isOn)[0];
  const steps = cfg.etapes.filter(isOn).slice(0, 5).map((e, i) => `
          <div class="step">
            <span class="st-num">${i + 1}</span>
            <h4>${esc(e.title)}</h4>
            ${e.text ? `<p>${esc(e.text)}</p>` : ""}
          </div>`).join("");
  const band = main ? `
        <div class="price-band">
          <div class="pb-left">
            <div class="pb-tag">${esc(main.prestation)}</div>
            <h3>${esc(main.sub || "Prestation indépendante")}</h3>
            <p>Diagnostic complet du parc, calcul TCO, recommandations véhicules et plan de déploiement bornes.</p>
          </div>
          <div class="pb-price">
            <span class="pp-num">${nbsp(esc(main.tarif))}</span><span class="pp-unit">HT</span>
            <div class="pp-note">${esc(main.modalite || "Sans engagement")}</div>
          </div>
        </div>` : "";
  return `
  <section data-accent="rose">
    <div class="frame">
      ${head("04", "Tarification & déroulé", assets)}
      <h2 class="stitle sm">Une prestation autonome, sans engagement</h2>
      <div class="body" style="margin-top:36px;">
        ${band}
        <span class="steps-label">Déroulé de la mission</span>
        <div class="steps">${steps}</div>
      </div>
    </div>
    ${foot(cfg, n)}
  </section>`;
}

function launchSlide(cfg: AuditConseilConfig, n: number, assets?: AuditAssets): string {
  const lead = cfg.ctaText ? esc(cfg.ctaText) : "Pour lancer l'audit, deux étapes suffisent.";
  const signer = cfg.signature || cfg.preparedBy || "Votre interlocuteur Beev";
  return `
  <section data-accent="rose" class="dark">
    <div class="frame">
      ${head("05", "Prochaines étapes", assets, true)}
      <div class="launch-body">
        <div class="launch-left">
          <p class="ll-lead">${lead}</p>
          <ul class="launch-steps">
            <li><span class="ls-dot"></span><span>Transmettez votre fichier de parc (Excel) à votre interlocuteur Beev.</span></li>
            <li><span class="ls-dot"></span><span>Confirmez les clauses de confidentialité.</span></li>
            <li><span class="ls-dot"></span><span>Nous revenons vers vous pour planifier le premier rendez-vous.</span></li>
          </ul>
        </div>
        <div class="launch-right">
          <div class="contact-card">
            <div class="cc-tag">Votre interlocuteur Beev</div>
            <p class="cc-name">${esc(signer)}</p>
            <p class="cc-role">Conseiller mobilité électrique</p>
            <div class="cc-line"><span class="cl-k">Adresse</span><span class="cl-v"><i data-lucide="map-pin"></i>5 rue Pleyel, 93200 Saint-Denis</span></div>
            <div class="cc-line"><span class="cl-k">En ligne</span><span class="cl-v"><i data-lucide="globe"></i>www.beev.co</span></div>
          </div>
        </div>
      </div>
    </div>
    ${foot(cfg, n, true)}
  </section>`;
}

function closingSlide(assets?: AuditAssets): string {
  return `
  <section data-accent="rose" class="dark closing">
    ${logoImg(assets?.logoLight, "closing-mono", false)}
    <div class="closing-center">
      <p class="closing-kicker">Proposition valable 2026&nbsp;· prix HT, sans engagement</p>
      <h2 class="closing-tagline">Time for electric</h2>
    </div>
    <div class="closing-foot">Beev&nbsp;· 5 rue Pleyel, 93200 Saint-Denis&nbsp;· www.beev.co</div>
  </section>`;
}

export function buildAuditDeckHtml(cfg: AuditConseilConfig, fonts?: RoobertFonts, assets?: AuditAssets): string {
  // Ordre des slides ; la projection économique n'apparaît que si activée.
  const builders: Array<(n: number) => string> = [
    () => coverSlide(cfg, assets),
    (n) => enjeuxSlide(cfg, n, assets),
    (n) => scopeSlide(cfg, n, assets),
  ];
  if (cfg.comparison?.enabled) builders.push((n) => comparisonSlide(cfg, n, assets));
  builders.push((n) => tarifSlide(cfg, n, assets));
  builders.push((n) => launchSlide(cfg, n, assets));
  builders.push(() => closingSlide(assets));

  const slides = builders.map((b, i) => `<div class="slide">${b(i + 1)}</div>`).join("\n");

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" />
<title>Audit & conseil ${esc(cfg.clientName)} × Beev — présentation</title>
<style>
${fontFaceCss(fonts)}
:root{
  --black:#1D1D1D; --beige:#FCF9F2; --white:#FFFFFF;
  --rose:#F4B8AA; --bleu:#A5D2FF; --violet:#D3CCD8;
  --rose-50:#FADCD4; --rose-30:#FCEAE5; --rose-20:#FDF1EE;
  --bleu-50:#D2E8FF; --bleu-30:#E4F2FF; --bleu-20:#EDF6FF;
  --violet-50:#E9E6EC; --violet-30:#F2F0F3; --violet-20:#F6F5F7;
  --good:#6CBE5E; --warning:#F27B39; --error:#ED3E3E;
  --fg-1:#1D1D1D; --fg-2:#4A4A4A; --fg-3:#7A7A7A; --fg-muted:#A6A6A6;
  --border-subtle:rgba(29,29,29,.10);
  --shadow-sm:0 2px 8px rgba(29,29,29,.06);
  --font:'Roobert','Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  --accent:var(--rose); --accent-50:var(--rose-50); --accent-30:var(--rose-30); --accent-20:var(--rose-20);
  --s:.62;
}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
section{font-family:var(--font);background:var(--beige);color:var(--fg-1);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow:hidden;}
[data-accent="rose"]{--accent:var(--rose);--accent-50:var(--rose-50);--accent-30:var(--rose-30);--accent-20:var(--rose-20);}

.frame{position:absolute; inset:0; padding:80px 104px 76px; display:flex; flex-direction:column;}
.shead{display:flex; align-items:flex-start; justify-content:space-between; gap:40px;}
.eyebrow{display:flex; align-items:center; gap:18px;}
.eynum{font-size:20px; font-weight:600; letter-spacing:.02em; color:var(--fg-1); background:var(--accent); width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex:none;}
.eylabel{font-size:21px; font-weight:600; letter-spacing:.16em; text-transform:uppercase; color:var(--fg-2);}
.brand-mark{height:34px; width:auto; opacity:.9;}
span.brand-mark{font-size:30px;}
.stitle{font-size:62px; line-height:1.02; font-weight:600; letter-spacing:-.02em; margin:30px 0 0; max-width:23ch;}
.stitle.sm{font-size:50px;}
.ssub{font-size:25px; line-height:1.45; color:var(--fg-2); margin:20px 0 0; max-width:80ch; font-weight:400;}
.sfoot{position:absolute; left:104px; right:104px; bottom:40px; display:flex; align-items:center; justify-content:space-between; font-size:16px; color:var(--fg-muted); letter-spacing:.01em;}
.sfoot .dot{color:var(--accent);}
.pageno{font-weight:600; color:var(--fg-3); font-variant-numeric:tabular-nums;}
.body{flex:1; min-height:0; display:flex; flex-direction:column; margin-top:46px;}
.body.split{flex-direction:row; gap:64px; align-items:stretch;}
.body.split > *{flex:1; min-width:0;}
.note{font-size:19px; color:var(--fg-3); line-height:1.45; border-left:3px solid var(--accent); padding-left:20px; margin-top:auto;}
b,strong{font-weight:600;}

/* cover */
.cover{position:relative; background:var(--black);}
.cover-content{position:absolute; left:104px; top:96px; right:104px;}
.cover-logo{height:42px; width:auto; margin-bottom:0;}
span.cover-logo{font-size:40px;}
.cover-top{display:flex; align-items:center; justify-content:space-between; gap:40px; margin-bottom:90px;}
.cobrand{display:flex; align-items:center; gap:18px; background:var(--beige); border-radius:16px; padding:16px 26px;}
.cobrand .cb-label{font-size:14px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--fg-3); max-width:9ch; line-height:1.25;}
.cobrand .cb-sep{width:1px; height:40px; background:var(--border-subtle);}
.cb-wordmark{font-size:26px; font-weight:600; letter-spacing:-.01em; color:var(--fg-1); line-height:1; white-space:nowrap;}
.cb-logo{max-height:46px; max-width:240px; width:auto; object-fit:contain; display:block;}
.cover-eyebrow{font-size:22px; font-weight:600; letter-spacing:.20em; text-transform:uppercase; color:var(--accent); margin-bottom:26px;}
.cover-title{font-size:96px; line-height:.98; font-weight:600; letter-spacing:-.025em; color:var(--beige); margin:0;}
.cover-meta{font-size:25px; color:rgba(252,249,242,.78); margin:28px 0 0; font-weight:500;}
.cover-rule{width:84px; height:4px; background:var(--accent); border-radius:2px; margin:46px 0 36px;}
.cover-lead{font-size:32px; font-weight:600; color:var(--beige); margin:0; letter-spacing:-.01em;}
.cover-detail{font-size:23px; color:rgba(252,249,242,.7); margin:14px 0 0; max-width:80ch;}
.cover-tags{display:flex; gap:14px; flex-wrap:wrap; margin-top:30px;}
.cover-tags span{font-size:18px; font-weight:500; color:var(--beige); border:1px solid rgba(252,249,242,.28); border-radius:999px; padding:10px 20px; letter-spacing:.01em;}
.cover-prep{font-size:20px; color:rgba(252,249,242,.7); margin:34px 0 0;}
.cover-prep b{color:var(--beige); font-weight:600;}
.cover-legal{position:absolute; left:104px; bottom:48px; right:104px; font-size:15px; color:rgba(252,249,242,.5); letter-spacing:.01em;}

/* icon chips */
.beev-chip{display:flex; align-items:center; justify-content:center; flex:none; border-radius:14px;}
.beev-chip svg{stroke-width:1.75;}
.beev-chip.rose{background:var(--accent); color:var(--fg-1);}
.beev-chip.ghost{background:rgba(252,249,242,.08); border:1px solid rgba(252,249,242,.20); color:var(--beige);}

/* enjeux */
.enjeux{display:grid; grid-template-columns:repeat(3,1fr); gap:28px; flex:1; min-height:0; align-content:stretch;}
.enjeu{background:var(--white); border:1px solid var(--border-subtle); border-radius:24px; padding:40px 38px; display:flex; flex-direction:column; overflow:hidden; box-shadow:var(--shadow-sm);}
.enjeu .en-head{display:flex; align-items:center; gap:16px; margin-bottom:28px;}
.enjeu .en-head .beev-chip{width:56px; height:56px;}
.enjeu .en-head .beev-chip svg{width:28px; height:28px;}
.enjeu .en-idx{font-size:17px; font-weight:600; letter-spacing:.16em; color:var(--fg-3); font-variant-numeric:tabular-nums;}
.enjeu h3{font-size:28px; line-height:1.12; font-weight:600; letter-spacing:-.01em; margin:0 0 16px;}
.enjeu p{font-size:20px; line-height:1.4; color:var(--fg-2); margin:0;}
.audit-disclaimer{font-size:15px; color:var(--fg-muted); margin:22px 0 0; flex:none;}

/* scope */
.scope-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:24px; flex:1; min-height:0; align-content:start;}
.scope{background:var(--white); border:1px solid var(--border-subtle); border-radius:22px; padding:30px 32px; display:flex; flex-direction:column; overflow:hidden; box-shadow:var(--shadow-sm);}
.scope .sc-top{display:flex; align-items:center; gap:15px; margin-bottom:16px;}
.scope .beev-chip{width:46px; height:46px; border-radius:12px;}
.scope .beev-chip svg{width:23px; height:23px;}
.scope .sc-titles{display:flex; flex-direction:column; gap:2px; min-width:0;}
.scope .sc-idx{font-size:12.5px; font-weight:600; letter-spacing:.16em; color:var(--fg-3); font-variant-numeric:tabular-nums;}
.scope h3{font-size:22px; line-height:1.12; font-weight:600; letter-spacing:-.005em; margin:0;}
.scope p{font-size:18.5px; line-height:1.4; color:var(--fg-2); margin:0;}

/* projection */
.savings-hero{display:flex; align-items:center; gap:22px; background:var(--black); color:var(--beige); border-radius:20px; padding:24px 32px; margin-top:4px; flex:none;}
.savings-hero .sh-chip{width:56px; height:56px; border-radius:15px;}
.savings-hero .sh-chip svg{width:28px; height:28px;}
.savings-hero .sh-text{display:flex; align-items:baseline; gap:16px; flex-wrap:wrap; min-width:0;}
.savings-hero .sh-big{font-size:46px; font-weight:600; letter-spacing:-.02em; color:var(--accent); font-variant-numeric:tabular-nums;}
.savings-hero .sh-txt{font-size:24px; font-weight:500; color:var(--beige);}
.chart{display:flex; align-items:flex-end; gap:34px; flex:1; min-height:0; margin-top:34px; padding-bottom:14px; border-bottom:1px solid var(--border-subtle);}
.bar-col{flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; gap:14px;}
.bar-val{font-size:36px; font-weight:600; letter-spacing:-.025em; color:var(--fg-1); font-variant-numeric:tabular-nums;}
.bar{width:100%; background:var(--accent); border-radius:14px 14px 0 0; min-height:8px;}
.bar-lbl{font-size:18px; color:var(--fg-3); font-weight:500; text-align:center; letter-spacing:.01em;}
.bar-lbl b{display:block; font-size:21px; color:var(--fg-1); font-weight:600; margin-bottom:2px;}
.tco-compare{display:flex; flex-direction:column; flex:0 0 388px; background:var(--white); border:1px solid var(--border-subtle); border-radius:20px; overflow:hidden; box-shadow:var(--shadow-sm);}
.tco-compare .tco-head{font-size:14px; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--fg-3); padding:30px 34px 0;}
.tco-rows{padding:26px 34px 30px; display:flex; flex-direction:column; gap:28px;}
.tcr-line{display:flex; align-items:baseline; justify-content:space-between; gap:14px; margin-bottom:13px;}
.tcr-l{font-size:21px; font-weight:500; color:var(--fg-1);}
.tcr-v{font-size:32px; font-weight:600; letter-spacing:-.02em; color:var(--fg-1); font-variant-numeric:tabular-nums; white-space:nowrap;}
.tcr-track{height:15px; background:rgba(29,29,29,.07); border-radius:999px; overflow:hidden;}
.tcr-fill{display:block; height:100%; border-radius:999px;}
.tcr-fill.therm{background:var(--rose);}
.tcr-fill.elec{background:var(--bleu);}
.tco-eco{margin-top:auto; background:var(--black); padding:24px 34px 26px; display:flex; flex-direction:column; gap:4px;}
.tco-eco .te-k{font-size:13px; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--bleu);}
.tco-eco .te-v{font-size:44px; font-weight:600; letter-spacing:-.025em; color:var(--bleu); font-variant-numeric:tabular-nums; line-height:1;}
.tco-eco .te-l{font-size:15px; color:rgba(252,249,242,.6); margin-top:2px;}

/* tarif */
.price-band{background:var(--black); color:var(--beige); border-radius:24px; padding:44px 48px; display:flex; align-items:center; justify-content:space-between; gap:48px; flex:none;}
.price-band .pb-left .pb-tag{font-size:16px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin-bottom:16px;}
.price-band .pb-left h3{font-size:34px; font-weight:600; letter-spacing:-.015em; margin:0 0 12px; color:var(--beige);}
.price-band .pb-left p{font-size:20px; color:rgba(252,249,242,.72); margin:0; max-width:54ch;}
.price-band .pb-price{text-align:right; flex:none;}
.price-band .pb-price .pp-num{font-size:64px; font-weight:600; letter-spacing:-.02em; color:var(--beige); font-variant-numeric:tabular-nums; line-height:1;}
.price-band .pb-price .pp-unit{font-size:24px; font-weight:500; color:rgba(252,249,242,.7); margin-left:8px;}
.price-band .pb-price .pp-note{font-size:17px; color:var(--accent); margin-top:12px; letter-spacing:.01em;}
.steps-label{font-size:17px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--fg-3); display:block; margin:38px 0 22px;}
.steps{display:grid; grid-template-columns:repeat(5,1fr); gap:0; flex:1; min-height:0;}
.step{position:relative; padding:0 26px 0 0; display:flex; flex-direction:column;}
.step .st-num{width:46px; height:46px; border-radius:50%; background:var(--accent); display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:600; color:var(--fg-1); margin-bottom:20px; flex:none; font-variant-numeric:tabular-nums;}
.step::before{content:""; position:absolute; left:46px; right:18px; top:23px; height:2px; background:var(--border-subtle);}
.step:last-child::before{display:none;}
.step h4{font-size:22px; font-weight:600; letter-spacing:-.005em; margin:0 0 10px;}
.step p{font-size:18px; line-height:1.4; color:var(--fg-2); margin:0;}

/* dark / launch / closing */
.dark{background:var(--black); color:var(--beige);}
.dark .stitle, .dark .ssub{color:var(--beige);}
.dark-foot{color:rgba(252,249,242,.4);}
.dark-foot .pageno{color:rgba(252,249,242,.55);}
.dark-foot .dot{color:var(--accent);}
.launch-body{flex:1; display:flex; gap:80px; align-items:stretch; margin-top:52px;}
.launch-left{flex:1; display:flex; flex-direction:column; justify-content:center; max-width:680px;}
.launch-left .ll-lead{font-size:30px; line-height:1.4; font-weight:500; color:var(--beige); margin:0 0 36px;}
.launch-steps{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:22px;}
.launch-steps li{display:flex; align-items:flex-start; gap:20px; font-size:22px; line-height:1.38; color:rgba(252,249,242,.82);}
.launch-steps .ls-dot{width:12px; height:12px; border-radius:4px; background:var(--accent); margin-top:9px; flex:none;}
.launch-right{flex:0 0 460px; display:flex; flex-direction:column; justify-content:center;}
.contact-card{background:rgba(252,249,242,.06); border:1px solid rgba(252,249,242,.16); border-radius:24px; padding:44px 44px;}
.contact-card .cc-tag{font-size:15px; font-weight:600; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); margin-bottom:24px;}
.contact-card .cc-name{font-size:42px; font-weight:600; letter-spacing:-.02em; color:var(--beige); margin:0 0 8px; line-height:1.05;}
.contact-card .cc-role{font-size:21px; color:rgba(252,249,242,.7); margin:0 0 30px;}
.contact-card .cc-line{display:flex; flex-direction:column; gap:6px; border-top:1px solid rgba(252,249,242,.16); padding-top:18px; margin-top:18px;}
.contact-card .cc-line .cl-k{font-size:14px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:rgba(252,249,242,.5);}
.contact-card .cc-line .cl-v{font-size:22px; font-weight:500; color:var(--beige); display:flex; align-items:center; gap:11px;}
.contact-card .cc-line .cl-v svg{width:19px; height:19px; stroke-width:1.75; color:var(--accent); flex:none;}
.closing{position:relative; display:flex; flex-direction:column; padding:96px 104px;}
/* align-self:flex-start + object-fit empêchent l'étirement horizontal du
   logo : sans ça, le conteneur flex-column (align-items:stretch par défaut)
   force l'img à toute la largeur et déforme le logo (lettres « melted »). */
.closing-mono{height:52px; width:auto; align-self:flex-start; object-fit:contain;}
span.closing-mono{font-size:48px; align-self:flex-start;}
.closing-center{flex:1; display:flex; flex-direction:column; justify-content:center;}
.closing-kicker{font-size:24px; color:rgba(252,249,242,.62); margin:0 0 28px; letter-spacing:.01em;}
.closing-tagline{font-size:140px; line-height:.94; font-weight:600; letter-spacing:-.03em; margin:0; color:var(--beige);}
.closing-foot{font-size:16px; color:rgba(252,249,242,.42); letter-spacing:.01em;}

/* ── mise à l'échelle écran + impression paysage ── */
.toolbar{position:fixed; top:16px; right:16px; z-index:100; display:flex; gap:8px;}
.toolbar button{font-family:var(--font); font-size:13px; font-weight:600; border:none; border-radius:10px; padding:10px 18px; cursor:pointer; background:var(--beige); color:var(--black);}
@media screen{
  body{background:#0c0c0c; padding:18px 0;}
  .slide{width:calc(1920px * var(--s)); height:calc(1080px * var(--s)); margin:0 auto 18px; position:relative; overflow:hidden; box-shadow:0 16px 48px rgba(0,0,0,.45); border-radius:6px;}
  .slide > section{position:absolute; top:0; left:0; width:1920px; height:1080px; transform:scale(var(--s)); transform-origin:top left;}
}
@media print{
  @page{size:1920px 1080px; margin:0;}
  html,body{background:#fff;}
  .toolbar{display:none;}
  .slide{width:1920px; height:1080px; position:relative; overflow:hidden; page-break-after:always;}
  .slide:last-child{page-break-after:auto;}
  .slide > section{position:absolute; top:0; left:0; width:1920px; height:1080px;}
}
</style>
<script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimer / PDF</button></div>
  ${slides}
  <script>
    function fitDeck(){
      var s = Math.min((window.innerWidth - 24) / 1920, 0.92);
      document.documentElement.style.setProperty('--s', String(s));
    }
    window.addEventListener('resize', fitDeck);
    fitDeck();
    function drawIcons(){ try { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); } catch (e) {} }
    drawIcons();
    window.addEventListener('load', drawIcons);
    var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    ready.then(drawIcons);
  </script>
</body></html>`;
}

async function fontToDataUrl(path: string): Promise<string | undefined> {
  try {
    const res = await fetch(path);
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

export async function generateAuditDeckPdf(cfg: AuditConseilConfig): Promise<void> {
  const win = window.open("", "_blank", "width=1400,height=900");
  if (!win) {
    alert("Le navigateur a bloqué la fenêtre. Autorisez les popups pour ce site puis relancez la présentation.");
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
  const html = buildAuditDeckHtml(cfg, { regular, medium, semibold }, { logoDark, logoLight });

  win.document.open();
  win.document.write(html);
  win.document.close();
}
