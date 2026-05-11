import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MANDATORY_SERVICES, type Charger, type LineItem, type Vehicle } from "./catalog";
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
  negotiatedMonthly: number;     // loyer TTC/mois après négociation
  durationMonths: number;
  kmPerYear: number;
  includeTco: boolean;           // afficher la fiche TCO pour ce véhicule
  services: string[];            // prestations additionnelles libres (commercial)
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
};

// ---- Palette B2B Beev ----
const INK = [17, 17, 17] as [number, number, number];
const SUB = [95, 95, 100] as [number, number, number];
const RULE = [220, 218, 212] as [number, number, number];
const BG = [250, 248, 244] as [number, number, number];
const ACCENT = [140, 198, 63] as [number, number, number]; // vert Beev (proche logo)
const LAVENDER = [168, 148, 214] as [number, number, number];

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 48;

// ============ TCO ============
export function computeTco(sv: SelectedVehicle, e: EnergyParams) {
  const mix = e.mixHomePct / 100;
  const v = sv.vehicle;
  const isElec = v.energy === "Électrique";
  const isPhev = v.energy === "Hybride Rechargeable";
  // énergie / 100 km
  let energy100 = 0;
  if (isElec) {
    const kWhCost = mix * e.kWhHome + (1 - mix) * e.kWhPublic;
    energy100 = v.consumption * kWhCost;
  } else if (isPhev) {
    const kWhCost = mix * e.kWhHome + (1 - mix) * e.kWhPublic;
    // approx : 60% élec / 40% essence si PHEV utilisé correctement
    const elecShare = 0.6;
    const fuelL100 = 6.5; // base hors mode élec
    energy100 = elecShare * (v.batteryKwh / Math.max(v.rangeWltp, 1)) * 100 * kWhCost
              + (1 - elecShare) * fuelL100 * e.fuelPriceL;
  } else {
    energy100 = v.consumption * e.fuelPriceL;
  }
  const lease100 = (sv.negotiatedMonthly * 12) / Math.max(sv.kmPerYear, 1) * 100;
  const tco100 = lease100 + energy100;
  // Référence essence : Peugeot 308 SW 5.7L/100
  const refFuel100 = 6.0 * e.fuelPriceL;
  const refLease100 = (500 * 12) / Math.max(sv.kmPerYear, 1) * 100;
  const refTco100 = refLease100 + refFuel100;
  const economy100 = refTco100 - tco100;
  return { energy100, lease100, tco100, refTco100, economy100 };
}

// ============ MAIN ============
export async function generateProposalPdf(opts: {
  client: ClientInfo;
  vehicles: SelectedVehicle[];
  chargers: SelectedCharger[];
  energy: EnergyParams;
}) {
  const { client, vehicles, chargers, energy } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  drawCover(doc, client, vehicles.length, chargers.length);

  // Synthèse
  doc.addPage();
  drawHeader(doc, client);
  drawSynthesis(doc, client, vehicles, chargers, energy);

  // Pourquoi Beev
  doc.addPage();
  drawHeader(doc, client);
  drawWhyBeev(doc);

  // Fiches véhicules
  for (let i = 0; i < vehicles.length; i++) {
    doc.addPage();
    drawHeader(doc, client);
    await drawVehiclePage(doc, vehicles[i], energy, i + 1, vehicles.length);
  }

  // Fiches bornes (1 page par site)
  for (let i = 0; i < chargers.length; i++) {
    doc.addPage();
    drawHeader(doc, client);
    await drawChargerPage(doc, chargers[i], i + 1, chargers.length);
  }

  // Conditions
  doc.addPage();
  drawHeader(doc, client);
  drawTerms(doc, client);

  // Pieds + numérotation
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    drawFooter(doc, client, i, pages);
  }

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "client";
  doc.save(`Beev_Offre_${safe(client.company)}_${client.date.replace(/\//g, "-")}.pdf`);
}

// ============ COVER ============
function drawCover(doc: jsPDF, c: ClientInfo, nbV: number, nbC: number) {
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Logo / nom
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BEEV", M, 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 185);
  doc.text("Mobilité électrique pour entreprises · beev.co", M, 94);

  // Filet vert
  doc.setFillColor(...ACCENT);
  doc.rect(M, 110, 60, 4, "F");

  // Eyebrow
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 185);
  doc.text(`OFFRE COMMERCIALE · ${c.date.toUpperCase()}`, M, 250);

  // Titre
  doc.setFont("helvetica", "bold");
  doc.setFontSize(38);
  doc.setTextColor(255, 255, 255);
  doc.text("Beev × " + (c.company || "Votre entreprise"), M, 295);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(15);
  doc.setTextColor(210, 210, 215);
  const sub = nbC > 0 && nbV > 0
    ? "Véhicules électriques & infrastructure de recharge."
    : nbC > 0 ? "Bornes de recharge — déploiement clé en main."
    : "Sélection de véhicules électriques pour votre flotte.";
  doc.text(sub, M, 325);

  // Bloc client
  doc.setDrawColor(80, 80, 90);
  doc.line(M, 470, PAGE_W - M, 470);
  doc.setFontSize(9);
  doc.setTextColor(170, 170, 175);
  doc.text("PRÉPARÉE POUR", M, 495);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(c.company || "—", M, 522);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(200, 200, 205);
  if (c.contact) doc.text(c.contact, M, 542);
  if (c.email) doc.text(c.email, M, 558);

  doc.setFontSize(9);
  doc.setTextColor(170, 170, 175);
  doc.text("PRÉPARÉE PAR", PAGE_W - M, 495, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(c.salesRep || "Beev", PAGE_W - M, 522, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 205);
  if (c.salesRepEmail) doc.text(c.salesRepEmail, PAGE_W - M, 540, { align: "right" });
  if (c.salesRepPhone) doc.text(c.salesRepPhone, PAGE_W - M, 555, { align: "right" });

  // Compteurs
  doc.setDrawColor(80, 80, 90);
  doc.line(M, 640, PAGE_W - M, 640);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.setTextColor(255, 255, 255);
  doc.text(String(nbV), M, 700);
  doc.text(String(nbC), PAGE_W / 2, 700);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(180, 180, 185);
  doc.text(`véhicule${nbV > 1 ? "s" : ""} étudié${nbV > 1 ? "s" : ""}`, M, 718);
  doc.text(`site${nbC > 1 ? "s" : ""} équipé${nbC > 1 ? "s" : ""} en bornes`, PAGE_W / 2, 718);

  // Pied
  doc.setFontSize(8.5);
  doc.setTextColor(150, 150, 155);
  doc.text("Document confidentiel — usage interne client", M, PAGE_H - 50);
  doc.text("beev.co", PAGE_W - M, PAGE_H - 50, { align: "right" });
}

// ============ SYNTHESE ============
function drawSynthesis(doc: jsPDF, c: ClientInfo, vs: SelectedVehicle[], cs: SelectedCharger[], _e: EnergyParams) {
  let y = 130;
  eyebrow(doc, "SYNTHÈSE", y);
  y += 18;
  title(doc, "Une vision d'ensemble de votre projet.", y);
  y += 36;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  const intro = `${c.contact || "Bonjour"},\n\nVoici la synthèse consolidée de la proposition Beev pour ${c.company || "votre entreprise"}. Chaque véhicule a été étudié avec ses prestations associées, et le volet bornes est détaillé site par site, en cohérence avec les standards de déploiement IRVE Beev.`;
  const lines = doc.splitTextToSize(intro, PAGE_W - M * 2);
  doc.text(lines, M, y);
  y += lines.length * 14 + 14;

  // Totaux véhicules
  const totalMonthly = vs.reduce((s, v) => s + v.negotiatedMonthly * v.quantity, 0);
  const totalUpfront = vs.reduce((s, v) => s + v.vehicle.priceTtc * (1 - v.discountPct / 100) * v.quantity, 0);
  const totalQtyV = vs.reduce((s, v) => s + v.quantity, 0);

  // Totaux bornes
  const totalChargersHt = cs.reduce((s, sc) => {
    const fromItems = sc.lineItems.reduce((a, li) => a + li.qty * li.unitHt, 0);
    return s + fromItems * sc.quantity;
  }, 0);
  const totalQtyC = cs.reduce((s, sc) => s + sc.quantity, 0);

  // Tableau de synthèse SANS TOTAUX (volonté commerciale : ne pas alourdir le closing)
  const body: any[] = [];
  if (vs.length) {
    body.push([{ content: "VÉHICULES", colSpan: 4, styles: { fillColor: BG, fontStyle: "bold", textColor: INK } }]);
    vs.forEach((sv) => {
      body.push([
        `${sv.vehicle.brand} ${sv.vehicle.model}\n${sv.vehicle.version}`,
        `× ${sv.quantity}`,
        `${eur(sv.negotiatedMonthly)} TTC / mois`,
        `${sv.durationMonths} mois · ${sv.kmPerYear.toLocaleString("fr-FR")} km/an`,
      ]);
    });
  }
  if (cs.length) {
    body.push([{ content: "BORNES & INSTALLATION", colSpan: 4, styles: { fillColor: BG, fontStyle: "bold", textColor: INK } }]);
    cs.forEach((sc) => {
      const tag = sc.charger.deployment === "domicile" ? "Domicile collaborateur" : "Site entreprise";
      body.push([
        `${sc.siteName || sc.charger.brand + " " + sc.charger.model}\n${sc.charger.brand} ${sc.charger.model}`,
        `× ${sc.quantity}`,
        `${sc.charger.powerKw} kW`,
        tag,
      ]);
    });
  }

  if (body.length) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["Désignation", "Qté", "Détail", "Modalités"]],
      body: body as any,
      headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9.5, cellPadding: 7, textColor: INK, lineColor: RULE },
      columnStyles: { 1: { halign: "center", cellWidth: 40 }, 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: M, right: M },
    });
  }
}

// ============ POURQUOI BEEV ============
function drawWhyBeev(doc: jsPDF) {
  let y = 130;
  eyebrow(doc, "NOTRE APPROCHE", y);
  y += 18;
  title(doc, "Pourquoi centraliser chez Beev.", y);
  y += 36;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  const p1 = "Quand on équipe une flotte ou plusieurs sites en simultané, le choix des partenaires n'est pas anodin. Beev centralise pour vous le sourcing véhicule (Tesla, Mercedes, Renault, VW, Hyundai, Kia, Peugeot…), le financement LLD (Ayvens, Arval, Athlon, Leaseplan), et le déploiement IRVE de bornes premium (Alfen, Wallbox, Schneider, Hager).";
  const l1 = doc.splitTextToSize(p1, PAGE_W - M * 2);
  doc.text(l1, M, y);
  y += l1.length * 14 + 16;

  const p2 = "Concrètement, ce qui change pour vous :";
  doc.setFont("helvetica", "bold");
  doc.text(p2, M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  const bullets = [
    "Un interlocuteur unique pour les véhicules ET les bornes — un seul point de contact, une seule contractualisation.",
    "Des tarifs négociés grand compte sur l'intégralité du panel constructeur, et un accès direct aux loueurs longue durée.",
    "Une étude TCO (loyer + énergie + AEN) systématique, comparée à une référence thermique de votre flotte actuelle.",
    "Un déploiement bornes IRVE clé en main : étude de site, pose, mise en service, supervision OCPP, formation utilisateurs.",
    "Un suivi commercial dédié grand compte, et une absence totale de friction entre le volet véhicules et le volet infrastructure.",
  ];
  bullets.forEach((b) => {
    doc.setFillColor(...ACCENT);
    doc.circle(M + 4, y - 3, 2, "F");
    const t = doc.splitTextToSize(b, PAGE_W - M * 2 - 16);
    doc.setTextColor(...INK);
    doc.text(t, M + 14, y);
    y += t.length * 14 + 6;
  });

  y += 10;
  doc.setFillColor(...BG);
  doc.rect(M, y, PAGE_W - M * 2, 90, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(M, y, 4, 90, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  doc.text("CE QUE JE VOUS GARANTIS", M + 16, y + 22);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  const q = doc.splitTextToSize("Une cohérence totale entre les véhicules livrés et les bornes installées : autonomie, profil d'usage, fiscalité, recharge à domicile, supervision flotte. Vous ne gérez ni les écarts entre fournisseurs, ni les surprises de calendrier.", PAGE_W - M * 2 - 32);
  doc.text(q, M + 16, y + 42);
}

// ============ FICHE VÉHICULE ============
async function drawVehiclePage(doc: jsPDF, sv: SelectedVehicle, e: EnergyParams, idx: number, total: number) {
  const v = sv.vehicle;
  eyebrow(doc, `VÉHICULE ${idx} / ${total}`, 116);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(`${v.brand} ${v.model}`, M, 148);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...SUB);
  doc.text(`${v.version} · ${v.category} · ${v.energy}`, M, 166);

  // Image
  const imgY = 182;
  const imgW = (PAGE_W - M * 2) * 0.55;
  const imgH = 170;
  doc.setFillColor(...BG);
  doc.rect(M, imgY, imgW, imgH, "F");
  try {
    const data = await loadImage(v.image);
    if (data) doc.addImage(data, "JPEG", M + 6, imgY + 6, imgW - 12, imgH - 12, undefined, "FAST");
  } catch { /* */ }

  // Bloc tarif
  const px = M + imgW + 14;
  const pw = PAGE_W - M - px;
  doc.setFillColor(...INK);
  doc.rect(px, imgY, pw, 26, "F");
  doc.setFont("helvetica", "bold");
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
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(eur(sv.negotiatedMonthly), px + 12, py + 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(`× ${sv.quantity} véhicule${sv.quantity > 1 ? "s" : ""} · ${sv.kmPerYear.toLocaleString("fr-FR")} km/an`, px + 12, py + 38);

  let y = imgY + imgH + 24;

  // Caractéristiques
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
      ["Score environnemental ADEME", v.envScore ? String(v.envScore) : "—"],
    ],
    headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9.5, cellPadding: 6, textColor: INK, lineColor: RULE },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // TCO
  const t = computeTco(sv, e);
  doc.setFillColor(...BG);
  doc.rect(M, y, PAGE_W - M * 2, 78, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(M, y, 4, 78, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  doc.text("TCO AUX 100 KM (NON CONTRACTUEL)", M + 16, y + 18);
  const blocks = [
    { l: "Loyer / 100 km", v: eur2(t.lease100) },
    { l: "Énergie / 100 km", v: eur2(t.energy100) },
    { l: "TCO / 100 km", v: eur2(t.tco100), bold: true },
    { l: "Économie vs essence ref.", v: t.economy100 >= 0 ? `+ ${eur2(t.economy100)}` : `- ${eur2(-t.economy100)}` },
  ];
  const cw = (PAGE_W - M * 2 - 20) / blocks.length;
  blocks.forEach((b, i) => {
    const x = M + 16 + i * cw;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUB);
    doc.text(b.l.toUpperCase(), x, y + 38);
    doc.setFont("helvetica", b.bold ? "bold" : "normal");
    doc.setFontSize(b.bold ? 16 : 13);
    doc.setTextColor(...INK);
    doc.text(b.v, x, y + 60);
  });
  y += 90;

  // Prestations & options (tableau type Ayvens)
  if (y > PAGE_H - 160) return;
  const optionRows: any[] = sv.options.map((li) => [
    li.label,
    String(li.qty),
    eur(li.unitHt),
    eur(li.qty * li.unitHt),
  ]);
  const servicesText = sv.services.length
    ? sv.services.map((s) => `· ${s}`).join("\n")
    : "Loyer financier · Maintenance tous réseaux · Assistance 24/24";
  const body: any[] = [
    [{ content: "Prestations & services compris dans le loyer", colSpan: 4, styles: { fillColor: BG, fontStyle: "bold", textColor: INK } }],
    [{ content: servicesText, colSpan: 4, styles: { fontSize: 9.5, textColor: INK } }],
  ];
  if (optionRows.length) {
    body.push([{ content: "Options & accessoires compris dans le loyer", colSpan: 4, styles: { fillColor: BG, fontStyle: "bold", textColor: INK } }]);
    body.push(...optionRows);
    const totalOpts = sv.options.reduce((a, li) => a + li.qty * li.unitHt, 0);
    body.push([
      { content: "Total options HT", colSpan: 3, styles: { fontStyle: "bold", halign: "right" } },
      { content: eur(totalOpts), styles: { fontStyle: "bold", halign: "right" } },
    ]);
  }
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Désignation", "Qté", "PU HT", "Total HT"]],
    body: body as any,
    headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, cellPadding: 6, textColor: INK, lineColor: RULE },
    columnStyles: { 1: { halign: "center", cellWidth: 40 }, 2: { halign: "right", cellWidth: 70 }, 3: { halign: "right", cellWidth: 80, fontStyle: "bold" } },
    margin: { left: M, right: M },
  });
}

// ============ FICHE BORNE / SITE ============
async function drawChargerPage(doc: jsPDF, sc: SelectedCharger, idx: number, total: number) {
  eyebrow(doc, `BORNE ${idx} / ${total}`, 116);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(sc.siteName || `${sc.charger.brand} ${sc.charger.model}`, M, 148);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...SUB);
  doc.text(`${sc.charger.brand} ${sc.charger.model} · ${sc.charger.powerKw} kW · ${sc.charger.type}`, M, 166);
  if (sc.siteAddress) {
    doc.setFontSize(10);
    doc.text(sc.siteAddress, M, 182);
  }

  // Image + features
  const imgY = 200;
  const imgW = 200;
  const imgH = 150;
  doc.setFillColor(...BG);
  doc.rect(M, imgY, imgW, imgH, "F");
  try {
    const data = await loadImage(sc.charger.image);
    if (data) doc.addImage(data, "JPEG", M + 6, imgY + 6, imgW - 12, imgH - 12, undefined, "FAST");
  } catch { /* */ }

  const fx = M + imgW + 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  doc.text("CARACTÉRISTIQUES MATÉRIEL", fx, imgY + 14);
  doc.setFont("helvetica", "normal");
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
    doc.text(`Contact site : ${sc.siteContact}`, fx, fy);
  }

  let y = imgY + imgH + 24;

  // Devis détaillé site
  const total_ = sc.lineItems.reduce((a, li) => a + li.qty * li.unitHt, 0);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Désignation", "Qté", "PU HT", "Total HT"]],
    body: ([
      ...sc.lineItems.map((li) => [li.label, String(li.qty), eur(li.unitHt), eur(li.qty * li.unitHt)]),
      [
        { content: "Total HT site", colSpan: 3, styles: { fontStyle: "bold", halign: "right", fillColor: BG } },
        { content: eur(total_), styles: { fontStyle: "bold", halign: "right", fillColor: BG } },
      ],
      ...(sc.quantity > 1 ? [[
        { content: `Total HT × ${sc.quantity}`, colSpan: 3, styles: { fontStyle: "bold", halign: "right", textColor: ACCENT } },
        { content: eur(total_ * sc.quantity), styles: { fontStyle: "bold", halign: "right", textColor: ACCENT } },
      ]] : []),
    ] as any),
    headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, cellPadding: 6, textColor: INK, lineColor: RULE },
    columnStyles: { 1: { halign: "center", cellWidth: 40 }, 2: { halign: "right", cellWidth: 80 }, 3: { halign: "right", cellWidth: 90, fontStyle: "bold" } },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  if (y > PAGE_H - 110) return;
  doc.setFillColor(...BG);
  doc.rect(M, y, PAGE_W - M * 2, 60, "F");
  doc.setFillColor(...LAVENDER);
  doc.rect(M, y, 4, 60, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SUB);
  doc.text("INCLUS DANS LA PRESTATION IRVE", M + 16, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize("Étude de site · pose & raccordement par technicien IRVE certifié · paramétrage OCPP & superviseur · formation utilisateurs · gestion des déchets de chantier · garantie constructeur 3 ans (extensible 6 ans).", PAGE_W - M * 2 - 32);
  doc.text(lines, M + 16, y + 36);
}

// ============ TERMS ============
function drawTerms(doc: jsPDF, c: ClientInfo) {
  let y = 130;
  eyebrow(doc, "PROCHAINES ÉTAPES", y);
  y += 18;
  title(doc, "Comment on lance le projet.", y);
  y += 36;

  const steps = [
    ["1", "Validation de l'offre", "Signature électronique ou bon pour accord scanné, retour à votre interlocuteur Beev."],
    ["2", "Bons de commande véhicules", "Émission des BC LLD au loueur retenu (Ayvens, Arval, Athlon…), suivi de production."],
    ["3", "Étude technique sites", "Visite de chaque site par nos équipes IRVE, validation des trajets de câble et planning de pose."],
    ["4", "Livraison & mise en service", "Livraison des véhicules, pose des bornes, formation utilisateurs, supervision activée."],
  ];
  steps.forEach(([n, t, d]) => {
    doc.setFillColor(...ACCENT);
    doc.rect(M, y - 12, 26, 26, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(n, M + 13, y + 5, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(t, M + 38, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...SUB);
    const ll = doc.splitTextToSize(d, PAGE_W - M - (M + 38));
    doc.text(ll, M + 38, y + 14);
    y += 14 + ll.length * 12 + 16;
  });

  y += 6;
  doc.setDrawColor(...RULE);
  doc.line(M, y, PAGE_W - M, y);
  y += 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  doc.text("CONDITIONS COMMERCIALES", M, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(c.notes || "Offre valable 30 jours à compter de la date d'émission. Tarifs HT et TTC sous réserve de disponibilité constructeur, d'évolution de la fiscalité applicable et d'acceptation par la direction des risques du loueur. TCO indicatif, calculé hors malus, hors aides locales.", PAGE_W - M * 2);
  doc.text(lines, M, y);
  y += lines.length * 14 + 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  doc.text("BON POUR ACCORD", M, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text("Date :", M, y + 30);
  doc.text("Nom & qualité :", M, y + 50);
  doc.text("Signature & cachet :", PAGE_W / 2, y + 30);
  doc.setDrawColor(...INK);
  doc.line(M + 50, y + 30, M + 220, y + 30);
  doc.line(M + 90, y + 50, M + 280, y + 50);
  doc.rect(PAGE_W / 2 + 100, y + 16, PAGE_W - M - (PAGE_W / 2 + 100), 60);
}

// ============ HEADER / FOOTER / HELPERS ============
function drawHeader(doc: jsPDF, c: ClientInfo) {
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BEEV", M, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text("Offre commerciale", M, 70);

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

function drawFooter(doc: jsPDF, c: ClientInfo, page: number, total: number) {
  doc.setDrawColor(...RULE);
  doc.line(M, PAGE_H - 50, PAGE_W - M, PAGE_H - 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SUB);
  doc.text(`Beev · ${c.salesRep || "Commercial grand compte"}${c.salesRepEmail ? " · " + c.salesRepEmail : ""}`, M, PAGE_H - 36);
  doc.text("Document confidentiel", PAGE_W / 2, PAGE_H - 36, { align: "center" });
  doc.text(`${page} / ${total}`, PAGE_W - M, PAGE_H - 36, { align: "right" });
}

function eyebrow(doc: jsPDF, label: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SUB);
  doc.text(label, M, y);
  doc.setFillColor(...ACCENT);
  doc.rect(M, y + 6, 24, 2.5, "F");
}

function title(doc: jsPDF, label: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(label, M, y);
}

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const eur2 = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);

async function loadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
