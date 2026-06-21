import { useState } from "react";
import { Settings2, RotateCcw, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ProjectType } from "@/lib/catalog";
import { CONFIG_GROUPS, type PdfDisplayConfig } from "@/lib/pdf-config";

type Props = {
  config: PdfDisplayConfig;
  update: (patch: Partial<PdfDisplayConfig>) => void;
  reset: () => void;
  projectType: ProjectType;
};

export function PdfConfigPanel({ config, update, reset, projectType }: Props) {
  const [open, setOpen] = useState(false);

  // On ne compte que les réglages booléens (toggles) : certaines clés sont des
  // modes (ex. b2b2eChargerMode = "comparator" | "catalogue" | "both").
  const boolKeys = (Object.keys(config) as Array<keyof PdfDisplayConfig>).filter((k) => typeof config[k] === "boolean");
  const enabledCount = boolKeys.filter((k) => config[k] === true).length;
  const totalCount = boolKeys.length;

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-3 hover:bg-accent/40 transition"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-[#5F5F64]" />
          <div className="text-left">
            <p className="text-sm font-semibold">Configuration PDF</p>
            <p className="text-xs text-muted-foreground">
              {enabledCount} / {totalCount} éléments affichés
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="border-t p-3 space-y-4">
          <p className="text-[11px] text-muted-foreground">
            Cochez les éléments à inclure dans le PDF client. La configuration est
            sauvegardée localement et s'applique à toutes vos prochaines générations.
          </p>

          {CONFIG_GROUPS.map((group) => {
            // Filtre par type de projet si défini
            if (group.appliesTo && !group.appliesTo.includes(projectType)) return null;
            return (
              <div key={group.title} className="space-y-2">
                <p className="text-[10px] font-semibold uppercase text-[#5F5F64]">{group.title}</p>
                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const itemAppliesTo = (item as any).appliesTo as ProjectType[] | undefined;
                    if (itemAppliesTo && !itemAppliesTo.includes(projectType)) return null;
                    const on = !!config[item.key];
                    return (
                      <label
                        key={item.key}
                        className={`flex items-start gap-2 cursor-pointer rounded-md border p-2 transition ${
                          on ? "border-beev-rose/50 bg-beev-rose-20" : "border-border/60 bg-transparent opacity-70 hover:opacity-100"
                        }`}
                      >
                        <Checkbox
                          checked={on}
                          onCheckedChange={(v) => update({ [item.key]: !!v })}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs cursor-pointer leading-tight font-medium">{item.label}</Label>
                            <span className={`flex items-center gap-1 text-[9px] font-semibold uppercase rounded-full px-1.5 py-0.5 flex-shrink-0 ${
                              on ? "bg-beev-rose text-beev-black" : "bg-muted text-muted-foreground"
                            }`}>
                              {on ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                              {on ? "Affiché" : "Masqué"}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="grid grid-cols-3 gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const all: Record<string, boolean> = {};
                for (const k of boolKeys) all[k as string] = true;
                update(all as Partial<PdfDisplayConfig>);
              }}
              className="gap-1 h-7 text-xs"
            >
              Tout cocher
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const all: Record<string, boolean> = {};
                for (const k of boolKeys) all[k as string] = false;
                update(all as Partial<PdfDisplayConfig>);
              }}
              className="gap-1 h-7 text-xs"
            >
              Tout décocher
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              className="gap-1 h-7 text-xs"
              title="Revenir aux valeurs par défaut"
            >
              <RotateCcw className="w-3 h-3" /> Défaut
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
