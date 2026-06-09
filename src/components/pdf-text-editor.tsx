// Éditeur WYSIWYG des textes du PDF, par devis (overrides locaux non
// persistés en DB globale). Le commercial ouvre ce panneau avant de générer
// le PDF, modifie les libellés / listes nécessaires, puis génère le devis :
// les overrides priment sur la valeur DB et sur le fallback hardcodé.
//
// Workflow simple validé par l'utilisateur (pas d'aperçu en direct) :
// 1. Le commercial ouvre l'éditeur depuis le bouton "Personnaliser le PDF"
// 2. Il modifie les textes nécessaires (search bar + groupes par scope/catégorie)
// 3. Il ferme l'éditeur — les overrides sont persistés en localStorage
// 4. À la prochaine génération PDF, generateProposalPdf reçoit les overrides
//    via le paramètre textOverrides et les applique automatiquement.

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, RotateCcw, X, Sparkles } from "lucide-react";
import { usePdfTexts, type PdfText, type PdfTextOverrides } from "@/lib/pdf-texts";
import type { ProjectType } from "@/lib/catalog";

const STORAGE_KEY = "beev_pdf_text_overrides_v1";

/** Charge / persiste les overrides en localStorage. Un seul jeu d'overrides
 *  par navigateur (assez fin pour un commercial qui n'a qu'un devis actif à
 *  la fois ; multi-devis simultané = améliorations futures). */
export function usePdfTextOverrides() {
  const [overrides, setOverrides] = useState<PdfTextOverrides>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOverrides(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const setOne = (key: string, value: string | string[]) => {
    setOverrides((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const removeOne = (key: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const reset = () => {
    setOverrides({});
    if (typeof window !== "undefined") {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  };

  return { overrides, setOne, removeOne, reset };
}

export function PdfTextEditor({
  open,
  onOpenChange,
  projectType,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Type de projet en cours pour pré-filtrer les textes pertinents. */
  projectType: ProjectType;
}) {
  const { data: texts = [], isLoading } = usePdfTexts();
  const { overrides, setOne, removeOne, reset } = usePdfTextOverrides();
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"all" | "common" | ProjectType>(projectType);

  // Filtre par scope (common + scope projet en cours par défaut) + search
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return texts
      .filter((t) => {
        if (scopeFilter === "all") return true;
        return t.scope === scopeFilter || t.scope === "common";
      })
      .filter((t) => {
        if (!q) return true;
        return (
          t.label.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.contentText ?? "").toLowerCase().includes(q)
        );
      });
  }, [texts, scopeFilter, search]);

  // Groupement scope -> category -> entrées
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, PdfText[]>>();
    for (const t of filtered) {
      if (!map.has(t.scope)) map.set(t.scope, new Map());
      const catMap = map.get(t.scope)!;
      if (!catMap.has(t.category)) catMap.set(t.category, []);
      catMap.get(t.category)!.push(t);
    }
    return map;
  }, [filtered]);

  const overrideCount = Object.keys(overrides).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-beev-rose" />
            Personnaliser le PDF pour ce devis
          </DialogTitle>
          <DialogDescription>
            Les modifications s'appliquent uniquement à ce devis (stockées localement,
            elles ne touchent pas le catalogue partagé). À la prochaine génération
            PDF, vos textes overrideront les valeurs par défaut.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b bg-muted/30 shrink-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un libellé, une catégorie, un slug ou un texte..."
                className="pl-9 h-9"
              />
            </div>
            <div className="flex items-center gap-1">
              {(["all", "common", "vehicles", "home", "site"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={scopeFilter === s ? "default" : "outline"}
                  onClick={() => setScopeFilter(s)}
                  className="h-8 text-xs"
                >
                  {s === "all" ? "Tous" : s === "common" ? "Communs" : s === "vehicles" ? "Véhicules" : s === "home" ? "Domicile" : "Site"}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} texte{filtered.length > 1 ? "s" : ""} disponible{filtered.length > 1 ? "s" : ""}</span>
            <div className="flex items-center gap-2">
              {overrideCount > 0 && (
                <>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    {overrideCount} surcharge{overrideCount > 1 ? "s" : ""} active{overrideCount > 1 ? "s" : ""}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Réinitialiser TOUTES les surcharges de ce devis ?")) reset();
                    }}
                    className="h-7 text-xs gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Tout réinitialiser
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1 space-y-6">
          {isLoading && <p className="text-sm text-muted-foreground">Chargement des textes...</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Aucun texte ne correspond à votre recherche.</p>
          )}
          {Array.from(grouped.entries()).map(([scope, catMap]) => (
            <div key={scope} className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-beev-rose border-b border-beev-rose/20 pb-1">
                {scope === "common" ? "Communs" : scope === "vehicles" ? "Véhicules" : scope === "home" ? "Bornes domicile" : "Bornes site entreprise"}
              </h3>
              {Array.from(catMap.entries()).map(([category, list]) => (
                <div key={category} className="space-y-3">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {category}
                  </h4>
                  <div className="space-y-3">
                    {list.map((t) => (
                      <TextEntry
                        key={t.id}
                        entry={t}
                        override={overrides[`${t.scope}:${t.slug}`]}
                        onSet={(v) => setOne(`${t.scope}:${t.slug}`, v)}
                        onReset={() => removeOne(`${t.scope}:${t.slug}`)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-1">
            <X className="w-4 h-4" /> Fermer
          </Button>
          <Button onClick={() => onOpenChange(false)} className="gap-1">
            Enregistrer ({overrideCount} surcharge{overrideCount > 1 ? "s" : ""})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Bloc édition pour 1 texte. Affiche le label/slug, la valeur courante
// (override OU DB OU fallback), et permet d'éditer + reset.
function TextEntry({
  entry,
  override,
  onSet,
  onReset,
}: {
  entry: PdfText;
  override: string | string[] | undefined;
  onSet: (v: string | string[]) => void;
  onReset: () => void;
}) {
  const isOverridden = override !== undefined;
  const baseValue = entry.kind === "list"
    ? (entry.contentList ?? [])
    : (entry.contentText ?? "");
  const currentValue = isOverridden ? override : baseValue;

  return (
    <div className={`rounded-md border p-3 ${isOverridden ? "border-beev-rose/40 bg-beev-rose-30/20" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <Label className="text-xs font-semibold text-foreground block">{entry.label}</Label>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{entry.scope}:{entry.slug}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isOverridden && (
            <>
              <Badge className="bg-beev-rose-30 text-beev-black border-beev-rose text-[9px]">
                Modifié
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={onReset}
                title="Annuler la modification"
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </div>
      {entry.kind === "list" ? (
        <Textarea
          value={(Array.isArray(currentValue) ? currentValue : []).join("\n")}
          onChange={(e) => onSet(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
          placeholder="Une ligne par élément de la liste..."
          className="text-xs font-mono"
          rows={Math.max(3, (Array.isArray(currentValue) ? currentValue.length : 0) + 1)}
        />
      ) : entry.kind === "multiline" ? (
        <Textarea
          value={typeof currentValue === "string" ? currentValue : ""}
          onChange={(e) => onSet(e.target.value)}
          className="text-xs"
          rows={4}
        />
      ) : (
        <Input
          value={typeof currentValue === "string" ? currentValue : ""}
          onChange={(e) => onSet(e.target.value)}
          className="text-xs h-8"
        />
      )}
    </div>
  );
}
