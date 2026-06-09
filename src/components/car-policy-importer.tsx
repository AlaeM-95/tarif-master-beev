// Encart "Import Car Policy Client" — sous le catalogue véhicules.
//
// Permet au commercial d'importer un Excel/CSV libre représentant la car
// policy actuelle de son prospect. Les véhicules détectés s'affichent dans
// un bloc parallèle au catalogue officiel et peuvent être ajoutés à la
// sélection du devis comme n'importe quel véhicule.
//
// Persistance : ÉPHÉMÈRE. Tout vit dans le state React local de cette
// instance. Au refresh ou changement de projet, l'import disparaît.
// Aucune écriture en Supabase, aucun risque de pollution du catalogue.

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, X, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import { importCarPolicy, type ImportReport } from "@/lib/car-policy-importer";
import type { Vehicle } from "@/lib/catalog";

export function CarPolicyImporter({
  importedVehicles,
  onImported,
  onClear,
  onAddOne,
  onRemoveOne,
  selectedIds,
}: {
  /** Liste des véhicules actuellement importés (state React du parent) */
  importedVehicles: Vehicle[];
  /** Callback : remplace la liste importée (après upload) */
  onImported: (vehicles: Vehicle[]) => void;
  /** Callback : vide totalement la liste importée */
  onClear: () => void;
  /** Callback : ajoute un véhicule importé au panier de sélection */
  onAddOne: (v: Vehicle) => void;
  /** Callback : retire un véhicule importé du panier de sélection */
  onRemoveOne: (id: string) => void;
  /** Set des IDs déjà dans le panier (pour afficher l'état) */
  selectedIds: Set<string>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      const r = await importCarPolicy(file);
      setReport(r);
      onImported(r.vehicles);
      if (r.vehicles.length > 0) {
        toast.success(`${r.vehicles.length} véhicule${r.vehicles.length > 1 ? "s" : ""} importé${r.vehicles.length > 1 ? "s" : ""} depuis ${file.name}`);
      } else {
        toast.error("Aucun véhicule détecté dans le fichier — voir les avertissements");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur d'import inconnue";
      toast.error(`Échec import : ${msg}`);
    } finally {
      setImporting(false);
    }
  };

  const handleClear = () => {
    setReport(null);
    onClear();
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.message("Car policy vidée");
  };

  // Génère un template Excel minimal téléchargeable pour aider le commercial
  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const headers = [
      ["Marque", "Modèle", "Version", "Catégorie", "Énergie", "Batterie (kWh)", "Autonomie WLTP (km)", "Puissance (ch)", "Consommation", "CO2", "CV fiscaux", "Prix TTC", "Loyer LLD"],
      ["TESLA", "MODEL Y", "PROPULSION", "SUV", "Électrique", 75, 533, 295, 14.9, 0, 6, 46990, 700],
      ["VW", "ID.7", "PRO LIFE", "Berline", "Électrique", 77, 608, 286, 16.4, 0, 7, 60690, 900],
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Car Policy");
    XLSX.writeFile(wb, "template-car-policy-beev.xlsx");
  };

  return (
    <Card className="border-beev-violet/40">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-beev-violet" />
              Import Car Policy Client
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Importez la car policy actuelle de votre prospect (Excel / CSV).
              Les véhicules importés vivent uniquement dans ce devis : ils ne
              touchent ni au catalogue Beev officiel, ni à Supabase.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={downloadTemplate} className="gap-1 text-xs h-8">
            <Download className="w-3 h-3" /> Template Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone / upload */}
        <div className="border border-dashed border-beev-violet/40 rounded-lg p-6 text-center bg-beev-violet-20/40">
          <Upload className="w-7 h-7 mx-auto text-beev-violet mb-2" />
          <p className="text-sm font-medium mb-1">
            {importing
              ? "Lecture en cours..."
              : importedVehicles.length > 0
              ? `${importedVehicles.length} véhicule${importedVehicles.length > 1 ? "s" : ""} importé${importedVehicles.length > 1 ? "s" : ""}`
              : "Glissez votre fichier ou cliquez pour parcourir"}
          </p>
          <p className="text-[10px] text-muted-foreground mb-3">
            Formats acceptés : .xlsx, .xls, .csv · les colonnes sont détectées
            automatiquement (Marque, Modèle, Batterie, Autonomie, Prix, etc.)
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
              className="hidden"
              id="car-policy-file"
            />
            <Button
              size="sm"
              variant="default"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              {importedVehicles.length > 0 ? "Remplacer le fichier" : "Choisir un fichier"}
            </Button>
            {importedVehicles.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleClear} className="gap-1.5">
                <X className="w-3.5 h-3.5" /> Vider
              </Button>
            )}
          </div>
        </div>

        {/* Rapport d'import : colonnes détectées + warnings */}
        {report && (
          <div className="text-xs space-y-2 px-1">
            <div className="flex flex-wrap gap-1">
              {Object.entries(report.detectedColumns)
                .filter(([, h]) => h)
                .map(([field, header]) => (
                  <Badge key={field} variant="outline" className="text-[9px] font-mono">
                    {field} ← <span className="text-beev-violet">{header}</span>
                  </Badge>
                ))}
            </div>
            {report.warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-amber-800 text-[11px] flex gap-2 items-start">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <ul className="space-y-0.5">
                  {report.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {report.warnings.length > 5 && <li>... et {report.warnings.length - 5} autres avertissements</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Liste des véhicules importés en grille compacte */}
        {importedVehicles.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {importedVehicles.map((v) => {
              const isSelected = selectedIds.has(v.id);
              return (
                <div
                  key={v.id}
                  className={`p-3 rounded-md border transition-all ${
                    isSelected
                      ? "border-beev-violet bg-beev-violet-30/30 ring-1 ring-beev-violet/30"
                      : "border-border bg-card hover:border-beev-violet/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-tight truncate">
                        {v.brand} {v.model}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {v.version || v.category}
                      </p>
                    </div>
                    <Badge className="bg-beev-violet-30 text-beev-black text-[9px] border-beev-violet shrink-0">
                      Import
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
                    <span>{v.rangeWltp ? `${v.rangeWltp} km` : "—"}</span>
                    <span>{v.batteryKwh ? `${v.batteryKwh} kWh` : "—"}</span>
                    <span>{v.powerHp ? `${v.powerHp} ch` : "—"}</span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between text-[11px]">
                    <span className="text-muted-foreground">Prix</span>
                    <span className="font-semibold">
                      {v.priceTtc ? `${v.priceTtc.toLocaleString("fr-FR")} €` : "—"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={isSelected ? "outline" : "default"}
                    className="w-full mt-2 h-7 text-xs"
                    onClick={() => (isSelected ? onRemoveOne(v.id) : onAddOne(v))}
                  >
                    {isSelected ? "Retirer" : "Ajouter au devis"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
