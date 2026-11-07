// « TCO par durée et kilométrage » d'un groupe de comparaison.
//
// Quand les véhicules d'un groupe n'ont pas le même contrat (durée, km/an), leurs coûts
// totaux ne se comparent pas. Ce tableau recalcule le coût complet de chaque véhicule pour
// plusieurs scénarios communs, avec le vrai loyer connu pour chacun (devis, configurations
// supplémentaires, offres loueur) et une hypothèse clairement marquée sinon.

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Plus, X } from "lucide-react";
import type { SelectedVehicle } from "@/lib/pdf";
import type { EnergyParams } from "@/lib/store";
import type { LeaserOffer } from "@/lib/leaser-offers";
import {
  bestIndex, computeCell, configsDiffer, currentIndex, sameScenario, scenarioKey, scenariosOf, mainScenario,
  type Scenario,
} from "@/lib/group-tco";

const eur0 = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(n)).replace(/[  ]/g, " ");
const km2 = (n: number) => n.toFixed(2).replace(".", ",");
const km0 = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/[\u202f\u00a0]/g, " ");
const nameOf = (sv: SelectedVehicle) => `${sv.vehicle.brand} ${sv.vehicle.model}`.trim();
const keyOf = (sv: SelectedVehicle) => sv.instanceId ?? sv.vehicle.id;

const SOURCE_TAG: Record<string, string> = {
  principale: "devis", supplementaire: "devis (autre config.)", offre: "offre loueur", actuel: "contrat actuel", hypothese: "hypothèse",
};

export function GroupTcoSimulator({ members, energy, offers }: { members: SelectedVehicle[]; energy: EnergyParams; offers: LeaserOffer[] }) {
  const [open, setOpen] = useState(members.length >= 2);
  const [extra, setExtra] = useState<Scenario[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [months, setMonths] = useState(48);
  const [km, setKm] = useState(30000);

  const auto = useMemo(() => scenariosOf(members).slice(0, 5), [members]);
  const scenarios = useMemo(() => {
    const all = [...auto];
    for (const x of extra) if (!all.some((a) => sameScenario(a, x))) all.push(x);
    return all.filter((s) => !hidden.includes(scenarioKey(s))).sort((a, b) => a.months - b.months || a.kmPerYear - b.kmPerYear);
  }, [auto, extra, hidden]);
  const differ = useMemo(() => configsDiffer(members), [members]);
  // grid[scénario][véhicule]
  const grid = useMemo(() => scenarios.map((sc) => members.map((sv) => computeCell(sv, sc, energy, offers))), [scenarios, members, energy, offers]);

  if (members.length === 0) return null;

  const addScenario = () => {
    if (!(months >= 6) || !(km >= 1000)) return;
    const sc = { months: Math.round(months), kmPerYear: Math.round(km) };
    setHidden((h) => h.filter((k) => k !== scenarioKey(sc)));
    setExtra((e) => (e.some((x) => sameScenario(x, sc)) ? e : [...e, sc]));
  };

  return (
    <div className="rounded-xl border bg-background">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left">
        <span className="text-xs font-semibold">
          TCO par durée et kilométrage
          {differ && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Contrats différents</span>}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t px-3 pb-3 pt-3">
          {differ && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Les véhicules de ce groupe n'ont pas le même contrat : leurs coûts totaux ne sont pas comparables. Le tableau les ramène à une base commune,
                colonne par colonne.
              </span>
            </p>
          )}

          {scenarios.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Ajoutez une durée et un kilométrage pour comparer les véhicules du groupe.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] border-separate border-spacing-0 text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-left align-bottom text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Véhicule</th>
                    {scenarios.map((sc) => (
                      <th key={scenarioKey(sc)} className="whitespace-nowrap px-2 py-2 text-right align-bottom text-[12px] font-semibold">
                        <span className="inline-flex items-start gap-1">
                          <span>
                            <span className="block">{sc.months} mois</span>
                            <span className="block text-[10px] font-normal text-muted-foreground">{km0(sc.kmPerYear)} km/an</span>
                          </span>
                          <button
                            type="button"
                            title="Retirer ce scénario"
                            onClick={() => { setHidden((h) => [...h, scenarioKey(sc)]); setExtra((e) => e.filter((x) => !sameScenario(x, sc))); }}
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((sv, mi) => (
                    <tr key={keyOf(sv)} className="align-top">
                      <td className="border-t px-2 py-2">
                        <p className="max-w-[170px] truncate text-[12px] font-semibold">{nameOf(sv)}</p>
                        <p className="max-w-[170px] truncate text-[10px] text-muted-foreground">
                          {sv.vehicle.version}{sv.vehicle.isCurrentFleet ? " · actuel" : ""}
                        </p>
                      </td>
                      {scenarios.map((sc, si) => {
                        const c = grid[si][mi];
                        const best = bestIndex(members, grid[si]) === mi;
                        const own = sameScenario(mainScenario(sv), sc);
                        return (
                          <td key={scenarioKey(sc)} className={`whitespace-nowrap border-t px-2 py-2 text-right ${best ? "bg-emerald-50" : ""}`}>
                            {c.r ? (
                              <>
                                <p className={`text-[13px] tabular-nums ${c.loyer.known ? "font-semibold" : "italic text-muted-foreground"}`}>
                                  {c.loyer.known ? "" : "≈ "}{eur0(c.perMonth)}<span className="text-[10px] font-normal text-muted-foreground"> /mois</span>
                                </p>
                                <p className="text-[10px] tabular-nums text-muted-foreground">{eur0(c.tco)} au total</p>
                                <p className="text-[10px] tabular-nums text-muted-foreground">{km2(c.perKm)} €/km</p>
                                <p className="mt-0.5 text-[9px] text-muted-foreground" title={c.loyer.label}>
                                  {own && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#3809EA] align-middle" title="Contrat de ce véhicule dans le devis" />}
                                  {SOURCE_TAG[c.loyer.source] ?? ""}
                                </p>
                              </>
                            ) : (
                              <span className="text-[11px] font-medium text-amber-700">Loyer à saisir</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td className="border-t px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Meilleur coût</td>
                    {scenarios.map((sc, si) => {
                      const b = bestIndex(members, grid[si]);
                      const cur = currentIndex(members, grid[si]);
                      const delta = b >= 0 && cur >= 0 ? Math.round(grid[si][b].perMonth) - Math.round(grid[si][cur].perMonth) : null;
                      return (
                        <td key={scenarioKey(sc)} className="border-t px-2 py-2 text-right">
                          {b >= 0 ? (
                            <>
                              <p className="max-w-[130px] truncate text-[11px] font-semibold" title={nameOf(members[b])}>{nameOf(members[b])}</p>
                              {delta !== null && (
                                <>
                                  <span className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${delta <= 0 ? "bg-sky-100 text-sky-900" : "bg-rose-100 text-rose-900"}`}>
                                    {delta <= 0 ? "−" : "+"}{eur0(Math.abs(delta))} /mois
                                  </span>
                                  <p className="text-[9px] text-muted-foreground">vs actuel</p>
                                </>
                              )}
                            </>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="block text-[10px] text-muted-foreground">Durée (mois)</span>
              <input type="number" min={6} step={1} value={months} onChange={(e) => setMonths(Number(e.target.value) || 0)} className="h-8 w-20 rounded-md border border-input bg-background px-2 text-center text-xs tabular-nums" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] text-muted-foreground">Km par an</span>
              <input type="number" min={1000} step={1000} value={km} onChange={(e) => setKm(Number(e.target.value) || 0)} className="h-8 w-24 rounded-md border border-input bg-background px-2 text-center text-xs tabular-nums" />
            </label>
            <button type="button" onClick={addScenario} className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-semibold hover:bg-muted">
              <Plus className="h-3.5 w-3.5" /> Ajouter ce scénario
            </button>
          </div>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Coût complet = loyers + énergie + TVS + malus + AND + avantage en nature employeur, même calcul que le PDF. En gras : loyer connu
            (devis, autre configuration ou offre loueur ; la flotte actuelle garde son contrat). En italique avec « ≈ » : hypothèse, le loyer de la
            configuration principale est repris faute de loyer négocié pour cette durée et ce kilométrage.
            Le point violet indique le contrat de ce véhicule dans le devis.
          </p>
        </div>
      )}
    </div>
  );
}
