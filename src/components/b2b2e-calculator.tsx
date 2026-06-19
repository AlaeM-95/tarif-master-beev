// Calculateur TCO B2B2E (Bornes au domicile des collaborateurs).
// Compare le coût total entre recharge à domicile + supervision Beev Home
// Charging vs solution thermique classique (carburant SP95/Diesel).
//
// Affiché en mode "Bornes domicile" sur la page d'accueil, juste après
// la sélection des bornes. Les paramètres sont persistés en localStorage
// pour rester cohérents entre les sessions.

import { useEffect, useState } from "react";
import { Leaf, Calculator, Sparkles, ChevronDown, ChevronUp, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateB2B2ETco,
  DEFAULT_B2B2E_INPUT,
  type B2B2ECalculatorInput,
  type B2B2ECalculatorResult,
} from "@/lib/tco-calculator";

const STORAGE_KEY = "beev_b2b2e_input_v1";

// Fonctionnalités par défaut de la slide « Supervision Beev Home Charging »
// (doit rester aligné avec le fallback de drawSiteSupervision dans pdf.ts).
export const DEFAULT_HOME_SUPERVISION_FEATURES = [
  "Comptage précis kWh par session domicile",
  "Tarif électricité indexé sur le contrat collaborateur",
  "Versement mensuel automatisé sur RIB salarié",
  "Reporting employeur",
  "Conformité fiscale URSSAF",
  "Application mobile collaborateur",
];
export const DEFAULT_HOME_SUPERVISION_PRICE = "8 € HT";

const fmtEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)} %`;

export function useB2B2EInput() {
  const [input, setInput] = useState<B2B2ECalculatorInput>(DEFAULT_B2B2E_INPUT);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setInput({ ...DEFAULT_B2B2E_INPUT, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);
  const update = (patch: Partial<B2B2ECalculatorInput>) => {
    setInput((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const reset = () => {
    setInput(DEFAULT_B2B2E_INPUT);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };
  return { input, update, reset };
}

type Props = {
  input: B2B2ECalculatorInput;
  update: (patch: Partial<B2B2ECalculatorInput>) => void;
  reset: () => void;
  /** Inclure dans le PDF — toggle persisté indépendamment (par devis). */
  includeInPdf: boolean;
  setIncludeInPdf: (v: boolean) => void;
  /** Suggestion de nbCollabs depuis les bornes domicile sélectionnées
   *  (∑ quantity). Si différent de input.nbCollabs, le composant affiche
   *  un encart avec un bouton "Appliquer" pour synchroniser. */
  suggestedNbCollabs?: number;
  /** Contenu éditable de la slide Supervision (PDF), piloté ici plutôt que
   *  dans l'éditeur de textes PDF. Prix affiché + liste de fonctionnalités. */
  supervisionPriceDisplay: string;
  onSupervisionPriceDisplay: (v: string) => void;
  supervisionFeatures: string[];
  onSupervisionFeatures: (v: string[]) => void;
};

export function B2B2ECalculator({ input, update, reset, includeInPdf, setIncludeInPdf, suggestedNbCollabs, supervisionPriceDisplay, onSupervisionPriceDisplay, supervisionFeatures, onSupervisionFeatures }: Props) {
  const [openDetails, setOpenDetails] = useState(false);
  const result = calculateB2B2ETco(input);

  return (
    <Card className="border-[#3809EA]/20">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#3809EA]/10 flex items-center justify-center flex-shrink-0">
            <Calculator className="w-5 h-5 text-[#3809EA]" />
          </div>
          <div>
            <CardTitle className="text-base">Calculateur TCO B2B2E · Bornes domicile</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare le coût total recharge domicile + itinérance vs solution thermique.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Switch id="b2b2e-pdf" checked={includeInPdf} onCheckedChange={setIncludeInPdf} />
          <Label htmlFor="b2b2e-pdf" className="text-xs">Inclure PDF</Label>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Suggestion auto basée sur les bornes domicile sélectionnées */}
        {suggestedNbCollabs !== undefined && suggestedNbCollabs > 0 && suggestedNbCollabs !== input.nbCollabs && (
          <div className="rounded-md border border-[#3809EA]/30 bg-[#3809EA]/5 p-2 flex items-center justify-between gap-2 text-xs">
            <span>
              Vous avez sélectionné <strong>{suggestedNbCollabs}</strong> borne{suggestedNbCollabs > 1 ? "s" : ""} domicile —
              actuellement <strong>{input.nbCollabs}</strong> collaborateur{input.nbCollabs > 1 ? "s" : ""} pris en compte ici.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-shrink-0"
              onClick={() => update({ nbCollabs: suggestedNbCollabs })}
            >
              Appliquer {suggestedNbCollabs}
            </Button>
          </div>
        )}

        {/* === BANDEAU ÉCONOMIE GÉANT === */}
        <div className="rounded-xl bg-gradient-to-br from-[#3809EA] via-[#4F2DF5] to-[#5B3FFF] text-white p-6 sm:p-8 text-center shadow-lg">
          <p className="text-xs uppercase tracking-widest text-white/70 mb-2">Votre flotte économise</p>
          <p className="text-4xl sm:text-5xl font-bold leading-none">{fmtEur(result.economieFlotteAnnuelle)}<span className="text-2xl sm:text-3xl font-normal ml-1">/an</span></p>
          <p className="text-sm text-white/80 mt-3">
            sur {input.dureeAnnees} ans de contrat = <strong>{fmtEur(result.economieFlotteTotale)}</strong> économisés au total
            <span className="hidden sm:inline"> · soit {fmtPct(result.economiePct)} moins cher que le thermique</span>
          </p>
        </div>

        {/* === COMPARAISON CÔTE À CÔTE Beev vs Thermique === */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border-2 border-[#3809EA]/30 bg-[#3809EA]/5 p-3 sm:p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase font-bold text-[#3809EA] tracking-wide">Solution Beev</p>
              <Sparkles className="w-3 h-3 text-[#3809EA]" />
            </div>
            <ul className="text-xs space-y-1 text-foreground">
              <li className="flex gap-1.5"><span className="text-[#3809EA] font-bold">✓</span> Recharge domicile</li>
              <li className="flex gap-1.5"><span className="text-[#3809EA] font-bold">✓</span> Itinérance kWh public</li>
              <li className="flex gap-1.5"><span className="text-[#3809EA] font-bold">✓</span> Supervision Home Charging</li>
              <li className="flex gap-1.5"><span className="text-[#3809EA] font-bold">✓</span> Borne installée incluse</li>
            </ul>
            <div className="pt-2 border-t border-[#3809EA]/20">
              <p className="text-[10px] uppercase text-muted-foreground">Total {input.dureeAnnees} ans</p>
              <p className="text-lg sm:text-xl font-bold text-[#3809EA]">{fmtEur(result.coutBeevFlotteTotal)}</p>
            </div>
          </div>

          <div className="rounded-lg border-2 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10 p-3 sm:p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 tracking-wide">Solution Thermique</p>
              <AlertCircle className="w-3 h-3 text-amber-600" />
            </div>
            <ul className="text-xs space-y-1 text-foreground">
              <li className="flex gap-1.5"><span className="text-amber-700 font-bold">⚠</span> Carburant SP95 / Diesel</li>
              <li className="flex gap-1.5"><span className="text-amber-700 font-bold">⚠</span> Pas d'optimisation</li>
              <li className="flex gap-1.5"><span className="text-amber-700 font-bold">⚠</span> Émissions CO2 directes</li>
              <li className="flex gap-1.5"><span className="text-amber-700 font-bold">⚠</span> Volatilité prix essence</li>
            </ul>
            <div className="pt-2 border-t border-amber-500/20">
              <p className="text-[10px] uppercase text-muted-foreground">Total {input.dureeAnnees} ans</p>
              <p className="text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-400">{fmtEur(result.coutCarbFlotteTotal)}</p>
            </div>
          </div>
        </div>

        {/* === 4 KPIs SECONDAIRES === */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <KpiCell label="Économie / collab / an" value={fmtEur(result.economieParCollabParAn)} accent="lavender" />
          <KpiCell label="ROI borne" value={result.roiMois > 0 && result.roiMois < 120 ? `${result.roiMois.toFixed(0)} mois` : "—"} accent="lavender" />
          <KpiCell label="CO2 évité" value={`${result.co2EviteTonnes.toFixed(1)} t`} accent="emerald" icon={<Leaf className="w-3 h-3" />} />
          <KpiCell label="Gain vs thermique" value={fmtPct(result.economiePct)} accent="emerald" />
        </div>

        {/* === INPUTS PRINCIPAUX === */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t">
          <Param label="Nb collaborateurs" value={input.nbCollabs} onChange={(n) => update({ nbCollabs: n })} step={1} />
          <Param label="Durée (années)" value={input.dureeAnnees} onChange={(n) => update({ dureeAnnees: n })} step={1} />
          <Param label="Km / an / collab" value={input.kmParAnParCollab} onChange={(n) => update({ kmParAnParCollab: n })} step={1000} />
          <Param label="Mix domicile %" value={input.mixDomicilePct} onChange={(n) => update({ mixDomicilePct: n })} step={5} suffix="%" />
        </div>

        {/* === SUPERVISION — éditable ici (panneau droit), sans passer par
            l'éditeur de textes PDF. Le coût €/mois/collab pilote le TCO ; le
            prix affiché et les fonctionnalités pilotent la slide Supervision. === */}
        <div className="rounded-lg border border-[#3809EA]/20 bg-[#3809EA]/[0.03] p-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#3809EA]">Supervision Beev Home Charging</p>
          <div className="grid grid-cols-2 gap-3">
            <Param label="Coût €/mois/collab (TCO)" value={input.supervisionParMoisParCollab} onChange={(n) => update({ supervisionParMoisParCollab: n })} step={1} />
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Prix affiché (slide PDF)</Label>
              <Input
                value={supervisionPriceDisplay}
                onChange={(e) => onSupervisionPriceDisplay(e.target.value)}
                className="h-8 text-xs"
                placeholder={DEFAULT_HOME_SUPERVISION_PRICE}
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Fonctionnalités incluses (1 par ligne)</Label>
            <Textarea
              rows={6}
              value={supervisionFeatures.join("\n")}
              onChange={(e) => onSupervisionFeatures(e.target.value.split("\n"))}
              className="text-xs mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Apparaît sur la slide Supervision du PDF. Videz le champ pour revenir au texte par défaut.</p>
          </div>
        </div>

        {/* === BLOC DÉPLIABLE — Hypothèses détaillées (replié par défaut) === */}
        <button
          type="button"
          onClick={() => setOpenDetails((v) => !v)}
          className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground border-t pt-3"
        >
          <span className="font-semibold">Hypothèses détaillées (énergie, supervision, invest)</span>
          {openDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {openDetails && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Param label="Conso élec (kWh/100)" value={input.consoElecKWh100} onChange={(n) => update({ consoElecKWh100: n })} step={0.5} />
              <Param label="Conso carb (L/100)" value={input.consoCarbL100} onChange={(n) => update({ consoCarbL100: n })} step={0.5} />
              <Param label="Prix SP95 / Diesel €/L" value={input.prixCarbL} onChange={(n) => update({ prixCarbL: n })} step={0.05} />
              <Param label="Prix kWh domicile" value={input.prixKwhDom} onChange={(n) => update({ prixKwhDom: n })} step={0.01} />
              <Param label="Prix kWh itinérance" value={input.prixKwhPub} onChange={(n) => update({ prixKwhPub: n })} step={0.01} />
              <Param label="Invest borne / collab HT" value={input.investBorneParCollabHt} onChange={(n) => update({ investBorneParCollabHt: n })} step={100} />
            </div>

            {/* Détail décomposition Beev */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <DetailBlock
                title="Décomposition Beev"
                accent="text-[#3809EA]"
                lines={[
                  ["Énergie élec totale", fmtEur(result.energieBeevFlotteTotale)],
                  ["Supervision Home Charging", fmtEur(result.supervisionFlotteTotale)],
                  ["Investissement bornes", fmtEur(result.investBorneFlotte)],
                  ["TOTAL", fmtEur(result.coutBeevFlotteTotal), true],
                ]}
              />
              <DetailBlock
                title="Décomposition thermique"
                accent="text-amber-600"
                lines={[
                  ["Carburant total", fmtEur(result.coutCarbFlotteTotal)],
                  ["—", "—"],
                  ["—", "—"],
                  ["TOTAL", fmtEur(result.coutCarbFlotteTotal), true],
                ]}
              />
            </div>

            <Button type="button" variant="ghost" size="sm" onClick={reset} className="w-full gap-2 h-7 text-xs">
              <RotateCcw className="w-3 h-3" /> Réinitialiser les hypothèses
            </Button>
          </div>
        )}

        {includeInPdf && (
          <div className="rounded-md bg-[#3809EA]/10 border border-[#3809EA]/30 p-2 text-xs flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-[#3809EA]" />
            <span>Ce calculateur sera inclus dans le PDF client (page dédiée).</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KpiCell({ label, value, accent, icon }: { label: string; value: string; accent: "lavender" | "emerald"; icon?: React.ReactNode }) {
  const colorCls = accent === "lavender"
    ? "border-[#3809EA]/30 bg-[#3809EA]/5 text-[#3809EA]"
    : "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400";
  return (
    <div className={`rounded-md border ${colorCls} p-2.5`}>
      <p className="text-[9px] uppercase text-muted-foreground tracking-wide flex items-center gap-1">
        {icon}{label}
      </p>
      <p className="text-base sm:text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}

function ResultCell({ label, value, highlight = false, suffix }: { label: string; value: string; highlight?: boolean; suffix?: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide opacity-80">{label}</p>
      <p className={`font-bold mt-1 ${highlight ? "text-2xl" : "text-xl"}`}>{value}</p>
      {suffix && <p className="text-[10px] opacity-70 mt-0.5">{suffix}</p>}
    </div>
  );
}

function Param({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string }) {
  return (
    <div>
      <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          step={step}
          className="h-8 text-xs"
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
}

function DetailBlock({ title, accent, lines }: { title: string; accent: string; lines: Array<[string, string, boolean?]> }) {
  return (
    <div className="rounded-md border bg-card p-3 space-y-1.5">
      <p className={`text-[10px] uppercase font-semibold ${accent}`}>{title}</p>
      {lines.map(([label, value, bold], i) => (
        <div key={i} className={`flex justify-between ${bold ? "border-t pt-1.5 mt-1.5 font-bold" : ""}`}>
          <span className="text-muted-foreground">{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}
