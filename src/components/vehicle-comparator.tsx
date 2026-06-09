// Comparateur inline véhicules : apparaît sous le catalogue véhicules quand
// le commercial a coché au moins 2 véhicules pour comparaison. Tableau
// côte à côte avec specs clés, prix, autonomie, conso, fiscalité.
//
// Le commercial active/désactive la comparaison via un checkbox sur chaque
// VehicleCard. Le state est local à la page index (pas persisté).

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, BarChart3 } from "lucide-react";
import type { Vehicle } from "@/lib/catalog";
import { fmtEur } from "@/lib/store";

type Row = {
  label: string;
  /** Si true, met en avant la meilleure valeur (formatter retourne aussi best?: boolean) */
  highlight?: boolean;
  /** Récupère la valeur pour un véhicule (string ou number) */
  get: (v: Vehicle) => string | number;
  /** Optionnel : direction pour déterminer la "meilleure" valeur :
   *  'asc' = la plus petite gagne (ex. consommation, prix), 'desc' = la plus grande gagne (ex. autonomie). */
  bestDir?: "asc" | "desc";
  format?: (val: string | number) => string;
};

// Loyer LLD TTC = HT × 1,20 (convention client).
const ROWS: Row[] = [
  { label: "Prix catalogue TTC", get: (v) => v.priceTtc, bestDir: "asc", format: (n) => fmtEur(Number(n)), highlight: true },
  { label: "Loyer LLD TTC", get: (v) => v.monthlyLld * 1.20, bestDir: "asc", format: (n) => `${fmtEur(Number(n))}/mois`, highlight: true },
  { label: "Autonomie WLTP", get: (v) => v.rangeWltp, bestDir: "desc", format: (n) => `${n} km`, highlight: true },
  { label: "Consommation", get: (v) => v.consumption, bestDir: "asc", format: (n) => `${n} kWh/100km`, highlight: true },
  { label: "Catégorie", get: (v) => v.category },
  { label: "Énergie", get: (v) => v.energy },
  { label: "Volume de coffre", get: (v) => v.trunkLitres ?? "—", bestDir: "desc", format: (n) => typeof n === "number" ? `${n} L` : String(n), highlight: true },
  { label: "Recharge DC max", get: (v) => v.chargeDcMaxKw ?? "—", bestDir: "desc", format: (n) => typeof n === "number" ? `${n} kW` : String(n), highlight: true },
  { label: "Recharge AC max", get: (v) => v.chargeAcMaxKw ?? "—", bestDir: "desc", format: (n) => typeof n === "number" ? `${n} kW` : String(n), highlight: true },
  { label: "Dimensions", get: (v) => v.dimensions ?? "—" },
  { label: "Recharge 20-80 % AC", get: (v) => v.chargeTime2080Ac ?? "—" },
  { label: "Recharge 20-80 % DC", get: (v) => v.chargeTime2080Dc ?? "—" },
];

function findBest(values: number[], dir: "asc" | "desc"): number {
  return dir === "asc" ? Math.min(...values) : Math.max(...values);
}

export function VehicleComparator({
  vehicles,
  onRemove,
  onClear,
}: {
  /** Liste des véhicules à comparer (minimum 2) */
  vehicles: Vehicle[];
  /** Retirer un véhicule de la comparaison */
  onRemove: (id: string) => void;
  /** Vider la sélection */
  onClear: () => void;
}) {
  if (vehicles.length < 2) return null;

  return (
    <section className="mt-8 mb-12">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-beev-bleu" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-beev-black">
            Comparateur · {vehicles.length} véhicule{vehicles.length > 1 ? "s" : ""}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="text-xs gap-1">
          <X className="w-3 h-3" /> Vider
        </Button>
      </div>
      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-beev-bleu-20">
              <tr>
                <th className="text-left p-3 font-semibold text-beev-black/60 text-xs uppercase">Caractéristique</th>
                {vehicles.map((v) => (
                  <th key={v.id} className="p-3 text-center min-w-[180px]">
                    <div className="flex flex-col items-center gap-1">
                      {v.image && (
                        <img src={v.image} alt={`${v.brand} ${v.model}`} className="h-16 w-auto object-contain" loading="lazy" />
                      )}
                      <p className="font-bold text-beev-black leading-tight">{v.brand}</p>
                      <p className="text-xs text-beev-black/70 leading-tight">{v.model}</p>
                      <Badge variant="outline" className="text-[9px] mt-0.5">{v.version}</Badge>
                      <button
                        type="button"
                        onClick={() => onRemove(v.id)}
                        className="text-[10px] text-beev-black/50 hover:text-beev-rose mt-1 inline-flex items-center gap-0.5"
                      >
                        <X className="w-3 h-3" /> Retirer
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const rawValues = vehicles.map((v) => row.get(v));
                const numericValues = rawValues.every((x) => typeof x === "number") ? (rawValues as number[]) : null;
                const best = row.highlight && row.bestDir && numericValues
                  ? findBest(numericValues, row.bestDir)
                  : null;
                return (
                  <tr key={row.label} className="border-t border-border/40">
                    <td className="p-3 text-xs text-beev-black/60 font-medium">{row.label}</td>
                    {vehicles.map((v, i) => {
                      const val = rawValues[i];
                      const isBest = best !== null && val === best;
                      return (
                        <td
                          key={v.id}
                          className={`p-3 text-center text-sm ${
                            isBest ? "bg-beev-rose-20 font-bold text-beev-black" : "text-beev-black/90"
                          }`}
                        >
                          {row.format ? row.format(val) : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-[10px] text-beev-black/50 mt-2 px-1">
        Les cellules surlignées en rose indiquent la meilleure valeur sur cette ligne (prix le plus bas, autonomie la plus haute, etc.).
      </p>
    </section>
  );
}
