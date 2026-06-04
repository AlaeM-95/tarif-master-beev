// Calculateur TCO B2B2E (Bornes au domicile des collaborateurs).
// Compare le coût total entre recharge à domicile + supervision Beev Home
// Charging vs solution thermique classique (carburant SP95/Diesel).
//
// Affiché en mode "Bornes domicile" sur la page d'accueil, juste après
// la sélection des bornes. Les paramètres sont persistés en localStorage
// pour rester cohérents entre les sessions.

import { useEffect, useState } from "react";
import { Leaf, Calculator, Sparkles, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  calculateB2B2ETco,
  DEFAULT_B2B2E_INPUT,
  type B2B2ECalculatorInput,
  type B2B2ECalculatorResult,
} from "@/lib/tco-calculator";

const STORAGE_KEY = "beev_b2b2e_input_v1";

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
};

export function B2B2ECalculator({ input, update, reset, includeInPdf, setIncludeInPdf }: Props) {
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
        {/* === BLOC RÉSULTAT EN GRAND === */}
        <div className="rounded-lg bg-gradient-to-br from-[#3809EA] to-[#5B3FFF] text-white p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ResultCell
            label="ÉCONOMIE / COLLAB / AN"
            value={fmtEur(result.economieParCollabParAn)}
            highlight
          />
          <ResultCell label="ÉCONOMIE FLOTTE / AN" value={fmtEur(result.economieFlotteAnnuelle)} />
          <ResultCell
            label={`SUR ${input.dureeAnnees} ANS`}
            value={fmtEur(result.economieFlotteTotale)}
          />
          <ResultCell label="GAIN" value={fmtPct(result.economiePct)} suffix="vs thermique" />
        </div>

        {/* Ligne secondaire : ROI + CO2 évité */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-md border border-[#3809EA]/20 bg-[#3809EA]/5 p-3">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">ROI investissement borne</p>
            <p className="text-lg font-bold text-[#3809EA] mt-1">
              {result.roiMois > 0 && result.roiMois < 120 ? `${result.roiMois.toFixed(0)} mois` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">avant amortissement</p>
          </div>
          <div className="rounded-md border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-3">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide flex items-center gap-1">
              <Leaf className="w-3 h-3" /> CO₂ évité sur la durée
            </p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">
              {result.co2EviteTonnes.toFixed(1)} t
            </p>
            <p className="text-[10px] text-muted-foreground">estimation 135 g CO₂/km thermique évité</p>
          </div>
        </div>

        {/* === INPUTS PRINCIPAUX === */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Param label="Nb collaborateurs" value={input.nbCollabs} onChange={(n) => update({ nbCollabs: n })} step={1} />
          <Param label="Durée (années)" value={input.dureeAnnees} onChange={(n) => update({ dureeAnnees: n })} step={1} />
          <Param label="Km / an / collab" value={input.kmParAnParCollab} onChange={(n) => update({ kmParAnParCollab: n })} step={1000} />
          <Param label="Mix domicile %" value={input.mixDomicilePct} onChange={(n) => update({ mixDomicilePct: n })} step={5} suffix="%" />
        </div>

        {/* === BLOC DÉPLIABLE — Hypothèses détaillées === */}
        <button
          type="button"
          onClick={() => setOpenDetails((v) => !v)}
          className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground border-t pt-3"
        >
          <span className="font-semibold">Hypothèses détaillées</span>
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
              <Param label="Supervision €/mois/collab" value={input.supervisionParMoisParCollab} onChange={(n) => update({ supervisionParMoisParCollab: n })} step={1} />
              <Param label="Invest borne / collab HT" value={input.investBorneParCollabHt} onChange={(n) => update({ investBorneParCollabHt: n })} step={100} />
            </div>

            {/* Détail comparaison côte à côte */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <DetailBlock
                title="Solution Beev (recharge domicile + itinérance)"
                accent="text-[#3809EA]"
                lines={[
                  ["Énergie élec totale", fmtEur(result.energieBeevFlotteTotale)],
                  ["Supervision Beev Home Charging", fmtEur(result.supervisionFlotteTotale)],
                  ["Investissement bornes (amorti)", fmtEur(result.investBorneFlotte)],
                  ["TOTAL", fmtEur(result.coutBeevFlotteTotal), true],
                ]}
              />
              <DetailBlock
                title="Solution thermique (référence)"
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
