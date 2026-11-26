// Éditeur « Catalogue client (format A4) » — modèle Beev × Sicap : catalogue des
// véhicules proposés par gamme, comparatif, analyse TCO et AEN, borne à domicile,
// Fleet Manager et effort commercial. Généré depuis la SÉLECTION en cours ; le
// « Catalogue TCO » 16:9 et la « Proposition flotte » restent disponibles à côté.
// État persisté en localStorage ; date renouvelée à chaque ouverture.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, FileDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Charger } from "@/lib/catalog";
import type { SelectedVehicle } from "@/lib/pdf";
import type { EnergyParams } from "@/lib/store";
import {
  analyseCatalogueClient, defaultCatalogueClient, generateCatalogueClientDeck,
  type CatalogueClientConfig,
} from "@/lib/catalogue-client-deck";

const SK = "beev_catalogue_client_v1";
const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function loadConfig(): CatalogueClientConfig {
  const base = defaultCatalogueClient();
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(SK);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<CatalogueClientConfig>;
      return {
        ...base, ...saved,
        dateLabel: base.dateLabel,
        rangeText: { ...(saved.rangeText ?? {}) },
        borne: { ...base.borne, ...(saved.borne ?? {}) },
        fleet: { ...base.fleet, ...(saved.fleet ?? {}) },
        effort: { ...base.effort, ...(saved.effort ?? {}) },
        show: { ...base.show, ...(saved.show ?? {}) },
      };
    }
  } catch { /* ignore */ }
  return base;
}

function Txt({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 text-sm" />
    </div>
  );
}

function Num({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</Label>
      <Input type="number" min={0} step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value) || 0)} className="h-8 text-sm" />
    </div>
  );
}

function Area({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="text-sm" />
    </div>
  );
}

function Block({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-beev-bleu" />
      {label}
    </label>
  );
}

export function CatalogueClientEditor({
  open, onOpenChange, selection, energy, client, chargers,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selection: SelectedVehicle[];
  energy: EnergyParams;
  client: { company: string };
  /** Catalogue des bornes : les bornes domicile alimentent la page Recharge. */
  chargers: Charger[];
}) {
  const [cfg, setCfg] = useState<CatalogueClientConfig>(loadConfig);
  const homeChargers = useMemo(() => chargers.filter((c) => c.deployment === "domicile"), [chargers]);

  useEffect(() => {
    try { localStorage.setItem(SK, JSON.stringify(cfg)); } catch { /* ignore */ }
  }, [cfg]);

  const set = (patch: Partial<CatalogueClientConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const setBorne = (patch: Partial<CatalogueClientConfig["borne"]>) => setCfg((c) => ({ ...c, borne: { ...c.borne, ...patch } }));
  const setFleet = (patch: Partial<CatalogueClientConfig["fleet"]>) => setCfg((c) => ({ ...c, fleet: { ...c.fleet, ...patch } }));
  const setEffort = (patch: Partial<CatalogueClientConfig["effort"]>) => setCfg((c) => ({ ...c, effort: { ...c.effort, ...patch } }));

  const analysis = useMemo(() => analyseCatalogueClient(selection, energy, cfg), [selection, energy, cfg]);
  const canGenerate = analysis.lines.length > 0;
  const fleetCount = cfg.fleet.vehicles > 0 ? cfg.fleet.vehicles : analysis.lines.reduce((s, l) => s + Math.max(1, Math.round(l.sv.quantity || 1)), 0);
  const fmOffered = cfg.fleet.enabled && cfg.fleet.firstYearFree ? cfg.fleet.priceHt * fleetCount * 12 : 0;
  const borneOffered = cfg.borne.enabled && cfg.effort.enabled ? cfg.borne.discount * cfg.effort.exampleBornes : 0;

  // Borne du catalogue : nom du produit (sans le nom d'offre ni la puissance), photo,
  // prix pose comprise des variantes monophasée et triphasée quand elles existent.
  const pickCharger = (id: string) => {
    const c = homeChargers.find((x) => x.id === id);
    if (!c) { setBorne({ chargerId: "" }); return; }
    const stripPower = (m: string) => m.replace(/\s*\d+(?:[.,]\d+)?\s*kW\b.*$/i, "").trim();
    const product = stripPower(c.model) || c.model;
    const name = /^beev\b/i.test(c.brand) ? product : `${c.brand} ${product}`.trim();
    const priceOf = (x: Charger) => Math.round((x.priceHt || 0) + (x.installPriceHt || 0));
    const variants = homeChargers.filter((x) => x.brand === c.brand && stripPower(x.model) === product);
    const mono = variants.find((x) => x.powerKw <= 7.4) ?? (c.powerKw <= 7.4 ? c : undefined);
    const tri = variants.find((x) => x.powerKw > 7.4) ?? (c.powerKw > 7.4 ? c : undefined);
    setBorne({
      chargerId: c.id, name, image: c.marketingImageUrl || c.image || "",
      ...(mono && priceOf(mono) > 0 ? { monoBase: priceOf(mono) } : {}),
      ...(tri && priceOf(tri) > 0 ? { triBase: priceOf(tri) } : {}),
    });
  };

  const generate = async () => {
    await generateCatalogueClientDeck({ cfg, selection, energy, clientName: client.company });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catalogue client (format A4)</DialogTitle>
          <DialogDescription>
            Catalogue au format A4 prêt à envoyer : couverture, une page par gamme, comparatif, analyse TCO avec AEN employeur et
            part salarié indicative, borne à domicile, Fleet Manager et effort commercial. Généré depuis les véhicules proposés de votre sélection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className={`rounded-lg border p-3 text-sm ${canGenerate ? "bg-muted/40" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
            {canGenerate ? (
              <p>
                <b>{analysis.lines.length}</b> modèle{analysis.lines.length > 1 ? "s" : ""} en{" "}
                <b>{analysis.ranges.length}</b> gamme{analysis.ranges.length > 1 ? "s" : ""} :{" "}
                {analysis.ranges.map((r) => `${r.name} (${r.lines.length}${r.contract ? ` · ${r.contract}` : " · durées différentes"})`).join(", ")}
              </p>
            ) : (
              <p className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                Ajoutez à la sélection au moins un véhicule proposé avec un loyer négocié pour générer le catalogue.
              </p>
            )}
            {analysis.skipped.length > 0 && (
              <p className="mt-1.5 flex items-start gap-2 text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {analysis.skipped.length} véhicule{analysis.skipped.length > 1 ? "s" : ""} ignoré{analysis.skipped.length > 1 ? "s" : ""} faute de loyer négocié :{" "}
                {analysis.skipped.map((s) => `${s.vehicle.brand} ${s.vehicle.model}`).join(", ")}.
              </p>
            )}
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Gammes : catégorie de la fiche véhicule. Stock, délai, autonomie, coffre et éco-score : fiche du catalogue. Les véhicules « flotte actuelle » ne sont pas repris.
            </p>
          </div>

          <Block title="Couverture">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Client (Informations client)</Label>
                <p className={`h-8 flex items-center text-sm ${client.company ? "font-medium" : "text-amber-700"}`}>{client.company || "Société non renseignée"}</p>
              </div>
              <Txt label="Date" value={cfg.dateLabel} onChange={(v) => set({ dateLabel: v })} />
            </div>
            <Area label="Titre (une ligne par retour à la ligne)" value={cfg.coverTitle} onChange={(v) => set({ coverTitle: v })} rows={3} />
            <Area label="Texte" value={cfg.coverText} onChange={(v) => set({ coverText: v })} rows={2} />
            <Area label="Chiffres Beev (valeur | libellé, une ligne par chiffre, 4 au plus)" value={cfg.stats} onChange={(v) => set({ stats: v })} rows={4} />
          </Block>

          <Block title="Gammes">
            {analysis.ranges.length === 0 && <p className="text-xs text-muted-foreground">Aucune gamme tant que la sélection ne contient pas de véhicule proposé.</p>}
            {analysis.ranges.map((r) => (
              <Txt key={r.name} label={`${r.name} : phrase d'introduction`} value={cfg.rangeText[r.name] ?? ""} placeholder={r.text}
                onChange={(v) => set({ rangeText: { ...cfg.rangeText, [r.name]: v } })} />
            ))}
            <Txt label="Inclus dans chaque loyer" value={cfg.included} onChange={(v) => set({ included: v })} />
          </Block>

          <Block title="Analyse TCO" right={<Toggle checked={cfg.show.tco} onChange={(v) => set({ show: { ...cfg.show, tco: v } })} label="Inclure la page" />}>
            <div className="grid grid-cols-3 gap-3">
              <Num label="Électricité sans borne (€/kWh)" value={cfg.kwhNoBorne} onChange={(v) => set({ kwhNoBorne: v })} step={0.01} />
              <Num label="Avec borne : domicile (€/kWh)" value={cfg.kwhHome} onChange={(v) => set({ kwhHome: v })} step={0.01} />
              <Num label="Part recharge domicile (%)" value={cfg.homeMixPct} onChange={(v) => set({ homeMixPct: Math.min(100, Math.round(v)) })} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Coût employeur = loyer + énergie + charges patronales sur l'AEN (42 %) + AND le cas échéant. Part salarié : 25 % de l'AEN, à titre indicatif.
            </p>
            <Toggle checked={cfg.show.comparatif} onChange={(v) => set({ show: { ...cfg.show, comparatif: v } })} label="Inclure la page Comparatif (la gamme en un coup d'œil)" />
          </Block>

          <Block title="Borne à domicile" right={<Toggle checked={cfg.borne.enabled} onChange={(v) => setBorne({ enabled: v })} label="Inclure la page" />}>
            {cfg.borne.enabled && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Borne du catalogue</Label>
                    <select className="h-8 w-full rounded-md border bg-background px-2 text-sm" value={cfg.borne.chargerId} onChange={(e) => pickCharger(e.target.value)}>
                      <option value="">Saisie libre</option>
                      {homeChargers.map((c) => <option key={c.id} value={c.id}>{c.brand} {c.model} · {c.powerKw} kW</option>)}
                    </select>
                  </div>
                  <Txt label="Nom affiché" value={cfg.borne.name} onChange={(v) => setBorne({ name: v })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Num label="Monophasé 7,4 kW (€ HT)" value={cfg.borne.monoBase} onChange={(v) => setBorne({ monoBase: v })} />
                  <Num label="Triphasé 11 kW (€ HT)" value={cfg.borne.triBase} onChange={(v) => setBorne({ triBase: v })} />
                  <Num label="Remise par borne (€ HT)" value={cfg.borne.discount} onChange={(v) => setBorne({ discount: v })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Txt label="Service" value={cfg.borne.serviceName} onChange={(v) => setBorne({ serviceName: v })} />
                  <Num label="€ HT par point de charge / mois" value={cfg.borne.servicePriceHt} onChange={(v) => setBorne({ servicePriceHt: v })} step={0.5} />
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Area label="Installation (titre | détail)" value={cfg.borne.installation} onChange={(v) => setBorne({ installation: v })} />
                  <Area label="Câblage (titre | détail)" value={cfg.borne.cabling} onChange={(v) => setBorne({ cabling: v })} />
                  <Area label="Protections (titre | détail)" value={cfg.borne.protections} onChange={(v) => setBorne({ protections: v })} />
                </div>
              </>
            )}
          </Block>

          <Block title="Fleet Manager" right={<Toggle checked={cfg.fleet.enabled} onChange={(v) => setFleet({ enabled: v })} label="Inclure la page" />}>
            {cfg.fleet.enabled && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Num label="€ HT / véhicule / mois" value={cfg.fleet.priceHt} onChange={(v) => setFleet({ priceHt: v })} step={0.5} />
                  <Num label={`Véhicules en parc (0 = ${fleetCount} de la sélection)`} value={cfg.fleet.vehicles} onChange={(v) => setFleet({ vehicles: Math.round(v) })} />
                </div>
                <Toggle checked={cfg.fleet.firstYearFree} onChange={(v) => setFleet({ firstYearFree: v })} label={`1re année offerte (${eur(cfg.fleet.priceHt * fleetCount * 12)} HT)`} />
                {cfg.fleet.firstYearFree && <Txt label="Condition de l'offre" value={cfg.fleet.condition} onChange={(v) => setFleet({ condition: v })} />}
              </>
            )}
          </Block>

          <Block title="Effort commercial et prochaines étapes" right={<Toggle checked={cfg.effort.enabled} onChange={(v) => setEffort({ enabled: v })} label="Inclure la page" />}>
            {cfg.effort.enabled && (
              <>
                <Num label="Exemple : nombre de bornes à domicile" value={cfg.effort.exampleBornes} onChange={(v) => setEffort({ exampleBornes: Math.round(v) })} />
                <p className="text-[11px] text-muted-foreground">
                  Effort affiché : Fleet Manager offert {eur(fmOffered)} + remise bornes {eur(borneOffered)} = <b>{eur(fmOffered + borneOffered)} HT</b> la première année.
                </p>
                <Area label="Prochaines étapes (titre | détail, une par ligne)" value={cfg.effort.steps} onChange={(v) => setEffort({ steps: v })} rows={5} />
              </>
            )}
          </Block>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setCfg(defaultCatalogueClient())}>
            <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
            <Button onClick={generate} disabled={!canGenerate} className="gap-1.5">
              <FileDown className="w-4 h-4" /> Générer le catalogue
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
