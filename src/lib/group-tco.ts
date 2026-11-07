// TCO d'un groupe de comparaison selon la durée et le kilométrage.
//
// Dans un groupe, les véhicules n'ont pas forcément les mêmes paramètres de contrat
// (36 mois à 20 000 km/an pour l'actuel, 48 mois à 30 000 km/an pour une proposition) : leurs
// coûts totaux ne sont alors pas comparables. Ce module recalcule le coût complet de chaque
// véhicule pour une même durée et un même kilométrage.
//
// Ce qui change avec le scénario : l'énergie, la durée des taxes et de l'AND / AEN, et le
// LOYER. Le loyer n'est JAMAIS inventé :
//   1) la configuration principale du devis, si elle correspond au scénario ;
//   2) une configuration supplémentaire du devis (autre durée / km saisie par le commercial) ;
//   3) une offre loueur du catalogue pour ce véhicule, durée et km ;
//   4) la flotte actuelle garde son contrat, quel que soit le scénario ;
//   5) sinon, hypothèse « loyer inchangé » signalée comme telle (known = false).

import { calculateTcoFull, type TcoFullResult } from "./tco-calculator";
import type { SelectedVehicle } from "./pdf";
import type { EnergyParams } from "./store";
import type { LeaserOffer } from "./leaser-offers";

export type Scenario = { months: number; kmPerYear: number };

export type LoyerSource = "principale" | "supplementaire" | "offre" | "actuel" | "hypothese" | "manquant";

export type LoyerResolution = {
  monthly: number;
  source: LoyerSource;
  /** Libellé court pour l'info-bulle (« Offre Arval », « Config. principale »…). */
  label: string;
  /** false : loyer supposé (hypothèse) ou absent, à ne pas présenter comme négocié. */
  known: boolean;
};

export type GroupTcoCell = {
  loyer: LoyerResolution;
  r: TcoFullResult | null;
  tco: number;
  perMonth: number;
  perKm: number;
};

const kmClose = (a: number, b: number) => Math.abs(a - b) <= Math.max(500, Math.max(a, b) * 0.02);

export const sameScenario = (a: Scenario, b: Scenario) => a.months === b.months && kmClose(a.kmPerYear, b.kmPerYear);
export const scenarioKey = (s: Scenario) => `${s.months}|${Math.round(s.kmPerYear / 1000)}`;
export const scenarioLabel = (s: Scenario) => `${s.months} mois · ${new Intl.NumberFormat("fr-FR").format(Math.round(s.kmPerYear)).replace(/[  ]/g, " ")} km/an`;

/** Contrat principal d'un véhicule du devis. */
export const mainScenario = (sv: SelectedVehicle): Scenario => ({
  months: Math.max(1, Math.round(sv.durationMonths || 0)),
  kmPerYear: sv.kmPerYear || 0,
});

/** Contrats distincts des véhicules d'un groupe : principal, puis supplémentaires. Triés par
 *  durée puis kilométrage. */
export function scenariosOf(members: SelectedVehicle[], includeAdditional = true): Scenario[] {
  const out: Scenario[] = [];
  const add = (s: Scenario) => {
    if (s.months > 0 && s.kmPerYear > 0 && !out.some((o) => sameScenario(o, s))) out.push(s);
  };
  for (const sv of members) add(mainScenario(sv));
  if (includeAdditional) {
    for (const sv of members) {
      for (const c of sv.additionalConfigs ?? []) {
        if (c.negotiatedMonthly > 0) add({ months: Math.max(1, Math.round(c.durationMonths)), kmPerYear: c.kmPerYear });
      }
    }
  }
  return out.sort((a, b) => a.months - b.months || a.kmPerYear - b.kmPerYear);
}

/** Vrai si les contrats principaux du groupe diffèrent (totaux alors non comparables). */
export function configsDiffer(members: SelectedVehicle[]): boolean {
  const mains = scenariosOf(members, false);
  return mains.length > 1;
}

/** Loyer mensuel d'un véhicule pour un scénario, avec sa provenance. */
export function resolveLoyer(sv: SelectedVehicle, sc: Scenario, offers: LeaserOffer[] = []): LoyerResolution {
  const main = mainScenario(sv);
  if (sv.vehicle.isCurrentFleet) {
    return { monthly: sv.negotiatedMonthly || 0, source: "actuel", label: "Contrat actuel (inchangé)", known: true };
  }
  if (sameScenario(main, sc) && sv.negotiatedMonthly > 0) {
    return { monthly: sv.negotiatedMonthly, source: "principale", label: "Configuration principale du devis", known: true };
  }
  const extra = (sv.additionalConfigs ?? []).find(
    (c) => c.negotiatedMonthly > 0 && sameScenario({ months: Math.round(c.durationMonths), kmPerYear: c.kmPerYear }, sc),
  );
  if (extra) return { monthly: extra.negotiatedMonthly, source: "supplementaire", label: "Configuration supplémentaire du devis", known: true };

  const kmTotal = (sc.kmPerYear * sc.months) / 12;
  const matching = offers
    .filter((o) => o.active && o.vehicleId === sv.vehicle.id && o.durationMonths === sc.months && Math.abs(o.kmTotal - kmTotal) <= 1000 && o.monthlyPriceTtc > 0)
    .sort((a, b) => a.monthlyPriceTtc - b.monthlyPriceTtc)[0];
  if (matching) return { monthly: matching.monthlyPriceTtc, source: "offre", label: `Offre ${matching.loueur}`, known: true };

  if (sv.negotiatedMonthly > 0) {
    return { monthly: sv.negotiatedMonthly, source: "hypothese", label: "Hypothèse : loyer de la configuration principale, non négocié pour cette durée et ce kilométrage", known: false };
  }
  return { monthly: 0, source: "manquant", label: "Loyer à saisir", known: false };
}

/** Coût complet d'un véhicule pour un scénario (même moteur que le PDF : loyers, énergie, TVS,
 *  malus, AND, AEN employeur). Sans loyer connu ni supposé, la cellule n'est pas chiffrée. */
export function computeCell(sv: SelectedVehicle, sc: Scenario, e: EnergyParams, offers: LeaserOffer[] = []): GroupTcoCell {
  const loyer = resolveLoyer(sv, sc, offers);
  if (loyer.source === "manquant") return { loyer, r: null, tco: 0, perMonth: 0, perKm: 0 };
  const years = sc.months / 12;
  const kmTotal = sc.kmPerYear * years;
  const optionsTtc = (sv.options ?? []).reduce((s, o) => s + o.qty * o.unitHt, 0);
  const r = calculateTcoFull(sv.vehicle, {
    dureeAnnees: years,
    kmContrat: kmTotal,
    prixEssenceLitre: e.fuelPriceL,
    prixKwhDomicile: e.kWhHome,
    prixKwhPublic: e.kWhPublic,
    mixDomicilePct: e.mixHomePct,
    optionsTotalTtc: optionsTtc,
    remisePctOverride: sv.discountPct,
    apport: Math.max(0, sv.apport ?? 0),
  }, loyer.monthly);
  const tco = r.tcoEmployeurComplet;
  return { loyer, r, tco, perMonth: tco / sc.months, perKm: kmTotal > 0 ? tco / kmTotal : 0 };
}

/** Meilleure proposition (hors flotte actuelle) d'un scénario : coût mensuel le plus bas parmi
 *  les cellules chiffrées. Renvoie son indice dans `cells`, ou -1. */
export function bestIndex(members: SelectedVehicle[], cells: GroupTcoCell[]): number {
  let best = -1;
  cells.forEach((c, i) => {
    if (members[i].vehicle.isCurrentFleet || !c.r) return;
    if (best < 0 || c.perMonth < cells[best].perMonth) best = i;
  });
  return best;
}

/** Cellule de la flotte actuelle d'un groupe (la plus chère si plusieurs), ou -1. */
export function currentIndex(members: SelectedVehicle[], cells: GroupTcoCell[]): number {
  let cur = -1;
  members.forEach((sv, i) => {
    if (!sv.vehicle.isCurrentFleet || !cells[i].r) return;
    if (cur < 0 || cells[i].perMonth > cells[cur].perMonth) cur = i;
  });
  return cur;
}
