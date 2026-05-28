import { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Liste de toutes les catégories existantes du catalogue (extraite des véhicules). */
  existingCategories: string[];
  label?: string;
};

// Champ "Catégorie" avec :
// - Affichage de la valeur actuelle
// - Dropdown listant toutes les catégories utilisées dans le catalogue
// - Option "+ Ajouter une nouvelle catégorie" qui ouvre un input
export function CategoryField({ value, onChange, existingCategories, label = "Catégorie" }: Props) {
  const [open, setOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Catégories uniques triées
  const sorted = useMemo(() => {
    const set = new Set(existingCategories.filter((c) => c && c.trim().length > 0).map((c) => c.trim()));
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [existingCategories]);

  // Ferme le dropdown au clic en dehors
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAddingNew(false);
        setNewCategory("");
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleSelect = (cat: string) => {
    onChange(cat);
    setOpen(false);
    setAddingNew(false);
    setNewCategory("");
  };

  const handleCreateNew = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setOpen(false);
    setAddingNew(false);
    setNewCategory("");
  };

  return (
    <div className="space-y-1 relative" ref={wrapperRef}>
      <Label className="text-[10px] text-muted-foreground uppercase">{label}</Label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs flex items-center justify-between hover:bg-accent/40 transition"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || "Sélectionner ou créer..."}
        </span>
        <ChevronDown className={`w-3 h-3 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-md border border-input bg-popover shadow-md max-h-72 overflow-auto">
          {sorted.length === 0 && !addingNew && (
            <p className="text-[11px] text-muted-foreground p-2 italic">
              Aucune catégorie existante. Créez-en une.
            </p>
          )}
          {sorted.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleSelect(cat)}
              className="w-full px-2 py-1.5 text-xs flex items-center justify-between hover:bg-accent text-left"
            >
              <span>{cat}</span>
              {cat === value && <Check className="w-3 h-3 text-[#35DA76]" />}
            </button>
          ))}
          <div className="border-t">
            {addingNew ? (
              <div className="p-2 space-y-1">
                <Input
                  autoFocus
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateNew();
                    } else if (e.key === "Escape") {
                      setAddingNew(false);
                      setNewCategory("");
                    }
                  }}
                  placeholder="Nom de la catégorie..."
                  className="h-7 text-xs"
                />
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateNew}
                    disabled={!newCategory.trim()}
                    className="h-6 text-xs flex-1 gap-1"
                  >
                    <Check className="w-3 h-3" /> Créer
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAddingNew(false);
                      setNewCategory("");
                    }}
                    className="h-6 text-xs"
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingNew(true)}
                className="w-full px-2 py-1.5 text-xs flex items-center gap-1.5 hover:bg-accent text-left text-[#35DA76] font-medium"
              >
                <Plus className="w-3 h-3" /> Ajouter une nouvelle catégorie
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
