import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, type ReactNode } from "react";
import { ArrowLeft, Car, FileDown, Users, Tag, Receipt, Package, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
import { useVehicles, fmtEur } from "@/lib/store";
import { useLeaserOffers } from "@/lib/leaser-offers";

export const Route = createFileRoute("/admin/")({
  component: AdminHubPage,
});

// Tableau de bord backoffice : vue d'ensemble (KPIs) + accès aux sections
// selon les permissions du rôle (ops = véhicules ; admin = tout).
function AdminHubPage() {
  const { loading, isAdmin } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const canVehicles = can("backoffice_vehicles");
  const canPdf = can("backoffice_pdf");
  const canUsers = can("manage_users") || isAdmin;
  const allowed = canVehicles || canPdf || canUsers;

  useEffect(() => {
    if (!loading && !allowed) navigate({ to: "/login" });
  }, [loading, allowed, navigate]);

  const { vehicles } = useVehicles();
  const { offers } = useLeaserOffers();

  const stats = useMemo(() => {
    const withOffer = new Set(offers.map((o) => o.vehicleId));
    const startingRents = vehicles.map((v) => {
      const vo = offers.filter((o) => o.vehicleId === v.id);
      return vo.length ? Math.min(...vo.map((o) => o.monthlyPriceTtc)) : v.monthlyLld;
    }).filter((n) => n > 0);
    return {
      total: vehicles.length,
      withOffer: withOffer.size,
      stock: vehicles.filter((v) => v.availableStock).length,
      avgRent: startingRents.length ? startingRents.reduce((s, n) => s + n, 0) / startingRents.length : 0,
    };
  }, [vehicles, offers]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Chargement...</div>;
  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <header className="border-b bg-white">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Retour à l'outil</Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Backoffice Beev</h1>
              <p className="text-xs text-muted-foreground">Pilotage du catalogue, du contenu et des accès.</p>
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight">beev</span>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Véhicules au catalogue" value={stats.total} icon={<Car className="w-4 h-4" />} accent="#1A1A1A" />
          <KpiCard label="Avec offre loueur" value={stats.withOffer} sub={`${stats.total ? Math.round((stats.withOffer / stats.total) * 100) : 0}% du parc`} icon={<Tag className="w-4 h-4" />} accent="#3809EA" />
          <KpiCard label="Loyer moyen « à partir de »" value={`${fmtEur(stats.avgRent)}/m`} icon={<Receipt className="w-4 h-4" />} accent="#1FA463" />
          <KpiCard label="Stock dispo" value={stats.stock} icon={<Package className="w-4 h-4" />} accent="#35DA76" />
        </div>

        {/* Sections accessibles selon le rôle */}
        <div>
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">Sections</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {canVehicles && (
              <Tile to="/admin/vehicles" icon={<Car className="w-5 h-5" />} title="Véhicules & loueurs" desc="Pricing, remises, offres loueurs, fiches produit et stock." accent="#3809EA" />
            )}
            {canPdf && (
              <Tile to="/admin/pdf" icon={<FileDown className="w-5 h-5" />} title="Configuration PDF" desc="Textes, réglages et charte des propositions générées." accent="#F4886A" />
            )}
            {canUsers && (
              <Tile to="/admin/users" icon={<Users className="w-5 h-5" />} title="Utilisateurs & rôles" desc="Invitations, rôles et matrice des permissions." accent="#1A1A1A" />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function KpiCard({ label, value, sub, icon, accent }: { label: string; value: string | number; sub?: string; icon?: ReactNode; accent?: string }) {
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

function Tile({ to, icon, title, desc, accent }: { to: string; icon: ReactNode; title: string; desc: string; accent?: string }) {
  return (
    <a href={to} className="group rounded-xl border bg-white p-5 shadow-sm hover:shadow-md hover:border-foreground/30 transition-all flex flex-col gap-3">
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl" style={{ color: accent, background: `${accent}14` }}>{icon}</span>
      <div>
        <div className="flex items-center gap-1 font-semibold">{title}<ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" /></div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
      </div>
    </a>
  );
}
