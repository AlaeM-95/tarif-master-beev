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
    ctaText: "Pour lancer l'audit : transmettez votre fichier de parc (Excel) à votre interlocuteur Beev et confirmez les clauses de confidentialité. Nous revenons vers vous sous 48 h pour planifier le premier rendez-vous.",
    signature: "",
  };
}

export function newEnjeu(): AuditEnjeu { return { title: "Nouvel enjeu", text: "" }; }
export function newLivrable(): AuditLivrable { return { title: "Nouveau livrable", text: "" }; }
export function newTarifRow(): AuditTarifRow { return { prestation: "Nouvelle prestation", sub: "", modalite: "Modalité", modaliteStyle: "neutre", tarif: "0 €" }; }
export function newEtape(): AuditEtape { return { title: "Nouvelle étape", text: "" }; }

const nbsp = (s: string) => s.replace(/ /g, " ").replace(/ /g, " ");
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

function heroBlock(cfg: AuditConseilConfig): string {
  const eyebrow = `Proposition commerciale${cfg.clientName ? " · " + esc(cfg.clientName) + " × Beev" : " · Beev"}`;
  const chips = [cfg.fleetSize, cfg.sites, cfg.date]
    .filter((c) => c && c.trim())
    .map((c) => `<span class="chip">${esc(c)}</span>`)
    .join("");
  const prepared = cfg.preparedBy ? `<div class="hero-prepared">Préparé par ${esc(cfg.preparedBy)}</div>` : "";
  const logo = cfg.clientLogoUrl ? `<img class="hero-logo" src="${esc(cfg.clientLogoUrl)}" alt="Logo client" />` : "";
  return `
  <div class="hero">
    <div class="hero-top">
      <span class="hero-eyebrow">${eyebrow}</span>
      ${logo}
    </div>
    <h1 class="hero-title">${esc(cfg.title)}</h1>
    <div class="hero-approach">${esc(cfg.approach)}</div>
    ${prepared}
    ${chips ? `<div class="chips">${chips}</div>` : ""}
  </div>`;
}

function enjeuxBlock(cfg: AuditConseilConfig): string {
  if (!cfg.enjeux.length) return "";
  const accents = ["rose", "bleu", "violet"];
  const items = cfg.enjeux.map((e, i) => `
    <div class="enjeu">
      <span class="enjeu-mark ${accents[i % accents.length]}"></span>
      <div class="enjeu-body">
        <div class="enjeu-title">${esc(e.title)}</div>
        <div class="enjeu-text">${esc(e.text)}</div>
      </div>
    </div>`).join("");
  return `
  <div class="block">
    <div class="eyebrow">Contexte & enjeux identifiés</div>
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
  <div class="block">
    <div class="eyebrow">Ce que comprend l'audit</div>
    <div class="liv-grid">${cards}</div>
  </div>`;
}

function tarifTable(title: string, rows: AuditTarifRow[]): string {
  if (!rows.length) return "";
  const body = rows.map((r) => `
    <tr>
      <td class="t-presta">
        <div class="t-presta-title">${esc(r.prestation)}</div>
        ${r.sub ? `<div class="t-presta-sub">${esc(r.sub)}</div>` : ""}
      </td>
      <td class="t-mod"><span class="pill ${r.modaliteStyle}">${esc(r.modalite)}</span></td>
      <td class="t-tarif">${nbsp(esc(r.tarif))}</td>
    </tr>`).join("");
  return `
  <div class="block">
    <div class="eyebrow">${esc(title)}</div>
    <table class="tarif-table">
      <thead><tr><th>Prestation</th><th>Modalité</th><th class="r">Tarif HT</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function etapesBlock(cfg: AuditConseilConfig): string {
  if (!cfg.etapes.length) return "";
  const steps = cfg.etapes.map((e, i) => `
    <div class="step">
      <span class="step-dot">${i + 1}</span>
      <div class="step-title">${esc(e.title)}</div>
      ${e.text ? `<div class="step-text">${esc(e.text)}</div>` : ""}
    </div>`).join('<span class="step-sep"></span>');
  return `
  <div class="block">
    <div class="eyebrow">Processus</div>
    <div class="steps">${steps}</div>
  </div>`;
}

function ctaBlock(cfg: AuditConseilConfig): string {
  if (!cfg.ctaText && !cfg.signature) return "";
  return `
  <div class="cta">
    <div class="cta-label">Pour lancer l'audit</div>
    <div class="cta-text">${esc(cfg.ctaText)}</div>
    ${cfg.signature ? `<div class="cta-sign">${esc(cfg.signature)}</div>` : ""}
  </div>`;
}

export function buildAuditConseilHtml(cfg: AuditConseilConfig, fonts?: RoobertFonts): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const foot = `Beev · 5 rue Pleyel, 93200 Saint-Denis · SAS au capital de 63 245,02 € · RCS Bobigny 851 682 807 · Prix HT`;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" />
<base href="${origin}/" />
<title>Audit & conseil ${esc(cfg.clientName)} × Beev</title>
<style>
${fontFaceCss(fonts)}
  :root { --ink:#1D1D1D; --beige:#FCF9F2; --rose:#F4B8AA; --bleu:#A5D2FF; --violet:#D3CCD8; --sub:#5F5F64; --rule:#E7E4DD; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 0; }
  html, body { font-family: 'Roobert','Inter',-apple-system,BlinkMacSystemFont,sans-serif; color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: 210mm; min-height: 297mm; padding: 16mm 16mm 14mm; background: var(--beige); }

  .eyebrow { font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: var(--sub); font-weight: 600; margin-bottom: 12px; }
  .block { margin-top: 20px; }

  /* Hero sombre */
  .hero { background: var(--ink); color: var(--beige); border-radius: 16px; padding: 26px 28px; }
  .hero-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .hero-eyebrow { font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: rgba(252,249,242,.7); font-weight: 600; }
  .hero-logo { max-height: 34px; max-width: 150px; object-fit: contain; }
  .hero-title { font-size: 34px; line-height: 1.08; font-weight: 700; letter-spacing: -.02em; margin: 16px 0 10px; max-width: 80%; }
  .hero-approach { font-size: 13px; color: rgba(252,249,242,.82); max-width: 80%; }
  .hero-prepared { font-size: 12px; color: rgba(252,249,242,.7); margin-top: 12px; }
  .chips { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
  .chip { font-size: 11px; font-weight: 600; background: rgba(252,249,242,.12); color: var(--beige); border-radius: 999px; padding: 5px 12px; }

  /* Enjeux */
  .enjeux { display: flex; flex-direction: column; gap: 10px; }
  .enjeu { display: flex; gap: 12px; background: #fff; border: 1px solid var(--rule); border-radius: 12px; padding: 14px 16px; }
  .enjeu-mark { flex-shrink: 0; width: 10px; height: 10px; border-radius: 3px; margin-top: 4px; }
  .enjeu-mark.rose { background: var(--rose); } .enjeu-mark.bleu { background: var(--bleu); } .enjeu-mark.violet { background: var(--violet); }
  .enjeu-title { font-size: 14px; font-weight: 700; margin-bottom: 3px; }
  .enjeu-text { font-size: 12px; color: var(--sub); line-height: 1.5; }

  /* Livrables */
  .liv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .liv-card { background: #fff; border: 1px solid var(--rule); border-radius: 12px; padding: 16px; }
  .liv-num { font-size: 11px; font-weight: 700; color: var(--sub); }
  .liv-title { font-size: 14px; font-weight: 700; margin: 8px 0 6px; line-height: 1.2; }
  .liv-text { font-size: 11.5px; color: var(--sub); line-height: 1.5; }

  /* Tarifs */
  .tarif-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--rule); border-radius: 12px; overflow: hidden; }
  .tarif-table th { text-align: left; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--sub); font-weight: 600; padding: 11px 16px; background: #faf7f0; border-bottom: 1px solid var(--rule); }
  .tarif-table th.r, .tarif-table td.t-tarif { text-align: right; }
  .tarif-table td { padding: 14px 16px; border-bottom: 1px solid var(--rule); vertical-align: middle; }
  .tarif-table tr:last-child td { border-bottom: none; }
  .t-presta-title { font-size: 14px; font-weight: 700; }
  .t-presta-sub { font-size: 10.5px; color: var(--sub); line-height: 1.45; margin-top: 4px; max-width: 320px; }
  .t-tarif { font-size: 15px; font-weight: 700; white-space: nowrap; }
  .pill { display: inline-block; font-size: 10px; font-weight: 700; border-radius: 999px; padding: 4px 10px; white-space: nowrap; }
  .pill.rose { background: #FBE6DF; color: #8A4A36; } .pill.bleu { background: #E2F0FF; color: #1E5A99; } .pill.neutre { background: #EFEDE7; color: var(--sub); }

  /* Étapes */
  .steps { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; }
  .step { flex: 1; text-align: center; }
  .step-dot { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 999px; background: var(--ink); color: var(--beige); font-size: 11px; font-weight: 700; margin-bottom: 8px; }
  .step-title { font-size: 12px; font-weight: 700; }
  .step-text { font-size: 10px; color: var(--sub); line-height: 1.4; margin-top: 3px; }
  .step-sep { align-self: center; height: 1px; flex: 0 0 16px; background: var(--rule); margin-top: -18px; }

  /* CTA */
  .cta { margin-top: 22px; background: var(--ink); color: var(--beige); border-radius: 14px; padding: 22px 26px; }
  .cta-label { font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: rgba(252,249,242,.7); font-weight: 600; margin-bottom: 8px; }
  .cta-text { font-size: 13px; line-height: 1.6; color: rgba(252,249,242,.92); max-width: 78%; }
  .cta-sign { font-size: 13px; font-weight: 700; margin-top: 14px; }

  .foot { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; font-size: 8.5px; color: var(--sub); border-top: 1px solid var(--rule); padding-top: 10px; }
  .foot .beev-mark { font-size: 14px; font-weight: 700; color: var(--ink); }

  .toolbar { position: fixed; top: 16px; right: 16px; z-index: 10; display: flex; gap: 8px; }
  .toolbar button { font-family: inherit; font-size: 13px; font-weight: 600; border: none; border-radius: 10px; padding: 10px 18px; cursor: pointer; background: var(--ink); color: #fff; }
  @media print { .toolbar { display: none; } }
  @media screen { body { background: #ECEAE4; padding: 24px 0; } .page { margin: 0 auto; box-shadow: 0 8px 30px rgba(0,0,0,.12); } }
</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">Télécharger le PDF</button></div>
  <section class="page">
    ${heroBlock(cfg)}
    ${enjeuxBlock(cfg)}
    ${livrablesBlock(cfg)}
    ${tarifTable("Tarification sans engagement", cfg.tarifsSansEngagement)}
    ${tarifTable("Tarification avec engagement", cfg.tarifsAvecEngagement)}
    ${etapesBlock(cfg)}
    ${ctaBlock(cfg)}
    <div class="foot"><span class="beev-mark">beev</span><span>${esc(foot)} · ${esc(cfg.date)}</span></div>
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
