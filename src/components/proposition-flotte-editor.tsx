// Éditeur « Proposition flotte » (nouveau format de catalogue, modèle Beev × HEMC-37) :
// génère la présentation 16:9 depuis la SÉLECTION (flotte actuelle, véhicules proposés,
// groupes de comparaison) avec, en option, l'offre borne à domicile + supervision.
// Le « Catalogue TCO » existant reste disponible à côté, inchangé.
// État persisté en localStorage ; n° de devis et date renouvelés à chaque ouverture.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, FileDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMyCoordinates } from "@/lib/users";
import type { Charger } from "@/lib/catalog";
import type { SelectedVehicle } from "@/lib/pdf";
import type { EnergyParams } from "@/lib/store";
import {
  analyseFlotte, borneCost, defaultPropositionFlotte, generatePropositionFlotteDeck,
  type PropositionFlotteConfig,
} from "@/lib/proposition-flotte-deck";

const SK = "beev_proposition_flotte_v1";
const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function loadConfig(): PropositionFlotteConfig {
  const base = defaultPropositionFlotte();
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(SK);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<PropositionFlotteConfig>;
      // N° de devis et date : toujours ceux du jour.
      return {
        ...base, ...saved,
        reference: base.reference, dateLabel: base.dateLabel,
        borne: { ...base.borne, ...(saved.borne ?? {}) },
        quote: { ...base.quote, ...(saved.quote ?? {}) },
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

const PAGES: Array<[keyof PropositionFlotteConfig["show"], string, string]> = [
  ["recharge", "Recharge à domicile", "Borne posée au forfait et supervision (si l'offre borne est activée)"],
  ["why", "Pourquoi Beev", "Les 4 engagements Beev et un témoignage client"],
  ["glossary", "Glossaire", "LLD, coût complet, TVS, malus, AND, AEN, WLTP, supervision"],
  ["annex", "Annexe · détail chiffré", "Tous les chiffres, véhicule par véhicule"],
  ["method", "Annexe · méthode", "Comment le coût complet est calculé"],
];

export function PropositionFlotteEditor({
  open, onOpenChange, selection, energy, client, chargers,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selection: SelectedVehicle[];
  energy: EnergyParams;
  client: { company: string; salesRep?: string; salesRepEmail?: string; salesRepPhone?: string };
  /** Catalogue des bornes : les bornes domicile alimentent l'offre borne. */
  chargers: Charger[];
}) {
  const [cfg, setCfg] = useState<PropositionFlotteConfig>(loadConfig);
  const { coordinates } = useMyCoordinates();
  const homeChargers = useMemo(() => chargers.filter((c) => c.deployment === "domicile"), [chargers]);

  useEffect(() => {
    try { localStorage.setItem(SK, JSON.stringify(cfg)); } catch { /* ignore */ }
  }, [cfg]);

  // Pré-remplissage à l'ouverture (champs vides seulement) : conseiller du devis ou du compte.
  useEffect(() => {
    if (!open) return;
    setCfg((c) => ({
      ...c,
      advisorName: c.advisorName || client.salesRep || coordinates?.name || "",
      advisorEmail: c.advisorEmail || client.salesRepEmail || coordinates?.email || "",
      advisorPhone: c.advisorPhone || client.salesRepPhone || coordinates?.phone || "",
    }));
  }, [open, client.salesRep, client.salesRepEmail, client.salesRepPhone, coordinates?.name, coordinates?.email, coordinates?.phone]);

  const set = (patch: Partial<PropositionFlotteConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const setBorne = (patch: Partial<PropositionFlotteConfig["borne"]>) => setCfg((c) => ({ ...c, borne: { ...c.borne, ...patch } }));
  const setShow = (k: keyof PropositionFlotteConfig["show"], v: boolean) => setCfg((c) => ({ ...c, show: { ...c.show, [k]: v } }));

  const analysis = useMemo(() => analyseFlotte(selection, energy), [selection, energy]);
  const months = Math.max(0, ...analysis.groups.map((g) => g.best.months));
  const borne = borneCost(cfg, months);
  const today = analysis.compared.reduce((s, g) => s + g.today, 0);
  const beev = analysis.compared.reduce((s, g) => s + g.beev, 0) + (analysis.compared.length ? borne.total : 0);
  const canGenerate = analysis.groups.length > 0;

  const pickCharger = (id: string) => {
    const c = homeChargers.find((x) => x.id === id);
    if (!c) { setBorne({ chargerId: "" }); return; }
    const price = Math.round((c.priceHt || 0) + (c.installPriceHt || 0));
    const lines = [...cfg.borne.lines];
    if (price > 0) lines[0] = { label: lines[0]?.label || `${c.powerKw} kW`, priceHt: price };
    setBorne({ chargerId: c.id, name: `${c.brand} ${c.model}`.trim(), image: c.marketingImageUrl || c.image || "", lines });
  };

  const generate = async () => {
    await generatePropositionFlotteDeck({ cfg, selection, energy, clientName: client.company });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proposition flotte (nouveau format)</DialogTitle>
          <DialogDescription>
            Présentation 16:9 prête à envoyer : économie totale, origine de l'économie, une page par véhicule recommandé face à
            la flotte actuelle, offre borne à domicile en option, annexes chiffrées. Générée depuis votre sélection et vos groupes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ce que contient la sélection */}
          <div className={`rounded-lg border p-3 text-sm ${canGenerate ? "bg-muted/40" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
            {canGenerate ? (
              <>
                <p>
                  <b>{analysis.groups.length}</b> groupe{analysis.groups.length > 1 ? "s" : ""}
                  {" · "}<b>{analysis.compared.length}</b> comparé{analysis.compared.length > 1 ? "s" : ""} à la flotte actuelle
                  {analysis.compared.length > 0 && <> · économie <b>{eur(today - beev)}</b> ({eur(today)} → {eur(beev)})</>}
                </p>
                {analysis.compared.length === 0 && (
                  <p className="mt-1 text-muted-foreground text-xs">
                    Sans véhicule « flotte actuelle » dans un groupe, les pages Synthèse et « D'où vient l'économie » ne sont pas générées.
                  </p>
                )}
              </>
            ) : (
              <p className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                Sélectionnez au moins un véhicule proposé avec un loyer négocié pour générer la présentation.
              </p>
            )}
            {analysis.skipped.length > 0 && (
              <p className="mt-1.5 flex items-start gap-2 text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {analysis.skipped.length} véhicule{analysis.skipped.length > 1 ? "s" : ""} ignoré{analysis.skipped.length > 1 ? "s" : ""} faute de loyer négocié :{" "}
                {analysis.skipped.map((s) => `${s.vehicle.brand} ${s.vehicle.model}`).join(", ")}.
              </p>
            )}
          </div>

          <Block title="Couverture">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Titre (une ligne par retour à la ligne)</Label>
              <Textarea value={cfg.title} onChange={(e) => set({ title: e.target.value })} rows={2} className="text-sm" />
            </div>
            <Txt label="Sous-titre" value={cfg.subtitle} onChange={(v) => set({ subtitle: v })} />
            <div className="grid grid-cols-3 gap-3">
              <Txt label="N° de devis" value={cfg.reference} onChange={(v) => set({ reference: v })} />
              <Txt label="Date" value={cfg.dateLabel} onChange={(v) => set({ dateLabel: v })} />
              <Num label="Validité (jours)" value={cfg.validityDays} onChange={(v) => set({ validityDays: Math.round(v) })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Txt label="Préparée par" value={cfg.advisorName} onChange={(v) => set({ advisorName: v })} />
              <Txt label="E-mail" value={cfg.advisorEmail} onChange={(v) => set({ advisorEmail: v })} />
              <Txt label="Téléphone" value={cfg.advisorPhone} onChange={(v) => set({ advisorPhone: v })} />
            </div>
          </Block>

          <Block
            title="Offre borne à domicile"
            right={
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={cfg.borne.enabled} onChange={(e) => setBorne({ enabled: e.target.checked })} className="h-4 w-4 accent-beev-bleu" />
                Ajouter l'offre borne
              </label>
            }
          >
            {cfg.borne.enabled ? (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Borne du catalogue</Label>
                    <select
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                      value={cfg.borne.chargerId}
                      onChange={(e) => pickCharger(e.target.value)}
                    >
                      <option value="">Saisie libre</option>
                      {homeChargers.map((c) => <option key={c.id} value={c.id}>{c.brand} {c.model} · {c.powerKw} kW</option>)}
                    </select>
                  </div>
                  <Txt label="Nom affiché" value={cfg.borne.name} onChange={(v) => setBorne({ name: v })} />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Prix installation comprise (HT) · la ligne cochée est comptée dans l'économie</Label>
                  {cfg.borne.lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-[auto_1fr_130px_auto] gap-2 items-center">
                      <input type="radio" name="borne-line" checked={cfg.borne.lineIndex === i} onChange={() => setBorne({ lineIndex: i })} className="h-4 w-4 accent-beev-bleu" title="Ligne comptée dans l'économie" />
                      <Input value={l.label} onChange={(e) => setBorne({ lines: cfg.borne.lines.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} className="h-8 text-sm" placeholder="Monophasé 7,4 kW" />
                      <Input type="number" min={0} value={l.priceHt} onChange={(e) => setBorne({ lines: cfg.borne.lines.map((x, j) => (j === i ? { ...x, priceHt: Number(e.target.value) || 0 } : x)) })} className="h-8 text-sm" />
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={cfg.borne.lines.length <= 1}
                        onClick={() => setBorne({ lines: cfg.borne.lines.filter((_, j) => j !== i), lineIndex: Math.max(0, Math.min(cfg.borne.lineIndex, cfg.borne.lines.length - 2)) })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  {cfg.borne.lines.length < 4 && (
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setBorne({ lines: [...cfg.borne.lines, { label: "", priceHt: 0 }] })}>
                      <Plus className="w-3.5 h-3.5" /> Ajouter un prix
                    </Button>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Le forfait d'installation comprend (une ligne par point)</Label>
                  <Textarea value={cfg.borne.included} onChange={(e) => setBorne({ included: e.target.value })} rows={4} className="text-sm" />
                </div>

                <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t">
                  <Txt label="Supervision" value={cfg.borne.supervisionName} onChange={(v) => setBorne({ supervisionName: v })} />
                  <Num label="€ HT / véhicule / mois" value={cfg.borne.supervisionPriceHt} onChange={(v) => setBorne({ supervisionPriceHt: v })} step={0.5} />
                  <div />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Avantages de la supervision (une ligne par point)</Label>
                  <Textarea value={cfg.borne.supervisionAdvantages} onChange={(e) => setBorne({ supervisionAdvantages: e.target.value })} rows={4} className="text-sm" />
                </div>

                <div className="rounded-md bg-muted/40 p-2.5 space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" checked={cfg.borne.inSavings} onChange={(e) => setBorne({ inSavings: e.target.checked })} className="h-4 w-4 accent-beev-bleu" />
                    Compter la borne et la supervision dans l'économie
                  </label>
                  {cfg.borne.inSavings && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Num label="Bornes comptées" value={cfg.borne.count} onChange={(v) => setBorne({ count: Math.round(v) })} />
                        <Num label="Véhicules supervisés" value={cfg.borne.supervisedVehicles} onChange={(v) => setBorne({ supervisedVehicles: Math.round(v) })} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Ajouté une seule fois au total « avec Beev » : pose {eur(borne.pose)} + supervision {eur(borne.supervision)}
                        {months > 0 ? ` (${months} mois)` : ""} = <b>{eur(borne.total)} HT</b>.
                      </p>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Cochez « Ajouter l'offre borne » pour inclure la page Recharge à domicile et, si vous le souhaitez, son coût dans l'économie.</p>
            )}
          </Block>

          <Block title="Pages à inclure">
            <div className="grid sm:grid-cols-2 gap-2">
              {PAGES.map(([k, label, hint]) => (
                <label key={k} className={`flex items-start gap-2 rounded-md border p-2 cursor-pointer select-none ${k === "recharge" && !cfg.borne.enabled ? "opacity-50" : ""}`}>
                  <input type="checkbox" checked={cfg.show[k]} disabled={k === "recharge" && !cfg.borne.enabled} onChange={(e) => setShow(k, e.target.checked)} className="mt-0.5 h-4 w-4 accent-beev-bleu" />
                  <span className="text-sm"><b className="font-semibold">{label}</b><span className="block text-[11px] text-muted-foreground">{hint}</span></span>
                </label>
              ))}
            </div>
            {cfg.show.why && (
              <div className="grid grid-cols-[1fr_200px] gap-3 pt-2 border-t">
                <Txt label="Témoignage (page Pourquoi Beev, vide = masqué)" value={cfg.quote.text} onChange={(v) => set({ quote: { ...cfg.quote, text: v } })} />
                <Txt label="Auteur" value={cfg.quote.author} onChange={(v) => set({ quote: { ...cfg.quote, author: v } })} />
              </div>
            )}
          </Block>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setCfg({ ...defaultPropositionFlotte(), advisorName: client.salesRep || coordinates?.name || "", advisorEmail: client.salesRepEmail || coordinates?.email || "", advisorPhone: client.salesRepPhone || coordinates?.phone || "" })}>
            <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
            <Button onClick={generate} disabled={!canGenerate} className="gap-1.5">
              <FileDown className="w-4 h-4" /> Générer la présentation
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
