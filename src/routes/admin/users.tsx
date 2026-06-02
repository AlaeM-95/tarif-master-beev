import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Send, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useUsers, ROLE_LABELS, ROLE_COLORS, type AppUser } from "@/lib/users";
import type { UserRole } from "@/lib/supabase";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

const ROLES: UserRole[] = ["admin", "ops", "sales", "visitor"];

function AdminUsersPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Seul un admin peut gérer les rôles utilisateurs. Pas ops.
    if (!loading && !isAdmin) navigate({ to: "/login" });
  }, [loading, isAdmin, navigate]);

  const { users, isLoading, updateRole, inviteUser } = useUsers();
  const [inviteEmail, setInviteEmail] = useState("");

  if (loading || isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Chargement...</div>;
  }
  if (!isAdmin) return null;

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Email invalide");
      return;
    }
    try {
      await inviteUser.mutateAsync({ email });
      toast.success(`Lien d'invitation envoyé à ${email}`);
      setInviteEmail("");
    } catch (e) {
      toast.error(`Échec invitation : ${e instanceof Error ? e.message : "erreur"}`);
    }
  };

  const handleRoleChange = async (u: AppUser, newRole: UserRole) => {
    if (newRole === u.role) return;
    try {
      await updateRole.mutateAsync({ id: u.id, role: newRole });
      toast.success(`${u.email} → ${ROLE_LABELS[newRole]}`);
    } catch (e) {
      toast.error(`Échec : ${e instanceof Error ? e.message : "erreur"}`);
    }
  };

  // Stats par rôle
  const stats = {
    admin: users.filter((u) => u.role === "admin").length,
    ops: users.filter((u) => u.role === "ops").length,
    sales: users.filter((u) => u.role === "sales").length,
    visitor: users.filter((u) => u.role === "visitor").length,
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Retour</Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#3809EA]" /> Utilisateurs et accès
              </h1>
              <p className="text-xs text-muted-foreground">Invite des collaborateurs et gère leurs rôles (admin / ops / sales / visiteur).</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-md border px-3 py-1.5">{stats.admin} admin</span>
            <span className="rounded-md border px-3 py-1.5">{stats.ops} ops</span>
            <span className="rounded-md border px-3 py-1.5">{stats.sales} sales</span>
            <span className="rounded-md border px-3 py-1.5">{stats.visitor} visiteurs</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        {/* Bloc invitation */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-[#3809EA]" /> Inviter un nouvel utilisateur
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Le collaborateur reçoit un email avec un lien d'inscription Supabase. À sa première connexion,
              il atterrit sur l'app avec le rôle <strong>visiteur</strong> par défaut — vous pourrez ensuite
              l'élever à sales / ops / admin dans la liste ci-dessous.
            </p>
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[280px]">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="collaborateur@beev.co"
                  className="pl-9"
                  onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
                />
              </div>
              <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviteUser.isPending} className="gap-2">
                <Send className="w-4 h-4" /> {inviteUser.isPending ? "Envoi..." : "Envoyer l'invitation"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Liste des utilisateurs */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-[#FAF8F4]">
                  <tr className="text-left text-muted-foreground uppercase text-[10px] tracking-wide">
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Rôle actuel</th>
                    <th className="py-3 px-4">Modifier le rôle</th>
                    <th className="py-3 px-4">Créé le</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Aucun utilisateur. Invitez quelqu'un ci-dessus.</td></tr>
                  )}
                  {users.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-accent/30">
                      <td className="py-3 px-4 font-medium text-sm">{u.email || <span className="text-muted-foreground italic">(email manquant)</span>}</td>
                      <td className="py-3 px-4">
                        <Badge className={`border ${ROLE_COLORS[u.role]} text-[10px] uppercase font-semibold tracking-wide`}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Légende rôles */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-3">Que peut faire chaque rôle ?</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-md border p-3">
                <Badge className={`${ROLE_COLORS.admin} border text-[10px] uppercase mb-2`}>Admin</Badge>
                <p>Tout. Y compris invitation utilisateurs et changement de rôles. Réservé à une ou deux personnes max.</p>
              </div>
              <div className="rounded-md border p-3">
                <Badge className={`${ROLE_COLORS.ops} border text-[10px] uppercase mb-2`}>Ops</Badge>
                <p>Modifie le catalogue véhicules / bornes / matériel / BPU, les offres loueurs, le contenu PDF. Ne gère pas les utilisateurs.</p>
              </div>
              <div className="rounded-md border p-3">
                <Badge className={`${ROLE_COLORS.sales} border text-[10px] uppercase mb-2`}>Sales</Badge>
                <p>Construit des propositions, les sauvegarde, génère des PDF, présente au client. Lecture seule sur le catalogue.</p>
              </div>
              <div className="rounded-md border p-3">
                <Badge className={`${ROLE_COLORS.visitor} border text-[10px] uppercase mb-2`}>Visiteur</Badge>
                <p>Lecture seule. État par défaut d'un nouvel inscrit, en attente d'attribution d'un rôle réel.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
