// Éditeur « Catalogue TCO » : génère la présentation d'analyse TCO (16:9) à partir
// du catalogue et de la SÉLECTION du commercial (véhicules proposés, flotte actuelle,
// groupes de comparaison, loyers, durées, km). Le commercial ne saisit que ce qui ne
// se déduit pas : titre, destinataires, conseiller, phrases d'accroche, étapes.
// État persisté en localStorage ; pré-remplissage depuis le devis et le compte.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FileDown, Plus, Trash2, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/image-upload";
import { useMyCoordinates } from "@/lib/users";
import type { SelectedVehicle } from "@/lib/pdf";
import type { EnergyParams } from "@/lib/store";
import {
  analyseSelection, buildGroups, buildModelCards, defaultCatalogueTco, generateCatalogueTcoDeck,
  type CatalogueTcoConfig,
} from "@/lib/catalogue-tco-deck";

const SK = "beev_catalogue_tco_v1";

function loadConfig(): CatalogueTcoConfig {
  const base = defaultCatalogueTco();
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(SK);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<CatalogueTcoConfig>;
      // La date est celle du jour tant que le commercial ne l'a pas modifiée à la main.
      return { ...base, ...saved, show: { ...base.show, ...(saved.show ?? {}) }, notes: saved.notes ?? {} };
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

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

const PAGES: Array<[keyof CatalogueTcoConfig["show"], string, string]> = [
  ["overview", "Vos devis", "Les loyers, modèle par modèle"],
  ["vehicles", "Une page par véhicule", "Photo, loyers et caractéristiques du catalogue"],
  ["monthly", "Ce que vous payez vraiment", "Coût mensuel tout compris, par groupe, face à la flotte actuelle"],
  ["why", "Pourquoi c'est moins cher", "Loyer, énergie, taxes et avantage en nature (nécessite une flotte actuelle)"],
  ["annex", "Annexe", "Détail de chaque composante sur la durée du contrat"],
  ["steps", "Prochaines étapes", "Étapes et coordonnées du conseiller"],
];

export function CatalogueTcoEditor({
  open, onOpenChange, selection, energy, client,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selection: SelectedVehicle[];
  energy: EnergyParams;
  client: { company: string; contact: string };
}) {
  const [cfg, setCfg] = useState<CatalogueTcoConfig>(loadConfig);
  const { coordinates } = useMyCoordinates();

  useEffect(() => {
    try { localStorage.setItem(SK, JSON.stringify(cfg)); } catch { /* ignore */ }
  }, [cfg]);

  // Pré-remplissage à l'ouverture : champs vides seulement (jamais d'écrasement).
  useEffect(() => {
    if (!open) return;
    setCfg((c) => ({
      ...c,
      recipients: c.recipients || client.contact || "",
      advisorName: c.advisorName || coordinates?.name || "",
      advisorEmail: c.advisorEmail || coordinates?.email || "",
      advisorPhone: c.advisorPhone || coordinates?.phone || "",
    }));
  }, [open, client.contact, coordinates?.name, coordinates?.email, coordinates?.phone]);

  const set = (patch: Partial<CatalogueTcoConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const setShow = (k: keyof CatalogueTcoConfig["show"], v: boolean) => setCfg((c) => ({ ...c, show: { ...c.show, [k]: v } }));

  const analysis = useMemo(() => analyseSelection(selection, energy), [selection, energy]);
  const cards = useMemo(() => buildModelCards(analysis.lines.filter((l) => !l.isCurrent)), [analysis]);
  const groups = useMemo(() => buildGroups(analysis.lines), [analysis]);
  const hasCurrent = analysis.lines.some((l) => l.isCurrent);
  const canGenerate = cards.length > 0;

  const generate = async () => {
    await generateCatalogueTcoDeck({ cfg, selection, energy, clientName: client.company });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catalogue TCO</DialogTitle>
          <DialogDescription>
            Présentation d'analyse TCO prête à envoyer, générée depuis votre sélection : loyers, coût mensuel tout compris,
            comparaison avec la flotte actuelle et annexe de calcul.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ce que contient la sélection */}
          <div className={`rounded-lg border p-3 text-sm ${canGenerate ? "bg-muted/40" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
            {canGenerate ? (
              <p>
                <b>{cards.length}</b> modèle{cards.length > 1 ? "s" : ""} proposé{cards.length > 1 ? "s" : ""}
                {" · "}<b>{groups.length}</b> groupe{groups.length > 1 ? "s" : ""} de comparaison
                {" · "}flotte actuelle : <b>{hasCurrent ? "oui" : "non"}</b>
                {!hasCurrent && <span className="text-muted-foreground"> (sans flotte actuelle, les pages de comparaison sont allégées)</span>}
              </p>
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
            <Txt label="Titre" value={cfg.title} onChange={(v) => set({ title: v })} />
            <Txt label="Sous-titre" value={cfg.subtitle} onChange={(v) => set({ subtitle: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Txt label="Date affichée" value={cfg.dateLabel} onChange={(v) => set({ dateLabel: v })} />
              <Txt label="Pour (destinataires)" value={cfg.recipients} onChange={(v) => set({ recipients: v })} placeholder="Élodie Maquigneau et Charles" />
            </div>
          </Block>

          <Block title="Pages à inclure">
            <div className="grid sm:grid-cols-2 gap-2">
              {PAGES.map(([k, label, hint]) => (
                <label key={k} className="flex items-start gap-2 rounded-md border p-2 cursor-pointer select-none">
                  <input type="checkbox" checked={cfg.show[k]} onChange={(e) => setShow(k, e.target.checked)} className="mt-0.5 h-4 w-4 accent-beev-bleu" />
                  <span className="text-sm"><b className="font-semibold">{label}</b><span className="block text-[11px] text-muted-foreground">{hint}</span></span>
                </label>
              ))}
            </div>
          </Block>

          {cards.length > 0 && cfg.show.vehicles && (
            <Block title="Phrase d'accroche par véhicule">
              <p className="text-[11px] text-muted-foreground -mt-1">
                Laissez vide pour une phrase automatique (loyer le plus bas, meilleure autonomie, plus grand coffre de la sélection).
              </p>
              {cards.map((c) => (
                <div key={c.key} className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">{c.rep.name} {c.rep.version}</Label>
                  <Input
                    value={cfg.notes[c.rep.key] ?? ""}
                    onChange={(e) => set({ notes: { ...cfg.notes, [c.rep.key]: e.target.value } })}
                    placeholder="Ex. L'alternative à la Model Y : même famille que vos Octavia actuelles."
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </Block>
          )}

          {cfg.show.steps && (
            <Block title="Prochaines étapes et conseiller">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Titre de la dernière page</Label>
                <Textarea value={cfg.closingTitle} onChange={(e) => set({ closingTitle: e.target.value })} rows={2} className="text-sm" />
              </div>
              {cfg.steps.map((s, i) => (
                <div key={i} className="grid grid-cols-[170px_1fr_auto] gap-2 items-start">
                  <Input value={s.when} onChange={(e) => set({ steps: cfg.steps.map((x, j) => (j === i ? { ...x, when: e.target.value } : x)) })} placeholder="Novembre" className="h-8 text-sm" />
                  <Input value={s.text} onChange={(e) => set({ steps: cfg.steps.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} placeholder="Ce qui se passe" className="h-8 text-sm" />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => set({ steps: cfg.steps.filter((_, j) => j !== i) })}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
              {cfg.steps.length < 6 && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => set({ steps: [...cfg.steps, { when: "", text: "" }] })}>
                  <Plus className="w-3.5 h-3.5" /> Ajouter une étape
                </Button>
              )}
              <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t">
                <Txt label="Conseiller" value={cfg.advisorName} onChange={(v) => set({ advisorName: v })} />
                <Txt label="Fonction" value={cfg.advisorRole} onChange={(v) => set({ advisorRole: v })} />
                <Txt label="E-mail" value={cfg.advisorEmail} onChange={(v) => set({ advisorEmail: v })} />
                <Txt label="Téléphone" value={cfg.advisorPhone} onChange={(v) => set({ advisorPhone: v })} />
              </div>
              <ImageUpload currentUrl={cfg.advisorPhotoUrl} onChange={(url) => set({ advisorPhotoUrl: url })} folder="pdf" label="Photo du conseiller (facultatif)" />
            </Block>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setCfg({ ...defaultCatalogueTco(), advisorName: coordinates?.name ?? "", advisorEmail: coordinates?.email ?? "", advisorPhone: coordinates?.phone ?? "", recipients: client.contact })}>
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
