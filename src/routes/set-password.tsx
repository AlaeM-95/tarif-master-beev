import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/set-password")({
  component: SetPasswordPage,
});

// Page de définition / réinitialisation du mot de passe. On y arrive :
//  - via le lien reçu par email (resetPasswordForEmail → redirectTo /set-password),
//    Supabase ayant alors établi une session de récupération ;
//  - ou directement quand on est déjà connecté (pour définir un mot de passe
//    après une première connexion par lien magique).
function SetPasswordPage() {
  const { setPassword, user, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Le mot de passe doit comporter au moins 8 caractères."); return; }
    if (password !== confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setSubmitting(true);
    const { error: err } = await setPassword(password);
    setSubmitting(false);
    if (err) {
      setError(err.includes("session") || err.includes("Auth session")
        ? "Lien expiré ou session absente. Redemandez un lien depuis l'écran de connexion."
        : err);
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/" }), 1500);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[#111111]">Beev</h1>
          <p className="mt-1 text-sm text-[#5F5F64]">Définir votre mot de passe</p>
        </div>

        {done ? (
          <div className="rounded-lg border border-[#DCDAD4] bg-white p-6 text-center text-sm text-green-700 shadow-sm">
            Mot de passe enregistré. Vous pourrez désormais vous connecter avec votre email et ce mot de passe. Redirection...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-[#DCDAD4] bg-white p-6 shadow-sm">
            {!loading && !user && (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Aucune session active. Si vous êtes arrivé ici par un lien email, il est peut-être expiré. Redemandez un lien depuis l'écran de connexion.
              </div>
            )}
            <div>
              <label htmlFor="pwd" className="block text-sm font-medium text-[#111111]">Nouveau mot de passe</label>
              <input
                id="pwd" type="password" required autoComplete="new-password"
                value={password} onChange={(e) => setPwd(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[#DCDAD4] px-3 py-2 text-sm focus:border-[#35DA76] focus:outline-none focus:ring-1 focus:ring-[#35DA76]"
                placeholder="Au moins 8 caractères"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-[#111111]">Confirmer le mot de passe</label>
              <input
                id="confirm" type="password" required autoComplete="new-password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[#DCDAD4] px-3 py-2 text-sm focus:border-[#35DA76] focus:outline-none focus:ring-1 focus:ring-[#35DA76]"
                placeholder="••••••••"
              />
            </div>

            {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <button
              type="submit" disabled={submitting}
              className="w-full rounded-md bg-[#111111] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Enregistrement..." : "Enregistrer le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
