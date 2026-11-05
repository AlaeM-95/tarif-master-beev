// Groupes de comparaison d'un devis. Un véhicule chiffré peut appartenir à
// PLUSIEURS groupes sans être dupliqué : sa fiche n'apparaît qu'une fois dans le
// PDF, et il figure dans la page de comparaison de chacun de ses groupes.
//
// Stockage : `comparisonGroups` (liste) est la référence ; `comparisonGroup`
// (texte unique, ancien format) garde le 1er groupe pour les anciennes
// propositions et pour le code qui ne sait lire qu'un groupe.

import type { SelectedVehicle } from "@/lib/pdf";

/** Pastilles de couleur des groupes (l'index du groupe dans la liste du devis
 *  détermine la couleur, partout dans l'outil). */
export type GroupTone = { dot: string; bg: string; border: string; text: string };
export const GROUP_TONES: GroupTone[] = [
  { dot: "#3809EA", bg: "#ECE8FD", border: "#C9BDF8", text: "#2A0BA6" },
  { dot: "#E8725C", bg: "#FDECE8", border: "#F6C4BA", text: "#A8402D" },
  { dot: "#1D9A6C", bg: "#E3F5EC", border: "#B4E0CB", text: "#146B49" },
  { dot: "#D99100", bg: "#FCF1D9", border: "#F2D89A", text: "#8A5C00" },
  { dot: "#2A7FD4", bg: "#E4F0FB", border: "#B7D5F2", text: "#1B5A9C" },
  { dot: "#B53D8F", bg: "#F8E6F1", border: "#E8B7D6", text: "#822A66" },
  { dot: "#5E6B7A", bg: "#EBEEF1", border: "#CBD2D9", text: "#3F4954" },
  { dot: "#8A6A2F", bg: "#F3EBDD", border: "#DECDAE", text: "#5F4719" },
];

export function groupTone(index: number): GroupTone {
  const n = GROUP_TONES.length;
  return GROUP_TONES[((index % n) + n) % n];
}

type WithGroups = Pick<SelectedVehicle, "comparisonGroup" | "comparisonGroups">;

/** Groupes d'un véhicule (sans doublon ni nom vide), ancien format compris. */
export function vehicleGroups(sv: WithGroups): string[] {
  const raw = sv.comparisonGroups ?? (sv.comparisonGroup ? [sv.comparisonGroup] : []);
  const out: string[] = [];
  for (const g of raw) {
    const t = (g ?? "").trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Champs à écrire sur un véhicule pour lui donner ces groupes. */
export function groupsPatch(groups: string[]): WithGroups {
  return { comparisonGroups: groups, comparisonGroup: groups[0] };
}

/** Noms de groupes présents dans une liste de véhicules, dans l'ordre d'apparition. */
export function groupNamesOf(list: SelectedVehicle[]): string[] {
  const out: string[] = [];
  for (const sv of list) for (const g of vehicleGroups(sv)) if (!out.includes(g)) out.push(g);
  return out;
}

// ── Ce qu'il faut pour que la page « Comparateur par groupe » apparaisse dans le PDF ──
// Miroir de `groupComparisonEligible` (pdf.ts) : au moins 2 véhicules dont au moins une
// PROPOSITION ; chaque proposition a un loyer négocié > 0 ; au moins un véhicule a « Inclure
// le TCO » ; et la page est activée dans la configuration PDF. La flotte actuelle peut figurer
// dans le groupe : elle est comparée à la meilleure proposition.
export type GroupIssue = {
  kind: "disabled" | "few" | "onlycurrent" | "loyer" | "tco";
  text: string;
  /** Véhicule concerné (absent pour les points qui concernent tout le groupe). */
  vehicle?: SelectedVehicle;
};

const vName = (sv: SelectedVehicle) => `${sv.vehicle.brand} ${sv.vehicle.model}`.trim();

export function groupIssues(members: SelectedVehicle[], pageEnabled: boolean): GroupIssue[] {
  const out: GroupIssue[] = [];
  if (!pageEnabled) out.push({ kind: "disabled", text: "La page « Comparateur par groupe » est désactivée dans la configuration PDF." });
  if (members.length < 2) {
    out.push({ kind: "few", text: members.length === 0 ? "Groupe vide : ajoutez au moins 2 véhicules." : "Un seul véhicule : ajoutez-en au moins un autre." });
  }
  // La flotte actuelle peut figurer dans le groupe (elle est comparée à la meilleure proposition),
  // mais il faut au moins une proposition ; chaque proposition doit avoir un loyer négocié.
  if (members.length >= 2 && members.every((sv) => sv.vehicle.isCurrentFleet)) {
    out.push({ kind: "onlycurrent", text: "Ce groupe ne contient que de la flotte actuelle : ajoutez au moins une proposition Beev." });
  }
  for (const sv of members) {
    if (!sv.vehicle.isCurrentFleet && !((sv.negotiatedMonthly ?? 0) > 0)) {
      out.push({ kind: "loyer", vehicle: sv, text: `${vName(sv)} : loyer négocié à saisir.` });
    }
  }
  if (members.length > 0 && !members.some((sv) => sv.includeTco)) {
    out.push({ kind: "tco", text: "Aucun véhicule du groupe n'a « Inclure le TCO » activé." });
  }
  return out;
}

/** Pourquoi la page « Comparateur par groupe » ne sera pas générée, groupe par groupe (une
 *  phrase par groupe concerné). Ne signale que les groupes d'au moins 2 véhicules, c'est-à-dire
 *  ceux que le commercial veut visiblement comparer. Liste vide = tout est en ordre. */
export function comparatorNotes(vehicles: SelectedVehicle[], pageEnabled: boolean): string[] {
  if (vehicles.length < 2) return [];
  const buckets = new Map<string, SelectedVehicle[]>();
  const free: SelectedVehicle[] = [];
  for (const sv of vehicles) {
    const gs = vehicleGroups(sv);
    if (gs.length === 0) free.push(sv);
    for (const g of gs) buckets.set(g, [...(buckets.get(g) ?? []), sv]);
  }
  const notes: string[] = [];
  const check = (label: string, list: SelectedVehicle[]) => {
    if (list.length < 2) return;
    const issues = groupIssues(list, pageEnabled);
    if (issues.length) notes.push(`${label} : ${issues.map((i) => i.text).join(" ")}`);
  };
  for (const [g, list] of buckets) check(`« ${g} »`, list);
  check("Véhicules sans groupe", free);
  return notes;
}
