import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BEEV_JOURNEYS, MANDATORY_SERVICES, type Charger, type LineItem, type ProjectType, type Vehicle } from "./catalog";
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
};

const INK = [17, 17, 17] as [number, number, number];
const SUB = [95, 95, 100] as [number, number, number];
const RULE = [220, 218, 212] as [number, number, number];
const BG = [250, 248, 244] as [number, number, number];
const ACCENT = [140, 198, 63] as [number, number, number];
const LAVENDER = [168, 148, 214] as [number, number, number];

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 48;
const FOOTER_LIMIT = PAGE_H - 70;

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

  const v = projectType === "vehicles" ? vehicles : [];
  const c = projectType === "vehicles" ? [] : chargers;

  drawCover(doc, projectType, client, v.length, c.length);

  doc.addPage();
  drawHeader(doc, client, projectType);
  drawWhyBeev(doc, projectType);

  if (projectType === "vehicles") {
    for (let i = 0; i < v.length; i++) {
      doc.addPage();
      drawHeader(doc, client, projectType);
      await drawVehiclePage(doc, v[i], energy, i + 1, v.length);
    }
  } else {
    for (let i = 0; i < c.length; i++) {
      doc.addPage();
      drawHeader(doc, client, projectType);
      await drawChargerPage(doc, c[i], projectType, i + 1, c.length);
    }
  }

  doc.addPage();
  drawHeader(doc, client, projectType);
  drawJourney(doc, projectType);

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
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BEEV", M, 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 185);
  doc.text("Mobilité électrique pour entreprises · beev.co", M, 94);

  doc.setFillColor(...ACCENT);
  doc.rect(M, 110, 60, 4, "F");

  doc.setFontSize(9);
  doc.setTextColor(180, 180, 185);
  doc.text(`OFFRE COMMERCIALE · ${c.date.toUpperCase()}`, M, 250);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.setTextColor(255, 255, 255);
  doc.text("Beev × " + (c.company || "Votre entreprise"), M, 295);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(210, 210, 215);
  const sub = TYPE_TITLE[type];
  const subL = doc.splitTextToSize(sub, PAGE_W - M * 2);
  doc.text(subL, M, 325);

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

  doc.setDrawColor(80, 80, 90);
  doc.line(M, 640, PAGE_W - M, 640);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.setTextColor(255, 255, 255);
  if (type === "vehicles") {
    doc.text(String(nbV), M, 700);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(180, 180, 185);
    doc.text(`véhicule${nbV > 1 ? "s" : ""} étudié${nbV > 1 ? "s" : ""}`, M, 718);
  } else {
    doc.text(String(nbC), M, 700);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(180, 180, 185);
    const lbl = type === "home" ? `collaborateur${nbC > 1 ? "s" : ""} équipé${nbC > 1 ? "s" : ""} à domicile` : `site${nbC > 1 ? "s" : ""} entreprise équipé${nbC > 1 ? "s" : ""}`;
    doc.text(lbl, M, 718);
  }

  doc.setFontSize(8.5);
  doc.setTextColor(150, 150, 155);
  doc.text("Document confidentiel — usage interne client", M, PAGE_H - 50);
  doc.text("beev.co", PAGE_W - M, PAGE_H - 50, { align: "right" });
}

// ============ POURQUOI BEEV (varie par type) ============
function drawWhyBeev(doc: jsPDF, type: ProjectType) {
  let y = 130;
  eyebrow(doc, "NOTRE APPROCHE", y);
  y += 18;
  title(doc, type === "vehicles" ? "Pourquoi confier vos véhicules à Beev." :
              type === "home" ? "Le kit B2B2E clé en main pour vos collaborateurs." :
              "Un déploiement IRVE site entreprise sans friction.", y);
  y += 36;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);

  const intros: Record<ProjectType, string> = {
    vehicles: "Beev centralise pour vous le sourcing constructeur (Tesla, Mercedes, Renault, VW, Hyundai, Kia, Peugeot…), le financement LLD (Ayvens, Arval, Athlon, Leaseplan), et l'assistance multimarque tout au long de la vie du contrat. Loyers exprimés en TTC.",
    home: "Vous équipez vos collaborateurs roulant en véhicule électrique d'une borne à leur domicile. Beev gère l'intégralité : vente, installation IRVE certifiée par notre partenaire Seris, supervision, et remboursement automatisé de l'énergie consommée à titre professionnel.",
    site: "Vous électrifiez vos sites tertiaires, logistiques ou commerciaux. Beev prend en charge l'étude de site, le matériel premium (Alfen, Schneider, Hager, Wallbox), la pose IRVE certifiée, le génie civil, la mise en service OCPP et la formation des utilisateurs.",
  };
  const l1 = doc.splitTextToSize(intros[type], PAGE_W - M * 2);
  doc.text(l1, M, y);
  y += l1.length * 14 + 16;

  doc.setFont("helvetica", "bold");
  doc.text("Concrètement, ce qui change pour vous :", M, y);
  y += 18;
  doc.setFont("helvetica", "normal");

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
  bulletsByType[type].forEach((b) => {
    doc.setFillColor(...ACCENT);
    doc.circle(M + 4, y - 3, 2, "F");
    const t = doc.splitTextToSize(b, PAGE_W - M * 2 - 16);
    doc.setTextColor(...INK);
    doc.text(t, M + 14, y);
    y += t.length * 14 + 6;
  });
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
    headStyles: { fillColor: INK, textColor: 255, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9.5, cellPadding: 6, textColor: INK, lineColor: RULE },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  if (sv.includeTco && y < FOOTER_LIMIT - 100) {
    const t = computeTco(sv, e);
    doc.setFillColor(...BG);
    doc.rect(M, y, PAGE_W - M * 2, 78, "F");
    doc.setFillColor(...ACCENT);
    doc.rect(M, y, 4, 78, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...SUB);
    doc.text(`TCO AUX 100 KM · ${sv.durationMonths} mois · ${sv.kmPerYear.toLocaleString("fr-FR")} km/an (NON CONTRACTUEL)`, M + 16, y + 18);
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
  ensureSpace(doc, y, 80);
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
async function drawChargerPage(doc: jsPDF, sc: SelectedCharger, type: ProjectType, idx: number, total: number) {
  const isHome = type === "home";
  eyebrow(doc, `${isHome ? "COLLABORATEUR" : "SITE"} ${idx} / ${total}`, 116);
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

  // Image (format auto, ratio préservé) + features
  const imgY = 200;
  const imgW = 200;
  const imgH = 150;
  doc.setFillColor(...BG);
  doc.rect(M, imgY, imgW, imgH, "F");
  await drawImageContain(doc, sc.charger.image, M + 6, imgY + 6, imgW - 12, imgH - 12);

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
    doc.text(`Contact ${isHome ? "collaborateur" : "site"} : ${sc.siteContact}`, fx, fy);
  }

  let y = imgY + imgH + 20;

  const total_ = sc.lineItems.reduce((a, li) => a + li.qty * li.unitHt, 0);
  ensureSpace(doc, y, 90);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Désignation", "Qté", "PU HT", "Total HT"]],
    body: ([
      ...sc.lineItems.map((li) => [li.label, String(li.qty), eur(li.unitHt), eur(li.qty * li.unitHt)]),
      [
        { content: isHome ? "Total HT par collaborateur" : "Total HT site", colSpan: 3, styles: { fontStyle: "bold", halign: "right", fillColor: BG } },
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
  y = (doc as any).lastAutoTable.finalY + 14;

  const inclusionTxt = isHome
    ? "Pose 0–10 m incluse · matériel · raccordement par technicien IRVE certifié partenaire Seris · supervision en marque blanche · remboursement automatisé de l'énergie consommée à titre professionnel · garantie matériel selon gamme."
    : "Étude de site · pose & raccordement par technicien IRVE certifié · paramétrage OCPP & superviseur · formation utilisateurs · gestion des déchets de chantier · garantie constructeur 3 ans (extensible 6 ans).";
  if (y < FOOTER_LIMIT - 70) {
    doc.setFillColor(...BG);
    doc.rect(M, y, PAGE_W - M * 2, 60, "F");
    doc.setFillColor(...LAVENDER);
    doc.rect(M, y, 4, 60, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...SUB);
    doc.text(isHome ? "INCLUS DANS LE KIT B2B2E" : "INCLUS DANS LA PRESTATION IRVE", M + 16, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(inclusionTxt, PAGE_W - M * 2 - 32);
    doc.text(lines, M + 16, y + 36);
  }
}

// ============ VALIDATION (varie par type) ============
function drawValidation(doc: jsPDF, type: ProjectType, c: ClientInfo) {
  let y = 130;
  eyebrow(doc, "PROCHAINES ÉTAPES", y);
  y += 18;
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
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  doc.text("CONDITIONS COMMERCIALES", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  const fallback: Record<ProjectType, string> = {
    vehicles: "Offre valable 30 jours. Loyers exprimés en TTC, sous réserve de disponibilité constructeur, d'évolution de la fiscalité applicable et d'acceptation par la direction des risques du loueur. TCO indicatif, hors malus, hors aides locales.",
    home: "Offre valable 30 jours. Tarifs HT, pose 0–10 m incluse. Au-delà : devis complémentaire après visite technique. Le mandat d'installation est signé individuellement par chaque collaborateur bénéficiaire.",
    site: "Offre valable 30 jours. Tarifs HT, sous réserve de visite technique sur site. Le devis ferme par site est émis après audit IRVE. Garantie constructeur 3 ans, extensible 6 ans en option.",
  };
  const lines = doc.splitTextToSize(c.notes || fallback[type], PAGE_W - M * 2);
  doc.text(lines, M, y);
  y += lines.length * 13 + 22;

  // Bon pour accord — libellé adapté au type
  const bpaTitle: Record<ProjectType, string> = {
    vehicles: "BON POUR ACCORD — OFFRE VÉHICULES LLD",
    home: "BON POUR ACCORD — DÉPLOIEMENT DOMICILE COLLABORATEURS",
    site: "BON POUR ACCORD — DÉPLOIEMENT SITE ENTREPRISE",
  };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SUB);
  doc.text(bpaTitle[type], M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  const bpaText: Record<ProjectType, string> = {
    vehicles: "Le client confirme la sélection des véhicules ci-avant et autorise Beev à transmettre les bons de commande LLD au loueur retenu, sous réserve de l'accord risque.",
    home: "L'employeur valide le cadre du déploiement B2B2E. Chaque installation au domicile d'un collaborateur fera l'objet d'un mandat individuel signé par le collaborateur concerné.",
    site: "Le client autorise Beev à lancer l'étude technique sur site. Le devis ferme par site sera émis après audit IRVE et signé séparément avant pose.",
  };
  const bl = doc.splitTextToSize(bpaText[type], PAGE_W - M * 2);
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
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BEEV", M, 56);
  doc.setFont("helvetica", "normal");
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
  const lines = doc.splitTextToSize(label, PAGE_W - M * 2);
  doc.text(lines, M, y);
}

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const eur2 = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);

function ensureSpace(doc: jsPDF, y: number, needed: number) {
  if (y + needed > FOOTER_LIMIT) {
    doc.addPage();
  }
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
  try {
    doc.addImage(img.dataUrl, img.format, cx, cy, w, h, undefined, "FAST");
  } catch {
    /* image format non supporté — silencieux */
  }
}
