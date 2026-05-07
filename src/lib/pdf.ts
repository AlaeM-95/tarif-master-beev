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

const BRAND = { r: 15, g: 15, b: 15 }; // Beev black
const LAVENDER = { r: 209, g: 196, b: 233 };

export async function generateProposalPdf(opts: {
  client: ClientInfo;
  vehicles: SelectedVehicle[];
  chargers: SelectedCharger[];
}) {
  const { client, vehicles, chargers } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header band
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, pw, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("BEEV", margin, 45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Proposition commerciale — Mobilité électrique", margin, 65);
  doc.setFontSize(10);
  doc.text(client.date, pw - margin, 45, { align: "right" });

  let y = 120;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Informations client", margin, y);
  y += 8;
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(1.5);
  doc.line(margin, y, margin + 80, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const infoRows: [string, string][] = [
    ["Société", client.company || "—"],
    ["Contact", client.contact || "—"],
    ["Email", client.email || "—"],
    ["Commercial Beev", client.salesRep || "—"],
  ];
  infoRows.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.text(k, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(v, margin + 110, y);
    y += 16;
  });

  y += 10;

  // Vehicles
  if (vehicles.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Véhicules sélectionnés", margin, y);
    y += 8;
    doc.line(margin, y, margin + 100, y);
    y += 16;

    for (const sv of vehicles) {
      const v = sv.vehicle;
      const cardH = 130 + (sv.services.length ? 14 + Math.ceil(sv.services.length / 2) * 12 : 0);
      if (y + cardH > 760) { doc.addPage(); y = margin; }
      doc.setFillColor(248, 246, 240); // cream
      doc.roundedRect(margin, y, pw - margin * 2, cardH, 10, 10, "F");

      // Image
      const imgX = margin + 12;
      const imgY = y + 12;
      const imgW = 130;
      const imgH = 90;
      try {
        const dataUrl = await loadImage(v.image);
        if (dataUrl) doc.addImage(dataUrl, "JPEG", imgX, imgY, imgW, imgH, undefined, "FAST");
      } catch { /* skip image on error */ }

      const tx = imgX + imgW + 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.text(`${v.brand} ${v.model}`, tx, y + 28);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(90, 90, 90);
      doc.text(v.version, tx, y + 42);

      doc.setTextColor(40, 40, 40);
      doc.setFontSize(9.5);
      const specs = [
        `Autonomie WLTP : ${v.rangeWltp} km`,
        `Batterie : ${v.batteryKwh} kWh`,
        `Puissance : ${v.powerHp} ch`,
        `Conso : ${v.consumption} kWh/100km`,
      ];
      specs.forEach((s, i) => doc.text(s, tx, y + 60 + i * 12));

      // Price block
      const px = pw - margin - 175;
      doc.setFillColor(LAVENDER.r, LAVENDER.g, LAVENDER.b);
      doc.roundedRect(px - 8, y + 12, 165, 100, 8, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text("Tarif négocié", px, y + 28);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const discounted = v.priceTtc * (1 - sv.discountPct / 100);
      doc.text(`Catalogue : ${eur(v.priceTtc)} TTC`, px, y + 44);
      doc.text(`Remise : ${sv.discountPct.toFixed(1)} %`, px, y + 56);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`Prix client : ${eur(discounted)}`, px, y + 70);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(`LLD ${sv.durationMonths} mois / ${sv.kmPerYear.toLocaleString("fr-FR")} km`, px, y + 84);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${eur(sv.negotiatedMonthly)} HT/mois`, px, y + 100);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(90, 90, 90);
      doc.setFontSize(8.5);
      doc.text(`Quantité : ${sv.quantity}`, tx, y + 114);

      // Services
      if (sv.services.length) {
        const sy = y + 130;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(20, 20, 20);
        doc.text("Prestations incluses :", margin + 12, sy);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(60, 60, 60);
        sv.services.forEach((s, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          doc.text(`• ${s}`, margin + 12 + col * 250, sy + 14 + row * 12);
        });
      }
      y += cardH + 10;
    }
  }

  // Chargers
  if (chargers.length) {
    if (y > 650) { doc.addPage(); y = margin; }
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text("Bornes de recharge", margin, y);
    y += 8;
    doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
    doc.line(margin, y, margin + 90, y);
    y += 16;

    chargers.forEach((sc) => {
      const c = sc.charger;
      if (y > 720) { doc.addPage(); y = margin; }
      doc.setFillColor(245, 250, 248);
      doc.roundedRect(margin, y, pw - margin * 2, 90, 6, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.text(`${c.brand} ${c.model}`, margin + 14, y + 22);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`${c.powerKw} kW · ${c.type}`, margin + 14, y + 38);
      doc.setTextColor(40, 40, 40);
      doc.text(c.features.join(" · "), margin + 14, y + 54, { maxWidth: pw - margin * 2 - 220 });
      doc.text(`Quantité : ${sc.quantity}`, margin + 14, y + 76);

      const px = pw - margin - 180;
      const unit = c.priceHt * (1 - sc.discountPct / 100);
      const install = sc.installIncluded ? c.installPriceHt : 0;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
      doc.text("Tarif négocié", px, y + 22);
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Borne : ${eur(unit)} HT`, px, y + 40);
      doc.text(`Installation : ${install ? eur(install) + " HT" : "non incluse"}`, px, y + 54);
      doc.setFont("helvetica", "bold");
      doc.text(`Total unitaire : ${eur(unit + install)} HT`, px, y + 70);
      y += 100;
    });
  }

  // Récap
  if (y > 650) { doc.addPage(); y = margin; }
  y += 10;
  const totalVehMonthly = vehicles.reduce((s, v) => s + v.negotiatedMonthly * v.quantity, 0);
  const totalVehUpfront = vehicles.reduce(
    (s, v) => s + v.vehicle.priceTtc * (1 - v.discountPct / 100) * v.quantity,
    0
  );
  const totalChargers = chargers.reduce((s, c) => {
    const unit = c.charger.priceHt * (1 - c.discountPct / 100);
    return s + (unit + (c.installIncluded ? c.charger.installPriceHt : 0)) * c.quantity;
  }, 0);

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Récapitulatif", "Montant"]],
    body: [
      ["Total véhicules (achat TTC)", eur(totalVehUpfront)],
      ["Total véhicules (LLD / mois)", `${eur(totalVehMonthly)} HT / mois`],
      ["Total bornes + installation (HT)", eur(totalChargers)],
    ],
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255 },
    styles: { fontSize: 11, cellPadding: 8 },
    margin: { left: margin, right: margin },
  });

  // Notes
  if (client.notes) {
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    let ny = finalY + 24;
    if (ny > 720) { doc.addPage(); ny = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Notes & conditions", margin, ny);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(client.notes, pw - margin * 2);
    doc.text(lines, margin, ny + 18);
  }

  // Footer pages
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Beev · Proposition générée le ${client.date} · ${client.salesRep || ""}`,
      margin,
      doc.internal.pageSize.getHeight() - 18
    );
    doc.text(`${i} / ${pages}`, pw - margin, doc.internal.pageSize.getHeight() - 18, { align: "right" });
  }

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "client";
  doc.save(`Beev_Proposition_${safe(client.company)}_${client.date}.pdf`);
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
