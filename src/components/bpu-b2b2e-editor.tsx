// Éditeur de BPU B2B2E « tarification partenariat ». Le commercial définit le
// nom + logo du client et les prix (équipement mono/tri, installation mono/tri,
// grille de suppléments) par borne, puis télécharge le PDF (impression).
// L'état est persisté en localStorage pour ne pas perdre la saisie.

import { useEffect, useState } from "react";
import { Plus, Trash2, FileDown, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/image-upload";
import {
  defaultBpuB2B2E, newBpuBorne, generateBpuB2B2EPdf,
  type BpuB2B2EConfig, type BpuBorne, type BpuSupplement,
} from "@/lib/bpu-b2b2e";

const SK = "beev_bpu_b2b2e_v1";          // infos client (et ancien format combiné)
const SK_BORNES = "beev_bpu_bornes_v1";  // bibliothèque de bornes, persistante et indépendante du client

// Charge la config en combinant : les infos client (clé SK) et la bibliothèque
// de bornes (clé SK_BORNES). Les bornes sont conservées séparément pour ne plus
// disparaître à la réinitialisation du client. Migration douce : si la
// bibliothèque n'existe pas encore mais que l'ancien format combiné contient
// des bornes, on les récupère.
function loadConfig(): BpuB2B2EConfig {
  const base = defaultBpuB2B2E();
  if (typeof window === "undefined") return base;
  let cfg: BpuB2B2EConfig = { ...base };
  try {
    const raw = localStorage.getItem(SK);
    if (raw) cfg = { ...cfg, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  try {
    const rawBornes = localStorage.getItem(SK_BORNES);
    if (rawBornes) {
      const arr = JSON.parse(rawBornes);
      if (Array.isArray(arr)) cfg.bornes = arr; // la bibliothèque fait foi si présente
    }
  } catch { /* ignore */ }
  return cfg;
}

// Petits champs locaux
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

export function BpuB2B2EEditor({ open, onOpenChange, clientName }: { open: boolean; onOpenChange: (o: boolean) => void; clientName?: string }) {
  const [cfg, setCfg] = useState<BpuB2B2EConfig>(loadConfig);
  const [openBorne, setOpenBorne] = useState<string | null>(null);

  // Pré-remplit le nom client depuis le devis si vide.
  useEffect(() => {
    if (open && clientName && !cfg.clientName) setCfg((c) => ({ ...c, clientName }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Persistance des infos client (sans les bornes : elles ont leur propre clé).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const client = { clientName: cfg.clientName, clientLogoUrl: cfg.clientLogoUrl, year: cfg.year, subtitle: cfg.subtitle, scopeLine: cfg.scopeLine };
    try { localStorage.setItem(SK, JSON.stringify(client)); } catch { /* ignore */ }
  }, [cfg.clientName, cfg.clientLogoUrl, cfg.year, cfg.subtitle, cfg.scopeLine]);

  // Persistance de la bibliothèque de bornes : indépendante du client, donc
  // conservée même après une réinitialisation.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(SK_BORNES, JSON.stringify(cfg.bornes)); } catch { /* ignore */ }
  }, [cfg.bornes]);

  const patch = (p: Partial<BpuB2B2EConfig>) => setCfg((c) => ({ ...c, ...p }));
  const patchBorne = (id: string, p: Partial<BpuBorne>) =>
    setCfg((c) => ({ ...c, bornes: c.bornes.map((b) => (b.id === id ? { ...b, ...p } : b)) }));
  const patchSupp = (bid: string, idx: number, p: Partial<BpuSupplement>) =>
    setCfg((c) => ({ ...c, bornes: c.bornes.map((b) => b.id === bid ? { ...b, supplements: b.supplements.map((s, i) => i === idx ? { ...s, ...p } : s) } : b) }));
  const addSupp = (bid: string) =>
    setCfg((c) => ({ ...c, bornes: c.bornes.map((b) => b.id === bid ? { ...b, supplements: [...b.supplements, { label: "Nouvelle prestation", mono: 0, tri: 0 }] } : b) }));
  const delSupp = (bid: string, idx: number) =>
    setCfg((c) => ({ ...c, bornes: c.bornes.map((b) => b.id === bid ? { ...b, supplements: b.supplements.filter((_, i) => i !== idx) } : b) }));
  const addBorne = () => { const b = newBpuBorne(); setCfg((c) => ({ ...c, bornes: [...c.bornes, b] })); setOpenBorne(b.id); };
  const delBorne = (id: string) => setCfg((c) => ({ ...c, bornes: c.bornes.filter((b) => b.id !== id) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>BPU partenariat (nouveau) — B2B2E</DialogTitle>
          <DialogDescription>
            Définissez les prix de la tarification partenariat et le logo du client. Le PDF s'ouvre dans un nouvel onglet : utilisez « Enregistrer en PDF » dans la boîte d'impression.
          </DialogDescription>
        </DialogHeader>

        {/* En-tête : client, logo, année, sous-titres */}
        <div className="space-y-3 rounded-lg border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Txt label="Nom du client" value={cfg.clientName} onChange={(v) => patch({ clientName: v })} placeholder="Ex : Laboratoires Théa" />
            <Txt label="Année" value={cfg.year} onChange={(v) => patch({ year: v })} placeholder="2026" />
          </div>
          <Txt label="Sous-titre" value={cfg.subtitle} onChange={(v) => patch({ subtitle: v })} placeholder="Recharge à domicile des collaborateurs" />
          <Txt label="Périmètre" value={cfg.scopeLine} onChange={(v) => patch({ scopeLine: v })} placeholder="Installation toute France métropolitaine" />
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Logo du client (page de garde)</Label>
            <ImageUpload currentUrl={cfg.clientLogoUrl} onChange={(url) => patch({ clientLogoUrl: url })} folder="client-logos" label="Logo client" />
          </div>
        </div>

        {/* Bornes — bibliothèque persistante */}
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Bibliothèque de bornes : enregistrée et conservée même après réinitialisation du client. Cochez une borne pour la rattacher au BPU du client en cours, décochez pour la garder en bibliothèque sans l'afficher.
          </p>
          {cfg.bornes.map((b, bi) => {
            const isOpen = openBorne === b.id;
            return (
              <div key={b.id} className={`rounded-lg border ${b.enabled === false ? "opacity-55" : ""}`}>
                <div className="flex items-center justify-between gap-2 p-2.5">
                  <label className="flex items-center gap-2 cursor-pointer" title="Afficher cette borne dans le BPU">
                    <input
                      type="checkbox"
                      checked={b.enabled !== false}
                      onChange={(e) => patchBorne(b.id, { enabled: e.target.checked })}
                      className="h-4 w-4 accent-beev-bleu"
                    />
                  </label>
                  <button type="button" className="flex items-center gap-2 flex-1 text-left" onClick={() => setOpenBorne(isOpen ? null : b.id)}>
                    <span className="text-[10px] font-bold bg-beev-rose text-beev-black rounded px-1.5 py-0.5">{String(bi + 1).padStart(2, "0")}</span>
                    <span className="text-sm font-semibold">{b.name || "Borne"}</span>
                    {b.enabled === false && <span className="text-[10px] text-muted-foreground">(masquée)</span>}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => delBorne(b.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
                {isOpen && (
                  <div className="border-t p-3 space-y-3">
                    <Txt label="Nom de la borne" value={b.name} onChange={(v) => patchBorne(b.id, { name: v })} />
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Image de la borne (fiche produit)</Label>
                      <ImageUpload currentUrl={b.imageUrl} onChange={(url) => patchBorne(b.id, { imageUrl: url })} folder="chargers" label="Image borne" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Txt label="Libellé mono" value={b.monoLabel} onChange={(v) => patchBorne(b.id, { monoLabel: v })} />
                      <Txt label="Libellé tri" value={b.triLabel} onChange={(v) => patchBorne(b.id, { triLabel: v })} />
                      <Num label="Équipement mono (€ HT)" value={b.equipMono} onChange={(n) => patchBorne(b.id, { equipMono: n })} />
                      <Num label="Équipement tri (€ HT)" value={b.equipTri} onChange={(n) => patchBorne(b.id, { equipTri: n })} />
                      <Num label="Installation mono (€ HT)" value={b.installMono} onChange={(n) => patchBorne(b.id, { installMono: n })} />
                      <Num label="Installation tri (€ HT)" value={b.installTri} onChange={(n) => patchBorne(b.id, { installTri: n })} />
                      <Txt label="Module de délestage" value={b.delestage} onChange={(v) => patchBorne(b.id, { delestage: v })} />
                      <Txt label="Garantie" value={b.specGarantie} onChange={(v) => patchBorne(b.id, { specGarantie: v })} />
                    </div>
                    <div className="rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
                      Borne + installation (calculé) : mono {(b.equipMono + b.installMono).toLocaleString("fr-FR")} € · tri {(b.equipTri + b.installTri).toLocaleString("fr-FR")} €
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Descriptif « Forfait de base »</Label>
                      <Textarea
                        value={b.forfaitBase ?? ""}
                        onChange={(e) => patchBorne(b.id, { forfaitBase: e.target.value })}
                        rows={3}
                        className="text-xs"
                        placeholder="Forfait de base : 5 à 15 m de câble…"
                      />
                    </div>

                    <details className="rounded-md border">
                      <summary className="cursor-pointer text-xs font-semibold p-2">Caractéristiques techniques</summary>
                      <div className="p-2 grid grid-cols-1 gap-2">
                        <Txt label="Puissance" value={b.specPuissance} onChange={(v) => patchBorne(b.id, { specPuissance: v })} />
                        <Txt label="Câble" value={b.specCable} onChange={(v) => patchBorne(b.id, { specCable: v })} />
                        <Txt label="Supervision" value={b.specSupervision} onChange={(v) => patchBorne(b.id, { specSupervision: v })} />
                        <Txt label="Connectivité" value={b.specConnectivite} onChange={(v) => patchBorne(b.id, { specConnectivite: v })} />
                        <Txt label="Recharge solaire" value={b.specRechargeSolaire} onChange={(v) => patchBorne(b.id, { specRechargeSolaire: v })} />
                        <Txt label="Boîtier" value={b.specBoitier} onChange={(v) => patchBorne(b.id, { specBoitier: v })} />
                      </div>
                    </details>

                    {/* Grille suppléments */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Grille de suppléments</Label>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addSupp(b.id)}><Plus className="w-3 h-3" /> Ligne</Button>
                      </div>
                      <div className="space-y-1">
                        {b.supplements.map((s, si) => (
                          <div key={si} className="grid grid-cols-[1fr_70px_70px_28px] gap-1.5 items-center">
                            <Input value={s.label} onChange={(e) => patchSupp(b.id, si, { label: e.target.value })} className="h-7 text-xs" />
                            <Input type="number" value={s.mono} onChange={(e) => patchSupp(b.id, si, { mono: parseFloat(e.target.value) || 0 })} className="h-7 text-xs text-right" placeholder="mono" />
                            <Input type="number" value={s.tri} onChange={(e) => patchSupp(b.id, si, { tri: parseFloat(e.target.value) || 0 })} className="h-7 text-xs text-right" placeholder="tri" />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => delSupp(b.id, si)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <Button variant="outline" size="sm" className="w-full gap-1" onClick={addBorne}><Plus className="w-3.5 h-3.5" /> Ajouter une borne</Button>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const d = defaultBpuB2B2E();
              // Ne réinitialise que les infos client ; la bibliothèque de bornes est conservée.
              setCfg((c) => ({ ...c, clientName: "", clientLogoUrl: "", year: d.year, subtitle: d.subtitle, scopeLine: d.scopeLine }));
            }}
            title="Vide les informations client. Vos bornes sont conservées."
          >
            Réinitialiser le client
          </Button>
          <Button className="gap-2" onClick={() => generateBpuB2B2EPdf(cfg)} disabled={cfg.bornes.length === 0}>
            <FileDown className="w-4 h-4" /> Télécharger le BPU
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
