import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

export function AdminBadge() {
  const { user, isAdmin, signOut, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <Button asChild variant="ghost" size="sm" className="gap-2">
        <Link to="/login">
          <LogIn className="w-4 h-4" /> Connexion admin
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <Badge className="gap-1 bg-[#35DA76] text-[#111111] hover:bg-[#35DA76]">
          <ShieldCheck className="w-3 h-3" /> Admin
        </Badge>
      )}
      <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2" title={user.email ?? ""}>
        <LogOut className="w-4 h-4" /> Déconnexion
      </Button>
    </div>
  );
}
