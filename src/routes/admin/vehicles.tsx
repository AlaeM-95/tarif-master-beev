import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useVehicles } from "@/lib/store";
import { useLeaserOffers, type LeaserOffer } from "@/lib/leaser-offers";
import type { Vehicle } from "@/lib/catalog";

export const Route = createFileRoute("/admin/vehicles")({
  component: AdminVehiclesPage,
});

function AdminVehiclesPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/login" });
  }, [loading, isAdmin, navigate]);

  const { vehicles, update: updateVehicle } = useVehicles();
  const { offers, isLoading: offersLoading } = useLeaserOffers();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "shortlist" | "stock">("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return vehicles.filter((v) => {
      if (filter === "shortlist" && !v.shortlist) return false;
      if (filter === "stock" && !v.availableStock) return false;
      if (!q) return true;
      return `${v.brand} ${v.model} ${v.version} ${v.category}`.toLowerCase().includes(q);
    }).sort((a, b) => {
      // Shortlist d'abord
      if (a.shortlist && !b.shortlist) return -1;
      if (!a.shortlist && b.shortlist) return 1;
      return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
    });
  }, [vehicles, search, filter]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Chargement...</div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Retour</Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Éditer véhicule · Pricing loueurs S1 2026</h1>
              <p className="text-xs text-muted-foreground">Mise à jour des remises, distributeurs et offres loueurs par véhicule.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher marque, modèle..." className="pl-9 h-9" />
            </div>
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>Tous ({vehicles.length})</Button>
            <Button variant={filter === "shortlist" ? "default" : "outline"} size="sm" onClick={() => setFilter("shortlist")} className="gap-1">
              <Star className="w-3 h-3" /> Shortlist
            </Button>
            <Button variant={filter === "stock" ? "default" : "outline"} size="sm" onClick={() => setFilter("stock")}>Stock dispo</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 space-y-3">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Aucun véhicule ne correspond.</p>}
        {filtered.map((v) => (
          <VehicleRow
            key={v.id}
            vehicle={v}
            offers={offers.filter((o) => o.vehicleId === v.id)}
            onUpdate={async (patch) => {
              await updateVehicle(v.id, patch);
            }}
          />
        ))}
      </main>
    </div>
  );
}

// Une ligne par véhicule, avec champs inline éditables (commercial + offres loueurs).
function VehicleRow({ vehicle, offers, onUpdate }: {
  vehicle: Vehicle;
  offers: LeaserOffer[];
  onUpdate: (patch: Partial<Vehicle>) => Promise<void>;
}) {
  const { create: createOffer, update: updateOffer, remove: removeOffer } = useLeaserOffers();
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="p-4">
        {/* Ligne 1 : entête véhicule + actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onUpdate({ shortlist: !vehicle.shortlist })}
              title={vehicle.shortlist ? "Retirer de la shortlist" : "Ajouter à la shortlist"}
              className="flex-shrink-0"
            >
              <Star className={`w-5 h-5 ${vehicle.shortlist ? "fill-[#FFB800] text-[#FFB800]" : "text-muted-foreground/30"}`} />
            </button>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{vehicle.brand} {vehicle.model}</p>
              <p className="text-xs text-muted-foreground truncate">
                {vehicle.category}
                {vehicle.rangeWltp ? ` · ${vehicle.rangeWltp} km WLTP` : ""}
                {vehicle.ecoScoreBool ? " · Éco-score" : ""}
                {vehicle.availableStock ? " · Stock dispo" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick-edit champs principaux */}
            <NumInline label="Prix catalogue" value={vehicle.priceTtc} onChange={(n) => onUpdate({ priceTtc: n })} suffix="€" width={100} />
            <NumInline label="Remise" value={vehicle.remise ?? 0} onChange={(n) => onUpdate({ remise: n })} suffix="%" width={70} step={0.5} />
            <NumInline label="PCOM" value={vehicle.pcomPct ?? 0} onChange={(n) => onUpdate({ pcomPct: n })} suffix="%" width={70} step={0.5} />
            <NumInline label="Commission Beev" value={vehicle.commissionBeev ?? 0} onChange={(n) => onUpdate({ commissionBeev: n })} suffix="€" width={90} />
            <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)}>
              {expanded ? "Réduire" : "Détails"}
            </Button>
          </div>
        </div>

        {/* Offres loueurs en mini-tableau (toujours visible si présentes) */}
        {offers.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Offres loueurs ({offers.length})</Label>
            {offers.map((o) => (
              <div key={o.id} className="flex items-center gap-2 text-xs">
                <TxtInline value={o.loueur} onChange={async (s) => { try { await updateOffer.mutateAsync({ id: o.id, patch: { loueur: s } }); } catch (e) { toast.error(String(e)); } }} width={120} />
                <NumInline value={o.durationMonths} onChange={async (n) => { try { await updateOffer.mutateAsync({ id: o.id, patch: { durationMonths: n } }); } catch (e) { toast.error(String(e)); } }} suffix="mois" width={75} />
                <NumInline value={o.kmTotal} onChange={async (n) => { try { await updateOffer.mutateAsync({ id: o.id, patch: { kmTotal: n } }); } catch (e) { toast.error(String(e)); } }} suffix="km" width={95} />
                <NumInline value={o.monthlyPriceTtc} onChange={async (n) => { try { await updateOffer.mutateAsync({ id: o.id, patch: { monthlyPriceTtc: n } }); } catch (e) { toast.error(String(e)); } }} suffix="€/mois" width={95} />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => {
                  if (!confirm(`Supprimer l'offre ${o.loueur} ${o.durationMonths}m/${o.kmTotal}km ?`)) return;
                  try { await removeOffer.mutateAsync(o.id); toast.success("Offre supprimée"); } catch (e) { toast.error(String(e)); }
                }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs mt-2" onClick={async () => {
              try {
                await createOffer.mutateAsync({
                  vehicleId: vehicle.id,
                  loueur: "AYVENS",
                  durationMonths: 48,
                  kmTotal: 60000,
                  monthlyPriceTtc: 0,
                });
                toast.success("Offre ajoutée");
              } catch (e) {
                toast.error(String(e));
              }
            }}>
              <Plus className="w-3 h-3" /> Nouvelle offre loueur
            </Button>
          </div>
        )}

        {/* Bloc déplié : distributeurs + tripartite + stock + délai */}
        {expanded && (
          <div className="mt-3 pt-3 border-t grid sm:grid-cols-2 gap-3">
            <TxtField label="Distributeur Nord" value={vehicle.distributeurNord ?? ""} onChange={(s) => onUpdate({ distributeurNord: s })} />
            <TxtField label="Distributeur Sud" value={vehicle.distributeurSud ?? ""} onChange={(s) => onUpdate({ distributeurSud: s })} />
            <TxtField label="Contrat tripartite" value={vehicle.tripartiteContract ?? ""} onChange={(s) => onUpdate({ tripartiteContract: s })} />
            <TxtField label="Délai commande" value={vehicle.leadTime ?? ""} onChange={(s) => onUpdate({ leadTime: s })} placeholder="Ex : 4 mois" />
            <div className="flex items-center gap-2">
              <Label className="text-xs">Stock disponible</Label>
              <input type="checkbox" checked={!!vehicle.availableStock} onChange={(e) => onUpdate({ availableStock: e.target.checked })} className="h-4 w-4" />
            </div>
            {offers.length === 0 && (
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={async () => {
                try {
                  await createOffer.mutateAsync({ vehicleId: vehicle.id, loueur: "AYVENS", durationMonths: 48, kmTotal: 60000, monthlyPriceTtc: 0 });
                  toast.success("Première offre ajoutée");
                } catch (e) {
                  toast.error(String(e));
                }
              }}>
                <Plus className="w-3 h-3" /> Première offre loueur
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Champ inline numérique compact (auto-save sur blur)
function NumInline({ label, value, onChange, suffix, width = 80, step = 1 }: { label?: string; value: number; onChange: (n: number) => void; suffix?: string; width?: number; step?: number }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <div className="flex flex-col gap-0.5">
      {label && <Label className="text-[9px] uppercase text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-1">
        <Input
          type="number"
          step={step}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            const n = Number(local);
            if (Number.isFinite(n) && n !== value) onChange(n);
          }}
          className="h-7 text-xs"
          style={{ width: `${width}px` }}
        />
        {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function TxtInline({ value, onChange, width = 100 }: { value: string; onChange: (s: string) => void; width?: number }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onChange(local); }}
      className="h-7 text-xs"
      style={{ width: `${width}px` }}
    />
  );
}

function TxtField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onChange(local); }}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
    </div>
  );
}
