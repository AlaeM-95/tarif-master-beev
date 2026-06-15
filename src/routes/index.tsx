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
import { Trash2, FileDown, RotateCcw, Plus, Zap, Battery, Gauge, Settings2, Presentation, X, ChevronLeft, ChevronRight, ChevronDown, Car, Home, Building2, Download, AlertTriangle, Save, FolderOpen, FileText, Users, Sparkles, Copy, BarChart3, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useChargers, useEnergy, useVehicles, useProjectType, fmtEur, type EnergyParams } from "@/lib/store";
import { computeTco, generateProposalPdf, lineItemClientUnit, lineItemClientTotal, type SelectedCharger, type SelectedVehicle, type PricingConfig, type SiteSpecs } from "@/lib/pdf";
import { BEEV_JOURNEYS, MANDATORY_SERVICES, catalogTypeOf, createBlankCharger, createBlankVehicle, type CatalogType, type Charger, type LineItem, type ProjectType, type Vehicle } from "@/lib/catalog";
import { AdminBadge } from "@/components/admin-badge";
import { ImageUpload } from "@/components/image-upload";
import { FileUpload } from "@/components/file-upload";
import { TechnicianQuoteImportDialog } from "@/components/technician-quote-import-dialog";
import { B2B2ECalculator, useB2B2EInput } from "@/components/b2b2e-calculator";
import { VehicleSpotlight } from "@/components/vehicle-spotlight";
import { VehicleComparator } from "@/components/vehicle-comparator";
import { PdfTextEditor, usePdfTextOverrides } from "@/components/pdf-text-editor";
import { BpuB2B2EEditor } from "@/components/bpu-b2b2e-editor";
import { AuditConseilEditor } from "@/components/audit-conseil-editor";
import { CarPolicyImporter } from "@/components/car-policy-importer";
import { LiveIndicator } from "@/components/live-indicator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MarginReviewDialog } from "@/components/margin-review-dialog";
import { PdfConfigPanel } from "@/components/pdf-config-panel";
import { CategoryField } from "@/components/category-field";
import { MarginSelect } from "@/components/margin-select";
import { RefreshButton } from "@/components/refresh-button";
import { SaveIndicator } from "@/components/save-indicator";
import { useMaterials, materialToLineItem, MATERIAL_CATEGORIES, type Material } from "@/lib/materials";
import { useBpuForfaits, bpuForfaitToLineItem, BPU_CATEGORIES, BPU_ZONE_COEFFICIENTS, type BpuForfait, type BpuZone } from "@/lib/bpu";
import { useAuth } from "@/lib/auth";
import { useMyCoordinates } from "@/lib/users";
import { usePermissions } from "@/lib/permissions";
import { useProposals, useProposal } from "@/lib/proposals";
import { usePdfConfig } from "@/lib/pdf-config";
import { usePdfSettings } from "@/lib/pdf-settings";
import { useProposalTemplates } from "@/lib/proposal-templates";
import { calculateTcoFull, calculateMalusCO2, calculateMalusPoids, type TcoContractParams } from "@/lib/tco-calculator";
import { useLeaserOffers, findBestOffer, type LeaserOffer } from "@/lib/leaser-offers";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList,
} from "recharts";

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
  const { isAdmin, isOps, isSales, signOut } = useAuth();
  const { can } = usePermissions();
  // Permissions configurables par l'admin (matrice par rôle). canEditProduct
  // pilote l'édition des fiches produit véhicule depuis le catalogue. Les
  // liens du menu Administration suivent les permissions backoffice.
  const canEditProduct = can("edit_product_sheet");
  // Accès backoffice pricing (ops/admin) : conditionne le raccourci « Éditer le
  // pricing » depuis la fiche produit vers /admin/vehicles.
  const canEditPricing = can("backoffice_vehicles");
  // Pour la majorité des gates d'écriture (catalogue, pricing, templates PDF)
  // on utilise isOps (admin OU ops). isAdmin reste réservé aux actions
  // super-admin (gestion utilisateurs, etc. — pas exposées dans cette page).
  const navigate = useNavigate();
  const search = Route.useSearch();
  const loadedProposalId = search.proposal;
  const { data: loadedProposal } = useProposal(loadedProposalId);
  const { save: saveProposal, proposals: allProposals, remove: removeProposal } = useProposals();
  const { vehicles, update: updateVehicle, add: addVehicle, remove: removeVehicle, removeAll: removeAllVehicles, importMany: importVehicles, duplicate: duplicateVehicle } = useVehicles();
  // Offres loueurs (table leaser_offers — migration 018). Permet de pré-remplir
  // le loyer négocié à la sélection et d'afficher un badge "AYVENS 649€/mois"
  // sur la carte véhicule.
  const { offers: leaserOffers } = useLeaserOffers();
  const { chargers, update: updateCharger, add: addCharger, remove: removeCharger, removeAllByDeployment, duplicate: duplicateCharger } = useChargers();
  const { energy, set: setEnergy, reset: resetEnergy } = useEnergy();
  const { projectType, setProjectType } = useProjectType();
  // Mode TCO : 4e onglet du sélecteur. UI uniquement, projectType en DB
  // reste 'vehicles' (la 4e valeur 'tco' n'est jamais persistée côté Supabase).
  const [tcoView, setTcoView] = useState(false);
  const activeTab: "vehicles" | "home" | "site" | "tco" = tcoView ? "tco" : projectType;

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
  // IDs des véhicules à comparer. Initialisé vide, alimenté via boutons ajout
  // depuis VehicleSpotlight ou par toggle dans la liste. Le comparateur
  // n'apparaît que si compareIds contient au moins 2 véhicules.
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  // Car policy importée depuis Excel/CSV — ÉPHÉMÈRE, state local uniquement.
  // Vide au refresh, jamais persisté en Supabase ni localStorage. Ces
  // véhicules sont disponibles pour la sélection en parallèle du catalogue.
  const [importedVehicles, setImportedVehicles] = useState<Vehicle[]>([]);
  // Éditeur WYSIWYG des textes PDF, par devis.
  const [pdfTextEditorOpen, setPdfTextEditorOpen] = useState(false);
  const { overrides: pdfTextOverrides } = usePdfTextOverrides();
  // Calculateur TCO B2B2E (Bornes domicile) — toggle d'inclusion PDF persisté
  const { input: b2b2eInput, update: setB2B2EInput, reset: resetB2B2EInput } = useB2B2EInput();
  const [b2b2eIncludeInPdf, setB2B2EIncludeInPdf] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("beev_b2b2e_include_pdf") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("beev_b2b2e_include_pdf", b2b2eIncludeInPdf ? "1" : "0"); } catch { /* ignore */ }
  }, [b2b2eIncludeInPdf]);
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
    // Normalise le state bornes : garantit un instanceId sur chaque entrée et
    // re-cle par instanceId (compat ancien format localStorage clé=charger.id).
    const rawC = loadFromStorage<Record<string, SelectedCharger>>(SK_C, {});
    const normC: Record<string, SelectedCharger> = {};
    for (const sc of Object.values(rawC)) {
      const key = sc.instanceId ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `inst-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
      normC[key] = { ...sc, instanceId: key };
    }
    setSelectedC(normC);
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

  // Pré-remplissage des coordonnées commercial à partir du compte connecté.
  // Ne s'applique QUE si les trois champs commercial sont vides (devis neuf) :
  // on ne réécrit jamais des coordonnées déjà saisies / chargées d'un devis.
  const { coordinates: myCoordinates } = useMyCoordinates();
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (prefilledRef.current || !hydratedRef.current || !myCoordinates) return;
    setClient((prev) => {
      const empty = !prev.salesRep?.trim() && !prev.salesRepEmail?.trim() && !prev.salesRepPhone?.trim();
      if (!empty) return prev;
      return {
        ...prev,
        salesRep: myCoordinates.name,
        salesRepEmail: myCoordinates.email,
        salesRepPhone: myCoordinates.phone,
      };
    });
    prefilledRef.current = true;
  }, [myCoordinates]);

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

  // Sync catalogue → panneau droit : quand un ops édite un véhicule ou une
  // borne dans le catalogue (via Éditer dans la card OU via Realtime sync
  // depuis un autre commercial), on resync l'instance dans selectedV pour
  // que les CHAMPS CATALOGUE NEUTRES (image, description, specs techniques)
  // se propagent au panneau droit sans avoir à re-cocher.
  //
  // ATTENTION : les champs SPÉCIFIQUES AU DEVIS (discountPct, negotiatedMonthly,
  // quantity, includeTco, services, options, additionalConfigs, siteSpecs,
  // lineItems) sont PRÉSERVÉS sans modification. Le commercial est seul
  // maître de ces valeurs depuis le panneau droit.
  //
  // Pour reprendre la remise / le loyer catalogue mis à jour, il suffit
  // de DÉCOCHER puis RECOCHER le véhicule dans le catalogue.
  useEffect(() => {
    if (!hydratedRef.current || vehicles.length === 0) return;
    setSelectedV((prev) => {
      let changed = false;
      const next: Record<string, SelectedVehicle> = {};
      for (const [id, sv] of Object.entries(prev)) {
        const fresh = vehicles.find((v) => v.id === id);
        if (fresh && fresh !== sv.vehicle) {
          // Remplace UNIQUEMENT vehicle (champs catalogue), on préserve tous
          // les champs du devis tels quels.
          next[id] = { ...sv, vehicle: fresh };
          changed = true;
        } else {
          next[id] = sv;
        }
      }
      return changed ? next : prev;
    });
  }, [vehicles]);

  useEffect(() => {
    if (!hydratedRef.current || chargers.length === 0) return;
    setSelectedC((prev) => {
      let changed = false;
      const next: Record<string, SelectedCharger> = {};
      // La clé est l'instanceId du devis ; on retrouve la borne catalogue via
      // sc.charger.id (plusieurs instances peuvent partager la même référence).
      for (const [key, sc] of Object.entries(prev)) {
        const fresh = chargers.find((c) => c.id === sc.charger.id);
        if (fresh && fresh !== sc.charger) {
          next[key] = { ...sc, charger: fresh };
          changed = true;
        } else {
          next[key] = sc;
        }
      }
      return changed ? next : prev;
    });
  }, [chargers]);

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
    // Clé par instanceId. Les devis sauvegardés avant le multi-instance n'ont
    // pas d'instanceId : on en génère un (rétro-compatibilité).
    loadedProposal.selectedChargers.forEach((c) => {
      const key = c.instanceId ?? newInstanceId();
      sc[key] = { ...c, instanceId: key };
    });
    setSelectedC(sc);
    if (loadedProposal.energyParams) setEnergy(loadedProposal.energyParams);
  }, [loadedProposal?.id]);

  const [isSavingProposal, setIsSavingProposal] = useState(false);
  // Timestamp du dernier enregistrement réussi — affiché à côté du bouton
  // pour rassurer l'utilisateur que chaque clic produit bien un save côté DB.
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  // Dialogue de confirmation si une proposition pour le même client existe déjà.
  const [duplicateDialog, setDuplicateDialog] = useState<{ open: boolean; existing: string | null }>({ open: false, existing: null });
  // Templates de propositions : permet de sauvegarder l'état courant comme
  // modèle réutilisable, ou de démarrer une nouvelle proposition depuis un
  // modèle existant. Les infos client ne sont jamais incluses dans le template.
  const { templates, create: createTemplate, remove: removeTemplate } = useProposalTemplates();
  const [saveTplDialog, setSaveTplDialog] = useState<{ open: boolean; name: string; description: string }>({ open: false, name: "", description: "" });
  const [pickTplDialog, setPickTplDialog] = useState(false);
  // Détecte si une proposition pour le même client existe déjà (cas "create"
  // uniquement — quand on met à jour, on travaille sur une proposition connue).
  const findDuplicateProposal = (companyName: string): string | null => {
    if (loadedProposalId) return null; // édition d'une proposition existante : pas un doublon
    const target = companyName.trim().toLowerCase();
    if (!target) return null;
    const match = allProposals.find((p) => p.clientCompany.trim().toLowerCase() === target);
    return match ? match.id : null;
  };

  // Exécute la sauvegarde proprement dite. Séparé de handleSaveProposal pour
  // pouvoir être appelé soit directement, soit après le choix dans le dialogue
  // doublon (avec ou sans suppression de l'ancienne proposition).
  const doSaveProposal = async (deleteExistingId: string | null) => {
    setIsSavingProposal(true);
    try {
      if (deleteExistingId) {
        const delRes = await removeProposal(deleteExistingId);
        if (delRes.error) {
          toast.error(`Échec suppression ancienne proposition : ${delRes.error}`);
          return;
        }
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
        setLastSavedAt(new Date());
        toast.success(loadedProposalId ? "Proposition mise à jour" : "Proposition créée");
        if (!loadedProposalId && result.id) {
          navigate({ to: "/", search: { proposal: result.id } });
        }
      }
    } finally {
      setIsSavingProposal(false);
    }
  };

  // Charge un template dans l'état courant. Les infos client/commercial sont
  // préservées (jamais incluses dans le template). Bascule le type de projet
  // sur celui du template pour cohérence d'affichage.
  const applyTemplate = (t: { projectType: ProjectType; selectedVehicles: SelectedVehicle[]; selectedChargers: SelectedCharger[]; energyParams: EnergyParams | null }) => {
    setProjectType(t.projectType);
    const sv: Record<string, SelectedVehicle> = {};
    t.selectedVehicles.forEach((v) => { sv[v.vehicle.id] = v; });
    setSelectedV(sv);
    const sc: Record<string, SelectedCharger> = {};
    t.selectedChargers.forEach((c) => {
      const key = c.instanceId ?? newInstanceId();
      sc[key] = { ...c, instanceId: key };
    });
    setSelectedC(sc);
    if (t.energyParams) setEnergy(t.energyParams);
  };

  const handleSaveAsTemplate = async () => {
    if (!saveTplDialog.name.trim()) {
      toast.error("Le nom du template est requis");
      return;
    }
    try {
      await createTemplate.mutateAsync({
        name: saveTplDialog.name.trim(),
        description: saveTplDialog.description.trim() || null,
        projectType,
        selectedVehicles: Object.values(selectedV),
        selectedChargers: Object.values(selectedC),
        energyParams: energy,
      });
      toast.success(`Template "${saveTplDialog.name.trim()}" enregistré`);
      setSaveTplDialog({ open: false, name: "", description: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur sauvegarde template");
    }
  };

  const handleSaveProposal = async () => {
    if (isSavingProposal) return; // évite les double-clics
    if (!client.company.trim()) {
      toast.error("La société client est requise pour sauvegarder");
      return;
    }
    // Détection doublon (uniquement à la création). Si trouvé, on ouvre le
    // dialogue de confirmation qui décide du destin de l'ancienne proposition.
    const existingId = findDuplicateProposal(client.company);
    if (existingId) {
      setDuplicateDialog({ open: true, existing: existingId });
      return;
    }
    await doSaveProposal(null);
  };

  const counts = useMemo(() => ({
    v: Object.keys(selectedV).length,
    c: Object.keys(selectedC).length,
  }), [selectedV, selectedC]);

  // Recherche & filtres catalogue véhicules
  const [vehicleSearch, setVehicleSearch] = useState("");
  // Catalogue actif : EV (électrique + hybride rechargeable) ou Thermique.
  const [catalogType, setCatalogType] = useState<CatalogType>("ev");
  const [vehicleEnergyFilter, setVehicleEnergyFilter] = useState<string>("all");
  const [vehiclePriceMax, setVehiclePriceMax] = useState<number | null>(null);
  // Nouveaux filtres demandés : loyer mensuel max, durée préférée, km/an cible
  const [vehicleMonthlyMax, setVehicleMonthlyMax] = useState<number | null>(null);
  const [vehicleDurationFilter, setVehicleDurationFilter] = useState<number | null>(null);
  const [vehicleKmFilter, setVehicleKmFilter] = useState<number | null>(null);

  // Catégories existantes (extraites du catalogue) pour le dropdown admin
  const existingCategories = useMemo(
    () => Array.from(new Set(vehicles.map((v) => v.category).filter(Boolean))),
    [vehicles],
  );

  const filteredVehicles = useMemo(() => {
    const q = vehicleSearch.trim().toLowerCase();
    return vehicles.filter((v) => {
      // Catalogue EV vs Thermique (filtre primaire par classe d'énergie)
      if (catalogTypeOf(v.energy) !== catalogType) return false;
      if (q && !`${v.brand} ${v.model} ${v.version} ${v.category}`.toLowerCase().includes(q)) return false;
      if (vehicleEnergyFilter !== "all" && v.energy !== vehicleEnergyFilter) return false;
      if (vehiclePriceMax !== null && v.priceTtc > vehiclePriceMax) return false;
      // Loyer mensuel max : on filtre sur monthlyLld (le loyer catalogue),
      // pas le loyer négocié (qui s'applique seulement après sélection).
      if (vehicleMonthlyMax !== null && (v.monthlyLld ?? 0) > vehicleMonthlyMax) return false;
      // Durée / km : on regarde si une offre loueur correspond
      if (vehicleDurationFilter !== null || vehicleKmFilter !== null) {
        const offers = leaserOffers.filter((o) => o.vehicleId === v.id);
        if (offers.length > 0) {
          const matchesDuration = vehicleDurationFilter === null ||
            offers.some((o) => o.durationMonths === vehicleDurationFilter);
          const matchesKm = vehicleKmFilter === null ||
            offers.some((o) => o.kmTotal >= vehicleKmFilter);
          if (!matchesDuration || !matchesKm) return false;
        }
      }
      return true;
    });
  }, [vehicles, catalogType, vehicleSearch, vehicleEnergyFilter, vehiclePriceMax, vehicleMonthlyMax, vehicleDurationFilter, vehicleKmFilter, leaserOffers]);

  // visibleCount = TOUTES les sélections (véhicules + bornes), pour permettre
  // au commercial de générer un PDF même si la sélection mélange plusieurs types.
  const visibleCount = counts.v + counts.c;

  const toggleV = (v: Vehicle) => {
    setSelectedV((s) => {
      if (s[v.id]) { const { [v.id]: _, ...rest } = s; return rest; }
      // Pré-remplir le loyer négocié depuis la meilleure offre loueur matching.
      // Cherche d'abord match exact (49m/40k ou 37m/90k), sinon approximatif.
      // Si pas d'offre, fallback sur monthlyLld du catalogue.
      const matching = findBestOffer(leaserOffers, v.id, 48, energy.kmPerYear);
      const negotiated = matching ? matching.monthlyPriceTtc : v.monthlyLld;
      const duration = matching ? matching.durationMonths : 48;
      return {
        ...s,
        [v.id]: {
          vehicle: v, quantity: 1, discountPct: 0,
          negotiatedMonthly: negotiated,
          durationMonths: duration, kmPerYear: energy.kmPerYear,
          includeTco: false, services: [], options: [],
        },
      };
    });
  };
  // Génère un identifiant d'instance unique pour une borne ajoutée au devis.
  const newInstanceId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `inst-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  const toggleC = (c: Charger) => {
    setSelectedC((s) => {
      // Toggle off : si au moins une instance de cette référence existe, on
      // retire TOUTES ses instances. Sinon on ajoute une première instance.
      const existing = Object.entries(s).filter(([, sc]) => sc.charger.id === c.id);
      if (existing.length > 0) {
        const next = { ...s };
        for (const [key] of existing) delete next[key];
        return next;
      }
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

      const instanceId = newInstanceId();
      return {
        ...s,
        [instanceId]: {
          instanceId,
          charger: c, quantity: 1, discountPct: 0, installIncluded: true,
          siteName: "", siteAddress: "", siteContact: "",
          lineItems,
        },
      };
    });
  };

  // Duplique une instance de borne (même référence) pour un autre site : copie
  // la config, vide le nom de site, génère un nouvel instanceId. Permet de
  // chiffrer la même borne sur plusieurs sites d'une même entreprise.
  const duplicateChargerInstance = (sc: SelectedCharger) => {
    setSelectedC((s) => {
      const instanceId = newInstanceId();
      return {
        ...s,
        [instanceId]: {
          ...sc,
          instanceId,
          siteName: "",
          // copie profonde des lignes pour éditer indépendamment
          lineItems: sc.lineItems.map((li) => ({ ...li })),
          siteSpecs: sc.siteSpecs ? { ...sc.siteSpecs } : undefined,
        },
      };
    });
  };

  // Une référence de borne est "sélectionnée" si au moins une instance existe.
  const chargerSelected = (chargerId: string) =>
    Object.values(selectedC).some((sc) => sc.charger.id === chargerId);

  const [marginDialog, setMarginDialog] = useState(false);
  const [bpuB2B2EOpen, setBpuB2B2EOpen] = useState(false);
  const [auditConseilOpen, setAuditConseilOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { config: pdfConfig, update: updatePdfConfig, reset: resetPdfConfig } = usePdfConfig();
  // Sous-titres de catalogue éditables par type de projet (depuis /admin/pdf).
  const { getSettings: getPdfSettings } = usePdfSettings();
  const catalogSubtitleFor = (type: "vehicles" | "home" | "site"): string => {
    const s = getPdfSettings(type);
    if (s?.catalogSubtitle && s.catalogSubtitle.trim().length > 0) return s.catalogSubtitle;
    // Fallback si la migration 011 n'est pas encore appliquée
    if (type === "vehicles") return "Catalogue synchronisé avec le calculateur TCO Beev. Loyers exprimés en TTC.";
    if (type === "home") return "Kit B2B2E clé en main · pose jusqu'à 10 m incluse · supervision et remboursement automatisé.";
    return "Devis détaillé site par site (matériel + IRVE + génie civil).";
  };

  // Génère le PDF avec try/catch + timeout pour ne jamais bloquer une re-génération.
  // En cas d'erreur (réseau Supabase, navigateur, etc.), affiche un toast
  // sans bloquer le bouton. Le commercial peut re-cliquer immédiatement.
  const doGeneratePdf = async (preview = false) => {
    if (isGenerating) return; // évite les double-clics rapides
    setIsGenerating(true);
    try {
      // Avant génération : on rafraîchit les données catalogue (image, prix,
      // description, etc.) des éléments sélectionnés en allant chercher la
      // version actuelle dans le catalogue. Sans ça, une modif admin sur
      // l'image d'une borne ne se voyait pas dans le PDF parce que selectedC
      // gardait le snapshot pris au moment de la sélection.
      const freshVehicles = Object.values(selectedV).map((sv) => {
        const fresh = vehicles.find((v) => v.id === sv.vehicle.id);
        // On rafraîchit depuis le catalogue (prix, specs) mais on PRÉSERVE
        // isCurrentFleet : ce flag est saisi au niveau du devis (toggle
        // « flotte actuelle ») et n'existe pas dans le catalogue. Sans ça,
        // le refresh écrasait le flag et le PDF affichait toujours
        // « PROPOSITION BEEV » au lieu de « FLOTTE ACTUELLE ».
        return fresh ? { ...sv, vehicle: { ...fresh, isCurrentFleet: sv.vehicle.isCurrentFleet } } : sv;
      });
      const freshChargers = Object.values(selectedC).map((sc) => {
        const fresh = chargers.find((c) => c.id === sc.charger.id);
        return fresh ? { ...sc, charger: fresh } : sc;
      });
      // Timeout de 30s : si une requête réseau hang (Supabase, fonts), on
      // débloque le bouton plutôt que de spinner indéfiniment.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Génération trop longue (30s). Vérifiez votre connexion.")), 30000),
      );
      // En mode TCO, on force une config focalisée : pas de page Pourquoi
      // Beev, ni Garanties, ni Parcours, ni Synthèse exec. La page TCO
      // comparative + les blocs TCO par véhicule sont le seul contenu utile.
      // Les véhicules sélectionnés ont automatiquement includeTco=true pour
      // que le bloc TCO s'affiche sur chaque fiche.
      const tcoFocusedConfig = tcoView ? {
        ...pdfConfig,
        showWhyBeev: false,
        showSocialProof: false,
        showTcoComparison: true,
        showFinancialSummary: false,
        showGuarantees: false,
        showJourney: false,
        showExecutiveSummary: false,
        showVehicleTcoBlock: true,
        showVehicleServices: false,
        showVehicleOptions: false,
      } : pdfConfig;
      const vehiclesForPdf = tcoView
        ? freshVehicles.map((sv) => ({ ...sv, includeTco: true }))
        : freshVehicles;
      await Promise.race([
        generateProposalPdf({
          projectType, client, energy,
          vehicles: vehiclesForPdf,
          chargers: freshChargers,
          pdfConfig: tcoFocusedConfig,
          b2b2eInput: projectType === "home" && b2b2eIncludeInPdf ? b2b2eInput : undefined,
          // Surcharges WYSIWYG saisies par le commercial dans le PdfTextEditor.
          // Stockées en localStorage par navigateur. Si vide, le PDF utilise
          // les valeurs DB / fallback comme avant.
          textOverrides: Object.keys(pdfTextOverrides).length > 0 ? pdfTextOverrides : undefined,
          preview,
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

  const exportPdf = async (preview = false) => {
    if (!client.company) { alert("Renseignez au moins le nom de la société client."); return; }
    // Validation : chaque véhicule du devis doit avoir une énergie ET une
    // consommation renseignées (sinon les calculs TCO / l'affichage conso sont
    // faux). On bloque la génération et on indique les véhicules à compléter.
    const invalid = Object.values(selectedV).filter((sv) => {
      const v = sv.vehicle;
      const noEnergy = !v.energy || !String(v.energy).trim();
      const conso = v.energy === "Électrique" ? (v.consumptionElec ?? v.consumption) : (v.consumptionThermal ?? v.consumption);
      const noConso = !conso || conso <= 0;
      return noEnergy || noConso;
    });
    if (invalid.length > 0) {
      const names = invalid.map((sv) => `${sv.vehicle.brand} ${sv.vehicle.model}`.trim()).join(", ");
      toast.error(`Énergie ou consommation manquante sur : ${names}. Complétez la fiche véhicule avant de générer le PDF.`);
      return;
    }
    // Si l'offre contient des bornes site entreprise (peu importe le projectType
    // courant — utile pour les offres combinées véhicules + bornes), on ouvre
    // le dialogue de validation des marges avant génération du PDF client.
    // L'aperçu saute la revue des marges (simple visualisation rapide).
    const hasSiteChargers = Object.values(selectedC).some((sc) => sc.charger.deployment === "site");
    if (hasSiteChargers && !preview) {
      setMarginDialog(true);
      return;
    }
    await doGeneratePdf(preview);
  };

  const chargersHome = chargers.filter((c) => c.deployment === "domicile");
  const chargersSite = chargers.filter((c) => c.deployment === "site");

  // Réinitialise la sélection courante quand on change de type pour éviter les croisements
  // Permet de passer d'un type de projet à l'autre SANS réinitialiser les sélections.
  // Le commercial peut donc construire une offre combinée (véhicules + bornes domicile
  // + bornes site dans le même PDF).
  const switchProject = (t: "vehicles" | "home" | "site" | "tco") => {
    if (t === "tco") {
      setTcoView(true);
      // En mode TCO on travaille sur des véhicules, on bascule le projectType
      // sous-jacent à 'vehicles' pour que les sélections soient cohérentes.
      if (projectType !== "vehicles") setProjectType("vehicles");
    } else {
      setTcoView(false);
      setProjectType(t);
    }
  };

  if (presenting) {
    // Mode présentation : on rebranche les sélections sur la version actuelle
    // du catalogue (image, prix, description, etc.) pour que les modifs admin
    // soient visibles côté client sans avoir à décocher/recocher.
    const freshV = Object.values(selectedV).map((sv) => {
      const fresh = vehicles.find((v) => v.id === sv.vehicle.id);
      // Préserve isCurrentFleet (flag de niveau devis absent du catalogue).
      return fresh ? { ...sv, vehicle: { ...fresh, isCurrentFleet: sv.vehicle.isCurrentFleet } } : sv;
    });
    const freshC = Object.values(selectedC).map((sc) => {
      const fresh = chargers.find((c) => c.id === sc.charger.id);
      return fresh ? { ...sc, charger: fresh } : sc;
    });
    return <PresentationMode
      projectType={projectType} client={client} energy={energy}
      vehicles={freshV}
      chargers={freshC}
      onClose={() => setPresenting(false)}
      onExport={exportPdf}
    />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Dialogue de confirmation : une proposition existe déjà pour ce client */}
      <AlertDialog open={duplicateDialog.open} onOpenChange={(o) => setDuplicateDialog({ ...duplicateDialog, open: o })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Une proposition existe déjà pour {client.company}</AlertDialogTitle>
            <AlertDialogDescription>
              Une proposition au même nom de société a déjà été enregistrée. Souhaitez-vous remplacer
              l'ancienne (elle sera supprimée définitivement) ou conserver les deux propositions ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={async () => {
                const existing = duplicateDialog.existing;
                setDuplicateDialog({ open: false, existing: null });
                await doSaveProposal(null);
                if (existing) toast.success("Les deux propositions sont conservées");
              }}
            >
              Conserver les deux
            </Button>
            <AlertDialogAction
              onClick={async () => {
                const existing = duplicateDialog.existing;
                setDuplicateDialog({ open: false, existing: null });
                await doSaveProposal(existing);
              }}
            >
              Remplacer l'ancienne
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Dialogue : sauver la sélection actuelle comme template réutilisable */}
      <Dialog open={saveTplDialog.open} onOpenChange={(o) => setSaveTplDialog({ ...saveTplDialog, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer comme template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nom du template *</Label>
              <Input
                value={saveTplDialog.name}
                onChange={(e) => setSaveTplDialog({ ...saveTplDialog, name: e.target.value })}
                placeholder="Ex : Starter PME 10 VE, Flotte 50 véhicules, Audit IRVE multi-sites"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description (optionnelle)</Label>
              <Textarea
                value={saveTplDialog.description}
                onChange={(e) => setSaveTplDialog({ ...saveTplDialog, description: e.target.value })}
                placeholder="Quand utiliser ce template, à qui s'adresse-t-il, particularités..."
                className="min-h-[80px]"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {Object.keys(selectedV).length} véhicule(s) et {Object.keys(selectedC).length} borne(s)
              seront enregistrés. Les informations client ne sont jamais incluses.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveTplDialog({ open: false, name: "", description: "" })}>
              Annuler
            </Button>
            <Button onClick={handleSaveAsTemplate} disabled={!saveTplDialog.name.trim() || createTemplate.isPending}>
              {createTemplate.isPending ? "Enregistrement..." : "Enregistrer le template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue : démarrer une nouvelle proposition depuis un template */}
      <Dialog open={pickTplDialog} onOpenChange={setPickTplDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Démarrer depuis un template</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Aucun template enregistré pour l'instant. Construisez une sélection et
                cliquez sur "Sauver comme template" pour en créer un.
              </p>
            )}
            {templates.map((t) => (
              <div key={t.id} className="rounded-md border border-border p-3 flex items-start justify-between gap-3 hover:bg-accent/30">
                <button
                  type="button"
                  className="flex-1 text-left min-w-0"
                  onClick={() => {
                    applyTemplate(t);
                    setPickTplDialog(false);
                    toast.success(`Template "${t.name}" chargé`);
                  }}
                >
                  <p className="text-sm font-semibold">{t.name}</p>
                  {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">
                    {t.projectType === "vehicles" ? "Véhicules" : t.projectType === "home" ? "Bornes domicile" : "Bornes site"}
                    {" · "}
                    {t.selectedVehicles.length} véhicule(s)
                    {" · "}
                    {t.selectedChargers.length} borne(s)
                  </p>
                </button>
                {isOps && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive flex-shrink-0"
                    title="Supprimer ce template"
                    onClick={async () => {
                      if (!confirm(`Supprimer définitivement le template "${t.name}" ?`)) return;
                      try {
                        await removeTemplate.mutateAsync(t.id);
                        toast.success("Template supprimé");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Erreur");
                      }
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickTplDialog(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        onConfirm={() => doGeneratePdf(false)}
      />
      <BpuB2B2EEditor open={bpuB2B2EOpen} onOpenChange={setBpuB2B2EOpen} clientName={client.company} />
      <AuditConseilEditor open={auditConseilOpen} onOpenChange={setAuditConseilOpen} clientName={client.company} />
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="w-full px-4 h-full flex items-center justify-between gap-3 flex-nowrap">
          {/* ─── Identité Beev (gauche) ─── */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <img
              src="/images/logo-beev-noir.png"
              alt="Beev"
              className="h-8 w-auto object-contain"
              onError={(ev) => {
                // Fallback : si le logo ne charge pas, on affiche un placeholder lavande
                const img = ev.currentTarget as HTMLImageElement;
                img.style.display = "none";
                const next = img.nextElementSibling as HTMLElement | null;
                if (next) next.style.display = "flex";
              }}
            />
            <div className="w-10 h-10 rounded-xl items-center justify-center bg-primary text-primary-foreground font-bold text-xl tracking-tight shadow-sm" style={{ display: "none" }}>B</div>
            <div className="hidden lg:block">
              <p className="text-[10px] text-muted-foreground tracking-wide uppercase font-medium">Offre commerciale grand compte</p>
            </div>
            <Badge variant="outline" className="hidden md:inline-flex border-primary/30 bg-primary/5 text-primary text-[10px] font-semibold ml-2">{visibleCount} sélection(s)</Badge>
            <LiveIndicator />
          </div>

          {/* ─── Actions (droite) — regroupées par hiérarchie ─── */}
          <div className="flex items-center gap-2 flex-nowrap justify-end flex-shrink-0">
            {/* Status meta : refresh + badge admin discrets */}
            <RefreshButton />
            <AdminBadge />

            {/* Menu Admin déroulant : regroupe Propositions, Véhicules, PDF admin,
                Utilisateurs, Templates, Refresh. Évite la surcharge horizontale. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <Settings2 className="w-3.5 h-3.5" /> Menu
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Navigation</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <a href="/proposals" className="cursor-pointer"><FolderOpen className="w-4 h-4 mr-2" /> Propositions</a>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPickTplDialog(true)} className="cursor-pointer">
                  <FileText className="w-4 h-4 mr-2" /> Templates
                </DropdownMenuItem>
                {isOps && (
                  <DropdownMenuItem
                    onClick={() => setSaveTplDialog({ open: true, name: "", description: "" })}
                    disabled={visibleCount === 0}
                    className="cursor-pointer"
                  >
                    <Save className="w-4 h-4 mr-2" /> Sauver comme template
                  </DropdownMenuItem>
                )}
                {(can("backoffice_vehicles") || can("backoffice_pdf") || can("manage_users")) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Administration</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <a href="/admin" className="cursor-pointer"><BarChart3 className="w-4 h-4 mr-2" /> Tableau de bord</a>
                    </DropdownMenuItem>
                    {can("backoffice_vehicles") && (
                      <DropdownMenuItem asChild>
                        <a href="/admin/vehicles" className="cursor-pointer"><Car className="w-4 h-4 mr-2" /> Véhicules & loueurs</a>
                      </DropdownMenuItem>
                    )}
                    {can("backoffice_pdf") && (
                      <DropdownMenuItem asChild>
                        <a href="/admin/pdf" className="cursor-pointer"><FileDown className="w-4 h-4 mr-2" /> Configuration PDF</a>
                      </DropdownMenuItem>
                    )}
                    {can("manage_users") && (
                      <DropdownMenuItem asChild>
                        <a href="/admin/users" className="cursor-pointer"><Users className="w-4 h-4 mr-2" /> Utilisateurs & rôles</a>
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer text-destructive focus:text-destructive">
                  <X className="w-4 h-4 mr-2" /> Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Actions principales — toujours visibles */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveProposal}
              disabled={visibleCount === 0 || isSavingProposal}
              className="gap-1.5"
            >
              {isSavingProposal ? (
                <><RotateCcw className="w-3.5 h-3.5 animate-spin" /> ...</>
              ) : (
                <><Save className="w-3.5 h-3.5" /> {loadedProposalId ? "Mettre à jour" : "Sauvegarder"}</>
              )}
            </Button>
            {lastSavedAt && (
              <span className="text-[10px] text-muted-foreground hidden lg:inline" title={lastSavedAt.toISOString()}>
                {lastSavedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}

            {/* Menu « Documents » : regroupe les actions secondaires de
                production de documents (présentation, personnalisation des
                textes, BPU partenariat, audit & conseil) pour garder le header
                sur une seule ligne sans scroll horizontal. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 relative">
                  <FileText className="w-3.5 h-3.5" /> Documents
                  <ChevronDown className="w-3 h-3" />
                  {Object.keys(pdfTextOverrides).length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-beev-rose text-beev-black text-[9px] font-bold rounded-full px-1.5 py-0.5">
                      {Object.keys(pdfTextOverrides).length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>Devis en cours</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setPresenting(true)} disabled={visibleCount === 0} className="cursor-pointer">
                  <Presentation className="w-4 h-4 mr-2" /> Présenter
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setPdfTextEditorOpen(true)}
                  disabled={visibleCount === 0}
                  className="cursor-pointer"
                  title="Personnaliser tous les textes du PDF avant génération"
                >
                  <Sparkles className="w-4 h-4 mr-2" /> Personnaliser les textes
                  {Object.keys(pdfTextOverrides).length > 0 && (
                    <span className="ml-auto text-[10px] font-bold text-beev-rose">{Object.keys(pdfTextOverrides).length}</span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Documents autonomes</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setBpuB2B2EOpen(true)} className="cursor-pointer">
                  <Sparkles className="w-4 h-4 mr-2 text-beev-bleu" /> BPU partenariat
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAuditConseilOpen(true)} className="cursor-pointer">
                  <Sparkles className="w-4 h-4 mr-2 text-beev-rose" /> Audit & conseil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Aperçu : ouvre le PDF dans un nouvel onglet sans télécharger. */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportPdf(true)}
              disabled={visibleCount === 0 || isGenerating}
              className="gap-1.5"
              title="Aperçu du PDF dans un nouvel onglet (sans téléchargement)"
            >
              <FileText className="w-3.5 h-3.5" /> Aperçu
            </Button>

            {/* CTA primaire : génération du PDF de proposition (jsPDF). */}
            <Button size="sm" onClick={() => exportPdf(false)} disabled={visibleCount === 0 || isGenerating} className="gap-1.5">
              {isGenerating ? (
                <><RotateCcw className="w-3.5 h-3.5 animate-spin" /> Génération...</>
              ) : (
                <><FileDown className="w-3.5 h-3.5" /> Générer PDF</>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Dialog plein écran : éditeur WYSIWYG des textes PDF */}
      <PdfTextEditor
        open={pdfTextEditorOpen}
        onOpenChange={setPdfTextEditorOpen}
        projectType={projectType}
      />

      <main className="container mx-auto px-6 pt-20 pb-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <ProjectTypeSelector value={activeTab} onChange={switchProject} />
          <ClientCard client={client} setClient={setClient} />

          {tcoView && (
            <TcoCalculator
              vehicles={vehicles}
              selectedV={selectedV}
              onToggle={toggleV}
              energy={energy}
              setEnergy={setEnergy}
              resetEnergy={resetEnergy}
            />
          )}

          {/* Top 5 véhicules du mois : section dédiée si l'ops a marqué des shortlist */}
          {!tcoView && projectType === "vehicles" && (
            <TopShortlistSection
              vehicles={vehicles.filter((v) => v.shortlist).slice(0, 5)}
              selectedV={selectedV}
              onToggle={toggleV}
              leaserOffers={leaserOffers}
            />
          )}

          {!tcoView && projectType === "vehicles" && (
            <VehicleSpotlight
              vehicles={vehicles}
              onCompare={() => {
                // Auto-sélectionne les 3 premiers véhicules pour démarrer
                // la comparaison ; le commercial ajustera ensuite.
                const featuredId = vehicles.find((x) => x.featured)?.id;
                const ids = [featuredId, ...vehicles.filter((v) => v.id !== featuredId).slice(0, 2).map((v) => v.id)]
                  .filter(Boolean) as string[];
                setCompareIds(new Set(ids));
                // scroll vers le comparateur
                setTimeout(() => {
                  document.getElementById("vehicle-comparator")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
              }}
            />
          )}

          {!tcoView && projectType === "vehicles" && (
            <CatalogSection
              title={`Véhicules (${filteredVehicles.length}${filteredVehicles.length !== vehicles.length ? ` / ${vehicles.length}` : ""})`}
              subtitle={catalogSubtitleFor("vehicles")}
              // Édition des fiches produit pilotée par la permission dédiée
              // (l'admin peut l'accorder à un commercial). L'ajout/suppression
              // en masse et l'import restent réservés au backoffice (ops/admin).
              isAdmin={canEditProduct}
              itemCount={vehicles.length}
              onDeleteAll={isOps ? () => { setSelectedV({}); removeAllVehicles(); } : undefined}
              deleteAllLabel="Supprimer tous les véhicules ?"
              onAdd={isOps ? () => addVehicle(createBlankVehicle()) : undefined}
              addLabel="Ajouter un véhicule"
              importTco={isOps ? (list) => importVehicles(list) : undefined}
            >
              {/* Onglets de catalogue : EV (électrique + hybride rechargeable)
                  vs Thermique (hybride, mild hybrid, essence, diesel). Filtre
                  primaire du catalogue. */}
              <div className="flex items-center gap-1 mb-3 p-1 rounded-lg bg-muted/50 border w-fit">
                {([
                  { key: "ev" as CatalogType, label: "Électrique & hybride rechargeable" },
                  { key: "thermique" as CatalogType, label: "Thermique & hybride" },
                ]).map((tab) => {
                  const count = vehicles.filter((v) => catalogTypeOf(v.energy) === tab.key).length;
                  const active = catalogType === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => { setCatalogType(tab.key); setVehicleEnergyFilter("all"); }}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                        active ? "bg-beev-black text-white" : "text-muted-foreground hover:bg-card"
                      }`}
                    >
                      {tab.label} ({count})
                    </button>
                  );
                })}
              </div>
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
                {/* Nouveau : Loyer mensuel max */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="whitespace-nowrap">Loyer max</span>
                  <Input
                    type="number"
                    value={vehicleMonthlyMax ?? ""}
                    onChange={(e) => setVehicleMonthlyMax(e.target.value ? Number(e.target.value) : null)}
                    placeholder="—"
                    className="h-8 w-24 text-xs"
                  />
                  <span>€/mois</span>
                </div>
                {/* Nouveau : Durée préférée */}
                <div className="flex items-center gap-1">
                  {[36, 48, 60].map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant={vehicleDurationFilter === d ? "default" : "outline"}
                      onClick={() => setVehicleDurationFilter(vehicleDurationFilter === d ? null : d)}
                      className="h-8 text-xs"
                    >
                      {d} mois
                    </Button>
                  ))}
                </div>
                {/* Nouveau : Km/an minimum (basé sur kmTotal des offres loueurs) */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="whitespace-nowrap">Km min</span>
                  <Input
                    type="number"
                    value={vehicleKmFilter ?? ""}
                    onChange={(e) => setVehicleKmFilter(e.target.value ? Number(e.target.value) : null)}
                    placeholder="—"
                    className="h-8 w-24 text-xs"
                    step={10000}
                  />
                </div>
                {(vehicleSearch || vehicleEnergyFilter !== "all" || vehiclePriceMax !== null || vehicleMonthlyMax !== null || vehicleDurationFilter !== null || vehicleKmFilter !== null) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setVehicleSearch(""); setVehicleEnergyFilter("all"); setVehiclePriceMax(null);
                      setVehicleMonthlyMax(null); setVehicleDurationFilter(null); setVehicleKmFilter(null);
                    }}
                    className="h-8 text-xs gap-1"
                  >
                    <X className="w-3 h-3" /> Effacer
                  </Button>
                )}
              </div>

              <VehicleCatalogByBrand
                vehicles={filteredVehicles}
                allVehicleCount={vehicles.length}
                selectedV={selectedV}
                canEditPricing={canEditPricing}
                onToggle={toggleV}
                onUpdate={isSales ? updateVehicle : undefined}
                onDelete={isOps ? async (v) => {
                  if (selectedV[v.id]) toggleV(v);
                  const result = await removeVehicle(v.id);
                  if (result?.error) toast.error(`Échec suppression : ${result.error}`);
                  else toast.success(`${v.brand} ${v.model} supprimé définitivement`);
                } : undefined}
                onDuplicate={isSales ? async (v) => {
                  const res = await duplicateVehicle(v.id);
                  if (res.error) toast.error(`Échec duplication : ${res.error}`);
                  else toast.success(`${v.brand} ${v.model} dupliqué — modifiez la copie pour personnaliser`);
                } : undefined}
                existingCategories={existingCategories}
                leaserOffers={leaserOffers}
                hasActiveSearch={!!vehicleSearch.trim()}
                compareIds={compareIds}
                onToggleCompare={(id) => setCompareIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })}
              />
              {filteredVehicles.length === 0 && vehicles.length > 0 && (
                <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
                  Aucun véhicule ne correspond à votre recherche.
                </div>
              )}
            </CatalogSection>
          )}

          {/* Import Car Policy Client — encart sous le catalogue véhicules.
              Permet d'importer la car policy actuelle du prospect (Excel/CSV)
              sans toucher au catalogue Beev officiel ni à Supabase. State
              éphémère uniquement (perdu au refresh). */}
          {!tcoView && projectType === "vehicles" && (
            <CarPolicyImporter
              catalogueVehicles={vehicles}
              importedVehicles={importedVehicles}
              onImported={setImportedVehicles}
              onClear={() => setImportedVehicles([])}
              onAddOne={(v) => toggleV(v)}
              onRemoveOne={(id) => {
                // Retire de selectedV mais conserve la disponibilité dans la liste importée
                setSelectedV((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
              }}
              onDeleteImported={(id) => {
                // Supprime définitivement le véhicule de la liste importée
                // ET du devis s'il y était (import non souhaité / doublon).
                setImportedVehicles((prev) => prev.filter((v) => v.id !== id));
                setSelectedV((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
              }}
              onUpdateSelected={(id, patch) => {
                // Propage les modifs de fiche aux SelectedVehicles déjà au devis.
                // Si le loyer catalogue (monthlyLld) change, on resynchronise
                // negotiatedMonthly pour éviter le décalage panneau droite vs PDF.
                setSelectedV((prev) => {
                  if (!prev[id]) return prev;
                  const next = { ...prev[id], vehicle: { ...prev[id].vehicle, ...patch } };
                  if (patch.monthlyLld !== undefined) {
                    next.negotiatedMonthly = patch.monthlyLld;
                  }
                  return { ...prev, [id]: next };
                });
              }}
              selectedIds={new Set(Object.keys(selectedV))}
            />
          )}

          {/* Comparateur inline — visible quand >= 2 véhicules dans compareIds */}
          {!tcoView && projectType === "vehicles" && compareIds.size >= 2 && (
            <div id="vehicle-comparator">
              <VehicleComparator
                vehicles={vehicles.filter((v) => compareIds.has(v.id))}
                onRemove={(id) => setCompareIds((prev) => {
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                })}
                onClear={() => setCompareIds(new Set())}
              />
            </div>
          )}

          {projectType === "home" && (
            <CatalogSection
              title={`Bornes domicile collaborateurs (${chargersHome.length})`}
              subtitle={catalogSubtitleFor("home")}
              isAdmin={isOps}
              itemCount={chargersHome.length}
              onDeleteAll={isOps ? () => { setSelectedC({}); removeAllByDeployment("domicile"); } : undefined}
              deleteAllLabel="Supprimer toutes les bornes domicile ?"
              onAdd={isOps ? () => addCharger(createBlankCharger("domicile")) : undefined}
              addLabel="Ajouter une borne domicile"
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {chargersHome.map((c) => (
                  <ChargerCard key={c.id} charger={c} selected={chargerSelected(c.id)}
                    onToggle={() => toggleC(c)}
                    onUpdate={isSales ? (p) => updateCharger(c.id, p) : undefined}
                    onDelete={isOps ? async () => {
                      if (chargerSelected(c.id)) toggleC(c);
                      const result = await removeCharger(c.id);
                      if (result?.error) toast.error(`Échec suppression : ${result.error}`);
                      else toast.success(`${c.brand} ${c.model} supprimée définitivement`);
                    } : undefined}
                    onDuplicate={isSales ? async () => {
                      const res = await duplicateCharger(c.id);
                      if (res.error) toast.error(`Échec duplication : ${res.error}`);
                      else toast.success(`${c.brand} ${c.model} dupliquée — modifiez la copie pour personnaliser`);
                    } : undefined}
                  />
                ))}
              </div>
            </CatalogSection>
          )}

          {/* Calculateur TCO B2B2E — apparaît en mode Bornes domicile,
              juste après le catalogue des bornes. Affiché en permanence
              en mode home pour offrir l'estimation économique même avant
              sélection. */}
          {projectType === "home" && (
            <B2B2ECalculator
              input={b2b2eInput}
              update={setB2B2EInput}
              reset={resetB2B2EInput}
              includeInPdf={b2b2eIncludeInPdf}
              setIncludeInPdf={setB2B2EIncludeInPdf}
              suggestedNbCollabs={Object.values(selectedC)
                .filter((sc) => sc.charger.deployment === "domicile")
                .reduce((sum, sc) => sum + (sc.quantity || 1), 0)}
            />
          )}

          {projectType === "site" && (
            <CatalogSection
              title={`Bornes site entreprise (${chargersSite.length})`}
              subtitle={catalogSubtitleFor("site")}
              isAdmin={isOps}
              itemCount={chargersSite.length}
              onDeleteAll={isOps ? () => { setSelectedC({}); removeAllByDeployment("site"); } : undefined}
              deleteAllLabel="Supprimer toutes les bornes site ?"
              onAdd={isOps ? () => addCharger(createBlankCharger("site")) : undefined}
              addLabel="Ajouter une borne site"
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {chargersSite.map((c) => (
                  <ChargerCard key={c.id} charger={c} selected={chargerSelected(c.id)}
                    onToggle={() => toggleC(c)}
                    onUpdate={isSales ? (p) => updateCharger(c.id, p) : undefined}
                    onDelete={isOps ? async () => {
                      if (chargerSelected(c.id)) toggleC(c);
                      const result = await removeCharger(c.id);
                      if (result?.error) toast.error(`Échec suppression : ${result.error}`);
                      else toast.success(`${c.brand} ${c.model} supprimée définitivement`);
                    } : undefined}
                    onDuplicate={isSales ? async () => {
                      const res = await duplicateCharger(c.id);
                      if (res.error) toast.error(`Échec duplication : ${res.error}`);
                      else toast.success(`${c.brand} ${c.model} dupliquée — modifiez la copie pour personnaliser`);
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
              <div className="flex items-center gap-2">
                {visibleCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                    onClick={() => {
                      setSelectedV({});
                      setSelectedC({});
                      toast.success("Sélections vidées");
                    }}
                    title="Vider tous les véhicules et bornes sélectionnés"
                  >
                    <Trash2 className="w-3 h-3" /> Vider
                  </Button>
                )}
                <SaveIndicator watch={[selectedV, selectedC, client]} />
              </div>
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
                          onChange={(p) => setSelectedV((s) => ({ ...s, [sv.vehicle.id]: { ...(s[sv.vehicle.id] ?? sv), ...p } }))}
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
                        <SelectedChargerRow key={sc.instanceId} sc={sc}
                          onChange={(p) => setSelectedC((s) => {
                            const cur = s[sc.instanceId] ?? sc;
                            const merged = { ...cur, ...p };
                            // Fusion PROFONDE de siteSpecs sur l'état courant : le
                            // SiteSpecsEditor reconstruit siteSpecs depuis son snapshot,
                            // donc on ré-applique par-dessus l'état à jour pour ne
                            // perdre aucun champ (ex. includeConsuel) édité entre-temps.
                            if (p.siteSpecs) merged.siteSpecs = { ...cur.siteSpecs, ...p.siteSpecs };
                            return { ...s, [sc.instanceId]: merged };
                          })}
                          onRemove={() => setSelectedC((s) => { const next = { ...s }; delete next[sc.instanceId]; return next; })}
                          onDuplicate={() => duplicateChargerInstance(sc)} />
                      ))}
                    </>
                  )}

                  <Separator />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setPresenting(true)} className="gap-2">
                      <Presentation className="w-4 h-4" /> Présenter
                    </Button>
                    <Button onClick={() => exportPdf(false)} className="gap-2">
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

type ProjectTab = ProjectType | "tco";

function ProjectTypeSelector({ value, onChange }: { value: ProjectTab; onChange: (t: ProjectTab) => void }) {
  const opts: { id: ProjectTab; icon: React.ReactNode; title: string; desc: string }[] = [
    { id: "vehicles", icon: <Car className="w-6 h-6" />, title: "Projet Véhicules", desc: "Flotte LLD, prestations véhicule." },
    { id: "home", icon: <Home className="w-6 h-6" />, title: "Bornes domicile", desc: "Kit B2B2E par collaborateur." },
    { id: "site", icon: <Building2 className="w-6 h-6" />, title: "Bornes site entreprise", desc: "Déploiement IRVE site par site." },
    { id: "tco", icon: <Gauge className="w-6 h-6" />, title: "Analyse TCO", desc: "Comparatif coût total de possession." },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`text-left rounded-xl border p-5 transition-all duration-300 ${active ? "border-primary bg-muted ring-1 ring-primary/20" : "border-border/50 bg-card hover:border-border hover:bg-card"}`}
          >
            <div className={`w-10 h-10 rounded-lg grid place-content-center mb-4 ${active ? "bg-white text-black" : "bg-muted text-foreground/70"}`}>{o.icon}</div>
            <p className="font-semibold text-sm leading-tight text-foreground">{o.title}</p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{o.desc}</p>
          </button>
        );
      })}
    </div>
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
  const hasAnyField = Object.values(client).some((v) => typeof v === "string" && v.trim() !== "");
  const reset = () => setClient({ company: "", contact: "", email: "", salesRep: "", salesRepEmail: "", salesRepPhone: "", date: "", notes: "" });
  const { coordinates: myCoordinates, save: saveCoordinates } = useMyCoordinates();

  // Enregistre nom + téléphone du commercial sur son compte (l'email reste
  // l'identifiant de connexion). Les prochains devis seront pré-remplis.
  const handleSaveCoordinates = async () => {
    try {
      await saveCoordinates.mutateAsync({ name: client.salesRep ?? "", phone: client.salesRepPhone ?? "" });
      toast.success("Coordonnées enregistrées sur votre compte");
    } catch (e: any) {
      toast.error(`Échec de l'enregistrement : ${e?.message ?? "erreur inconnue"}`);
    }
  };

  // Recharge les coordonnées du compte dans les champs du devis.
  const loadMyCoordinates = () => {
    if (!myCoordinates) return;
    setClient({ ...client, salesRep: myCoordinates.name, salesRepEmail: myCoordinates.email, salesRepPhone: myCoordinates.phone });
    toast.success("Vos coordonnées ont été insérées");
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base text-foreground">Informations client & commercial</CardTitle>
        {hasAnyField && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-[#e82127] hover:text-[#e82127] hover:bg-[#e82127]/10 gap-1"
            onClick={() => { reset(); toast.success("Informations client réinitialisées"); }}
            title="Vider tous les champs client et commercial"
          >
            <Trash2 className="w-3 h-3" /> Réinitialiser
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Société *"><Input value={client.company} onChange={(e) => setClient({ ...client, company: e.target.value })} placeholder="Ex. BIG France" /></Field>
        <Field label="Contact client"><Input value={client.contact} onChange={(e) => setClient({ ...client, contact: e.target.value })} placeholder="Nom Prénom" /></Field>
        <Field label="Email client"><Input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /></Field>
        <Field label="Date"><Input value={client.date} onChange={(e) => setClient({ ...client, date: e.target.value })} /></Field>
        <Field label="Commercial Beev"><Input value={client.salesRep} onChange={(e) => setClient({ ...client, salesRep: e.target.value })} placeholder="Alaé Mahmoudi" /></Field>
        <Field label="Email commercial"><Input value={client.salesRepEmail} onChange={(e) => setClient({ ...client, salesRepEmail: e.target.value })} placeholder="alae@beev.co" /></Field>
        <Field label="Téléphone commercial"><Input value={client.salesRepPhone} onChange={(e) => setClient({ ...client, salesRepPhone: e.target.value })} placeholder="+33 6 ..." /></Field>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-2 -mt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleSaveCoordinates}
            disabled={saveCoordinates.isPending}
            title="Enregistre votre nom et téléphone sur votre compte pour pré-remplir vos prochains devis"
          >
            {saveCoordinates.isPending ? "Enregistrement…" : "Enregistrer mes coordonnées"}
          </Button>
          {myCoordinates && (myCoordinates.name || myCoordinates.phone) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={loadMyCoordinates}
              title="Réinsère les coordonnées enregistrées sur votre compte"
            >
              Insérer mes coordonnées
            </Button>
          )}
        </div>
        <Field label="Notes & conditions" className="sm:col-span-2">
          <Textarea rows={3} value={client.notes} onChange={(e) => setClient({ ...client, notes: e.target.value })} placeholder="Laisser vide pour appliquer les conditions standard du type de projet." />
        </Field>
      </CardContent>
    </Card>
  );
}

// ============ CATALOGUE VÉHICULES PAR MARQUE ============
// Remplace la grille plate de 76+ véhicules par un layout 2 niveaux :
// 1) Grille de cartes "marque" (BMW · 7 modèles · 2 stock dispo)
// 2) Click sur une carte → expansion inline de la marque avec les fiches
//    véhicules.
// Si l'utilisateur tape une recherche, les marques avec résultats sont
// automatiquement dépliées pour rendre les véhicules trouvables.
function VehicleCatalogByBrand({
  vehicles, allVehicleCount, selectedV, onToggle, onUpdate, onDelete, onDuplicate, existingCategories, leaserOffers, hasActiveSearch, compareIds, onToggleCompare, canEditPricing,
}: {
  vehicles: Vehicle[];
  allVehicleCount: number;
  selectedV: Record<string, SelectedVehicle>;
  onToggle: (v: Vehicle) => void;
  onUpdate?: (id: string, patch: Partial<Vehicle>) => void | Promise<void>;
  onDelete?: (v: Vehicle) => void | Promise<void>;
  onDuplicate?: (v: Vehicle) => void | Promise<void>;
  existingCategories: string[];
  leaserOffers: LeaserOffer[];
  hasActiveSearch: boolean;
  compareIds?: Set<string>;
  onToggleCompare?: (id: string) => void;
  canEditPricing?: boolean;
}) {
  // Groupement par marque (trie alphabétique sauf BMW/Audi/Mercedes/Tesla en tête)
  const byBrand = useMemo(() => {
    const map = new Map<string, Vehicle[]>();
    for (const v of vehicles) {
      const brand = v.brand || "Autre";
      if (!map.has(brand)) map.set(brand, []);
      map.get(brand)!.push(v);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [vehicles]);

  // Marques dépliées : par défaut aucune, sauf si recherche active → toutes.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Compteur de sélection par marque pour afficher un badge si le commercial a déjà coché dans cette marque
  const selectedCountByBrand = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const sv of Object.values(selectedV)) {
      const b = sv.vehicle.brand;
      counts[b] = (counts[b] ?? 0) + 1;
    }
    return counts;
  }, [selectedV]);

  if (vehicles.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        {byBrand.length} marque{byBrand.length > 1 ? "s" : ""} · {vehicles.length} modèle{vehicles.length > 1 ? "s" : ""}
        {vehicles.length !== allVehicleCount ? ` sur ${allVehicleCount}` : ""}. Cliquez sur une marque pour voir ses véhicules.
      </p>
      {/* Accordion vertical : 1 ligne par marque, expansion inline juste en dessous */}
      <div className="space-y-2">
        {byBrand.map(([brand, list]) => {
          const isOpen = expanded.has(brand) || hasActiveSearch;
          const stockCount = list.filter((v) => v.availableStock).length;
          const selCount = selectedCountByBrand[brand] ?? 0;
          const minPrice = Math.min(...list.map((v) => v.priceTtc).filter((p) => p > 0)) || 0;
          return (
            <div key={brand} className={`rounded-lg border ${isOpen ? "border-primary/40 bg-primary/5" : "bg-card"} ${selCount > 0 ? "ring-1 ring-[#35DA76]/40" : ""} transition-all`}>
              <button
                type="button"
                onClick={() => {
                  setExpanded((s) => {
                    const next = new Set(s);
                    if (next.has(brand)) next.delete(brand); else next.add(brand);
                    return next;
                  });
                }}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-accent/30 rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className={`text-base transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                  <p className="font-semibold text-base">{brand}</p>
                  <span className="text-xs text-muted-foreground">
                    {list.length} modèle{list.length > 1 ? "s" : ""}
                  </span>
                  {stockCount > 0 && (
                    <span className="text-[10px] inline-flex items-center gap-1 rounded-full bg-[#35DA76]/10 text-[#35DA76] px-2 py-0.5 font-medium">
                      {stockCount} en stock
                    </span>
                  )}
                  {selCount > 0 && (
                    <span className="text-[10px] font-semibold uppercase rounded-full bg-[#35DA76] text-white px-2 py-0.5">
                      {selCount} sélectionné{selCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  À partir de <strong className="text-foreground">{fmtEur(minPrice)}</strong>
                </span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {list.map((v) => (
                      <VehicleCard
                        key={v.id}
                        vehicle={v}
                        selected={!!selectedV[v.id]}
                        onToggle={() => onToggle(v)}
                        onUpdate={onUpdate ? (p) => onUpdate(v.id, p) : undefined}
                        onDelete={onDelete ? () => onDelete(v) : undefined}
                        onDuplicate={onDuplicate ? () => onDuplicate(v) : undefined}
                        existingCategories={existingCategories}
                        leaserOffers={leaserOffers.filter((o) => o.vehicleId === v.id)}
                        canEditPricing={canEditPricing}
                        isInCompare={compareIds?.has(v.id)}
                        onToggleCompare={onToggleCompare ? () => onToggleCompare(v.id) : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ VIEWER PDF TRIPARTITE (lecture seule) ============
// Bouton 'Voir conditions tripartite' affiché sur chaque VehicleCard si l'ops a
// uploadé un PDF dans /admin/vehicles. Ouvre un Dialog plein écran avec iframe
// PDF en mode 'toolbar=0' pour masquer la barre d'outils du navigateur (qui
// inclut le bouton téléchargement). N'empêche pas un utilisateur déterminé de
// récupérer le PDF (clic-droit / inspect) mais décourage l'usage standard.
function TripartiteViewerButton({ url, vehicleLabel }: { url: string; vehicleLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="mt-1 text-[10px] text-[#3809EA] underline underline-offset-2 hover:opacity-80 self-start"
      >
        Voir conditions tripartite
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Conditions tripartite — {vehicleLabel}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 rounded-md border overflow-hidden bg-muted">
            <iframe
              src={`${url}#toolbar=0&navpanes=0&scrollbar=1`}
              className="w-full h-full"
              title="Conditions tripartite"
              // CSP-like restrictions via sandbox : autorise script (PDF.js) et same-origin lecture, bloque downloads/popups
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Document en lecture seule. Pour obtenir une copie, contactez votre ops Beev.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============ TOP SHORTLIST DU MOIS ============
// Section visible sur l'accueil mode 'projet véhicules' juste au-dessus du
// catalogue. Affiche les véhicules marqués 'shortlist' dans /admin/vehicles
// comme cartes horizontales avec badge "Top du mois". Permet à l'ops de
// recommander activement 5 véhicules à mettre en avant pour le mois.
function TopShortlistSection({
  vehicles: shortlistVehicles, selectedV, onToggle, leaserOffers,
}: {
  vehicles: Vehicle[];
  selectedV: Record<string, SelectedVehicle>;
  onToggle: (v: Vehicle) => void;
  leaserOffers: LeaserOffer[];
}) {
  if (shortlistVehicles.length === 0) return null;
  return (
    <Card className="border-[#FFB800]/40 bg-gradient-to-br from-[#FFB800]/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFB800] text-[#1D1D1D] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M12 2 14.39 8.26 21 9.27l-4.78 4.66L17.34 21 12 17.77 6.66 21l1.12-7.07L3 9.27l6.61-1.01L12 2z" /></svg>
              Top du mois
            </span>
            <CardTitle className="text-base">Recommandations Beev — {shortlistVehicles.length} véhicule{shortlistVehicles.length > 1 ? "s" : ""} mis en avant</CardTitle>
          </div>
          <p className="text-[11px] text-muted-foreground">Sélection ops Beev · à proposer en priorité ce mois-ci</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(shortlistVehicles.length, 5)}, minmax(0, 1fr))` }}>
          {shortlistVehicles.map((v) => {
            const selected = !!selectedV[v.id];
            const offers = leaserOffers.filter((o) => o.vehicleId === v.id).sort((a, b) => a.monthlyPriceTtc - b.monthlyPriceTtc);
            const best = offers[0];
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onToggle(v)}
                className={`text-left rounded-lg border bg-white p-3 transition-all hover:shadow-md ${selected ? "ring-2 ring-primary border-primary" : ""}`}
              >
                {/* Zone image toujours rendue : si v.image absent OU 404,
                    on bascule sur un placeholder (svg) plutôt que rien. */}
                <div className="aspect-video bg-white rounded mb-2 overflow-hidden border border-border/40 flex items-center justify-center">
                  {v.image ? (
                    <img
                      src={v.image}
                      alt={`${v.brand} ${v.model}`}
                      className="w-full h-full object-contain p-1"
                      loading="lazy"
                      onError={(e) => {
                        // En cas de 404 / erreur réseau, remplace par le placeholder
                        const img = e.currentTarget;
                        if (img.src.endsWith("/images/placeholder.svg")) return;
                        img.src = "/images/placeholder.svg";
                      }}
                    />
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">Photo à venir</span>
                  )}
                </div>
                <p className="text-xs font-semibold truncate">{v.brand} {v.model}</p>
                <p className="text-[10px] text-muted-foreground truncate">{v.version || v.category}</p>
                {best ? (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{best.loueur} · {best.durationMonths}m</p>
                    <p className="text-sm font-bold text-[#3809EA]">{fmtEur(best.monthlyPriceTtc)} <span className="text-[10px] text-muted-foreground font-normal">/mois</span></p>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-2">{fmtEur(v.priceTtc)} TTC</p>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ CALCULATEUR TCO ============
// 4e onglet du sélecteur projet : permet au commercial de présenter une
// analyse comparative TCO sur plusieurs véhicules du catalogue sans construire
// une offre commerciale complète. Réutilise computeTco de pdf.ts pour avoir
// la même base de calcul partout dans l'app.
function TcoCalculator({
  vehicles, selectedV, onToggle, energy, setEnergy, resetEnergy,
}: {
  vehicles: Vehicle[];
  selectedV: Record<string, SelectedVehicle>;
  onToggle: (v: Vehicle) => void;
  energy: EnergyParams;
  setEnergy: (e: EnergyParams) => void;
  resetEnergy: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return vehicles;
    return vehicles.filter((v) => `${v.brand} ${v.model} ${v.version} ${v.category}`.toLowerCase().includes(q));
  }, [vehicles, search]);

  // Calcul TCO complet (porté de beev-tco-2026 — fiscalCalculations.ts) :
  // inclut TVS, malus CO2, malus poids, AND, AEN.
  // En mode TCO, on utilise les paramètres ÉNERGIE GLOBAUX (carte du haut)
  // pour TOUS les véhicules : durée et km/an de la carte plutôt que les
  // valeurs capturées à la sélection. Ainsi modifier les paramètres énergie
  // recalcule instantanément toutes les fiches sans avoir à re-cocher.
  // Le loyer reste celui négocié dans le panneau droit (sv.negotiatedMonthly).
  const tcoRows = useMemo(() => {
    const contractParams: TcoContractParams = {
      dureeAnnees: energy.durationYears,
      kmContrat: energy.kmPerYear * energy.durationYears,
      prixEssenceLitre: energy.fuelPriceL,
      prixKwhDomicile: energy.kWhHome,
      prixKwhPublic: energy.kWhPublic,
    };
    return Object.values(selectedV).map((sv) => {
      // sv.options sont saisies en TTC dans le panneau droit (la convention
      // d'affichage utilisateur — le nom du champ "unitHt" est historique).
      const optionsTotalTtc = sv.options.reduce((s, o) => s + o.qty * o.unitHt, 0);
      const r = calculateTcoFull(sv.vehicle, { ...contractParams, optionsTotalTtc, remisePctOverride: sv.discountPct }, sv.negotiatedMonthly);
      const tco100 = r.tcoParKm * 100;
      const lease100 = (r.loyerTotal / contractParams.kmContrat) * 100;
      const energy100 = (r.coutEnergie / contractParams.kmContrat) * 100;
      return { sv, tco100, lease100, energy100, monthlyTco: r.tcoMensuel, totalContract: r.tcoTotal, full: r };
    });
  }, [selectedV, energy]);

  // Identifie le véhicule au TCO le plus bas pour le mettre en valeur
  const cheapestId = useMemo(() => {
    if (tcoRows.length === 0) return null;
    return tcoRows.reduce((min, r) => r.tco100 < min.tco100 ? r : min, tcoRows[0]).sv.vehicle.id;
  }, [tcoRows]);

  return (
    <div className="space-y-6">
      {/* Paramètres énergie */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Paramètres TCO et énergie</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={resetEnergy} className="gap-2"><RotateCcw className="w-3 h-3" /> Reset</Button>
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

      {/* Sélection des véhicules à analyser */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Véhicules à analyser ({Object.keys(selectedV).length} sélectionné{Object.keys(selectedV).length > 1 ? "s" : ""})</CardTitle>
          <p className="text-xs text-muted-foreground">Cochez les véhicules à comparer côté TCO. Le tableau ci-dessous se met à jour en temps réel.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Rechercher un véhicule..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8" />
          <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-1">
            {filtered.map((v) => {
              const isSelected = !!selectedV[v.id];
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onToggle(v)}
                  className={`flex items-center gap-3 rounded-md border p-2 text-left transition-colors ${isSelected ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-accent/40"}`}
                >
                  <Checkbox checked={isSelected} className="pointer-events-none" />
                  {v.image && <img src={v.image} alt="" className="w-12 h-9 object-contain bg-muted rounded" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.brand} {v.model}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{v.version} · {v.energy}</p>
                  </div>
                  <div className="text-right text-xs flex-shrink-0">
                    <p className="font-semibold">{fmtEur(selectedV[v.id]?.negotiatedMonthly ?? v.monthlyLld)}</p>
                    <p className="text-[10px] text-muted-foreground">/mois TTC{selectedV[v.id] && selectedV[v.id].negotiatedMonthly !== v.monthlyLld ? " (négocié)" : ""}</p>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Aucun véhicule ne correspond à la recherche.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Tableau comparatif TCO */}
      {tcoRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparaison TCO temps réel</CardTitle>
            <p className="text-xs text-muted-foreground">Calcul basé sur les paramètres énergie ci-dessus. Le véhicule au TCO le plus bas est mis en avant en vert.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground uppercase text-[10px]">
                    <th className="py-2 px-2">Véhicule</th>
                    <th className="py-2 px-2 text-right">Loyer / 100 km</th>
                    <th className="py-2 px-2 text-right">Énergie / 100 km</th>
                    <th className="py-2 px-2 text-right">TCO / 100 km</th>
                    <th className="py-2 px-2 text-right">TCO mensuel</th>
                    <th className="py-2 px-2 text-right">TCO total contrat</th>
                  </tr>
                </thead>
                <tbody>
                  {tcoRows.sort((a, b) => a.tco100 - b.tco100).map((r) => {
                    const isCheapest = r.sv.vehicle.id === cheapestId;
                    return (
                      <tr key={r.sv.vehicle.id} className={`border-b ${isCheapest ? "bg-[#35DA76]/10" : ""}`}>
                        <td className="py-2 px-2">
                          <p className="font-medium">{r.sv.vehicle.brand} {r.sv.vehicle.model}</p>
                          <p className="text-[10px] text-muted-foreground">{r.sv.vehicle.version}</p>
                        </td>
                        <td className="py-2 px-2 text-right">{r.lease100.toFixed(2)} €</td>
                        <td className="py-2 px-2 text-right">{r.energy100.toFixed(2)} €</td>
                        <td className={`py-2 px-2 text-right font-semibold ${isCheapest ? "text-[#35DA76]" : ""}`}>{r.tco100.toFixed(2)} €</td>
                        <td className="py-2 px-2 text-right">{fmtEur(r.monthlyTco)}</td>
                        <td className="py-2 px-2 text-right font-semibold">{fmtEur(r.totalContract)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {cheapestId && (
              <div className="mt-3 rounded-md bg-[#35DA76]/10 border border-[#35DA76]/30 p-3 text-xs">
                <strong className="text-[#35DA76]">Recommandation Beev :</strong>
                {" "}
                {tcoRows.find((r) => r.sv.vehicle.id === cheapestId)?.sv.vehicle.brand}{" "}
                {tcoRows.find((r) => r.sv.vehicle.id === cheapestId)?.sv.vehicle.model}
                {" "}offre le meilleur coût total de possession sur cette sélection, soit{" "}
                <strong>{tcoRows.find((r) => r.sv.vehicle.id === cheapestId)?.tco100.toFixed(2)} € / 100 km</strong>.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Graphiques TCO : bar chart empilé annuel + pie chart répartition.
          Identique aux visuels de beev-tco-2026 pour cohérence d'expérience. */}
      {tcoRows.length > 0 && <TcoCharts rows={tcoRows} />}

      {/* Détail fiscal complet : TVS, malus, AEN, AND par véhicule */}
      {tcoRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détail fiscal et social</CardTitle>
            <p className="text-xs text-muted-foreground">
              TVS (taxe CO₂ + pollution), malus CO₂ et poids appliqués à l'achat (intégrés au TCO),
              AND annualisé (Avantage Non Déductible IS), AEN (Avantage en Nature) avec part
              salariale (25%) et part employeur (42%).
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground uppercase text-[10px]">
                    <th className="py-2 px-2">Véhicule</th>
                    <th className="py-2 px-2 text-right">TVS / an</th>
                    <th className="py-2 px-2 text-right">Malus CO₂</th>
                    <th className="py-2 px-2 text-right">Malus poids</th>
                    <th className="py-2 px-2 text-right">AND / an</th>
                    <th className="py-2 px-2 text-right">AEN / mois</th>
                    <th className="py-2 px-2 text-right">Part salariale</th>
                    <th className="py-2 px-2 text-right">Part employeur</th>
                  </tr>
                </thead>
                <tbody>
                  {tcoRows.map((r) => (
                    <tr key={r.sv.vehicle.id} className="border-b">
                      <td className="py-2 px-2">
                        <p className="font-medium">{r.sv.vehicle.brand} {r.sv.vehicle.model}</p>
                        <p className="text-[10px] text-muted-foreground">{r.sv.vehicle.version}</p>
                      </td>
                      <td className="py-2 px-2 text-right">{fmtEur(r.full.taxeCO2 + r.full.taxePollution)}</td>
                      <td className="py-2 px-2 text-right">{fmtEur(r.full.malusCO2)}</td>
                      <td className="py-2 px-2 text-right">{fmtEur(r.full.malusPoids)}</td>
                      <td className="py-2 px-2 text-right">{fmtEur(r.full.andAnnuel)}</td>
                      <td className="py-2 px-2 text-right">{fmtEur(r.full.aenMensuel)}</td>
                      <td className="py-2 px-2 text-right">{fmtEur(r.full.partSalarialeMensuelle)} <span className="text-muted-foreground">/mois</span></td>
                      <td className="py-2 px-2 text-right">{fmtEur(r.full.partEmployeurMensuelle)} <span className="text-muted-foreground">/mois</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Données fiscales 2026. Pour activer les calculs : renseignez prix batterie, poids à
              vide, éco-score et remise sur chaque fiche véhicule dans l'admin.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ GRAPHIQUES TCO ============
// Bar chart empilé annuel (loyer + énergie + TVS + malus) avec total au-dessus
// de chaque barre, et pie chart de répartition pour le premier véhicule.
// Inspiré directement de beev-tco-2026/src/components/TCOCharts.tsx pour
// cohérence de présentation client.
const TCO_CHART_COLORS = {
  loyer: "#3809EA",   // bleu Beev (LAVENDER)
  energie: "#35DA76", // vert Beev (ACCENT)
  tvs: "#F5A623",     // orange
  malus: "#E54B4B",   // rouge
};

const PIE_COLORS = ["#3809EA", "#35DA76", "#F5A623", "#E54B4B", "#A78BFA"];

function fmt0(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function TcoCharts({ rows }: { rows: Array<{ sv: SelectedVehicle; full: ReturnType<typeof calculateTcoFull> }> }) {
  // Données pour le bar chart : valeurs annuelles
  const barData = useMemo(() => {
    return rows.map((r) => {
      const annees = r.sv.durationMonths / 12;
      return {
        name: `${r.sv.vehicle.brand} ${r.sv.vehicle.model}`,
        loyer: r.full.loyerTotal / annees,
        energie: r.full.coutEnergie / annees,
        tvs: r.full.tvsTotal / annees,
        malus: (r.full.malusCO2 + r.full.malusPoids) / annees,
        tcoAnnuel: r.full.tcoAnnuel,
      };
    });
  }, [rows]);

  // Données pour le pie chart : répartition TCO du premier véhicule
  const pieData = useMemo(() => {
    if (rows.length === 0) return [];
    const r = rows[0].full;
    return [
      { name: "Loyer", value: r.loyerTotal },
      { name: "Énergie", value: r.coutEnergie },
      { name: "TVS", value: r.tvsTotal },
      { name: "Malus CO₂", value: r.malusCO2 },
      { name: "Malus poids", value: r.malusPoids },
    ].filter((d) => d.value > 0);
  }, [rows]);

  // Label personnalisé sur le sommet de chaque barre empilée pour le total annuel
  const TotalLabel = (props: any) => {
    const { x, y, width, index } = props;
    if (index === undefined || !barData[index]) return null;
    const total = barData[index].tcoAnnuel;
    return (
      <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#111111" fontSize={11} fontWeight={600}>
        {fmt0(total)} €
      </text>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Graphiques comparaison TCO</CardTitle>
        <p className="text-xs text-muted-foreground">
          Décomposition annuelle du coût total de possession (gauche) et répartition détaillée pour
          le premier véhicule sélectionné (droite). Cliquez sur les légendes pour masquer une
          composante.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Bar chart empilé */}
          <div className="space-y-2">
            <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide">
              TCO annuel par véhicule
            </h4>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 25, right: 10, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#5F5F64" }} angle={-30} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 11, fill: "#5F5F64" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`${fmt0(value)} €`, name]}
                    contentStyle={{ backgroundColor: "#FFFFFF", border: "1px solid #DCDAD4", borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="loyer" name="Loyer" stackId="a" fill={TCO_CHART_COLORS.loyer} />
                  <Bar dataKey="energie" name="Énergie" stackId="a" fill={TCO_CHART_COLORS.energie} />
                  <Bar dataKey="tvs" name="TVS" stackId="a" fill={TCO_CHART_COLORS.tvs} />
                  <Bar dataKey="malus" name="Malus" stackId="a" fill={TCO_CHART_COLORS.malus} radius={[4, 4, 0, 0]}>
                    <LabelList content={<TotalLabel />} position="top" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie chart répartition */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide">
                Répartition TCO — {rows[0].sv.vehicle.brand} {rows[0].sv.vehicle.model}
              </h4>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={50}
                      dataKey="value"
                      label={({ name, percent, value }) => `${name} ${fmt0(value as number)} € (${((percent as number) * 100).toFixed(0)}%)`}
                      labelLine={true}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${fmt0(value)} €`, ""]}
                      contentStyle={{ backgroundColor: "#FFFFFF", border: "1px solid #DCDAD4", borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
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

function VehicleCard({ vehicle, selected, onToggle, onUpdate, onDelete, existingCategories = [], leaserOffers = [], isInCompare, onToggleCompare, onDuplicate, canEditPricing }: { vehicle: Vehicle; selected: boolean; onToggle: () => void; onUpdate?: (p: Partial<Vehicle>) => void; onDelete?: () => void; existingCategories?: string[]; leaserOffers?: LeaserOffer[]; isInCompare?: boolean; onToggleCompare?: () => void; onDuplicate?: () => void; canEditPricing?: boolean }) {
  const [editing, setEditing] = useState(false);
  // Loyer « À partir de » : la plus basse offre loueur disponible ; à défaut, le
  // loyer catalogue saisi par l'ops/admin (monthlyLld).
  const startingMonthly = leaserOffers.length > 0
    ? Math.min(...leaserOffers.map((o) => o.monthlyPriceTtc))
    : vehicle.monthlyLld;
  // Badge énergie — couleurs charte Beev 2026 (Rose / Bleu / Violet / Beige)
  const energyBadgeCls = vehicle.energy === "Électrique"
    ? "bg-beev-rose-30 text-beev-black border-beev-rose"
    : vehicle.energy === "Hybride Rechargeable"
    ? "bg-beev-bleu-30 text-beev-black border-beev-bleu"
    : vehicle.energy === "Hybride" || vehicle.energy === "Mild Hybrid"
    ? "bg-beev-violet-30 text-beev-black border-beev-violet"
    : "bg-muted text-foreground border-border";
  // Indique si une image valide est fournie (sinon on cache l'<img> pour ne
  // pas afficher l'icône cassée ou le texte alt par-dessus le gradient).
  const hasImage = Boolean(vehicle.image && vehicle.image.trim() !== "");
  return (
    <Card className={`overflow-hidden transition-all duration-300 ${selected ? "ring-2 ring-primary border-primary" : "hover:border-foreground/40 hover:shadow-lg"}`}>
      <div className="aspect-[4/3] bg-beev-violet-20 overflow-hidden relative group">
        {hasImage ? (
          <img src={vehicle.image} alt={`${vehicle.brand} ${vehicle.model}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-beev-black/40 text-sm italic">
            Image à venir
          </div>
        )}
        {/* Overlay badges en haut */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          <Badge className={`text-[10px] font-semibold border ${energyBadgeCls}`}>{vehicle.energy}</Badge>
          {vehicle.shortlist && <Badge className="bg-beev-rose text-beev-black text-[10px] border-0 font-semibold">★ Recommandé</Badge>}
          {vehicle.custom && <Badge className="bg-beev-beige text-beev-black text-[10px] border-0">Custom</Badge>}
          {vehicle.availableStock !== undefined && vehicle.availableStock > 0 && (
            <Badge className="bg-beev-bleu text-beev-black text-[10px] border-0 font-semibold">Stock × {vehicle.availableStock}</Badge>
          )}
        </div>
        {/* Coin haut droite : check sélection OU barre actions admin compacte.
            Les actions admin (corbeille / dupliquer / éditer) sont placées sur
            l'image avec fond semi-transparent pour libérer le bloc prix qui
            était écrasé sur 3 lignes. */}
        {selected ? (
          <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-content-center text-sm font-bold shadow-lg">
            ✓
          </div>
        ) : (
          (onDelete || onDuplicate || onUpdate) && (
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-sm shadow-md px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {canEditPricing && (
                <a
                  href={`/admin/vehicles?edit=${vehicle.id}`}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md text-beev-bleu hover:bg-muted"
                  title="Éditer le pricing de ce véhicule (backoffice)"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Receipt className="w-3.5 h-3.5" />
                </a>
              )}
              {onUpdate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-muted"
                  onClick={() => setEditing((e) => !e)}
                  title={editing ? "Fermer l'édition" : "Éditer ce véhicule"}
                >
                  {editing ? <X className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
                </Button>
              )}
              {onDuplicate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-muted"
                  onClick={onDuplicate}
                  title="Dupliquer ce véhicule"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              )}
              {onDelete && <ConfirmDeleteButton label={`${vehicle.brand} ${vehicle.model}`} onConfirm={onDelete} />}
            </div>
          )
        )}
        {/* Bandeau loyer mensuel en bas de l'image (overlay) */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-beev-black via-beev-black/80 to-transparent p-3 pt-8">
          <p className="text-[10px] text-beev-beige/70 uppercase tracking-wide">À partir de</p>
          <p className="text-xl font-bold text-beev-beige leading-tight">{fmtEur(startingMonthly)}<span className="text-xs text-beev-beige/60 font-normal ml-1">/mois TTC</span></p>
        </div>
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="min-w-0">
          <h3 className="font-bold leading-tight text-foreground text-base truncate">{vehicle.brand} {vehicle.model}</h3>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{vehicle.version}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px] text-foreground/70">
          <Spec icon={<Gauge className="w-3 h-3" />} v={vehicle.rangeWltp ? `${vehicle.rangeWltp} km` : `${vehicle.co2} g/km`} />
          <Spec icon={<Battery className="w-3 h-3" />} v={vehicle.batteryKwh ? `${vehicle.batteryKwh} kWh` : "—"} />
          <Spec icon={<Zap className="w-3 h-3" />} v={`${vehicle.powerHp} ch`} />
        </div>
        {/* Prix catalogue : ligne pleine, label horizontal pour ne plus être
            écrasé sur 3 lignes par les boutons d'actions. */}
        <div className="flex items-baseline justify-between pt-3 border-t border-border/50">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Prix catalogue TTC</span>
          <span className="font-semibold text-foreground text-base">{fmtEur(vehicle.priceTtc)}</span>
        </div>
        {/* CTA principal — pleine largeur, charte Beev */}
        <Button
          type="button"
          onClick={onToggle}
          variant={selected ? "outline" : "default"}
          className="w-full gap-2"
          size="sm"
        >
          {selected ? (<><X className="w-4 h-4" /> Retirer de la sélection</>) : (<><Plus className="w-4 h-4" /> Ajouter à la sélection</>)}
        </Button>
        {/* Toggle comparateur — design discret en lien texte avec icône */}
        {onToggleCompare && (
          <button
            type="button"
            onClick={onToggleCompare}
            className={`w-full flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-md transition-colors ${
              isInCompare
                ? "bg-beev-bleu-30 text-beev-black font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            {isInCompare ? "Dans le comparateur" : "Ajouter au comparateur"}
          </button>
        )}
        {/* Badges loueurs : 1 par offre disponible (durée / km / mensuel) */}
        {leaserOffers.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2 border-t border-border/50">
            {leaserOffers.map((o) => (
              <span
                key={o.id}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${o.kind === "captive" ? "bg-beev-rose-30 text-beev-black" : "bg-beev-bleu-30 text-beev-black"}`}
                title={`${o.kind === "captive" ? "Captive" : "Loueur"} ${o.loueur} · ${o.durationMonths} mois / ${o.kmTotal.toLocaleString("fr-FR")} km`}
              >
                <strong>{o.loueur}</strong>
                <span className="opacity-70">{o.durationMonths}m/{(o.kmTotal / 1000).toFixed(0)}k</span>
                <strong>{fmtEur(o.monthlyPriceTtc)}/m</strong>
              </span>
            ))}
          </div>
        )}
        {/* Bouton 'Voir conditions' si un PDF tripartite est uploadé */}
        {vehicle.tripartitePdfUrl && (
          <TripartiteViewerButton url={vehicle.tripartitePdfUrl} vehicleLabel={`${vehicle.brand} ${vehicle.model}`} />
        )}
        {editing && onUpdate && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="grid grid-cols-2 gap-2">
              <TxtField label="Marque" value={vehicle.brand} onChange={(s) => onUpdate({ brand: s })} />
              <TxtField label="Modèle" value={vehicle.model} onChange={(s) => onUpdate({ model: s })} />
              <NumField label="Prix TTC" value={vehicle.priceTtc} onChange={(n) => onUpdate({ priceTtc: n })} />
              <NumField label="Autonomie km" value={vehicle.rangeWltp} onChange={(n) => onUpdate({ rangeWltp: n })} />
              <NumField label="Batterie kWh" value={vehicle.batteryKwh} onChange={(n) => onUpdate({ batteryKwh: n })} />
              <NumField label="Puissance ch" value={vehicle.powerHp} onChange={(n) => onUpdate({ powerHp: n })} />
              <NumField label="Conso" value={vehicle.consumption} onChange={(n) => onUpdate({ consumption: n })} step={0.1} />
              <NumField label="CO₂ g/km" value={vehicle.co2} onChange={(n) => onUpdate({ co2: n })} />
              <NumField label="CV fiscaux" value={vehicle.fiscalHp} onChange={(n) => onUpdate({ fiscalHp: n })} />
              <NumField label="Score env. (0-100)" value={vehicle.envScore ?? 0} onChange={(n) => onUpdate({ envScore: n })} />
              <NumField label="Prix batterie HT" value={vehicle.prixBatterie ?? 0} onChange={(n) => onUpdate({ prixBatterie: n })} />
              <NumField label="Poids vide (kg)" value={vehicle.poidsVide ?? 0} onChange={(n) => onUpdate({ poidsVide: n })} />
              <NumField label="Remise %" value={vehicle.remise ?? 0} onChange={(n) => onUpdate({ remise: n })} step={0.5} />
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase">Éco-score (AEN -70%)</Label>
                <select
                  value={vehicle.ecoScoreBool ? "yes" : "no"}
                  onChange={(e) => onUpdate({ ecoScoreBool: e.target.value === "yes" })}
                  className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs text-foreground"
                >
                  <option value="no">Non</option>
                  <option value="yes">Oui</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase">Énergie</Label>
                <select
                  value={vehicle.energy}
                  onChange={(e) => onUpdate({ energy: e.target.value as Vehicle["energy"] })}
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
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TxtField label="Version" value={vehicle.version} onChange={(s) => onUpdate({ version: s })} />
              <CategoryField
                value={vehicle.category}
                onChange={(s) => onUpdate({ category: s })}
                existingCategories={existingCategories}
              />
            </div>
            {/* Specs étendues — affichées sur fiche produit PDF + comparateur */}
            <div className="grid grid-cols-3 gap-2">
              <NumField label="Coffre (L)" value={vehicle.trunkLitres ?? 0} onChange={(n) => onUpdate({ trunkLitres: n })} />
              <NumField label="Recharge DC max (kW)" value={vehicle.chargeDcMaxKw ?? 0} onChange={(n) => onUpdate({ chargeDcMaxKw: n })} step={0.1} />
              <NumField label="Recharge AC max (kW)" value={vehicle.chargeAcMaxKw ?? 0} onChange={(n) => onUpdate({ chargeAcMaxKw: n })} step={0.1} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <TxtField label="Dimensions (L × l × H)" value={vehicle.dimensions ?? ""} onChange={(s) => onUpdate({ dimensions: s })} />
              <TxtField label="Recharge 20-80% AC" value={vehicle.chargeTime2080Ac ?? ""} onChange={(s) => onUpdate({ chargeTime2080Ac: s })} />
              <TxtField label="Recharge 20-80% DC" value={vehicle.chargeTime2080Dc ?? ""} onChange={(s) => onUpdate({ chargeTime2080Dc: s })} />
            </div>
            <ImageUpload
              currentUrl={vehicle.image}
              onChange={(url) => onUpdate({ image: url })}
              folder="vehicles"
              label="Photo principale (catalogue + PDF)"
            />
            {/* Galerie additionnelle pour l'encart "Véhicule du moment" et le
                comparateur. Max 4 photos (au-delà, ignorées). */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">
                Galerie additionnelle ({(vehicle.gallery ?? []).length} / 4)
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Photos affichées dans l'encart "Véhicule du moment" et le comparateur.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(vehicle.gallery ?? []).map((url, i) => (
                  <div key={i} className="relative aspect-[4/3] rounded-md overflow-hidden bg-muted">
                    <img src={url} alt={`Galerie ${i + 1}`} className="w-full h-full object-contain p-1" />
                    <button
                      type="button"
                      onClick={() => onUpdate({ gallery: (vehicle.gallery ?? []).filter((_, idx) => idx !== i) })}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-white grid place-content-center text-xs"
                      title="Supprimer cette photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {(vehicle.gallery ?? []).length < 4 && (
                <ImageUpload
                  currentUrl=""
                  onChange={(url) => {
                    if (!url) return;
                    onUpdate({ gallery: [...(vehicle.gallery ?? []), url].slice(0, 4) });
                  }}
                  folder="vehicles-gallery"
                  label="Ajouter une photo"
                />
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted">
              <input
                type="checkbox"
                checked={vehicle.featured ?? false}
                onChange={(e) => onUpdate({ featured: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-xs">Mettre en avant dans "Véhicule du moment" sur la home</span>
            </label>
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

function ChargerCard({ charger, selected, onToggle, onUpdate, onDelete, onDuplicate }: { charger: Charger; selected: boolean; onToggle: () => void; onUpdate?: (p: Partial<Charger>) => void; onDelete?: () => void; onDuplicate?: () => void }) {
  const [editing, setEditing] = useState(false);
  const isHome = charger.deployment === "domicile";
  const hasImage = Boolean(charger.image && charger.image.trim() !== "");
  return (
    <Card className={`overflow-hidden transition-all duration-300 ${selected ? "ring-2 ring-primary border-primary" : "hover:border-foreground/40 hover:shadow-lg"}`}>
      <div className="aspect-[4/3] bg-beev-violet-20 overflow-hidden relative group">
        {hasImage ? (
          <img src={charger.image} alt={`${charger.brand} ${charger.model}`} className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-beev-black/40 text-sm italic">
            Image à venir
          </div>
        )}
        {/* Overlay badges — couleurs charte (Rose / Bleu / Violet) */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          <Badge className={`text-[10px] font-semibold border ${charger.powerKw >= 22 ? "bg-beev-rose-30 text-beev-black border-beev-rose" : "bg-beev-bleu-30 text-beev-black border-beev-bleu"}`}>
            {charger.powerKw} kW {charger.powerKw >= 22 ? "triphasé" : "monophasé"}
          </Badge>
          <Badge className={`text-[10px] border ${isHome ? "bg-beev-violet-30 text-beev-black border-beev-violet" : "bg-beev-rose-30 text-beev-black border-beev-rose"}`}>
            {isHome ? "Domicile B2B2E" : "Site entreprise"}
          </Badge>
          {charger.custom && <Badge className="bg-beev-beige text-beev-black text-[10px]">Custom</Badge>}
        </div>
        {/* Coin haut droite : check sélection OU barre actions admin (hover). */}
        {selected ? (
          <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-content-center text-sm font-bold shadow-lg">
            ✓
          </div>
        ) : (
          (onDelete || onDuplicate || onUpdate) && (
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-sm shadow-md px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {onUpdate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-muted"
                  onClick={() => setEditing((e) => !e)}
                  title={editing ? "Fermer l'édition" : "Éditer cette borne"}
                >
                  {editing ? <X className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
                </Button>
              )}
              {onDuplicate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-muted"
                  onClick={onDuplicate}
                  title="Dupliquer cette borne"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              )}
              {onDelete && <ConfirmDeleteButton label={`${charger.brand} ${charger.model}`} onConfirm={onDelete} />}
            </div>
          )
        )}
        {/* Bandeau prix en bas de l'image (overlay) */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-beev-black via-beev-black/80 to-transparent p-3 pt-8">
          <p className="text-[10px] text-beev-beige/70 uppercase tracking-wide">{isHome ? "Forfait clé en main HT" : "Borne HT"}</p>
          <p className="text-xl font-bold text-beev-beige leading-tight">{fmtEur(charger.priceHt)}
            {charger.installPriceHt > 0 && <span className="text-xs text-beev-beige/60 font-normal ml-2">+ pose ~{fmtEur(charger.installPriceHt)}</span>}
          </p>
        </div>
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="min-w-0">
          <h3 className="font-bold leading-tight text-foreground text-base truncate">{charger.brand} {charger.model}</h3>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{charger.type}</p>
        </div>
        <ul className="text-xs text-foreground/70 space-y-1">
          {charger.features.slice(0, 4).map((f, i) => (
            <li key={i} className="flex gap-1.5 items-start">
              <span className="text-primary mt-0.5">✓</span>
              <span className="leading-tight">{f}</span>
            </li>
          ))}
        </ul>
        {/* CTA explicite Ajouter / Retirer — charte Beev */}
        <Button
          type="button"
          onClick={onToggle}
          variant={selected ? "outline" : "default"}
          className="w-full gap-2"
          size="sm"
        >
          {selected ? (<><X className="w-4 h-4" /> Retirer de la sélection</>) : (<><Plus className="w-4 h-4" /> Ajouter à la sélection</>)}
        </Button>
        {editing && onUpdate && (
          <div className="space-y-2 pt-2 border-t border-border/50">
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
                  className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs text-foreground"
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
              label="Photo de la borne (vignette catalogue)"
            />
            <ImageUpload
              currentUrl={charger.marketingImageUrl ?? ""}
              onChange={(url) => onUpdate({ marketingImageUrl: url || undefined })}
              folder="chargers-marketing"
              label="Image marketing HD (page Fiche produit du PDF site)"
            />
            <LongTxtField
              label="Caractéristiques (une par ligne)"
              value={charger.features.join("\n")}
              onChange={(s) => onUpdate({ features: s.split("\n").map((x) => x.trim()).filter(Boolean) })}
              placeholder={"OCPP 1.6\nMID + RFID\n..."}
              minHeight="80px"
            />
            {/* Garantie spécifique au modèle, affichée sur la fiche produit
                du PDF site entreprise (ligne "Qualité et Garantie"). Permet
                d'avoir une garantie distincte par marque/modèle plutôt qu'un
                texte global pdf_texts. */}
            <LongTxtField
              label="Garantie (fiche produit PDF)"
              value={charger.warranty ?? ""}
              onChange={(s) => onUpdate({ warranty: s })}
              placeholder="IP54 · IK10 · Garantie constructeur 3 ans (extensible 6 ans)"
              minHeight="60px"
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

// Badge d'alerte fiscale : affiche les charges à l'achat (malus CO₂ + malus
// poids) et la TVS annuelle si > 0. Permet au commercial de vérifier la
// cohérence du calcul avant présentation client.
function FiscalWarningBadge({ vehicle, durationMonths }: { vehicle: Vehicle; durationMonths: number }) {
  const malusCo2 = calculateMalusCO2(vehicle.co2 ?? 0);
  const malusPoids = calculateMalusPoids(vehicle.poidsVide ?? 0, vehicle.energy);
  const malusTotal = malusCo2 + malusPoids;
  // TVS = taxe CO₂ + taxe pollution × durée
  const co2 = vehicle.co2 ?? 0;
  let taxeCO2 = 0;
  if (co2 > 4) {
    const brackets: Array<[number, number, number]> = [[5,45,1],[46,53,2],[54,85,3],[86,105,4],[106,125,10],[126,145,50],[146,165,60],[166,9999,65]];
    for (const [min, max, rate] of brackets) {
      if (co2 >= min) taxeCO2 += (Math.min(co2, max) - min + 1) * rate;
    }
  }
  const taxePollution = vehicle.energy === "Électrique" ? 0 : vehicle.energy === "Diesel" ? 650 : 130;
  const tvsAnnuelle = taxeCO2 + taxePollution;
  const tvsTotale = tvsAnnuelle * (durationMonths / 12);

  if (malusTotal === 0 && tvsAnnuelle === 0) return null;

  return (
    <div className="rounded-md border border-beev-rose bg-beev-rose-20 p-2 text-[11px] space-y-1">
      <div className="flex items-center gap-1 font-semibold text-beev-black">
        <AlertTriangle className="w-3 h-3" /> Charges fiscales à vérifier
      </div>
      {malusTotal > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Malus à l'achat (CO₂ + poids)</span>
          <span className="font-semibold">{malusTotal.toLocaleString("fr-FR")} €</span>
        </div>
      )}
      {tvsAnnuelle > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">TVS / an (× {Math.round(durationMonths / 12)} ans = {tvsTotale.toLocaleString("fr-FR")} €)</span>
          <span className="font-semibold">{tvsAnnuelle.toLocaleString("fr-FR")} €</span>
        </div>
      )}
    </div>
  );
}

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

      {/* Encart « Flotte actuelle » : visible si le véhicule est marqué
          isCurrentFleet (via import car policy OU toggle direct ici).
          Permet au commercial de voir d'un coup d'œil le statut du véhicule
          dans le devis. */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md border border-beev-rose/30 bg-beev-rose-20/40 hover:bg-beev-rose-20/60">
          <input
            type="checkbox"
            checked={sv.vehicle.isCurrentFleet ?? false}
            onChange={(e) => onChange({ vehicle: { ...sv.vehicle, isCurrentFleet: e.target.checked } })}
            className="h-4 w-4 accent-beev-rose"
          />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-beev-rose">
            {sv.vehicle.isCurrentFleet ? "Flotte actuelle (à comparer)" : "Marquer comme flotte actuelle"}
          </span>
        </label>
        {/* Groupe de comparaison libre — assigne ce véhicule à un groupe
            spécifique pour le PDF. Tous les véhicules du même groupe sont
            comparés ensemble dans une slide dédiée du PDF (1 slide par
            groupe). Si vide, comparateur global. */}
        <TxtField
          label="Groupe de comparaison (optionnel)"
          value={sv.comparisonGroup ?? ""}
          onChange={(s) => onChange({ comparisonGroup: s })}
          placeholder="ex. Remplacement 3008, Berlines..."
        />
      </div>

      {/* Mise en concurrence MULTI-OFFRES : le commercial peut saisir N
          offres concurrentes (différents loueurs ayant fait une proposition
          sur le MÊME véhicule). Chaque offre est listée séparément, les
          écarts calculés en direct. */}
      <div className="rounded-md border border-beev-rose/30 p-2 space-y-2 bg-beev-rose-20/40">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-beev-rose">
            Mise en concurrence ({(sv.competitorOffers ?? []).length})
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = [...(sv.competitorOffers ?? []), { loueur: "", monthlyTtc: 0, durationMonths: sv.durationMonths, kmPerYear: sv.kmPerYear }];
              onChange({ competitorOffers: next });
            }}
            className="h-6 text-[10px] gap-1 text-beev-rose hover:text-beev-black hover:bg-beev-rose/20"
          >
            <Plus className="w-3 h-3" /> Ajouter une offre
          </Button>
        </div>
        {(sv.competitorOffers ?? []).map((offer, idx) => {
          const savings = offer.monthlyTtc - sv.negotiatedMonthly;
          return (
            <div key={idx} className="rounded bg-white border border-beev-rose/20 p-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-beev-rose">Offre {idx + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange({ competitorOffers: (sv.competitorOffers ?? []).filter((_, i) => i !== idx) })}
                  className="h-5 w-5 text-muted-foreground hover:text-destructive"
                  title="Retirer cette offre"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TxtField label="Loueur" value={offer.loueur} onChange={(s) => {
                  const next = (sv.competitorOffers ?? []).map((c, i) => i === idx ? { ...c, loueur: s } : c);
                  onChange({ competitorOffers: next });
                }} placeholder="Arval, Ayvens..." />
                <NumField label="Loyer TTC/mois" value={offer.monthlyTtc} onChange={(n) => {
                  const next = (sv.competitorOffers ?? []).map((c, i) => i === idx ? { ...c, monthlyTtc: n } : c);
                  onChange({ competitorOffers: next });
                }} />
                <NumField label="Durée (mois)" value={offer.durationMonths} onChange={(n) => {
                  const next = (sv.competitorOffers ?? []).map((c, i) => i === idx ? { ...c, durationMonths: n } : c);
                  onChange({ competitorOffers: next });
                }} />
                <NumField label="Km / an" value={offer.kmPerYear} onChange={(n) => {
                  const next = (sv.competitorOffers ?? []).map((c, i) => i === idx ? { ...c, kmPerYear: n } : c);
                  onChange({ competitorOffers: next });
                }} />
              </div>
              {offer.monthlyTtc > 0 && sv.negotiatedMonthly > 0 && (
                <div className="text-[10px] pt-1 border-t border-beev-rose/10">
                  {savings > 0 ? (
                    <>Économie Beev : <span className="font-semibold text-beev-good">{fmtEur(savings)}/mois</span> · <span className="font-semibold text-beev-good">{fmtEur(savings * sv.durationMonths)}</span> sur le contrat</>
                  ) : (
                    <span className="text-muted-foreground">Beev est {fmtEur(Math.abs(savings))}/mois plus cher</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {(sv.competitorOffers ?? []).length === 0 && (
          <p className="text-[10px] text-muted-foreground italic px-1">
            Aucune offre concurrente. Cliquez sur « Ajouter une offre » pour saisir un loyer concurrent et déclencher la slide « Mise en concurrence » dans le PDF.
          </p>
        )}
      </div>

      {/* Alerte fiscale : Malus à l'achat + TVS annuelle. Visible si > 0 pour
          que le commercial vérifie le calcul avant de présenter au client. */}
      <FiscalWarningBadge vehicle={sv.vehicle} durationMonths={sv.durationMonths} />

      {/* Configurations alternatives : couples durée/km/loyer supplémentaires */}
      <div className="rounded-md bg-card p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase text-muted-foreground">
            Configurations alternatives ({(sv.additionalConfigs ?? []).length})
          </Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => {
              const newConfig: PricingConfig = {
                id: `cfg-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String((sv.additionalConfigs ?? []).length + 1)}`,
                durationMonths: sv.durationMonths,
                kmPerYear: sv.kmPerYear,
                negotiatedMonthly: sv.negotiatedMonthly,
              };
              onChange({ additionalConfigs: [...(sv.additionalConfigs ?? []), newConfig] });
            }}
          >
            <Plus className="w-3 h-3" /> Ajouter
          </Button>
        </div>
        {(sv.additionalConfigs ?? []).map((cfg, idx) => (
          <div key={cfg.id} className="grid grid-cols-[1fr_1fr_1fr_28px] gap-1 items-end">
            <NumField
              label={idx === 0 ? "Durée (mois)" : ""}
              value={cfg.durationMonths}
              onChange={(n) => {
                const next = (sv.additionalConfigs ?? []).map((c) => c.id === cfg.id ? { ...c, durationMonths: n } : c);
                onChange({ additionalConfigs: next });
              }}
            />
            <NumField
              label={idx === 0 ? "Km / an" : ""}
              value={cfg.kmPerYear}
              onChange={(n) => {
                const next = (sv.additionalConfigs ?? []).map((c) => c.id === cfg.id ? { ...c, kmPerYear: n } : c);
                onChange({ additionalConfigs: next });
              }}
            />
            <NumField
              label={idx === 0 ? "Loyer TTC" : ""}
              value={cfg.negotiatedMonthly}
              onChange={(n) => {
                const next = (sv.additionalConfigs ?? []).map((c) => c.id === cfg.id ? { ...c, negotiatedMonthly: n } : c);
                onChange({ additionalConfigs: next });
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => {
                onChange({ additionalConfigs: (sv.additionalConfigs ?? []).filter((c) => c.id !== cfg.id) });
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
        {(sv.additionalConfigs ?? []).length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">
            Le client veut comparer plusieurs scénarios ? Ajoutez une configuration alternative (ex : 48m/30k + 60m/60k).
          </p>
        )}
      </div>
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
          <div className="grid grid-cols-[1fr_50px_70px_24px] gap-1 items-center text-[9px] uppercase text-muted-foreground">
            <span>Désignation</span>
            <span className="text-center">Qté</span>
            <span className="text-right">PU TTC</span>
            <span></span>
          </div>
          {sv.options.map((o, i) => (
            <div key={i} className="grid grid-cols-[1fr_50px_70px_24px] gap-1 items-center">
              <Input value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} className="h-7 text-xs" placeholder="Ex. Peinture métallisée" />
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

function SelectedChargerRow({ sc, onChange, onRemove, onDuplicate }: { sc: SelectedCharger; onChange: (p: Partial<SelectedCharger>) => void; onRemove: () => void; onDuplicate?: () => void }) {
  const [openLi, setOpenLi] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const setLi = (i: number, p: Partial<LineItem>) => onChange({ lineItems: sc.lineItems.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const addLi = () => onChange({ lineItems: [...sc.lineItems, { label: "Nouvelle ligne", qty: 1, unitHt: 0, marginPct: 0 }] });
  const delLi = (i: number) => onChange({ lineItems: sc.lineItems.filter((_, idx) => idx !== i) });
  const handleQuoteImport = (items: LineItem[], mode: "append" | "replace") => {
    const next = mode === "replace" ? items : [...sc.lineItems, ...items];
    onChange({ lineItems: next });
    setOpenLi(true);
  };

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
        <div className="flex items-center gap-0.5 shrink-0">
          {onDuplicate && (
            <Button variant="ghost" size="icon" className="h-6 w-6" title={isHome ? "Dupliquer pour un autre collaborateur" : "Dupliquer pour un autre site"} onClick={onDuplicate}><Copy className="w-3 h-3" /></Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}><Trash2 className="w-3 h-3" /></Button>
        </div>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2 h-8 text-xs border-[#3809EA]/40 text-[#3809EA] hover:bg-[#3809EA]/10"
            disabled={!sc.technicianQuoteUrl}
            onClick={() => setImportDialogOpen(true)}
          >
            <Sparkles className="w-3 h-3" />
            {sc.technicianQuoteUrl ? "Détecter et importer les lignes du devis" : "Téléversez d'abord un PDF"}
          </Button>
        </div>
      )}

      <TechnicianQuoteImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        pdfUrl={sc.technicianQuoteUrl}
        onConfirm={handleQuoteImport}
      />

      {/* Encart site entreprise : personnalisation du rapport PDF (specs site,
          supervision). Tous les champs sont optionnels — utilisés dans le
          rapport visite technique généré uniquement quand renseignés. */}
      {!isHome && (
        <SiteSpecsEditor sc={sc} onChange={onChange} />
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

// ============ ÉDITEUR DES SPECS SITE (rapport visite technique) ============
// Composant inline dans SelectedChargerRow (mode site uniquement) : permet
// au commercial de personnaliser les champs du rapport PDF site entreprise
// (récap projet, synthèse chantier, infrastructure, supervision).
function SiteSpecsEditor({ sc, onChange }: { sc: SelectedCharger; onChange: (p: Partial<SelectedCharger>) => void }) {
  const [open, setOpen] = useState(false);
  const specs: SiteSpecs = sc.siteSpecs ?? {};
  const setSpec = (patch: Partial<SiteSpecs>) => {
    onChange({ siteSpecs: { ...specs, ...patch } });
  };

  const filledCount = [
    specs.sector, specs.installationType, specs.usage, specs.estimatedDelay,
    specs.edfPower, specs.distanceTgbt, specs.locationDescription, specs.tgbtRoom,
    specs.worksList?.length, specs.supervisionPlan,
  ].filter((v) => v !== undefined && v !== null && v !== "" && v !== 0 && v !== "none").length;

  return (
    <div className="rounded-md border border-dashed border-[#F4B8AA] bg-[#FDF1EE] p-2 space-y-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold uppercase text-[#3809EA]">
          Rapport visite technique · {filledCount}/10 champs renseignés
        </span>
        <span className="text-muted-foreground">{open ? "Replier ▴" : "Personnaliser ▾"}</span>
      </button>

      {open && (
        <div className="space-y-2 pt-2 border-t border-[#F4B8AA]/40">
          <p className="text-[10px] text-muted-foreground italic">
            Tous les champs sont optionnels. Renseignez ceux que vous avez et le PDF s'adapte automatiquement.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <TxtField label="Secteur" value={specs.sector ?? ""} onChange={(v) => setSpec({ sector: v })} />
            <TxtField label="Type d'installation" value={specs.installationType ?? ""} onChange={(v) => setSpec({ installationType: v })} />
            <TxtField label="Usage" value={specs.usage ?? ""} onChange={(v) => setSpec({ usage: v })} />
            <TxtField label="Délai estimé" value={specs.estimatedDelay ?? ""} onChange={(v) => setSpec({ estimatedDelay: v })} />
            <TxtField label="Puissance EDF" value={specs.edfPower ?? ""} onChange={(v) => setSpec({ edfPower: v })} />
            <TxtField label="Distance TGBT" value={specs.distanceTgbt ?? ""} onChange={(v) => setSpec({ distanceTgbt: v })} />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">Emplacement (description)</Label>
            <Input
              value={specs.locationDescription ?? ""}
              onChange={(e) => setSpec({ locationDescription: e.target.value })}
              placeholder="Ex : Parking extérieur, cour gravillons devant le bâtiment principal"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">Local TGBT et cheminement</Label>
            <Input
              value={specs.tgbtRoom ?? ""}
              onChange={(e) => setSpec({ tgbtRoom: e.target.value })}
              placeholder="Ex : Local technique RDC, cheminement façade nord puis tranchée parking"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">
              Travaux à réaliser (1 par ligne, max 20)
            </Label>
            <Textarea
              value={(specs.worksList ?? []).join("\n")}
              onChange={(e) => {
                // Split + filtre standard
                const raw = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
                // Fusion des fragments orphelins : si une ligne précédente finit
                // par une préposition de liaison (de, du, à, en, le, la, les,
                // d', l', un, une, sur, sous, dans, vers, par, pour, avec, et,
                // ou) et la ligne suivante est courte (< 40 chars), on fusionne
                // car c'est probablement un retour à la ligne accidentel.
                const stopWords = /\b(de|du|à|en|le|la|les|d'|l'|un|une|sur|sous|dans|vers|par|pour|avec|et|ou|à la|au)$/i;
                const merged: string[] = [];
                for (const line of raw) {
                  const prev = merged[merged.length - 1];
                  if (prev && stopWords.test(prev) && line.length < 40) {
                    merged[merged.length - 1] = `${prev} ${line}`;
                  } else {
                    merged.push(line);
                  }
                }
                setSpec({ worksList: merged.slice(0, 20) });
              }}
              placeholder="Mise à niveau câble principal 150mm² → 240mm² alu (40m)&#10;NSX400F + INS320&#10;Fouilles 65m sur terre végétale et graviers&#10;..."
              className="min-h-[100px] text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Répartis automatiquement sur 2 colonnes dans le PDF "Infrastructure électrique".
              Si vide, une liste générique sera utilisée.
            </p>
          </div>

          {/* Type câble 22 kW : preset ou personnalisable */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">Type câble 22 kW (triphasé)</Label>
            <div className="flex gap-1.5">
              {["U1000 R2V 5G10 mm²", "U1000 R2V 5G16 mm²"].map((preset) => (
                <Button
                  key={preset}
                  size="sm"
                  variant={specs.cable22Type === preset ? "default" : "outline"}
                  onClick={() => setSpec({ cable22Type: preset })}
                  className="h-7 text-[10px] flex-1"
                >
                  {preset}
                </Button>
              ))}
            </div>
            <Input
              value={specs.cable22Type && !["U1000 R2V 5G10 mm²", "U1000 R2V 5G16 mm²"].includes(specs.cable22Type) ? specs.cable22Type : ""}
              onChange={(e) => setSpec({ cable22Type: e.target.value })}
              placeholder="Ou personnalisé..."
              className="h-7 text-xs"
            />
          </div>

          {/* Type câble 7,4 kW : preset ou personnalisable */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">Type câble 7,4 kW (monophasé)</Label>
            <Input
              value={specs.cable74Type ?? ""}
              onChange={(e) => setSpec({ cable74Type: e.target.value })}
              placeholder="Ex : U1000 R2V 3G10 mm²"
              className="h-7 text-xs"
            />
          </div>

          {/* Points de charge par borne */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">Points de charge par borne</Label>
            <div className="flex gap-1.5">
              {[1, 2].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={(specs.pointsParBorne ?? 1) === n ? "default" : "outline"}
                  onClick={() => setSpec({ pointsParBorne: n as 1 | 2 })}
                  className="h-7 text-xs flex-1"
                >
                  {n} point{n > 1 ? "s" : ""} de charge
                </Button>
              ))}
            </div>
          </div>

          {/* Inclure la maintenance annuelle dans le PDF */}
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted">
            <input
              type="checkbox"
              checked={specs.includeMaintenance ?? false}
              onChange={(e) => setSpec({ includeMaintenance: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-xs">Inclure la maintenance annuelle dans le PDF</span>
          </label>

          {/* Inclure le bureau de contrôle (obligatoire > 36 kVA, désactivé
              par défaut : à activer manuellement par le commercial). Impacte
              le récap financier, le MONTANT TOTAL PROJET et la page conformité. */}
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted">
            <input
              type="checkbox"
              checked={specs.includeBureauControle ?? false}
              onChange={(e) => setSpec({ includeBureauControle: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-xs">Inclure le bureau de contrôle (700 € HT, obligatoire {">"} 36 kVA)</span>
          </label>

          {/* Inclure le Consuel sur la page conformité — affichage simple
              (pas de coût ajouté au chiffrage car généralement géré par
              l'électricien). Si décoché, le bloc Consuel disparaît du PDF. */}
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted">
            <input
              type="checkbox"
              checked={specs.includeConsuel ?? false}
              onChange={(e) => setSpec({ includeConsuel: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-xs">Inclure le Consuel sur la page conformité</span>
          </label>

          {/* Taux de TVA applicable (5,5 % réduit ou 20 % standard) */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">Taux de TVA</Label>
            <div className="flex gap-1.5">
              {[20, 5.5].map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={(specs.tvaRate ?? 20) === r ? "default" : "outline"}
                  onClick={() => setSpec({ tvaRate: r as 5.5 | 20 })}
                  className="h-7 text-xs flex-1"
                >
                  {r === 20 ? "20 % (standard)" : "5,5 % (réduit)"}
                </Button>
              ))}
            </div>
          </div>

          {/* Photos du chantier (multi-upload) */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">
              Photos du chantier ({(specs.chantierPhotos ?? []).length} / 6)
            </Label>
            <p className="text-[10px] text-muted-foreground">
              Affichées sous la liste "Travaux à réaliser" dans le PDF. Max 6 photos. JPG/PNG.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(specs.chantierPhotos ?? []).map((url, i) => (
                <div key={i} className="relative aspect-[4/3] rounded-md overflow-hidden bg-muted">
                  <img src={url} alt={`Photo chantier ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      const next = (specs.chantierPhotos ?? []).filter((_, idx) => idx !== i);
                      setSpec({ chantierPhotos: next });
                    }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
              {(specs.chantierPhotos ?? []).length < 6 && (
                <ImageUpload
                  currentUrl=""
                  onChange={(url) => {
                    if (!url) return;
                    const next = [...(specs.chantierPhotos ?? []), url];
                    setSpec({ chantierPhotos: next.slice(0, 6) });
                  }}
                  folder="chantier-photos"
                  label=""
                />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">Supervision (page dédiée du PDF)</Label>
            <select
              value={specs.supervisionPlan ?? "none"}
              onChange={(e) => setSpec({ supervisionPlan: e.target.value as SiteSpecs["supervisionPlan"] })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="none">— Pas de bloc supervision —</option>
              <option value="beev_connect">Beev Connect (site entreprise)</option>
              <option value="beev_home_charging">Beev Home Charging (B2B2E domicile)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ PRESENTATION MODE ============

type Slide =
  | { kind: "cover" }
  | { kind: "vehicle"; sv: SelectedVehicle }
  | { kind: "charger"; sc: SelectedCharger }
  | { kind: "tco" }
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
      // Slide TCO comparative dès qu'au moins 2 véhicules sont sélectionnés.
      // (Plus de filtrage sur includeTco — la slide affiche le calcul même
      // si le toggle "Inclure TCO" du panneau droit n'a pas été activé.)
      if (vehicles.length >= 2) s.push({ kind: "tco" });
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
        {slide.kind === "tco" && <TcoSlide vehicles={vehicles} energy={energy} />}
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

// Slide TCO en mode présentation : comparaison décomposée par véhicule
// + KPIs (meilleur TCO, pire TCO, écart). Affiché uniquement si au moins
// 2 véhicules ont includeTco=true.
function TcoSlide({ vehicles, energy }: { vehicles: SelectedVehicle[]; energy: EnergyParams }) {
  // On utilise TOUS les véhicules sélectionnés (pas seulement includeTco)
  // car la slide TCO de présentation est une comparaison globale qui aide
  // le client à choisir, sans dépendre du toggle individuel.
  const rows = vehicles.map((sv) => {
    const duree = sv.durationMonths / 12;
    const optionsTotalTtc = sv.options.reduce((s, o) => s + o.qty * o.unitHt, 0);
    const r = calculateTcoFull(sv.vehicle, {
      dureeAnnees: duree,
      kmContrat: sv.kmPerYear * duree,
      prixEssenceLitre: energy.fuelPriceL,
      prixKwhDomicile: energy.kWhHome,
      prixKwhPublic: energy.kWhPublic,
      optionsTotalTtc,
      remisePctOverride: sv.discountPct,
    }, sv.negotiatedMonthly);
    return { sv, r, tco100: r.tcoParKm * 100 };
  }).sort((a, b) => a.tco100 - b.tco100);

  if (rows.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <p className="text-muted-foreground">Aucun véhicule avec TCO activé.</p>
      </div>
    );
  }

  const best = rows[0];
  const worst = rows[rows.length - 1];
  const ecartTotal = worst.r.tcoTotal - best.r.tcoTotal;
  const ecartPct = worst.r.tcoTotal > 0 ? (ecartTotal / worst.r.tcoTotal) * 100 : 0;
  const maxTotal = worst.r.tcoTotal || 1;

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Analyse TCO · Comparaison</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
          Quel véhicule offre le meilleur coût total ?
        </h1>
        <p className="text-base text-muted-foreground">
          Comparaison du coût total de possession entre les véhicules de la sélection. Inclut loyer LLD, énergie, TVS, malus à l'achat, AND et AEN.
        </p>
      </div>

      {/* 4 KPIs */}
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-beev-rose-20 p-5 border border-beev-rose">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide font-semibold">Meilleur TCO</p>
          <p className="text-2xl font-bold mt-2">{best.tco100.toFixed(2)} €<span className="text-sm font-normal text-muted-foreground">/100 km</span></p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{best.sv.vehicle.brand} {best.sv.vehicle.model}</p>
        </div>
        <div className="rounded-2xl bg-beev-violet-20 p-5 border border-beev-violet">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide font-semibold">TCO le plus élevé</p>
          <p className="text-2xl font-bold mt-2">{worst.tco100.toFixed(2)} €<span className="text-sm font-normal text-muted-foreground">/100 km</span></p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{worst.sv.vehicle.brand} {worst.sv.vehicle.model}</p>
        </div>
        <div className="rounded-2xl bg-beev-bleu-20 p-5 border border-beev-bleu">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide font-semibold">Écart sur contrat</p>
          <p className="text-2xl font-bold mt-2">{fmtEur(ecartTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">économie potentielle</p>
        </div>
        <div className="rounded-2xl bg-primary text-primary-foreground p-5">
          <p className="text-[10px] uppercase opacity-80 tracking-wide font-semibold">Gain</p>
          <p className="text-2xl font-bold mt-2">{ecartPct.toFixed(1)} %</p>
          <p className="text-xs opacity-70 mt-1">pire − meilleur ÷ pire</p>
        </div>
      </div>

      {/* Barres comparatives */}
      <div className="space-y-3">
        {rows.map((row, idx) => {
          const widthPct = (row.r.tcoTotal / maxTotal) * 100;
          const isBest = idx === 0;
          return (
            <div key={row.sv.vehicle.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full grid place-content-center text-xs font-bold ${isBest ? "bg-beev-rose text-beev-black" : "bg-muted text-foreground"}`}>{idx + 1}</span>
                  <span className="font-semibold">{row.sv.vehicle.brand} {row.sv.vehicle.model}</span>
                  <span className="text-xs text-muted-foreground">{row.tco100.toFixed(2)} €/100 km</span>
                </div>
                <span className={`font-bold ${isBest ? "text-beev-black" : "text-foreground"}`}>{fmtEur(row.r.tcoTotal)}</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${isBest ? "bg-beev-rose" : "bg-foreground/40"}`} style={{ width: `${widthPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground border-t pt-4">
        Estimation Beev 2026 : loyer × durée + énergie sur km contrat + TVS annualisée + malus à l'achat + AND amorti 5 ans + AEN employeur. Valeurs indicatives à confirmer auprès du loueur retenu.
      </p>
    </div>
  );
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
