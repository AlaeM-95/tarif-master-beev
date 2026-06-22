// Devis « Audit & conseil flotte » — document commercial contractuel dérivé de
// la présentation Audit & conseil. À la différence de la proposition (qui vend
// la mission), le devis l'engage : en-tête émetteur/destinataire, tableau de
// prestations chiffrées HT, récapitulatif HT / TVA / TTC, acompte, conditions,
// zone d'acceptation « Bon pour accord » et mentions légales.
//
// Le commercial décide quoi afficher : chaque ligne et chaque section porte un
// toggle. Même charte Beev (rose / bleu / violet / noir / beige) et même échelle
// typographique que la présentation. Export identique : HTML imprimé via la
// fenêtre du navigateur, polices Roobert et logos embarqués en base64.

import {
  esc, nbsp, fontFaceCss, beevLogo, fontToDataUrl,
  type AuditConseilConfig, type AuditAssets, type RoobertFonts,
} from "./audit-conseil";

// Une ligne de prestation. `isOption` / `isRecurring` : ligne affichée mais
// EXCLUE du total ponctuel (ex. abonnement Fleet Manager facturé au mois).
export type DevisLine = {
  designation: string;
  detail: string;        // texte multi-ligne ; lignes « - » ou « • » = puces
  qty: number;
  unit: string;          // "forfait", "véhicule", "mois"…
  unitPriceHt: number;
  isOption?: boolean;
  isRecurring?: boolean;
  enabled?: boolean;
};

export type DevisCondition = { text: string; enabled?: boolean };

// Sections affichables : le commercial coche ce qu'il veut dans le devis.
export type DevisShow = {
  emitterLegal: boolean;
  client: boolean;
  objet: boolean;
  table: boolean;
  recap: boolean;
  deposit: boolean;
  conditions: boolean;
  acceptance: boolean;
  footerLegal: boolean;
};

export type DevisInfo = {
  number: string;          // "DEV-2026-0001"
  issueDate: string;       // "22 juin 2026"
  validityDate: string;    // "22 juillet 2026"
  advisor: string;         // conseiller Beev
  advisorPhone: string;
  emitterLegal: string[];  // lignes de coordonnées émetteur (Beev)
  clientAddress: string;
  clientContact: string;
  clientRef: string;
  tvaRate: number;         // 20
  depositPct: number;      // 30 (0 = pas d'acompte affiché)
  lines: DevisLine[];
  conditions: DevisCondition[];
  acceptanceText: string;
  footerLegal: string;
  siret: string;           // établissement (éditable, vide par défaut)
  iban: string;            // éditable, vide par défaut
  show: DevisShow;
};

export function newDevisLine(): DevisLine {
  return { designation: "Nouvelle prestation", detail: "", qty: 1, unit: "forfait", unitPriceHt: 0, enabled: true };
}
export function newDevisCondition(): DevisCondition {
  return { text: "Nouvelle condition", enabled: true };
}

const isOn = <T extends { enabled?: boolean }>(x: T): boolean => x.enabled !== false;

// Configuration par défaut, dérivée de la présentation (mêmes prestations,
// mêmes prix). Le commercial part d'un devis fonctionnel et ajuste.
export function defaultDevisInfo(cfg?: Partial<AuditConseilConfig>): DevisInfo {
  const now = new Date();
  const fmt = (d: Date) => {
    const s = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    return s;
  };
  const valid = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  return {
    number: `DEV-${now.getFullYear()}-0001`,
    issueDate: fmt(now),
    validityDate: fmt(valid),
    advisor: cfg?.preparedBy || "",
    advisorPhone: "",
    emitterLegal: [
      "5 rue Pleyel, 93200 Saint-Denis",
      "SAS au capital de 63 245,02 €",
      "RCS Bobigny 851 682 807",
      "TVA FR 48 851 682 807",
      "contact@beev.co · beev.co",
    ],
    clientAddress: "",
    clientContact: "",
    clientRef: "",
    tvaRate: 20,
    depositPct: 30,
    lines: [
      {
        designation: "Audit TCO & recommandations flotte",
        detail: [
          "Prestation forfaitaire, livrables 01 à 06 :",
          "- Inventaire & analyse du parc actuel (contrats, loyers, kilométrages, échéances)",
          "- Calcul du TCO par segment (LLD, entretien, énergie, fiscalité, avantages en nature)",
          "- Recommandations véhicules (électrique, hybride rechargeable et non rechargeable)",
          "- Projection d'économies sur 12 / 24 / 36 mois",
          "- Plan de déploiement bornes (domicile et sites) et analyse fiscale",
          "- Restitution exécutive prête pour comité de direction",
        ].join("\n"),
        qty: 1,
        unit: "forfait",
        unitPriceHt: 5000,
        enabled: true,
      },
      {
        designation: "Accès Fleet Manager",
        detail: "Pilotage du parc, suivi des coûts et des échéances, remboursement de l'énergie des collaborateurs. Abonnement mensuel facturé séparément, non inclus dans le total ponctuel.",
        qty: 80,
        unit: "véhicule",
        unitPriceHt: 8,
        isOption: true,
        isRecurring: true,
        enabled: true,
      },
    ],
    conditions: [
      { text: "Validité : 30 jours à compter de la date d'émission.", enabled: true },
      { text: "Délai : restitution sous 3 semaines après réception du fichier de parc complet.", enabled: true },
      { text: "Règlement : acompte de 30 % à la commande, solde à la restitution. Virement à 30 jours.", enabled: true },
      { text: "Audit offert sous conditions : les 5 000 € HT sont déduits en cas de signature d'un contrat-cadre d'un an (volume de renouvellement véhicules, abonnement Fleet Manager ou volume d'installations de bornes).", enabled: true },
      { text: "Confidentialité : les données de parc transmises sont traitées de façon confidentielle, conformément au RGPD, et utilisées uniquement pour la mission.", enabled: true },
    ],
    acceptanceText: "Pour lancer la mission, retournez ce devis daté et signé, revêtu de la mention manuscrite « Bon pour accord », accompagné de l'acompte. Nous planifions le premier rendez-vous sous 48 h.",
    footerLegal: "Beev · 5 rue Pleyel, 93200 Saint-Denis · SAS au capital de 63 245,02 € · RCS Bobigny 851 682 807 · TVA FR 48 851 682 807 · Prix exprimés en euros HT",
    siret: "",
    iban: "",
    show: {
      emitterLegal: true,
      client: true,
      objet: true,
      table: true,
      recap: true,
      deposit: true,
      conditions: true,
      acceptance: true,
      footerLegal: true,
    },
  };
}

const eur2 = (n: number) =>
  nbsp(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0));

// Rend le détail d'une ligne : les lignes commençant par « - » ou « • » forment
// une liste à puces, les autres des paragraphes.
function renderDetail(text: string): string {
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  let html = "";
  let inUl = false;
  for (const ln of lines) {
    const bullet = /^[-•]\s+/.test(ln);
    if (bullet) {
      if (!inUl) { html += "<ul class='det-ul'>"; inUl = true; }
      html += `<li>${esc(ln.replace(/^[-•]\s+/, ""))}</li>`;
    } else {
      if (inUl) { html += "</ul>"; inUl = false; }
      html += `<div class="det-p">${esc(ln)}</div>`;
    }
  }
  if (inUl) html += "</ul>";
  return html;
}

export function buildAuditDevisHtml(cfg: AuditConseilConfig, devis: DevisInfo, fonts?: RoobertFonts, assets?: AuditAssets): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const s = devis.show;

  // Totaux : seules les lignes affichées, non optionnelles et non récurrentes
  // entrent dans le total ponctuel.
  const billable = devis.lines.filter((l) => isOn(l) && !l.isOption && !l.isRecurring);
  const totalHt = billable.reduce((acc, l) => acc + l.qty * l.unitPriceHt, 0);
  const tva = totalHt * (devis.tvaRate || 0) / 100;
  const ttc = totalHt + tva;
  const deposit = ttc * (devis.depositPct || 0) / 100;
  const solde = ttc - deposit;

  // En-tête émetteur (coordonnées Beev) + SIRET/IBAN optionnels.
  const emitterLines = [...devis.emitterLegal];
  if (devis.siret.trim()) emitterLines.push(`SIRET ${esc(devis.siret)}`);
  const emitter = s.emitterLegal
    ? `<div class="emit-legal">${emitterLines.map((l) => esc(l)).join("<br>")}</div>`
    : "";

  // Client : nom (depuis la présentation) + adresse / contact / périmètre.
  const clientLogo = cfg.clientLogoUrl
    ? `<div class="client-logo"><img src="${esc(cfg.clientLogoUrl)}" alt="Logo client" /></div>`
    : "";
  const perimetre = [cfg.fleetSize, cfg.sites].filter((x) => x && x.trim()).join(" · ");
  const clientLines = [devis.clientAddress, devis.clientContact, perimetre ? `Parc concerné : ${perimetre}` : "", devis.clientRef ? `Référence : ${devis.clientRef}` : ""]
    .filter((x) => x && x.trim())
    .map((x) => esc(x))
    .join("<br>");
  const clientCard = s.client ? `
    <div class="card">
      <div class="lab"><span class="bar bleu"></span>Client</div>
      ${clientLogo}
      <div class="client-name">${esc(cfg.clientName) || "Client"}</div>
      ${clientLines ? `<div class="client-line">${clientLines}</div>` : ""}
    </div>` : "";

  const objetCard = s.objet ? `
    <div class="card">
      <div class="lab"><span class="bar rose"></span>Objet de la mission</div>
      <div class="objet-txt">${esc(cfg.title)}
        ${cfg.approach ? `<span class="sub">${esc(cfg.approach)}</span>` : ""}
      </div>
    </div>` : "";

  const row2 = (clientCard || objetCard)
    ? `<div class="row2">${clientCard}${objetCard}</div>`
    : "";

  // Tableau des prestations.
  const lineRows = devis.lines.filter(isOn).map((l) => {
    const amount = l.qty * l.unitPriceHt;
    const suffix = l.isRecurring ? " / mois" : "";
    const optTag = l.isOption ? `<span class="opt">Option</span>` : "";
    return `
    <div class="tbl-row${l.isOption ? " option" : ""}">
      <div>
        <div class="desig">${esc(l.designation)}${optTag}</div>
        ${l.detail.trim() ? `<div class="detail">${renderDetail(l.detail)}</div>` : ""}
      </div>
      <div class="cell r">${esc(String(l.qty))}${l.unit ? `<div class="unit">${esc(l.unit)}</div>` : ""}</div>
      <div class="cell r">${eur2(l.unitPriceHt)}${suffix}</div>
      <div class="cell r amount">${eur2(amount)}${suffix}</div>
    </div>`;
  }).join("");

  const table = s.table ? `
    <div class="tbl">
      <div class="tbl-head">
        <div>Désignation</div>
        <div class="r">Qté</div>
        <div class="r">PU HT</div>
        <div class="r">Montant HT</div>
      </div>
      ${lineRows}
    </div>` : "";

  // Conditions.
  const condItems = devis.conditions.filter(isOn).map((c) => {
    // Met en gras le segment avant le premier deux-points (ex. « Validité : »).
    const m = c.text.match(/^([^:]{2,40}:)([\s\S]*)$/);
    const body = m ? `<b>${esc(m[1])}</b>${esc(m[2])}` : esc(c.text);
    return `<li>${body}</li>`;
  }).join("");
  const conditions = (s.conditions && condItems) ? `
    <div class="cond">
      <div class="lab"><span class="bar violet"></span>Conditions</div>
      <ul>${condItems}</ul>
    </div>` : "";

  // Récapitulatif HT / TVA / TTC + acompte.
  const depositBlock = (s.deposit && devis.depositPct > 0) ? `
      <div class="pay">
        <div class="ln"><span>Acompte ${esc(String(devis.depositPct))} % à la commande</span><span class="v">${eur2(deposit)}</span></div>
        <div class="ln"><span>Solde à la restitution</span><span class="v">${eur2(solde)}</span></div>
      </div>` : "";
  const recap = s.recap ? `
    <div class="recap">
      <span class="orb"></span>
      <div class="ln"><span>Total HT</span><span class="v">${eur2(totalHt)}</span></div>
      <div class="ln"><span>TVA ${esc(String(devis.tvaRate))} %</span><span class="v">${eur2(tva)}</span></div>
      <div class="ln tot"><span class="k">Total TTC</span><span class="v">${eur2(ttc)}</span></div>
      ${depositBlock}
    </div>` : "";

  const gridBottom = (conditions || recap)
    ? `<div class="grid-bottom">${conditions || "<div></div>"}${recap}</div>`
    : "";

  // Acceptation.
  const acceptance = s.acceptance ? `
    <div class="accept">
      <div class="accept-l">
        <div class="t">Bon pour accord</div>
        <p>${esc(devis.acceptanceText)}</p>
      </div>
      <div class="sign-box">
        <div class="t">Signature client</div>
        <div class="hand">Bon pour accord</div>
        <div class="meta">
          Le ............ / ............ / ${esc(String(new Date().getFullYear()))}<br>
          Nom : ........................<br>
          Fonction : ........................
        </div>
      </div>
    </div>` : "";

  // IBAN optionnel sous l'acceptation.
  const ibanLine = devis.iban.trim()
    ? `<div class="iban">Règlement par virement · IBAN ${esc(devis.iban)}</div>`
    : "";

  const footer = s.footerLegal ? `
    <div class="foot">
      ${beevLogo(assets, false, "foot-mark")}
      <span class="foot-legal">${esc(devis.footerLegal)}</span>
      <span class="foot-page">Devis ${esc(devis.number)} · 1/1</span>
    </div>` : "";

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" />
<base href="${origin}/" />
<title>Devis ${esc(devis.number)} · ${esc(cfg.clientName)} × Beev</title>
<style>
${fontFaceCss(fonts)}
  :root {
    --ink:#1D1D1D; --beige:#FCF9F2; --paper:#FFFFFF;
    --rose:#F4B8AA; --bleu:#A5D2FF; --violet:#D3CCD8;
    --rose-soft:#FCEDE8; --bleu-soft:#EAF3FF; --violet-soft:#F2EFF4;
    --sub:#6A6A6F; --rule:#ECE7DD; --bleu-text:#1E5A99;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 0; }
  html, body { font-family: 'Roobert','Inter',-apple-system,BlinkMacSystemFont,sans-serif; color: var(--ink); background: var(--beige); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: 210mm; min-height: 297mm; padding: 15mm 16mm 14mm; background: var(--beige); overflow: hidden; }

  /* En-tête */
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .emit-mark { height: 22px; width: auto; }
  span.emit-mark { font-size: 24px; font-weight: 700; letter-spacing: -.02em; }
  .emit-legal { font-size: 10.5px; color: var(--sub); line-height: 1.6; margin-top: 8px; max-width: 260px; }
  .doc-badge { text-align: right; }
  .doc-kicker { font-size: 11px; letter-spacing: .24em; text-transform: uppercase; color: var(--sub); font-weight: 700; }
  .doc-title { font-size: 30px; font-weight: 700; letter-spacing: -.02em; line-height: 1; margin: 3px 0 10px; }
  .doc-meta { font-size: 11.5px; line-height: 1.7; }
  .doc-meta .k { color: var(--sub); }
  .doc-meta b { font-weight: 700; }
  .rule { height: 1px; background: var(--rule); margin: 18px 0; }

  /* Cartes client / objet */
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .card { background: var(--paper); border: 1px solid var(--rule); border-radius: 13px; padding: 14px 16px; }
  .lab { display: flex; align-items: center; gap: 9px; font-size: 9.5px; letter-spacing: .2em; text-transform: uppercase; color: var(--sub); font-weight: 700; margin-bottom: 9px; }
  .bar { width: 22px; height: 3px; border-radius: 2px; display: inline-block; }
  .bar.rose { background: var(--rose); } .bar.bleu { background: var(--bleu); } .bar.violet { background: var(--violet); }
  .client-logo { margin-bottom: 9px; } .client-logo img { max-height: 30px; max-width: 150px; object-fit: contain; display: block; }
  .client-name { font-size: 15px; font-weight: 700; }
  .client-line { font-size: 11.5px; color: var(--sub); line-height: 1.6; margin-top: 3px; }
  .objet-txt { font-size: 12px; line-height: 1.55; }
  .objet-txt .sub { color: var(--sub); display: block; margin-top: 5px; }

  /* Tableau prestations */
  .tbl { margin-top: 16px; background: var(--paper); border: 1px solid var(--rule); border-radius: 13px; overflow: hidden; }
  .tbl-head, .tbl-row { display: grid; grid-template-columns: 1fr 58px 84px 98px; gap: 12px; align-items: start; }
  .tbl-head { padding: 11px 18px; background: #F6F2E9; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--sub); font-weight: 700; }
  .tbl-head .r, .tbl-row .r { text-align: right; }
  .tbl-row { padding: 13px 18px; border-top: 1px solid var(--rule); }
  .tbl-row.option { background: #FBFAF6; }
  .desig { font-size: 13.5px; font-weight: 700; }
  .desig .opt { display: inline-block; font-size: 9px; font-weight: 700; vertical-align: middle; margin-left: 7px; padding: 2px 8px; border-radius: 999px; background: var(--bleu-soft); color: var(--bleu-text); }
  .detail { font-size: 10.5px; color: var(--sub); line-height: 1.5; margin-top: 6px; }
  .det-ul { margin: 2px 0 0; padding: 0; list-style: none; }
  .det-ul li { position: relative; padding-left: 13px; margin-top: 2px; }
  .det-ul li::before { content: ""; position: absolute; left: 0; top: 6px; width: 5px; height: 5px; border-radius: 1.5px; background: var(--rose); }
  .det-p { margin-top: 2px; }
  .cell { font-size: 12.5px; padding-top: 2px; }
  .cell.r { font-weight: 600; }
  .cell .unit { font-size: 9px; color: var(--sub); font-weight: 500; text-transform: uppercase; letter-spacing: .04em; margin-top: 2px; }
  .cell.amount { font-weight: 700; font-size: 13px; }
  .tbl-row.option .amount { color: var(--bleu-text); }

  /* Récap + conditions */
  .grid-bottom { display: grid; grid-template-columns: 1fr 280px; gap: 16px; margin-top: 16px; align-items: start; }
  .cond ul { list-style: none; }
  .cond li { font-size: 11px; color: var(--sub); line-height: 1.5; padding-left: 15px; position: relative; margin-bottom: 7px; }
  .cond li::before { content: ""; position: absolute; left: 0; top: 6px; width: 6px; height: 6px; border-radius: 2px; background: var(--rose); }
  .cond li b { color: var(--ink); font-weight: 700; }
  .recap { background: var(--ink); color: var(--beige); border-radius: 14px; padding: 16px 18px; position: relative; overflow: hidden; }
  .recap .orb { position: absolute; right: -50px; top: -50px; width: 150px; height: 150px; border-radius: 50%; background: radial-gradient(circle, rgba(244,184,170,.28), transparent 70%); }
  .recap .ln { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; padding: 5px 0; color: rgba(252,249,242,.86); position: relative; z-index: 1; }
  .recap .ln.tot { border-top: 1px solid rgba(252,249,242,.22); margin-top: 6px; padding-top: 11px; }
  .recap .ln.tot .v { font-size: 23px; font-weight: 700; color: #fff; }
  .recap .ln.tot .k { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; font-weight: 700; color: var(--beige); }
  .recap .v { font-weight: 600; color: #fff; }
  .recap .pay { margin-top: 11px; padding-top: 11px; border-top: 1px solid rgba(252,249,242,.22); position: relative; z-index: 1; }
  .recap .pay .ln { font-size: 11px; padding: 3px 0; }

  /* Acceptation */
  .accept { display: grid; grid-template-columns: 1fr 250px; gap: 16px; margin-top: 16px; align-items: stretch; }
  .accept-l { background: var(--bleu-soft); border: 1px solid var(--bleu); border-radius: 13px; padding: 14px 16px; }
  .accept-l .t { font-size: 12.5px; font-weight: 700; margin-bottom: 6px; }
  .accept-l p { font-size: 11px; color: var(--sub); line-height: 1.55; }
  .sign-box { border: 1.5px dashed #C9C3B7; border-radius: 13px; padding: 13px 16px; }
  .sign-box .t { font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--sub); font-weight: 700; }
  .sign-box .hand { font-size: 13px; font-weight: 700; margin-top: 8px; }
  .sign-box .meta { font-size: 10.5px; color: var(--sub); line-height: 1.9; margin-top: 10px; }
  .iban { font-size: 10.5px; color: var(--sub); margin-top: 10px; }

  .foot { position: absolute; left: 16mm; right: 16mm; bottom: 10mm; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 8.5px; color: var(--sub); border-top: 1px solid var(--rule); padding-top: 10px; }
  .foot-mark { height: 13px; width: auto; }
  span.foot-mark { font-size: 13px; font-weight: 700; color: var(--ink); }
  .foot-legal { flex: 1; text-align: center; line-height: 1.5; }
  .foot-page { white-space: nowrap; font-weight: 600; }

  .toolbar { position: fixed; top: 16px; right: 16px; z-index: 10; }
  .toolbar button { font-family: inherit; font-size: 13px; font-weight: 600; border: none; border-radius: 10px; padding: 10px 18px; cursor: pointer; background: var(--ink); color: #fff; }
  @media print { .toolbar { display: none; } }
  @media screen { body { background: #E9E6DF; padding: 24px 0; } .page { margin: 0 auto; box-shadow: 0 10px 36px rgba(0,0,0,.14); } }
</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">Télécharger le PDF</button></div>
  <section class="page">
    <div class="head">
      <div>
        ${beevLogo(assets, false, "emit-mark")}
        ${emitter}
      </div>
      <div class="doc-badge">
        <div class="doc-kicker">Devis</div>
        <div class="doc-title">${esc(devis.number)}</div>
        <div class="doc-meta">
          <div><span class="k">Date d'émission :</span> <b>${esc(devis.issueDate)}</b></div>
          <div><span class="k">Validité jusqu'au :</span> <b>${esc(devis.validityDate)}</b></div>
          ${devis.advisor ? `<div><span class="k">Conseiller :</span> <b>${esc(devis.advisor)}</b></div>` : ""}
          ${devis.advisorPhone ? `<div><span class="k">Contact :</span> ${esc(devis.advisorPhone)}</div>` : ""}
        </div>
      </div>
    </div>
    <div class="rule"></div>
    ${row2}
    ${table}
    ${gridBottom}
    ${acceptance}
    ${ibanLine}
    ${footer}
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

export async function generateAuditDevisPdf(cfg: AuditConseilConfig, devis: DevisInfo): Promise<void> {
  const win = window.open("", "_blank", "width=1200,height=900");
  if (!win) {
    alert("Le navigateur a bloqué la fenêtre d'impression. Autorisez les popups pour ce site puis relancez la génération.");
    return;
  }
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Devis…</title></head><body style="font-family:system-ui;padding:48px;color:#6A6A6F">Préparation du devis…</body></html>');

  const [regular, medium, semibold, logoDark, logoLight] = await Promise.all([
    fontToDataUrl("/fonts/Roobert-Regular.ttf"),
    fontToDataUrl("/fonts/Roobert-Medium.ttf"),
    fontToDataUrl("/fonts/Roobert-SemiBold.ttf"),
    fontToDataUrl("/images/logo-beev-noir.png"),
    fontToDataUrl("/images/logo-beev-white.png"),
  ]);
  const html = buildAuditDevisHtml(cfg, devis, { regular, medium, semibold }, { logoDark, logoLight });

  win.document.open();
  win.document.write(html);
  win.document.close();
}
