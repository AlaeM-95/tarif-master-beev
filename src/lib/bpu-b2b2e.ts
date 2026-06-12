// BPU B2B2E — Bordereau des Prix Unitaires « tarification partenariat » pour la
// recharge à domicile des collaborateurs. Conçu d'après le BPU
// Laboratoires Théa × Beev : couverture partenariat (avec logo client), puis
// pour chaque borne une page « Équipement & caractéristiques » et une page
// « Tarifs d'installation » avec grille de suppléments, enfin une clôture.
//
// Le commercial définit librement les prix (équipement mono/tri, installation
// mono/tri, suppléments) dans l'éditeur, télécharge le logo du client, et
// génère le PDF via l'impression navigateur (texte vectoriel, polices Roobert).

export type BpuSupplement = { label: string; mono: number; tri: number };

export type BpuBorne = {
  id: string;
  name: string;          // "Ohme ePod S"
  monoLabel: string;     // "Monophasé 7,4 kW"
  triLabel: string;      // "Triphasé 11 kW"
  equipMono: number;     // prix équipement monophasé HT
  equipTri: number;      // prix équipement triphasé HT
  delestage: string;     // "Inclus" ou montant libre
  installMono: number;   // installation seule monophasé HT
  installTri: number;    // installation seule triphasé HT
  // Caractéristiques techniques (texte libre, 2 colonnes)
  specPuissance: string;
  specCable: string;
  specSupervision: string;
  specConnectivite: string;
  specRechargeSolaire: string;
  specBoitier: string;
  specGarantie: string;
  supplements: BpuSupplement[];
};

export type BpuB2B2EConfig = {
  clientName: string;     // "Laboratoires Théa"
  clientLogoUrl: string;  // logo client (couverture)
  year: string;           // "2026"
  subtitle: string;       // "Recharge à domicile des collaborateurs"
  scopeLine: string;      // "Bornes ... · installation toute France métropolitaine"
  bornes: BpuBorne[];
};

const DEFAULT_SUPPLEMENTS: BpuSupplement[] = [
  { label: "Tranche de 5 m de câble supp.", mono: 75, tri: 139 },
  { label: "Tableau dérivé 1 rangée supp.", mono: 75, tri: 75 },
  { label: "Tableau dérivé 1 rangée étanche", mono: 90, tri: 90 },
  { label: "Forfait tranchée terre / 5 m", mono: 150, tri: 150 },
  { label: "Percement de mur supp.", mono: 30, tri: 30 },
  { label: "Répartiteur", mono: 60, tri: 80 },
  { label: "Création mise à la terre", mono: 160, tri: 160 },
  { label: "Modification tableau élec.", mono: 80, tri: 80 },
  { label: "Goulotte au mètre", mono: 16, tri: 16 },
  { label: "Pose pied sans dalle", mono: 95, tri: 95 },
  { label: "Pied de support", mono: 400, tri: 400 },
  { label: "Dalle béton 40×40 cm + pied", mono: 250, tri: 250 },
  { label: "Dalle béton + regard + pied", mono: 280, tri: 280 },
  { label: "Forfait de désinstallation", mono: 300, tri: 300 },
];

// Configuration par défaut reprenant l'exemple Théa : le commercial part d'un
// BPU fonctionnel et n'a plus qu'à ajuster les prix et le nom/logo du client.
export function defaultBpuB2B2E(): BpuB2B2EConfig {
  return {
    clientName: "",
    clientLogoUrl: "",
    year: String(new Date().getFullYear() + (new Date().getMonth() >= 9 ? 1 : 0)),
    subtitle: "Recharge à domicile des collaborateurs",
    scopeLine: "Installation toute France métropolitaine",
    bornes: [
      {
        id: "ohme-epod-s",
        name: "Ohme ePod S",
        monoLabel: "Monophasé 7,4 kW",
        triLabel: "Triphasé 11 kW",
        equipMono: 900, equipTri: 1000,
        delestage: "Inclus",
        installMono: 499, installTri: 739,
        specPuissance: "Compatible mono & triphasé, 7,4 kW à 22 kW",
        specCable: "Type 2 attaché (T2S)",
        specSupervision: "Compatible Beev Home Connect",
        specConnectivite: "Ethernet, Wifi · OCPP 1.6",
        specRechargeSolaire: "3,7–7,4 kW (mono) / 11–22 kW (tri)",
        specBoitier: "220 × 150 × 140 mm · Made in Europe",
        specGarantie: "3 ans",
        supplements: DEFAULT_SUPPLEMENTS.map((s) => ({ ...s })),
      },
      {
        id: "hager-witty-plus",
        name: "Hager Witty Plus",
        monoLabel: "Monophasé 7,4 kW",
        triLabel: "Triphasé 11 kW",
        equipMono: 1100, equipTri: 1160,
        delestage: "Inclus",
        installMono: 499, installTri: 739,
        specPuissance: "Compatible mono & triphasé, 7,4 kW à 22 kW",
        specCable: "Type 2 attaché (T2S)",
        specSupervision: "Principaux systèmes, dont Beev Connect",
        specConnectivite: "Ethernet, Modem SIM intégré, Wifi · OCPP 1.6",
        specRechargeSolaire: "3,7–7,4 kW (mono) / 11–22 kW (tri)",
        specBoitier: "250 × 150 × 370 mm · Made in Europe",
        specGarantie: "2 ans",
        supplements: DEFAULT_SUPPLEMENTS.map((s) => ({ ...s })),
      },
    ],
  };
}

export function newBpuBorne(): BpuBorne {
  return {
    id: `borne-${Math.random().toString(36).slice(2, 8)}`,
    name: "Nouvelle borne",
    monoLabel: "Monophasé 7,4 kW",
    triLabel: "Triphasé 11 kW",
    equipMono: 0, equipTri: 0,
    delestage: "Inclus",
    installMono: 0, installTri: 0,
    specPuissance: "", specCable: "", specSupervision: "",
    specConnectivite: "", specRechargeSolaire: "", specBoitier: "", specGarantie: "",
    supplements: DEFAULT_SUPPLEMENTS.map((s) => ({ ...s })),
  };
}

const nbsp = (s: string) => s.replace(/ /g, " ").replace(/ /g, " ");
const eur2 = (n: number) =>
  nbsp(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n));
const eurInt = (n: number) =>
  nbsp(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n));

const esc = (s: string): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Découpe une liste de suppléments en 2 colonnes équilibrées (gauche/droite).
function splitTwo<T>(arr: T[]): [T[], T[]] {
  const half = Math.ceil(arr.length / 2);
  return [arr.slice(0, half), arr.slice(half)];
}

function coverPage(cfg: BpuB2B2EConfig): string {
  const title = cfg.clientName ? `${esc(cfg.clientName)} × Beev · ${esc(cfg.year)}` : `Partenariat × Beev · ${esc(cfg.year)}`;
  const logo = cfg.clientLogoUrl
    ? `<img class="client-logo" src="${esc(cfg.clientLogoUrl)}" alt="Logo client" />`
    : (cfg.clientName ? `<div class="client-logo-text">${esc(cfg.clientName)}</div>` : "");
  return `
  <section class="page cover">
    <div class="cover-top">
      <div class="partner">
        <span class="partner-label">En partenariat avec</span>
        ${logo}
      </div>
      <div class="beev-mark">beev</div>
    </div>
    <div class="cover-center">
      <div class="eyebrow">Bordereau des prix unitaires</div>
      <h1 class="cover-title">Tarification<br/>partenariat</h1>
      <div class="cover-sub">${title}</div>
      <div class="cover-scope">${esc(cfg.subtitle)}</div>
      <div class="cover-scope dim">${esc(cfg.scopeLine)}</div>
    </div>
    <div class="cover-foot">Beev · 5 rue Pleyel, 93200 Saint-Denis · SAS au capital de 63 245,02 € · RCS Bobigny 851 682 807 · Prix HT, France métropolitaine</div>
  </section>`;
}

function equipPage(b: BpuBorne, num: number, totalPages: { running: string }): string {
  const numStr = String(num).padStart(2, "0");
  const specs: Array<[string, string]> = [
    ["Puissance", b.specPuissance],
    ["Câble", b.specCable],
    ["Supervision", b.specSupervision],
    ["Connectivité", b.specConnectivite],
    ["Recharge solaire", b.specRechargeSolaire],
    ["Boîtier", b.specBoitier],
  ].filter(([, v]) => v && v.trim()) as Array<[string, string]>;
  const [sl, sr] = splitTwo(specs);
  const specCol = (rows: Array<[string, string]>) =>
    rows.map(([k, v]) => `<div class="spec"><span class="spec-k">${esc(k)}</span><span class="spec-v">${esc(v)}</span></div>`).join("");
  return `
  <section class="page">
    <div class="page-head"><span class="page-num-tag">${numStr}</span><span class="page-borne">Borne ${esc(b.name)}</span></div>
    <h2 class="section-title">Équipement & caractéristiques</h2>
    <table class="equip-table">
      <thead><tr><th>Équipement</th><th class="r">${esc(b.monoLabel)}</th><th class="r">${esc(b.triLabel)}</th></tr></thead>
      <tbody>
        <tr><td>${esc(b.name)}</td><td class="r">${eur2(b.equipMono)}</td><td class="r">${eur2(b.equipTri)}</td></tr>
        <tr><td>Module de délestage</td><td class="r">${esc(b.delestage)}</td><td class="r">${esc(b.delestage)}</td></tr>
        <tr class="total"><td>Total équipement HT</td><td class="r">${eur2(b.equipMono)}</td><td class="r">${eur2(b.equipTri)}</td></tr>
      </tbody>
    </table>
    ${specs.length ? `
    <div class="specs-block">
      <div class="specs-eyebrow">Caractéristiques techniques</div>
      <div class="specs-grid">
        <div class="specs-col">${specCol(sl)}</div>
        <div class="specs-col">${specCol(sr)}</div>
      </div>
      ${b.specGarantie ? `<div class="garantie">Garantie ${esc(b.specGarantie)} · intégration panneaux solaires sous réserve de la puissance disponible chez le collaborateur</div>` : ""}
    </div>` : ""}
    <div class="page-foot"><span>${esc(totalPages.running)}</span></div>
  </section>`;
}

function installPage(b: BpuBorne, num: number, totalPages: { running: string }): string {
  const numStr = String(num).padStart(2, "0");
  const [gl, gr] = splitTwo(b.supplements.filter((s) => s.label.trim()));
  const gridRows = (rows: BpuSupplement[]) =>
    rows.map((s) => `<tr><td>${esc(s.label)}</td><td class="r">${eurInt(s.mono)}</td><td class="r">${eurInt(s.tri)}</td></tr>`).join("");
  return `
  <section class="page">
    <div class="page-head"><span class="page-num-tag">${numStr}</span><span class="page-borne">Borne ${esc(b.name)}</span></div>
    <h2 class="section-title">Tarifs d'installation</h2>
    <div class="forfait-note">Forfait de base : 5 à 15 m de câble 3G10 mm² (mono) ou 5G10 mm² (tri), accessoires de raccordement, disjoncteur & interrupteur différentiel 2P, tube IRL Ø 20 mm, 1 percement de mur, main-d'œuvre.</div>
    <div class="install-cards">
      <div class="install-card rose">
        <div class="ic-label">${esc(b.monoLabel)}</div>
        <div class="ic-row"><span>Installation seule</span><span class="ic-price">${eur2(b.installMono)}</span></div>
        <div class="ic-row big"><span>Borne + installation</span><span class="ic-price">${eur2(b.equipMono + b.installMono)}</span></div>
      </div>
      <div class="install-card bleu">
        <div class="ic-label">${esc(b.triLabel)}</div>
        <div class="ic-row"><span>Installation seule</span><span class="ic-price">${eur2(b.installTri)}</span></div>
        <div class="ic-row big"><span>Borne + installation</span><span class="ic-price">${eur2(b.equipTri + b.installTri)}</span></div>
      </div>
    </div>
    <div class="grid-eyebrow">Grille tarifaire · suppléments</div>
    <div class="grid-two">
      <table class="grid-table"><thead><tr><th>Prestation</th><th class="r">Mono</th><th class="r">Tri</th></tr></thead><tbody>${gridRows(gl)}</tbody></table>
      <table class="grid-table"><thead><tr><th>Prestation</th><th class="r">Mono</th><th class="r">Tri</th></tr></thead><tbody>${gridRows(gr)}</tbody></table>
    </div>
    <div class="page-foot"><span>${esc(totalPages.running)}</span></div>
  </section>`;
}

function closingPage(cfg: BpuB2B2EConfig): string {
  return `
  <section class="page closing">
    <div class="closing-center">
      <div class="closing-validity">Tarifs HT valables ${esc(cfg.year)} · France métropolitaine</div>
      <div class="closing-tagline">Time for electric</div>
    </div>
    <div class="cover-foot">Beev · 5 rue Pleyel, 93200 Saint-Denis · www.beev.co</div>
  </section>`;
}

// Bloc @font-face Roobert. Par défaut référence les .ttf servis par l'app ;
// si des data-URLs base64 sont fournies (fonts), on les EMBARQUE pour garantir
// le rendu Roobert dans la fenêtre d'impression (pas de dépendance réseau /
// résolution de chemin, donc plus de fallback Times/Arial à l'impression).
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

export function buildBpuB2B2EHtml(cfg: BpuB2B2EConfig, fonts?: RoobertFonts): string {
  const running = `Bordereau des prix unitaires · ${cfg.clientName ? cfg.clientName + " × " : ""}Beev`;
  const pages: string[] = [coverPage(cfg)];
  cfg.bornes.forEach((b, i) => {
    pages.push(equipPage(b, i + 1, { running }));
    pages.push(installPage(b, i + 1, { running }));
  });
  pages.push(closingPage(cfg));
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" />
<base href="${origin}/" />
<title>BPU ${esc(cfg.clientName)} × Beev</title>
<style>
${fontFaceCss(fonts)}
  :root { --ink:#1D1D1D; --beige:#FCF9F2; --rose:#F4B8AA; --bleu:#A5D2FF; --violet:#D3CCD8; --sub:#5F5F64; --rule:#E7E4DD; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 0; }
  html, body { font-family: 'Roobert','Inter',-apple-system,BlinkMacSystemFont,sans-serif; color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: 210mm; min-height: 297mm; padding: 22mm 20mm; background: #fff; page-break-after: always; overflow: hidden; }
  .page:last-child { page-break-after: auto; }

  /* Couverture */
  .cover { background: var(--beige); display: flex; flex-direction: column; }
  .cover-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .partner { display: flex; flex-direction: column; gap: 10px; }
  .partner-label { font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: var(--sub); font-weight: 600; }
  .client-logo { max-height: 56px; max-width: 220px; object-fit: contain; }
  .client-logo-text { font-size: 22px; font-weight: 700; }
  .beev-mark { font-size: 26px; font-weight: 700; letter-spacing: -.02em; }
  .cover-center { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .eyebrow { font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--sub); font-weight: 600; margin-bottom: 18px; }
  .cover-title { font-size: 64px; line-height: 1.02; font-weight: 700; letter-spacing: -.02em; margin-bottom: 26px; }
  .cover-sub { font-size: 20px; font-weight: 600; margin-bottom: 18px; }
  .cover-scope { font-size: 13px; color: var(--ink); margin-bottom: 4px; }
  .cover-scope.dim { color: var(--sub); }
  .cover-foot { font-size: 9px; color: var(--sub); border-top: 1px solid var(--rule); padding-top: 10px; }

  /* Pages contenu */
  .page-head { display: flex; align-items: center; gap: 12px; margin-bottom: 26px; }
  .page-num-tag { font-size: 13px; font-weight: 700; color: var(--ink); background: var(--rose); border-radius: 6px; padding: 3px 9px; }
  .page-borne { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; font-weight: 600; color: var(--sub); }
  .section-title { font-size: 30px; font-weight: 700; letter-spacing: -.01em; margin-bottom: 22px; }

  .equip-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  .equip-table th { text-align: left; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--sub); font-weight: 600; padding: 10px 12px; border-bottom: 2px solid var(--ink); }
  .equip-table th.r, .equip-table td.r { text-align: right; }
  .equip-table td { font-size: 14px; padding: 12px; border-bottom: 1px solid var(--rule); }
  .equip-table tr.total td { font-weight: 700; border-bottom: none; border-top: 1px solid var(--ink); }

  .specs-block { background: var(--beige); border-radius: 12px; padding: 20px 22px; }
  .specs-eyebrow { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--sub); font-weight: 600; margin-bottom: 14px; }
  .specs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 28px; }
  .spec { display: flex; flex-direction: column; gap: 2px; padding: 7px 0; border-bottom: 1px solid var(--rule); }
  .spec-k { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--sub); font-weight: 600; }
  .spec-v { font-size: 12.5px; }
  .garantie { font-size: 11px; color: var(--sub); margin-top: 14px; }

  .forfait-note { font-size: 11.5px; color: var(--sub); line-height: 1.5; margin-bottom: 20px; }
  .install-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 30px; }
  .install-card { border-radius: 12px; padding: 18px 20px; }
  .install-card.rose { background: #FDF1EE; }
  .install-card.bleu { background: #EDF6FF; }
  .ic-label { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; margin-bottom: 14px; }
  .ic-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; padding: 8px 0; border-top: 1px solid rgba(0,0,0,.06); }
  .ic-row.big { font-weight: 700; font-size: 15px; }
  .ic-price { font-variant-numeric: tabular-nums; font-weight: 700; }

  .grid-eyebrow { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--sub); font-weight: 600; margin-bottom: 12px; }
  .grid-two { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  .grid-table { width: 100%; border-collapse: collapse; }
  .grid-table th { text-align: left; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: var(--sub); font-weight: 600; padding: 6px 8px; border-bottom: 1px solid var(--ink); }
  .grid-table th.r, .grid-table td.r { text-align: right; font-variant-numeric: tabular-nums; }
  .grid-table td { font-size: 11.5px; padding: 7px 8px; border-bottom: 1px solid var(--rule); }

  .page-foot { position: absolute; left: 20mm; right: 20mm; bottom: 14mm; font-size: 9px; color: var(--sub); border-top: 1px solid var(--rule); padding-top: 8px; }

  .closing { background: var(--ink); color: var(--beige); display: flex; flex-direction: column; }
  .closing .cover-foot { color: rgba(252,249,242,.6); border-top-color: rgba(252,249,242,.18); }
  .closing-center { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 18px; }
  .closing-validity { font-size: 13px; color: rgba(252,249,242,.7); }
  .closing-tagline { font-size: 48px; font-weight: 700; letter-spacing: -.02em; }

  .toolbar { position: fixed; top: 16px; right: 16px; z-index: 10; display: flex; gap: 8px; }
  .toolbar button { font-family: inherit; font-size: 13px; font-weight: 600; border: none; border-radius: 10px; padding: 10px 18px; cursor: pointer; background: var(--ink); color: #fff; }
  @media print { .toolbar { display: none; } .page { box-shadow: none; } }
  @media screen { body { background: #ECEAE4; padding: 24px 0; } .page { margin: 0 auto 24px; box-shadow: 0 8px 30px rgba(0,0,0,.12); } }
</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">Télécharger le PDF</button></div>
  ${pages.join("\n")}
  <script>
    // Attend que les polices Roobert soient prêtes avant de lancer l'impression,
    // sinon le navigateur imprimerait avec une police de repli.
    (function () {
      function go() { try { window.focus(); window.print(); } catch (e) {} }
      var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      ready.then(function () { setTimeout(go, 200); });
    })();
  </script>
</body></html>`;
}

// Charge un fichier de police same-origin et le convertit en data-URL base64.
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

export async function generateBpuB2B2EPdf(cfg: BpuB2B2EConfig): Promise<void> {
  // On ouvre la fenêtre SYNCHRONEMENT (dans le geste utilisateur) pour ne pas
  // être bloqué par le bloqueur de popups, puis on embarque les polices avant
  // d'écrire le document final.
  const win = window.open("", "_blank", "width=1200,height=900");
  if (!win) {
    alert("Le navigateur a bloqué la fenêtre d'impression. Autorisez les popups pour ce site puis relancez la génération.");
    return;
  }
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>BPU…</title></head><body style="font-family:system-ui;padding:48px;color:#5F5F64">Préparation du BPU…</body></html>');

  const [regular, medium, semibold] = await Promise.all([
    fontToDataUrl("/fonts/Roobert-Regular.ttf"),
    fontToDataUrl("/fonts/Roobert-Medium.ttf"),
    fontToDataUrl("/fonts/Roobert-SemiBold.ttf"),
  ]);
  const html = buildBpuB2B2EHtml(cfg, { regular, medium, semibold });

  win.document.open();
  win.document.write(html);
  win.document.close();
}
