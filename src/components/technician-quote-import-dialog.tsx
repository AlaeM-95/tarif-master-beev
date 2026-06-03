// Dialog d'import des lignes d'un devis technicien parsé par Claude API.
// Ouvert depuis le bouton "Détecter les lignes" sous l'upload du PDF dans
// SelectedChargerRow. Permet au commercial de :
//   - voir le supplier / numéro / date / total détectés
//   - cocher/décocher les lignes à importer
//   - éditer label / qty / unitHt avant import
//   - choisir entre 'ajouter au chiffrage existant' et 'remplacer le chiffrage'
//
// Une fois validé, onConfirm est appelé avec la liste finale de LineItem
// (le composant parent fusionne dans sc.lineItems).

import { useEffect, useState } from "react";
import { Loader2, Sparkles, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { parseTechnicianQuote, type ParsedQuote, type ParsedQuoteLine } from "@/lib/technician-quote";
import type { LineItem } from "@/lib/catalog";

type Mode = "append" | "replace";

type EditableLine = ParsedQuoteLine & { selected: boolean };

const fmtEur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function TechnicianQuoteImportDialog({
  open,
  onOpenChange,
  pdfUrl,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pdfUrl?: string;
  onConfirm: (items: LineItem[], mode: Mode) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedQuote | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("append");

  // Reset à chaque ouverture
  useEffect(() => {
    if (!open) return;
    setParsed(null);
    setLines([]);
    setError(null);
    setMode("append");
    if (!pdfUrl) {
      setError("Aucun PDF de devis uploadé. Téléversez d'abord le PDF du devis technicien.");
      return;
    }
    setLoading(true);
    parseTechnicianQuote(pdfUrl)
      .then((r) => {
        setParsed(r);
        setLines(r.lines.map((l) => ({ ...l, selected: true })));
      })
      .catch((e: Error) => setError(e.message ?? "Erreur inconnue."))
      .finally(() => setLoading(false));
  }, [open, pdfUrl]);

  const selectedLines = lines.filter((l) => l.selected);
  const detectedTotal = selectedLines.reduce((s, l) => s + l.qty * l.unitHt, 0);

  const updateLine = (i: number, patch: Partial<EditableLine>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const handleConfirm = () => {
    const items: LineItem[] = selectedLines.map((l) => ({
      label: l.label,
      qty: l.qty,
      unitHt: l.unitHt,
    }));
    if (items.length === 0) {
      toast.error("Sélectionnez au moins une ligne.");
      return;
    }
    onConfirm(items, mode);
    onOpenChange(false);
    toast.success(`${items.length} ligne${items.length > 1 ? "s" : ""} importée${items.length > 1 ? "s" : ""}.`);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#3809EA]" />
            Importer les lignes du devis technicien
          </AlertDialogTitle>
          <AlertDialogDescription>
            Lecture du PDF par Claude API. Vérifiez les lignes détectées avant import dans le chiffrage.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#3809EA]" />
            <p className="text-sm text-muted-foreground">Analyse du devis en cours…</p>
            <p className="text-xs text-muted-foreground">15-30 secondes selon la taille du PDF.</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-3 rounded-md border border-destructive/30 bg-destructive/5">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-destructive mb-1">Échec de l'analyse</p>
              <p className="text-foreground">{error}</p>
              <p className="text-muted-foreground mt-2">
                Vérifiez que la clé <code className="bg-muted px-1 py-0.5 rounded">ANTHROPIC_API_KEY</code> est bien configurée
                dans Supabase Edge Functions, ou que l'Edge Function a été déployée.
              </p>
            </div>
          </div>
        )}

        {parsed && !error && (
          <>
            {/* Métadonnées détectées */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-md bg-secondary/30 text-xs">
              <Meta label="Fournisseur" value={parsed.supplier || "—"} />
              <Meta label="N° devis" value={parsed.quoteNumber || "—"} />
              <Meta label="Date" value={parsed.quoteDate || "—"} />
              <Meta label="Total HT (devis)" value={parsed.totalHt > 0 ? fmtEur(parsed.totalHt) : "—"} />
            </div>

            {/* Lignes détectées (éditables) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase text-muted-foreground">
                  {lines.length} ligne{lines.length > 1 ? "s" : ""} détectée{lines.length > 1 ? "s" : ""}
                </Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs"
                    onClick={() => setLines((p) => p.map((l) => ({ ...l, selected: true })))}>
                    Tout cocher
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs"
                    onClick={() => setLines((p) => p.map((l) => ({ ...l, selected: false })))}>
                    Tout décocher
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {lines.map((l, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-md border bg-card">
                    <Checkbox
                      checked={l.selected}
                      onCheckedChange={(v) => updateLine(i, { selected: v === true })}
                      className="mt-1"
                    />
                    <div className="flex-1 grid grid-cols-12 gap-2">
                      <Input
                        value={l.label}
                        onChange={(e) => updateLine(i, { label: e.target.value })}
                        className="col-span-12 text-xs h-7"
                        placeholder="Désignation"
                      />
                      <Input
                        type="number"
                        value={l.qty}
                        onChange={(e) => updateLine(i, { qty: Number(e.target.value) || 0 })}
                        className="col-span-3 text-xs h-7"
                        placeholder="Qté"
                        step="0.01"
                      />
                      <Input
                        value={l.unit}
                        onChange={(e) => updateLine(i, { unit: e.target.value })}
                        className="col-span-3 text-xs h-7"
                        placeholder="Unité"
                      />
                      <Input
                        type="number"
                        value={l.unitHt}
                        onChange={(e) => updateLine(i, { unitHt: Number(e.target.value) || 0 })}
                        className="col-span-3 text-xs h-7"
                        placeholder="PU HT"
                        step="0.01"
                      />
                      <div className="col-span-3 text-xs flex items-center justify-end font-semibold">
                        {fmtEur(l.qty * l.unitHt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total sélectionné vs total devis */}
              <div className="flex items-center justify-between text-xs p-2 rounded-md bg-secondary/40">
                <span>
                  <span className="text-muted-foreground">Total sélectionné HT : </span>
                  <span className="font-bold">{fmtEur(detectedTotal)}</span>
                </span>
                {parsed.totalHt > 0 && (
                  <span className={Math.abs(detectedTotal - parsed.totalHt) < 0.5 ? "text-emerald-600" : "text-amber-600"}>
                    {Math.abs(detectedTotal - parsed.totalHt) < 0.5 ? (
                      <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> correspond au total devis</span>
                    ) : (
                      <>Écart : {fmtEur(detectedTotal - parsed.totalHt)}</>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Mode d'import */}
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="grid grid-cols-2 gap-2">
              <label className={`flex items-start gap-2 p-3 rounded-md border cursor-pointer ${mode === "append" ? "border-[#3809EA] bg-[#3809EA]/5" : "border-border"}`}>
                <RadioGroupItem value="append" className="mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold">Ajouter au chiffrage</p>
                  <p className="text-muted-foreground">Conserve les lignes existantes et ajoute les nouvelles.</p>
                </div>
              </label>
              <label className={`flex items-start gap-2 p-3 rounded-md border cursor-pointer ${mode === "replace" ? "border-[#3809EA] bg-[#3809EA]/5" : "border-border"}`}>
                <RadioGroupItem value="replace" className="mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold">Remplacer le chiffrage</p>
                  <p className="text-muted-foreground">Supprime toutes les lignes actuelles et utilise uniquement celles détectées.</p>
                </div>
              </label>
            </RadioGroup>
          </>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          {parsed && !error && (
            <AlertDialogAction onClick={handleConfirm}>
              Importer {selectedLines.length} ligne{selectedLines.length > 1 ? "s" : ""}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</p>
      <p className="font-medium truncate" title={value}>{value}</p>
    </div>
  );
}
