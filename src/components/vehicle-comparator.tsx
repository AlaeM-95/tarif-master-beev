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
  /** Formatter — reçoit aussi le véhicule pour adapter l'unité (ex. conso
   *  kWh/100km en électrique vs L/100km en thermique/hybride). */
  format?: (val: string | number, v: Vehicle) => string;
  /** Si défini, le surlignement n'est actif que si ce garde renvoie true sur
   *  l'ensemble des véhicules comparés (ex. unités homogènes pour la conso). */
  highlightGuard?: (vehicles: Vehicle[]) => boolean;
  /** Extracteur numérique pour le surlignement quand la valeur est un string
   *  (ex. durées de recharge "7h30", "30 min"). NaN = non comparable. */
  numeric?: (val: string | number) => number;
};

// Parse une durée de recharge libre ("30 min", "7h", "7h30", "1 h 05") en
// minutes pour permettre le surlignement de la plus rapide.
function parseDurationMin(val: string | number): number {
  if (typeof val === "number") return val > 0 ? val : NaN;
  const s = String(val).toLowerCase().replace(/\s+/g, "");
  let m = s.match(/^(\d+(?:[.,]\d+)?)h(\d{1,2})?(?:min)?$/);
  if (m) return parseFloat(m[1].replace(",", ".")) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
  m = s.match(/^(\d+(?:[.,]\d+)?)(?:min|mn|m|minutes?)$/);
  if (m) return parseFloat(m[1].replace(",", "."));
  m = s.match(/^(\d+(?:[.,]\d+)?)$/);
  if (m) return parseFloat(m[1].replace(",", "."));
  return NaN;
}

// v.monthlyLld est DÉJÀ TTC (cf. label « Loyer TTC/mois » du panneau de
// modification véhicule). Pas de × 1.20 ici sinon décalage avec le panneau.
const ROWS: Row[] = [
  { label: "Prix catalogue TTC", get: (v) => v.priceTtc, bestDir: "asc", format: (n) => fmtEur(Number(n)), highlight: true },
  { label: "Loyer LLD TTC", get: (v) => v.monthlyLld, bestDir: "asc", format: (n) => `${fmtEur(Number(n))}/mois`, highlight: true },
  { label: "Autonomie WLTP", get: (v) => v.rangeWltp, bestDir: "desc", format: (n) => `${n} km`, highlight: true },
  {
    // Conso : kWh/100km pour les électriques, L/100km pour les autres
    // motorisations (hybride, mild hybrid, essence, diesel). Surlignement
    // seulement si tous les véhicules partagent la même unité.
    label: "Consommation",
    // Même logique de champ que la fiche/PDF : électrique → consumptionElec,
    // autres → consumptionThermal, fallback consumption legacy.
    get: (v) => (v.energy === "Électrique" ? (v.consumptionElec ?? v.consumption) : (v.consumptionThermal ?? v.consumption)) || 0,
    bestDir: "asc",
    format: (n, v) => v.energy === "Électrique" ? `${n} kWh/100km` : `${n} L/100km`,
    highlight: true,
    highlightGuard: (vs) => vs.every((v) => v.energy === "Électrique") || vs.every((v) => v.energy !== "Électrique"),
  },
  { label: "Catégorie", get: (v) => v.category },
  { label: "Énergie", get: (v) => v.energy },
  { label: "Volume de coffre", get: (v) => v.trunkLitres ?? "—", bestDir: "desc", format: (n) => typeof n === "number" ? `${n} L` : String(n), highlight: true },
  { label: "Recharge DC max", get: (v) => v.chargeDcMaxKw ?? "—", bestDir: "desc", format: (n) => typeof n === "number" ? `${n} kW` : String(n), highlight: true },
  { label: "Recharge AC max", get: (v) => v.chargeAcMaxKw ?? "—", bestDir: "desc", format: (n) => typeof n === "number" ? `${n} kW` : String(n), highlight: true },
  { label: "Dimensions", get: (v) => v.dimensions ?? "—" },
  { label: "Délai de livraison", get: (v) => v.leadTime ?? "—" },
  { label: "Recharge 20-80 % AC", get: (v) => v.chargeTime2080Ac ?? "—", bestDir: "asc", numeric: parseDurationMin, highlight: true },
  { label: "Recharge 20-80 % DC", get: (v) => v.chargeTime2080Dc ?? "—", bestDir: "asc", numeric: parseDurationMin, highlight: true },
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
                // Valeurs numériques pour le surlignement : via row.numeric si
                // fourni (durées en string), sinon les nombres > 0. Les valeurs
                // manquantes/0 deviennent NaN et sont ignorées.
                const nums = rawValues.map((x) =>
                  row.numeric ? row.numeric(x) : (typeof x === "number" && x > 0 ? x : NaN),
                );
                const valid = nums.filter((n) => !Number.isNaN(n));
                const guardOk = row.highlightGuard ? row.highlightGuard(vehicles) : true;
                // Pas de surlignement si : désactivé, garde KO, moins de 2
                // valeurs comparables, ou toutes les valeurs identiques.
                const best = row.highlight && row.bestDir && guardOk
                  && valid.length >= 2 && !valid.every((n) => n === valid[0])
                  ? findBest(valid, row.bestDir)
                  : null;
                return (
                  <tr key={row.label} className="border-t border-border/40">
                    <td className="p-3 text-xs text-beev-black/60 font-medium">{row.label}</td>
                    {vehicles.map((v, i) => {
                      const val = rawValues[i];
                      const isBest = best !== null && !Number.isNaN(nums[i]) && nums[i] === best;
                      return (
                        <td
                          key={v.id}
                          className={`p-3 text-center text-sm ${
                            isBest ? "bg-beev-rose-20 font-bold text-beev-black" : "text-beev-black/90"
                          }`}
                        >
                          {row.format ? row.format(val, v) : String(val)}
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
