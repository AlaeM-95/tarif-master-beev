// Récapitulatif après un import (devis loueur PDF ou car policy) : les véhicules
// sont DÉJÀ dans la Sélection en cours ; cette fenêtre montre ce qui a été lu et
// rapproché, et permet de corriger sur place : véhicule retenu (base Beev),
// quantité, durée, km/an, loyer, ou retrait de la ligne.

import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Vehicle } from "@/lib/catalog";
import type { SelectedVehicle } from "@/lib/pdf";
import { matchCatalogue as suggestFromCatalogue } from "@/lib/vehicle-reference";

export type ImportRecapStatus = "reconnu" | "a-verifier" | "cree" | "fichier";

export type ImportRecapItem = {
  /** Clé de la ligne dans la Sélection en cours. */
  instanceId: string;
  /** Fichier d'origine. */
  source: string;
  /** Libellé tel que lu dans le fichier. */
  label: string;
  status: ImportRecapStatus;
};

const STATUS: Record<ImportRecapStatus, { text: string; cls: string; hint: string }> = {
  reconnu: { text: "Reconnu", cls: "bg-emerald-100 text-emerald-800", hint: "Véhicule de la base Beev retrouvé avec certitude" },
  "a-verifier": { text: "À vérifier", cls: "bg-amber-100 text-amber-800", hint: "Rapprochement probable : vérifiez la version" },
  cree: { text: "Créé", cls: "bg-sky-100 text-sky-800", hint: "Absent de la base Beev : fiche créée depuis le fichier" },
  fichier: { text: "Fiche du fichier", cls: "bg-muted text-muted-foreground", hint: "Véhicule repris tel quel depuis le fichier" },
};

const NUM_CLS =
  "w-full rounded border border-border/60 bg-background px-1.5 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-beev-rose";

function Num({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input
      type="number"
      min={0}
      step={step}
      className={NUM_CLS}
      value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  );
}

export function ImportRecapDialog({
  items,
  lines,
  catalogue,
  onChangeVehicle,
  onPatchLine,
  onRemove,
  onClose,
}: {
  items: ImportRecapItem[];
  lines: Record<string, SelectedVehicle>;
  catalogue: Vehicle[];
  onChangeVehicle: (instanceId: string, vehicle: Vehicle) => void;
  onPatchLine: (instanceId: string, patch: Partial<Pick<SelectedVehicle, "quantity" | "durationMonths" | "kmPerYear" | "negotiatedMonthly">>) => void;
  onRemove: (instanceId: string) => void;
  onClose: () => void;
}) {
  const sorted = useMemo(
    () => [...catalogue].sort((a, b) => `${a.brand} ${a.model} ${a.version}`.localeCompare(`${b.brand} ${b.model} ${b.version}`)),
    [catalogue],
  );
  // Lignes encore présentes (une ligne retirée disparaît du récapitulatif).
  const rows = items.filter((it) => lines[it.instanceId]);
  const toCheck = rows.filter((it) => it.status !== "reconnu").length;

  return (
    <Dialog open={items.length > 0} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import : {rows.length} véhicule{rows.length > 1 ? "s" : ""} dans la Sélection en cours</DialogTitle>
          <DialogDescription>
            Les véhicules sont déjà ajoutés. {toCheck > 0 ? `${toCheck} ligne${toCheck > 1 ? "s" : ""} à vérifier. ` : ""}
            Corrigez ici le véhicule retenu, la durée, le kilométrage ou le loyer : la Sélection en cours est mise à jour aussitôt.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Toutes les lignes importées ont été retirées.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-muted-foreground border-b">
                  <th className="py-2 pr-2 font-semibold">Lu dans le fichier</th>
                  <th className="py-2 pr-2 font-semibold">Statut</th>
                  <th className="py-2 pr-2 font-semibold min-w-[240px]">Véhicule retenu</th>
                  <th className="py-2 pr-2 font-semibold w-14">Qté</th>
                  <th className="py-2 pr-2 font-semibold w-16">Durée (mois)</th>
                  <th className="py-2 pr-2 font-semibold w-20">Km / an</th>
                  <th className="py-2 pr-2 font-semibold w-24">Loyer TTC / mois</th>
                  <th className="py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((it) => {
                  const sv = lines[it.instanceId];
                  const v = sv.vehicle;
                  const inCatalogue = catalogue.some((c) => c.id === v.id);
                  const st = STATUS[it.status];
                  // Suggestion de la base Beev pour une fiche venue du fichier.
                  const sug = !inCatalogue ? suggestFromCatalogue(v, catalogue) : null;
                  return (
                    <tr key={it.instanceId} className="border-b align-top">
                      <td className="py-2 pr-2">
                        <p className="font-medium leading-snug">{it.label || "—"}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[220px]" title={it.source}>{it.source}</p>
                      </td>
                      <td className="py-2 pr-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${st.cls}`} title={st.hint}>{st.text}</span>
                        {v.isCurrentFleet && <p className="mt-1 text-[10px] text-muted-foreground">Flotte actuelle</p>}
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          className="w-full rounded border border-border/60 bg-background px-1.5 py-1 text-xs"
                          value={v.id}
                          onChange={(e) => {
                            const next = catalogue.find((c) => c.id === e.target.value);
                            if (next) onChangeVehicle(it.instanceId, next);
                          }}
                        >
                          {!inCatalogue && <option value={v.id}>{v.brand} {v.model} · {v.version || "—"} (fiche du fichier)</option>}
                          {sorted.map((c) => <option key={c.id} value={c.id}>{c.brand} {c.model} · {c.version}</option>)}
                        </select>
                        {sug && (
                          <button
                            type="button"
                            className="mt-1 text-[10px] text-beev-violet hover:underline text-left"
                            onClick={() => onChangeVehicle(it.instanceId, sug.match)}
                          >
                            Base Beev : {sug.match.brand} {sug.match.model} · {sug.match.version}{sug.exact ? "" : " (proche)"} → utiliser
                          </button>
                        )}
                      </td>
                      <td className="py-2 pr-2"><Num value={sv.quantity} onChange={(n) => onPatchLine(it.instanceId, { quantity: Math.max(1, Math.round(n)) })} /></td>
                      <td className="py-2 pr-2"><Num value={sv.durationMonths} onChange={(n) => onPatchLine(it.instanceId, { durationMonths: Math.round(n) })} /></td>
                      <td className="py-2 pr-2"><Num value={sv.kmPerYear} step={1000} onChange={(n) => onPatchLine(it.instanceId, { kmPerYear: Math.round(n) })} /></td>
                      <td className="py-2 pr-2"><Num value={sv.negotiatedMonthly} step={0.01} onChange={(n) => onPatchLine(it.instanceId, { negotiatedMonthly: n })} /></td>
                      <td className="py-2">
                        <button type="button" onClick={() => onRemove(it.instanceId)} className="text-muted-foreground hover:text-destructive" title="Retirer de la Sélection en cours">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>Terminé</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
