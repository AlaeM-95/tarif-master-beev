// Constructeur de flotte (Mode Flotte v2) — pour chiffrer 50/80/100+ véhicules.
//
// Flux : importer la car policy client (Excel/CSV) → regroupement des modèles
// avec quantités → auto-association vers les EV « top du mois » du segment →
// ajout en masse au devis. Tout vit dans le state local ; l'ajout au devis se
// fait via onBulkAdd (le parent crée les instances SelectedVehicle).

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, Zap, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";
import { importCarPolicy } from "@/lib/car-policy-importer";
import { buildFleetLines, normCategory } from "@/lib/fleet";
import type { Vehicle } from "@/lib/catalog";

export type FleetSelection = { current: Vehicle; quantity: number; evs: Vehicle[] };
type Line = { current: Vehicle; quantity: number; recommendations: Vehicle[]; selectedIds: string[] };

const fmtEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

export function FleetBuilder({
  catalogueVehicles,
  onBulkAdd,
}: {
  catalogueVehicles: Vehicle[];
  onBulkAdd: (sel: FleetSelection[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [importing, setImporting] = useState(false);

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
        // Par défaut : le n°1 (top du mois) est pré-sélectionné par ligne.
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

  const totalVeh = lines.reduce((s, l) => s + l.quantity, 0);
  const totalEvSelected = lines.reduce((s, l) => s + l.selectedIds.length, 0);
  const segments = new Set(lines.map((l) => normCategory(l.current.category) || "—")).size;

  const addAll = () => {
    const sel: FleetSelection[] = lines
      .map((l) => ({ current: l.current, quantity: l.quantity, evs: l.recommendations.filter((r) => l.selectedIds.includes(r.id)) }))
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
            Importez la car policy du client, l'outil associe les EV « top du mois » par segment et ajoute toute la flotte au devis.
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
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge className="bg-[#3809EA] text-white">{totalVeh} véhicules</Badge>
              <Badge variant="outline">{lines.length} modèles · {segments} segments</Badge>
              <Badge variant="outline">{totalEvSelected} EV retenus</Badge>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 ml-auto" onClick={() => setLines([])}>
                <RotateCcw className="w-3 h-3" /> Réinitialiser
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-semibold">Véhicule actuel</th>
                    <th className="px-2 py-2 font-semibold w-16">Qté</th>
                    <th className="px-2 py-2 font-semibold w-24">Segment</th>
                    <th className="px-3 py-2 font-semibold">EV recommandés — top du mois (cliquez pour retenir)</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t align-top">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{l.current.brand} {l.current.model}</div>
                        <div className="text-[10px] text-muted-foreground">{l.current.energy}{l.current.version ? ` · ${l.current.version}` : ""}</div>
                      </td>
                      <td className="px-2 py-2.5">
                        <Input type="number" value={l.quantity} min={1} onChange={(e) => setQty(i, Number(e.target.value))} className="h-8 w-14 text-xs" />
                      </td>
                      <td className="px-2 py-2.5"><Badge variant="outline" className="capitalize">{normCategory(l.current.category) || "—"}</Badge></td>
                      <td className="px-3 py-2.5">
                        {l.recommendations.length === 0 ? (
                          <span className="text-[11px] text-amber-700">Aucun EV classé pour ce segment — renseignez le « top du mois » dans le catalogue.</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
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
                                  {rIdx === 0 && <span className={`text-[9px] uppercase rounded px-1 ${on ? "bg-white/20" : "bg-[#3809EA]/10 text-[#3809EA]"}`}>top</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-muted-foreground">Ajuste les quantités et retiens un ou plusieurs EV par modèle. Les paires (flotte actuelle + EV) sont ajoutées au devis et comparées par segment.</p>
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
