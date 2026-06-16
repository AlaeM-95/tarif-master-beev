import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Plus, Trash2, Star, Pencil, Filter, Package, Sparkles, X, Copy, Car, Tag, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUpload } from "@/components/file-upload";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
import { useVehicles } from "@/lib/store";
import { useLeaserOffers, type LeaserOffer } from "@/lib/leaser-offers";
import { LEASER_NAMES, KNOWN_LEASERS, LEASER_KIND_LABELS, type LeaserKind } from "@/lib/leasers";
import { fmtEur } from "@/lib/store";
import type { Vehicle } from "@/lib/catalog";

export const Route = createFileRoute("/admin/vehicles")({
  component: AdminVehiclesPage,
});

type FilterKind = "all" | "shortlist" | "stock" | "no-offer";

function AdminVehiclesPage() {
  const { loading } = useAuth();
  const { can } = usePermissions();
  const allowed = can("backoffice_vehicles");
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !allowed) navigate({ to: "/login" });
  }, [loading, allowed, navigate]);

  const { vehicles, update: updateVehicle, remove: removeVehicle, duplicate: duplicateVehicle } = useVehicles();
  const { offers } = useLeaserOffers();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKind>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Raccourci depuis la fiche produit (/admin/vehicles?edit=<id>) : ouvre
  // directement la fiche pricing du véhicule concerné.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("edit");
    if (id) setEditingId(id);
  }, []);

  // Stats globales
  const stats = useMemo(() => {
    const totalOffers = new Set(offers.map((o) => o.vehicleId));
    // Loyer « à partir de » par véhicule : plus basse offre loueur, sinon loyer catalogue.
    const startingRents = vehicles.map((v) => {
      const vo = offers.filter((o) => o.vehicleId === v.id);
      return vo.length ? Math.min(...vo.map((o) => o.monthlyPriceTtc)) : v.monthlyLld;
    }).filter((n) => n > 0);
    return {
      total: vehicles.length,
      shortlist: vehicles.filter((v) => v.shortlist).length,
      stock: vehicles.filter((v) => v.availableStock).length,
      withOffer: totalOffers.size,
      avgPrice: vehicles.length > 0 ? vehicles.reduce((s, v) => s + v.priceTtc, 0) / vehicles.length : 0,
      avgRent: startingRents.length ? startingRents.reduce((s, n) => s + n, 0) / startingRents.length : 0,
    };
  }, [vehicles, offers]);

  // Catégories distinctes pour le filtre
  const categories = useMemo(() => {
    return Array.from(new Set(vehicles.map((v) => v.category).filter(Boolean))).sort();
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return vehicles
      .filter((v) => {
        if (filter === "shortlist" && !v.shortlist) return false;
        if (filter === "stock" && !v.availableStock) return false;
        if (filter === "no-offer" && offers.some((o) => o.vehicleId === v.id)) return false;
        if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
        if (!q) return true;
        return `${v.brand} ${v.model} ${v.version} ${v.category}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.shortlist && !b.shortlist) return -1;
        if (!a.shortlist && b.shortlist) return 1;
        return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
      });
  }, [vehicles, search, filter, categoryFilter, offers]);

  const editingVehicle = editingId ? vehicles.find((v) => v.id === editingId) : null;

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Chargement...</div>;
  if (!allowed) return null;

  // Toggle shortlist avec feedback toast (la valeur précédente est gardée pour rollback en cas d'erreur)
  const toggleShortlist = async (v: Vehicle) => {
    const next = !v.shortlist;
    try {
      await updateVehicle(v.id, { shortlist: next });
      toast.success(next ? `★ ${v.brand} ${v.model} ajouté à la shortlist` : `Retiré de la shortlist`, { duration: 2000 });
    } catch (e) {
      toast.error(`Échec : ${e instanceof Error ? e.message : "erreur inconnue"}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCF9F2]">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="sm">
                <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Retour</Link>
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Pricing véhicules · Loueurs S1 2026</h1>
                <p className="text-xs text-muted-foreground">Édition des remises, distributeurs et offres loueurs (Ayvens, Arval, BPCE, captives DIAC/VW/BMW…).</p>
              </div>
            </div>
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher marque, modèle..." className="pl-9 h-9" />
            </div>
          </div>

          {/* Filtres */}
          <div className="flex flex-wrap gap-2 mt-3">
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>Tous</Button>
            <Button variant={filter === "shortlist" ? "default" : "outline"} size="sm" onClick={() => setFilter("shortlist")} className="gap-1">
              <Star className="w-3 h-3" /> Shortlist
            </Button>
            <Button variant={filter === "stock" ? "default" : "outline"} size="sm" onClick={() => setFilter("stock")} className="gap-1">
              <Package className="w-3 h-3" /> Stock dispo
            </Button>
            <Button variant={filter === "no-offer" ? "default" : "outline"} size="sm" onClick={() => setFilter("no-offer")}>
              Sans offre
            </Button>
            <div className="w-px bg-border mx-1" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="all">Toutes catégories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-4">
        {/* Tableau de bord : KPIs en cartes */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <KpiCard label="Véhicules" value={stats.total} icon={<Car className="w-4 h-4" />} accent="#1A1A1A" />
          <KpiCard label="Avec offre loueur" value={stats.withOffer} sub={`${stats.total ? Math.round((stats.withOffer / stats.total) * 100) : 0}% du parc`} icon={<Tag className="w-4 h-4" />} accent="#3809EA" />
          <KpiCard label="Loyer moyen « à partir de »" value={`${fmtEur(stats.avgRent)}/m`} icon={<Receipt className="w-4 h-4" />} accent="#1FA463" />
          <KpiCard label="Stock dispo" value={stats.stock} icon={<Package className="w-4 h-4" />} accent="#35DA76" />
          <KpiCard label="Shortlist du mois" value={stats.shortlist} icon={<Sparkles className="w-4 h-4" />} accent="#FFB800" />
        </div>
        {/* Table dense */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-[#FCF9F2]">
                  <tr className="text-left text-muted-foreground uppercase text-[10px] tracking-wide">
                    <th className="py-2 px-3 w-10"></th>
                    <th className="py-2 px-3">Marque / Modèle / Version</th>
                    <th className="py-2 px-3">Catégorie</th>
                    <th className="py-2 px-3 text-right">Prix TTC</th>
                    <th className="py-2 px-3 text-right">Remise</th>
                    <th className="py-2 px-3 text-right">PCOM</th>
                    <th className="py-2 px-3 text-right">Comm. Beev</th>
                    <th className="py-2 px-3">Meilleure offre</th>
                    <th className="py-2 px-3 text-center">Stock</th>
                    <th className="py-2 px-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => {
                    const vehicleOffers = offers.filter((o) => o.vehicleId === v.id);
                    const best = vehicleOffers.sort((a, b) => a.monthlyPriceTtc - b.monthlyPriceTtc)[0];
                    return (
                      <tr key={v.id} className="border-b hover:bg-accent/30">
                        <td className="py-2 px-3">
                          <button
                            type="button"
                            onClick={() => toggleShortlist(v)}
                            title={v.shortlist ? "Retirer de la shortlist" : "Ajouter à la shortlist"}
                            className="hover:scale-110 transition-transform"
                          >
                            <Star className={`w-4 h-4 ${v.shortlist ? "fill-[#FFB800] text-[#FFB800]" : "text-muted-foreground/30 hover:text-[#FFB800]/50"}`} />
                          </button>
                        </td>
                        <td className="py-2 px-3">
                          <p className="font-medium">{v.brand} {v.model}</p>
                          {v.version && <p className="text-[11px] text-foreground/70 font-medium">{v.version}</p>}
                          <p className="text-[10px] text-muted-foreground">
                            {v.ecoScoreBool && <span className="text-[#35DA76] font-semibold mr-1">éco-score</span>}
                            {v.rangeWltp ? `${v.rangeWltp} km · ` : ""}
                            {v.energy}
                          </p>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{v.category}</td>
                        <td className="py-2 px-3 text-right font-semibold">{fmtEur(v.priceTtc)}</td>
                        <td className="py-2 px-3 text-right">{(v.remise ?? 0).toFixed(1)}%</td>
                        <td className="py-2 px-3 text-right">{(v.pcomPct ?? 0).toFixed(1)}%</td>
                        <td className="py-2 px-3 text-right">{fmtEur(v.commissionBeev ?? 0)}</td>
                        <td className="py-2 px-3">
                          {best ? (
                            <div className="text-[11px]">
                              <span className="font-semibold">{best.loueur}</span>
                              <span className="text-muted-foreground"> · {best.durationMonths}m/{(best.kmTotal / 1000).toFixed(0)}k · </span>
                              <span className="font-semibold text-[#3809EA]">{fmtEur(best.monthlyPriceTtc)}/m</span>
                              {vehicleOffers.length > 1 && (
                                <Badge variant="secondary" className="ml-1 text-[9px]">+{vehicleOffers.length - 1}</Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-destructive">Aucune offre</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {v.availableStock ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#35DA76]/10 text-[#35DA76] px-2 py-0.5 text-[10px] font-medium">
                              <Package className="w-3 h-3" /> Dispo
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(v.id)} title="Éditer">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={async () => {
                                const res = await duplicateVehicle(v.id);
                                if (res.error) toast.error(`Échec duplication : ${res.error}`);
                                else {
                                  toast.success(`${v.brand} ${v.model} dupliqué`, { duration: 2000 });
                                  // Ouvre directement la copie en édition pour la modifier
                                  if (res.newId) setEditingId(res.newId);
                                }
                              }}
                              title="Dupliquer ce véhicule"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucun véhicule ne correspond.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Dialog d'édition complète */}
      <Dialog open={!!editingVehicle} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {editingVehicle && (
            <VehicleEditForm
              vehicle={editingVehicle}
              offers={offers.filter((o) => o.vehicleId === editingVehicle.id)}
              onSave={async (patch) => {
                try {
                  await updateVehicle(editingVehicle.id, patch);
                  // Remise tripartite : elle s'applique à TOUT le modèle (même
                  // marque + modèle), quelle que soit la version. Ex : Ford
                  // Explorer 79 kWh Pack Select 24% → Pack Connect 24% aussi.
                  if (patch.remise !== undefined) {
                    const siblings = vehicles.filter(
                      (v) => v.id !== editingVehicle.id
                        && v.brand === editingVehicle.brand
                        && v.model === editingVehicle.model
                        && (v.remise ?? 0) !== patch.remise,
                    );
                    if (siblings.length) {
                      await Promise.all(siblings.map((v) => updateVehicle(v.id, { remise: patch.remise })));
                      toast.success(`Remise ${patch.remise}% appliquée à ${siblings.length + 1} versions ${editingVehicle.brand} ${editingVehicle.model}`);
                      return;
                    }
                  }
                  toast.success("Véhicule mis à jour");
                } catch (e) {
                  toast.error(`Échec : ${e instanceof Error ? e.message : "erreur"}`);
                }
              }}
              onClose={() => setEditingId(null)}
              onDelete={async () => {
                if (!confirm(`Supprimer ${editingVehicle.brand} ${editingVehicle.model} définitivement ?`)) return;
                const res = await removeVehicle(editingVehicle.id);
                if (res?.error) toast.error(res.error);
                else {
                  toast.success("Véhicule supprimé");
                  setEditingId(null);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Carte KPI du tableau de bord backoffice
function KpiCard({ label, value, sub, icon, accent }: { label: string; value: string | number; sub?: string; icon?: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
        {icon && <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ color: accent, background: `${accent}14` }}>{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-bold leading-none" style={{ color: accent }}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

// Formulaire d'édition complète d'un véhicule, ouvert en Dialog
function VehicleEditForm({ vehicle, offers, onSave, onClose, onDelete }: {
  vehicle: Vehicle;
  offers: LeaserOffer[];
  onSave: (patch: Partial<Vehicle>) => Promise<void>;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<Partial<Vehicle>>({});
  const { create: createOffer, update: updateOffer, remove: removeOffer } = useLeaserOffers();

  const set = <K extends keyof Vehicle>(key: K, value: Vehicle[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const commitField = async <K extends keyof Vehicle>(key: K) => {
    if (draft[key] === undefined || draft[key] === vehicle[key]) return;
    await onSave({ [key]: draft[key] } as Partial<Vehicle>);
  };

  const current = { ...vehicle, ...draft };
  // « Loyer à partir de » = la plus basse des offres loueurs si elles existent
  // (cohérent avec la carte catalogue et le panneau droit). Sinon saisie manuelle.
  const lowestOffer = offers.length ? Math.min(...offers.map((o) => o.monthlyPriceTtc)) : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {current.brand} {current.model}
          {current.shortlist && <Star className="w-4 h-4 fill-[#FFB800] text-[#FFB800]" />}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-5">
        {/* Identité */}
        <FormSection title="Identité">
          <FieldRow>
            <TxtField label="Marque" value={current.brand} onChange={(v) => set("brand", v)} onBlur={() => commitField("brand")} />
            <TxtField label="Modèle" value={current.model} onChange={(v) => set("model", v)} onBlur={() => commitField("model")} />
            <TxtField label="Version" value={current.version} onChange={(v) => set("version", v)} onBlur={() => commitField("version")} />
            <TxtField label="Catégorie" value={current.category} onChange={(v) => set("category", v)} onBlur={() => commitField("category")} />
          </FieldRow>
        </FormSection>

        {/* Pricing */}
        <FormSection title="Pricing commercial">
          <FieldRow>
            <NumField label="Prix catalogue TTC" value={current.priceTtc} onChange={(v) => set("priceTtc", v)} onBlur={() => commitField("priceTtc")} suffix="€" />
            {lowestOffer != null ? (
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] uppercase text-muted-foreground leading-snug block min-h-[26px]">Loyer « à partir de » /mois</Label>
                <div className="h-8 px-3 text-xs flex items-center rounded-md border bg-muted/40 font-semibold text-[#3809EA]">
                  {fmtEur(lowestOffer)}<span className="text-muted-foreground font-normal ml-1">· plus bas des offres</span>
                </div>
              </div>
            ) : (
              <NumField label="Loyer « à partir de » /mois" value={current.monthlyLld ?? 0} onChange={(v) => set("monthlyLld", v)} onBlur={() => commitField("monthlyLld")} suffix="€" />
            )}
            <NumField label="Remise tripartite (modèle)" value={current.remise ?? 0} onChange={(v) => set("remise", v)} onBlur={() => commitField("remise")} suffix="%" step={0.5} />
            <NumField label="PCOM distributeur" value={current.pcomPct ?? 0} onChange={(v) => set("pcomPct", v)} onBlur={() => commitField("pcomPct")} suffix="%" step={0.5} />
            <NumField label="Commission Beev" value={current.commissionBeev ?? 0} onChange={(v) => set("commissionBeev", v)} onBlur={() => commitField("commissionBeev")} suffix="€" />
          </FieldRow>
        </FormSection>

        {/* Distribution */}
        <FormSection title="Distribution & stock">
          <FieldRow>
            <TxtField label="Distributeur NORD" value={current.distributeurNord ?? ""} onChange={(v) => set("distributeurNord", v)} onBlur={() => commitField("distributeurNord")} />
            <TxtField label="Distributeur SUD" value={current.distributeurSud ?? ""} onChange={(v) => set("distributeurSud", v)} onBlur={() => commitField("distributeurSud")} />
            <TxtField label="Nom du contrat tripartite" value={current.tripartiteContract ?? ""} onChange={(v) => set("tripartiteContract", v)} onBlur={() => commitField("tripartiteContract")} placeholder="Ex : Accord Grand Comptes 2026" />
            <TxtField label="Délai commande" value={current.leadTime ?? ""} onChange={(v) => set("leadTime", v)} onBlur={() => commitField("leadTime")} placeholder="Ex : 4 mois" />
          </FieldRow>
          {/* Upload du PDF tripartite (ops/admin uniquement) */}
          <div className="mt-3 rounded-md border border-dashed border-[#3809EA]/30 bg-[#3809EA]/5 p-3">
            <FileUpload
              currentUrl={current.tripartitePdfUrl ?? undefined}
              onChange={(url) => { set("tripartitePdfUrl", url || undefined); onSave({ tripartitePdfUrl: url || undefined }); }}
              folder={vehicle.id}
              bucket="tripartite-contracts"
              label="PDF du contrat tripartite"
              accept="application/pdf"
              helper="Visible en lecture seule par les sales sur la fiche véhicule du catalogue. Téléchargement désactivé côté sales."
            />
          </div>
          <div className="flex items-center gap-4 mt-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={!!current.availableStock}
                onChange={(e) => { set("availableStock", e.target.checked); onSave({ availableStock: e.target.checked }); }}
                className="h-4 w-4"
              />
              <span>Stock disponible (livré sous 4 semaines)</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={!!current.ecoScoreBool}
                onChange={(e) => { set("ecoScoreBool", e.target.checked); onSave({ ecoScoreBool: e.target.checked }); }}
                className="h-4 w-4"
              />
              <span>Éco-score (abattement AEN 70%)</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={!!current.shortlist}
                onChange={(e) => { set("shortlist", e.target.checked); onSave({ shortlist: e.target.checked }); }}
                className="h-4 w-4"
              />
              <span>⭐ Shortlist du mois</span>
            </label>
          </div>
        </FormSection>

        {/* Offres loueurs */}
        <FormSection title={`Offres loueurs (${offers.length})`}>
          <div className="space-y-2">
            {offers.map((o) => (
              <OfferRow
                key={o.id}
                offer={o}
                onUpdate={async (patch) => {
                  try {
                    await updateOffer.mutateAsync({ id: o.id, patch });
                  } catch (e) {
                    toast.error(`Erreur : ${e instanceof Error ? e.message : "inconnue"}`);
                  }
                }}
                onDelete={async () => {
                  if (!confirm(`Supprimer cette offre ${o.loueur} ?`)) return;
                  try {
                    await removeOffer.mutateAsync(o.id);
                    toast.success("Offre supprimée");
                  } catch (e) {
                    toast.error(String(e));
                  }
                }}
              />
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1 mt-2"
              onClick={async () => {
                try {
                  await createOffer.mutateAsync({
                    vehicleId: vehicle.id,
                    loueur: "Ayvens",
                    kind: "loueur",
                    durationMonths: 48,
                    kmTotal: 60000,
                    monthlyPriceTtc: 0,
                  });
                  toast.success("Offre ajoutée");
                } catch (e) {
                  toast.error(String(e));
                }
              }}
            >
              <Plus className="w-4 h-4" /> Ajouter une offre loueur
            </Button>
          </div>
        </FormSection>

        {/* Specs techniques */}
        <FormSection title="Spécifications techniques">
          <FieldRow>
            <NumField label="Autonomie WLTP" value={current.rangeWltp} onChange={(v) => set("rangeWltp", v)} onBlur={() => commitField("rangeWltp")} suffix="km" />
            <NumField label="Batterie" value={current.batteryKwh} onChange={(v) => set("batteryKwh", v)} onBlur={() => commitField("batteryKwh")} suffix="kWh" />
            <NumField label="Puissance" value={current.powerHp} onChange={(v) => set("powerHp", v)} onBlur={() => commitField("powerHp")} suffix="ch" />
            <NumField label="CV fiscaux" value={current.fiscalHp} onChange={(v) => set("fiscalHp", v)} onBlur={() => commitField("fiscalHp")} suffix="CV" />
            <NumField label="CO₂" value={current.co2} onChange={(v) => set("co2", v)} onBlur={() => commitField("co2")} suffix="g/km" />
            <NumField label="Consommation" value={current.consumption} onChange={(v) => set("consumption", v)} onBlur={() => commitField("consumption")} suffix={current.energy === "Électrique" ? "kWh/100km" : "L/100km"} step={0.1} />
            <NumField label="Poids vide" value={current.poidsVide ?? 0} onChange={(v) => set("poidsVide", v)} onBlur={() => commitField("poidsVide")} suffix="kg" />
            <NumField label="Prix batterie HT" value={current.prixBatterie ?? 0} onChange={(v) => set("prixBatterie", v)} onBlur={() => commitField("prixBatterie")} suffix="€" />
          </FieldRow>
        </FormSection>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="destructive" onClick={onDelete} className="mr-auto gap-1">
          <Trash2 className="w-4 h-4" /> Supprimer définitivement
        </Button>
        <Button variant="ghost" onClick={onClose}>Fermer</Button>
      </DialogFooter>
    </>
  );
}

// Une ligne d'offre loueur dans le dialog : dropdown loueur + durée + km + mensuel
function OfferRow({ offer, onUpdate, onDelete }: {
  offer: LeaserOffer;
  onUpdate: (patch: Partial<LeaserOffer>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    loueur: offer.loueur,
    kind: offer.kind,
    durationMonths: offer.durationMonths,
    kmTotal: offer.kmTotal,
    monthlyPriceTtc: offer.monthlyPriceTtc,
  });
  useEffect(() => {
    setDraft({
      loueur: offer.loueur,
      kind: offer.kind,
      durationMonths: offer.durationMonths,
      kmTotal: offer.kmTotal,
      monthlyPriceTtc: offer.monthlyPriceTtc,
    });
  }, [offer.id]);

  const commit = async (key: keyof typeof draft) => {
    if (draft[key] === offer[key]) return;
    await onUpdate({ [key]: draft[key] } as Partial<LeaserOffer>);
  };

  const isCustom = !LEASER_NAMES.includes(draft.loueur);

  // Quand on choisit un loueur connu dans le dropdown, on auto-règle son kind.
  const handleLoueurChange = async (value: string) => {
    if (value === "__custom__") {
      // L'ops bascule en mode saisie libre, on garde le nom courant ou vide.
      setDraft({ ...draft, loueur: "" });
      return;
    }
    const known = KNOWN_LEASERS.find((l) => l.name === value);
    const newKind = known?.kind ?? "loueur";
    setDraft({ ...draft, loueur: value, kind: newKind });
    if (value !== offer.loueur) await onUpdate({ loueur: value, kind: newKind });
  };

  return (
    <div className="grid grid-cols-[1.4fr_120px_60px_90px_90px_32px] gap-2 items-end p-2 rounded-md border bg-card">
      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Loueur / Captive</Label>
        {!isCustom ? (
          <select
            value={draft.loueur}
            onChange={(e) => handleLoueurChange(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            {KNOWN_LEASERS.map((l) => (
              <option key={l.name} value={l.name}>{l.name}</option>
            ))}
            <option value="__custom__">+ Autre (saisie libre)</option>
          </select>
        ) : (
          <Input
            value={draft.loueur}
            onChange={(e) => setDraft({ ...draft, loueur: e.target.value })}
            onBlur={() => commit("loueur")}
            placeholder="Nom du loueur ou captive"
            className="h-8 text-xs"
            autoFocus
          />
        )}
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Type</Label>
        <select
          value={draft.kind}
          onChange={(e) => {
            const newKind = e.target.value as LeaserKind;
            setDraft({ ...draft, kind: newKind });
            if (newKind !== offer.kind) onUpdate({ kind: newKind });
          }}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          disabled={!isCustom && draft.loueur !== ""}
          title={!isCustom ? "Auto-déterminé depuis le loueur connu" : ""}
        >
          <option value="loueur">{LEASER_KIND_LABELS.loueur}</option>
          <option value="captive">{LEASER_KIND_LABELS.captive}</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Durée (m)</Label>
        <Input
          type="number"
          value={draft.durationMonths}
          onChange={(e) => setDraft({ ...draft, durationMonths: Number(e.target.value) })}
          onBlur={() => commit("durationMonths")}
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Km total</Label>
        <Input
          type="number"
          value={draft.kmTotal}
          onChange={(e) => setDraft({ ...draft, kmTotal: Number(e.target.value) })}
          onBlur={() => commit("kmTotal")}
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Loyer /m TTC</Label>
        <Input
          type="number"
          value={draft.monthlyPriceTtc}
          onChange={(e) => setDraft({ ...draft, monthlyPriceTtc: Number(e.target.value) })}
          onBlur={() => commit("monthlyPriceTtc")}
          className="h-8 text-xs"
        />
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">
        <span className="inline-block w-4 h-[3px] rounded-full bg-beev-rose" />{title}
      </h3>
      {children}
    </section>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>;
}

function TxtField({ label, value, onChange, onBlur, placeholder }: { label: string; value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] uppercase text-muted-foreground leading-snug block min-h-[26px]">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} className="h-8 text-xs" />
    </div>
  );
}

function NumField({ label, value, onChange, onBlur, suffix, step = 1 }: { label: string; value: number; onChange: (v: number) => void; onBlur?: () => void; suffix?: string; step?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] uppercase text-muted-foreground leading-snug block min-h-[26px]">{label}{suffix ? ` (${suffix})` : ""}</Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onBlur={onBlur}
        className="h-8 text-xs text-right"
      />
    </div>
  );
}
