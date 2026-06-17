import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, KeyRound, Shield, UserPlus, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useUsers, ROLE_LABELS, ROLE_COLORS, type AppUser } from "@/lib/users";
import { useRolePermissionsAdmin, PERMISSION_LABELS, PERMISSION_ORDER, type Permission, type RolePermissions } from "@/lib/permissions";
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

  const { users, isLoading, updateRole, createUser } = useUsers();
  const perms = useRolePermissionsAdmin();
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // Dernier compte créé : on affiche les identifiants une fois pour que l'admin
  // les transmette au collaborateur (aucun email n'est envoyé).
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  // Génère un mot de passe lisible (sans caractères ambigus) pour l'onboarding.
  const genPassword = () => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let s = "";
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const arr = new Uint32Array(10);
      crypto.getRandomValues(arr);
      for (let i = 0; i < 10; i++) s += chars[arr[i] % chars.length];
    } else {
      for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
    }
    return `Beev-${s}`;
  };

  // Rôles éditables dans la matrice (admin = tous droits, non modifiable).
  const EDITABLE_ROLES: UserRole[] = ["ops", "sales", "visitor"];
  const handlePermToggle = async (role: UserRole, perm: Permission, value: boolean) => {
    try {
      await perms.update.mutateAsync({ role, patch: { [perm]: value } as Partial<RolePermissions> });
      toast.success("Permission mise à jour");
    } catch (e) {
      toast.error(`Échec : ${e instanceof Error ? e.message : "erreur"}`);
    }
  };

  if (loading || isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Chargement...</div>;
  }
  if (!isAdmin) return null;

  const handleCreate = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Email invalide");
      return;
    }
    const password = newPassword.trim() || genPassword();
    if (password.length < 6) {
      toast.error("Mot de passe trop court (minimum 6 caractères)");
      return;
    }
    try {
      await createUser.mutateAsync({ email, password });
      setLastCreated({ email, password });
      toast.success(`Compte créé pour ${email}`);
      setNewEmail("");
      setNewPassword("");
    } catch (e) {
      toast.error(`Échec création : ${e instanceof Error ? e.message : "erreur"}`);
    }
  };

  const copyCreds = async () => {
    if (!lastCreated) return;
    const text = `Accès Beev tarif master\nURL : https://tarif-master-beev.lovable.app\nEmail : ${lastCreated.email}\nMot de passe : ${lastCreated.password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Identifiants copiés");
    } catch {
      toast.error("Copie impossible, sélectionnez le texte manuellement");
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
    <div className="min-h-screen bg-[#FCF9F2]">
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
              <p className="text-xs text-muted-foreground">Crée des comptes collaborateurs et gère leurs rôles (admin / ops / sales / visiteur).</p>
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
        {/* Bloc création de compte — SANS email (onboarding interne) */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-[#3809EA]" /> Créer un compte collaborateur
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Vous définissez l'email et le mot de passe : aucun email de confirmation n'est envoyé.
              Communiquez les identifiants au collaborateur, qui se connecte directement avec son mot de passe.
              Le compte démarre avec le rôle <strong>visiteur</strong> ; attribuez ensuite sales / ops / admin ci-dessous.
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="collaborateur@beev.co"
                    className="pl-9"
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mot de passe</Label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Laissez vide pour générer"
                    className="pl-9 pr-10"
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                  />
                  <button
                    type="button"
                    onClick={() => setNewPassword(genPassword())}
                    title="Générer un mot de passe"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={!newEmail.trim() || createUser.isPending} className="gap-2">
                <UserPlus className="w-4 h-4" /> {createUser.isPending ? "Création..." : "Créer le compte"}
              </Button>
            </div>

            {lastCreated && (
              <div className="mt-4 rounded-md border border-[#35DA76]/40 bg-[#35DA76]/10 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-semibold text-[#1E7A3F]">Compte créé — transmettez ces identifiants</p>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={copyCreds}>
                    <Copy className="w-3 h-3" /> Copier
                  </Button>
                </div>
                <div className="text-xs space-y-0.5 font-mono">
                  <p>URL : https://tarif-master-beev.lovable.app</p>
                  <p>Email : {lastCreated.email}</p>
                  <p>Mot de passe : {lastCreated.password}</p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Ces identifiants ne seront plus affichés après avoir quitté la page. Le collaborateur pourra changer son mot de passe une fois connecté.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Liste des utilisateurs */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-[#FCF9F2]">
                  <tr className="text-left text-muted-foreground uppercase text-[10px] tracking-wide">
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Rôle actuel</th>
                    <th className="py-3 px-4">Modifier le rôle</th>
                    <th className="py-3 px-4">Créé le</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Aucun utilisateur. Créez un compte ci-dessus.</td></tr>
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

        {/* Matrice de permissions par rôle (éditable par l'admin) */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-[#3809EA]" /> Accès par rôle
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Décidez, pour chaque rôle, qui accède au backoffice et peut modifier les fiches produit.
              Le rôle <strong>admin</strong> conserve tous les droits.
              {!perms.available && " (Migration role_permissions non encore appliquée : valeurs par défaut affichées.)"}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-[#FCF9F2]">
                  <tr className="text-left text-muted-foreground uppercase text-[10px] tracking-wide">
                    <th className="py-3 px-4">Accès</th>
                    <th className="py-3 px-4 text-center">Admin</th>
                    {EDITABLE_ROLES.map((r) => (
                      <th key={r} className="py-3 px-4 text-center">{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_ORDER.map((perm) => (
                    <tr key={perm} className="border-b hover:bg-accent/30">
                      <td className="py-3 px-4 font-medium">{PERMISSION_LABELS[perm]}</td>
                      <td className="py-3 px-4 text-center">
                        <input type="checkbox" checked readOnly disabled className="h-4 w-4 accent-[#3809EA] opacity-60" />
                      </td>
                      {EDITABLE_ROLES.map((r) => (
                        <td key={r} className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={perms.matrix[r][perm]}
                            disabled={perms.update.isPending}
                            onChange={(e) => handlePermToggle(r, perm, e.target.checked)}
                            className="h-4 w-4 accent-[#3809EA] cursor-pointer"
                          />
                        </td>
                      ))}
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
