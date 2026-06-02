// Loueurs partenaires Beev pré-renseignés dans le dropdown du back-office.
// Liste courte volontairement (4 entrées) : l'ops choisit dans la liste OU saisit
// un loueur/captive personnalisé via le champ "Autre" du dropdown — dans ce cas
// il précise aussi le kind (loueur ou captive).

export type LeaserKind = "loueur" | "captive";

export type LeaserPartner = {
  name: string;
  kind: LeaserKind;
};

export const KNOWN_LEASERS: LeaserPartner[] = [
  { name: "Ayvens", kind: "loueur" },
  { name: "Arval", kind: "loueur" },
  { name: "Alphabet", kind: "loueur" },
  { name: "BPCE Lease", kind: "loueur" },
];

export const LEASER_NAMES: string[] = KNOWN_LEASERS.map((l) => l.name);

export function getLeaserKindFromKnown(name: string): LeaserKind | undefined {
  const found = KNOWN_LEASERS.find((l) => l.name.toLowerCase() === name.toLowerCase());
  return found?.kind;
}

export const LEASER_KIND_LABELS: Record<LeaserKind, string> = {
  loueur: "Loueur multi-marques",
  captive: "Captive constructeur",
};
