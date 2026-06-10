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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, X, AlertTriangle, Download, Pencil, Zap, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { importCarPolicy, type ImportReport } from "@/lib/car-policy-importer";
import type { Vehicle, Energy } from "@/lib/catalog";
import { ImageUpload } from "@/components/image-upload";

export function CarPolicyImporter({
  importedVehicles,
  onImported,
  onClear,
  onAddOne,
  onRemoveOne,
  onUpdateSelected,
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
  /** Callback : propage une modification au selectedV si le véhicule
   *  est déjà au devis. Permet d'éditer un import et de voir la modif
   *  immédiatement dans le panneau de sélection du devis. */
  onUpdateSelected?: (id: string, patch: Partial<Vehicle>) => void;
  /** Set des IDs déjà dans le panier (pour afficher l'état) */
  selectedIds: Set<string>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  // Véhicule en cours d'édition (null = Dialog fermé). On stocke l'ID +
  // les valeurs en cours pour pouvoir annuler sans toucher au state parent.
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingVehicle = editingId
    ? importedVehicles.find((v) => v.id === editingId) ?? null
    : null;

  const updateImported = (id: string, patch: Partial<Vehicle>) => {
    onImported(importedVehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    // Si le véhicule est déjà au devis, on propage la modif au SelectedVehicle
    // correspondant pour que le panneau de droite affiche la dernière version.
    if (selectedIds.has(id) && onUpdateSelected) {
      onUpdateSelected(id, patch);
    }
  };

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
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <Badge className="bg-beev-violet-30 text-beev-black text-[9px] border-beev-violet">
                        Import
                      </Badge>
                      {v.isCurrentFleet && (
                        <Badge className="bg-beev-rose-30 text-beev-black text-[9px] border-beev-rose gap-1">
                          <ArrowRightLeft className="w-2.5 h-2.5" /> Flotte actuelle
                        </Badge>
                      )}
                      {v.energy === "Électrique" && !v.isCurrentFleet && (
                        <Badge className="bg-beev-bleu-30 text-beev-black text-[9px] border-beev-bleu gap-1">
                          <Zap className="w-2.5 h-2.5" /> EV
                        </Badge>
                      )}
                    </div>
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
                    variant="outline"
                    className="w-full mt-2 h-7 text-xs gap-1"
                    onClick={() => setEditingId(v.id)}
                  >
                    <Pencil className="w-3 h-3" /> Modifier la fiche
                  </Button>
                  <Button
                    size="sm"
                    variant={isSelected ? "outline" : "default"}
                    className="w-full mt-1.5 h-7 text-xs"
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

      {/* Dialog d'édition complète — même fiche produit que dans /admin */}
      <Dialog open={!!editingVehicle} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {editingVehicle && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="w-4 h-4" />
                  Modifier la fiche produit
                </DialogTitle>
                <DialogDescription>
                  Les modifications restent locales à ce devis. Le catalogue Beev
                  officiel et la base Supabase ne sont jamais touchés.
                </DialogDescription>
              </DialogHeader>
              <ImportedVehicleForm
                vehicle={editingVehicle}
                onChange={(patch) => updateImported(editingVehicle.id, patch)}
              />
              <DialogFooter>
                <Button onClick={() => setEditingId(null)}>OK</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Formulaire d'édition d'un véhicule importé. Reprend les champs de la
// VehicleCard /admin mais en version compacte, sans les actions catalogue
// (delete/duplicate). Les modifs sont appliquées en direct au state parent.
function ImportedVehicleForm({
  vehicle,
  onChange,
}: {
  vehicle: Vehicle;
  onChange: (patch: Partial<Vehicle>) => void;
}) {
  return (
    <div className="space-y-4 py-2">
      {/* Identité */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Marque" value={vehicle.brand} onChange={(s) => onChange({ brand: s })} />
        <Field label="Modèle" value={vehicle.model} onChange={(s) => onChange({ model: s })} />
        <Field label="Version / Finition" value={vehicle.version} onChange={(s) => onChange({ version: s })} />
        <Field label="Catégorie" value={vehicle.category} onChange={(s) => onChange({ category: s })} placeholder="SUV, Berline, Break…" />
      </div>

      {/* Énergie */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase">Énergie</Label>
          <select
            value={vehicle.energy}
            onChange={(e) => onChange({ energy: e.target.value as Energy })}
            className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs text-foreground"
          >
            <option value="Électrique">Électrique</option>
            <option value="Hybride Rechargeable">Hybride Rechargeable</option>
            <option value="Hybride">Hybride</option>
            <option value="Mild Hybrid">Mild Hybrid</option>
            <option value="Essence">Essence</option>
            <option value="Diesel">Diesel</option>
          </select>
        </div>
        <NumberField label="Puissance (ch)" value={vehicle.powerHp} onChange={(n) => onChange({ powerHp: n })} />
      </div>

      {/* Spécifications */}
      <div className="grid grid-cols-3 gap-3">
        <NumberField label="Batterie (kWh)" value={vehicle.batteryKwh} onChange={(n) => onChange({ batteryKwh: n })} step={0.1} />
        <NumberField label="Autonomie WLTP (km)" value={vehicle.rangeWltp} onChange={(n) => onChange({ rangeWltp: n })} />
        <NumberField label="CO2 (g/km)" value={vehicle.co2} onChange={(n) => onChange({ co2: n })} />
        <NumberField label="CV fiscaux" value={vehicle.fiscalHp} onChange={(n) => onChange({ fiscalHp: n })} />
        <NumberField label="Score env. (0-100)" value={vehicle.envScore ?? 0} onChange={(n) => onChange({ envScore: n })} />
        {vehicle.energy === "Électrique" ? (
          <NumberField label="Consommation (kWh/100km)" value={vehicle.consumption} onChange={(n) => onChange({ consumption: n, consumptionElec: n })} step={0.1} />
        ) : (
          <NumberField label="Conso thermique (L/100km)" value={vehicle.consumptionThermal ?? vehicle.consumption} onChange={(n) => onChange({ consumptionThermal: n, consumption: n })} step={0.1} />
        )}
      </div>
      {/* Hybrides Rechargeables : 2e champ pour la conso électrique en mode EV.
          Le calcul TCO mixe 60 % élec + 40 % thermique. */}
      {(vehicle.energy === "Hybride Rechargeable") && (
        <div className="grid grid-cols-1 gap-3">
          <NumberField
            label="Conso électrique en mode EV (kWh/100 km)"
            value={vehicle.consumptionElec ?? 0}
            onChange={(n) => onChange({ consumptionElec: n })}
            step={0.1}
          />
        </div>
      )}

      {/* Prix */}
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Prix TTC (€)" value={vehicle.priceTtc} onChange={(n) => onChange({ priceTtc: n })} />
        <NumberField label="Loyer LLD (€/mois)" value={vehicle.monthlyLld} onChange={(n) => onChange({ monthlyLld: n })} />
      </div>

      {/* Specs étendues — coffre + dimensions toujours, recharge UNIQUEMENT
          pour les véhicules électriques (DC/AC n'a pas de sens sur thermique
          ou hybride léger). */}
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Coffre (L)" value={vehicle.trunkLitres ?? 0} onChange={(n) => onChange({ trunkLitres: n })} />
        <Field label="Dimensions (L × l × H)" value={vehicle.dimensions ?? ""} onChange={(s) => onChange({ dimensions: s })} placeholder="4 750 × 1 850 × 1 620 mm" />
      </div>
      {vehicle.energy === "Électrique" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Recharge DC max (kW)" value={vehicle.chargeDcMaxKw ?? 0} onChange={(n) => onChange({ chargeDcMaxKw: n })} step={0.1} />
            <NumberField label="Recharge AC max (kW)" value={vehicle.chargeAcMaxKw ?? 0} onChange={(n) => onChange({ chargeAcMaxKw: n })} step={0.1} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Recharge 20-80 % AC" value={vehicle.chargeTime2080Ac ?? ""} onChange={(s) => onChange({ chargeTime2080Ac: s })} placeholder="8h00" />
            <Field label="Recharge 20-80 % DC" value={vehicle.chargeTime2080Dc ?? ""} onChange={(s) => onChange({ chargeTime2080Dc: s })} placeholder="28 min" />
          </div>
        </>
      )}

      {/* Toggle "Véhicule de la flotte actuelle" — détermine le mode du
          comparateur (Avant/Après thermique vs EV). Marqué automatiquement
          si le véhicule a été importé sous la section ▼ FLOTTE ACTUELLE. */}
      <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted">
        <input
          type="checkbox"
          checked={vehicle.isCurrentFleet ?? false}
          onChange={(e) => onChange({ isCurrentFleet: e.target.checked })}
          className="h-4 w-4"
        />
        <ArrowRightLeft className="w-3.5 h-3.5 text-beev-rose" />
        <span className="text-xs">Véhicule de la flotte actuelle (à remplacer)</span>
      </label>

      {/* Image personnalisée — affichée sur la fiche véhicule du PDF client */}
      <ImageUpload
        currentUrl={vehicle.image}
        onChange={(url) => onChange({ image: url })}
        folder="car-policy-imports"
        label="Photo du véhicule (affichée dans le PDF de présentation)"
      />
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground uppercase">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 text-xs" />
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground uppercase">{label}</Label>
      <Input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        step={step}
        className="h-8 text-xs"
      />
    </div>
  );
}
