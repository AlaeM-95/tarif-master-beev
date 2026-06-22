// Éditeur « Audit & conseil flotte ». Le commercial part d'une proposition
// pré-remplie (modèle FEV), ajuste le client, le périmètre, les enjeux, les
// livrables et les prix, puis télécharge le PDF (impression navigateur).
// Même charte et même mécanique que le BPU partenariat. État persisté en
// localStorage pour ne pas perdre la saisie.

import { useEffect, useState, type ReactNode } from "react";
import { Plus, Trash2, FileDown, ChevronDown, Presentation, ReceiptText } from "lucide-react";
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
import { generateAuditDeckPdf } from "@/lib/audit-conseil-deck";
import {
  defaultDevisInfo, newDevisLine, newDevisCondition, generateAuditDevisPdf,
  type DevisInfo, type DevisLine, type DevisShow,
} from "@/lib/audit-conseil-devis";

const SK = "beev_audit_conseil_v1";
const SK_DEVIS = "beev_audit_devis_v1";

function loadConfig(): AuditConseilConfig {
  if (typeof window === "undefined") return defaultAuditConseil();
  try {
    const raw = localStorage.getItem(SK);
    if (raw) return { ...defaultAuditConseil(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultAuditConseil();
}

function loadDevis(): DevisInfo {
  if (typeof window === "undefined") return defaultDevisInfo();
  try {
    const raw = localStorage.getItem(SK_DEVIS);
    if (raw) {
      const base = defaultDevisInfo();
      const saved = JSON.parse(raw);
      return { ...base, ...saved, show: { ...base.show, ...(saved.show || {}) } };
    }
  } catch { /* ignore */ }
  return defaultDevisInfo();
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

function RowCard({ enabled = true, onToggle, onDelete, children }: { enabled?: boolean; onToggle?: (b: boolean) => void; onDelete: () => void; children: ReactNode }) {
  return (
    <div className={`rounded-md border bg-card p-2.5 space-y-2 ${enabled ? "" : "opacity-55"}`}>
      <div className="flex items-center justify-between gap-2">
        {onToggle ? (
          <label className="flex items-center gap-2 text-[11px] font-medium cursor-pointer select-none">
            <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 accent-beev-bleu" />
            <span className={enabled ? "" : "text-muted-foreground"}>{enabled ? "Affiché dans le PDF" : "Masqué du PDF"}</span>
          </label>
        ) : <span />}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
      {children}
    </div>
  );
}

// Conteneur repliable simple (sans bouton d'ajout) pour grouper le devis.
function Group({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border border-beev-rose/40">
      <button type="button" className="w-full flex items-center justify-between gap-2 p-2.5 text-left" onClick={() => setOpen(!open)}>
        <span className="text-sm font-semibold flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-beev-rose" />{title}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t p-3 space-y-3">{children}</div>}
    </div>
  );
}

const SHOW_ITEMS: [keyof DevisShow, string][] = [
  ["emitterLegal", "Coordonnées émetteur"],
  ["client", "Bloc client"],
  ["objet", "Objet de la mission"],
  ["table", "Tableau prestations"],
  ["recap", "Récap HT / TVA / TTC"],
  ["deposit", "Acompte / solde"],
  ["conditions", "Conditions"],
  ["acceptance", "Bon pour accord"],
  ["footerLegal", "Mentions légales (pied)"],
];

export function AuditConseilEditor({ open, onOpenChange, clientName }: { open: boolean; onOpenChange: (o: boolean) => void; clientName?: string }) {
  const [cfg, setCfg] = useState<AuditConseilConfig>(loadConfig);
  const [devis, setDevis] = useState<DevisInfo>(loadDevis);
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
    setDevis((d) => ({
      ...d,
      advisor: d.advisor || coordinates?.name || "",
      advisorPhone: d.advisorPhone || coordinates?.phone || "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, coordinates?.name, coordinates?.phone]);

  // Persistance
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(SK, JSON.stringify(cfg)); } catch { /* ignore */ }
  }, [cfg]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(SK_DEVIS, JSON.stringify(devis)); } catch { /* ignore */ }
  }, [devis]);

  // Helpers devis.
  const patchDevis = (p: Partial<DevisInfo>) => setDevis((d) => ({ ...d, ...p }));
  const patchShow = (k: keyof DevisShow, v: boolean) => setDevis((d) => ({ ...d, show: { ...d.show, [k]: v } }));
  const patchLine = (i: number, p: Partial<DevisLine>) => setDevis((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) }));
  const addLine = () => setDevis((d) => ({ ...d, lines: [...d.lines, newDevisLine()] }));
  const delLine = (i: number) => setDevis((d) => ({ ...d, lines: d.lines.filter((_, j) => j !== i) }));
  const patchCond = (i: number, text: string) => setDevis((d) => ({ ...d, conditions: d.conditions.map((c, j) => (j === i ? { ...c, text } : c)) }));
  const toggleCond = (i: number, b: boolean) => setDevis((d) => ({ ...d, conditions: d.conditions.map((c, j) => (j === i ? { ...c, enabled: b } : c)) }));
  const addCond = () => setDevis((d) => ({ ...d, conditions: [...d.conditions, newDevisCondition()] }));
  const delCond = (i: number) => setDevis((d) => ({ ...d, conditions: d.conditions.filter((_, j) => j !== i) }));

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
        <RowCard key={i} enabled={r.enabled !== false} onToggle={(b) => patchArr(key, i, { enabled: b })} onDelete={() => delArr(key, i)}>
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
          <span className="block w-10 h-1 rounded-full bg-beev-rose mb-1" />
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
            <RowCard key={i} enabled={e.enabled !== false} onToggle={(b) => patchArr("enjeux", i, { enabled: b })} onDelete={() => delArr("enjeux", i)}>
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
            <RowCard key={i} enabled={l.enabled !== false} onToggle={(b) => patchArr("livrables", i, { enabled: b })} onDelete={() => delArr("livrables", i)}>
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
            <RowCard key={i} enabled={e.enabled !== false} onToggle={(b) => patchArr("etapes", i, { enabled: b })} onDelete={() => delArr("etapes", i)}>
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
                <Num label="TCO moyen thermique (€/an/véhicule)" value={cfg.comparison.costThermique} onChange={(n) => patch({ comparison: { ...cfg.comparison, costThermique: n } })} />
                <Num label="TCO moyen électrique (€/an/véhicule)" value={cfg.comparison.costElectrique} onChange={(n) => patch({ comparison: { ...cfg.comparison, costElectrique: n } })} />
              </div>
              <Txt
                label="Tailles de flotte comparées (séparées par des virgules)"
                value={cfg.comparison.fleetSizes.join(", ")}
                onChange={(v) => patch({ comparison: { ...cfg.comparison, fleetSizes: v.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0) } })}
              />
              <p className="text-[11px] text-muted-foreground">
                Économie moyenne par véhicule et par an : {(cfg.comparison.costThermique - cfg.comparison.costElectrique).toLocaleString("fr-FR")} €. Saisissez des TCO moyens (loyer, énergie, entretien, assurance, fiscalité). Le PDF projette l'économie par taille de flotte et explique le calcul.
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

        {/* Devis : document de facturation, entièrement piloté par le commercial */}
        <Group title="Devis (document de facturation)">
          <p className="text-[11px] text-muted-foreground">
            Document contractuel chiffré, dérivé de la présentation (client, objet, prestations). Cochez ce que vous voulez afficher. Le client et l'objet sont repris de l'en-tête ci-dessus.
          </p>

          {/* Sections affichées */}
          <div className="rounded-md border bg-card p-2.5 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sections affichées</div>
            <div className="grid grid-cols-3 gap-y-1.5 gap-x-2">
              {SHOW_ITEMS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-[11px] cursor-pointer select-none">
                  <input type="checkbox" checked={devis.show[key]} onChange={(e) => patchShow(key, e.target.checked)} className="h-4 w-4 accent-beev-bleu" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Informations du devis */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              <Txt label="N° de devis" value={devis.number} onChange={(v) => patchDevis({ number: v })} />
              <Txt label="Date d'émission" value={devis.issueDate} onChange={(v) => patchDevis({ issueDate: v })} />
              <Txt label="Validité jusqu'au" value={devis.validityDate} onChange={(v) => patchDevis({ validityDate: v })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Txt label="Contact conseiller" value={devis.advisorPhone} onChange={(v) => patchDevis({ advisorPhone: v })} placeholder="+33 6…" />
              <Num label="TVA (%)" value={devis.tvaRate} onChange={(n) => patchDevis({ tvaRate: n })} />
              <Num label="Acompte (%)" value={devis.depositPct} onChange={(n) => patchDevis({ depositPct: n })} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Adresse du client</Label>
              <Textarea rows={2} value={devis.clientAddress} onChange={(e) => patchDevis({ clientAddress: e.target.value })} className="text-xs" placeholder="Adresse postale du client" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Txt label="Contact client" value={devis.clientContact} onChange={(v) => patchDevis({ clientContact: v })} placeholder="À l'attention de…" />
              <Txt label="Référence" value={devis.clientRef} onChange={(v) => patchDevis({ clientRef: v })} placeholder="Réf. interne client" />
              <Txt label="SIRET émetteur (Beev)" value={devis.siret} onChange={(v) => patchDevis({ siret: v })} placeholder="à compléter" />
              <Txt label="IBAN (optionnel)" value={devis.iban} onChange={(v) => patchDevis({ iban: v })} placeholder="FR76…" />
            </div>
          </div>

          {/* Lignes de prestations */}
          <Section title="Lignes de prestations" count={devis.lines.length} onAdd={addLine} addLabel="Ajouter une ligne">
            {devis.lines.map((l, i) => (
              <RowCard key={i} enabled={l.enabled !== false} onToggle={(b) => patchLine(i, { enabled: b })} onDelete={() => delLine(i)}>
                <Txt label="Désignation" value={l.designation} onChange={(v) => patchLine(i, { designation: v })} />
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Détail (une puce par ligne, préfixe « - »)</Label>
                  <Textarea rows={3} value={l.detail} onChange={(e) => patchLine(i, { detail: e.target.value })} className="text-xs" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Num label="Qté" value={l.qty} onChange={(n) => patchLine(i, { qty: n })} />
                  <Txt label="Unité" value={l.unit} onChange={(v) => patchLine(i, { unit: v })} />
                  <Num label="PU HT (€)" value={l.unitPriceHt} onChange={(n) => patchLine(i, { unitPriceHt: n })} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  <label className="flex items-center gap-2 text-[11px] cursor-pointer select-none">
                    <input type="checkbox" checked={!!l.isOption} onChange={(e) => patchLine(i, { isOption: e.target.checked })} className="h-4 w-4 accent-beev-bleu" /> Option (exclue du total)
                  </label>
                  <label className="flex items-center gap-2 text-[11px] cursor-pointer select-none">
                    <input type="checkbox" checked={!!l.isRecurring} onChange={(e) => patchLine(i, { isRecurring: e.target.checked })} className="h-4 w-4 accent-beev-bleu" /> Mensuel ( / mois)
                  </label>
                </div>
              </RowCard>
            ))}
          </Section>

          {/* Conditions */}
          <Section title="Conditions" count={devis.conditions.length} onAdd={addCond} addLabel="Ajouter une condition">
            {devis.conditions.map((c, i) => (
              <RowCard key={i} enabled={c.enabled !== false} onToggle={(b) => toggleCond(i, b)} onDelete={() => delCond(i)}>
                <Textarea rows={2} value={c.text} onChange={(e) => patchCond(i, e.target.value)} className="text-xs" />
              </RowCard>
            ))}
          </Section>

          {/* Acceptation + mentions */}
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Texte « Bon pour accord »</Label>
              <Textarea rows={2} value={devis.acceptanceText} onChange={(e) => patchDevis({ acceptanceText: e.target.value })} className="text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Mentions légales (pied de page)</Label>
              <Textarea rows={2} value={devis.footerLegal} onChange={(e) => patchDevis({ footerLegal: e.target.value })} className="text-xs" />
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setDevis(defaultDevisInfo({ preparedBy: cfg.preparedBy }))}>Réinitialiser le devis</Button>
          </div>
        </Group>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setCfg(defaultAuditConseil())}>Réinitialiser</Button>
          <Button variant="outline" className="gap-2" onClick={() => generateAuditDeckPdf(cfg)}>
            <Presentation className="w-4 h-4" /> Présentation (16:9)
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => generateAuditConseilPdf(cfg)}>
            <FileDown className="w-4 h-4" /> Proposition
          </Button>
          <Button className="gap-2" onClick={() => generateAuditDevisPdf(cfg, devis)}>
            <ReceiptText className="w-4 h-4" /> Devis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
