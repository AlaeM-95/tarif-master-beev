import { useState } from "react";
import { Settings2, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
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

  const enabledCount = Object.values(config).filter(Boolean).length;
  const totalCount = Object.keys(config).length;

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
                    return (
                      <label
                        key={item.key}
                        className="flex items-start gap-2 cursor-pointer hover:bg-accent/30 rounded p-1 transition"
                      >
                        <Checkbox
                          checked={config[item.key]}
                          onCheckedChange={(v) => update({ [item.key]: !!v })}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <Label className="text-xs cursor-pointer leading-tight">{item.label}</Label>
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

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={reset}
            className="w-full gap-2 h-7 text-xs"
          >
            <RotateCcw className="w-3 h-3" /> Tout réactiver
          </Button>
        </div>
      )}
    </div>
  );
}
