import { useState } from "react";
import { Settings2, RotateCcw, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ProjectType } from "@/lib/catalog";
import { CONFIG_GROUPS, type PdfDisplayConfig } from "@/lib/pdf-config";

type Props = {
  config: PdfDisplayConfig;
  update: (patch: Partial<PdfDisplayConfig>) => void;
  reset: () => void;
  projectType: ProjectType;
  /** Ouvre un aperçu (couverture + cette section uniquement) dans un onglet. */
  onPreviewSection?: (key: keyof PdfDisplayConfig) => void;
  /** Compte admin : active la vue « ordre du document » (sections rangées dans
   *  l'ordre réel du PDF, avec un numéro de page indicatif à droite). */
  isAdmin?: boolean;
};

// Ordre de lecture réel du document (ordre dans lequel les pages sortent du
// générateur). Sert à ranger les sections et à calculer un numéro de page
// indicatif. Les clés absentes de cette liste sont affichées à la fin.
const DOC_ORDER: string[] = [
  // Ouverture
  "showWhyBeev", "showSocialProof",
  // Offre véhicules
  "showVehicleComparator", "showCurrentFleetVehicle", "showProposalVehicle", "showCompetitorComparison",
  // Analyse TCO véhicules
  "showTcoComparison", "showTcoDetailedTable", "showTcoFiscalDetail", "showFleetSynthesis",
  "showCarbonImpact", "showFiscalAdvantages",
  // Rapport site entreprise
  "showSiteOverview", "showSiteGuarantees", "showSiteProjectSynthesis", "showSiteInfrastructure",
  "showSiteEquipments", "showSiteProductSheet", "showSiteSupervision", "showSiteCompliance",
  "showSiteFinancialRecap", "showSitePaymentOptions",
  // Supervision (modules)
  "showSupervisionHome", "showSupervisionConnect",
  // Synthèse & clôture
  "showFinancialSummary", "showFinancialSynthesis", "showGuarantees", "showJourney",
  "showExecutiveSummary", "showLegend",
];
const docRank = (key: string) => {
  const i = DOC_ORDER.indexOf(key);
  return i === -1 ? DOC_ORDER.length + 1 : i;
};

// Regroupement des sections par PHASE de lecture du document (v2 admin).
type PhaseAccent = "rose" | "bleu" | "violet" | "ink";
const ACCENT_BG: Record<PhaseAccent, string> = {
  rose: "bg-beev-rose", bleu: "bg-beev-bleu", violet: "bg-beev-violet", ink: "bg-beev-black",
};
const PHASES: { name: string; accent: PhaseAccent; keys: string[] }[] = [
  { name: "Ouverture", accent: "rose", keys: ["showWhyBeev", "showSocialProof"] },
  { name: "Offre véhicules", accent: "bleu", keys: ["showVehicleComparator", "showCurrentFleetVehicle", "showProposalVehicle", "showCompetitorComparison", "showFleetSynthesis"] },
  { name: "Analyse TCO", accent: "violet", keys: ["includeCurrentFleetInTco", "showTcoComparison", "showTcoDetailedTable", "tcoGroupByComparison", "showTcoFiscalDetail", "showCarbonImpact", "showFiscalAdvantages"] },
  { name: "Rapport site & bornes", accent: "ink", keys: ["showSiteOverview", "showSiteGuarantees", "showSiteProjectSynthesis", "showSiteInfrastructure", "showSiteEquipments", "showSiteProductSheet", "showSiteSupervision", "showSiteCompliance", "showSiteFinancialRecap", "showSitePaymentOptions", "showChargerFeatures", "showChargerLineItems", "showChargerInclusionNote", "showSupervisionHome", "showSupervisionConnect"] },
  { name: "Synthèse & clôture", accent: "rose", keys: ["showFinancialSummary", "showFinancialSynthesis", "showGuarantees", "showJourney", "showExecutiveSummary", "showLegend", "showValidation"] },
  { name: "Détails fiche véhicule", accent: "bleu", keys: ["showVehicleConsumption", "showVehicleCo2", "showVehicleFiscalHp", "showVehicleEnvScore", "showVehicleServices", "showVehicleOptions", "showVehicleDiscount", "showVehicleTcoBlock", "showVehicleLeadTime", "showVehicleTrunk", "showVehicleChargeAc", "showVehicleChargeDc", "showVehicleChargeTime2080Ac", "showVehicleChargeTime2080Dc", "showVehicleDimensions"] },
];

// Type de page par section → mini-maquette, pour savoir à quoi ressemble chaque
// section sans générer l'aperçu.
type SectionKind = "texte" | "tableau" | "graphique" | "cartes" | "fiche";
const KIND_BY_KEY: Record<string, SectionKind> = {
  showWhyBeev: "texte", showSocialProof: "cartes",
  showFleetSynthesis: "tableau", showTcoComparison: "graphique",
  showTcoDetailedTable: "tableau", showTcoFiscalDetail: "tableau",
  showVehicleComparator: "tableau", showCurrentFleetVehicle: "fiche",
  showProposalVehicle: "fiche", showCompetitorComparison: "cartes",
  showCarbonImpact: "graphique", showFinancialSummary: "tableau",
  showFinancialSynthesis: "cartes", showFiscalAdvantages: "texte",
  showLegend: "texte", showGuarantees: "cartes", showJourney: "cartes",
  showExecutiveSummary: "texte", showB2B2ETco: "graphique",
  showSupervisionHome: "cartes", showSupervisionConnect: "cartes",
  showSiteOverview: "texte", showSiteGuarantees: "cartes", showSiteProjectSynthesis: "texte",
  showSiteInfrastructure: "texte", showSiteEquipments: "tableau", showSiteProductSheet: "fiche",
  showSiteSupervision: "cartes", showSiteCompliance: "texte", showSiteFinancialRecap: "tableau",
  showSitePaymentOptions: "cartes", showValidation: "texte",
};
const KIND_LABEL: Record<SectionKind, string> = {
  texte: "Texte", tableau: "Tableau", graphique: "Graphique", cartes: "Cartes", fiche: "Fiche",
};
function KindThumb({ kind }: { kind: SectionKind }) {
  return (
    <svg width="28" height="34" viewBox="0 0 28 34" className="flex-shrink-0 mt-0.5" aria-hidden>
      <rect x="0.5" y="0.5" width="27" height="33" rx="3.5" fill="#fff" stroke="#E4E2DC" />
      {kind === "texte" && [7, 12, 17, 22].map((y, i) => (
        <rect key={i} x="5" y={y} width={i === 3 ? 11 : 18} height="2" rx="1" fill="#C9C6BF" />
      ))}
      {kind === "tableau" && (
        <g>
          {[8, 14, 20, 26].map((y, i) => <rect key={i} x="5" y={y} width="18" height="1.6" rx="0.8" fill="#C9C6BF" />)}
          <rect x="13.5" y="6" width="1" height="24" fill="#E4E2DC" />
        </g>
      )}
      {kind === "graphique" && (
        <g fill="#F4B8AA">
          {[[6, 16], [11, 11], [16, 19], [21, 8]].map(([x, h], i) => <rect key={i} x={x} y={28 - h} width="3" height={h} rx="0.5" />)}
        </g>
      )}
      {kind === "cartes" && (
        <g fill="#EDF6FF" stroke="#A5D2FF">
          {[[5, 6], [15, 6], [5, 19], [15, 19]].map(([x, y], i) => <rect key={i} x={x} y={y} width="8" height="9" rx="1.5" />)}
        </g>
      )}
      {kind === "fiche" && (
        <g>
          <rect x="5" y="6" width="18" height="11" rx="1.5" fill="#F6F5F7" stroke="#D3CCD8" />
          {[21, 25, 29].map((y, i) => <rect key={i} x="5" y={y} width={i === 2 ? 10 : 16} height="1.6" rx="0.8" fill="#C9C6BF" />)}
        </g>
      )}
    </svg>
  );
}

export function PdfConfigPanel({ config, update, reset, projectType, onPreviewSection, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({});

  // On ne compte que les réglages booléens (toggles) : certaines clés sont des
  // modes (ex. b2b2eChargerMode = "comparator" | "catalogue" | "both").
  const boolKeys = (Object.keys(config) as Array<keyof PdfDisplayConfig>).filter((k) => typeof config[k] === "boolean");
  const enabledCount = boolKeys.filter((k) => config[k] === true).length;
  const totalCount = boolKeys.length;

  // Visibilité d'une section selon le type de projet (filtre groupe + item).
  const itemVisible = (group: (typeof CONFIG_GROUPS)[number], item: (typeof CONFIG_GROUPS)[number]["items"][number]) => {
    if (group.appliesTo && !group.appliesTo.includes(projectType)) return false;
    const itemAppliesTo = (item as any).appliesTo as ProjectType[] | undefined;
    if (itemAppliesTo && !itemAppliesTo.includes(projectType)) return false;
    return true;
  };

  // Vue admin « ordre du document » : sections rangées dans l'ordre réel du PDF
  // + numéro de page indicatif (couverture = p.1, chaque section affichée ajoute
  // une page ; l'ordre réel dépend des sections cochées).
  const orderedItems = CONFIG_GROUPS
    .flatMap((g) => g.items.filter((it) => itemVisible(g, it)))
    .sort((a, b) => docRank(a.key as string) - docRank(b.key as string));
  // Numéro de page indicatif : uniquement pour les sections qui sont de vraies
  // pages (celles ayant une vignette/type). Les bascules de mode et les détails
  // de fiche n'occupent pas de page propre.
  const pageOf = new Map<string, number>();
  let pageCounter = 1;
  for (const it of orderedItems) {
    if (config[it.key] && KIND_BY_KEY[it.key as string]) { pageCounter += 1; pageOf.set(it.key as string, pageCounter); }
  }

  const renderItem = (item: (typeof CONFIG_GROUPS)[number]["items"][number], pageNum?: number) => {
    const on = !!config[item.key];
    const kind = KIND_BY_KEY[item.key as string];
    return (
      <label
        key={item.key}
        className={`flex items-start gap-2 cursor-pointer rounded-md border p-2 transition ${
          on ? "border-beev-rose/50 bg-beev-rose-20" : "border-border/60 bg-transparent opacity-70 hover:opacity-100"
        }`}
      >
        <Checkbox checked={on} onCheckedChange={(v) => update({ [item.key]: !!v })} className="mt-0.5" />
        {kind && <KindThumb kind={kind} />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs cursor-pointer leading-tight font-medium">
              {item.label}
              {kind && <span className="ml-1.5 text-[9px] font-normal text-muted-foreground">· {KIND_LABEL[kind]}</span>}
            </Label>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {pageNum != null && (
                <span className="text-[9px] font-semibold uppercase rounded-full px-1.5 py-0.5 bg-beev-violet/30 text-beev-black" title="Page indicative dans le PDF">
                  p. {pageNum}
                </span>
              )}
              {kind && onPreviewSection && (
                <button
                  type="button"
                  title="Aperçu de cette page dans un onglet"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPreviewSection(item.key); }}
                  className="flex items-center gap-1 text-[9px] font-semibold uppercase rounded-full border border-beev-bleu bg-beev-bleu-20 text-beev-black px-1.5 py-0.5 hover:bg-beev-bleu/40 transition"
                >
                  <Eye className="w-2.5 h-2.5" /> Voir
                </button>
              )}
              <span className={`flex items-center gap-1 text-[9px] font-semibold uppercase rounded-full px-1.5 py-0.5 ${
                on ? "bg-beev-rose text-beev-black" : "bg-muted text-muted-foreground"
              }`}>
                {on ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                {on ? "Affiché" : "Masqué"}
              </span>
            </div>
          </div>
          {item.description && (
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{item.description}</p>
          )}
        </div>
      </label>
    );
  };

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-3 hover:bg-accent/40 transition"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-[#5F5F64]" />
          <div className="text-left">
            <p className="text-sm font-semibold">Configuration PDF</p>
            <p className="text-xs text-muted-foreground">
              {enabledCount} / {totalCount} éléments affichés
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="border-t p-3 space-y-4">
          <p className="text-[11px] text-muted-foreground">
            Cochez les éléments à inclure dans le PDF client. La configuration est
            sauvegardée localement et s'applique à toutes vos prochaines générations.
          </p>

          {isAdmin ? (
            // Vue admin v2 : sections groupées par PHASE du document, dans l'ordre
            // réel, avec barre de progression + numéro de page indicatif.
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase text-[#5F5F64]">Ordre du document</p>
                <span className="text-[9px] text-muted-foreground">Pages indicatives</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-beev-rose rounded-full transition-all" style={{ width: `${totalCount ? Math.round((enabledCount / totalCount) * 100) : 0}%` }} />
              </div>
              {(() => {
                const used = new Set<string>();
                const blocks = PHASES.map((ph) => {
                  const items = orderedItems.filter((it) => ph.keys.includes(it.key as string));
                  items.forEach((it) => used.add(it.key as string));
                  return { name: ph.name, accent: ph.accent, items };
                });
                const rest = orderedItems.filter((it) => !used.has(it.key as string));
                if (rest.length) blocks.push({ name: "Autres réglages", accent: "ink" as PhaseAccent, items: rest });
                return blocks.filter((b) => b.items.length > 0).map((b) => {
                  const onCount = b.items.filter((it) => !!config[it.key]).length;
                  const phaseOpen = openPhases[b.name] !== false;
                  return (
                    <div key={b.name} className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => setOpenPhases((s) => ({ ...s, [b.name]: !phaseOpen }))}
                        className="w-full flex items-center gap-2 py-1"
                      >
                        <span className={`w-1 h-4 rounded-full ${ACCENT_BG[b.accent]}`} />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#5F5F64] flex-1 text-left">{b.name}</span>
                        <span className="text-[9px] font-bold text-muted-foreground bg-muted rounded-full px-2 py-0.5">{onCount}/{b.items.length}</span>
                        {phaseOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      {phaseOpen && (
                        <div className="space-y-1.5">
                          {b.items.map((item) => renderItem(item, pageOf.get(item.key as string)))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            CONFIG_GROUPS.map((group) => {
              // Filtre par type de projet si défini
              if (group.appliesTo && !group.appliesTo.includes(projectType)) return null;
              const items = group.items.filter((item) => itemVisible(group, item));
              if (items.length === 0) return null;
              return (
                <div key={group.title} className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase text-[#5F5F64]">{group.title}</p>
                  <div className="space-y-1.5">
                    {items.map((item) => renderItem(item))}
                  </div>
                </div>
              );
            })
          )}

          <div className="grid grid-cols-3 gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const all: Record<string, boolean> = {};
                for (const k of boolKeys) all[k as string] = true;
                update(all as Partial<PdfDisplayConfig>);
              }}
              className="gap-1 h-7 text-xs"
            >
              Tout cocher
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const all: Record<string, boolean> = {};
                for (const k of boolKeys) all[k as string] = false;
                update(all as Partial<PdfDisplayConfig>);
              }}
              className="gap-1 h-7 text-xs"
            >
              Tout décocher
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              className="gap-1 h-7 text-xs"
              title="Revenir aux valeurs par défaut"
            >
              <RotateCcw className="w-3 h-3" /> Défaut
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
