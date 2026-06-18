// Audit & conseil flotte — proposition commerciale « Audit & recommandation
// flotte avec approche TCO ». Refonte v2 : branding Beev assumé (logo officiel,
// charte rose / bleu / violet / noir / beige), hiérarchie typographique nette,
// badges d'accent pleins, graphique de projection économique aux couleurs Beev
// et méthode de calcul TCO explicitée (moyennes de marché).
//
// Même mécanique d'export que le BPU partenariat : HTML vectoriel imprimé via la
// fenêtre du navigateur, polices Roobert et logos embarqués en base64.

// `enabled` (optionnel) : le commercial peut afficher / masquer chaque ligne
// dans le PDF depuis l'éditeur. undefined ou true = affiché ; false = masqué.
export type AuditEnjeu = { title: string; text: string; enabled?: boolean };
export type AuditLivrable = { title: string; text: string; enabled?: boolean };
export type AuditTarifRow = {
  prestation: string;
  sub: string;
  modalite: string;
  // Couleur de la pastille « modalité » : rose (indépendant), bleu (offre), neutre.
  modaliteStyle: "rose" | "bleu" | "neutre";
  tarif: string;
  enabled?: boolean;
};
export type AuditEtape = { title: string; text: string; enabled?: boolean };

// Une ligne est affichée tant qu'elle n'est pas explicitement désactivée.
const isOn = <T extends { enabled?: boolean }>(x: T): boolean => x.enabled !== false;

// Comparaison économique thermique vs électrique selon la taille de flotte.
// Les coûts sont des TCO MOYENS annuels par véhicule ; le graphique projette le
// coût total et l'économie pour chaque taille de flotte.
export type AuditComparison = {
  enabled: boolean;
  costThermique: number;   // TCO moyen € / an / véhicule (thermique)
  costElectrique: number;  // TCO moyen € / an / véhicule (électrique)
  fleetSizes: number[];    // tailles de flotte comparées, ex : [10, 25, 50, 80]
};

export type AuditConseilConfig = {
  clientName: string;      // "FEV Group France"
  clientLogoUrl: string;   // logo client (page de garde)
  date: string;            // "Avril 2026"
  title: string;           // titre de la proposition
  approach: string;        // ligne d'approche sous le titre
  preparedBy: string;      // nom du commercial (page de garde)
  fleetSize: string;       // chip "~80 véhicules"
  sites: string;           // chip "Rouen · Trappes"
  enjeux: AuditEnjeu[];
  livrables: AuditLivrable[];
  tarifsSansEngagement: AuditTarifRow[];
  tarifsAvecEngagement: AuditTarifRow[];
  etapes: AuditEtape[];
  comparison: AuditComparison;
  ctaText: string;         // bandeau de lancement (bas de page)
  signature: string;       // nom du signataire (commercial)
};

// Configuration par défaut reprenant le modèle FEV : le commercial part d'une
// proposition fonctionnelle et n'ajuste que le client, le périmètre et les prix.
export function defaultAuditConseil(): AuditConseilConfig {
  const now = new Date();
  const mois = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return {
    clientName: "",
    clientLogoUrl: "",
    date: mois.charAt(0).toUpperCase() + mois.slice(1),
    title: "Audit & recommandation flotte avec approche TCO",
    approach: "Cartographie de votre parc, calcul du coût total de détention et recommandations véhicules pour réduire vos coûts et cadrer votre transition électrique.",
    preparedBy: "",
    fleetSize: "~80 véhicules",
    sites: "Multi-sites",
    enjeux: [
      { title: "Multiplicité des acteurs & charge de gestion", text: "Plusieurs interlocuteurs loueurs et constructeurs, absence de référent unique, suivi chronophage du parc." },
      { title: "Optimisation des coûts insuffisante", text: "Politique véhicule basée sur le prix catalogue, peu de négociation constructeurs, TCO non piloté." },
      { title: "Transition électrique à cadrer", text: "Problématiques de recharge et d'autonomie sur les trajets. Enjeux fiscaux (avantage en nature, taxes véhicules) à anticiper." },
    ],
    livrables: [
      { title: "Inventaire & analyse du parc actuel", text: "Cartographie complète des contrats, loyers, kilométrages et dates d'échéance." },
      { title: "Calcul TCO par segment", text: "LLD, entretien, énergie, fiscalité (TVS / CVAE) et avantages en nature collaborateurs." },
      { title: "Recommandations véhicules", text: "Comparatif loyers véhicules électrique, hybrides rechargeable et non rechargeable." },
      { title: "Projection d'économies", text: "Gains estimés sur 12 / 24 / 36 mois selon scénarios de renouvellement." },
      { title: "Plan déploiement bornes", text: "Offre nationale bornes domicile et sites, analyse fiscale." },
      { title: "Restitution direction", text: "Présentation exécutive prête pour comité de direction, avec arbitrage." },
    ],
    tarifsSansEngagement: [
      { prestation: "Audit TCO + recommandations", sub: "Livrables 01 à 06 · prestation autonome", modalite: "Prestation indépendante", modaliteStyle: "rose", tarif: "5 000 €" },
    ],
    tarifsAvecEngagement: [
      { prestation: "Audit TCO + recommandations + accompagnement", sub: "Sous réserve de la signature d'un contrat-cadre d'un an avec Beev : engagement de volume sur le renouvellement des véhicules, acquisition de la solution Fleet Manager, ou volume d'installations de bornes défini.", modalite: "Offert sous conditions", modaliteStyle: "bleu", tarif: "Inclus" },
      { prestation: "Accès Fleet Manager", sub: "Pilotage du parc, suivi des coûts et des échéances, remboursement de l'énergie collaborateurs.", modalite: "Offre spéciale", modaliteStyle: "bleu", tarif: "8 € / mois / véhicule" },
    ],
    etapes: [
      { title: "Accord & RDV", text: "Cadrage du périmètre et planification." },
      { title: "Inventaire parc", text: "Collecte du fichier parc et des contrats." },
      { title: "Analyse Beev", text: "Calcul TCO et scénarios de renouvellement." },
      { title: "Restitution", text: "Présentation des recommandations à la direction." },
      { title: "Décision", text: "Arbitrage et plan de déploiement." },
    ],
    comparison: {
      enabled: true,
      costThermique: 10800,
      costElectrique: 8400,
      fleetSizes: [10, 25, 50, 80],
    },
    ctaText: "Pour lancer l'audit : transmettez votre fichier de parc (Excel) à votre interlocuteur Beev et confirmez les clauses de confidentialité. Nous revenons vers vous sous 48 h pour planifier le premier rendez-vous.",
    signature: "",
  };
}

export function newEnjeu(): AuditEnjeu { return { title: "Nouvel enjeu", text: "" }; }
export function newLivrable(): AuditLivrable { return { title: "Nouveau livrable", text: "" }; }
export function newTarifRow(): AuditTarifRow { return { prestation: "Nouvelle prestation", sub: "", modalite: "Modalité", modaliteStyle: "neutre", tarif: "0 €" }; }
export function newEtape(): AuditEtape { return { title: "Nouvelle étape", text: "" }; }

const nbsp = (s: string) => s.replace(/ /g, " ").replace(/ /g, " ");
const eurInt = (n: number) =>
  nbsp(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0));
const esc = (s: string): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Logos Beev officiels embarqués (base64). logoLight = blanc (sur fond sombre),
// logoDark = noir (sur fond clair).
export type AuditAssets = { logoDark?: string; logoLight?: string };

// Bloc @font-face Roobert (embarque les data-URLs si fournies, sinon /fonts).
export type RoobertFonts = { regular?: string; medium?: string; semibold?: string };
function fontFaceCss(fonts?: RoobertFonts): string {
  const src = (dataUrl: string | undefined, path: string) =>
    dataUrl ? `url('${dataUrl}') format('truetype')` : `url('${path}') format('truetype')`;
  return `
  @font-face { font-family: 'Roobert'; src: ${src(fonts?.regular, "/fonts/Roobert-Regular.ttf")}; font-weight: 400; font-display: block; }
  @font-face { font-family: 'Roobert'; src: ${src(fonts?.medium, "/fonts/Roobert-Medium.ttf")}; font-weight: 500; font-display: block; }
  @font-face { font-family: 'Roobert'; src: ${src(fonts?.semibold, "/fonts/Roobert-SemiBold.ttf")}; font-weight: 600; font-display: block; }
  @font-face { font-family: 'Roobert'; src: ${src(fonts?.semibold, "/fonts/Roobert-SemiBold.ttf")}; font-weight: 700; font-display: block; }`;
}

// Logo Beev (image officielle) ou repli wordmark texte.
function beevLogo(assets: AuditAssets | undefined, light: boolean, cls: string): string {
  const url = light ? assets?.logoLight : assets?.logoDark;
  if (url) return `<img class="${cls}" src="${url}" alt="Beev" />`;
  return `<span class="${cls} wordmark${light ? " light" : ""}">beev</span>`;
}

// Petit label de section : barre d'accent + intitulé en capitales espacées.
function sectionLabel(text: string, accent = "rose"): string {
  return `<div class="sec-label"><span class="sec-bar ${accent}"></span>${esc(text)}</div>`;
}

const ACCENTS = ["rose", "bleu", "violet"];

function heroBlock(cfg: AuditConseilConfig, assets?: AuditAssets): string {
  const eyebrow = `Proposition commerciale${cfg.clientName ? " · " + esc(cfg.clientName) + " × Beev" : " · Beev"}`;
  const chips = [cfg.fleetSize, cfg.sites, cfg.date]
    .filter((c) => c && c.trim())
    .map((c) => `<span class="chip">${esc(c)}</span>`)
    .join("");
  const prepared = cfg.preparedBy ? `<div class="hero-prepared">Préparé par <strong>${esc(cfg.preparedBy)}</strong></div>` : "";
  const clientLogo = cfg.clientLogoUrl
    ? `<div class="hero-client"><img src="${esc(cfg.clientLogoUrl)}" alt="Logo client" /></div>`
    : "";
  return `
  <div class="hero">
    <span class="orb orb-rose"></span>
    <span class="orb orb-bleu"></span>
    <div class="hero-top">
      <span class="hero-eyebrow">${eyebrow}</span>
      ${beevLogo(assets, true, "hero-logo")}
    </div>
    <div class="hero-main">
      ${clientLogo}
      <h1 class="hero-title">${esc(cfg.title)}</h1>
      <span class="hero-rule"></span>
      <div class="hero-approach">${esc(cfg.approach)}</div>
      ${chips ? `<div class="chips">${chips}</div>` : ""}
      ${prepared}
    </div>
  </div>`;
}

function enjeuxBlock(cfg: AuditConseilConfig): string {
  const list = cfg.enjeux.filter(isOn);
  if (!list.length) return "";
  const items = list.map((e, i) => `
    <div class="enjeu ${ACCENTS[i % ACCENTS.length]}">
      <span class="enjeu-badge">${String(i + 1).padStart(2, "0")}</span>
      <div class="enjeu-body">
        <div class="enjeu-title">${esc(e.title)}</div>
        <div class="enjeu-text">${esc(e.text)}</div>
      </div>
    </div>`).join("");
  return `
  <div class="section">
    ${sectionLabel("Contexte & enjeux identifiés", "rose")}
    <div class="enjeux">${items}</div>
  </div>`;
}

function livrablesBlock(cfg: AuditConseilConfig): string {
  const list = cfg.livrables.filter(isOn);
  if (!list.length) return "";
  const cards = list.map((l, i) => `
    <div class="liv-card ${ACCENTS[i % ACCENTS.length]}">
      <span class="liv-num">${String(i + 1).padStart(2, "0")}</span>
      <div class="liv-title">${esc(l.title)}</div>
      <div class="liv-text">${esc(l.text)}</div>
    </div>`).join("");
  return `
  <div class="section">
    ${sectionLabel("Ce que comprend l'audit", "bleu")}
    <div class="liv-grid">${cards}</div>
  </div>`;
}

function tarifTable(title: string, rows: AuditTarifRow[], accent: string): string {
  const list = rows.filter(isOn);
  if (!list.length) return "";
  const body = list.map((r) => `
    <div class="tarif-row">
      <div class="tarif-presta">
        <div class="tarif-presta-title">${esc(r.prestation)}</div>
        ${r.sub ? `<div class="tarif-presta-sub">${esc(r.sub)}</div>` : ""}
      </div>
      <div class="tarif-mod"><span class="pill ${r.modaliteStyle}">${esc(r.modalite)}</span></div>
      <div class="tarif-tarif">${nbsp(esc(r.tarif))}</div>
    </div>`).join("");
  return `
  <div class="section">
    ${sectionLabel(title, accent)}
    <div class="tarif-card">
      <div class="tarif-head"><span>Prestation</span><span>Modalité</span><span class="r">Tarif HT</span></div>
      ${body}
    </div>
  </div>`;
}

function etapesBlock(cfg: AuditConseilConfig): string {
  const list = cfg.etapes.filter(isOn);
  if (!list.length) return "";
  const n = list.length;
  const steps = list.map((e, i) => `
    <div class="step">
      <span class="step-dot">${i + 1}</span>
      <div class="step-title">${esc(e.title)}</div>
      ${e.text ? `<div class="step-text">${esc(e.text)}</div>` : ""}
    </div>`).join("");
  return `
  <div class="section">
    ${sectionLabel("Déroulé de la mission", "violet")}
    <div class="steps" style="--steps:${n}">
      <span class="steps-line"></span>
      ${steps}
    </div>
  </div>`;
}

// Graphique SVG : TCO moyen annuel thermique vs électrique pour chaque taille de
// flotte. Couleurs charte Beev : rose (thermique, coût à réduire), bleu
// (électrique, solution Beev), noir pour l'économie (lisibilité).
function comparisonBlock(cfg: AuditConseilConfig): string {
  const c = cfg.comparison;
  if (!c || !c.enabled) return "";
  const sizes = (c.fleetSizes || []).filter((s) => s > 0);
  if (!sizes.length) return "";
  const data = sizes.map((s) => ({
    s,
    th: s * c.costThermique,
    el: s * c.costElectrique,
    eco: s * Math.max(0, c.costThermique - c.costElectrique),
  }));
  const maxV = Math.max(...data.map((d) => d.th), 1);

  const W = 700, H = 220, padT = 26, padB = 46, padL = 6, padR = 6;
  const chartH = H - padT - padB;
  const baseY = padT + chartH;
  const groupW = (W - padL - padR) / data.length;
  const barW = Math.min(38, groupW / 3.4);
  const gap = 9;

  const COL_TH = "#F4B8AA";   // thermique : rose Beev
  const COL_EL = "#A5D2FF";   // électrique : bleu Beev
  const COL_ECO = "#1D1D1D";  // économie : noir Beev

  const bars = data.map((d, i) => {
    const cx = padL + groupW * i + groupW / 2;
    const xTh = cx - barW - gap / 2;
    const xEl = cx + gap / 2;
    const hTh = Math.round((d.th / maxV) * chartH);
    const hEl = Math.round((d.el / maxV) * chartH);
    const yTh = baseY - hTh;
    const yEl = baseY - hEl;
    return `
      <rect x="${xTh.toFixed(1)}" y="${yTh}" width="${barW.toFixed(1)}" height="${hTh}" rx="5" fill="${COL_TH}" />
      <rect x="${xEl.toFixed(1)}" y="${yEl}" width="${barW.toFixed(1)}" height="${hEl}" rx="5" fill="${COL_EL}" />
      <text x="${cx.toFixed(1)}" y="${(Math.min(yTh, yEl) - 9).toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${COL_ECO}">- ${eurInt(d.eco)}</text>
      <text x="${cx.toFixed(1)}" y="${baseY + 19}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1D1D1D">${d.s} véhicules</text>
      <text x="${cx.toFixed(1)}" y="${baseY + 33}" text-anchor="middle" font-size="9" fill="#6A6A6F">économie / an</text>`;
  }).join("");

  const svg = `
    <svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img">
      <line x1="${padL}" y1="${baseY}" x2="${W - padR}" y2="${baseY}" stroke="#ECE7DD" stroke-width="1.5" />
      ${bars}
    </svg>`;

  const max = data[data.length - 1];
  const ecoUnit = Math.max(0, c.costThermique - c.costElectrique);
  return `
  <div class="section">
    ${sectionLabel("Projection économique · thermique vs électrique", "bleu")}
    <div class="chart-card">
      <div class="chart-head">
        <div class="chart-legend">
          <span class="lg"><span class="lg-dot" style="background:${COL_TH}"></span>TCO moyen thermique / an</span>
          <span class="lg"><span class="lg-dot" style="background:${COL_EL}"></span>TCO moyen électrique / an</span>
        </div>
        <div class="chart-hl">Jusqu'à <strong>${eurInt(max.eco)}</strong> d'économies / an sur ${max.s} véhicules</div>
      </div>
      ${svg}
      <div class="chart-method">
        <div class="chart-method-title">Comment lire ce calcul</div>
        <p>Économie = écart de <strong>TCO moyen annuel</strong> (thermique − électrique) × nombre de véhicules, soit (${eurInt(c.costThermique)} − ${eurInt(c.costElectrique)}) = <strong>${eurInt(ecoUnit)} par véhicule et par an</strong>. Le TCO moyen intègre le loyer (LLD), l'énergie, l'entretien, l'assurance et la fiscalité (TVS, malus, avantage en nature). Moyennes de marché, affinées par segment lors de l'audit.</p>
      </div>
    </div>
  </div>`;
}

function ctaBlock(cfg: AuditConseilConfig, assets?: AuditAssets): string {
  if (!cfg.ctaText && !cfg.signature) return "";
  return `
  <div class="cta">
    <span class="orb orb-rose"></span>
    <div class="cta-inner">
      <div class="cta-label">Pour lancer l'audit</div>
      <div class="cta-text">${esc(cfg.ctaText)}</div>
      <div class="cta-brand">${beevLogo(assets, true, "cta-logo")}</div>
    </div>
    ${cfg.signature ? `<div class="cta-sign"><span class="cta-sign-label">Votre interlocuteur Beev</span><span class="cta-sign-name">${esc(cfg.signature)}</span></div>` : ""}
  </div>`;
}

function pageFoot(cfg: AuditConseilConfig, assets: AuditAssets | undefined, n: number, total: number): string {
  const legal = `Beev · 5 rue Pleyel, 93200 Saint-Denis · SAS au capital de 63 245,02 € · RCS Bobigny 851 682 807 · Prix HT`;
  return `<div class="foot">${beevLogo(assets, false, "foot-mark")}<span class="foot-legal">${esc(legal)}</span><span class="foot-page">${esc(cfg.date)} · ${n}/${total}</span></div>`;
}

export function buildAuditConseilHtml(cfg: AuditConseilConfig, fonts?: RoobertFonts, assets?: AuditAssets): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" />
<base href="${origin}/" />
<title>Audit & conseil ${esc(cfg.clientName)} × Beev</title>
<style>
${fontFaceCss(fonts)}
  :root {
    --ink:#1D1D1D; --beige:#FCF9F2; --paper:#FFFFFF;
    --rose:#F4B8AA; --bleu:#A5D2FF; --violet:#D3CCD8;
    --rose-soft:#FCEDE8; --bleu-soft:#EAF3FF; --violet-soft:#F2EFF4;
    --sub:#6A6A6F; --rule:#ECE7DD;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 0; }
  html, body { font-family: 'Roobert','Inter',-apple-system,BlinkMacSystemFont,sans-serif; color: var(--ink); background: var(--beige); -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .page { position: relative; width: 210mm; height: 297mm; padding: 13mm 15mm 16mm; background: var(--beige); page-break-after: always; overflow: hidden; }
  .page:last-child { page-break-after: auto; }
  .section { margin-top: 13px; break-inside: avoid; page-break-inside: avoid; }
  .section:first-of-type { margin-top: 14px; }

  .wordmark { font-weight: 700; letter-spacing: -.02em; }
  .wordmark.light { color: var(--beige); }

  .sec-label { display: flex; align-items: center; gap: 10px; font-size: 10px; letter-spacing: .22em; text-transform: uppercase; color: var(--sub); font-weight: 700; margin-bottom: 12px; }
  .sec-bar { width: 24px; height: 3px; border-radius: 2px; display: inline-block; }
  .sec-bar.rose { background: var(--rose); } .sec-bar.bleu { background: var(--bleu); } .sec-bar.violet { background: var(--violet); }

  /* Hero cover — panneau noir Beev avec orbes de couleur charte */
  .hero { position: relative; background: var(--ink); color: var(--beige); border-radius: 22px; padding: 24px 30px 26px; overflow: hidden; }
  .orb { position: absolute; border-radius: 50%; filter: blur(2px); pointer-events: none; }
  .orb-rose { right: -70px; top: -70px; width: 240px; height: 240px; background: radial-gradient(circle, rgba(244,184,170,.30), transparent 68%); }
  .orb-bleu { left: -90px; bottom: -110px; width: 280px; height: 280px; background: radial-gradient(circle, rgba(165,210,255,.22), transparent 70%); }
  .hero-top { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1; }
  .hero-eyebrow { font-size: 10px; letter-spacing: .24em; text-transform: uppercase; color: rgba(252,249,242,.7); font-weight: 700; }
  .hero-logo { height: 22px; width: auto; object-fit: contain; }
  span.hero-logo { font-size: 21px; }
  .hero-main { position: relative; z-index: 1; margin-top: 20px; }
  .hero-client { display: inline-flex; align-items: center; background: #fff; border-radius: 12px; padding: 8px 12px; margin-bottom: 13px; }
  .hero-client img { max-height: 32px; max-width: 150px; object-fit: contain; display: block; }
  .hero-title { font-size: 30px; line-height: 1.07; font-weight: 700; letter-spacing: -.028em; max-width: 92%; }
  .hero-rule { display: block; width: 52px; height: 4px; border-radius: 2px; background: var(--rose); margin: 12px 0; }
  .hero-approach { font-size: 12.5px; line-height: 1.5; color: rgba(252,249,242,.86); max-width: 86%; }
  .chips { display: flex; gap: 9px; margin-top: 13px; flex-wrap: wrap; }
  .chip { font-size: 11px; font-weight: 600; background: rgba(252,249,242,.08); border: 1px solid rgba(252,249,242,.3); color: var(--beige); border-radius: 999px; padding: 5px 13px; }
  .hero-prepared { font-size: 12px; color: rgba(252,249,242,.7); margin-top: 12px; }
  .hero-prepared strong { color: var(--beige); font-weight: 700; }

  /* Enjeux : carte à liseré + badge plein dans la couleur d'accent */
  .enjeux { display: flex; flex-direction: column; gap: 8px; }
  .enjeu { display: flex; gap: 14px; align-items: flex-start; background: var(--paper); border: 1px solid var(--rule); border-left-width: 4px; border-radius: 13px; padding: 12px 16px; break-inside: avoid; }
  .enjeu.rose { border-left-color: var(--rose); } .enjeu.bleu { border-left-color: var(--bleu); } .enjeu.violet { border-left-color: var(--violet); }
  .enjeu-badge { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 9px; font-size: 12.5px; font-weight: 700; color: var(--ink); }
  .enjeu.rose .enjeu-badge { background: var(--rose); } .enjeu.bleu .enjeu-badge { background: var(--bleu); } .enjeu.violet .enjeu-badge { background: var(--violet); }
  .enjeu-title { font-size: 14.5px; font-weight: 700; margin-bottom: 4px; }
  .enjeu-text { font-size: 12px; color: var(--sub); line-height: 1.55; }

  /* Livrables : grille 3 colonnes, chip numéro coloré par accent */
  .liv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .liv-card { position: relative; background: var(--paper); border: 1px solid var(--rule); border-radius: 14px; padding: 13px 14px; break-inside: avoid; }
  .liv-card::before { content: ""; position: absolute; top: 0; left: 14px; right: 14px; height: 3px; border-radius: 0 0 3px 3px; }
  .liv-card.rose::before { background: var(--rose); } .liv-card.bleu::before { background: var(--bleu); } .liv-card.violet::before { background: var(--violet); }
  .liv-num { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; font-size: 12px; font-weight: 700; color: var(--ink); }
  .liv-card.rose .liv-num { background: var(--rose-soft); } .liv-card.bleu .liv-num { background: var(--bleu-soft); } .liv-card.violet .liv-num { background: var(--violet-soft); }
  .liv-title { font-size: 13.5px; font-weight: 700; margin: 9px 0 5px; line-height: 1.2; }
  .liv-text { font-size: 11px; color: var(--sub); line-height: 1.5; }

  /* Tarifs : carte avec en-tête + lignes */
  .tarif-card { background: var(--paper); border: 1px solid var(--rule); border-radius: 14px; overflow: hidden; }
  .tarif-head { display: grid; grid-template-columns: 1fr 170px 130px; gap: 16px; padding: 12px 20px; background: #F6F2E9; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: var(--sub); font-weight: 700; }
  .tarif-head .r { text-align: right; }
  .tarif-row { display: grid; grid-template-columns: 1fr 170px 130px; gap: 16px; align-items: center; padding: 15px 20px; border-top: 1px solid var(--rule); }
  .tarif-presta-title { font-size: 14.5px; font-weight: 700; }
  .tarif-presta-sub { font-size: 10.5px; color: var(--sub); line-height: 1.5; margin-top: 5px; }
  .tarif-tarif { font-size: 17px; font-weight: 700; text-align: right; white-space: nowrap; }
  .pill { display: inline-block; font-size: 10px; font-weight: 700; border-radius: 999px; padding: 5px 12px; white-space: nowrap; }
  .pill.rose { background: var(--rose-soft); color: #9A503A; } .pill.bleu { background: var(--bleu-soft); color: #1E5A99; } .pill.neutre { background: #EFEDE7; color: var(--sub); }

  /* Graphique */
  .chart-card { background: var(--paper); border: 1px solid var(--rule); border-radius: 14px; padding: 17px 20px; break-inside: avoid; }
  .chart-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 8px; flex-wrap: wrap; }
  .chart-legend { display: flex; gap: 18px; }
  .lg { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; color: var(--sub); font-weight: 600; }
  .lg-dot { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
  .chart-hl { font-size: 12px; font-weight: 600; color: var(--ink); background: var(--bleu-soft); border: 1px solid var(--bleu); border-radius: 999px; padding: 6px 14px; }
  .chart-hl strong { color: var(--ink); }
  .chart-method { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--rule); }
  .chart-method-title { font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: var(--sub); font-weight: 700; margin-bottom: 6px; }
  .chart-method p { font-size: 10.5px; color: var(--sub); line-height: 1.55; }
  .chart-method strong { color: var(--ink); font-weight: 700; }

  /* Stepper */
  .steps { position: relative; display: grid; grid-template-columns: repeat(var(--steps), 1fr); gap: 8px; padding-top: 4px; }
  .steps-line { position: absolute; top: 16px; left: 8%; right: 8%; height: 2px; background: var(--rule); }
  .step { position: relative; text-align: center; z-index: 1; }
  .step-dot { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 999px; background: var(--ink); color: var(--beige); font-size: 12px; font-weight: 700; margin-bottom: 10px; }
  .step-title { font-size: 12px; font-weight: 700; }
  .step-text { font-size: 10px; color: var(--sub); line-height: 1.45; margin-top: 4px; padding: 0 4px; }

  /* CTA */
  .cta { position: relative; overflow: hidden; background: var(--ink); color: var(--beige); border-radius: 18px; padding: 24px 30px; margin-top: 18px; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; break-inside: avoid; }
  .cta-inner { position: relative; z-index: 1; }
  .cta-label { font-size: 10px; letter-spacing: .22em; text-transform: uppercase; color: rgba(252,249,242,.7); font-weight: 700; margin-bottom: 10px; }
  .cta-text { font-size: 13px; line-height: 1.6; color: rgba(252,249,242,.92); max-width: 470px; }
  .cta-brand { margin-top: 16px; }
  .cta-logo { height: 18px; width: auto; }
  span.cta-logo { font-size: 17px; }
  .cta-sign { position: relative; z-index: 1; text-align: right; flex-shrink: 0; }
  .cta-sign-label { display: block; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: rgba(252,249,242,.6); margin-bottom: 4px; }
  .cta-sign-name { font-size: 15px; font-weight: 700; }

  /* Pied de page */
  .foot { position: absolute; left: 15mm; right: 15mm; bottom: 11mm; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 8px; color: var(--sub); border-top: 1px solid var(--rule); padding-top: 10px; }
  .foot-mark { height: 13px; width: auto; }
  span.foot-mark { font-size: 13px; font-weight: 700; color: var(--ink); }
  .foot-legal { flex: 1; text-align: center; }
  .foot-page { white-space: nowrap; font-weight: 600; }

  .toolbar { position: fixed; top: 16px; right: 16px; z-index: 10; display: flex; gap: 8px; }
  .toolbar button { font-family: inherit; font-size: 13px; font-weight: 600; border: none; border-radius: 10px; padding: 10px 18px; cursor: pointer; background: var(--ink); color: #fff; }
  @media print { .toolbar { display: none; } }
  @media screen { body { background: #E9E6DF; padding: 24px 0; } .page { margin: 0 auto 24px; box-shadow: 0 10px 36px rgba(0,0,0,.14); } }
</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">Télécharger le PDF</button></div>
  <section class="page">
    ${heroBlock(cfg, assets)}
    ${enjeuxBlock(cfg)}
    ${livrablesBlock(cfg)}
    ${pageFoot(cfg, assets, 1, 2)}
  </section>
  <section class="page">
    ${comparisonBlock(cfg)}
    ${tarifTable("Tarification sans engagement", cfg.tarifsSansEngagement, "rose")}
    ${tarifTable("Tarification avec engagement", cfg.tarifsAvecEngagement, "bleu")}
    ${etapesBlock(cfg)}
    ${ctaBlock(cfg, assets)}
    ${pageFoot(cfg, assets, 2, 2)}
  </section>
  <script>
    (function () {
      function go() { try { window.focus(); window.print(); } catch (e) {} }
      var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      ready.then(function () { setTimeout(go, 200); });
    })();
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

export async function generateAuditConseilPdf(cfg: AuditConseilConfig): Promise<void> {
  const win = window.open("", "_blank", "width=1200,height=900");
  if (!win) {
    alert("Le navigateur a bloqué la fenêtre d'impression. Autorisez les popups pour ce site puis relancez la génération.");
    return;
  }
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Audit…</title></head><body style="font-family:system-ui;padding:48px;color:#6A6A6F">Préparation de la proposition…</body></html>');

  const [regular, medium, semibold, logoDark, logoLight] = await Promise.all([
    fontToDataUrl("/fonts/Roobert-Regular.ttf"),
    fontToDataUrl("/fonts/Roobert-Medium.ttf"),
    fontToDataUrl("/fonts/Roobert-SemiBold.ttf"),
    fontToDataUrl("/images/logo-beev-noir.png"),
    fontToDataUrl("/images/logo-beev-white.png"),
  ]);
  const html = buildAuditConseilHtml(cfg, { regular, medium, semibold }, { logoDark, logoLight });

  win.document.open();
  win.document.write(html);
  win.document.close();
}
