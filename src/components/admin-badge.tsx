import { Link } from "@tanstack/react-router";
import { LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

// Badge compact dans le header — icon-only pour éviter de saturer la barre.
// Les actions "Éditer le PDF" et "Déconnexion" sont dans le Menu déroulant
// du header principal (cf. index.tsx).
export function AdminBadge() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <Button asChild variant="ghost" size="sm" className="gap-1.5">
        <Link to="/login">
          <LogIn className="w-3.5 h-3.5" /> Connexion
        </Link>
      </Button>
    );
  }

  if (!isAdmin) return null;

  // Icon-only avec tooltip natif (title) pour le user connecté
  return (
    <div
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-accent text-accent-foreground"
      title={`Admin · ${user.email ?? ""}`}
    >
      <ShieldCheck className="w-4 h-4" />
    </div>
  );
}
