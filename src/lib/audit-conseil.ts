// Audit & conseil flotte — proposition commerciale « Audit & recommandation
// flotte avec approche TCO ». Conçue d'après le modèle Beev × FEV Group France :
// page de garde sombre (client, périmètre), contexte & enjeux identifiés, ce que
// comprend l'audit (livrables numérotés), tarification sans / avec engagement,
// processus en étapes, puis bandeau de lancement signé par le commercial.
//
// Même charte et même mécanique d'export que le BPU partenariat : HTML vectoriel
// imprimé via la fenêtre du navigateur, polices Roobert embarquées en base64.

export type AuditEnjeu = { title: string; text: string };
export type AuditLivrable = { title: string; text: string };
export type AuditTarifRow = {
  prestation: string;
  sub: string;
  modalite: string;
  // Couleur de la pastille « modalité » : rose (indépendant), bleu (offre), neutre.
  modaliteStyle: "rose" | "bleu" | "neutre";
  tarif: string;
};
export type AuditEtape = { title: string; text: string };

// Comparaison économique thermique vs électrique selon la taille de flotte.
// Les coûts sont saisis par véhicule et par an (TCO complet) ; le graphique
// projette le coût total et l'économie pour chaque taille de flotte.
export type AuditComparison = {
  enabled: boolean;
  costThermique: number;   // € / an / véhicule (thermique)
  costElectrique: number;  // € / an / véhicule (électrique)
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
    approach: "Cartographie du parc, calcul du coût total de détention et recommandations véhicules.",
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
      { title: "Recommandations véhicules", text: "Comparatif loyers VE, hybrides rechargeables et non rechargeables." },
      { title: "Projection d'économies", text: "Gains estimés sur 12 / 24 / 36 mois selon scénarios de renouvellement." },
      { title: "Plan déploiement bornes", text: "Offre nationale bornes domicile et sites, analyse fiscale." },
      { title: "Restitution direction", text: "Présentation exécutive prête pour comité de direction, avec arbitrage." },
    ],
    tarifsSansEngagement: [
      { prestation: "Audit TCO + recommandations", sub: "Livrables 01 à 06 — prestation autonome", modalite: "Prestation indépendante", modaliteStyle: "rose", tarif: "5 000 €" },
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

// Bloc @font-face Roobert (identique au BPU : embarque les data-URLs si fournies).
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

// Petit label de section : barre d'accent + intitulé en capitales espacées.
function sectionLabel(text: string, accent = "rose"): string {
  return `<div class="sec-label"><span class="sec-bar ${accent}"></span>${esc(text)}</div>`;
}

function heroBlock(cfg: AuditConseilConfig): string {
  const eyebrow = `Proposition commerciale${cfg.clientName ? " · " + esc(cfg.clientName) + " × Beev" : " · Beev"}`;
  const chips = [cfg.fleetSize, cfg.sites, cfg.date]
    .filter((c) => c && c.trim())
    .map((c) => `<span class="chip">${esc(c)}</span>`)
    .join("");
  const prepared = cfg.preparedBy ? `<div class="hero-prepared">Préparé par <strong>${esc(cfg.preparedBy)}</strong></div>` : "";
  const logo = cfg.clientLogoUrl ? `<img class="hero-logo" src="${esc(cfg.clientLogoUrl)}" alt="Logo client" />` : "";
  return `
  <div class="hero">
    <div class="hero-top">
      <span class="hero-eyebrow">${eyebrow}</span>
      <span class="hero-wordmark">beev</span>
    </div>
    <div class="hero-main">
      ${logo ? `<div class="hero-logo-wrap">${logo}</div>` : ""}
      <h1 class="hero-title">${esc(cfg.title)}</h1>
      <span class="hero-rule"></span>
      <div class="hero-approach">${esc(cfg.approach)}</div>
      ${chips ? `<div class="chips">${chips}</div>` : ""}
      ${prepared}
    </div>
  </div>`;
}

function enjeuxBlock(cfg: AuditConseilConfig): string {
  if (!cfg.enjeux.length) return "";
  const accents = ["rose", "bleu", "violet"];
  const items = cfg.enjeux.map((e, i) => `
    <div class="enjeu ${accents[i % accents.length]}">
      <span class="enjeu-num">${String(i + 1).padStart(2, "0")}</span>
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
  if (!cfg.livrables.length) return "";
  const cards = cfg.livrables.map((l, i) => `
    <div class="liv-card">
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
  if (!rows.length) return "";
  const body = rows.map((r) => `
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
  if (!cfg.etapes.length) return "";
  const n = cfg.etapes.length;
  const steps = cfg.etapes.map((e, i) => `
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

// Graphique SVG : coût total annuel thermique vs électrique pour chaque taille
// de flotte, avec l'économie annuelle mise en avant. Vert = électrique (gain).
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

  const W = 700, H = 248, padT = 30, padB = 48, padL = 6, padR = 6;
  const chartH = H - padT - padB;
  const baseY = padT + chartH;
  const groupW = (W - padL - padR) / data.length;
  const barW = Math.min(38, groupW / 3.4);
  const gap = 9;

  const COL_TH = "#C4BBA9";   // thermique : taupe
  const COL_EL = "#1FA463";   // électrique : vert Beev
  const COL_ECO = "#157A48";  // économie : vert foncé

  const bars = data.map((d, i) => {
    const cx = padL + groupW * i + groupW / 2;
    const xTh = cx - barW - gap / 2;
    const xEl = cx + gap / 2;
    const hTh = Math.round((d.th / maxV) * chartH);
    const hEl = Math.round((d.el / maxV) * chartH);
    const yTh = baseY - hTh;
    const yEl = baseY - hEl;
    return `
      <rect x="${xTh.toFixed(1)}" y="${yTh}" width="${barW.toFixed(1)}" height="${hTh}" rx="4" fill="${COL_TH}" />
      <rect x="${xEl.toFixed(1)}" y="${yEl}" width="${barW.toFixed(1)}" height="${hEl}" rx="4" fill="${COL_EL}" />
      <text x="${cx.toFixed(1)}" y="${(Math.min(yTh, yEl) - 9).toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${COL_ECO}">- ${eurInt(d.eco)}</text>
      <text x="${cx.toFixed(1)}" y="${baseY + 19}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1A1A1A">${d.s} véhicules</text>
      <text x="${cx.toFixed(1)}" y="${baseY + 33}" text-anchor="middle" font-size="9" fill="#5F5F64">économie / an</text>`;
  }).join("");

  const svg = `
    <svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img">
      <line x1="${padL}" y1="${baseY}" x2="${W - padR}" y2="${baseY}" stroke="#E8E4DC" stroke-width="1.5" />
      ${bars}
    </svg>`;

  const max = data[data.length - 1];
  return `
  <div class="section">
    ${sectionLabel("Projection économique · thermique vs électrique", "vert")}
    <div class="chart-card">
      <div class="chart-head">
        <div class="chart-legend">
          <span class="lg"><span class="lg-dot" style="background:${COL_TH}"></span>Coût annuel thermique</span>
          <span class="lg"><span class="lg-dot" style="background:${COL_EL}"></span>Coût annuel électrique</span>
        </div>
        <div class="chart-hl">Jusqu'à <strong>${eurInt(max.eco)}</strong> d'économies / an sur ${max.s} véhicules</div>
      </div>
      ${svg}
      <div class="chart-foot">Base TCO : ${eurInt(c.costThermique)} / an / véhicule (thermique) contre ${eurInt(c.costElectrique)} / an / véhicule (électrique). Projection indicative, affinée lors de l'audit.</div>
    </div>
  </div>`;
}

function ctaBlock(cfg: AuditConseilConfig): string {
  if (!cfg.ctaText && !cfg.signature) return "";
  return `
  <div class="cta">
    <div class="cta-inner">
      <div class="cta-label">Pour lancer l'audit</div>
      <div class="cta-text">${esc(cfg.ctaText)}</div>
    </div>
    ${cfg.signature ? `<div class="cta-sign"><span class="cta-sign-label">Votre interlocuteur Beev</span><span class="cta-sign-name">${esc(cfg.signature)}</span></div>` : ""}
  </div>`;
}

function pageFoot(cfg: AuditConseilConfig, n: number, total: number): string {
  const foot = `Beev · 5 rue Pleyel, 93200 Saint-Denis · SAS au capital de 63 245,02 € · RCS Bobigny 851 682 807 · Prix HT`;
  return `<div class="foot"><span class="foot-mark">beev</span><span class="foot-legal">${esc(foot)}</span><span class="foot-page">${esc(cfg.date)} · ${n}/${total}</span></div>`;
}

export function buildAuditConseilHtml(cfg: AuditConseilConfig, fonts?: RoobertFonts): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" />
<base href="${origin}/" />
<title>Audit & conseil ${esc(cfg.clientName)} × Beev</title>
<style>
${fontFaceCss(fonts)}
  :root {
    --ink:#1A1A1A; --beige:#FBF8F1; --paper:#FFFFFF;
    --rose:#F4B8AA; --bleu:#A5D2FF; --violet:#D3CCD8; --vert:#1FA463;
    --sub:#6A6A6F; --rule:#E8E4DC;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 0; }
  html, body { font-family: 'Roobert','Inter',-apple-system,BlinkMacSystemFont,sans-serif; color: var(--ink); background: var(--beige); -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* Pages A4 délibérées : saut de page propre entre pages, jamais au milieu
     d'une section. */
  .page { position: relative; width: 210mm; height: 297mm; padding: 12mm 15mm 16mm; background: var(--beige); page-break-after: always; overflow: hidden; }
  .page:last-child { page-break-after: auto; }
  .section { margin-top: 16px; break-inside: avoid; page-break-inside: avoid; }
  .section:first-of-type { margin-top: 18px; }

  .sec-label { display: flex; align-items: center; gap: 9px; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: var(--sub); font-weight: 600; margin-bottom: 11px; }
  .sec-bar { width: 22px; height: 3px; border-radius: 2px; display: inline-block; }
  .sec-bar.rose { background: var(--rose); } .sec-bar.bleu { background: var(--bleu); } .sec-bar.violet { background: var(--violet); } .sec-bar.vert { background: var(--vert); }

  /* Hero cover */
  .hero { background: var(--ink); color: var(--beige); border-radius: 18px; padding: 26px 30px 28px; position: relative; overflow: hidden; }
  .hero::after { content: ""; position: absolute; right: -60px; top: -60px; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle, rgba(244,184,170,.22), transparent 70%); }
  .hero-top { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1; }
  .hero-eyebrow { font-size: 10px; letter-spacing: .22em; text-transform: uppercase; color: rgba(251,248,241,.72); font-weight: 600; }
  .hero-wordmark { font-size: 20px; font-weight: 700; letter-spacing: -.02em; }
  .hero-main { position: relative; z-index: 1; margin-top: 22px; }
  .hero-logo-wrap { margin-bottom: 16px; }
  .hero-logo { max-height: 40px; max-width: 170px; object-fit: contain; }
  .hero-title { font-size: 33px; line-height: 1.07; font-weight: 700; letter-spacing: -.025em; max-width: 88%; }
  .hero-rule { display: block; width: 52px; height: 4px; border-radius: 2px; background: var(--rose); margin: 14px 0; }
  .hero-approach { font-size: 13.5px; line-height: 1.55; color: rgba(251,248,241,.85); max-width: 82%; }
  .chips { display: flex; gap: 9px; margin-top: 16px; flex-wrap: wrap; }
  .chip { font-size: 11px; font-weight: 600; border: 1px solid rgba(251,248,241,.28); color: var(--beige); border-radius: 999px; padding: 6px 14px; }
  .hero-prepared { font-size: 12px; color: rgba(251,248,241,.7); margin-top: 14px; }
  .hero-prepared strong { color: var(--beige); font-weight: 700; }

  /* Enjeux : carte à liseré d'accent + numéro */
  .enjeux { display: flex; flex-direction: column; gap: 9px; }
  .enjeu { display: flex; gap: 16px; background: var(--paper); border: 1px solid var(--rule); border-left-width: 4px; border-radius: 12px; padding: 13px 16px; break-inside: avoid; }
  .enjeu.rose { border-left-color: var(--rose); } .enjeu.bleu { border-left-color: var(--bleu); } .enjeu.violet { border-left-color: var(--violet); }
  .enjeu-num { font-size: 18px; font-weight: 700; color: var(--rule); line-height: 1; flex-shrink: 0; width: 28px; }
  .enjeu.rose .enjeu-num { color: var(--rose); } .enjeu.bleu .enjeu-num { color: var(--bleu); } .enjeu.violet .enjeu-num { color: var(--violet); }
  .enjeu-title { font-size: 14.5px; font-weight: 700; margin-bottom: 4px; }
  .enjeu-text { font-size: 12px; color: var(--sub); line-height: 1.55; }

  /* Livrables : grille 3 colonnes */
  .liv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 11px; }
  .liv-card { background: var(--paper); border: 1px solid var(--rule); border-radius: 14px; padding: 15px; break-inside: avoid; }
  .liv-num { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; background: var(--beige); color: var(--ink); font-size: 12px; font-weight: 700; }
  .liv-title { font-size: 14px; font-weight: 700; margin: 9px 0 6px; line-height: 1.22; }
  .liv-text { font-size: 11.5px; color: var(--sub); line-height: 1.55; }

  /* Tarifs : carte avec en-tête + lignes */
  .tarif-card { background: var(--paper); border: 1px solid var(--rule); border-radius: 14px; overflow: hidden; }
  .tarif-head { display: grid; grid-template-columns: 1fr 170px 130px; gap: 16px; padding: 12px 20px; background: #F6F2E9; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--sub); font-weight: 600; }
  .tarif-head .r { text-align: right; }
  .tarif-row { display: grid; grid-template-columns: 1fr 170px 130px; gap: 16px; align-items: center; padding: 14px 20px; border-top: 1px solid var(--rule); }
  .tarif-presta-title { font-size: 14.5px; font-weight: 700; }
  .tarif-presta-sub { font-size: 10.5px; color: var(--sub); line-height: 1.5; margin-top: 5px; }
  .tarif-tarif { font-size: 17px; font-weight: 700; text-align: right; white-space: nowrap; }
  .pill { display: inline-block; font-size: 10px; font-weight: 700; border-radius: 999px; padding: 5px 12px; white-space: nowrap; }
  .pill.rose { background: #FBE6DF; color: #99503A; } .pill.bleu { background: #E2F0FF; color: #1E5A99; } .pill.neutre { background: #EFEDE7; color: var(--sub); }

  /* Graphique */
  .chart-card { background: var(--paper); border: 1px solid var(--rule); border-radius: 14px; padding: 16px 20px; break-inside: avoid; }
  .chart-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 8px; flex-wrap: wrap; }
  .chart-legend { display: flex; gap: 18px; }
  .lg { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; color: var(--sub); font-weight: 600; }
  .lg-dot { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
  .chart-hl { font-size: 12px; font-weight: 600; color: var(--ink); background: #E7F6EE; border: 1px solid #BFE6CF; border-radius: 999px; padding: 6px 14px; }
  .chart-hl strong { color: var(--vert); }
  .chart-foot { font-size: 10px; color: var(--sub); line-height: 1.5; margin-top: 12px; }

  /* Stepper */
  .steps { position: relative; display: grid; grid-template-columns: repeat(var(--steps), 1fr); gap: 8px; padding-top: 4px; }
  .steps-line { position: absolute; top: 16px; left: 8%; right: 8%; height: 2px; background: var(--rule); }
  .step { position: relative; text-align: center; z-index: 1; }
  .step-dot { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 999px; background: var(--ink); color: var(--beige); font-size: 12px; font-weight: 700; margin-bottom: 10px; }
  .step-title { font-size: 12px; font-weight: 700; }
  .step-text { font-size: 10px; color: var(--sub); line-height: 1.45; margin-top: 4px; padding: 0 4px; }

  /* CTA */
  .cta { background: var(--ink); color: var(--beige); border-radius: 16px; padding: 22px 28px; margin-top: 18px; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; break-inside: avoid; }
  .cta-label { font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: rgba(251,248,241,.7); font-weight: 600; margin-bottom: 10px; }
  .cta-text { font-size: 13px; line-height: 1.6; color: rgba(251,248,241,.92); max-width: 460px; }
  .cta-sign { text-align: right; flex-shrink: 0; }
  .cta-sign-label { display: block; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: rgba(251,248,241,.6); margin-bottom: 4px; }
  .cta-sign-name { font-size: 15px; font-weight: 700; }

  /* Pied de page */
  .foot { position: absolute; left: 16mm; right: 16mm; bottom: 11mm; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 8px; color: var(--sub); border-top: 1px solid var(--rule); padding-top: 9px; }
  .foot-mark { font-size: 13px; font-weight: 700; color: var(--ink); }
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
    ${heroBlock(cfg)}
    ${enjeuxBlock(cfg)}
    ${livrablesBlock(cfg)}
    ${pageFoot(cfg, 1, 2)}
  </section>
  <section class="page">
    ${comparisonBlock(cfg)}
    ${tarifTable("Tarification sans engagement", cfg.tarifsSansEngagement, "rose")}
    ${tarifTable("Tarification avec engagement", cfg.tarifsAvecEngagement, "bleu")}
    ${etapesBlock(cfg)}
    ${ctaBlock(cfg)}
    ${pageFoot(cfg, 2, 2)}
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
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Audit…</title></head><body style="font-family:system-ui;padding:48px;color:#5F5F64">Préparation de la proposition…</body></html>');

  const [regular, medium, semibold] = await Promise.all([
    fontToDataUrl("/fonts/Roobert-Regular.ttf"),
    fontToDataUrl("/fonts/Roobert-Medium.ttf"),
    fontToDataUrl("/fonts/Roobert-SemiBold.ttf"),
  ]);
  const html = buildAuditConseilHtml(cfg, { regular, medium, semibold });

  win.document.open();
  win.document.write(html);
  win.document.close();
}
