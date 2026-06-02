import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, FileDown, Calendar, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useProposal, useProposals, PROPOSAL_STATUS_LABEL, PROPOSAL_STATUS_COLOR, type ProposalStatus } from "@/lib/proposals";
import { generateProposalPdf } from "@/lib/pdf";

export const Route = createFileRoute("/proposals/$id")({
  component: ProposalDetailPage,
});

const fmtEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const STATUS_OPTIONS: ProposalStatus[] = ["draft", "sent", "signed", "refused", "expired"];

function ProposalDetailPage() {
  const { isSales, loading } = useAuth();
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const { data: proposal, isLoading } = useProposal(id);
  const { updateStatus, updateFollowUp, updateInternalNotes } = useProposals();

  const [draftNotes, setDraftNotes] = useState("");

  useEffect(() => {
    if (!loading && !isSales) navigate({ to: "/login" });
  }, [loading, isSales, navigate]);

  useEffect(() => {
    if (proposal) setDraftNotes(proposal.internalNotes);
  }, [proposal?.id]);

  if (loading || isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Chargement...</div>;
  }
  if (!isSales) return null;
  if (!proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Proposition introuvable.</p>
          <Button asChild><Link to="/proposals">Retour à la liste</Link></Button>
        </div>
      </div>
    );
  }

  const handleRegeneratePdf = async () => {
    if (!proposal.energyParams) {
      toast.error("Paramètres énergie manquants");
      return;
    }
    try {
      await generateProposalPdf({
        projectType: proposal.projectType,
        client: {
          company: proposal.clientCompany,
          contact: proposal.clientContact,
          email: proposal.clientEmail,
          date: proposal.proposalDate,
          salesRep: proposal.salesRepName,
          salesRepEmail: proposal.salesRepEmail,
          salesRepPhone: proposal.salesRepPhone,
          notes: proposal.clientNotes,
        },
        vehicles: proposal.selectedVehicles,
        chargers: proposal.selectedChargers,
        energy: proposal.energyParams,
      });
      toast.success("PDF généré");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la génération du PDF");
    }
  };

  const handleEdit = () => {
    navigate({ to: "/", search: { proposal: proposal.id } as never });
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/proposals"><ArrowLeft className="w-4 h-4 mr-1" /> Propositions</Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{proposal.clientCompany}</h1>
              <p className="text-xs text-muted-foreground">
                Créée le {new Date(proposal.createdAt).toLocaleDateString("fr-FR")} · Modifiée le {new Date(proposal.updatedAt).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRegeneratePdf} className="gap-2">
              <FileDown className="w-4 h-4" /> Régénérer le PDF
            </Button>
            <Button onClick={handleEdit} className="gap-2">
              <Pencil className="w-4 h-4" /> Modifier
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Statut et relance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={proposal.status === s ? "default" : "outline"}
                    onClick={async () => {
                      const res = await updateStatus(proposal.id, s);
                      if (res.error) toast.error(res.error);
                      else toast.success(`Statut passé à : ${PROPOSAL_STATUS_LABEL[s]}`);
                    }}
                  >
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${PROPOSAL_STATUS_COLOR[s].split(" ")[0]}`} />
                    {PROPOSAL_STATUS_LABEL[s]}
                  </Button>
                ))}
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> Date de relance</Label>
                <Input
                  type="date"
                  value={proposal.followUpDate ?? ""}
                  onChange={async (e) => {
                    const res = await updateFollowUp(proposal.id, e.target.value || null);
                    if (res.error) toast.error(res.error);
                  }}
                  className="max-w-xs"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes internes (privées, hors PDF)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                placeholder="Notes pour votre équipe : contexte client, prochaines actions, blocages..."
                className="min-h-[120px]"
              />
              {draftNotes !== proposal.internalNotes && (
                <Button
                  size="sm"
                  onClick={async () => {
                    const res = await updateInternalNotes(proposal.id, draftNotes);
                    if (res.error) toast.error(res.error);
                    else toast.success("Notes enregistrées");
                  }}
                  className="gap-2"
                >
                  <Save className="w-3 h-3" /> Enregistrer les notes
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sélection ({proposal.vehicleCount + proposal.chargerCount} éléments)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {proposal.selectedVehicles.map((sv) => (
                <div key={sv.vehicle.id} className="flex items-center justify-between p-2 rounded border border-border">
                  <div>
                    <p className="text-sm font-medium">{sv.vehicle.brand} {sv.vehicle.model}</p>
                    <p className="text-xs text-muted-foreground">{sv.quantity} × {sv.durationMonths} mois · {sv.kmPerYear.toLocaleString("fr-FR")} km/an</p>
                  </div>
                  <p className="text-sm font-semibold">{fmtEur(sv.negotiatedMonthly)} /mois</p>
                </div>
              ))}
              {proposal.selectedChargers.map((sc) => (
                <div key={sc.charger.id} className="flex items-center justify-between p-2 rounded border border-border">
                  <div>
                    <p className="text-sm font-medium">{sc.charger.brand} {sc.charger.model}</p>
                    <p className="text-xs text-muted-foreground">{sc.quantity} × · {sc.siteName || "—"}</p>
                  </div>
                  <p className="text-sm font-semibold">{fmtEur(sc.lineItems.reduce((a, li) => a + li.qty * li.unitHt, 0))} HT</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-xs text-muted-foreground uppercase">Société</span><br />{proposal.clientCompany}</div>
              {proposal.clientContact && <div><span className="text-xs text-muted-foreground uppercase">Contact</span><br />{proposal.clientContact}</div>}
              {proposal.clientEmail && <div><span className="text-xs text-muted-foreground uppercase">Email</span><br /><a href={`mailto:${proposal.clientEmail}`} className="text-[#3809EA] hover:underline">{proposal.clientEmail}</a></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Commercial Beev</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {proposal.salesRepName && <div><span className="text-xs text-muted-foreground uppercase">Nom</span><br />{proposal.salesRepName}</div>}
              {proposal.salesRepEmail && <div><span className="text-xs text-muted-foreground uppercase">Email</span><br />{proposal.salesRepEmail}</div>}
              {proposal.salesRepPhone && <div><span className="text-xs text-muted-foreground uppercase">Téléphone</span><br />{proposal.salesRepPhone}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground uppercase">Montant total</p>
                <p className="text-2xl font-bold">{fmtEur(proposal.totalAmount)}</p>
                <p className="text-xs text-muted-foreground">
                  {proposal.projectType === "vehicles" ? "Loyers annuels TTC" : "HT"}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center">
            <Badge className={`text-base px-4 py-2 ${PROPOSAL_STATUS_COLOR[proposal.status]}`}>
              {PROPOSAL_STATUS_LABEL[proposal.status]}
            </Badge>
          </div>
        </div>
      </main>
    </div>
  );
}
