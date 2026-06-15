// Éditeur « Audit & conseil flotte ». Le commercial part d'une proposition
// pré-remplie (modèle FEV), ajuste le client, le périmètre, les enjeux, les
// livrables et les prix, puis télécharge le PDF (impression navigateur).
// Même charte et même mécanique que le BPU partenariat. État persisté en
// localStorage pour ne pas perdre la saisie.

import { useEffect, useState, type ReactNode } from "react";
import { Plus, Trash2, FileDown, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/image-upload";
import { useMyCoordinates } from "@/lib/users";
import {
  defaultAuditConseil, newEnjeu, newLivrable, newTarifRow, newEtape, generateAuditConseilPdf,
  type AuditConseilConfig, type AuditTarifRow,
} from "@/lib/audit-conseil";

const SK = "beev_audit_conseil_v1";

function loadConfig(): AuditConseilConfig {
  if (typeof window === "undefined") return defaultAuditConseil();
  try {
    const raw = localStorage.getItem(SK);
    if (raw) return { ...defaultAuditConseil(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultAuditConseil();
}

function Txt({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 text-sm" />
    </div>
  );
}
function Num({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</Label>
      <Input type="number" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
    </div>
  );
}

// Section repliable réutilisable (enjeux, livrables, tarifs, étapes).
function Section({ title, count, children, onAdd, addLabel }: { title: string; count: number; children: ReactNode; onAdd: () => void; addLabel: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border">
      <button type="button" className="w-full flex items-center justify-between gap-2 p-2.5 text-left" onClick={() => setOpen(!open)}>
        <span className="text-sm font-semibold">{title} <span className="text-muted-foreground font-normal">({count})</span></span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t p-3 space-y-2.5">
          {children}
          <Button variant="outline" size="sm" className="w-full gap-1" onClick={onAdd}><Plus className="w-3.5 h-3.5" /> {addLabel}</Button>
        </div>
      )}
    </div>
  );
}

function RowCard({ onDelete, children }: { onDelete: () => void; children: ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-2.5 space-y-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
      {children}
    </div>
  );
}

export function AuditConseilEditor({ open, onOpenChange, clientName }: { open: boolean; onOpenChange: (o: boolean) => void; clientName?: string }) {
  const [cfg, setCfg] = useState<AuditConseilConfig>(loadConfig);
  const { coordinates } = useMyCoordinates();

  // Pré-remplit le nom client (depuis le devis) et le commercial (depuis le
  // compte connecté) si ces champs sont vides.
  useEffect(() => {
    if (!open) return;
    setCfg((c) => ({
      ...c,
      clientName: c.clientName || clientName || "",
      preparedBy: c.preparedBy || coordinates?.name || "",
      signature: c.signature || coordinates?.name || "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, coordinates?.name]);

  // Persistance
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(SK, JSON.stringify(cfg)); } catch { /* ignore */ }
  }, [cfg]);

  // Clés des sections en liste (enjeux, livrables, étapes, tarifs).
  type ArrKey = "enjeux" | "livrables" | "etapes" | "tarifsSansEngagement" | "tarifsAvecEngagement";

  const patch = (p: Partial<AuditConseilConfig>) => setCfg((c) => ({ ...c, ...p }));
  const patchArr = (key: ArrKey, idx: number, p: Record<string, unknown>) =>
    setCfg((c) => ({ ...c, [key]: (c[key] as any[]).map((it, i) => (i === idx ? { ...it, ...p } : it)) }) as AuditConseilConfig);
  const addArr = (key: ArrKey, item: unknown) =>
    setCfg((c) => ({ ...c, [key]: [...(c[key] as any[]), item] }) as AuditConseilConfig);
  const delArr = (key: ArrKey, idx: number) =>
    setCfg((c) => ({ ...c, [key]: (c[key] as any[]).filter((_, i) => i !== idx) }) as AuditConseilConfig);

  const tarifSection = (key: "tarifsSansEngagement" | "tarifsAvecEngagement", title: string) => (
    <Section title={title} count={cfg[key].length} onAdd={() => addArr(key, newTarifRow())} addLabel="Ajouter une ligne">
      {cfg[key].map((r: AuditTarifRow, i) => (
        <RowCard key={i} onDelete={() => delArr(key, i)}>
          <Txt label="Prestation" value={r.prestation} onChange={(v) => patchArr(key, i, { prestation: v })} />
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Sous-titre</Label>
            <Textarea rows={2} value={r.sub} onChange={(e) => patchArr(key, i, { sub: e.target.value })} className="text-xs" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Txt label="Modalité" value={r.modalite} onChange={(v) => patchArr(key, i, { modalite: v })} />
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Couleur</Label>
              <select
                value={r.modaliteStyle}
                onChange={(e) => patchArr(key, i, { modaliteStyle: e.target.value as AuditTarifRow["modaliteStyle"] })}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="rose">Rose</option>
                <option value="bleu">Bleu</option>
                <option value="neutre">Neutre</option>
              </select>
            </div>
            <Txt label="Tarif HT" value={r.tarif} onChange={(v) => patchArr(key, i, { tarif: v })} />
          </div>
        </RowCard>
      ))}
    </Section>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Audit & conseil flotte</DialogTitle>
          <DialogDescription>
            Construisez la proposition d'audit et de recommandation flotte (approche TCO). Le PDF s'ouvre dans un nouvel onglet : utilisez « Enregistrer en PDF » dans la boîte d'impression.
          </DialogDescription>
        </DialogHeader>

        {/* En-tête : client, logo, périmètre */}
        <div className="space-y-3 rounded-lg border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Txt label="Nom du client" value={cfg.clientName} onChange={(v) => patch({ clientName: v })} placeholder="Ex : FEV Group France" />
            <Txt label="Date / période" value={cfg.date} onChange={(v) => patch({ date: v })} placeholder="Avril 2026" />
          </div>
          <Txt label="Titre de la proposition" value={cfg.title} onChange={(v) => patch({ title: v })} />
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Ligne d'approche (sous le titre)</Label>
            <Textarea rows={2} value={cfg.approach} onChange={(e) => patch({ approach: e.target.value })} className="text-xs" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Txt label="Périmètre (chip)" value={cfg.fleetSize} onChange={(v) => patch({ fleetSize: v })} placeholder="~80 véhicules" />
            <Txt label="Sites (chip)" value={cfg.sites} onChange={(v) => patch({ sites: v })} placeholder="Rouen · Trappes" />
            <Txt label="Préparé par" value={cfg.preparedBy} onChange={(v) => patch({ preparedBy: v })} placeholder="Commercial Beev" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Logo du client (hero)</Label>
            <ImageUpload currentUrl={cfg.clientLogoUrl} onChange={(url) => patch({ clientLogoUrl: url })} folder="client-logos" label="Logo client" />
          </div>
        </div>

        {/* Enjeux */}
        <Section title="Contexte & enjeux identifiés" count={cfg.enjeux.length} onAdd={() => addArr("enjeux", newEnjeu())} addLabel="Ajouter un enjeu">
          {cfg.enjeux.map((e, i) => (
            <RowCard key={i} onDelete={() => delArr("enjeux", i)}>
              <Txt label="Titre" value={e.title} onChange={(v) => patchArr("enjeux", i, { title: v })} />
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Description</Label>
                <Textarea rows={2} value={e.text} onChange={(ev) => patchArr("enjeux", i, { text: ev.target.value })} className="text-xs" />
              </div>
            </RowCard>
          ))}
        </Section>

        {/* Livrables */}
        <Section title="Ce que comprend l'audit" count={cfg.livrables.length} onAdd={() => addArr("livrables", newLivrable())} addLabel="Ajouter un livrable">
          {cfg.livrables.map((l, i) => (
            <RowCard key={i} onDelete={() => delArr("livrables", i)}>
              <Txt label={`Livrable ${String(i + 1).padStart(2, "0")}`} value={l.title} onChange={(v) => patchArr("livrables", i, { title: v })} />
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Description</Label>
                <Textarea rows={2} value={l.text} onChange={(ev) => patchArr("livrables", i, { text: ev.target.value })} className="text-xs" />
              </div>
            </RowCard>
          ))}
        </Section>

        {/* Tarifs */}
        {tarifSection("tarifsSansEngagement", "Tarification sans engagement")}
        {tarifSection("tarifsAvecEngagement", "Tarification avec engagement")}

        {/* Étapes */}
        <Section title="Processus" count={cfg.etapes.length} onAdd={() => addArr("etapes", newEtape())} addLabel="Ajouter une étape">
          {cfg.etapes.map((e, i) => (
            <RowCard key={i} onDelete={() => delArr("etapes", i)}>
              <Txt label={`Étape ${i + 1}`} value={e.title} onChange={(v) => patchArr("etapes", i, { title: v })} />
              <Txt label="Description courte" value={e.text} onChange={(v) => patchArr("etapes", i, { text: v })} />
            </RowCard>
          ))}
        </Section>

        {/* Comparaison économique thermique vs électrique */}
        <div className="space-y-3 rounded-lg border p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cfg.comparison.enabled}
              onChange={(e) => patch({ comparison: { ...cfg.comparison, enabled: e.target.checked } })}
              className="h-4 w-4 accent-beev-bleu"
            />
            <span className="text-sm font-semibold">Graphique comparaison économique (thermique vs électrique)</span>
          </label>
          {cfg.comparison.enabled && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <Num label="Coût thermique (€/an/véhicule)" value={cfg.comparison.costThermique} onChange={(n) => patch({ comparison: { ...cfg.comparison, costThermique: n } })} />
                <Num label="Coût électrique (€/an/véhicule)" value={cfg.comparison.costElectrique} onChange={(n) => patch({ comparison: { ...cfg.comparison, costElectrique: n } })} />
              </div>
              <Txt
                label="Tailles de flotte comparées (séparées par des virgules)"
                value={cfg.comparison.fleetSizes.join(", ")}
                onChange={(v) => patch({ comparison: { ...cfg.comparison, fleetSizes: v.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0) } })}
              />
              <p className="text-[11px] text-muted-foreground">
                Économie annuelle par véhicule : {(cfg.comparison.costThermique - cfg.comparison.costElectrique).toLocaleString("fr-FR")} €. Le graphique projette le coût total et l'économie pour chaque taille de flotte.
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="space-y-3 rounded-lg border p-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Bandeau de lancement</Label>
            <Textarea rows={3} value={cfg.ctaText} onChange={(e) => patch({ ctaText: e.target.value })} className="text-xs" />
          </div>
          <Txt label="Signature (commercial)" value={cfg.signature} onChange={(v) => patch({ signature: v })} placeholder="Nom Prénom" />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setCfg(defaultAuditConseil())}>Réinitialiser</Button>
          <Button className="gap-2" onClick={() => generateAuditConseilPdf(cfg)}>
            <FileDown className="w-4 h-4" /> Télécharger la proposition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
