import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BEEV_JOURNEYS, MANDATORY_SERVICES, type Charger, type LineItem, type ProjectType, type Vehicle } from "./catalog";
import { loadPdfSettings, hexToRgb } from "./pdf-settings";
import type { EnergyParams } from "./store";

export type ClientInfo = {
  company: string;
  contact: string;
  email: string;
  date: string;
  salesRep: string;
  salesRepEmail: string;
  salesRepPhone: string;
  notes: string;
};

export type SelectedVehicle = {
  vehicle: Vehicle;
  quantity: number;
  discountPct: number;
  negotiatedMonthly: number;
  durationMonths: number;
  kmPerYear: number;
  includeTco: boolean;
  services: string[];
  options: LineItem[];
};

export type SelectedCharger = {
  charger: Charger;
  quantity: number;
  discountPct: number;
  installIncluded: boolean;
  siteName: string;
  siteAddress: string;
  siteContact: string;
  lineItems: LineItem[];
  // URL du devis technicien uploadé (privé, jamais inclus dans le PDF client)
  technicianQuoteUrl?: string;
};

// Calcule le prix unitaire final (avec marge) qui sera présenté au client.
// Le prix d'achat (unitHt) et la marge restent privés côté admin.
export function lineItemClientUnit(li: LineItem): number {
  const m = li.marginPct ?? 0;
  return li.unitHt * (1 + m / 100);
}

export function lineItemClientTotal(li: LineItem): number {
  return lineItemClientUnit(li) * li.qty;
}

// === CHARTE GRAPHIQUE BEEV 2026 ===
// Les couleurs sont mutables : elles sont écrasées par les valeurs de pdf_settings
// (Supabase) au début de chaque génération via applyPdfSettings().
let INK: [number, number, number] = [17, 17, 17];           // #111111 noir principal
const SUB: [number, number, number] = [95, 95, 100];        // #5F5F64 gris secondaire (non éditable)
const RULE: [number, number, number] = [220, 218, 212];     // #DCDAD4 filets (non éditable)
let BG: [number, number, number] = [250, 248, 244];         // #FAF8F4 fond cream
let ACCENT: [number, number, number] = [53, 218, 118];      // #35DA76 vert Beev
let LAVENDER: [number, number, number] = [56, 9, 234];      // #3809EA bleu/violet Beev

// Contenus éditables depuis l'admin (chargés depuis pdf_settings + journey_steps).
let PDF_CONTENT: {
  logoUrl: string | null;
  coverImageUrl: string | null;
  coverSubtitle: string | null;
  whyBeevIntro: string | null;
  whyBeevBullets: string[];
  validationConditions: string | null;
  validationBpaText: string | null;
  validationBpaTitle: string | null;
  steps: Array<{ n: string; title: string; summary: string; duration: string; beev: string[]; client: string[] }>;
} = {
  logoUrl: null,
  coverImageUrl: null,
  coverSubtitle: null,
  whyBeevIntro: null,
  whyBeevBullets: [],
  validationConditions: null,
  validationBpaText: null,
  validationBpaTitle: null,
  steps: [],
};

// Police de marque (chargée dynamiquement depuis public/fonts/)
let BRAND_FONT = "helvetica"; // fallback si Roobert non disponible

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 48;
const FOOTER_LIMIT = PAGE_H - 78; // footer enrichi (2 lignes) prend ~22pt + filet

// ============ TCO ============
export function computeTco(sv: SelectedVehicle, e: EnergyParams) {
  const mix = e.mixHomePct / 100;
  const v = sv.vehicle;
  const isElec = v.energy === "Électrique";
  const isPhev = v.energy === "Hybride Rechargeable";
  let energy100 = 0;
  if (isElec) {
    const kWhCost = mix * e.kWhHome + (1 - mix) * e.kWhPublic;
    energy100 = v.consumption * kWhCost;
  } else if (isPhev) {
    const kWhCost = mix * e.kWhHome + (1 - mix) * e.kWhPublic;
    const elecShare = 0.6;
    const fuelL100 = 6.5;
    energy100 = elecShare * (v.batteryKwh / Math.max(v.rangeWltp, 1)) * 100 * kWhCost
              + (1 - elecShare) * fuelL100 * e.fuelPriceL;
  } else {
    energy100 = v.consumption * e.fuelPriceL;
  }
  const lease100 = (sv.negotiatedMonthly * 12) / Math.max(sv.kmPerYear, 1) * 100;
  const tco100 = lease100 + energy100;
  const refFuel100 = 6.0 * e.fuelPriceL;
  const refLease100 = (500 * 12) / Math.max(sv.kmPerYear, 1) * 100;
  const refTco100 = refLease100 + refFuel100;
  const economy100 = refTco100 - tco100;
  return { energy100, lease100, tco100, refTco100, economy100 };
}

const TYPE_TITLE: Record<ProjectType, string> = {
  vehicles: "Véhicules électriques pour votre flotte",
  home: "Bornes de recharge domicile collaborateurs",
  site: "Bornes de recharge site entreprise",
};

// Charge les paramètres PDF (couleurs, textes, étapes) depuis Supabase et les applique
// aux variables module-level utilisées par les fonctions de dessin.
async function applyPdfSettings(projectType: ProjectType) {
  try {
    const { settings, steps } = await loadPdfSettings(projectType);
    if (settings) {
      INK = hexToRgb(settings.colorInk);
      BG = hexToRgb(settings.colorBg);
      ACCENT = hexToRgb(settings.colorAccent);
      LAVENDER = hexToRgb(settings.colorLavender);
      PDF_CONTENT = {
        logoUrl: settings.logoUrl,
        coverImageUrl: settings.coverImageUrl,
        coverSubtitle: settings.coverSubtitle,
        whyBeevIntro: settings.whyBeevIntro,
        whyBeevBullets: settings.whyBeevBullets,
        validationConditions: settings.validationConditions,
        validationBpaText: settings.validationBpaText,
        validationBpaTitle: settings.validationBpaTitle,
        steps: steps.map((s) => ({
          n: s.stepNumber,
          title: s.title,
          summary: s.summary,
          duration: s.duration,
          beev: s.beevActions,
          client: s.clientActions,
        })),
      };
    }
  } catch (err) {
    console.error("Erreur chargement pdf_settings:", err);
    // En cas d'erreur, on garde les valeurs par défaut
  }
}

// Charge la police Roobert depuis public/fonts/ et l'enregistre dans le document.
// Si les fichiers ne sont pas disponibles, on retombe silencieusement sur Helvetica.
async function loadBrandFont(doc: jsPDF): Promise<string> {
  const toBase64 = (buf: ArrayBuffer): string => {
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };
  try {
    const [regBuf, sbBuf] = await Promise.all([
      fetch("/fonts/Roobert-Regular.ttf").then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())),
      fetch("/fonts/Roobert-SemiBold.ttf").then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())),
    ]);
    doc.addFileToVFS("Roobert-Regular.ttf", toBase64(regBuf));
    doc.addFont("Roobert-Regular.ttf", "Roobert", "normal");
    doc.addFileToVFS("Roobert-SemiBold.ttf", toBase64(sbBuf));
    doc.addFont("Roobert-SemiBold.ttf", "Roobert", "bold");
    return "Roobert";
  } catch {
    return "helvetica";
  }
}

// ============ MAIN ============
export async function generateProposalPdf(opts: {
  projectType: ProjectType;
  client: ClientInfo;
  vehicles: SelectedVehicle[];
  chargers: SelectedCharger[];
  energy: EnergyParams;
}) {
  const { projectType, client, vehicles, chargers, energy } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  // Charge les paramètres PDF (couleurs + textes) depuis Supabase ET la police
  await Promise.all([applyPdfSettings(projectType), loadBrandFont(doc).then((f) => { BRAND_FONT = f; })]);

  const v = projectType === "vehicles" ? vehicles : [];
  const c = projectType === "vehicles" ? [] : chargers;

  drawCover(doc, projectType, client, v.length, c.length);

  // Executive summary "EN BREF" pour le décideur pressé
  if (v.length > 0 || c.length > 0) {
    doc.addPage();
    drawHeader(doc, client, projectType);
    drawExecutiveSummary(doc, projectType, client, v, c, energy);
  }

  doc.addPage();
  drawHeader(doc, client, projectType);
  drawWhyBeev(doc, projectType);

  if (projectType === "vehicles") {
    for (let i = 0; i < v.length; i++) {
      doc.addPage();
      drawHeader(doc, client, projectType);
      await drawVehiclePage(doc, v[i], energy, i + 1, v.length, client, projectType);
    }
  } else {
    for (let i = 0; i < c.length; i++) {
      doc.addPage();
      drawHeader(doc, client, projectType);
      await drawChargerPage(doc, c[i], projectType, i + 1, c.length, client);
    }
  }

  // Page comparaison TCO multi-véhicules (uniquement pour vehicles avec 2+ véhicules)
  if (projectType === "vehicles" && v.length >= 2 && v.some((sv) => sv.includeTco)) {
    doc.addPage();
    drawHeader(doc, client, projectType);
    drawTcoComparison(doc, v, energy);
  }

  // Page synthèse financière (uniquement pour vehicles et chargers — pas si rien sélectionné)
  if (v.length > 0 || c.length > 0) {
    doc.addPage();
    drawHeader(doc, client, projectType);
    drawFinancialSummary(doc, projectType, v, c, energy);
  }

  // Page garanties & engagements
  doc.addPage();
  drawHeader(doc, client, projectType);
  drawGuarantees(doc, projectType);

  doc.addPage();
  drawHeader(doc, client, projectType);
  drawJourney(doc, projectType, client);

  doc.addPage();
  drawHeader(doc, client, projectType);
  drawValidation(doc, projectType, client);

  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    drawFooter(doc, client, i, pages);
  }

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "client";
  const tag = projectType === "vehicles" ? "Vehicules" : projectType === "home" ? "Bornes_Domicile" : "Bornes_Site";
  doc.save(`Beev_${tag}_${safe(client.company)}_${client.date.replace(/\//g, "-")}.pdf`);
}

// ============ COVER ============
function drawCover(doc: jsPDF, type: ProjectType, c: ClientInfo, nbV: number, nbC: number) {
  // Fond noir
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Motif décoratif subtil : cercles concentriques en haut à droite
  // (couleur très proche du noir pour rester discret, donne profondeur visuelle)
  doc.setDrawColor(35, 50, 35);
  doc.setLineWidth(0.4);
  for (let r = 80; r <= 220; r += 28) {
    doc.circle(PAGE_W - 50, 90, r, "S");
  }
  doc.setLineWidth(0.5);

  // Logo "BEEV"
  doc.setTextColor(255, 255, 255);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(14);
  doc.text("BEEV", M, 80);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 185);
  doc.text("Le copilote de l'électrification des flottes · beev.co", M, 94);

  // Accent vert
  doc.setFillColor(...ACCENT);
  doc.rect(M, 110, 60, 4, "F");

  // Référence devis générée automatiquement : BEEV-AAAA-MMJJ-HHMM
  const now = new Date();
  const ref = `BEEV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  doc.setFontSize(9);
  doc.setTextColor(180, 180, 185);
  doc.text(`OFFRE COMMERCIALE · ${c.date.toUpperCase()}`, M, 230);

  // Encart référence devis (gros + visible)
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...ACCENT);
  doc.text(`DEVIS ${ref}`, M, 250);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 185);
  doc.text("Validité 30 jours · à compter de la date d'émission", M, 264);

  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(32);
  doc.setTextColor(255, 255, 255);
  doc.text("Beev × " + (c.company || "Votre entreprise"), M, 295);

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(14);
  doc.setTextColor(210, 210, 215);
  const sub = PDF_CONTENT.coverSubtitle ?? TYPE_TITLE[type];
  const subL = doc.splitTextToSize(sub, PAGE_W - M * 2);
  doc.text(subL, M, 325);

  doc.setDrawColor(80, 80, 90);
  doc.line(M, 470, PAGE_W - M, 470);
  doc.setFontSize(9);
  doc.setTextColor(170, 170, 175);
  doc.text("PRÉPARÉE POUR", M, 495);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(c.company || "—", M, 522);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(11);
  doc.setTextColor(200, 200, 205);
  if (c.contact) doc.text(c.contact, M, 542);
  if (c.email) doc.text(c.email, M, 558);

  doc.setFontSize(9);
  doc.setTextColor(170, 170, 175);
  doc.text("PRÉPARÉE PAR", PAGE_W - M, 495, { align: "right" });
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(c.salesRep || "Beev", PAGE_W - M, 522, { align: "right" });
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 205);
  if (c.salesRepEmail) doc.text(c.salesRepEmail, PAGE_W - M, 540, { align: "right" });
  if (c.salesRepPhone) doc.text(c.salesRepPhone, PAGE_W - M, 555, { align: "right" });

  // Section "Périmètre" en bas — encart avec accent vert
  doc.setDrawColor(80, 80, 90);
  doc.line(M, 640, PAGE_W - M, 640);

  doc.setFontSize(9);
  doc.setTextColor(170, 170, 175);
  doc.text("PÉRIMÈTRE", M, 665);

  const total = type === "vehicles" ? nbV : nbC;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(56);
  doc.setTextColor(...ACCENT);
  doc.text(String(total), M, 720);

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  let label: string;
  if (type === "vehicles") label = `véhicule${nbV > 1 ? "s" : ""} électrique${nbV > 1 ? "s" : ""}`;
  else if (type === "home") label = `collaborateur${nbC > 1 ? "s" : ""} équipé${nbC > 1 ? "s" : ""}`;
  else label = `site${nbC > 1 ? "s" : ""} entreprise équipé${nbC > 1 ? "s" : ""}`;
  doc.text(label.toUpperCase(), M + 90, 720);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 185);
  doc.text("dans cette proposition", M + 90, 735);

  // Coordonnées Beev en bas — pied de couverture sobre
  doc.setDrawColor(60, 60, 70);
  doc.line(M, PAGE_H - 60, PAGE_W - M, PAGE_H - 60);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 155);
  doc.text("DOCUMENT CONFIDENTIEL · USAGE INTERNE CLIENT", M, PAGE_H - 42);
  doc.setFont(BRAND_FONT, "bold");
  doc.setTextColor(...ACCENT);
  doc.text("beev.co", PAGE_W - M, PAGE_H - 42, { align: "right" });
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 125);
  doc.text(`Référence devis : ${ref}`, M, PAGE_H - 28);
  doc.text("contact@beev.co", PAGE_W - M, PAGE_H - 28, { align: "right" });
}

// ============ POURQUOI BEEV (varie par type) ============
function drawWhyBeev(doc: jsPDF, type: ProjectType) {
  let y = 130;
  eyebrow(doc, "NOTRE APPROCHE", y);
  y += 32;
  title(doc, type === "vehicles" ? "Pourquoi confier vos véhicules à Beev." :
              type === "home" ? "Le kit B2B2E clé en main pour vos collaborateurs." :
              "Un déploiement IRVE site entreprise sans friction.", y);
  y += 36;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);

  const intros: Record<ProjectType, string> = {
    vehicles: "Beev centralise pour vous le sourcing constructeur (Tesla, Mercedes, Renault, VW, Hyundai, Kia, Peugeot…), le financement LLD (Ayvens, Arval, Athlon, Leaseplan), et l'assistance multimarque tout au long de la vie du contrat. Loyers exprimés en TTC.",
    home: "Vous équipez vos collaborateurs roulant en véhicule électrique d'une borne à leur domicile. Beev gère l'intégralité : vente, installation IRVE certifiée par notre partenaire Seris, supervision, et remboursement automatisé de l'énergie consommée à titre professionnel.",
    site: "Vous électrifiez vos sites tertiaires, logistiques ou commerciaux. Beev prend en charge l'étude de site, le matériel premium (Alfen, Schneider, Hager, Wallbox), la pose IRVE certifiée, le génie civil, la mise en service OCPP et la formation des utilisateurs.",
  };
  const introText = PDF_CONTENT.whyBeevIntro ?? intros[type];
  const l1 = doc.splitTextToSize(introText, PAGE_W - M * 2);
  doc.text(l1, M, y);
  y += l1.length * 14 + 16;

  doc.setFont(BRAND_FONT, "bold");
  doc.text("Concrètement, ce qui change pour vous :", M, y);
  y += 18;
  doc.setFont(BRAND_FONT, "normal");

  const bulletsByType: Record<ProjectType, string[]> = {
    vehicles: [
      "Un interlocuteur unique pour l'intégralité de votre flotte VE.",
      "Tarifs négociés grand compte sur tous les constructeurs.",
      "Étude TCO (loyer + énergie) systématique vs référence thermique.",
      "Maintenance, assistance 24/24 et gestion des pertes totales toujours incluses.",
      "Suivi commercial dédié grand compte.",
    ],
    home: [
      "Un kit standardisé : matériel + pose 0–10 m + supervision + remboursement.",
      "Pose réalisée par technicien IRVE certifié partenaire Seris.",
      "Supervision en marque blanche : visibilité par collaborateur, par site.",
      "Remboursement automatisé de l'énergie consommée à des fins professionnelles.",
      "Garantie matériel jusqu'à 4 ans selon la gamme retenue.",
    ],
    site: [
      "Visite technique de chaque site et étude de faisabilité IRVE.",
      "Devis détaillé matériel + pose + génie civil, ligne par ligne.",
      "Pose par technicien IRVE certifié, mise en service OCPP, formation utilisateurs.",
      "Supervision flotte multi-sites et compteurs MID conformes.",
      "Garantie constructeur 3 ans extensible 6 ans.",
    ],
  };
  const bullets = PDF_CONTENT.whyBeevBullets.length > 0 ? PDF_CONTENT.whyBeevBullets : bulletsByType[type];
  bullets.forEach((b) => {
    doc.setFillColor(...ACCENT);
    doc.circle(M + 4, y - 3, 2, "F");
    const t = doc.splitTextToSize(b, PAGE_W - M * 2 - 16);
    doc.setTextColor(...INK);
    doc.text(t, M + 14, y);
    y += t.length * 14 + 6;
  });

  // ===== Section "Beev en chiffres" (preuve sociale) =====
  if (y < FOOTER_LIMIT - 130) {
    y += 14;
    doc.setFillColor(...INK);
    doc.rect(M, y, PAGE_W - M * 2, 90, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...ACCENT);
    doc.text("BEEV EN CHIFFRES", M + 16, y + 18);

    const stats: Array<{ value: string; label: string }> = [
      { value: "200+", label: "entreprises\naccompagnées" },
      { value: "1500+", label: "véhicules\nlivrés" },
      { value: "800+", label: "bornes\ninstallées" },
      { value: "97 %", label: "clients satisfaits\n(NPS 2025)" },
    ];
    const cw = (PAGE_W - M * 2 - 32) / stats.length;
    stats.forEach((s, i) => {
      const x = M + 16 + i * cw;
      doc.setFont(BRAND_FONT, "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text(s.value, x, y + 50);
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 185);
      const lbl = doc.splitTextToSize(s.label, cw - 8);
      doc.text(lbl, x, y + 64);
    });
    y += 100;
  }

  // ===== Citation client (témoignage) =====
  if (y < FOOTER_LIMIT - 80) {
    doc.setFillColor(...BG);
    doc.rect(M, y, PAGE_W - M * 2, 60, "F");
    doc.setFillColor(...LAVENDER);
    doc.rect(M, y, 4, 60, "F");
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    const quoteByType: Record<ProjectType, { quote: string; author: string }> = {
      vehicles: {
        quote: "« Beev nous a permis d'électrifier 22 véhicules en 3 mois, avec un interlocuteur unique et un suivi sans faille. »",
        author: "DAF · ETI logistique 180 collaborateurs",
      },
      home: {
        quote: "« Le kit B2B2E Beev a simplifié notre déploiement chez 35 collaborateurs : zéro charge pour notre équipe RH. »",
        author: "DRH · PME tech 60 collaborateurs",
      },
      site: {
        quote: "« Étude IRVE rigoureuse, pose dans les délais, supervision OCPP impeccable. Du clé en main. »",
        author: "Directeur immobilier · ETI tertiaire 400 collaborateurs",
      },
    };
    const q = quoteByType[type];
    const ql = doc.splitTextToSize(q.quote, PAGE_W - M * 2 - 32);
    doc.text(ql, M + 16, y + 22);
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUB);
    doc.text(q.author.toUpperCase(), M + 16, y + 50);
  }
}

// ============ FICHE VÉHICULE ============
async function drawVehiclePage(doc: jsPDF, sv: SelectedVehicle, e: EnergyParams, idx: number, total: number, client: ClientInfo, type: ProjectType) {
  const v = sv.vehicle;
  eyebrow(doc, `VÉHICULE ${idx} / ${total}`, 116);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(`${v.brand} ${v.model}`, M, 148);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(11);
  doc.setTextColor(...SUB);
  doc.text(`${v.version} · ${v.category} · ${v.energy}`, M, 166);

  const imgY = 182;
  const imgW = (PAGE_W - M * 2) * 0.55;
  const imgH = 170;
  doc.setFillColor(...BG);
  doc.rect(M, imgY, imgW, imgH, "F");
  await drawImageContain(doc, v.image, M + 6, imgY + 6, imgW - 12, imgH - 12);

  const px = M + imgW + 14;
  const pw = PAGE_W - M - px;
  doc.setFillColor(...INK);
  doc.rect(px, imgY, pw, 26, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("TARIFICATION LLD", px + 12, imgY + 17);

  doc.setFillColor(...BG);
  doc.rect(px, imgY + 26, pw, imgH - 26, "F");
  let py = imgY + 46;
  const discounted = v.priceTtc * (1 - sv.discountPct / 100);
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text("PRIX CATALOGUE TTC", px + 12, py);
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(eur(v.priceTtc), px + 12, py + 14);

  py += 32;
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(`REMISE COMMERCIALE -${sv.discountPct.toFixed(1)} %`, px + 12, py);
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(eur(discounted), px + 12, py + 14);

  py += 28;
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1.5);
  doc.line(px + 12, py, px + 50, py);
  doc.setLineWidth(0.5);

  py += 14;
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(`LOYER MENSUEL TTC · ${sv.durationMonths} mois`, px + 12, py);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(eur(sv.negotiatedMonthly), px + 12, py + 22);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(`× ${sv.quantity} véhicule${sv.quantity > 1 ? "s" : ""} · ${fmt(sv.kmPerYear)} km/an`, px + 12, py + 38);

  let y = imgY + imgH + 20;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Caractéristique technique", "Valeur"]],
    body: [
      ["Énergie", v.energy],
      ["Autonomie / distance WLTP", v.energy === "Électrique" || v.energy === "Hybride Rechargeable" ? `${v.rangeWltp} km` : "—"],
      ["Capacité batterie", v.batteryKwh > 0 ? `${v.batteryKwh} kWh` : "—"],
      ["Puissance", `${v.powerHp} ch`],
      [v.energy === "Électrique" || v.energy === "Hybride Rechargeable" ? "Consommation" : "Consommation moyenne", v.energy === "Électrique" ? `${v.consumption} kWh/100 km` : `${v.consumption} L/100 km`],
      ["CO₂", `${v.co2} g/km`],
      ["Puissance fiscale", `${v.fiscalHp} CV`],
    ],
    headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold", font: BRAND_FONT },
    bodyStyles: { fontSize: 9.5, cellPadding: 6, textColor: INK, lineColor: RULE, font: BRAND_FONT },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  if (sv.includeTco && y < FOOTER_LIMIT - 130) {
    const t = computeTco(sv, e);
    const cardH = 120;
    doc.setFillColor(...BG);
    doc.rect(M, y, PAGE_W - M * 2, cardH, "F");
    doc.setFillColor(...ACCENT);
    doc.rect(M, y, 4, cardH, "F");

    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...SUB);
    doc.text(`COMPARAISON TCO AUX 100 KM`, M + 16, y + 16);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7.5);
    doc.text(`${sv.durationMonths} mois · ${fmt(sv.kmPerYear)} km/an · estimation non contractuelle`, M + 16, y + 27);

    // Graphique à barres horizontales
    const chartX = M + 16;
    const chartW = PAGE_W - M * 2 - 32;
    const labelW = 90;
    const valueW = 70;
    const barMaxW = chartW - labelW - valueW;
    const maxVal = Math.max(t.tco100, t.refTco100);
    const barH = 14;

    // Bar 1 : Votre véhicule (vert)
    const y1 = y + 48;
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text("Votre VE", chartX, y1 + 10);
    const leaseW1 = (t.lease100 / maxVal) * barMaxW;
    const energyW1 = (t.energy100 / maxVal) * barMaxW;
    doc.setFillColor(...ACCENT);
    doc.rect(chartX + labelW, y1, leaseW1, barH, "F");
    doc.setFillColor(120, 180, 100);
    doc.rect(chartX + labelW + leaseW1, y1, energyW1, barH, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(eur2(t.tco100), chartX + labelW + leaseW1 + energyW1 + 6, y1 + 10);

    // Bar 2 : Référence essence (gris)
    const y2 = y + 72;
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SUB);
    doc.text("Réf. essence*", chartX, y2 + 10);
    const refLeaseW2 = (((500 * 12) / Math.max(sv.kmPerYear, 1) * 100) / maxVal) * barMaxW;
    const refFuelW2 = ((6.0 * e.fuelPriceL) / maxVal) * barMaxW;
    doc.setFillColor(140, 140, 145);
    doc.rect(chartX + labelW, y2, refLeaseW2, barH, "F");
    doc.setFillColor(190, 190, 195);
    doc.rect(chartX + labelW + refLeaseW2, y2, refFuelW2, barH, "F");
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...SUB);
    doc.text(eur2(t.refTco100), chartX + labelW + refLeaseW2 + refFuelW2 + 6, y2 + 10);

    // Économie en gros à droite
    const economyText = t.economy100 >= 0 ? `+ ${eur2(t.economy100)}` : `- ${eur2(-t.economy100)}`;
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...SUB);
    doc.text("ÉCONOMIE / 100 km", PAGE_W - M - 16, y + 50, { align: "right" });
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(18);
    doc.setTextColor(...(t.economy100 >= 0 ? ACCENT : INK));
    doc.text(economyText, PAGE_W - M - 16, y + 70, { align: "right" });
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SUB);
    if (t.economy100 >= 0) {
      const yearlyEconomy = t.economy100 * (sv.kmPerYear / 100);
      doc.text(`soit ${eur(yearlyEconomy)}/an`, PAGE_W - M - 16, y + 82, { align: "right" });
    }

    // Légende en bas
    const legendY = y + cardH - 12;
    doc.setFillColor(...ACCENT);
    doc.rect(chartX, legendY, 8, 6, "F");
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SUB);
    doc.text("Loyer / 100 km", chartX + 12, legendY + 5);
    doc.setFillColor(120, 180, 100);
    doc.rect(chartX + 90, legendY, 8, 6, "F");
    doc.text("Énergie / 100 km", chartX + 102, legendY + 5);
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 155);
    doc.text("*Réf. : véhicule essence équiv. 500 €/mois, 6 L/100 km", chartX + 200, legendY + 5);

    y += cardH + 12;
  }

  const allServices = [...MANDATORY_SERVICES, ...sv.services.filter((s) => !MANDATORY_SERVICES.includes(s as any))];
  const servicesText = allServices.map((s) => `· ${s}`).join("\n");
  const body: any[] = [
    [{ content: "Prestations & services compris dans le loyer", colSpan: 4, styles: { fillColor: BG, fontStyle: "bold", textColor: INK } }],
    [{ content: servicesText, colSpan: 4, styles: { fontSize: 9.5, textColor: INK } }],
  ];
  if (sv.options.length) {
    body.push([{ content: "Options & accessoires inclus", colSpan: 4, styles: { fillColor: BG, fontStyle: "bold", textColor: INK } }]);
    sv.options.forEach((li) => body.push([li.label, String(li.qty), eur(li.unitHt), eur(li.qty * li.unitHt)]));
  }
  y = ensureSpace(doc, y, 80, client, type);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Désignation", "Qté", "PU HT", "Total HT"]],
    body: body as any,
    headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold", font: BRAND_FONT },
    bodyStyles: { fontSize: 9, cellPadding: 6, textColor: INK, lineColor: RULE, font: BRAND_FONT },
    columnStyles: { 1: { halign: "center", cellWidth: 40 }, 2: { halign: "right", cellWidth: 70 }, 3: { halign: "right", cellWidth: 80, fontStyle: "bold" } },
    margin: { left: M, right: M },
  });
}

// ============ FICHE BORNE / SITE ============
async function drawChargerPage(doc: jsPDF, sc: SelectedCharger, type: ProjectType, idx: number, total: number, client: ClientInfo) {
  const isHome = type === "home";
  eyebrow(doc, `${isHome ? "COLLABORATEUR" : "SITE"} ${idx} / ${total}`, 116);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(sc.siteName || `${sc.charger.brand} ${sc.charger.model}`, M, 148);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(11);
  doc.setTextColor(...SUB);
  doc.text(`${sc.charger.brand} ${sc.charger.model} · ${sc.charger.powerKw} kW · ${sc.charger.type}`, M, 166);
  if (sc.siteAddress) {
    doc.setFontSize(10);
    doc.text(sc.siteAddress, M, 182);
  }

  // Image (format auto, ratio préservé) + features
  const imgY = 200;
  const imgW = 200;
  const imgH = 150;
  doc.setFillColor(...BG);
  doc.rect(M, imgY, imgW, imgH, "F");
  await drawImageContain(doc, sc.charger.image, M + 6, imgY + 6, imgW - 12, imgH - 12);

  const fx = M + imgW + 18;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  doc.text("CARACTÉRISTIQUES MATÉRIEL", fx, imgY + 14);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  let fy = imgY + 32;
  sc.charger.features.forEach((f) => {
    doc.setFillColor(...ACCENT);
    doc.circle(fx + 3, fy - 3, 2, "F");
    const tt = doc.splitTextToSize(f, PAGE_W - M - fx - 14);
    doc.text(tt, fx + 12, fy);
    fy += tt.length * 14;
  });
  if (sc.siteContact) {
    fy += 6;
    doc.setFontSize(9);
    doc.setTextColor(...SUB);
    doc.text(`Contact ${isHome ? "collaborateur" : "site"} : ${sc.siteContact}`, fx, fy);
  }

  let y = imgY + imgH + 20;

  // Le PDF client utilise les prix avec marge (lineItemClientUnit/Total).
  // Le prix d'achat (unitHt brut) et la marge restent invisibles côté client.
  const total_ = sc.lineItems.reduce((a, li) => a + lineItemClientTotal(li), 0);
  y = ensureSpace(doc, y, 90, client, type);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Désignation", "Qté", "PU HT", "Total HT"]],
    body: ([
      ...sc.lineItems.map((li) => [li.label, String(li.qty), eur(lineItemClientUnit(li)), eur(lineItemClientTotal(li))]),
      [
        { content: isHome ? "Total HT par collaborateur" : "Total HT site", colSpan: 3, styles: { fontStyle: "bold", halign: "right", fillColor: BG } },
        { content: eur(total_), styles: { fontStyle: "bold", halign: "right", fillColor: BG } },
      ],
      ...(sc.quantity > 1 ? [[
        { content: `Total HT × ${sc.quantity}`, colSpan: 3, styles: { fontStyle: "bold", halign: "right", textColor: ACCENT } },
        { content: eur(total_ * sc.quantity), styles: { fontStyle: "bold", halign: "right", textColor: ACCENT } },
      ]] : []),
    ] as any),
    headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold", font: BRAND_FONT },
    bodyStyles: { fontSize: 9, cellPadding: 6, textColor: INK, lineColor: RULE, font: BRAND_FONT },
    columnStyles: { 1: { halign: "center", cellWidth: 40 }, 2: { halign: "right", cellWidth: 80 }, 3: { halign: "right", cellWidth: 90, fontStyle: "bold" } },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  const inclusionTxt = isHome
    ? "Pose 0–10 m incluse · matériel · raccordement par technicien IRVE certifié partenaire Seris · supervision en marque blanche · remboursement automatisé de l'énergie consommée à titre professionnel · garantie matériel selon gamme."
    : "Étude de site · pose & raccordement par technicien IRVE certifié · paramétrage OCPP & superviseur · formation utilisateurs · gestion des déchets de chantier · garantie constructeur 3 ans (extensible 6 ans).";
  if (y < FOOTER_LIMIT - 70) {
    doc.setFillColor(...BG);
    doc.rect(M, y, PAGE_W - M * 2, 60, "F");
    doc.setFillColor(...LAVENDER);
    doc.rect(M, y, 4, 60, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...SUB);
    doc.text(isHome ? "INCLUS DANS LE KIT B2B2E" : "INCLUS DANS LA PRESTATION IRVE", M + 16, y + 18);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(inclusionTxt, PAGE_W - M * 2 - 32);
    doc.text(lines, M + 16, y + 36);
  }
}

// ============ PARCOURS CLIENT BEEV (A → Z) ============
// ============ COMPARAISON TCO MULTI-VÉHICULES ============
// Affichée uniquement si 2+ véhicules sont dans la sélection. Donne au client
// une vue d'ensemble visuelle des économies attendues sur l'ensemble du parc.
function drawTcoComparison(doc: jsPDF, vehicles: SelectedVehicle[], e: EnergyParams) {
  let y = 130;
  eyebrow(doc, "COMPARAISON TCO FLOTTE", y);
  y += 32;
  title(doc, "Économies cumulées sur l'ensemble du parc.", y);
  y += 36;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...SUB);
  const intro = "Visualisation du TCO aux 100 km par véhicule sélectionné, comparé à une flotte essence équivalente. Les valeurs sont indicatives et non contractuelles.";
  const introL = doc.splitTextToSize(intro, PAGE_W - M * 2);
  doc.text(introL, M, y);
  y += introL.length * 14 + 18;

  // Calcule les TCO pour tous les véhicules
  const tcos = vehicles.map((sv) => ({
    sv,
    tco: computeTco(sv, e),
  }));

  // Trouve le max pour normaliser le graphique
  const maxTco = Math.max(
    ...tcos.map((t) => Math.max(t.tco.tco100, t.tco.refTco100)),
  );

  const chartX = M;
  const chartW = PAGE_W - M * 2;
  const labelW = 130;
  const valueW = 56;
  const barMaxW = chartW - labelW - valueW;
  const rowH = 36;

  // Header chart
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SUB);
  doc.text("VÉHICULE", chartX, y);
  doc.text("TCO / 100 km (vs essence)", chartX + labelW, y);
  doc.text("ÉCONOMIE", chartX + chartW, y, { align: "right" });
  y += 6;
  doc.setDrawColor(...RULE);
  doc.line(chartX, y, chartX + chartW, y);
  y += 10;

  tcos.forEach(({ sv, tco }) => {
    // Label véhicule
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    const lblShort = `${sv.vehicle.brand} ${sv.vehicle.model}`.slice(0, 22);
    doc.text(lblShort, chartX, y + 8);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SUB);
    doc.text(`× ${sv.quantity}`, chartX, y + 19);

    // Barre TCO VE (vert)
    const veBarW = (tco.tco100 / maxTco) * barMaxW;
    doc.setFillColor(...ACCENT);
    doc.rect(chartX + labelW, y, veBarW, 11, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(eur2(tco.tco100), chartX + labelW + veBarW + 4, y + 8);

    // Barre référence essence (gris)
    const refBarW = (tco.refTco100 / maxTco) * barMaxW;
    doc.setFillColor(170, 170, 175);
    doc.rect(chartX + labelW, y + 14, refBarW, 11, "F");
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SUB);
    doc.text(`vs ${eur2(tco.refTco100)} essence`, chartX + labelW + refBarW + 4, y + 22);

    // Économie à droite
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...(tco.economy100 >= 0 ? ACCENT : INK));
    const ecoText = tco.economy100 >= 0 ? `+ ${eur2(tco.economy100)}` : `- ${eur2(-tco.economy100)}`;
    doc.text(ecoText, chartX + chartW, y + 12, { align: "right" });

    y += rowH;
  });

  // ===== Totaux cumulés =====
  y += 10;
  doc.setDrawColor(...INK);
  doc.setLineWidth(1);
  doc.line(chartX, y, chartX + chartW, y);
  y += 14;

  let totalEconomyAnnual = 0;
  let totalEconomyContract = 0;
  tcos.forEach(({ sv, tco }) => {
    const annual = tco.economy100 * (sv.kmPerYear / 100) * sv.quantity;
    totalEconomyAnnual += annual;
    totalEconomyContract += annual * (sv.durationMonths / 12);
  });

  // Bandeau "économies cumulées" en gros
  doc.setFillColor(...INK);
  doc.rect(chartX, y, chartW, 80, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(chartX, y, 4, 80, "F");

  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ACCENT);
  doc.text("ÉCONOMIES CUMULÉES POUR VOTRE FLOTTE", chartX + 16, y + 20);

  const colW = (chartW - 32) / 2;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(180, 180, 185);
  doc.text("PAR AN", chartX + 16, y + 40);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(totalEconomyAnnual >= 0 ? `+ ${eur(totalEconomyAnnual)}` : eur(totalEconomyAnnual), chartX + 16, y + 64);

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(180, 180, 185);
  doc.text("SUR LA DURÉE TOTALE DU CONTRAT", chartX + 16 + colW, y + 40);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(22);
  doc.setTextColor(...ACCENT);
  doc.text(totalEconomyContract >= 0 ? `+ ${eur(totalEconomyContract)}` : eur(totalEconomyContract), chartX + 16 + colW, y + 64);

  y += 90;

  // Mention bas
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUB);
  doc.text("Estimation indicative basée sur les paramètres énergie & kilométrage de votre projet. Référence essence : véhicule équivalent loyer 500 €/mois, conso 6 L/100 km.", chartX, y, {
    maxWidth: chartW,
  });
}

// ============ GARANTIES & ENGAGEMENTS BEEV ============
function drawGuarantees(doc: jsPDF, type: ProjectType) {
  let y = 130;
  eyebrow(doc, "GARANTIES & ENGAGEMENTS BEEV", y);
  y += 32;
  title(doc, "Ce que Beev s'engage à tenir.", y);
  y += 36;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...SUB);
  const intro = type === "vehicles"
    ? "Au-delà du tarif catalogue, Beev s'engage sur la qualité opérationnelle pendant toute la durée du contrat LLD."
    : type === "home"
    ? "Pour chaque collaborateur équipé, Beev pilote l'installation, la supervision et l'exploitation pendant toute la durée du contrat."
    : "Pour chaque site IRVE, Beev s'engage sur des SLA opérationnels mesurables, du déploiement à l'exploitation.";
  const introL = doc.splitTextToSize(intro, PAGE_W - M * 2);
  doc.text(introL, M, y);
  y += introL.length * 14 + 18;

  // 3 piliers d'engagement (cartes alignées)
  const pillarsByType: Record<ProjectType, Array<{ title: string; metric: string; details: string[] }>> = {
    vehicles: [
      {
        title: "INTERLOCUTEUR UNIQUE",
        metric: "Réponse J+1",
        details: [
          "Un commercial grand compte dédié",
          "Hotline gestion de flotte mutualisée",
          "Coordination loueurs (Ayvens, Arval, Athlon, Leaseplan)",
          "Suivi livraisons et incidents constructeurs",
        ],
      },
      {
        title: "MAINTENANCE INCLUSE",
        metric: "Tous réseaux",
        details: [
          "Entretien constructeur tous réseaux",
          "Assistance 24/24, dépannage routier",
          "Véhicule de remplacement selon contrat",
          "Garantie perte financière en cas de vol/sinistre",
        ],
      },
      {
        title: "PILOTAGE FLEET MANAGER",
        metric: "Dashboard live",
        details: [
          "Accès Fleet Manager Beev multi-utilisateurs",
          "Suivi des PV de livraison et restitutions",
          "Mise à jour fiscalité applicable",
          "Reporting consolidé sur demande",
        ],
      },
    ],
    home: [
      {
        title: "POSE IRVE CERTIFIÉE",
        metric: "Partenaire Seris",
        details: [
          "Pose 0–10 m incluse · garantie 4 ans",
          "Visite technique systématique",
          "Mise en service le jour de la pose",
          "Procès-verbal signé collaborateur",
        ],
      },
      {
        title: "SUPERVISION MARQUE BLANCHE",
        metric: "Temps réel",
        details: [
          "Visibilité par collaborateur, par site",
          "Mesures conformes MID",
          "Données disponibles sous 24h",
          "API d'export pour SI RH si besoin",
        ],
      },
      {
        title: "REMBOURSEMENT AUTOMATISÉ",
        metric: "Sous 30 jours",
        details: [
          "Calcul mensuel des kWh professionnels",
          "Virement automatique au collaborateur",
          "Facturation employeur consolidée",
          "Garantie de conformité fiscale",
        ],
      },
    ],
    site: [
      {
        title: "GARANTIE MATÉRIEL",
        metric: "3 ans (ext. 6)",
        details: [
          "Constructeurs premium : Alfen, Schneider, Hager, Wallbox",
          "Garantie pièces & main d'œuvre 3 ans",
          "Extension à 6 ans en option",
          "SAV reconditionné en cas de panne hardware",
        ],
      },
      {
        title: "POSE IRVE CERTIFIÉE",
        metric: "OCPP-ready",
        details: [
          "Technicien IRVE certifié AFNOR",
          "Paramétrage OCPP 1.6/2.0",
          "Mise en service & formation utilisateurs",
          "Signature PV de réception conjoint",
        ],
      },
      {
        title: "EXPLOITATION & SAV",
        metric: "GTR contractuelle",
        details: [
          "Hotline utilisateurs 24/24",
          "GTR rétablissement sous 24h ouvrées",
          "Supervision multi-sites consolidée",
          "Maintenance préventive annuelle incluse",
        ],
      },
    ],
  };

  const pillars = pillarsByType[type];
  const colW = (PAGE_W - M * 2 - 16) / 3;
  pillars.forEach((p, i) => {
    const x = M + i * (colW + 8);
    doc.setFillColor(...BG);
    doc.rect(x, y, colW, 200, "F");
    doc.setFillColor(...ACCENT);
    doc.rect(x, y, colW, 4, "F");

    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUB);
    const titleLines = doc.splitTextToSize(p.title, colW - 20);
    doc.text(titleLines, x + 10, y + 22);

    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(18);
    doc.setTextColor(...ACCENT);
    const metricLines = doc.splitTextToSize(p.metric, colW - 20);
    doc.text(metricLines, x + 10, y + 22 + titleLines.length * 11 + 18);

    let yy = y + 22 + titleLines.length * 11 + 18 + metricLines.length * 18 + 12;
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    p.details.forEach((d) => {
      doc.setFillColor(...ACCENT);
      doc.circle(x + 13, yy - 3, 1.5, "F");
      const dl = doc.splitTextToSize(d, colW - 24);
      doc.text(dl, x + 20, yy);
      yy += dl.length * 10 + 4;
    });
  });

  y += 220;

  // Bandeau "trust signal" en bas
  doc.setFillColor(...INK);
  doc.rect(M, y, PAGE_W - M * 2, 60, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ACCENT);
  doc.text("BEEV EN CHIFFRES (2026)", M + 16, y + 20);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("Le copilote tout-en-un de l'électrification des flottes en France :", M + 16, y + 36);
  doc.text("vente VE multi-marques · installation IRVE · logiciel Fleet Manager.", M + 16, y + 50);
}

// ============ EXECUTIVE SUMMARY (page "EN BREF" — décideur) ============
function drawExecutiveSummary(
  doc: jsPDF,
  type: ProjectType,
  c: ClientInfo,
  vehicles: SelectedVehicle[],
  chargers: SelectedCharger[],
  e: EnergyParams,
) {
  let y = 116;
  eyebrow(doc, "EN BREF · POUR LE COMITÉ DE DIRECTION", y);
  y += 32;
  title(doc, type === "vehicles" ? "Votre flotte électrique en synthèse." :
            type === "home" ? "Votre déploiement domicile en synthèse." :
            "Votre projet IRVE site en synthèse.", y);
  y += 30;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const introText = type === "vehicles"
    ? `Cette page résume l'essentiel pour ${c.company || "votre entreprise"} : périmètre, budget, économies attendues et engagements Beev.`
    : `Cette page résume l'essentiel pour ${c.company || "votre entreprise"} : périmètre, budget, modalités et engagements Beev.`;
  const introLines = doc.splitTextToSize(introText, PAGE_W - M * 2);
  doc.text(introLines, M, y);
  y += introLines.length * 13 + 16;

  // ===== Calculs financiers =====
  let monthlyTtc = 0, annualTtc = 0, totalContrat = 0;
  let chargersHt = 0;
  let economy100Total = 0;
  let vehiclesCount = 0;

  vehicles.forEach((sv) => {
    monthlyTtc += sv.negotiatedMonthly * sv.quantity;
    annualTtc += sv.negotiatedMonthly * 12 * sv.quantity;
    totalContrat += sv.negotiatedMonthly * sv.durationMonths * sv.quantity;
    vehiclesCount += sv.quantity;
    if (sv.includeTco) {
      const t = computeTco(sv, e);
      economy100Total += t.economy100 * (sv.kmPerYear / 100) * sv.quantity;
    } else {
      // Estimation par défaut même sans TCO inclus
      const t = computeTco(sv, e);
      economy100Total += t.economy100 * (sv.kmPerYear / 100) * sv.quantity;
    }
  });
  chargers.forEach((sc) => {
    chargersHt += sc.lineItems.reduce((a, li) => a + lineItemClientTotal(li), 0) * sc.quantity;
  });
  const chargersTtc = chargersHt * 1.20;

  // ===== Grille 2x2 de KPIs =====
  const colW = (PAGE_W - M * 2 - 12) / 2;
  const startY = y;
  const rowH = 100;

  // KPI 1 : Périmètre
  drawKpiBlock(doc, M, startY, colW, rowH, "PÉRIMÈTRE DU PROJET", [
    type === "vehicles"
      ? { label: "Véhicules étudiés", value: String(vehiclesCount), accent: true }
      : { label: type === "home" ? "Bornes domicile" : "Bornes site", value: String(chargers.reduce((a, sc) => a + sc.quantity, 0)), accent: true },
    type === "vehicles" && vehicles[0]
      ? { label: "Durée LLD", value: `${vehicles[0].durationMonths} mois` }
      : { label: "Type", value: type === "home" ? "B2B2E" : "IRVE site" },
    type === "vehicles" && vehicles[0]
      ? { label: "Kilométrage", value: `${fmt(vehicles[0].kmPerYear)} km/an` }
      : { label: "Modèles", value: String(chargers.length) },
  ]);

  // KPI 2 : Investissement
  drawKpiBlock(doc, M + colW + 12, startY, colW, rowH, "INVESTISSEMENT", type === "vehicles" ? [
    { label: "Loyer mensuel TTC", value: eur(monthlyTtc), accent: true },
    { label: "Loyer annuel TTC", value: eur(annualTtc) },
    { label: "Total contrat", value: eur(totalContrat) },
  ] : [
    { label: "Total HT", value: eur(chargersHt), accent: true },
    { label: "TVA 20 %", value: eur(chargersTtc - chargersHt) },
    { label: "Total TTC", value: eur(chargersTtc) },
  ]);

  // KPI 3 : Bénéfices (économies pour vehicles, garanties pour chargers)
  drawKpiBlock(doc, M, startY + rowH + 12, colW, rowH, type === "vehicles" ? "ÉCONOMIES vs FLOTTE ESSENCE" : "GARANTIES MATÉRIEL", type === "vehicles" ? [
    { label: "Économie annuelle estimée", value: economy100Total > 0 ? `+ ${eur(economy100Total)}` : eur(economy100Total), accent: economy100Total > 0 },
    { label: "Sur la durée contrat", value: economy100Total > 0 ? `+ ${eur(economy100Total * (vehicles[0]?.durationMonths ?? 48) / 12)}` : "—" },
    { label: "TVA récupérable", value: "100 %" },
  ] : [
    { label: "Garantie matériel", value: type === "home" ? "2 à 4 ans" : "3 ans (ext. 6)", accent: true },
    { label: "Pose IRVE certifiée", value: type === "home" ? "Seris" : "Beev × partenaires" },
    { label: "Supervision incluse", value: "OCPP / marque blanche" },
  ]);

  // KPI 4 : Engagements Beev
  drawKpiBlock(doc, M + colW + 12, startY + rowH + 12, colW, rowH, "ENGAGEMENTS BEEV", [
    { label: "Interlocuteur dédié", value: "Grand compte", accent: true },
    { label: "Hotline réactive", value: "Réponse J+1 ouvré" },
    { label: type === "vehicles" ? "Maintenance & assistance" : "Mise en service OCPP", value: "Incluses" },
  ]);

  // Prochaine étape en bas
  y = startY + 2 * rowH + 32;
  doc.setFillColor(...INK);
  doc.rect(M, y, PAGE_W - M * 2, 50, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(M, y, 4, 50, "F");
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ACCENT);
  doc.text("PROCHAINE ÉTAPE", M + 16, y + 18);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  const nextStep = type === "vehicles"
    ? "Signature du Bon Pour Accord → émission des BC LLD sous 10 jours ouvrés."
    : type === "home"
    ? "Validation de la convention B2B2E → onboarding des collaborateurs en parallèle."
    : "Validation de l'offre cadre → étude technique site sous 5 jours ouvrés.";
  doc.text(nextStep, M + 16, y + 36);
}

// Helper : dessine un bloc KPI sur fond cream avec accent vert
function drawKpiBlock(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  items: Array<{ label: string; value: string; accent?: boolean }>,
) {
  doc.setFillColor(...BG);
  doc.rect(x, y, w, h, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(x, y, 3, h, "F");

  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(title, x + 12, y + 14);

  let yy = y + 30;
  items.forEach((it, i) => {
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SUB);
    doc.text(it.label.toUpperCase(), x + 12, yy);
    doc.setFont(BRAND_FONT, it.accent ? "bold" : "normal");
    doc.setFontSize(i === 0 || it.accent ? 14 : 11);
    doc.setTextColor(it.accent ? ACCENT[0] : INK[0], it.accent ? ACCENT[1] : INK[1], it.accent ? ACCENT[2] : INK[2]);
    doc.text(it.value, x + 12, yy + 14);
    yy += 22;
  });
}

// ============ SYNTHÈSE FINANCIÈRE (récap HT / TVA / TTC) ============
function drawFinancialSummary(
  doc: jsPDF,
  type: ProjectType,
  vehicles: SelectedVehicle[],
  chargers: SelectedCharger[],
  _e: EnergyParams,
) {
  let y = 130;
  eyebrow(doc, "SYNTHÈSE FINANCIÈRE", y);
  y += 32;
  title(doc, type === "vehicles" ? "Récapitulatif loyers LLD." : "Récapitulatif HT / TVA / TTC.", y);
  y += 30;

  if (type === "vehicles") {
    // Pour les véhicules : récap LLD mensuel + annuel TTC (la fiscalité TVA récupérée)
    let monthlyTotal = 0;
    let annualTotal = 0;
    const rows: Array<[string, string, string, string]> = [];
    vehicles.forEach((sv) => {
      const monthly = sv.negotiatedMonthly * sv.quantity;
      const annual = monthly * 12;
      monthlyTotal += monthly;
      annualTotal += annual;
      rows.push([
        `${sv.vehicle.brand} ${sv.vehicle.model}`,
        `${sv.quantity} × ${sv.durationMonths} mois`,
        eur(sv.negotiatedMonthly),
        eur(monthly),
      ]);
    });

    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["Véhicule", "Conditions", "Loyer unitaire/mois", "Loyer mensuel TTC"]],
      body: rows,
      foot: [
        ["", "", { content: "Loyer mensuel total TTC", styles: { fontStyle: "bold", halign: "right" } }, { content: eur(monthlyTotal), styles: { fontStyle: "bold", halign: "right", fillColor: BG } }],
        ["", "", { content: "Loyer annuel total TTC", styles: { fontStyle: "bold", halign: "right" } }, { content: eur(annualTotal), styles: { fontStyle: "bold", halign: "right", fillColor: ACCENT, textColor: 255 } }],
      ],
      headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold", font: BRAND_FONT },
      bodyStyles: { fontSize: 9.5, cellPadding: 6, textColor: INK, lineColor: RULE, font: BRAND_FONT },
      footStyles: { fontSize: 9.5, fillColor: BG, textColor: INK, font: BRAND_FONT },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 16;

    // Mention TVA
    doc.setFontSize(9);
    doc.setTextColor(...SUB);
    doc.text("Loyers exprimés en TTC. Conformément à la fiscalité LLD, la TVA sur le loyer véhicule électrique est récupérable à 100 %.", M, y);
  } else {
    // Pour les chargers (home / site) : tableau HT par site + TVA 20 % + TTC
    let totalHt = 0;
    const rows: Array<[string, string, string]> = [];
    chargers.forEach((sc) => {
      const lineTotalHt = sc.lineItems.reduce((a, li) => a + lineItemClientTotal(li), 0);
      const totalForSite = lineTotalHt * sc.quantity;
      totalHt += totalForSite;
      const label = sc.siteName ? `${sc.siteName} — ${sc.charger.brand} ${sc.charger.model}` : `${sc.charger.brand} ${sc.charger.model}`;
      rows.push([
        label,
        `${sc.quantity} ${sc.charger.deployment === "domicile" ? "collab." : "borne(s)"}`,
        eur(totalForSite),
      ]);
    });
    const tva = totalHt * 0.20;
    const ttc = totalHt + tva;

    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["Désignation", "Quantité", "Total HT"]],
      body: rows,
      foot: [
        ["", { content: "Sous-total HT", styles: { fontStyle: "bold", halign: "right" } }, { content: eur(totalHt), styles: { halign: "right", fontStyle: "bold" } }],
        ["", { content: "TVA 20 %", styles: { halign: "right" } }, { content: eur(tva), styles: { halign: "right" } }],
        ["", { content: "Total TTC", styles: { fontStyle: "bold", halign: "right" } }, { content: eur(ttc), styles: { halign: "right", fontStyle: "bold", fillColor: ACCENT, textColor: 255 } }],
      ],
      headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold", font: BRAND_FONT },
      bodyStyles: { fontSize: 9.5, cellPadding: 6, textColor: INK, lineColor: RULE, font: BRAND_FONT },
      footStyles: { fontSize: 9.5, fillColor: BG, textColor: INK, font: BRAND_FONT },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right", fontStyle: "bold" } },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 16;

    // Mentions de paiement standard
    doc.setFillColor(...BG);
    doc.rect(M, y, PAGE_W - M * 2, 60, "F");
    doc.setFillColor(...ACCENT);
    doc.rect(M, y, 4, 60, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...SUB);
    doc.text("MODALITÉS DE PAIEMENT (À CONFIRMER LORS DE LA SIGNATURE)", M + 16, y + 16);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    const modalities = [
      "30 % à la commande, 60 % à la pose, 10 % à la mise en service.",
      "Acompte facturé sous 8 jours. Solde sous 30 jours après PV de réception.",
      "TVA 20 % facturée selon le régime applicable à votre entreprise.",
    ];
    modalities.forEach((m, i) => {
      doc.text("· " + m, M + 16, y + 32 + i * 11);
    });
  }
}

function drawJourney(doc: jsPDF, type: ProjectType, client: ClientInfo) {
  const fallbackJourney = BEEV_JOURNEYS[type];
  const j = PDF_CONTENT.steps.length > 0
    ? { intro: fallbackJourney.intro, steps: PDF_CONTENT.steps }
    : fallbackJourney;
  let y = 116;
  eyebrow(doc, "PARCOURS CLIENT BEEV — DE A À Z", y);
  y += 32;
  title(doc, type === "vehicles" ? "Comment Beev pilote votre flotte." :
              type === "home" ? "Comment Beev équipe vos collaborateurs." :
              "Comment Beev déploie vos sites.", y);
  y += 30;

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  const intro = doc.splitTextToSize(j.intro, PAGE_W - M * 2);
  doc.text(intro, M, y);
  y += intro.length * 13 + 14;

  // Frise visuelle (5 cercles reliés)
  const stripY = y + 6;
  const stripX0 = M + 12;
  const stripX1 = PAGE_W - M - 12;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(1);
  doc.line(stripX0, stripY, stripX1, stripY);
  const step = (stripX1 - stripX0) / Math.max(j.steps.length - 1, 1);
  j.steps.forEach((s, i) => {
    const x = stripX0 + i * step;
    doc.setFillColor(...ACCENT);
    doc.circle(x, stripY, 8, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(s.n, x, stripY + 3, { align: "center" });
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    const lbl = doc.splitTextToSize(s.title, step - 8);
    doc.text(lbl, x, stripY + 22, { align: "center" });
  });
  y = stripY + 50;

  // Détail des étapes (split sur 2 pages si nécessaire)
  for (const s of j.steps) {
    const blockH = 110;
    if (y + blockH > FOOTER_LIMIT) {
      doc.addPage();
      drawHeader(doc, client, type);
      y = 116;
      eyebrow(doc, "PARCOURS CLIENT BEEV (SUITE)", y);
      y += 30;
    }
    // bandeau étape
    doc.setFillColor(...INK);
    doc.rect(M, y, 28, 28, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(s.n, M + 14, y + 19, { align: "center" });

    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(s.title, M + 38, y + 12);
    if (s.duration) {
      doc.setFont(BRAND_FONT, "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...SUB);
      doc.text(s.duration, PAGE_W - M, y + 12, { align: "right" });
    }
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...SUB);
    const sum = doc.splitTextToSize(s.summary, PAGE_W - M - (M + 38));
    doc.text(sum, M + 38, y + 26);
    let yy = y + 26 + sum.length * 12 + 8;

    // 2 colonnes : Beev / Client
    const colW = (PAGE_W - M * 2 - 14) / 2;
    const colYStart = yy;
    doc.setFillColor(...BG);
    doc.rect(M, yy, colW, 56, "F");
    doc.setFillColor(...ACCENT);
    doc.rect(M, yy, 3, 56, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...SUB);
    doc.text("BEEV PREND EN CHARGE", M + 10, yy + 12);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    let by = yy + 24;
    s.beev.forEach((b) => {
      const ll = doc.splitTextToSize("· " + b, colW - 14);
      doc.text(ll, M + 10, by);
      by += ll.length * 10;
    });

    const cx = M + colW + 14;
    doc.setFillColor(...BG);
    doc.rect(cx, colYStart, colW, 56, "F");
    doc.setFillColor(...LAVENDER);
    doc.rect(cx, colYStart, 3, 56, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...SUB);
    doc.text("CÔTÉ CLIENT", cx + 10, colYStart + 12);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    let cy2 = colYStart + 24;
    s.client.forEach((b) => {
      const ll = doc.splitTextToSize("· " + b, colW - 14);
      doc.text(ll, cx + 10, cy2);
      cy2 += ll.length * 10;
    });

    y = Math.max(by, cy2) + 18;
  }
}

// ============ VALIDATION (varie par type) ============
function drawValidation(doc: jsPDF, type: ProjectType, c: ClientInfo) {
  let y = 130;
  eyebrow(doc, "PROCHAINES ÉTAPES", y);
  y += 32;
  title(doc, "Validation et lancement du projet.", y);
  y += 36;

  const stepsByType: Record<ProjectType, [string, string, string][]> = {
    vehicles: [
      ["1", "Validation de l'offre LLD", "Bon pour accord signé, sélection des véhicules définitive, choix du loueur (Ayvens, Arval, Athlon…)."],
      ["2", "Étude de financement", "Constitution du dossier crédit-bailleur, accord de la direction des risques."],
      ["3", "Bons de commande constructeurs", "Émission des BC LLD, suivi de production usine et planning de livraison."],
      ["4", "Livraison & mise en service", "Livraison des véhicules sur site, prise en main, activation des cartes carburant / badges recharge."],
    ],
    home: [
      ["1", "Validation cadre employeur", "Signature du cadre B2B2E par l'employeur : périmètre, modèle de borne, modalités de remboursement."],
      ["2", "Mandat & onboarding collaborateur", "Le collaborateur signe un mandat d'installation à son domicile et complète le formulaire technique (logement, place de parking, tableau électrique)."],
      ["3", "Visite technique & devis ferme", "Visite ou audit à distance par notre partenaire IRVE Seris, devis ferme transmis pour validation."],
      ["4", "Pose & mise en service", "Installation par technicien IRVE certifié, mise en service de la supervision, premier remboursement énergie sous 30 jours."],
    ],
    site: [
      ["1", "Validation de l'offre site", "Bon pour accord signé, sélection des modèles et nombre de points de charge par site."],
      ["2", "Étude technique site", "Visite physique de chaque site, étude des trajets de câble, dimensionnement TGBT, planning de pose."],
      ["3", "Devis ferme & génie civil", "Devis ferme par site (matériel + IRVE + génie civil), validation des accès chantier et planification des interventions."],
      ["4", "Pose, mise en service & PV de réception", "Pose par technicien IRVE certifié, paramétrage OCPP, formation utilisateurs, signature du PV de réception de chantier."],
    ],
  };

  stepsByType[type].forEach(([n, t, d]) => {
    doc.setFillColor(...ACCENT);
    doc.rect(M, y - 12, 26, 26, "F");
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(n, M + 13, y + 5, { align: "center" });
    doc.setFont(BRAND_FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(t, M + 38, y);
    doc.setFont(BRAND_FONT, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...SUB);
    const ll = doc.splitTextToSize(d, PAGE_W - M - (M + 38));
    doc.text(ll, M + 38, y + 14);
    y += 14 + ll.length * 12 + 16;
  });

  y += 6;
  doc.setDrawColor(...RULE);
  doc.line(M, y, PAGE_W - M, y);
  y += 20;
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  doc.text("CONDITIONS COMMERCIALES", M, y);
  y += 14;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  const fallback: Record<ProjectType, string> = {
    vehicles: "Offre valable 30 jours. Loyers exprimés en TTC, sous réserve de disponibilité constructeur, d'évolution de la fiscalité applicable et d'acceptation par la direction des risques du loueur. TCO indicatif, hors malus, hors aides locales.",
    home: "Offre valable 30 jours. Tarifs HT, pose 0–10 m incluse. Au-delà : devis complémentaire après visite technique. Le mandat d'installation est signé individuellement par chaque collaborateur bénéficiaire.",
    site: "Offre valable 30 jours. Tarifs HT, sous réserve de visite technique sur site. Le devis ferme par site est émis après audit IRVE. Garantie constructeur 3 ans, extensible 6 ans en option.",
  };
  const conditionsText = c.notes || PDF_CONTENT.validationConditions || fallback[type];
  const lines = doc.splitTextToSize(conditionsText, PAGE_W - M * 2);
  doc.text(lines, M, y);
  y += lines.length * 13 + 22;

  // Bon pour accord — libellé adapté au type
  const bpaTitle: Record<ProjectType, string> = {
    vehicles: "BON POUR ACCORD — OFFRE VÉHICULES LLD",
    home: "BON POUR ACCORD — DÉPLOIEMENT DOMICILE COLLABORATEURS",
    site: "BON POUR ACCORD — DÉPLOIEMENT SITE ENTREPRISE",
  };
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  doc.text(PDF_CONTENT.validationBpaTitle || bpaTitle[type], M, y);
  y += 14;
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  const bpaText: Record<ProjectType, string> = {
    vehicles: "Le client confirme la sélection des véhicules ci-avant et autorise Beev à transmettre les bons de commande LLD au loueur retenu, sous réserve de l'accord risque.",
    home: "L'employeur valide le cadre du déploiement B2B2E. Chaque installation au domicile d'un collaborateur fera l'objet d'un mandat individuel signé par le collaborateur concerné.",
    site: "Le client autorise Beev à lancer l'étude technique sur site. Le devis ferme par site sera émis après audit IRVE et signé séparément avant pose.",
  };
  const bl = doc.splitTextToSize(PDF_CONTENT.validationBpaText || bpaText[type], PAGE_W - M * 2);
  doc.text(bl, M, y);
  y += bl.length * 13 + 18;

  doc.text("Date :", M, y + 24);
  doc.text("Nom & qualité :", M, y + 44);
  doc.text("Signature & cachet :", PAGE_W / 2, y + 24);
  doc.setDrawColor(...INK);
  doc.line(M + 50, y + 24, M + 220, y + 24);
  doc.line(M + 90, y + 44, M + 280, y + 44);
  doc.rect(PAGE_W / 2 + 100, y + 10, PAGE_W - M - (PAGE_W / 2 + 100), 60);
}

// ============ HEADER / FOOTER / HELPERS ============
function drawHeader(doc: jsPDF, c: ClientInfo, type: ProjectType) {
  // Filigrane "DEVIS" en premier (sous le contenu de la page)
  drawWatermark(doc);

  doc.setTextColor(...INK);
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(11);
  doc.text("BEEV", M, 56);
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  const tag = type === "vehicles" ? "Offre véhicules LLD" : type === "home" ? "Déploiement domicile (B2B2E)" : "Déploiement site entreprise";
  doc.text(tag, M, 70);

  doc.setTextColor(...INK);
  doc.setFontSize(9);
  doc.text(c.company || "—", PAGE_W - M, 56, { align: "right" });
  doc.setTextColor(...SUB);
  doc.setFontSize(8.5);
  doc.text(c.date, PAGE_W - M, 70, { align: "right" });

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.6);
  doc.line(M, 86, PAGE_W - M, 86);
}

// Filigrane "DEVIS" en diagonale, gris très clair, sous le contenu.
// Différencie visuellement une offre commerciale d'un contrat / facture.
function drawWatermark(doc: jsPDF) {
  doc.saveGraphicsState?.();
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(120);
  doc.setTextColor(240, 238, 232); // gris cream très clair
  // Texte diagonal au centre de la page
  doc.text("DEVIS", PAGE_W / 2, PAGE_H / 2 + 40, {
    align: "center",
    angle: 35,
  });
  doc.restoreGraphicsState?.();
}

function drawFooter(doc: jsPDF, c: ClientInfo, page: number, total: number) {
  // Filet supérieur
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.6);
  doc.line(M, PAGE_H - 56, PAGE_W - M, PAGE_H - 56);

  // Ligne 1 : commercial + coordonnées Beev société
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  const repName = c.salesRep || "Commercial grand compte";
  doc.text(`BEEV · ${repName}`, M, PAGE_H - 42);

  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUB);
  const repContact = [c.salesRepEmail, c.salesRepPhone].filter(Boolean).join(" · ");
  if (repContact) doc.text(repContact, M, PAGE_H - 32);

  // Centre : mention confidentielle + tag offre
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUB);
  doc.text("Document confidentiel · usage interne client", PAGE_W / 2, PAGE_H - 42, { align: "center" });
  doc.text("beev.co · contact@beev.co", PAGE_W / 2, PAGE_H - 32, { align: "center" });

  // Droite : numérotation page
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(`Page ${page} / ${total}`, PAGE_W - M, PAGE_H - 42, { align: "right" });
  doc.setFont(BRAND_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUB);
  doc.text(c.date || "", PAGE_W - M, PAGE_H - 32, { align: "right" });
}

function eyebrow(doc: jsPDF, label: string, y: number) {
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SUB);
  doc.text(label, M, y);
  doc.setFillColor(...ACCENT);
  doc.rect(M, y + 6, 24, 2.5, "F");
}

function title(doc: jsPDF, label: string, y: number) {
  doc.setFont(BRAND_FONT, "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(label, PAGE_W - M * 2);
  doc.text(lines, M, y);
}

// Remplace les espaces spéciaux (NARROW NO-BREAK SPACE U+202F et NO-BREAK SPACE U+00A0)
// que Helvetica jsPDF ne sait pas rendre (apparaissent comme "/" dans le PDF)
const cleanSpaces = (s: string) => s.replace(/ /g, " ").replace(/ /g, " ");
const fmt = (n: number) => cleanSpaces(n.toLocaleString("fr-FR"));
const eur = (n: number) =>
  cleanSpaces(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n));
const eur2 = (n: number) =>
  cleanSpaces(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n));

function ensureSpace(doc: jsPDF, y: number, needed: number, client?: ClientInfo, type?: ProjectType): number {
  if (y + needed > FOOTER_LIMIT) {
    doc.addPage();
    if (client && type) drawHeader(doc, client, type);
    return 116;
  }
  return y;
}

type LoadedImage = { dataUrl: string; w: number; h: number; format: "JPEG" | "PNG" };

async function loadImage(url: string): Promise<LoadedImage | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    const format: "JPEG" | "PNG" = /\.png(\?|$)/i.test(url) || dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    return { dataUrl, w: dims.w, h: dims.h, format };
  } catch {
    return null;
  }
}

// Aplatit une image PNG (potentiellement transparente) sur un fond cream
// pour éviter les pixels noirs dans le PDF (jsPDF ne gère pas l'alpha PNG).
async function flattenPngToJpeg(dataUrl: string, w: number, h: number): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(dataUrl);
    // Fond cream identique au BG de la zone image
    ctx.fillStyle = "rgb(250, 248, 244)";
    ctx.fillRect(0, 0, w, h);
    const imgEl = new Image();
    imgEl.onload = () => {
      ctx.drawImage(imgEl, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    imgEl.onerror = () => resolve(dataUrl);
    imgEl.src = dataUrl;
  });
}

// Affiche une image en gardant son ratio natif, centrée dans la zone (x,y,maxW,maxH).
async function drawImageContain(doc: jsPDF, url: string, x: number, y: number, maxW: number, maxH: number) {
  const img = await loadImage(url);
  if (!img) return;
  const ratio = img.w / Math.max(img.h, 1);
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  const cx = x + (maxW - w) / 2;
  const cy = y + (maxH - h) / 2;
  let finalDataUrl = img.dataUrl;
  let finalFormat: "JPEG" | "PNG" = img.format;
  if (img.format === "PNG") {
    finalDataUrl = await flattenPngToJpeg(img.dataUrl, img.w, img.h);
    finalFormat = "JPEG";
  }
  try {
    doc.addImage(finalDataUrl, finalFormat, cx, cy, w, h, undefined, "FAST");
  } catch {
    /* image format non supporté — silencieux */
  }
}
