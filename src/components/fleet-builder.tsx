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
import { Upload, FileSpreadsheet, Zap, RotateCcw, Check, Copy, Trash2, Pencil, X, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/image-upload";
import { smartImportCarPolicy } from "@/lib/smart-import";
import { LocalAiPanel } from "@/components/local-ai-panel";
import { buildFleetLines, effectiveLoyer, explainReco, isLoyerEstimated, normCategory, recommendEvs } from "@/lib/fleet";
import { calculateTcoFull } from "@/lib/tco-calculator";
import { fillMissingRanges, loadVehicleReference, type VehicleReference } from "@/lib/vehicle-reference";
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

const SPEC_LABELS: Record<string, string> = {
  co2: "CO₂", fiscalHp: "CV fiscaux", powerHp: "puissance", consumption: "conso", poidsVide: "poids",
  rangeWltp: "autonomie", batteryKwh: "batterie", chargeDcMaxKw: "recharge DC", chargeAcMaxKw: "recharge AC",
  trunkLitres: "coffre", dimensions: "dimensions",
};

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
      const report = await smartImportCarPolicy(file, { categories });
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

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-semibold">Véhicule actuel</th>
                    <th className="px-2 py-2 font-semibold w-12">Qté</th>
                    <th className="px-2 py-2 font-semibold w-16">Km/an</th>
                    <th className="px-2 py-2 font-semibold w-14">Durée</th>
                    <th className="px-3 py-2 font-semibold">EV recommandés (cliquez pour retenir)</th>
                    <th className="px-2 py-2 font-semibold w-20 text-right">Éco/véh/an</th>
                    <th className="px-2 py-2 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const eco = lineEcoPerVeh(l);
                    const editing = editingIdx === i;
                    return (
                    <Fragment key={i}>
                      <tr className={`border-t align-top ${editing ? "bg-[#3809EA]/[0.04]" : ""}`}>
                        <td className="px-3 py-2.5">
                          <div className="font-medium flex items-center gap-1.5">
                            {l.current.image ? (
                              <img src={l.current.image} alt="" className="h-6 w-9 rounded object-cover border" />
                            ) : null}
                            {l.current.brand} {l.current.model}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{l.current.energy}{l.current.category ? ` · ${l.current.category}` : ""}{l.current.version ? ` · ${l.current.version}` : ""}{l.current.monthlyLld > 0 ? ` · ${fmtEur(l.current.monthlyLld)}/mois` : ""}</div>
                          {l.current.specsMeta && (
                            <div className="mt-1 text-[10px] text-muted-foreground" title={l.current.specsMeta.label}>
                              Données {l.current.specsMeta.sources.join(" + ")} : {l.current.specsMeta.fields.map((f) => SPEC_LABELS[f] ?? f).join(", ")}{l.current.specsMeta.approx ? " (version approchée)" : ""}
                              {l.current.specsMeta.warn && <span className="block text-amber-700">{l.current.specsMeta.warn}</span>}
                            </div>
                          )}
                          {l.current.aiMeta && (
                            <div className="mt-1 flex flex-wrap items-center gap-1" title={[l.current.aiMeta.note, l.current.aiMeta.inferred.length ? `${l.current.aiMeta.source === "llm" ? "Identifié par l'IA locale" : "Déduit du libellé"} : ${l.current.aiMeta.inferred.join(", ")}` : ""].filter(Boolean).join(" — ") || undefined}>
                              {l.current.aiMeta.confidence >= 0.7 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#3809EA]/10 text-[#3809EA] px-1.5 py-0.5 text-[9px] font-semibold">{l.current.aiMeta.source === "llm" ? <Sparkles className="w-2.5 h-2.5" /> : <Check className="w-2.5 h-2.5" />}{l.current.aiMeta.source === "llm" ? "Identifié par l'IA locale" : "Reconnu automatiquement"} · {Math.round(l.current.aiMeta.confidence * 100)} %</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] font-semibold"><AlertTriangle className="w-2.5 h-2.5" />À vérifier · {Math.round(l.current.aiMeta.confidence * 100)} %</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2.5"><Input type="number" value={l.quantity} min={1} onChange={(e) => patchLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} className="h-8 w-12 text-xs" /></td>
                        <td className="px-2 py-2.5"><Input type="number" value={l.km} step={1000} onChange={(e) => patchLine(i, { km: Math.max(0, Number(e.target.value) || 0) })} className="h-8 w-16 text-xs" /></td>
                        <td className="px-2 py-2.5"><Input type="number" value={l.durationMonths} step={1} onChange={(e) => patchLine(i, { durationMonths: Math.max(1, Number(e.target.value) || 1) })} className="h-8 w-14 text-xs" /></td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {l.recommendations.map((ev, rIdx) => {
                              const on = l.selectedIds.includes(ev.id);
                              return (
                                <button key={ev.id} type="button" onClick={() => toggleEv(i, ev.id)}
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition ${on ? "bg-[#3809EA] text-white border-[#3809EA]" : "bg-white hover:bg-muted border-border"}`}>
                                  {on ? <Check className="w-3 h-3" /> : (rIdx === 0 ? <Zap className="w-3 h-3 text-[#3809EA]" /> : null)}
                                  <span className="font-medium">{ev.brand} {ev.model}</span>
                                  {ev.version && <span className={on ? "text-white/70" : "text-muted-foreground"}>{ev.version.length > 18 ? ev.version.slice(0, 18) + "…" : ev.version}</span>}
                                  <span className={`font-semibold ${on ? "text-white/90" : "text-foreground/80"}`} title={[ev.specsMeta?.fields.includes("rangeWltp") ? `Autonomie issue de ${ev.specsMeta.label}` : "", ev.monthlyLld > 0 ? "" : "Aucun loyer au catalogue : à chiffrer avec une offre loueur"].filter(Boolean).join(" — ") || undefined}>{ev.rangeWltp > 0 ? `${ev.specsMeta?.fields.includes("rangeWltp") ? "≈ " : ""}${Math.round(ev.rangeWltp)} km` : "—"}{ev.monthlyLld > 0 ? ` · ${fmtEur(ev.monthlyLld)}/mois` : ""}</span>
                                </button>
                              );
                            })}
                            <select value="" onChange={(e) => { if (e.target.value) addCustomEv(i, e.target.value); }}
                              className="h-7 rounded-full border border-dashed border-border bg-white px-2 text-[11px] text-muted-foreground" title="Ajouter un autre modèle du catalogue">
                              <option value="">+ autre modèle…</option>
                              {allEvs.map((ev) => (<option key={ev.id} value={ev.id}>{ev.brand} {ev.model}{ev.version ? ` ${ev.version}` : ""} — {ev.rangeWltp > 0 ? `${Math.round(ev.rangeWltp)} km` : "autonomie n.c."}{effectiveLoyer(ev) > 0 ? ` · ${isLoyerEstimated(ev) ? "≈ " : ""}${fmtEur(effectiveLoyer(ev))}/mois` : ""}</option>))}
                            </select>
                          </div>
                          {lineEv(l) && (
                            <p className="mt-1.5 text-[10px] text-muted-foreground">
                              Pourquoi {lineEv(l)!.brand} {lineEv(l)!.model} : {explainReco(l.current, lineEv(l)!, catalogue).join(" · ")}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-right font-semibold text-[#3809EA] whitespace-nowrap" title={lineEv(l) && isLoyerEstimated(lineEv()!) ? "Calculé avec un loyer estimé pour l'EV : à confirmer avec une offre loueur" : undefined}>{eco > 0 ? `${lineEv(l) && isLoyerEstimated(lineEv()!) ? "≈ " : ""}− ${fmtEur(eco)}` : "—"}</td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-0.5">
                            <button type="button" title="Modifier ce véhicule" onClick={() => setEditingIdx(editing ? null : i)} className={`h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted ${editing ? "bg-[#3809EA] text-white" : "text-foreground/70"}`}><Pencil className="w-3.5 h-3.5" /></button>
                            <button type="button" title="Dupliquer cette ligne" onClick={() => duplicateLine(i)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#3809EA] hover:bg-muted"><Copy className="w-3.5 h-3.5" /></button>
                            <button type="button" title="Supprimer cette ligne" onClick={() => deleteLine(i)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-destructive hover:bg-muted"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                      {editing && (
                        <tr className="border-t bg-[#3809EA]/[0.04]">
                          <td colSpan={7} className="px-3 py-3">
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
                                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 mb-0.5" onClick={() => reSuggest(i)}>
                                  <Zap className="w-3.5 h-3.5 text-[#3809EA]" /> Re-proposer les EV du segment
                                </Button>
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
