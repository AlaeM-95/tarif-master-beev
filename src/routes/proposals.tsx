import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, FileText, Car, Home as HomeIcon, Building2, Calendar, Trash2, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { useProposals, PROPOSAL_STATUS_LABEL, PROPOSAL_STATUS_COLOR, type ProposalStatus } from "@/lib/proposals";
import { ShareProposalDialog } from "@/components/share-proposal-dialog";

export const Route = createFileRoute("/proposals")({
  component: ProposalsPage,
});

const fmtEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const STATUS_FILTERS: Array<{ key: ProposalStatus | "all"; label: string }> = [
  { key: "all", label: "Toutes" },
  { key: "draft", label: "Brouillons" },
  { key: "sent", label: "Envoyées" },
  { key: "signed", label: "Signées" },
  { key: "refused", label: "Refusées" },
  { key: "expired", label: "Expirées" },
];

function ProposalsPage() {
  const { isSales, isOps, loading, user } = useAuth();
  const navigate = useNavigate();
  const { proposals, isLoading, remove, duplicate } = useProposals();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "all">("all");
  // Onglet de visibilité : mine (créées par moi) / shared (partagées avec moi)
  // / all (visibles via RLS — ops voit tout, sales voit son périmètre)
  const [scopeFilter, setScopeFilter] = useState<"mine" | "shared" | "all">("mine");

  useEffect(() => {
    if (!loading && !isSales) navigate({ to: "/login" });
  }, [loading, isSales, navigate]);

  const uid = user?.id ?? "";
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return proposals.filter((p) => {
      // Scope
      if (scopeFilter === "mine" && p.createdBy !== uid) return false;
      if (scopeFilter === "shared" && (p.createdBy === uid || (!p.sharedWith.includes(uid) && p.assignedTo !== uid))) return false;
      // Status
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      // Texte
      if (q && !p.clientCompany.toLowerCase().includes(q) && !p.clientContact.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [proposals, search, statusFilter, scopeFilter, uid]);

  // Compteurs pour les chips
  const counts = useMemo(() => ({
    mine: proposals.filter((p) => p.createdBy === uid).length,
    shared: proposals.filter((p) => p.createdBy !== uid && (p.sharedWith.includes(uid) || p.assignedTo === uid)).length,
    all: proposals.length,
  }), [proposals, uid]);

  if (loading || isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Chargement...</div>;
  }
  if (!isSales) return null;

  return (
    <div className="min-h-screen bg-[#FCF9F2]">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Retour</Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Propositions ({proposals.length})</h1>
              <p className="text-xs text-muted-foreground">Toutes les offres commerciales sauvegardées.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 space-y-4">
        {/* Onglets de visibilité */}
        <div className="flex flex-wrap items-center gap-1">
          <Button variant={scopeFilter === "mine" ? "default" : "outline"} size="sm" onClick={() => setScopeFilter("mine")}>
            Mes propositions ({counts.mine})
          </Button>
          <Button variant={scopeFilter === "shared" ? "default" : "outline"} size="sm" onClick={() => setScopeFilter("shared")}>
            Partagées avec moi ({counts.shared})
          </Button>
          {isOps && (
            <Button variant={scopeFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setScopeFilter("all")}>
              Toutes ({counts.all})
            </Button>
          )}
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par client ou contact..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.key}
                variant={statusFilter === f.key ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Liste */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium">Aucune proposition trouvée</p>
                <p className="text-xs text-muted-foreground">
                  {search || statusFilter !== "all"
                    ? "Essayez de modifier les filtres."
                    : "Créez une proposition depuis l'accueil et cliquez sur \"Sauvegarder\"."}
                </p>
              </div>
              <Button asChild>
                <Link to="/">Nouvelle proposition</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((p) => {
              const ProjectIcon = p.projectType === "vehicles" ? Car : p.projectType === "home" ? HomeIcon : Building2;
              return (
                <Card key={p.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <Link to="/proposals/$id" params={{ id: p.id }} className="flex-1 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[#FCF9F2] flex items-center justify-center">
                        <ProjectIcon className="w-5 h-5 text-[#5F5F64]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">{p.clientCompany || "Sans nom"}</h3>
                          <Badge className={PROPOSAL_STATUS_COLOR[p.status]}>{PROPOSAL_STATUS_LABEL[p.status]}</Badge>
                          {p.followUpDate && (
                            <Badge variant="outline" className="gap-1">
                              <Calendar className="w-3 h-3" /> Relance {new Date(p.followUpDate).toLocaleDateString("fr-FR")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.salesRepName ? `${p.salesRepName} · ` : ""}
                          {p.vehicleCount > 0 && `${p.vehicleCount} véhicule(s) · `}
                          {p.chargerCount > 0 && `${p.chargerCount} borne(s) · `}
                          {new Date(p.createdAt).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{fmtEur(p.totalAmount)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {p.projectType === "vehicles" ? "loyers an." : "HT total"}
                        </p>
                      </div>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#3809EA]"
                      title="Partager cette proposition"
                      onClick={() => setShareId(p.id)}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#3809EA]"
                      disabled={duplicatingId === p.id}
                      title="Dupliquer cette proposition"
                      onClick={async () => {
                        setDuplicatingId(p.id);
                        const res = await duplicate(p.id);
                        setDuplicatingId(null);
                        if (res.error) {
                          toast.error(`Échec duplication : ${res.error}`);
                          return;
                        }
                        if (res.id) {
                          toast.success("Proposition dupliquée");
                          navigate({ to: "/", search: { proposal: res.id } });
                        }
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette proposition ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            La proposition pour <strong>{p.clientCompany}</strong> sera supprimée définitivement.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              const res = await remove(p.id);
                              if (res.error) toast.error(res.error);
                              else toast.success("Proposition supprimée");
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <ShareProposalDialog proposalId={shareId} onClose={() => setShareId(null)} />
    </div>
  );
}
