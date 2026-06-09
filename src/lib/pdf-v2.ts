// PDF V2 — Bordereau de Prix Unitaires (BPU) au design Beev 2026.
//
// Cette version est INDÉPENDANTE de generateProposalPdf (qui reste la
// version classique). Le commercial choisit dans le dropdown "Générer PDF"
// quelle version télécharger pour son devis.
//
// Approche : on construit un HTML statique avec design system Beev (Roobert,
// charte couleurs 2026, layout sidebar + table BPU) rempli dynamiquement
// avec les line items des chargers sélectionnés. On ouvre dans une nouvelle
// fenêtre, l'utilisateur déclenche l'impression (Cmd/Ctrl+P) et choisit
// "Enregistrer en PDF" — le @media print du CSS gère le rendu pleine page.
//
// Avantages vs jsPDF :
// - Vectoriel, texte sélectionnable
// - Polices Roobert directement utilisées (pas de fallback Helvetica)
// - Mise en page CSS native (Flexbox, Grid, gradients) sans recréation
//
// Limites :
// - Nécessite l'autorisation des popups
// - Le download n'est pas direct (impression manuelle), mais l'utilisateur
//   peut éditer les libellés / quantités / prix avant impression

import type { ClientInfo, SelectedCharger, SelectedVehicle } from "./pdf";

type GenerateV2Opts = {
  client: ClientInfo;
  vehicles: SelectedVehicle[];
  chargers: SelectedCharger[];
  /** Nom du commercial pour le pied de page */
  salesRep?: string;
};

const eur = (n: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(Math.round(n))
    .replace(/\s/g, " ");

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function generateProposalPdfV2(opts: GenerateV2Opts): void {
  const html = buildBpuHtml(opts);
  const win = window.open("", "_blank", "width=1200,height=900");
  if (!win) {
    alert("Le navigateur a bloqué la fenêtre d'impression. Autorisez les popups pour ce site puis relancez la génération.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // On déclenche l'impression automatiquement une fois la page chargée.
  // L'utilisateur peut imprimer en PDF via la boîte de dialogue native.
  win.onload = () => {
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        /* impression sera lancée manuellement par le user */
      }
    }, 400);
  };
}

function buildBpuHtml(opts: GenerateV2Opts): string {
  const { client, chargers, vehicles, salesRep } = opts;

  // ── Agrégation des line items par charger en sections BPU ──────────────
  type BpuRow = { ref: string; label: string; unit: string; qty: number; pu: number };
  type BpuSection = { id: string; num: string; title: string; accent: "rose" | "bleu" | "violet"; rows: BpuRow[] };

  const sections: BpuSection[] = [];

  // Une section par charger sélectionné
  chargers.forEach((sc, i) => {
    const accent: BpuSection["accent"] = i % 3 === 0 ? "rose" : i % 3 === 1 ? "bleu" : "violet";
    const rows: BpuRow[] = sc.lineItems.map((li, j) => ({
      ref: `${i + 1}.${j + 1}`,
      label: li.label,
      unit: "U",
      qty: li.qty,
      pu: li.unitHt,
    }));
    sections.push({
      id: `sec-${sc.charger.id}`,
      num: String(i + 1),
      title: `${sc.charger.brand} ${sc.charger.model} · ${sc.charger.powerKw} kW × ${sc.quantity}`,
      accent,
      rows,
    });
  });

  // Section véhicules (si présents) — en complément
  if (vehicles.length > 0) {
    const accent: BpuSection["accent"] = "violet";
    sections.push({
      id: "sec-vehicles",
      num: String(sections.length + 1),
      title: `Véhicules sélectionnés (${vehicles.length})`,
      accent,
      rows: vehicles.map((sv, j) => ({
        ref: `V.${j + 1}`,
        label: `${sv.vehicle.brand} ${sv.vehicle.model} ${sv.vehicle.version || ""}`.trim(),
        unit: "véh",
        qty: sv.quantity,
        pu: sv.negotiatedMonthly ?? sv.vehicle.monthlyLld,
      })),
    });
  }

  // Si pas de chargers ni de véhicules, on génère une section vide pour démo
  if (sections.length === 0) {
    sections.push({
      id: "sec-demo",
      num: "1",
      title: "Aucune sélection — ajoutez des produits avant de générer le BPU",
      accent: "rose",
      rows: [],
    });
  }

  // ── Calculs ─────────────────────────────────────────────────────────────
  const totalHt = sections.reduce(
    (sum, s) => sum + s.rows.reduce((a, r) => a + r.qty * r.pu, 0),
    0,
  );
  const tva = totalHt * 0.20;
  const totalTtc = totalHt + tva;

  const today = new Date().toLocaleDateString("fr-FR");
  const ref = `BEEV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${String(new Date().getHours()).padStart(2, "0")}${String(new Date().getMinutes()).padStart(2, "0")}`;

  // ── Sidebar index + grand totals ───────────────────────────────────────
  const sidebarIndex = sections
    .map(
      (s) => `
      <a href="#${s.id}" class="nav-item" data-accent="${s.accent}">
        <span class="nav-dot"></span>
        <span class="nav-num">${s.num}</span>
        <span class="nav-name">${escapeHtml(s.title)}</span>
      </a>`,
    )
    .join("");

  // ── Sections HTML ──────────────────────────────────────────────────────
  const sectionsHtml = sections
    .map((s) => {
      const sectionHt = s.rows.reduce((a, r) => a + r.qty * r.pu, 0);
      const rowsHtml = s.rows.length
        ? s.rows
            .map(
              (r) => `
        <tr class="item-row${r.qty > 0 ? " has-qty" : ""}">
          <td class="c-ref">${escapeHtml(r.ref)}</td>
          <td class="c-des"><span class="des-main">${escapeHtml(r.label)}</span></td>
          <td class="c-u">${escapeHtml(r.unit)}</td>
          <td class="c-q num">${r.qty.toLocaleString("fr-FR")}</td>
          <td class="c-pu num">${eur(r.pu)}</td>
          <td class="c-tot num">${eur(r.qty * r.pu)}</td>
        </tr>`,
            )
            .join("")
        : `<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--fg-3);font-size:13px;">Aucune ligne dans cette section.</td></tr>`;

      return `
      <section class="sec-card" id="${s.id}" data-accent="${s.accent}">
        <header class="sec-head">
          <span class="sec-badge">${s.num}</span>
          <h2 class="sec-title">${escapeHtml(s.title)}</h2>
        </header>
        <table class="bpu-table">
          <thead>
            <tr>
              <th class="c-ref">Réf.</th>
              <th class="c-des">Désignation</th>
              <th class="c-u">U</th>
              <th class="c-q">Qté</th>
              <th class="c-pu">PU HT</th>
              <th class="c-tot">Total HT</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <footer class="sec-foot">
          <span class="sec-foot-label">Total HT section</span>
          <span class="sec-foot-val">${eur(sectionHt)}</span>
        </footer>
      </section>`;
    })
    .join("");

  // ── CSS (charte Beev 2026) ─────────────────────────────────────────────
  // Fonts chargées depuis /fonts/ (déjà présentes dans public/)
  const css = `
    @font-face { font-family: 'Roobert'; src: url('/fonts/Roobert-Regular.ttf') format('truetype'); font-weight: 400; font-style: normal; font-display: swap; }
    @font-face { font-family: 'Roobert'; src: url('/fonts/Roobert-Medium.ttf') format('truetype'); font-weight: 500; font-style: normal; font-display: swap; }
    @font-face { font-family: 'Roobert'; src: url('/fonts/Roobert-SemiBold.ttf') format('truetype'); font-weight: 600; font-style: normal; font-display: swap; }
    @font-face { font-family: 'Roobert'; src: url('/fonts/Roobert-SemiBold.ttf') format('truetype'); font-weight: 700; font-style: normal; font-display: swap; }

    :root {
      --beev-black: #1D1D1D; --beev-beige: #FCF9F2; --beev-white: #FFFFFF;
      --beev-rose: #F4B8AA; --beev-bleu: #A5D2FF; --beev-violet: #D3CCD8;
      --beev-rose-20: #FDF1EE; --beev-bleu-20: #EDF6FF; --beev-violet-20: #F6F5F7;
      --fg-1: var(--beev-black); --fg-2: #4A4A4A; --fg-3: #7A7A7A; --fg-muted: #A6A6A6;
      --border-subtle: rgba(29,29,29,0.10);
      --radius-sm: 10px; --radius-lg: 24px; --radius-xs: 6px;
      --shadow-sm: 0 2px 8px rgba(29,29,29,0.06);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--beev-beige);
      font-family: 'Roobert', -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--fg-1); -webkit-font-smoothing: antialiased; }
    .app { display: grid; grid-template-columns: 264px 1fr; min-height: 100vh; }
    .sidebar { background: var(--beev-beige); border-right: 1px solid var(--border-subtle); padding: 28px 14px; }
    .sb-brand { padding: 0 10px 18px; font-weight: 600; font-size: 22px; letter-spacing: -0.02em; }
    .sb-label { font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fg-3); padding: 10px 10px 8px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-sm);
      font-size: 13.5px; line-height: 1.2; color: var(--fg-2); text-decoration: none; }
    .nav-item:hover { background: var(--beev-white); }
    .nav-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--beev-rose); flex-shrink: 0; }
    .nav-item[data-accent="bleu"] .nav-dot { background: var(--beev-bleu); }
    .nav-item[data-accent="violet"] .nav-dot { background: var(--beev-violet); }
    .nav-num { color: var(--fg-muted); min-width: 18px; font-variant-numeric: tabular-nums; }
    .nav-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sb-totals { margin-top: 24px; border-top: 1px solid var(--border-subtle); padding: 16px 10px; }
    .sb-tot-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12.5px; color: var(--fg-2); }
    .sb-tot-row.ttc { margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--border-subtle); font-weight: 600; color: var(--fg-1); font-size: 14px; }
    .sb-tot-row .num { font-variant-numeric: tabular-nums; }
    .content { padding: 32px 40px 64px; }
    .doc-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; margin-bottom: 26px; flex-wrap: wrap; }
    .doc-eyebrow { font-size: 12.5px; color: var(--fg-3); margin-bottom: 8px; }
    .doc-title { font-size: 40px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.04; margin: 0; }
    .doc-meta { margin-top: 10px; font-size: 13px; color: var(--fg-3); display: flex; gap: 16px; flex-wrap: wrap; }
    .summary-card { background: var(--beev-rose); border-radius: var(--radius-lg); padding: 18px 24px 20px; min-width: 250px; }
    .summary-card .sc-lbl { font-size: 12.5px; color: var(--fg-2); }
    .summary-card .sc-ttc { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; margin-top: 2px; font-variant-numeric: tabular-nums; }
    .summary-card .sc-sub { font-size: 12.5px; color: var(--fg-2); margin-top: 8px; display: flex; gap: 14px; flex-wrap: wrap; }
    .summary-card .sc-sub .num { font-variant-numeric: tabular-nums; font-weight: 500; color: var(--fg-1); }
    .sec-card { background: var(--beev-white); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: hidden; margin-bottom: 18px; }
    .sec-head { display: flex; align-items: center; gap: 14px; padding: 15px 24px; border-bottom: 1px solid var(--border-subtle); }
    .sec-card[data-accent="rose"] .sec-head { background: var(--beev-rose-20); }
    .sec-card[data-accent="bleu"] .sec-head { background: var(--beev-bleu-20); }
    .sec-card[data-accent="violet"] .sec-head { background: var(--beev-violet-20); }
    .sec-badge { display: flex; align-items: center; justify-content: center; min-width: 32px; height: 32px; padding: 0 8px; border-radius: var(--radius-sm); font-weight: 600; font-size: 15px; font-variant-numeric: tabular-nums; }
    .sec-card[data-accent="rose"] .sec-badge { background: var(--beev-rose); }
    .sec-card[data-accent="bleu"] .sec-badge { background: var(--beev-bleu); }
    .sec-card[data-accent="violet"] .sec-badge { background: var(--beev-violet); }
    .sec-title { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
    .bpu-table { width: 100%; border-collapse: collapse; }
    .bpu-table thead th { text-align: left; font-size: 11px; font-weight: 500; color: var(--fg-3); letter-spacing: 0.02em; padding: 12px 12px 9px; border-bottom: 1px solid var(--border-subtle); }
    .bpu-table thead th.c-q, .bpu-table thead th.c-pu, .bpu-table thead th.c-tot { text-align: right; }
    .bpu-table tbody td { padding: 10px 12px; border-bottom: 1px solid var(--border-subtle); font-size: 13px; line-height: 1.34; vertical-align: top; }
    .bpu-table tbody tr:last-child td { border-bottom: none; }
    .c-ref { width: 58px; color: var(--fg-muted); font-variant-numeric: tabular-nums; font-size: 11.5px; }
    .c-des { min-width: 280px; }
    .c-u { width: 52px; color: var(--fg-3); }
    .c-q { width: 86px; text-align: right; }
    .c-pu { width: 124px; }
    .c-tot { width: 110px; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .c-tot.num { font-weight: 600; }
    .item-row.has-qty { background: rgba(252,249,242,0.5); }
    .sec-foot { display: flex; justify-content: space-between; align-items: center; padding: 13px 24px; border-top: 1px solid var(--border-subtle); background: var(--beev-beige); }
    .sec-foot-label { font-size: 12px; color: var(--fg-3); }
    .sec-foot-val { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .grand { background: var(--beev-black); color: var(--beev-beige); border-radius: var(--radius-lg); padding: 26px 32px; margin-top: 26px; }
    .grand-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 14.5px; }
    .grand-row .lbl { color: rgba(252,249,242,0.7); }
    .grand-row .num { font-variant-numeric: tabular-nums; }
    .grand-row.tva { border-bottom: 1px solid rgba(252,249,242,0.16); padding-bottom: 16px; }
    .grand-row.ttc { padding-top: 18px; align-items: baseline; }
    .grand-row.ttc .lbl { color: var(--beev-beige); font-size: 17px; font-weight: 600; }
    .grand-row.ttc .num { font-size: 32px; font-weight: 600; letter-spacing: -0.02em; }
    .doc-foot { margin-top: 22px; font-size: 11.5px; color: var(--fg-3); line-height: 1.6; }
    .toolbar-print { display: flex; gap: 12px; margin-bottom: 18px; }
    .btn-print { font-family: inherit; font-size: 13px; font-weight: 500; border-radius: 10px; padding: 10px 18px;
      border: 1px solid var(--beev-black); background: var(--beev-black); color: var(--beev-beige); cursor: pointer; }
    .btn-print.outline { background: transparent; color: var(--beev-black); }
    @media print {
      @page { size: A4; margin: 12mm 10mm; }
      .app { display: block; }
      .sidebar { display: none; }
      .content { padding: 0; }
      .toolbar-print { display: none; }
      .sec-card { box-shadow: none; border: 1px solid var(--border-subtle); break-inside: avoid; }
      .sec-head { break-after: avoid; }
      .item-row { break-inside: avoid; }
      .grand { break-inside: avoid; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  `;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Devis Beev — ${escapeHtml(client.company || "Client")}</title>
<style>${css}</style>
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="sb-brand">Beev</div>
    <div class="sb-label">Sections</div>
    <nav>${sidebarIndex}</nav>
    <div class="sb-totals">
      <div class="sb-tot-row"><span>Total HT</span><span class="num">${eur(totalHt)}</span></div>
      <div class="sb-tot-row"><span>TVA 20 %</span><span class="num">${eur(tva)}</span></div>
      <div class="sb-tot-row ttc"><span>Total TTC</span><span class="num">${eur(totalTtc)}</span></div>
    </div>
  </aside>
  <main class="content">
    <div class="toolbar-print">
      <button class="btn-print" onclick="window.print()">Télécharger en PDF</button>
      <button class="btn-print outline" onclick="window.close()">Fermer</button>
    </div>
    <header class="doc-head">
      <div>
        <div class="doc-eyebrow">Bordereau des prix unitaires</div>
        <h1 class="doc-title">${escapeHtml(client.company || "Client")}</h1>
        <div class="doc-meta">
          <span>Réf. ${escapeHtml(ref)}</span>
          <span>Émis le ${escapeHtml(today)}</span>
          ${client.contactName ? `<span>À l'attention de ${escapeHtml(client.contactName)}</span>` : ""}
        </div>
      </div>
      <div class="summary-card">
        <div class="sc-lbl">Total TTC</div>
        <div class="sc-ttc">${eur(totalTtc)}</div>
        <div class="sc-sub">
          <span>HT <span class="num">${eur(totalHt)}</span></span>
          <span>TVA 20 % <span class="num">${eur(tva)}</span></span>
        </div>
      </div>
    </header>
    ${sectionsHtml}
    <div class="grand">
      <div class="grand-row"><span class="lbl">Total HT</span><span class="num">${eur(totalHt)}</span></div>
      <div class="grand-row tva"><span class="lbl">TVA 20 %</span><span class="num">${eur(tva)}</span></div>
      <div class="grand-row ttc"><span class="lbl">Total TTC</span><span class="num">${eur(totalTtc)}</span></div>
    </div>
    <p class="doc-foot">
      Montants en euros HT sauf mention contraire. Offre valable 30 jours à compter de l'émission.
      ${salesRep ? `Commercial Beev : ${escapeHtml(salesRep)}.` : ""}
      Document non contractuel tant que non signé. Beev · beev.co · contact@beev.co
    </p>
  </main>
</div>
</body>
</html>`;
}
