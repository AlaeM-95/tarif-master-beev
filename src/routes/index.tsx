import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, FileDown, RotateCcw, Plus, Zap, Battery, Gauge, Settings2, Presentation, X, ChevronLeft, ChevronRight, Car, Home, Building2, Download, AlertTriangle, Save, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { useChargers, useEnergy, useVehicles, useProjectType, fmtEur, type EnergyParams } from "@/lib/store";
import { computeTco, generateProposalPdf, lineItemClientUnit, lineItemClientTotal, type SelectedCharger, type SelectedVehicle } from "@/lib/pdf";
import { BEEV_JOURNEYS, MANDATORY_SERVICES, createBlankCharger, createBlankVehicle, type Charger, type LineItem, type ProjectType, type Vehicle } from "@/lib/catalog";
import { AdminBadge } from "@/components/admin-badge";
import { ImageUpload } from "@/components/image-upload";
import { FileUpload } from "@/components/file-upload";
import { MarginReviewDialog } from "@/components/margin-review-dialog";
import { PdfConfigPanel } from "@/components/pdf-config-panel";
import { CategoryField } from "@/components/category-field";
import { MarginSelect } from "@/components/margin-select";
import { RefreshButton } from "@/components/refresh-button";
import { SaveIndicator } from "@/components/save-indicator";
import { useMaterials, materialToLineItem, MATERIAL_CATEGORIES, type Material } from "@/lib/materials";
import { useBpuForfaits, bpuForfaitToLineItem, BPU_CATEGORIES, BPU_ZONE_COEFFICIENTS, type BpuForfait, type BpuZone } from "@/lib/bpu";
import { useAuth } from "@/lib/auth";
import { useProposals, useProposal } from "@/lib/proposals";
import { usePdfConfig } from "@/lib/pdf-config";

type IndexSearch = { proposal?: string };

export const Route = createFileRoute("/")({
  component: App,
  validateSearch: (s: Record<string, unknown>): IndexSearch => ({
    proposal: typeof s.proposal === "string" ? s.proposal : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Beev · Générateur d'offre commerciale grand compte" },
      { name: "description", content: "Outil interne Beev : 3 types de projet (véhicules, bornes domicile, bornes site) avec PDF dédié, TCO et mode présentation client." },
    ],
  }),
});

function App() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const loadedProposalId = search.proposal;
  const { data: loadedProposal } = useProposal(loadedProposalId);
  const { save: saveProposal } = useProposals();
  const { vehicles, update: updateVehicle, add: addVehicle, remove: removeVehicle, removeAll: removeAllVehicles, importMany: importVehicles } = useVehicles();
  const { chargers, update: updateCharger, add: addCharger, remove: removeCharger, removeAllByDeployment } = useChargers();
  const { energy, set: setEnergy, reset: resetEnergy } = useEnergy();
  const { projectType, setProjectType } = useProjectType();

  // Auto-save : restaure les sélections depuis localStorage au montage.
  // Le commercial peut ainsi recharger la page sans perdre son travail.
  // ATTENTION : pas d'init via localStorage dans useState() ni de Date.now()
  // dans le fallback — ça créerait un mismatch SSR/client (React error #418).
  // On initialise avec un état vide stable, puis on hydrate depuis localStorage
  // dans un useEffect côté client uniquement (après hydration).
  const SK_V = "beev_session_selected_v";
  const SK_C = "beev_session_selected_c";
  const SK_CLIENT = "beev_session_client";
  const loadFromStorage = <T,>(key: string, fallback: T): T => {
    if (typeof window === "undefined") return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };

  const [selectedV, setSelectedV] = useState<Record<string, SelectedVehicle>>({});
  const [selectedC, setSelectedC] = useState<Record<string, SelectedCharger>>({});
  const [presenting, setPresenting] = useState(false);
  const [client, setClient] = useState({
    company: "", contact: "", email: "",
    salesRep: "", salesRepEmail: "", salesRepPhone: "",
    date: "",
    notes: "",
  });

  // Garde-fou : ne persiste pas tant que la première hydration depuis localStorage
  // n'a pas eu lieu, sinon on écraserait les données sauvegardées avec l'état vide
  // initial juste après mount.
  const hydratedRef = useRef(false);

  // Hydratation depuis localStorage : exclusivement côté client, après mount.
  // Garantit un rendu SSR/client identique au premier passage.
  useEffect(() => {
    setSelectedV(loadFromStorage(SK_V, {}));
    setSelectedC(loadFromStorage(SK_C, {}));
    setClient(
      loadFromStorage(SK_CLIENT, {
        company: "", contact: "", email: "",
        salesRep: "", salesRepEmail: "", salesRepPhone: "",
        date: new Date().toLocaleDateString("fr-FR"),
        notes: "",
      }),
    );
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistance automatique de chaque changement en localStorage (post-hydration).
  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    try { localStorage.setItem(SK_V, JSON.stringify(selectedV)); } catch { /* ignore */ }
  }, [selectedV]);
  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    try { localStorage.setItem(SK_C, JSON.stringify(selectedC)); } catch { /* ignore */ }
  }, [selectedC]);
  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    try { localStorage.setItem(SK_CLIENT, JSON.stringify(client)); } catch { /* ignore */ }
  }, [client]);

  // Chargement automatique d'une proposition depuis l'URL (?proposal=xxx)
  useEffect(() => {
    if (!loadedProposal) return;
    setProjectType(loadedProposal.projectType);
    setClient({
      company: loadedProposal.clientCompany,
      contact: loadedProposal.clientContact,
      email: loadedProposal.clientEmail,
      salesRep: loadedProposal.salesRepName,
      salesRepEmail: loadedProposal.salesRepEmail,
      salesRepPhone: loadedProposal.salesRepPhone,
      date: loadedProposal.proposalDate || new Date().toLocaleDateString("fr-FR"),
      notes: loadedProposal.clientNotes,
    });
    const sv: Record<string, SelectedVehicle> = {};
    loadedProposal.selectedVehicles.forEach((v) => { sv[v.vehicle.id] = v; });
    setSelectedV(sv);
    const sc: Record<string, SelectedCharger> = {};
    loadedProposal.selectedChargers.forEach((c) => { sc[c.charger.id] = c; });
    setSelectedC(sc);
    if (loadedProposal.energyParams) setEnergy(loadedProposal.energyParams);
  }, [loadedProposal?.id]);

  const handleSaveProposal = async () => {
    if (!client.company.trim()) {
      toast.error("La société client est requise pour sauvegarder");
      return;
    }
    const result = await saveProposal({
      id: loadedProposalId,
      clientCompany: client.company,
      clientContact: client.contact,
      clientEmail: client.email,
      clientNotes: client.notes,
      proposalDate: client.date,
      salesRepName: client.salesRep,
      salesRepEmail: client.salesRepEmail,
      salesRepPhone: client.salesRepPhone,
      projectType,
      selectedVehicles: Object.values(selectedV),
      selectedChargers: Object.values(selectedC),
      energyParams: energy,
    });
    if (result.error) {
      toast.error(`Échec sauvegarde : ${result.error}`);
      return;
    }
    if (result.id) {
      toast.success(loadedProposalId ? "Proposition mise à jour" : "Proposition créée");
      if (!loadedProposalId && result.id) {
        navigate({ to: "/", search: { proposal: result.id } });
      }
    }
  };

  const counts = useMemo(() => ({
    v: Object.keys(selectedV).length,
    c: Object.keys(selectedC).length,
  }), [selectedV, selectedC]);

  // Recherche & filtres catalogue véhicules
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleEnergyFilter, setVehicleEnergyFilter] = useState<string>("all");
  const [vehiclePriceMax, setVehiclePriceMax] = useState<number | null>(null);

  // Catégories existantes (extraites du catalogue) pour le dropdown admin
  const existingCategories = useMemo(
    () => Array.from(new Set(vehicles.map((v) => v.category).filter(Boolean))),
    [vehicles],
  );

  const filteredVehicles = useMemo(() => {
    const q = vehicleSearch.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (q && !`${v.brand} ${v.model} ${v.version} ${v.category}`.toLowerCase().includes(q)) return false;
      if (vehicleEnergyFilter !== "all" && v.energy !== vehicleEnergyFilter) return false;
      if (vehiclePriceMax !== null && v.priceTtc > vehiclePriceMax) return false;
      return true;
    });
  }, [vehicles, vehicleSearch, vehicleEnergyFilter, vehiclePriceMax]);

  // visibleCount = TOUTES les sélections (véhicules + bornes), pour permettre
  // au commercial de générer un PDF même si la sélection mélange plusieurs types.
  const visibleCount = counts.v + counts.c;

  const toggleV = (v: Vehicle) => {
    setSelectedV((s) => {
      if (s[v.id]) { const { [v.id]: _, ...rest } = s; return rest; }
      return {
        ...s,
        [v.id]: {
          vehicle: v, quantity: 1, discountPct: 0,
          negotiatedMonthly: v.monthlyLld,
          durationMonths: 48, kmPerYear: energy.kmPerYear,
          includeTco: false, services: [], options: [],
        },
      };
    });
  };
  const toggleC = (c: Charger) => {
    setSelectedC((s) => {
      if (s[c.id]) { const { [c.id]: _, ...rest } = s; return rest; }
      // Quand on connaît le prix d'achat (price_buy_ht > 0), on l'utilise comme
      // PU achat de la ligne borne et on calcule la marge nécessaire pour
      // atteindre le prix de vente catalogue (priceHt). Marge arrondie au palier
      // 5 % conformément au barème commercial.
      const hasBuyPrice = c.priceBuyHt !== undefined && c.priceBuyHt !== null && c.priceBuyHt > 0;
      const buy = hasBuyPrice ? c.priceBuyHt! : c.priceHt;
      const computedMargin =
        hasBuyPrice && c.priceHt > 0
          ? Math.max(0, Math.round(((c.priceHt / c.priceBuyHt! - 1) * 100) / 5) * 5)
          : 0;

      let lineItems;
      if (c.defaultLineItems && c.defaultLineItems.length > 0) {
        // Le borne a un chiffrage par défaut figé. Si l'admin a renseigné un
        // prix d'achat, on écrase la PREMIÈRE ligne (présumée être la borne
        // elle-même) avec ce prix et la marge calculée. Les autres lignes
        // (pose, accessoires) sont conservées telles quelles, à la main du
        // commercial. Sans price_buy_ht, on respecte intégralement le
        // defaultLineItems pour ne pas casser les chiffrages historiques.
        lineItems = c.defaultLineItems.map((li, idx) => {
          if (idx === 0 && hasBuyPrice) {
            return { ...li, unitHt: buy, marginPct: computedMargin };
          }
          return { ...li };
        });
      } else {
        lineItems = [
          { label: `${c.brand} ${c.model}`, qty: 1, unitHt: buy, marginPct: computedMargin },
          { label: "Pose & raccordement IRVE", qty: 1, unitHt: c.installPriceHt, marginPct: 0 },
        ];
      }

      return {
        ...s,
        [c.id]: {
          charger: c, quantity: 1, discountPct: 0, installIncluded: true,
          siteName: "", siteAddress: "", siteContact: "",
          lineItems,
        },
      };
    });
  };

  const [marginDialog, setMarginDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { config: pdfConfig, update: updatePdfConfig, reset: resetPdfConfig } = usePdfConfig();

  // Génère le PDF avec try/catch + timeout pour ne jamais bloquer une re-génération.
  // En cas d'erreur (réseau Supabase, navigateur, etc.), affiche un toast
  // sans bloquer le bouton. Le commercial peut re-cliquer immédiatement.
  const doGeneratePdf = async () => {
    if (isGenerating) return; // évite les double-clics rapides
    setIsGenerating(true);
    try {
      // Timeout de 30s : si une requête réseau hang (Supabase, fonts), on
      // débloque le bouton plutôt que de spinner indéfiniment.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Génération trop longue (30s). Vérifiez votre connexion.")), 30000),
      );
      await Promise.race([
        generateProposalPdf({
          projectType, client, energy,
          vehicles: Object.values(selectedV),
          chargers: Object.values(selectedC),
          pdfConfig,
        }),
        timeout,
      ]);
      toast.success("PDF généré avec succès");
    } catch (err) {
      console.error("[pdf] Erreur génération :", err);
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Échec génération PDF : ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportPdf = async () => {
    if (!client.company) { alert("Renseignez au moins le nom de la société client."); return; }
    // Si l'offre contient des bornes site entreprise (peu importe le projectType
    // courant — utile pour les offres combinées véhicules + bornes), on ouvre
    // le dialogue de validation des marges avant génération du PDF client.
    const hasSiteChargers = Object.values(selectedC).some((sc) => sc.charger.deployment === "site");
    if (hasSiteChargers) {
      setMarginDialog(true);
      return;
    }
    await doGeneratePdf();
  };

  const chargersHome = chargers.filter((c) => c.deployment === "domicile");
  const chargersSite = chargers.filter((c) => c.deployment === "site");

  // Réinitialise la sélection courante quand on change de type pour éviter les croisements
  // Permet de passer d'un type de projet à l'autre SANS réinitialiser les sélections.
  // Le commercial peut donc construire une offre combinée (véhicules + bornes domicile
  // + bornes site dans le même PDF).
  const switchProject = (t: ProjectType) => {
    setProjectType(t);
  };

  if (presenting) {
    return <PresentationMode
      projectType={projectType} client={client} energy={energy}
      vehicles={Object.values(selectedV)}
      chargers={Object.values(selectedC)}
      onClose={() => setPresenting(false)}
      onExport={exportPdf}
    />;
  }

  return (
    <div className="min-h-screen bg-background">
      <MarginReviewDialog
        open={marginDialog}
        onClose={() => setMarginDialog(false)}
        selectedChargers={Object.values(selectedC)}
        onUpdateLineItem={(chargerId, lineIndex, patch) => {
          setSelectedC((s) => {
            const sc = s[chargerId];
            if (!sc) return s;
            const newItems = sc.lineItems.map((li, idx) => (idx === lineIndex ? { ...li, ...patch } : li));
            return { ...s, [chargerId]: { ...sc, lineItems: newItems } };
          });
        }}
        onConfirm={doGeneratePdf}
      />
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-primary text-primary-foreground font-bold text-xl">B</div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Beev · Offre commerciale grand compte</h1>
              <p className="text-xs text-muted-foreground">Un projet à la fois — véhicules, bornes domicile ou bornes site.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <RefreshButton />
            <AdminBadge />
            <Badge variant="secondary" className="hidden sm:inline-flex">{visibleCount} sélection(s)</Badge>
            {isAdmin && (
              <Button asChild variant="ghost" size="sm" className="gap-2">
                <a href="/proposals"><FolderOpen className="w-4 h-4" /> Mes propositions</a>
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" onClick={handleSaveProposal} disabled={visibleCount === 0} className="gap-2">
                <Save className="w-4 h-4" /> {loadedProposalId ? "Mettre à jour" : "Sauvegarder"}
              </Button>
            )}
            <Button variant="outline" onClick={() => setPresenting(true)} disabled={visibleCount === 0} className="gap-2">
              <Presentation className="w-4 h-4" /> Présenter au client
            </Button>
            <Button onClick={exportPdf} disabled={visibleCount === 0 || isGenerating} className="gap-2">
              {isGenerating ? (
                <><RotateCcw className="w-4 h-4 animate-spin" /> Génération...</>
              ) : (
                <><FileDown className="w-4 h-4" /> Générer le PDF</>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-8">
          <ProjectTypeSelector value={projectType} onChange={switchProject} />
          <ClientCard client={client} setClient={setClient} />
          {projectType === "vehicles" && (
            <EnergyCard energy={energy} setEnergy={setEnergy} reset={resetEnergy} />
          )}

          {projectType === "vehicles" && (
            <CatalogSection
              title={`Véhicules (${filteredVehicles.length}${filteredVehicles.length !== vehicles.length ? ` / ${vehicles.length}` : ""})`}
              subtitle="Catalogue synchronisé avec le calculateur TCO Beev. Loyers exprimés en TTC."
              isAdmin={isAdmin}
              itemCount={vehicles.length}
              onDeleteAll={isAdmin ? () => { setSelectedV({}); removeAllVehicles(); } : undefined}
              deleteAllLabel="Supprimer tous les véhicules ?"
              onAdd={isAdmin ? () => addVehicle(createBlankVehicle()) : undefined}
              addLabel="Ajouter un véhicule"
              importTco={isAdmin ? (list) => importVehicles(list) : undefined}
            >
              {/* Barre recherche + filtres */}
              <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg bg-card border">
                <div className="relative flex-1 min-w-[200px]">
                  <Input
                    type="search"
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                    placeholder="Rechercher marque, modèle, version..."
                    className="h-9 pl-3"
                  />
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {(["all", "Électrique", "Hybride Rechargeable", "Hybride", "Mild Hybrid", "Essence", "Diesel"] as const).map((e) => (
                    <Button
                      key={e}
                      size="sm"
                      variant={vehicleEnergyFilter === e ? "default" : "outline"}
                      onClick={() => setVehicleEnergyFilter(e)}
                      className="h-8 text-xs"
                    >
                      {e === "all" ? "Toutes énergies" : e}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="whitespace-nowrap">Prix max</span>
                  <Input
                    type="number"
                    value={vehiclePriceMax ?? ""}
                    onChange={(e) => setVehiclePriceMax(e.target.value ? Number(e.target.value) : null)}
                    placeholder="—"
                    className="h-8 w-24 text-xs"
                  />
                  <span>€</span>
                </div>
                {(vehicleSearch || vehicleEnergyFilter !== "all" || vehiclePriceMax !== null) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setVehicleSearch(""); setVehicleEnergyFilter("all"); setVehiclePriceMax(null); }}
                    className="h-8 text-xs gap-1"
                  >
                    <X className="w-3 h-3" /> Effacer
                  </Button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredVehicles.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} selected={!!selectedV[v.id]}
                    onToggle={() => toggleV(v)}
                    onUpdate={isAdmin ? (p) => updateVehicle(v.id, p) : undefined}
                    onDelete={isAdmin ? async () => {
                      if (selectedV[v.id]) toggleV(v);
                      const result = await removeVehicle(v.id);
                      if (result?.error) toast.error(`Échec suppression : ${result.error}`);
                      else toast.success(`${v.brand} ${v.model} supprimé définitivement`);
                    } : undefined}
                    existingCategories={existingCategories}
                  />
                ))}
                {filteredVehicles.length === 0 && vehicles.length > 0 && (
                  <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
                    Aucun véhicule ne correspond à votre recherche.
                  </div>
                )}
              </div>
            </CatalogSection>
          )}

          {projectType === "home" && (
            <CatalogSection
              title={`Bornes domicile collaborateurs (${chargersHome.length})`}
              subtitle="Kit B2B2E clé en main · pose 0–10 m incluse · supervision & remboursement automatisé."
              isAdmin={isAdmin}
              itemCount={chargersHome.length}
              onDeleteAll={isAdmin ? () => { setSelectedC({}); removeAllByDeployment("domicile"); } : undefined}
              deleteAllLabel="Supprimer toutes les bornes domicile ?"
              onAdd={isAdmin ? () => addCharger(createBlankCharger("domicile")) : undefined}
              addLabel="Ajouter une borne domicile"
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {chargersHome.map((c) => (
                  <ChargerCard key={c.id} charger={c} selected={!!selectedC[c.id]}
                    onToggle={() => toggleC(c)}
                    onUpdate={isAdmin ? (p) => updateCharger(c.id, p) : undefined}
                    onDelete={isAdmin ? async () => {
                      if (selectedC[c.id]) toggleC(c);
                      const result = await removeCharger(c.id);
                      if (result?.error) toast.error(`Échec suppression : ${result.error}`);
                      else toast.success(`${c.brand} ${c.model} supprimée définitivement`);
                    } : undefined}
                  />
                ))}
              </div>
            </CatalogSection>
          )}

          {projectType === "site" && (
            <CatalogSection
              title={`Bornes site entreprise (${chargersSite.length})`}
              subtitle="Devis détaillé site par site (matériel + IRVE + génie civil)."
              isAdmin={isAdmin}
              itemCount={chargersSite.length}
              onDeleteAll={isAdmin ? () => { setSelectedC({}); removeAllByDeployment("site"); } : undefined}
              deleteAllLabel="Supprimer toutes les bornes site ?"
              onAdd={isAdmin ? () => addCharger(createBlankCharger("site")) : undefined}
              addLabel="Ajouter une borne site"
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {chargersSite.map((c) => (
                  <ChargerCard key={c.id} charger={c} selected={!!selectedC[c.id]}
                    onToggle={() => toggleC(c)}
                    onUpdate={isAdmin ? (p) => updateCharger(c.id, p) : undefined}
                    onDelete={isAdmin ? async () => {
                      if (selectedC[c.id]) toggleC(c);
                      const result = await removeCharger(c.id);
                      if (result?.error) toast.error(`Échec suppression : ${result.error}`);
                      else toast.success(`${c.brand} ${c.model} supprimée définitivement`);
                    } : undefined}
                  />
                ))}
              </div>
            </CatalogSection>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 self-start space-y-4 max-h-[calc(100vh-7rem)] overflow-auto">
          {/* Panneau de configuration PDF — toggle des sections à inclure */}
          <PdfConfigPanel
            config={pdfConfig}
            update={updatePdfConfig}
            reset={resetPdfConfig}
            projectType={projectType}
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Sélection en cours</CardTitle>
              <SaveIndicator watch={[selectedV, selectedC, client]} />
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleCount === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun produit sélectionné.</p>
              ) : (
                <>
                  {/* Section véhicules — toujours affichée si au moins 1 sélectionné, quel que soit le projectType */}
                  {counts.v > 0 && (
                    <>
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">
                        Véhicules ({counts.v})
                      </p>
                      {Object.values(selectedV).map((sv) => (
                        <SelectedVehicleRow key={sv.vehicle.id} sv={sv} energy={energy}
                          onChange={(p) => setSelectedV((s) => ({ ...s, [sv.vehicle.id]: { ...sv, ...p } }))}
                          onRemove={() => toggleV(sv.vehicle)} />
                      ))}
                    </>
                  )}
                  {/* Section bornes — toujours affichée si au moins 1 sélectionnée */}
                  {counts.c > 0 && (
                    <>
                      {counts.v > 0 && <Separator />}
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">
                        Bornes de recharge ({counts.c})
                      </p>
                      {Object.values(selectedC).map((sc) => (
                        <SelectedChargerRow key={sc.charger.id} sc={sc}
                          onChange={(p) => setSelectedC((s) => ({ ...s, [sc.charger.id]: { ...sc, ...p } }))}
                          onRemove={() => toggleC(sc.charger)} />
                      ))}
                    </>
                  )}

                  <Separator />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setPresenting(true)} className="gap-2">
                      <Presentation className="w-4 h-4" /> Présenter
                    </Button>
                    <Button onClick={exportPdf} className="gap-2">
                      <FileDown className="w-4 h-4" /> PDF
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}

function ProjectTypeSelector({ value, onChange }: { value: ProjectType; onChange: (t: ProjectType) => void }) {
  const opts: { id: ProjectType; icon: React.ReactNode; title: string; desc: string }[] = [
    { id: "vehicles", icon: <Car className="w-5 h-5" />, title: "Projet Véhicules", desc: "Flotte LLD, TCO, prestations véhicule." },
    { id: "home", icon: <Home className="w-5 h-5" />, title: "Bornes domicile", desc: "Kit B2B2E par collaborateur." },
    { id: "site", icon: <Building2 className="w-5 h-5" />, title: "Bornes site entreprise", desc: "Déploiement IRVE site par site." },
  ];
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Type de projet</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {opts.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`text-left rounded-xl border p-4 transition-all ${active ? "border-primary ring-2 ring-primary bg-primary/5" : "hover:border-foreground/30"}`}
            >
              <div className={`w-9 h-9 rounded-lg grid place-content-center mb-3 ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{o.icon}</div>
              <p className="font-semibold text-sm leading-tight">{o.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{o.desc}</p>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CatalogSection({ title, subtitle, onDeleteAll, deleteAllLabel, onAdd, addLabel, importTco, itemCount, children, isAdmin }: {
  title: string; subtitle: string;
  onDeleteAll?: () => void; deleteAllLabel?: string;
  onAdd?: () => void; addLabel: string;
  importTco?: (list: Vehicle[]) => void;
  itemCount?: number;
  children: React.ReactNode;
  isAdmin?: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">{subtitle}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {importTco && <ImportTcoDialog onImport={importTco} />}
            {onAdd && <Button variant="outline" size="sm" onClick={onAdd} className="gap-2"><Plus className="w-3 h-3" /> {addLabel}</Button>}
            {onDeleteAll && (itemCount === undefined || itemCount > 0) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive">
                    <Trash2 className="w-3 h-3" /> Tout supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      {deleteAllLabel ?? "Tout supprimer ?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action supprime {itemCount !== undefined ? `les ${itemCount} éléments` : "tous les éléments"} de la base. Elle est <strong>définitive</strong> et ne peut pas être annulée.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={onDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Confirmer la suppression
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function ImportTcoDialog({ onImport }: { onImport: (list: Vehicle[]) => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [json, setJson] = useState("");
  const [err, setErr] = useState("");

  const handleImport = () => {
    setErr("");
    try {
      // 1) JSON brut collé (fallback en attendant l'API du calculateur)
      if (json.trim()) {
        const parsed = JSON.parse(json);
        const list: any[] = Array.isArray(parsed) ? parsed : (parsed.vehicles ?? []);
        if (!Array.isArray(list) || list.length === 0) throw new Error("Aucun véhicule détecté.");
        const vehs: Vehicle[] = list.map((v: any) => ({
          id: `tco_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          brand: String(v.brand ?? "Marque"),
          model: String(v.model ?? "Modèle"),
          version: String(v.version ?? ""),
          category: String(v.category ?? "Berline"),
          energy: (v.energy ?? "Électrique") as Vehicle["energy"],
          batteryKwh: Number(v.batteryKwh ?? 0),
          rangeWltp: Number(v.rangeWltp ?? 0),
          powerHp: Number(v.powerHp ?? 0),
          consumption: Number(v.consumption ?? 0),
          co2: Number(v.co2 ?? 0),
          fiscalHp: Number(v.fiscalHp ?? 0),
          envScore: v.envScore != null ? Number(v.envScore) : undefined,
          priceTtc: Number(v.priceTtc ?? 0),
          monthlyLld: Number(v.monthlyLld ?? 0),
          image: String(v.image ?? "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png"),
          custom: true,
        }));
        onImport(vehs);
        setOpen(false); setJson(""); setCode("");
        return;
      }
      // 2) Code à 6 caractères → endpoint à brancher quand le calculateur exposera l'export
      if (code.trim()) {
        throw new Error("L'import par code unique sera disponible dès que le calculateur TCO exposera son endpoint d'export. En attendant, utilisez l'option JSON ci-dessous.");
      }
      throw new Error("Saisissez un code ou collez un JSON.");
    } catch (e: any) {
      setErr(e.message || "Import impossible.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><Download className="w-3 h-3" /> Importer du calculateur TCO</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Importer une sélection depuis le calculateur TCO</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Code unique (6 caractères)</Label>
            <Input placeholder="Ex. K7B2-9F" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <p className="text-xs text-muted-foreground">
              Méthode recommandée : depuis <a className="underline" href="https://beev-tco-2026.lovable.app/" target="_blank" rel="noreferrer">le calculateur TCO</a>, le commercial cliquera sur « Exporter vers catalogue Beev » et obtiendra un code à 6 caractères valable 24 h. Endpoint à brancher côté calculateur.
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Ou coller un JSON (fallback)</Label>
            <Textarea rows={6} value={json} onChange={(e) => setJson(e.target.value)} placeholder='[{"brand":"Tesla","model":"Model 3","version":"Propulsion","energy":"Électrique","priceTtc":42990,"monthlyLld":650,"rangeWltp":513,"batteryKwh":60,"powerHp":283,"consumption":13.2,"co2":0,"fiscalHp":5,"image":"https://..."}]' className="font-mono text-xs" />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleImport}>Importer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientCard({ client, setClient }: { client: any; setClient: (c: any) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Informations client & commercial</CardTitle></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Société *"><Input value={client.company} onChange={(e) => setClient({ ...client, company: e.target.value })} placeholder="Ex. BIG France" /></Field>
        <Field label="Contact client"><Input value={client.contact} onChange={(e) => setClient({ ...client, contact: e.target.value })} placeholder="Nom Prénom" /></Field>
        <Field label="Email client"><Input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /></Field>
        <Field label="Date"><Input value={client.date} onChange={(e) => setClient({ ...client, date: e.target.value })} /></Field>
        <Field label="Commercial Beev"><Input value={client.salesRep} onChange={(e) => setClient({ ...client, salesRep: e.target.value })} placeholder="Alaé Mahmoudi" /></Field>
        <Field label="Email commercial"><Input value={client.salesRepEmail} onChange={(e) => setClient({ ...client, salesRepEmail: e.target.value })} placeholder="alae@beev.co" /></Field>
        <Field label="Téléphone commercial"><Input value={client.salesRepPhone} onChange={(e) => setClient({ ...client, salesRepPhone: e.target.value })} placeholder="+33 6 ..." /></Field>
        <Field label="Notes & conditions" className="sm:col-span-2">
          <Textarea rows={3} value={client.notes} onChange={(e) => setClient({ ...client, notes: e.target.value })} placeholder="Laisser vide pour appliquer les conditions standard du type de projet." />
        </Field>
      </CardContent>
    </Card>
  );
}

function EnergyCard({ energy, setEnergy, reset }: { energy: EnergyParams; setEnergy: (e: EnergyParams) => void; reset: () => void }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">Paramètres TCO & énergie (par défaut)</CardTitle>
        </div>
        <Button variant="ghost" size="sm" onClick={reset} className="gap-2"><RotateCcw className="w-3 h-3" /> Reset</Button>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <NumField label="Durée (années)" value={energy.durationYears} onChange={(n) => setEnergy({ ...energy, durationYears: n })} />
        <NumField label="Km / an" value={energy.kmPerYear} onChange={(n) => setEnergy({ ...energy, kmPerYear: n })} />
        <NumField label="Essence €/L" value={energy.fuelPriceL} onChange={(n) => setEnergy({ ...energy, fuelPriceL: n })} step={0.01} />
        <NumField label="kWh domicile €" value={energy.kWhHome} onChange={(n) => setEnergy({ ...energy, kWhHome: n })} step={0.01} />
        <NumField label="kWh public €" value={energy.kWhPublic} onChange={(n) => setEnergy({ ...energy, kWhPublic: n })} step={0.01} />
        <NumField label="Mix domicile %" value={energy.mixHomePct} onChange={(n) => setEnergy({ ...energy, mixHomePct: n })} />
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className}`}><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function ConfirmDeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
          <Trash2 className="w-3 h-3" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Supprimer {label} ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est <strong>définitive</strong> : l'élément sera supprimé de la base de données Supabase et disparaîtra immédiatement pour tous les utilisateurs.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Supprimer définitivement
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function VehicleCard({ vehicle, selected, onToggle, onUpdate, onDelete, existingCategories = [] }: { vehicle: Vehicle; selected: boolean; onToggle: () => void; onUpdate?: (p: Partial<Vehicle>) => void; onDelete?: () => void; existingCategories?: string[] }) {
  const [editing, setEditing] = useState(false);
  return (
    <Card className={`overflow-hidden transition-all ${selected ? "ring-2 ring-primary" : "hover:shadow-md"}`}>
      <div className="aspect-video bg-muted overflow-hidden relative">
        <img src={vehicle.image} alt={`${vehicle.brand} ${vehicle.model}`} className="w-full h-full object-cover" loading="lazy" />
        {vehicle.custom && <Badge className="absolute top-2 left-2 bg-primary">Custom</Badge>}
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold leading-tight">{vehicle.brand} {vehicle.model}</h3>
              <Badge variant="secondary" className="text-[10px]">{vehicle.energy}</Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{vehicle.version}</p>
          </div>
          <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-1" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <Spec icon={<Gauge className="w-3 h-3" />} v={vehicle.rangeWltp ? `${vehicle.rangeWltp} km` : `${vehicle.co2} g/km`} />
          <Spec icon={<Battery className="w-3 h-3" />} v={vehicle.batteryKwh ? `${vehicle.batteryKwh} kWh` : "—"} />
          <Spec icon={<Zap className="w-3 h-3" />} v={`${vehicle.powerHp} ch`} />
        </div>
        <div className="flex items-end justify-between pt-1">
          <div>
            <p className="text-xs text-muted-foreground">À partir de</p>
            <p className="font-semibold">{fmtEur(vehicle.priceTtc)} <span className="text-xs text-muted-foreground">TTC</span></p>
            <p className="text-xs text-primary font-medium">{fmtEur(vehicle.monthlyLld)} TTC/mois</p>
          </div>
          <div className="flex items-center gap-1">
            {onDelete && <ConfirmDeleteButton label={`${vehicle.brand} ${vehicle.model}`} onConfirm={onDelete} />}
            {onUpdate && <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)}>{editing ? "OK" : "Éditer"}</Button>}
          </div>
        </div>
        {editing && onUpdate && (
          <div className="space-y-2 pt-2 border-t">
            <div className="grid grid-cols-2 gap-2">
              <TxtField label="Marque" value={vehicle.brand} onChange={(s) => onUpdate({ brand: s })} />
              <TxtField label="Modèle" value={vehicle.model} onChange={(s) => onUpdate({ model: s })} />
              <NumField label="Prix TTC" value={vehicle.priceTtc} onChange={(n) => onUpdate({ priceTtc: n })} />
              <NumField label="LLD €/mois TTC" value={vehicle.monthlyLld} onChange={(n) => onUpdate({ monthlyLld: n })} />
              <NumField label="Autonomie km" value={vehicle.rangeWltp} onChange={(n) => onUpdate({ rangeWltp: n })} />
              <NumField label="Batterie kWh" value={vehicle.batteryKwh} onChange={(n) => onUpdate({ batteryKwh: n })} />
              <NumField label="Puissance ch" value={vehicle.powerHp} onChange={(n) => onUpdate({ powerHp: n })} />
              <NumField label="Conso" value={vehicle.consumption} onChange={(n) => onUpdate({ consumption: n })} step={0.1} />
              <NumField label="CO₂ g/km" value={vehicle.co2} onChange={(n) => onUpdate({ co2: n })} />
              <NumField label="CV fiscaux" value={vehicle.fiscalHp} onChange={(n) => onUpdate({ fiscalHp: n })} />
              <NumField label="Score env. (0-100)" value={vehicle.envScore ?? 0} onChange={(n) => onUpdate({ envScore: n })} />
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase">Énergie</Label>
                <select
                  value={vehicle.energy}
                  onChange={(e) => onUpdate({ energy: e.target.value as Vehicle["energy"] })}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="Électrique">Électrique</option>
                  <option value="Hybride Rechargeable">Hybride Rechargeable</option>
                  <option value="Hybride">Hybride</option>
                  <option value="Mild Hybrid">Mild Hybrid</option>
                  <option value="Essence">Essence</option>
                  <option value="Diesel">Diesel</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TxtField label="Version" value={vehicle.version} onChange={(s) => onUpdate({ version: s })} />
              <CategoryField
                value={vehicle.category}
                onChange={(s) => onUpdate({ category: s })}
                existingCategories={existingCategories}
              />
            </div>
            <ImageUpload
              currentUrl={vehicle.image}
              onChange={(url) => onUpdate({ image: url })}
              folder="vehicles"
              label="Photo du véhicule"
            />
            <LongTxtField
              label="Services inclus (un par ligne)"
              value={(vehicle.services ?? []).join("\n")}
              onChange={(s) => onUpdate({ services: s.split("\n").map((x) => x.trim()).filter(Boolean) })}
              placeholder={"Maintenance tous réseaux\nAssistance 24/24\n..."}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChargerCard({ charger, selected, onToggle, onUpdate, onDelete }: { charger: Charger; selected: boolean; onToggle: () => void; onUpdate?: (p: Partial<Charger>) => void; onDelete?: () => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <Card className={`overflow-hidden transition-all ${selected ? "ring-2 ring-primary" : "hover:shadow-md"}`}>
      <div className="aspect-video bg-muted overflow-hidden relative">
        <img src={charger.image} alt={`${charger.brand} ${charger.model}`} className="w-full h-full object-contain p-2" loading="lazy" />
        {charger.custom && <Badge className="absolute top-2 left-2 bg-primary">Custom</Badge>}
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold leading-tight">{charger.brand} {charger.model}</h3>
              <Badge variant="secondary" className="text-[10px]">{charger.powerKw} kW</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{charger.type}</p>
          </div>
          <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-1" />
        </div>
        <ul className="text-xs text-muted-foreground space-y-1">
          {charger.features.slice(0, 4).map((f, i) => <li key={i} className="flex gap-1.5"><Plus className="w-3 h-3 mt-0.5 text-primary" />{f}</li>)}
        </ul>
        <div className="flex items-end justify-between pt-1">
          <div>
            <p className="text-xs text-muted-foreground">{charger.deployment === "domicile" ? "Forfait clé en main HT" : "Borne HT"}</p>
            <p className="font-semibold">{fmtEur(charger.priceHt)}</p>
            {charger.installPriceHt > 0 && <p className="text-xs text-primary">+ pose ~{fmtEur(charger.installPriceHt)} HT</p>}
          </div>
          <div className="flex items-center gap-1">
            {onDelete && <ConfirmDeleteButton label={`${charger.brand} ${charger.model}`} onConfirm={onDelete} />}
            {onUpdate && <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)}>{editing ? "OK" : "Éditer"}</Button>}
          </div>
        </div>
        {editing && onUpdate && (
          <div className="space-y-2 pt-2 border-t">
            <div className="grid grid-cols-2 gap-2">
              <TxtField label="Marque (titre)" value={charger.brand} onChange={(s) => onUpdate({ brand: s })} />
              <TxtField label="Modèle (titre)" value={charger.model} onChange={(s) => onUpdate({ model: s })} />
              <NumField label="Prix achat HT" value={charger.priceBuyHt ?? 0} onChange={(n) => onUpdate({ priceBuyHt: n })} />
              <NumField label="Prix vente HT" value={charger.priceHt} onChange={(n) => onUpdate({ priceHt: n })} />
              <NumField label="Pose HT (réf.)" value={charger.installPriceHt} onChange={(n) => onUpdate({ installPriceHt: n })} />
              <NumField label="Puissance kW" value={charger.powerKw} onChange={(n) => onUpdate({ powerKw: n })} step={0.1} />
              <TxtField label="Type (sous-titre)" value={charger.type} onChange={(s) => onUpdate({ type: s })} />
              <div className="space-y-1 col-span-2">
                <Label className="text-[10px] text-muted-foreground uppercase">Déploiement</Label>
                <select
                  value={charger.deployment}
                  onChange={(e) => onUpdate({ deployment: e.target.value as "domicile" | "site" })}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="domicile">Domicile collaborateur (B2B2E)</option>
                  <option value="site">Site entreprise</option>
                </select>
              </div>
            </div>
            {/* Description longue (paragraphe affiché dans le PDF) */}
            <LongTxtField
              label="Description longue (PDF)"
              value={charger.description ?? ""}
              onChange={(s) => onUpdate({ description: s })}
              placeholder="Description complète de la borne, affichée dans le PDF client en plus du type. Ex: borne haute performance pour flotte d'entreprise..."
            />
            <ImageUpload
              currentUrl={charger.image}
              onChange={(url) => onUpdate({ image: url })}
              folder="chargers"
              label="Photo de la borne"
            />
            <LongTxtField
              label="Caractéristiques (une par ligne)"
              value={charger.features.join("\n")}
              onChange={(s) => onUpdate({ features: s.split("\n").map((x) => x.trim()).filter(Boolean) })}
              placeholder={"OCPP 1.6\nMID + RFID\n..."}
              minHeight="80px"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Hook utilitaire : buffer local + debounce avant de remonter au parent.
// Évite que le champ contrôlé "snap back" à la valeur DB tant que le refetch
// react-query n'est pas revenu, ce qui bloquait l'édition (voir LongTxtField).
function useBufferedValue<T>(external: T, onCommit: (v: T) => void, delayMs = 400) {
  const [local, setLocal] = useState<T>(external);
  const lastExternal = useRef<T>(external);
  const lastCommitted = useRef<T>(external);

  // Sync depuis le parent uniquement quand la valeur externe change pour une
  // raison autre que notre propre commit (ex : refetch, sélection d'un autre item).
  useEffect(() => {
    if (external !== lastExternal.current && external !== lastCommitted.current) {
      lastExternal.current = external;
      setLocal(external);
    } else {
      lastExternal.current = external;
    }
  }, [external]);

  // Debounce commit : on attend que l'utilisateur arrête de taper.
  useEffect(() => {
    if (local === lastCommitted.current) return;
    const t = setTimeout(() => {
      lastCommitted.current = local;
      onCommit(local);
    }, delayMs);
    return () => clearTimeout(t);
  }, [local, onCommit, delayMs]);

  return [local, setLocal] as const;
}

function NumField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  const [local, setLocal] = useBufferedValue<number>(value, onChange);
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground uppercase">{label}</Label>
      <Input
        type="number"
        step={step}
        value={Number.isFinite(local) ? local : 0}
        onChange={(e) => setLocal(Number(e.target.value))}
        className="h-8"
      />
    </div>
  );
}
function TxtField({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  const [local, setLocal] = useBufferedValue<string>(value, onChange);
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground uppercase">{label}</Label>
      <Input value={local} onChange={(e) => setLocal(e.target.value)} className="h-8 text-xs" />
    </div>
  );
}
// Textarea avec buffer local + debounce, à utiliser pour tout champ multiligne
// dont la valeur provient d'une source asynchrone (Supabase + react-query).
function LongTxtField({ label, value, onChange, placeholder, minHeight = "60px" }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string; minHeight?: string }) {
  const [local, setLocal] = useBufferedValue<string>(value, onChange);
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground uppercase">{label}</Label>
      <Textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="text-xs"
        style={{ minHeight }}
      />
    </div>
  );
}
function Spec({ icon, v }: { icon: React.ReactNode; v: string }) {
  return <div className="flex items-center gap-1">{icon}<span>{v}</span></div>;
}

// ============ SELECTED ROWS ============

function SelectedVehicleRow({ sv, energy, onChange, onRemove }: { sv: SelectedVehicle; energy: EnergyParams; onChange: (p: Partial<SelectedVehicle>) => void; onRemove: () => void }) {
  const [tab, setTab] = useState<"none" | "svc" | "opt">("none");
  const [newSvc, setNewSvc] = useState("");
  const tco = computeTco(sv, energy);
  const addSvc = () => {
    const t = newSvc.trim();
    if (!t) return;
    onChange({ services: [...sv.services, t] });
    setNewSvc("");
  };
  const delSvc = (i: number) => onChange({ services: sv.services.filter((_, idx) => idx !== i) });
  const setOpt = (i: number, p: Partial<LineItem>) => onChange({ options: sv.options.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const addOpt = () => onChange({ options: [...sv.options, { label: "Nouvelle option", qty: 1, unitHt: 0 }] });
  const delOpt = (i: number) => onChange({ options: sv.options.filter((_, idx) => idx !== i) });

  return (
    <div className="rounded-lg border bg-secondary/40 p-3 space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{sv.vehicle.brand} {sv.vehicle.model}</p>
          <p className="text-xs text-muted-foreground truncate">{sv.vehicle.version}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}><Trash2 className="w-3 h-3" /></Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumField label="Quantité" value={sv.quantity} onChange={(n) => onChange({ quantity: n })} />
        <NumField label="Remise %" value={sv.discountPct} onChange={(n) => onChange({ discountPct: n })} step={0.5} />
        <NumField label="Loyer TTC/mois" value={sv.negotiatedMonthly} onChange={(n) => onChange({ negotiatedMonthly: n })} />
        <NumField label="Durée (mois)" value={sv.durationMonths} onChange={(n) => onChange({ durationMonths: n })} />
        <NumField label="Km / an" value={sv.kmPerYear} onChange={(n) => onChange({ kmPerYear: n })} />
        <div className="flex items-end gap-2 pb-1">
          <Switch id={`tco-${sv.vehicle.id}`} checked={sv.includeTco} onCheckedChange={(b) => onChange({ includeTco: b })} />
          <Label htmlFor={`tco-${sv.vehicle.id}`} className="text-[11px] leading-tight">Inclure TCO dans la présentation</Label>
        </div>
      </div>
      {sv.includeTco && (
        <div className="rounded-md bg-card p-2 text-[11px] grid grid-cols-3 gap-1">
          <div><div className="text-muted-foreground">Loyer/100km</div><div className="font-semibold">{tco.lease100.toFixed(2)} €</div></div>
          <div><div className="text-muted-foreground">Énergie/100km</div><div className="font-semibold">{tco.energy100.toFixed(2)} €</div></div>
          <div><div className="text-muted-foreground">TCO/100km</div><div className="font-semibold text-primary">{tco.tco100.toFixed(2)} €</div></div>
        </div>
      )}
      <div className="flex gap-1">
        <button type="button" onClick={() => setTab(tab === "svc" ? "none" : "svc")} className="flex-1 text-xs px-2 py-1.5 rounded-md border bg-card hover:bg-accent/40">Prestations · {3 + sv.services.length}</button>
        <button type="button" onClick={() => setTab(tab === "opt" ? "none" : "opt")} className="flex-1 text-xs px-2 py-1.5 rounded-md border bg-card hover:bg-accent/40">Options · {sv.options.length}</button>
      </div>
      {tab === "svc" && (
        <div className="rounded-md border bg-card p-2 space-y-2">
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-muted-foreground">Toujours incluses (non décochables)</p>
            {MANDATORY_SERVICES.map((s) => (
              <div key={s} className="flex items-center gap-2 text-xs">
                <Checkbox checked disabled />
                <span className="leading-tight">{s}</span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-muted-foreground">Prestations additionnelles libres</p>
            {sv.services.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={s} onChange={(e) => onChange({ services: sv.services.map((x, idx) => idx === i ? e.target.value : x) })} className="h-7 text-xs" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => delSvc(i)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
            <div className="flex gap-1">
              <Input placeholder="Ex. Pneumatiques hiver inclus" value={newSvc} onChange={(e) => setNewSvc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSvc(); } }} className="h-7 text-xs" />
              <Button size="sm" variant="outline" onClick={addSvc} className="h-7 px-2"><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
        </div>
      )}
      {tab === "opt" && (
        <div className="rounded-md border bg-card p-2 space-y-2">
          {sv.options.map((o, i) => (
            <div key={i} className="grid grid-cols-[1fr_50px_70px_24px] gap-1 items-center">
              <Input value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} className="h-7 text-xs" />
              <Input type="number" value={o.qty} onChange={(e) => setOpt(i, { qty: Number(e.target.value) })} className="h-7 text-xs" />
              <Input type="number" value={o.unitHt} onChange={(e) => setOpt(i, { unitHt: Number(e.target.value) })} className="h-7 text-xs" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => delOpt(i)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addOpt} className="w-full gap-1 h-7 text-xs"><Plus className="w-3 h-3" /> Ajouter une option</Button>
        </div>
      )}
    </div>
  );
}

function SelectedChargerRow({ sc, onChange, onRemove }: { sc: SelectedCharger; onChange: (p: Partial<SelectedCharger>) => void; onRemove: () => void }) {
  const [openLi, setOpenLi] = useState(false);
  const setLi = (i: number, p: Partial<LineItem>) => onChange({ lineItems: sc.lineItems.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const addLi = () => onChange({ lineItems: [...sc.lineItems, { label: "Nouvelle ligne", qty: 1, unitHt: 0, marginPct: 0 }] });
  const delLi = (i: number) => onChange({ lineItems: sc.lineItems.filter((_, idx) => idx !== i) });

  const isHome = sc.charger.deployment === "domicile";
  // Total client (avec marge) — c'est ce qui apparaît dans le PDF
  const totalClient = sc.lineItems.reduce((a, li) => a + lineItemClientTotal(li), 0);
  // Total d'achat (sans marge) — pour le calcul de marge
  const totalAchat = sc.lineItems.reduce((a, li) => a + li.qty * li.unitHt, 0);
  const margeAbs = totalClient - totalAchat;
  const margePct = totalAchat > 0 ? (margeAbs / totalAchat) * 100 : 0;

  return (
    <div className="rounded-lg border bg-secondary/30 p-3 space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{sc.charger.brand} {sc.charger.model}</p>
          <p className="text-xs text-muted-foreground">{isHome ? "Domicile collaborateur" : "Site entreprise"} · {sc.charger.powerKw} kW · {fmtEur(totalClient)} HT client</p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}><Trash2 className="w-3 h-3" /></Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TxtField label={isHome ? "Collaborateur" : "Site (nom)"} value={sc.siteName} onChange={(s) => onChange({ siteName: s })} />
        <TxtField label="Contact" value={sc.siteContact} onChange={(s) => onChange({ siteContact: s })} />
        <div className="col-span-2"><TxtField label="Adresse" value={sc.siteAddress} onChange={(s) => onChange({ siteAddress: s })} /></div>
        <NumField label={isHome ? "Nb collab." : "Quantité bornes"} value={sc.quantity} onChange={(n) => onChange({ quantity: n })} />
        <NumField label="Remise %" value={sc.discountPct} onChange={(n) => onChange({ discountPct: n })} step={0.5} />
      </div>

      {/* Encart Site entreprise : upload devis technicien (privé, jamais dans le PDF client) */}
      {!isHome && (
        <div className="rounded-md border border-dashed border-[#3809EA]/30 bg-[#3809EA]/5 p-2 space-y-2">
          <p className="text-[11px] font-semibold uppercase text-[#3809EA]">Devis technicien (privé)</p>
          <FileUpload
            currentUrl={sc.technicianQuoteUrl}
            onChange={(url) => onChange({ technicianQuoteUrl: url || undefined })}
            folder="technician-quotes"
            label=""
            accept="application/pdf,image/png,image/jpeg"
            helper="PDF du chiffrage technicien après visite. Conservé en interne, jamais joint au PDF client."
          />
        </div>
      )}

      <button type="button" onClick={() => setOpenLi((o) => !o)} className="w-full text-xs px-2 py-1.5 rounded-md border bg-card hover:bg-accent/40 flex justify-between">
        <span>Chiffrage · {sc.lineItems.length} lignes · marge {margePct.toFixed(1)} %</span><span>{openLi ? "▴" : "▾"}</span>
      </button>
      {openLi && (
        <div className="rounded-md border bg-card p-2 space-y-3">
          {sc.lineItems.map((li, i) => {
            const clientUnit = lineItemClientUnit(li);
            const lineTotalAchat = li.qty * li.unitHt;
            const lineTotalClient = lineItemClientTotal(li);
            return (
              <div key={i} className="rounded-md border border-border bg-[#FAF8F4]/40 p-2 space-y-1.5">
                {/* Ligne 1 : désignation pleine largeur + bouton supprimer */}
                <div className="flex items-start gap-1">
                  <Input
                    value={li.label}
                    onChange={(e) => setLi(i, { label: e.target.value })}
                    className="h-7 text-xs flex-1"
                    placeholder="Désignation de la ligne"
                    title={li.label}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive flex-shrink-0" onClick={() => delLi(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {/* Ligne 2 : qté, PU achat, marge %, PU client */}
                <div className="grid grid-cols-4 gap-1">
                  <div className="space-y-0.5">
                    <Label className="text-[9px] uppercase text-muted-foreground">Qté</Label>
                    <Input
                      type="number"
                      value={li.qty}
                      onChange={(e) => setLi(i, { qty: Number(e.target.value) })}
                      className="h-7 text-xs text-right"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[9px] uppercase text-muted-foreground">PU achat</Label>
                    <Input
                      type="number"
                      value={li.unitHt}
                      onChange={(e) => setLi(i, { unitHt: Number(e.target.value) })}
                      className="h-7 text-xs text-right"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[9px] uppercase text-[#3809EA]">Marge %</Label>
                    <MarginSelect
                      value={li.marginPct ?? 0}
                      onChange={(v) => setLi(i, { marginPct: v })}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[9px] uppercase text-[#3809EA]">PU client</Label>
                    <div className="h-7 px-2 text-xs text-right flex items-center justify-end font-semibold text-[#3809EA] rounded-md bg-[#3809EA]/5">
                      {fmtEur(clientUnit)}
                    </div>
                  </div>
                </div>
                {/* Ligne 3 : totaux */}
                <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-dashed border-border">
                  <span>Total achat <strong className="text-[#111111]">{fmtEur(lineTotalAchat)}</strong></span>
                  <span className="font-semibold text-[#3809EA]">Total client {fmtEur(lineTotalClient)}</span>
                </div>
              </div>
            );
          })}
          <div className="grid grid-cols-3 gap-1.5">
            <Button variant="outline" size="sm" onClick={addLi} className="gap-1 h-7 text-xs min-w-0 truncate">
              <Plus className="w-3 h-3 flex-shrink-0" /> <span className="truncate">Ligne</span>
            </Button>
            <MaterialPicker
              onPick={(m) => onChange({ lineItems: [...sc.lineItems, materialToLineItem(m)] })}
            />
            <BpuPicker
              onPick={(f, zone) => onChange({ lineItems: [...sc.lineItems, bpuForfaitToLineItem(f, zone)] })}
            />
          </div>
          <div className="rounded-md border border-[#35DA76]/30 bg-[#35DA76]/5 p-2 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Total achat</span><span className="font-semibold">{fmtEur(totalAchat)}</span></div>
            <div className="flex justify-between text-[#3809EA]"><span>Marge totale</span><span className="font-semibold">{fmtEur(margeAbs)} ({margePct.toFixed(1)} %)</span></div>
            <div className="flex justify-between border-t border-border pt-1 mt-1"><span className="font-semibold">Total client (PDF)</span><span className="font-bold text-base">{fmtEur(totalClient)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

// Bouton + dialogue : permet d'ajouter un matériel du catalogue (table materials)
// comme ligne de chiffrage sur une borne. Le prix par défaut est le prix de vente
// minimum du catalogue ; le commercial peut ensuite l'ajuster.
function MaterialPicker({ onPick }: { onPick: (m: Material) => void }) {
  const { data: materials = [], isLoading } = useMaterials();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return materials.filter((m) => {
      if (filter !== "all" && m.category !== filter) return false;
      if (!q) return true;
      return (
        m.label.toLowerCase().includes(q) ||
        (m.brand ?? "").toLowerCase().includes(q) ||
        (m.model ?? "").toLowerCase().includes(q)
      );
    });
  }, [materials, filter, search]);

  // Catégories réellement présentes dans le catalogue (pour ne pas afficher
  // d'onglets vides).
  const usedCategories = useMemo(() => {
    const set = new Set(materials.map((m) => m.category));
    return Array.from(set).sort();
  }, [materials]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs min-w-0 truncate">
          <Plus className="w-3 h-3 flex-shrink-0" /> <span className="truncate">Matériel</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ajouter un matériel au chiffrage</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-hidden flex flex-col flex-1">
          <Input
            placeholder="Rechercher un matériel, marque, modèle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
              className="h-6 text-[11px]"
            >
              Toutes ({materials.length})
            </Button>
            {usedCategories.map((cat) => {
              const count = materials.filter((m) => m.category === cat).length;
              return (
                <Button
                  key={cat}
                  size="sm"
                  variant={filter === cat ? "default" : "outline"}
                  onClick={() => setFilter(cat)}
                  className="h-6 text-[11px]"
                >
                  {MATERIAL_CATEGORIES[cat] ?? cat} ({count})
                </Button>
              );
            })}
          </div>
          <div className="flex-1 overflow-y-auto rounded-md border">
            {isLoading && <p className="p-4 text-xs text-muted-foreground">Chargement du catalogue...</p>}
            {!isLoading && filtered.length === 0 && (
              <p className="p-4 text-xs text-muted-foreground">Aucun matériel ne correspond à votre recherche.</p>
            )}
            {!isLoading && filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onPick(m);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-accent/40 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {MATERIAL_CATEGORIES[m.category] ?? m.category}
                    {m.brand ? ` · ${m.brand}` : ""}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-[#3809EA]">{fmtEur(m.priceSellMinHt)} HT</p>
                  <p className="text-[10px] text-muted-foreground">Achat {fmtEur(m.priceBuyHt)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Bouton + dialogue : ajoute un forfait du BPU (installation, tranchée, percement,
// mise à la terre, etc.) comme ligne de chiffrage. La zone géographique (1-4)
// applique un coefficient sur le prix Zone 1 du catalogue. Default zone 1.
function BpuPicker({ onPick }: { onPick: (f: BpuForfait, zone: BpuZone) => void }) {
  const { data: forfaits = [], isLoading } = useBpuForfaits();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [zone, setZone] = useState<BpuZone>(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return forfaits.filter((f) => {
      if (filter !== "all" && f.category !== filter) return false;
      if (!q) return true;
      return f.label.toLowerCase().includes(q);
    });
  }, [forfaits, filter, search]);

  const usedCategories = useMemo(() => {
    const set = new Set(forfaits.map((f) => f.category));
    return Array.from(set).sort();
  }, [forfaits]);

  const coeff = BPU_ZONE_COEFFICIENTS[zone];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs min-w-0 truncate">
          <Plus className="w-3 h-3 flex-shrink-0" /> <span className="truncate">BPU</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ajouter un forfait BPU au chiffrage</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-hidden flex flex-col flex-1">
          {/* Sélecteur de zone géographique */}
          <div className="rounded-md border bg-[#3809EA]/5 p-2 space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase">
              Zone géographique
            </Label>
            <div className="flex gap-1">
              {([1, 2, 3, 4] as BpuZone[]).map((z) => (
                <Button
                  key={z}
                  size="sm"
                  variant={zone === z ? "default" : "outline"}
                  onClick={() => setZone(z)}
                  className="h-7 text-xs flex-1"
                >
                  Zone {z}
                  <span className="ml-1 text-[10px] opacity-70">
                    ×{BPU_ZONE_COEFFICIENTS[z].toFixed(2)}
                  </span>
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Les prix affichés sont ajustés selon la zone : Zone 1 × {coeff.toFixed(2)}.
            </p>
          </div>

          <Input
            placeholder="Rechercher un forfait..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
              className="h-6 text-[11px]"
            >
              Tous ({forfaits.length})
            </Button>
            {usedCategories.map((cat) => {
              const count = forfaits.filter((f) => f.category === cat).length;
              return (
                <Button
                  key={cat}
                  size="sm"
                  variant={filter === cat ? "default" : "outline"}
                  onClick={() => setFilter(cat)}
                  className="h-6 text-[11px]"
                >
                  {BPU_CATEGORIES[cat] ?? cat} ({count})
                </Button>
              );
            })}
          </div>
          <div className="flex-1 overflow-y-auto rounded-md border">
            {isLoading && <p className="p-4 text-xs text-muted-foreground">Chargement du BPU...</p>}
            {!isLoading && filtered.length === 0 && (
              <p className="p-4 text-xs text-muted-foreground">Aucun forfait ne correspond à votre recherche.</p>
            )}
            {!isLoading && filtered.map((f) => {
              const adjusted = Math.round(f.priceZone1Ht * coeff * 100) / 100;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    onPick(f, zone);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-accent/40 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" title={f.label}>{f.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {BPU_CATEGORIES[f.category] ?? f.category}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-[#3809EA]">{fmtEur(adjusted)} HT</p>
                    {zone !== 1 && (
                      <p className="text-[10px] text-muted-foreground">Z1 {fmtEur(f.priceZone1Ht)}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ PRESENTATION MODE ============

type Slide =
  | { kind: "cover" }
  | { kind: "vehicle"; sv: SelectedVehicle }
  | { kind: "charger"; sc: SelectedCharger }
  | { kind: "journey" };

function PresentationMode({ projectType, client, energy, vehicles, chargers, onClose, onExport }: {
  projectType: ProjectType;
  client: any; energy: EnergyParams;
  vehicles: SelectedVehicle[]; chargers: SelectedCharger[];
  onClose: () => void; onExport: () => void;
}) {
  const slides: Slide[] = useMemo(() => {
    const s: Slide[] = [{ kind: "cover" }];
    if (projectType === "vehicles") {
      vehicles.forEach((sv) => s.push({ kind: "vehicle", sv }));
    } else {
      chargers.forEach((sc) => s.push({ kind: "charger", sc }));
    }
    s.push({ kind: "journey" });
    return s;
  }, [projectType, vehicles, chargers]);

  const [i, setI] = useState(0);
  const slide = slides[i];

  const nbV = projectType === "vehicles" ? vehicles.length : 0;
  const nbC = projectType === "vehicles" ? 0 : chargers.length;

  // Navigation clavier : ← → pour naviguer entre les slides, Esc pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setI((cur) => Math.min(slides.length - 1, cur + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setI((cur) => Math.max(0, cur - 1));
      } else if (e.key === "Escape") {
        onClose();
      } else if (e.key === "f" || e.key === "F") {
        // Toggle fullscreen
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground font-bold grid place-content-center">B</div>
            <div>
              <p className="text-sm font-semibold">Beev × {client.company || "Votre entreprise"}</p>
              <p className="text-xs text-muted-foreground">Mode présentation · {i + 1}/{slides.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="gap-1"><ChevronLeft className="w-4 h-4" /> Préc.</Button>
            <Button variant="outline" size="sm" onClick={() => setI(Math.min(slides.length - 1, i + 1))} disabled={i === slides.length - 1} className="gap-1">Suiv. <ChevronRight className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={onExport} className="gap-2"><FileDown className="w-4 h-4" /> PDF</Button>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-8 py-12">
        {slide.kind === "cover" && <CoverSlide projectType={projectType} client={client} nbV={nbV} nbC={nbC} />}
        {slide.kind === "vehicle" && <VehicleSlide sv={slide.sv} energy={energy} />}
        {slide.kind === "charger" && <ChargerSlide sc={slide.sc} projectType={projectType} />}
        {slide.kind === "journey" && <JourneySlide projectType={projectType} />}
      </main>
    </div>
  );
}

function CoverSlide({ projectType, client, nbV, nbC }: { projectType: ProjectType; client: any; nbV: number; nbC: number }) {
  const sub = projectType === "vehicles" ? "Sélection de véhicules pour votre flotte."
    : projectType === "home" ? "Bornes domicile collaborateurs — kit B2B2E clé en main."
    : "Bornes site entreprise — déploiement IRVE clé en main.";
  return (
    <div className="max-w-4xl mx-auto py-12">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Offre commerciale · {client.date}</p>
      <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">Beev × {client.company || "Votre entreprise"}</h1>
      <p className="text-xl text-muted-foreground mb-12">{sub}</p>
      <Separator className="mb-8" />
      <div className="grid sm:grid-cols-2 gap-8">
        <div>
          <p className="text-xs uppercase text-muted-foreground mb-2">Préparée pour</p>
          <p className="text-2xl font-semibold">{client.company || "—"}</p>
          {client.contact && <p className="text-muted-foreground">{client.contact}</p>}
          {client.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground mb-2">Préparée par</p>
          <p className="text-2xl font-semibold">{client.salesRep || "Beev"}</p>
          {client.salesRepEmail && <p className="text-muted-foreground">{client.salesRepEmail}</p>}
          {client.salesRepPhone && <p className="text-sm text-muted-foreground">{client.salesRepPhone}</p>}
        </div>
      </div>
      <div className="mt-12 grid grid-cols-2 gap-6">
        {projectType === "vehicles" ? (
          <div className="border rounded-2xl p-6"><p className="text-5xl font-bold">{nbV}</p><p className="text-sm text-muted-foreground mt-1">véhicule{nbV > 1 ? "s" : ""} étudié{nbV > 1 ? "s" : ""}</p></div>
        ) : (
          <div className="border rounded-2xl p-6">
            <p className="text-5xl font-bold">{nbC}</p>
            <p className="text-sm text-muted-foreground mt-1">{projectType === "home" ? `collaborateur${nbC > 1 ? "s" : ""} équipé${nbC > 1 ? "s" : ""}` : `site${nbC > 1 ? "s" : ""} équipé${nbC > 1 ? "s" : ""}`}</p>
          </div>
        )}
        <div className="border rounded-2xl p-6 bg-primary text-primary-foreground">
          <p className="text-xs uppercase opacity-70">Type de projet</p>
          <p className="text-2xl font-semibold mt-1">{projectType === "vehicles" ? "Véhicules LLD" : projectType === "home" ? "Domicile B2B2E" : "Site entreprise"}</p>
        </div>
      </div>
    </div>
  );
}

function VehicleSlide({ sv, energy }: { sv: SelectedVehicle; energy: EnergyParams }) {
  const v = sv.vehicle;
  const tco = computeTco(sv, energy);
  const services = [...MANDATORY_SERVICES, ...sv.services.filter((s) => !MANDATORY_SERVICES.includes(s as any))];
  return (
    <div className="max-w-6xl mx-auto">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Véhicule</p>
      <h2 className="text-4xl font-bold mb-1">{v.brand} {v.model}</h2>
      <p className="text-lg text-muted-foreground mb-8">{v.version} · {v.category} · {v.energy}</p>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8 mb-8">
        <div className="rounded-2xl overflow-hidden bg-muted aspect-video">
          <img src={v.image} alt={`${v.brand} ${v.model}`} className="w-full h-full object-cover" />
        </div>
        <div className="rounded-2xl bg-primary text-primary-foreground p-8 flex flex-col justify-center">
          <p className="text-xs uppercase opacity-70 mb-2">Loyer mensuel TTC · {sv.durationMonths} mois</p>
          <p className="text-6xl font-bold tracking-tight">{fmtEur(sv.negotiatedMonthly)}</p>
          <p className="text-sm opacity-80 mt-2">× {sv.quantity} véhicule{sv.quantity > 1 ? "s" : ""} · {sv.kmPerYear.toLocaleString("fr-FR")} km/an</p>
          {sv.discountPct > 0 && (
            <p className="text-xs opacity-70 mt-4">Prix catalogue {fmtEur(v.priceTtc)} TTC · remise négociée -{sv.discountPct}%</p>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <p className="text-xs uppercase text-muted-foreground mb-3">Caractéristiques</p>
          <div className="grid grid-cols-2 gap-3">
            <KV k="Énergie" v={v.energy} />
            <KV k="Autonomie WLTP" v={v.rangeWltp ? `${v.rangeWltp} km` : "—"} />
            <KV k="Batterie" v={v.batteryKwh ? `${v.batteryKwh} kWh` : "—"} />
            <KV k="Puissance" v={`${v.powerHp} ch`} />
            <KV k="Conso" v={v.energy === "Électrique" ? `${v.consumption} kWh/100` : `${v.consumption} L/100`} />
            <KV k="CO₂" v={`${v.co2} g/km`} />
          </div>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground mb-3">Prestations comprises dans le loyer</p>
          <ul className="space-y-1.5">
            {services.map((s) => <li key={s} className="text-sm flex gap-2"><span className="text-primary">●</span>{s}</li>)}
          </ul>
          {sv.options.length > 0 && (
            <>
              <p className="text-xs uppercase text-muted-foreground mt-6 mb-3">Options & accessoires</p>
              <ul className="space-y-1.5 text-sm">
                {sv.options.map((o, i) => <li key={i} className="flex justify-between"><span>{o.label}</span><span className="text-muted-foreground">× {o.qty}</span></li>)}
              </ul>
            </>
          )}
        </div>
      </div>

      {sv.includeTco && (
        <div className="mt-8 border-l-4 border-primary bg-secondary/40 p-6 rounded-r-2xl">
          <p className="text-xs uppercase text-muted-foreground mb-3">TCO aux 100 km · {sv.durationMonths} mois · {sv.kmPerYear.toLocaleString("fr-FR")} km/an</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <KPI k="Loyer / 100 km" v={`${tco.lease100.toFixed(2)} €`} />
            <KPI k="Énergie / 100 km" v={`${tco.energy100.toFixed(2)} €`} />
            <KPI k="TCO / 100 km" v={`${tco.tco100.toFixed(2)} €`} highlight />
            <KPI k="vs essence ref." v={tco.economy100 >= 0 ? `+${tco.economy100.toFixed(2)} €` : `${tco.economy100.toFixed(2)} €`} />
          </div>
        </div>
      )}
    </div>
  );
}

function ChargerSlide({ sc, projectType }: { sc: SelectedCharger; projectType: ProjectType }) {
  const isHome = projectType === "home";
  // Total CLIENT = avec la marge appliquée (visible par le client en présentation et PDF)
  const total = sc.lineItems.reduce((a, li) => a + lineItemClientTotal(li), 0);
  return (
    <div className="max-w-6xl mx-auto">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{isHome ? "Borne domicile collaborateur" : "Borne site entreprise"}</p>
      <h2 className="text-4xl font-bold mb-1">{sc.siteName || `${sc.charger.brand} ${sc.charger.model}`}</h2>
      <p className="text-lg text-muted-foreground mb-2">{sc.charger.brand} {sc.charger.model} · {sc.charger.powerKw} kW · {sc.charger.type}</p>
      {sc.siteAddress && <p className="text-sm text-muted-foreground mb-8">{sc.siteAddress}</p>}

      <div className="grid lg:grid-cols-[1fr_1.3fr] gap-8 mb-8">
        <div className="rounded-2xl overflow-hidden bg-muted aspect-square flex items-center justify-center p-4">
          <img src={sc.charger.image} alt={`${sc.charger.brand} ${sc.charger.model}`} className="max-w-full max-h-full object-contain" />
        </div>
        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase text-muted-foreground mb-2">Atouts matériel</p>
            <ul className="space-y-1.5 text-sm">
              {sc.charger.features.map((f, i) => <li key={i} className="flex gap-2"><span className="text-primary">●</span>{f}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground mb-2">Devis détaillé</p>
            <ul className="space-y-1 text-sm">
              {sc.lineItems.map((li, i) => (
                <li key={i} className="flex justify-between gap-3 border-b py-1.5">
                  <span>{li.label}</span>
                  <span className="text-muted-foreground tabular-nums whitespace-nowrap">
                    {li.qty} × {fmtEur(lineItemClientUnit(li))}
                  </span>
                </li>
              ))}
              <li className="flex justify-between pt-2 font-semibold">
                <span>{isHome ? "Total HT par collaborateur" : "Total HT site"}</span>
                <span className="tabular-nums">{fmtEur(total)}</span>
              </li>
              {sc.quantity > 1 && (
                <li className="flex justify-between text-primary font-semibold">
                  <span>Total HT × {sc.quantity}</span>
                  <span className="tabular-nums">{fmtEur(total * sc.quantity)}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return <div className="border-b pb-2"><p className="text-[10px] uppercase text-muted-foreground">{k}</p><p className="font-medium">{v}</p></div>;
}
function KPI({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return <div><p className="text-[10px] uppercase text-muted-foreground">{k}</p><p className={`font-bold ${highlight ? "text-2xl text-primary" : "text-xl"}`}>{v}</p></div>;
}

function JourneySlide({ projectType }: { projectType: ProjectType }) {
  const j = BEEV_JOURNEYS[projectType];
  const heading = projectType === "vehicles" ? "Comment Beev pilote votre flotte"
    : projectType === "home" ? "Comment Beev équipe vos collaborateurs"
    : "Comment Beev déploie vos sites";
  return (
    <div className="max-w-6xl mx-auto">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Parcours client Beev — de A à Z</p>
      <h2 className="text-4xl font-bold mb-3">{heading}.</h2>
      <p className="text-muted-foreground mb-10 max-w-3xl">{j.intro}</p>

      {/* Frise horizontale */}
      <div className="relative mb-12 hidden md:block">
        <div className="absolute top-5 left-5 right-5 h-px bg-border" />
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${j.steps.length}, minmax(0,1fr))` }}>
          {j.steps.map((s) => (
            <div key={s.n} className="flex flex-col items-center text-center px-2">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold grid place-content-center text-sm shadow">{s.n}</div>
              <p className="mt-3 text-xs font-semibold leading-tight">{s.title}</p>
              {s.duration && <p className="text-[10px] text-muted-foreground mt-1">{s.duration}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5">
        {j.steps.map((s) => (
          <div key={s.n} className="border rounded-2xl p-5">
            <div className="flex items-start gap-4 mb-3">
              <div className="w-9 h-9 shrink-0 rounded-lg bg-foreground text-background font-bold grid place-content-center text-sm">{s.n}</div>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <h3 className="font-semibold text-lg">{s.title}</h3>
                  {s.duration && <span className="text-xs text-muted-foreground">{s.duration}</span>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{s.summary}</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4 pl-0 md:pl-13">
              <div className="rounded-lg bg-secondary/40 border-l-4 border-primary p-4">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">Beev prend en charge</p>
                <ul className="space-y-1 text-sm">
                  {s.beev.map((b, i) => <li key={i} className="flex gap-2"><span className="text-primary">●</span><span>{b}</span></li>)}
                </ul>
              </div>
              <div className="rounded-lg bg-secondary/40 border-l-4 border-accent p-4">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">Côté client</p>
                <ul className="space-y-1 text-sm">
                  {s.client.map((b, i) => <li key={i} className="flex gap-2"><span className="text-accent-foreground">●</span><span>{b}</span></li>)}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
