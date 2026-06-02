// Liste des loueurs et captives partenaires Beev. Utilisée dans les dropdowns
// d'édition d'offres loueurs. La saisie libre reste possible (champ texte
// avec datalist) pour ajouter un partenaire ad hoc.

export type LeaserKind = "loueur" | "captive";

export type LeaserPartner = {
  name: string;
  kind: LeaserKind;
  short?: string; // libellé court éventuel
};

export const KNOWN_LEASERS: LeaserPartner[] = [
  // Loueurs multi-marques
  { name: "Ayvens", kind: "loueur" },
  { name: "Arval", kind: "loueur" },
  { name: "Alphabet", kind: "loueur" },
  { name: "Athlon", kind: "loueur" },
  { name: "Leaseplan", kind: "loueur" },
  { name: "BPCE Lease", kind: "loueur", short: "BPCE" },
  { name: "Société Générale Equipement Finance", kind: "loueur", short: "SGEF" },
  { name: "Free2Move Lease", kind: "loueur" },

  // Captives constructeurs
  { name: "DIAC (Renault Finance)", kind: "captive", short: "DIAC" },
  { name: "VW Bank / VW Finance", kind: "captive", short: "VW Bank" },
  { name: "BMW Finance", kind: "captive" },
  { name: "Mercedes-Benz Financial Services", kind: "captive", short: "MBFS" },
  { name: "Stellantis Financial Services", kind: "captive", short: "SFS" },
  { name: "Toyota Finance", kind: "captive" },
  { name: "Hyundai Capital", kind: "captive" },
  { name: "Kia Finance", kind: "captive" },
];

// Helper : retourne les noms uniquement, triés (loueurs puis captives)
export const LEASER_NAMES: string[] = KNOWN_LEASERS.map((l) => l.name);

// Helper : associe un nom au type (utile pour affichage avec badge)
export function getLeaserKind(name: string): LeaserKind | undefined {
  const found = KNOWN_LEASERS.find((l) => l.name.toLowerCase() === name.toLowerCase());
  return found?.kind;
}
