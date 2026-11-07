// Constructeur de flotte (Mode Flotte v2) — pour chiffrer 50/80/100+ véhicules.
//
// Import car policy → regroupement par modèle (quantités) → enrichissement
// depuis le catalogue (specs/image, loyer de l'Excel conservé) → km/durée PAR
// véhicule (extraits de l'Excel, éditables) → auto-association EV les moins
// chers du segment → économie en direct → ajout en masse. Lignes
// supprimables / duplicables.

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Zap, RotateCcw, Check, Copy, Trash2, Pencil, X, Sparkles, AlertTriangle, Car, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/image-upload";
import { smartImportCarPolicy } from "@/lib/smart-import";
import { LocalAiPanel } from "@/components/local-ai-panel";
import { buildFleetLines, effectiveLoyer, evOptionsForLine, explainReco, isLoyerEstimated, normCategory, recommendEvs } from "@/lib/fleet";
import { summarizeFleetBrands } from "@/lib/brand-analysis";
import { calculateTcoFull } from "@/lib/tco-calculator";
import { completeVehicle, fillMissingRanges, loadVehicleReference, type VehicleReference } from "@/lib/vehicle-reference";
import type { Vehicle, Energy } from "@/lib/catalog";

export type FleetSelection = { current: Vehicle; quantity: number; evs: Vehicle[]; kmPerYear: number; durationMonths: number };
type Line = {
  current: Vehicle;
  quantity: number;
  recommendations: Vehicle[];
  selectedIds: string[];
  km: number;
  durationMonths: number;
};
type FleetEnergy = { fuelPriceL: number; kWhHome: number; kWhPublic: number; kmPerYear: number; durationYears: number };

/** Petit champ étiqueté pour l'éditeur de véhicule importé. */
function Fld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** Pastille de couleur par énergie (aide à lire d'un coup d'œil thermique / hybride / électrique). */
const ENERGY_DOT: Record<string, string> = {
  "Électrique": "bg-emerald-500",
  "Hybride Rechargeable": "bg-teal-500",
  "Hybride": "bg-sky-500",
  "Mild Hybrid": "bg-sky-400",
  "Essence": "bg-amber-500",
  "Diesel": "bg-stone-500",
};

const SPEC_LABELS: Record<string, string> = {
  co2: "CO₂", fiscalHp: "CV fiscaux", powerHp: "puissance", consumption: "conso", poidsVide: "poids",
  rangeWltp: "autonomie", batteryKwh: "batterie", chargeDcMaxKw: "recharge DC", chargeAcMaxKw: "recharge AC",
  trunkLitres: "coffre", dimensions: "dimensions", envScore: "score env.", cargoVolumeM3: "volume utile",
  chargeTime2080Ac: "recharge AC 20-80 %", chargeTime2080Dc: "recharge DC 20-80 %", image: "photo",
};

/** Ligne de la liste « + autre modèle… » : modèle, autonomie et loyer s'il existe. */
const evOption = (ev: Vehicle) => (
  <option key={ev.id} value={ev.id}>
    {ev.brand} {ev.model}{ev.version ? ` ${ev.version}` : ""} — {ev.rangeWltp > 0 ? `${Math.round(ev.rangeWltp)} km` : "autonomie n.c."}
    {effectiveLoyer(ev) > 0 ? ` · ${isLoyerEstimated(ev) ? "≈ " : ""}${fmtEur(effectiveLoyer(ev))}/mois` : ""}
  </option>
);

const fmtEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

export function FleetBuilder({
  catalogueVehicles,
  energy,
  onBulkAdd,
}: {
  catalogueVehicles: Vehicle[];
  energy: FleetEnergy;
  onBulkAdd: (sel: FleetSelection[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  // Données ouvertes (Open EV Data) : complètent l'autonomie des EV du catalogue
  // qui n'en ont pas, pour le classement par autonomie (copie, base inchangée).
  const [ref, setRef] = useState<VehicleReference | null>(null);
  useEffect(() => {
    let alive = true;
    void loadVehicleReference().then((r) => { if (alive) setRef(r); });
    return () => { alive = false; };
  }, []);
  const catalogue = useMemo(() => fillMissingRanges(catalogueVehicles, ref), [catalogueVehicles, ref]);
  const [lines, setLines] = useState<Line[]>([]);
  const [importing, setImporting] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  // Valeurs « appliquer à toute la flotte » (raccourci, pas une contrainte).
  const defKm = Math.round(energy.kmPerYear) || 20000;
  const defDur = Math.round((energy.durationYears || 4) * 12) || 48;
  const [bulkKm, setBulkKm] = useState<number>(defKm);
  const [bulkDur, setBulkDur] = useState<number>(defDur);

  const allEvs = catalogue
    .filter((v) => v.energy === "Électrique")
    .sort((a, b) => (b.rangeWltp || 0) - (a.rangeWltp || 0));

  const tcoAn = (v: Vehicle, loyer: number, km: number, durMonths: number) => {
    const duree = durMonths / 12;
    const r = calculateTcoFull(
      v,
      { dureeAnnees: duree, kmContrat: km * duree, prixEssenceLitre: energy.fuelPriceL, prixKwhDomicile: energy.kWhHome, prixKwhPublic: energy.kWhPublic, optionsTotalTtc: 0, remisePctOverride: v.remise },
      loyer,
    );
    return r.tcoAnnuel;
  };
  const lineEv = (l: Line): Vehicle | undefined =>
    l.recommendations.find((r) => l.selectedIds.includes(r.id)) ?? l.recommendations[0];
  const lineEcoPerVeh = (l: Line): number => {
    const ev = lineEv(l);
    if (!ev) return 0;
    const evLoyer = effectiveLoyer(ev); // loyer estimé si aucun loyer au catalogue
    const currentLoyer = l.current.monthlyLld > 0 ? l.current.monthlyLld : evLoyer;
    return Math.max(0, tcoAn(l.current, currentLoyer, l.km, l.durationMonths) - tcoAn(ev, evLoyer, l.km, l.durationMonths));
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const categories = catalogueVehicles.map((v) => v.category);
      const report = await smartImportCarPolicy(file, { categories, catalogue: catalogueVehicles });
      if (report.vehicles.length === 0) {
        toast.error("Aucun véhicule détecté. Vérifiez les colonnes marque / modèle.");
      } else {
        // Référence chargée avant de classer (l'effet de montage peut ne pas être fini).
        const cat = fillMissingRanges(catalogueVehicles, await loadVehicleReference());
        const built = buildFleetLines(report.vehicles, cat, 3);
        setLines(built.map((l) => ({
          current: l.current,
          quantity: l.quantity,
          recommendations: l.recommendations,
          selectedIds: l.recommendations[0] ? [l.recommendations[0].id] : [],
          km: l.kmPerYear && l.kmPerYear > 0 ? Math.round(l.kmPerYear) : defKm,
          durationMonths: l.durationMonths && l.durationMonths > 0 ? Math.round(l.durationMonths) : defDur,
        })));
        toast.success(`${report.importedRows} véhicules · ${built.length} modèles regroupés · lecture locale`);
        if (report.warnings.length) toast.warning(report.warnings.slice(0, 2).join(" — "));
      }
    } catch (err) {
      toast.error(`Import impossible : ${err instanceof Error ? err.message : "fichier illisible"}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const patchLine = (idx: number, p: Partial<Line>) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...p } : l)));
  const toggleEv = (idx: number, id: string) =>
    setLines((ls) => ls.map((l, i) => {
      if (i !== idx) return l;
      const on = l.selectedIds.includes(id);
      return { ...l, selectedIds: on ? l.selectedIds.filter((x) => x !== id) : [...l.selectedIds, id] };
    }));
  const addCustomEv = (idx: number, evId: string) => {
    const ev = allEvs.find((v) => v.id === evId);
    if (!ev) return;
    setLines((ls) => ls.map((l, i) => {
      if (i !== idx) return l;
      const recos = l.recommendations.some((r) => r.id === ev.id) ? l.recommendations : [...l.recommendations, ev];
      return { ...l, recommendations: recos, selectedIds: l.selectedIds.includes(ev.id) ? l.selectedIds : [...l.selectedIds, ev.id] };
    }));
  };
  const deleteLine = (idx: number) => { setEditingIdx(null); setLines((ls) => ls.filter((_, i) => i !== idx)); };
  const duplicateLine = (idx: number) => { setEditingIdx(null); setLines((ls) => [...ls.slice(0, idx + 1), { ...ls[idx], current: { ...ls[idx].current, id: `fleet-${idx}-${ls.length}` }, selectedIds: [...ls[idx].selectedIds] }, ...ls.slice(idx + 1)]); };
  const applyToAll = () => setLines((ls) => ls.map((l) => ({ ...l, km: bulkKm, durationMonths: bulkDur })));

  // Édition d'un véhicule importé : on patche le `current` de la ligne.
  // Complète les champs vides du véhicule édité depuis le catalogue Beev et les données ouvertes.
  const completeCurrent = async (idx: number) => {
    const { patch, fields, found, matched } = await completeVehicle(lines[idx].current, catalogueVehicles);
    if (found) {
      patchCurrent(idx, patch);
      toast.success(`${fields.length} champ${fields.length > 1 ? "s" : ""} complété${fields.length > 1 ? "s" : ""} : ${fields.join(", ")}`);
    } else if (matched) {
      toast.info(`Rien à compléter pour ${lines[idx].current.brand} ${lines[idx].current.model} : les données disponibles sont déjà reprises, les champs restants n'existent dans aucune source.`);
    } else {
      toast.info(`Aucune donnée trouvée pour ${lines[idx].current.brand} ${lines[idx].current.model}. Vérifiez la marque et le modèle, ou saisissez les champs.`);
    }
  };
  const patchCurrent = (idx: number, p: Partial<Vehicle>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, current: { ...l.current, ...p } as Vehicle } : l)));
  // Recalcule les EV proposés depuis le segment/loyer du véhicule actuel modifié.
  const reSuggest = (idx: number) =>
    setLines((ls) => ls.map((l, i) => {
      if (i !== idx) return l;
      const recos = recommendEvs(l.current, catalogue, 3);
      return { ...l, recommendations: recos, selectedIds: recos[0] ? [recos[0].id] : [] };
    }));

  const totalVeh = lines.reduce((s, l) => s + l.quantity, 0);
  // Analyse des marques du parc : gamme et groupes, pondérés par la quantité.
  const brandSummary = useMemo(() => summarizeFleetBrands(lines.map((l) => ({ brand: l.current.brand, quantity: l.quantity }))), [lines]);
  const segments = new Set(lines.map((l) => normCategory(l.current.category) || "—")).size;
  const totalEcoAn = lines.reduce((s, l) => s + lineEcoPerVeh(l) * l.quantity, 0);

  const addAll = () => {
    const sel: FleetSelection[] = lines
      .map((l) => ({ current: l.current, quantity: l.quantity, evs: l.recommendations.filter((r) => l.selectedIds.includes(r.id)), kmPerYear: l.km, durationMonths: l.durationMonths }))
      .filter((s) => s.evs.length > 0);
    if (sel.length === 0) { toast.error("Sélectionnez au moins un véhicule électrique par ligne."); return; }
    onBulkAdd(sel);
  };

  return (
    <Card className="border-[#3809EA]/20">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Constructeur de flotte</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Importez la car policy, quel que soit son format : chaque véhicule est reconnu (marque, modèle, énergie, segment) par un dictionnaire de modèles et des règles de motorisation, avec une IA locale facultative pour les libellés inconnus. Tout se passe dans votre navigateur : aucune donnée n'est envoyée. Les véhicules sont regroupés, puis des EV du même segment issus du catalogue sont proposés. Loyer, km et durée de l'Excel sont conservés.
          </p>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
        <Button variant="outline" size="sm" className="gap-2 flex-shrink-0" disabled={importing} onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4" /> {importing ? "Import…" : "Importer car policy"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        <LocalAiPanel />
        {lines.length === 0 ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-[#3809EA]/30 bg-[#3809EA]/[0.03] py-10 flex flex-col items-center gap-2 text-sm text-muted-foreground hover:bg-[#3809EA]/[0.06] transition"
          >
            <FileSpreadsheet className="w-8 h-8 text-[#3809EA]/60" />
            <span>Glissez ou cliquez pour importer un fichier <b>.xlsx / .csv</b></span>
            <span className="text-[11px]">N'importe quel format : colonnes libres, texte du type « Peugeot 308 SW 1.5 BlueHDi », ou liste sans en-têtes. Lecture 100 % dans votre navigateur.</span>
          </button>
        ) : (
          <>
            <div className="rounded-lg bg-[#3809EA]/[0.05] border border-[#3809EA]/20 p-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Économie estimée flotte / an</span>
                <span className="text-xl font-bold text-[#3809EA]">{totalEcoAn > 0 ? `− ${fmtEur(totalEcoAn)}` : "—"}</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Label className="text-[10px] uppercase text-muted-foreground">Km/an</Label>
                <Input type="number" value={bulkKm} step={1000} onChange={(e) => setBulkKm(Math.max(0, Number(e.target.value) || 0))} className="h-8 w-24 text-xs" />
                <Label className="text-[10px] uppercase text-muted-foreground">Durée</Label>
                <Input type="number" value={bulkDur} step={1} onChange={(e) => setBulkDur(Math.max(1, Number(e.target.value) || 1))} className="h-8 w-16 text-xs" />
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={applyToAll}>Appliquer à tous</Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge className="bg-[#3809EA] text-white">{totalVeh} véhicules</Badge>
              <Badge variant="outline">{lines.length} modèles · {segments} segments</Badge>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 ml-auto" onClick={() => setLines([])}>
                <RotateCcw className="w-3 h-3" /> Réinitialiser
              </Button>
            </div>

            <div className="rounded-xl border bg-white p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-xs font-semibold">Analyse des marques du parc</p>
                {brandSummary.groups.length > 0 && <p className="text-[10px] text-muted-foreground">Groupes : {brandSummary.groups.join(", ")}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {brandSummary.byBrand.slice(0, 6).map((b) => (
                  <span key={b.brand} className="rounded-full border bg-muted/40 px-2.5 py-1 text-[11px]">
                    <span className="font-semibold">{b.brand}</span> <span className="tabular-nums text-muted-foreground">{b.pct} %</span>
                  </span>
                ))}
                {brandSummary.byBrand.length > 6 && <span className="text-[10px] text-muted-foreground">+{brandSummary.byBrand.length - 6} autre{brandSummary.byBrand.length - 6 > 1 ? "s" : ""}</span>}
                <span className="mx-1 h-4 w-px bg-border" />
                {brandSummary.byTier.map((t) => (
                  <span key={t.tier} className="rounded-full bg-[#3809EA]/[0.07] px-2.5 py-1 text-[11px] text-[#3809EA]">
                    {t.label} <span className="font-semibold tabular-nums">{t.pct} %</span>
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Les électriques proposés restent dans la gamme de la marque actuelle (un niveau d'écart au plus) : un parc Peugeot ne reçoit pas de Mercedes. La même marque, puis le même groupe, passent en premier.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full min-w-[860px] table-fixed text-xs">
                <colgroup>
                  <col style={{ width: 330 }} />
                  <col />
                  <col style={{ width: 128 }} />
                  <col style={{ width: 96 }} />
                </colgroup>
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40">
                    <th className="px-4 py-2.5 font-semibold">Véhicule actuel et contrat</th>
                    <th className="px-3 py-2.5 font-semibold">Électriques recommandés <span className="normal-case tracking-normal font-normal">(cliquez pour retenir)</span></th>
                    <th className="px-3 py-2.5 font-semibold text-right">Économie annuelle</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const eco = lineEcoPerVeh(l);
                    const editing = editingIdx === i;
                    // Liste manuelle : segment de la ligne uniquement (déjà proposés exclus).
                    const opts = evOptionsForLine(l.current, catalogue, l.recommendations.map((r) => r.id));
                    const cur = l.current;
                    const best = lineEv(l);
                    const estimated = !!best && isLoyerEstimated(best);
                    return (
                    <Fragment key={i}>
                      <tr className={`border-t align-top transition-colors ${editing ? "bg-[#3809EA]/[0.04]" : "hover:bg-muted/20"}`}>
                        {/* Véhicule actuel + contrat */}
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-3">
                            <div className="h-11 w-16 shrink-0 overflow-hidden rounded-lg border bg-white flex items-center justify-center">
                              {cur.image ? <img src={cur.image} alt="" className="h-full w-full object-contain" /> : <Car className="w-5 h-5 text-muted-foreground/60" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">{cur.brand}</p>
                              <p className="mt-1 text-sm font-semibold leading-tight truncate" title={`${cur.brand} ${cur.model}`}>{cur.model}</p>
                              {cur.version && <p className="mt-0.5 text-[11px] text-muted-foreground truncate" title={cur.version}>{cur.version}</p>}
                            </div>
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2 py-0.5 text-[10px] font-medium">
                              <span className={`h-1.5 w-1.5 rounded-full ${ENERGY_DOT[cur.energy] ?? "bg-stone-400"}`} />{cur.energy}
                            </span>
                            {cur.category && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{cur.category}</span>}
                            {cur.monthlyLld > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground tabular-nums">{fmtEur(cur.monthlyLld)}/mois</span>}
                          </div>

                          <div className="mt-3 grid grid-cols-[64px_1fr_72px] gap-2">
                            <label className="space-y-1">
                              <span className="block text-[10px] text-muted-foreground">Quantité</span>
                              <Input type="number" value={l.quantity} min={1} onChange={(e) => patchLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} className="h-8 px-2 text-center text-xs tabular-nums" />
                            </label>
                            <label className="space-y-1">
                              <span className="block text-[10px] text-muted-foreground">Km par an</span>
                              <Input type="number" value={l.km} step={1000} onChange={(e) => patchLine(i, { km: Math.max(0, Number(e.target.value) || 0) })} className="h-8 px-2 text-center text-xs tabular-nums" />
                            </label>
                            <label className="space-y-1">
                              <span className="block text-[10px] text-muted-foreground">Durée (mois)</span>
                              <Input type="number" value={l.durationMonths} step={1} onChange={(e) => patchLine(i, { durationMonths: Math.max(1, Number(e.target.value) || 1) })} className="h-8 px-2 text-center text-xs tabular-nums" />
                            </label>
                          </div>

                          {(cur.aiMeta || cur.specsMeta) && (
                            <div className="mt-3 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {cur.aiMeta && (cur.aiMeta.confidence >= 0.7 ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-medium" title={[cur.aiMeta.note, cur.aiMeta.inferred.length ? `${cur.aiMeta.source === "llm" ? "Identifié par l'IA locale" : "Déduit du libellé"} : ${cur.aiMeta.inferred.join(", ")}` : ""].filter(Boolean).join(" — ") || undefined}>
                                    {cur.aiMeta.source === "llm" ? <Sparkles className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                                    {cur.aiMeta.source === "llm" ? "IA locale" : "Reconnu"} · {Math.round(cur.aiMeta.confidence * 100)} %
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold" title={cur.aiMeta.note}>
                                    <AlertTriangle className="w-3 h-3" />À vérifier · {Math.round(cur.aiMeta.confidence * 100)} %
                                  </span>
                                ))}
                                {cur.specsMeta && cur.specsMeta.approx && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 px-2 py-0.5 text-[10px]" title="La finition exacte n'a pas été identifiée : valeurs d'une finition voisine.">
                                    <AlertTriangle className="w-3 h-3" />Version approchée
                                  </span>
                                )}
                              </div>
                              {cur.specsMeta && (
                                <details className="group rounded-lg border bg-muted/30 px-2.5 py-1.5">
                                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] text-muted-foreground select-none">
                                    <span>
                                      <span className="font-medium text-foreground">{cur.specsMeta.fields.length} champ{cur.specsMeta.fields.length > 1 ? "s" : ""} complété{cur.specsMeta.fields.length > 1 ? "s" : ""}</span>
                                      {" · "}{cur.specsMeta.sources.join(", ")}
                                    </span>
                                    <ChevronDown className="w-3 h-3 shrink-0 transition-transform group-open:rotate-180" />
                                  </summary>
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {cur.specsMeta.fields.map((f) => (
                                      <span key={f} className="rounded-full bg-white border px-1.5 py-0.5 text-[10px] text-muted-foreground">{SPEC_LABELS[f] ?? f}</span>
                                    ))}
                                  </div>
                                  {cur.specsMeta.label && <p className="mt-1.5 text-[10px] text-muted-foreground">{cur.specsMeta.label}</p>}
                                  {cur.specsMeta.warn && <p className="mt-1.5 text-[10px] text-amber-700">{cur.specsMeta.warn}</p>}
                                </details>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Électriques recommandés */}
                        <td className="px-3 py-4">
                          <div className="flex flex-col gap-1.5">
                            {l.recommendations.map((ev, rIdx) => {
                              const on = l.selectedIds.includes(ev.id);
                              const rangeEstimated = !!ev.specsMeta?.fields.includes("rangeWltp");
                              return (
                                <button
                                  key={ev.id}
                                  type="button"
                                  onClick={() => toggleEv(i, ev.id)}
                                  title={[rangeEstimated ? `Autonomie issue de ${ev.specsMeta?.label}` : "", ev.monthlyLld > 0 ? "" : "Aucun loyer au catalogue : à chiffrer avec une offre loueur"].filter(Boolean).join(" — ") || undefined}
                                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${on ? "border-[#3809EA] bg-[#3809EA]/[0.06] ring-1 ring-[#3809EA]/25" : "bg-white hover:border-[#3809EA]/40 hover:bg-muted/30"}`}
                                >
                                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${on ? "border-[#3809EA] bg-[#3809EA] text-white" : "border-border bg-white"}`}>
                                    {on && <Check className="w-2.5 h-2.5" />}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5">
                                      <span className="truncate text-[13px] font-semibold">{ev.brand} {ev.model}</span>
                                      {rIdx === 0 && <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#3809EA]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#3809EA]"><Zap className="w-2.5 h-2.5" />Recommandé</span>}
                                    </span>
                                    {ev.version && <span className="block truncate text-[11px] text-muted-foreground">{ev.version}</span>}
                                  </span>
                                  <span className="shrink-0 text-right leading-tight tabular-nums">
                                    <span className="block text-[13px] font-semibold">{ev.rangeWltp > 0 ? `${rangeEstimated ? "≈ " : ""}${Math.round(ev.rangeWltp)} km` : "—"}</span>
                                    {ev.monthlyLld > 0 && <span className="block text-[11px] text-muted-foreground">{fmtEur(ev.monthlyLld)}/mois</span>}
                                  </span>
                                </button>
                              );
                            })}
                            <select
                              value=""
                              onChange={(e) => { if (e.target.value) addCustomEv(i, e.target.value); }}
                              className="h-9 w-full rounded-lg border border-dashed border-border bg-white px-3 text-[12px] text-muted-foreground hover:border-[#3809EA]/40"
                              title="Ajouter un autre modèle du catalogue"
                            >
                              <option value="">{`+ Ajouter un autre modèle${opts.segmentEmpty ? " (aucun EV dans ce segment : tout le catalogue)" : ` ${cur.category ? `du segment ${cur.category}` : "du segment"}`}…`}</option>
                              {opts.inRange.length > 0 && (
                                <optgroup label="Même segment · gamme comparable">{opts.inRange.map(evOption)}</optgroup>
                              )}
                              {opts.outOfRange.length > 0 && (
                                <optgroup label="Même segment · gamme différente (déconseillé)">{opts.outOfRange.map(evOption)}</optgroup>
                              )}
                            </select>
                          </div>
                          {best && (
                            <div className="mt-2.5 flex flex-wrap items-center gap-1">
                              <span className="text-[10px] text-muted-foreground mr-0.5">Pourquoi {best.brand} {best.model} :</span>
                              {explainReco(cur, best, catalogue).map((r) => (
                                <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{r}</span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Économie */}
                        <td className="px-3 py-4 text-right" title={estimated ? "Calculé avec un loyer estimé pour l'EV : à confirmer avec une offre loueur" : undefined}>
                          {eco > 0 ? (
                            <>
                              <p className="text-base font-bold leading-none text-[#3809EA] tabular-nums">{estimated ? "≈ " : ""}− {fmtEur(eco)}</p>
                              <p className="mt-1 text-[10px] text-muted-foreground">par véhicule</p>
                              {l.quantity > 1 && (
                                <p className="mt-2 rounded-md bg-[#3809EA]/[0.07] px-1.5 py-1 text-[11px] font-semibold text-[#3809EA] tabular-nums">
                                  {fmtEur(eco * l.quantity)} <span className="font-normal text-muted-foreground">× {l.quantity}</span>
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-muted-foreground">—</p>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-2 py-4">
                          <div className="flex items-center justify-end gap-0.5">
                            <button type="button" title="Modifier ce véhicule" onClick={() => setEditingIdx(editing ? null : i)} className={`h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-muted ${editing ? "bg-[#3809EA] text-white hover:bg-[#3809EA]" : "text-foreground/70"}`}><Pencil className="w-3.5 h-3.5" /></button>
                            <button type="button" title="Dupliquer cette ligne" onClick={() => duplicateLine(i)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#3809EA] hover:bg-muted"><Copy className="w-3.5 h-3.5" /></button>
                            <button type="button" title="Supprimer cette ligne" onClick={() => deleteLine(i)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-destructive hover:bg-muted"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                      {editing && (
                        <tr className="border-t bg-[#3809EA]/[0.04]">
                          <td colSpan={4} className="px-3 py-3">
                            <div className="rounded-lg border border-[#3809EA]/20 bg-white p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-[#3809EA] uppercase tracking-wide">Modifier le véhicule importé</span>
                                <button type="button" onClick={() => setEditingIdx(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                <Fld label="Marque"><Input value={l.current.brand} onChange={(e) => patchCurrent(i, { brand: e.target.value })} className="h-8 text-xs" /></Fld>
                                <Fld label="Modèle"><Input value={l.current.model} onChange={(e) => patchCurrent(i, { model: e.target.value })} className="h-8 text-xs" /></Fld>
                                <Fld label="Version"><Input value={l.current.version} onChange={(e) => patchCurrent(i, { version: e.target.value })} className="h-8 text-xs" /></Fld>
                                <Fld label="Énergie">
                                  <select value={l.current.energy} onChange={(e) => patchCurrent(i, { energy: e.target.value as Energy })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                                    {(["Essence","Diesel","Hybride","Mild Hybrid","Hybride Rechargeable","Électrique"] as Energy[]).map((en) => <option key={en} value={en}>{en}</option>)}
                                  </select>
                                </Fld>
                                <Fld label="Segment"><Input value={l.current.category} onChange={(e) => patchCurrent(i, { category: e.target.value })} className="h-8 text-xs" placeholder="SUV, berline…" /></Fld>
                                <Fld label="Loyer €/mois (Excel)"><Input type="number" value={l.current.monthlyLld || 0} onChange={(e) => patchCurrent(i, { monthlyLld: Math.max(0, Number(e.target.value) || 0) })} className="h-8 text-xs" /></Fld>
                                <Fld label="Prix TTC €"><Input type="number" value={l.current.priceTtc || 0} onChange={(e) => patchCurrent(i, { priceTtc: Math.max(0, Number(e.target.value) || 0) })} className="h-8 text-xs" /></Fld>
                                <Fld label="CO₂ g/km"><Input type="number" value={l.current.co2 || 0} onChange={(e) => patchCurrent(i, { co2: Math.max(0, Number(e.target.value) || 0) })} className="h-8 text-xs" /></Fld>
                                <Fld label="Conso (L ou kWh /100)"><Input type="number" value={l.current.consumption || 0} onChange={(e) => patchCurrent(i, { consumption: Math.max(0, Number(e.target.value) || 0) })} className="h-8 text-xs" /></Fld>
                                <Fld label="Puissance ch"><Input type="number" value={l.current.powerHp || 0} onChange={(e) => patchCurrent(i, { powerHp: Math.max(0, Number(e.target.value) || 0) })} className="h-8 text-xs" /></Fld>
                                <Fld label="CV fiscaux"><Input type="number" value={l.current.fiscalHp || 0} onChange={(e) => patchCurrent(i, { fiscalHp: Math.max(0, Number(e.target.value) || 0) })} className="h-8 text-xs" /></Fld>
                                <Fld label="Poids vide kg"><Input type="number" value={l.current.poidsVide || 0} onChange={(e) => patchCurrent(i, { poidsVide: Math.max(0, Number(e.target.value) || 0) })} className="h-8 text-xs" /></Fld>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                                <ImageUpload currentUrl={l.current.image} onChange={(url) => patchCurrent(i, { image: url })} folder="vehicles" label="Photo du véhicule" />
                                <div className="flex flex-wrap gap-2 mb-0.5">
                                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => void completeCurrent(i)}>
                                    <Sparkles className="w-3.5 h-3.5 text-[#3809EA]" /> Compléter les champs vides
                                  </Button>
                                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => reSuggest(i)}>
                                    <Zap className="w-3.5 h-3.5 text-[#3809EA]" /> Re-proposer les EV du segment
                                  </Button>
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground">Si vous changez la marque, le modèle ou le segment, cliquez sur « Re-proposer les EV » pour rafraîchir les suggestions.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-muted-foreground">Km/an et durée sont repris de l'Excel par véhicule (modifiables). Économie = énergie + fiscalité évitées vs le thermique, à loyer comparable.</p>
              <Button className="gap-2 flex-shrink-0" onClick={addAll}>
                <Check className="w-4 h-4" /> Ajouter toute la flotte au devis
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
