// Constructeur de flotte (Mode Flotte v2) — pour chiffrer 50/80/100+ véhicules.
//
// Flux : importer la car policy client (Excel/CSV) → regroupement des modèles
// avec quantités → auto-association vers les EV les moins chers du segment
// (recommendEvs) → édition en masse (km/durée), choix libre d'un modèle,
// économie estimée en direct → ajout en masse au devis.

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Zap, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";
import { importCarPolicy } from "@/lib/car-policy-importer";
import { buildFleetLines, normCategory } from "@/lib/fleet";
import { calculateTcoFull } from "@/lib/tco-calculator";
import type { Vehicle } from "@/lib/catalog";

export type FleetSelection = { current: Vehicle; quantity: number; evs: Vehicle[] };
export type FleetContract = { kmPerYear: number; durationMonths: number };
type Line = { current: Vehicle; quantity: number; recommendations: Vehicle[]; selectedIds: string[] };

type FleetEnergy = { fuelPriceL: number; kWhHome: number; kWhPublic: number; kmPerYear: number; durationYears: number };

const fmtEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

export function FleetBuilder({
  catalogueVehicles,
  energy,
  onBulkAdd,
}: {
  catalogueVehicles: Vehicle[];
  energy: FleetEnergy;
  onBulkAdd: (sel: FleetSelection[], contract: FleetContract) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [importing, setImporting] = useState(false);
  // Contrat appliqué à toute la flotte (édition en masse).
  const [km, setKm] = useState<number>(Math.round(energy.kmPerYear) || 20000);
  const [durMonths, setDurMonths] = useState<number>(Math.round((energy.durationYears || 4) * 12) || 48);

  // Tous les EV du catalogue (les moins chers d'abord) — pour le choix libre.
  const allEvs = catalogueVehicles
    .filter((v) => v.energy === "Électrique" && v.monthlyLld > 0)
    .sort((a, b) => a.monthlyLld - b.monthlyLld);

  // TCO annuel estimé (loyer + énergie + fiscalité) avec le contrat flotte.
  const tcoAn = (v: Vehicle, loyer: number) => {
    const duree = durMonths / 12;
    const r = calculateTcoFull(
      v,
      {
        dureeAnnees: duree,
        kmContrat: km * duree,
        prixEssenceLitre: energy.fuelPriceL,
        prixKwhDomicile: energy.kWhHome,
        prixKwhPublic: energy.kWhPublic,
        optionsTotalTtc: 0,
        remisePctOverride: v.remise,
      },
      loyer,
    );
    return r.tcoAnnuel;
  };
  // Économie annuelle par véhicule pour une ligne (vs son 1er EV retenu). Les
  // loyers se compensent si le loyer du thermique actuel est inconnu (on prend
  // celui de l'EV), donc l'économie reflète énergie + fiscalité évitées.
  const lineEv = (l: Line): Vehicle | undefined =>
    l.recommendations.find((r) => l.selectedIds.includes(r.id)) ?? l.recommendations[0];
  const lineEcoPerVeh = (l: Line): number => {
    const ev = lineEv(l);
    if (!ev) return 0;
    const currentLoyer = l.current.monthlyLld > 0 ? l.current.monthlyLld : ev.monthlyLld;
    return Math.max(0, tcoAn(l.current, currentLoyer) - tcoAn(ev, ev.monthlyLld));
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const report = await importCarPolicy(file);
      if (report.vehicles.length === 0) {
        toast.error("Aucun véhicule détecté. Vérifiez que le fichier a des colonnes marque / modèle.");
      } else {
        const built = buildFleetLines(report.vehicles, catalogueVehicles, 3);
        setLines(built.map((l) => ({ ...l, selectedIds: l.recommendations[0] ? [l.recommendations[0].id] : [] })));
        toast.success(`${report.importedRows} véhicules · ${built.length} modèles regroupés`);
        if (report.warnings.length) toast.warning(report.warnings[0]);
      }
    } catch (err) {
      toast.error(`Import impossible : ${err instanceof Error ? err.message : "fichier illisible"}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const setQty = (idx: number, q: number) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity: Math.max(1, Math.round(q) || 1) } : l)));
  const toggleEv = (idx: number, id: string) =>
    setLines((ls) => ls.map((l, i) => {
      if (i !== idx) return l;
      const on = l.selectedIds.includes(id);
      return { ...l, selectedIds: on ? l.selectedIds.filter((x) => x !== id) : [...l.selectedIds, id] };
    }));
  // Choix libre : ajoute un EV du catalogue à la ligne et le retient.
  const addCustomEv = (idx: number, evId: string) => {
    const ev = allEvs.find((v) => v.id === evId);
    if (!ev) return;
    setLines((ls) => ls.map((l, i) => {
      if (i !== idx) return l;
      const recos = l.recommendations.some((r) => r.id === ev.id) ? l.recommendations : [...l.recommendations, ev];
      return { ...l, recommendations: recos, selectedIds: l.selectedIds.includes(ev.id) ? l.selectedIds : [...l.selectedIds, ev.id] };
    }));
  };

  const totalVeh = lines.reduce((s, l) => s + l.quantity, 0);
  const segments = new Set(lines.map((l) => normCategory(l.current.category) || "—")).size;
  const totalEcoAn = lines.reduce((s, l) => s + lineEcoPerVeh(l) * l.quantity, 0);

  const addAll = () => {
    const sel: FleetSelection[] = lines
      .map((l) => ({ current: l.current, quantity: l.quantity, evs: l.recommendations.filter((r) => l.selectedIds.includes(r.id)) }))
      .filter((s) => s.evs.length > 0);
    if (sel.length === 0) { toast.error("Sélectionnez au moins un véhicule électrique par ligne."); return; }
    onBulkAdd(sel, { kmPerYear: km, durationMonths: durMonths });
  };

  return (
    <Card className="border-[#3809EA]/20">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Constructeur de flotte</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Importez la car policy, l'outil associe les EV les moins chers par segment et estime l'économie ; ajoutez toute la flotte au devis.
          </p>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
        <Button variant="outline" size="sm" className="gap-2 flex-shrink-0" disabled={importing} onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4" /> {importing ? "Import…" : "Importer car policy"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {lines.length === 0 ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-[#3809EA]/30 bg-[#3809EA]/[0.03] py-10 flex flex-col items-center gap-2 text-sm text-muted-foreground hover:bg-[#3809EA]/[0.06] transition"
          >
            <FileSpreadsheet className="w-8 h-8 text-[#3809EA]/60" />
            <span>Glissez ou cliquez pour importer un fichier <b>.xlsx / .csv</b></span>
            <span className="text-[11px]">Colonnes utiles : marque, modèle, énergie, segment, km/an (quantité si dispo).</span>
          </button>
        ) : (
          <>
            {/* Bandeau économie + édition en masse */}
            <div className="rounded-lg bg-[#3809EA]/[0.05] border border-[#3809EA]/20 p-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Économie estimée flotte / an</span>
                <span className="text-xl font-bold text-[#3809EA]">{totalEcoAn > 0 ? `− ${fmtEur(totalEcoAn)}` : "—"}</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Label className="text-[10px] uppercase text-muted-foreground">Km/an (flotte)</Label>
                <Input type="number" value={km} step={1000} onChange={(e) => setKm(Math.max(0, Number(e.target.value) || 0))} className="h-8 w-24 text-xs" />
                <Label className="text-[10px] uppercase text-muted-foreground">Durée (mois)</Label>
                <Input type="number" value={durMonths} step={1} onChange={(e) => setDurMonths(Math.max(1, Number(e.target.value) || 1))} className="h-8 w-20 text-xs" />
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
                    <th className="px-2 py-2 font-semibold w-14">Qté</th>
                    <th className="px-2 py-2 font-semibold w-20">Segment</th>
                    <th className="px-3 py-2 font-semibold">EV recommandés (les moins chers · cliquez pour retenir)</th>
                    <th className="px-2 py-2 font-semibold w-24 text-right">Éco/véh/an</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const eco = lineEcoPerVeh(l);
                    return (
                      <tr key={i} className="border-t align-top">
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{l.current.brand} {l.current.model}</div>
                          <div className="text-[10px] text-muted-foreground">{l.current.energy}{l.current.version ? ` · ${l.current.version}` : ""}</div>
                        </td>
                        <td className="px-2 py-2.5">
                          <Input type="number" value={l.quantity} min={1} onChange={(e) => setQty(i, Number(e.target.value))} className="h-8 w-12 text-xs" />
                        </td>
                        <td className="px-2 py-2.5"><Badge variant="outline" className="capitalize">{normCategory(l.current.category) || "—"}</Badge></td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {l.recommendations.map((ev, rIdx) => {
                              const on = l.selectedIds.includes(ev.id);
                              return (
                                <button
                                  key={ev.id}
                                  type="button"
                                  onClick={() => toggleEv(i, ev.id)}
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition ${on ? "bg-[#3809EA] text-white border-[#3809EA]" : "bg-white hover:bg-muted border-border"}`}
                                >
                                  {on ? <Check className="w-3 h-3" /> : (rIdx === 0 ? <Zap className="w-3 h-3 text-[#3809EA]" /> : null)}
                                  <span className="font-medium">{ev.brand} {ev.model}</span>
                                  <span className={on ? "text-white/80" : "text-muted-foreground"}>{fmtEur(ev.monthlyLld)}/mois</span>
                                </button>
                              );
                            })}
                            {/* Choix libre : ajouter n'importe quel EV du catalogue */}
                            <select
                              value=""
                              onChange={(e) => { if (e.target.value) addCustomEv(i, e.target.value); e.currentTarget.selectedIndex = 0; }}
                              className="h-7 rounded-full border border-dashed border-border bg-white px-2 text-[11px] text-muted-foreground"
                              title="Ajouter un autre modèle du catalogue"
                            >
                              <option value="">+ autre modèle…</option>
                              {allEvs.map((ev) => (
                                <option key={ev.id} value={ev.id}>{ev.brand} {ev.model} — {fmtEur(ev.monthlyLld)}/mois</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-right font-semibold text-[#3809EA] whitespace-nowrap">
                          {eco > 0 ? `− ${fmtEur(eco)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-muted-foreground">Économie = énergie + fiscalité évitées (TCO annuel) vs le thermique, à loyer comparable. Ajustez km/durée pour toute la flotte en haut.</p>
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
