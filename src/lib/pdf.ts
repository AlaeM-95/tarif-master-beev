import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Charger, Vehicle } from "./catalog";

export type ClientInfo = {
  company: string;
  contact: string;
  email: string;
  date: string;
  salesRep: string;
  notes: string;
};

export type SelectedVehicle = {
  vehicle: Vehicle;
  quantity: number;
  discountPct: number;
  negotiatedMonthly: number;
  durationMonths: number;
  kmPerYear: number;
  services: string[];
};

export type SelectedCharger = {
  charger: Charger;
  quantity: number;
  discountPct: number;
  installIncluded: boolean;
};

// Palette B2B sobre — noir Beev + accent lavande discret
const INK = { r: 17, g: 17, b: 17 };
const SUB = { r: 95, g: 95, b: 100 };
const RULE = { r: 220, g: 218, b: 212 };
const BG = { r: 250, g: 248, b: 244 };
const ACCENT = { r: 168, g: 148, b: 214 }; // lavande Beev

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 48; // marge pro

export async function generateProposalPdf(opts: {
  client: ClientInfo;
  vehicles: SelectedVehicle[];
  chargers: SelectedCharger[];
}) {
  const { client, vehicles, chargers } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // ============== PAGE DE GARDE ==============
  drawCover(doc, client, vehicles.length, chargers.length);

  // ============== SOMMAIRE / SYNTHÈSE ==============
  doc.addPage();
  drawHeader(doc, client);
  let y = 130;

  sectionTitle(doc, "Synthèse de la proposition", y);
  y += 28;

  const totalMonthly = vehicles.reduce((s, v) => s + v.negotiatedMonthly * v.quantity, 0);
  const totalUpfront = vehicles.reduce(
    (s, v) => s + v.vehicle.priceTtc * (1 - v.discountPct / 100) * v.quantity,
    0,
  );
  const totalChargers = chargers.reduce((s, c) => {
    const u = c.charger.priceHt * (1 - c.discountPct / 100);
    return s + (u + (c.installIncluded ? c.charger.installPriceHt : 0)) * c.quantity;
  }, 0);

  autoTable(doc, {
    startY: y,
    theme: "plain",
    head: [["", "Quantité", "Détail", "Montant"]],
    body: [
      ["Véhicules — achat TTC", String(vehicles.reduce((s, v) => s + v.quantity, 0)), `${vehicles.length} référence${vehicles.length > 1 ? "s" : ""}`, eur(totalUpfront)],
      ["Véhicules — LLD HT / mois", String(vehicles.reduce((s, v) => s + v.quantity, 0)), "Loyer mensuel global", `${eur(totalMonthly)} / mois`],
      ["Bornes + installation HT", String(chargers.reduce((s, c) => s + c.quantity, 0)), `${chargers.length} référence${chargers.length > 1 ? "s" : ""}`, eur(totalChargers)],
    ],
    headStyles: { fillColor: [INK.r, INK.g, INK.b], textColor: 255, fontStyle: "bold", fontSize: 9, halign: "left" },
    bodyStyles: { fontSize: 10, cellPadding: 10, textColor: [INK.r, INK.g, INK.b] },
    alternateRowStyles: { fillColor: [BG.r, BG.g, BG.b] },
    columnStyles: { 1: { halign: "center" }, 3: { halign: "right", fontStyle: "bold" } },
    margin: { left: M, right: M },
  });

  y = (doc as any).lastAutoTable.finalY + 28;

  sectionTitle(doc, "Informations client", y);
  y += 24;

  const infoRows: [string, string][] = [
    ["Société", client.company || "—"],
    ["Interlocuteur", client.contact || "—"],
    ["Email", client.email || "—"],
    ["Commercial Beev", client.salesRep || "—"],
    ["Date d'émission", client.date],
  ];
  doc.setFontSize(10);
  infoRows.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(SUB.r, SUB.g, SUB.b);
    doc.text(k.toUpperCase(), M, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(v, M + 140, y);
    y += 18;
  });

  // ============== FICHES VÉHICULES (1 par page) ==============
  for (let i = 0; i < vehicles.length; i++) {
    doc.addPage();
    drawHeader(doc, client);
    await drawVehiclePage(doc, vehicles[i], i + 1, vehicles.length);
  }

  // ============== FICHES BORNES ==============
  if (chargers.length) {
    doc.addPage();
    drawHeader(doc, client);
    let cy = 130;
    sectionTitle(doc, "Bornes de recharge", cy);
    cy += 28;
    for (const sc of chargers) {
      if (cy > PAGE_H - 200) {
        doc.addPage();
        drawHeader(doc, client);
        cy = 130;
      }
      cy = await drawChargerCard(doc, sc, cy);
      cy += 18;
    }
  }

  // ============== CONDITIONS ==============
  doc.addPage();
  drawHeader(doc, client);
  let ny = 130;
  sectionTitle(doc, "Conditions commerciales", ny);
  ny += 28;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(INK.r, INK.g, INK.b);
  const notes =
    client.notes ||
    "Offre valable 30 jours. Tarifs indicatifs sous réserve de disponibilité constructeur et d'étude de financement.";
  const lines = doc.splitTextToSize(notes, PAGE_W - M * 2);
  doc.text(lines, M, ny);
  ny += lines.length * 14 + 24;

  doc.setDrawColor(RULE.r, RULE.g, RULE.b);
  doc.line(M, ny, PAGE_W - M, ny);
  ny += 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.text("BON POUR ACCORD", M, ny);
  ny += 16;
  doc.setFont("helvetica", "normal");
  doc.text("Date :", M, ny + 26);
  doc.text("Signature & cachet :", PAGE_W / 2, ny + 26);
  doc.setDrawColor(INK.r, INK.g, INK.b);
  doc.line(M + 40, ny + 26, M + 200, ny + 26);
  doc.line(PAGE_W / 2 + 110, ny + 26, PAGE_W - M, ny + 26);

  // Pieds de page sur toutes les pages sauf la garde
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    drawFooter(doc, client, i, pages);
  }

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "client";
  doc.save(`Beev_Proposition_${safe(client.company)}_${client.date.replace(/\//g, "-")}.pdf`);
}

// =================== HELPERS ===================

function drawCover(doc: jsPDF, client: ClientInfo, nbV: number, nbC: number) {
  // Bandeau noir plein
  doc.setFillColor(INK.r, INK.g, INK.b);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Filet lavande
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(M, 110, 60, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BEEV", M, 90);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 185);
  doc.text("Mobilité électrique pour entreprises", M, 104);

  // Titre
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text("Proposition", M, 250);
  doc.text("commerciale", M, 290);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(200, 200, 205);
  doc.text("Véhicules électriques & infrastructure de recharge", M, 320);

  // Bloc client
  doc.setDrawColor(80, 80, 90);
  doc.line(M, 420, PAGE_W - M, 420);

  doc.setFontSize(9);
  doc.setTextColor(170, 170, 175);
  doc.text("PRÉPARÉ POUR", M, 450);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(client.company || "—", M, 478);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(200, 200, 205);
  if (client.contact) doc.text(client.contact, M, 498);
  if (client.email) doc.text(client.email, M, 514);

  // Méta droite
  doc.setFontSize(9);
  doc.setTextColor(170, 170, 175);
  doc.text("DATE", PAGE_W - M, 450, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(client.date, PAGE_W - M, 466, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(170, 170, 175);
  doc.text("COMMERCIAL", PAGE_W - M, 488, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(client.salesRep || "Beev", PAGE_W - M, 504, { align: "right" });

  // Compteurs
  doc.setDrawColor(80, 80, 90);
  doc.line(M, 600, PAGE_W - M, 600);
  doc.setFontSize(40);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(String(nbV), M, 660);
  doc.text(String(nbC), PAGE_W / 2, 660);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(180, 180, 185);
  doc.text(`véhicule${nbV > 1 ? "s" : ""} sélectionné${nbV > 1 ? "s" : ""}`, M, 678);
  doc.text(`borne${nbC > 1 ? "s" : ""} de recharge`, PAGE_W / 2, 678);

  // Pied
  doc.setFontSize(8.5);
  doc.setTextColor(150, 150, 155);
  doc.text("Document confidentiel — usage interne client", M, PAGE_H - 50);
  doc.text("beev.co", PAGE_W - M, PAGE_H - 50, { align: "right" });
}

function drawHeader(doc: jsPDF, client: ClientInfo) {
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BEEV", M, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.text("Proposition commerciale", M, 70);

  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFontSize(9);
  doc.text(client.company || "—", PAGE_W - M, 56, { align: "right" });
  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.setFontSize(8.5);
  doc.text(client.date, PAGE_W - M, 70, { align: "right" });

  doc.setDrawColor(RULE.r, RULE.g, RULE.b);
  doc.setLineWidth(0.6);
  doc.line(M, 86, PAGE_W - M, 86);
}

function drawFooter(doc: jsPDF, client: ClientInfo, page: number, total: number) {
  doc.setDrawColor(RULE.r, RULE.g, RULE.b);
  doc.line(M, PAGE_H - 50, PAGE_W - M, PAGE_H - 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.text(`Beev · ${client.salesRep || "Service grand compte"}`, M, PAGE_H - 36);
  doc.text("Document confidentiel", PAGE_W / 2, PAGE_H - 36, { align: "center" });
  doc.text(`${page} / ${total}`, PAGE_W - M, PAGE_H - 36, { align: "right" });
}

function sectionTitle(doc: jsPDF, label: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(label, M, y);
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(M, y + 6, 32, 2.5, "F");
}

async function drawVehiclePage(doc: jsPDF, sv: SelectedVehicle, idx: number, total: number) {
  const v = sv.vehicle;

  // Numérotation
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.text(`Véhicule ${idx} / ${total}`, M, 116);

  // Titre véhicule
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(`${v.brand} ${v.model}`, M, 148);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.text(`${v.version} · ${v.category}`, M, 168);

  // Image (pleine largeur)
  const imgY = 190;
  const imgW = PAGE_W - M * 2;
  const imgH = 230;
  doc.setFillColor(BG.r, BG.g, BG.b);
  doc.rect(M, imgY, imgW, imgH, "F");
  try {
    const dataUrl = await loadImage(v.image);
    if (dataUrl) {
      // contain dans le cadre
      doc.addImage(dataUrl, "JPEG", M + 8, imgY + 8, imgW - 16, imgH - 16, undefined, "FAST");
    }
  } catch {
    /* image facultative */
  }

  let y = imgY + imgH + 32;

  // Caractéristiques en table propre
  autoTable(doc, {
    startY: y,
    theme: "plain",
    head: [["Caractéristique", "Valeur"]],
    body: [
      ["Autonomie WLTP", `${v.rangeWltp} km`],
      ["Capacité batterie", `${v.batteryKwh} kWh`],
      ["Puissance", `${v.powerHp} ch`],
      ["Consommation moyenne", `${v.consumption} kWh / 100 km`],
      ["Catégorie", v.category],
    ],
    headStyles: { fillColor: [INK.r, INK.g, INK.b], textColor: 255, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 10, cellPadding: 8, textColor: [INK.r, INK.g, INK.b] },
    alternateRowStyles: { fillColor: [BG.r, BG.g, BG.b] },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: M, right: PAGE_W / 2 + 8 },
    tableWidth: PAGE_W / 2 - M - 8,
  });

  // Bloc tarif à droite
  const px = PAGE_W / 2 + 8;
  const pw = PAGE_W - M - px;
  const py = y;
  doc.setFillColor(INK.r, INK.g, INK.b);
  doc.rect(px, py, pw, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("TARIF NÉGOCIÉ", px + 12, py + 18);

  const discounted = v.priceTtc * (1 - sv.discountPct / 100);
  let py2 = py + 28;
  doc.setFillColor(BG.r, BG.g, BG.b);
  doc.rect(px, py2, pw, 180, "F");

  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("PRIX CATALOGUE TTC", px + 12, py2 + 20);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(eur(v.priceTtc), px + 12, py2 + 36);

  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.setFontSize(8.5);
  doc.text("REMISE COMMERCIALE", px + 12, py2 + 56);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFontSize(11);
  doc.text(`-${sv.discountPct.toFixed(1)} %`, px + 12, py2 + 72);

  // Filet accent
  doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.setLineWidth(2);
  doc.line(px + 12, py2 + 86, px + 60, py2 + 86);
  doc.setLineWidth(0.5);

  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("PRIX CLIENT TTC", px + 12, py2 + 104);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(eur(discounted), px + 12, py2 + 124);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.text(
    `LLD ${sv.durationMonths} mois · ${sv.kmPerYear.toLocaleString("fr-FR")} km/an`,
    px + 12,
    py2 + 146,
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(`${eur(sv.negotiatedMonthly)} HT / mois`, px + 12, py2 + 164);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.text(`Quantité : ${sv.quantity}`, px + 12, py2 + 178);

  y = Math.max((doc as any).lastAutoTable.finalY, py2 + 180) + 24;

  // Prestations
  if (sv.services.length) {
    if (y > PAGE_H - 130) return;
    sectionTitle(doc, "Prestations incluses", y);
    y += 22;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK.r, INK.g, INK.b);
    const colW = (PAGE_W - M * 2) / 2;
    sv.services.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const xx = M + col * colW;
      const yy = y + row * 18;
      if (yy > PAGE_H - 80) return;
      doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.circle(xx + 4, yy - 3, 2, "F");
      doc.text(s, xx + 14, yy);
    });
  }
}

async function drawChargerCard(doc: jsPDF, sc: SelectedCharger, y: number): Promise<number> {
  const c = sc.charger;
  const cardH = 130;
  const cardW = PAGE_W - M * 2;

  doc.setDrawColor(RULE.r, RULE.g, RULE.b);
  doc.setLineWidth(0.6);
  doc.rect(M, y, cardW, cardH);

  // Image gauche
  const imgW = 150;
  doc.setFillColor(BG.r, BG.g, BG.b);
  doc.rect(M, y, imgW, cardH, "F");
  try {
    const data = await loadImage(c.image);
    if (data) doc.addImage(data, "JPEG", M + 8, y + 8, imgW - 16, cardH - 16, undefined, "FAST");
  } catch { /* */ }

  // Texte
  const tx = M + imgW + 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(`${c.brand} ${c.model}`, tx, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.text(`${c.powerKw} kW · ${c.type}`, tx, y + 40);

  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFontSize(9);
  c.features.slice(0, 3).forEach((f, i) => {
    doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.circle(tx + 3, y + 60 + i * 14 - 3, 1.8, "F");
    doc.text(f, tx + 12, y + 60 + i * 14);
  });

  // Bloc prix droite
  const unit = c.priceHt * (1 - sc.discountPct / 100);
  const install = sc.installIncluded ? c.installPriceHt : 0;
  const px = PAGE_W - M - 165;
  doc.setFillColor(BG.r, BG.g, BG.b);
  doc.rect(px, y + 12, 155, cardH - 24, "F");
  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.setFontSize(8);
  doc.text("BORNE HT", px + 10, y + 28);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(eur(unit), px + 10, y + 44);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.setFontSize(8);
  doc.text("INSTALLATION HT", px + 10, y + 62);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(install ? eur(install) : "Non incluse", px + 10, y + 78);

  doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.setLineWidth(1.5);
  doc.line(px + 10, y + 88, px + 40, y + 88);
  doc.setLineWidth(0.5);

  doc.setTextColor(SUB.r, SUB.g, SUB.b);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`TOTAL × ${sc.quantity}`, px + 10, y + 104);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(eur((unit + install) * sc.quantity), px + 10, y + 120);

  return y + cardH;
}

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

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
