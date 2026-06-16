import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signInWithMagicLink, sendPasswordReset, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirige vers l'accueil si déjà connecté
  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/" });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const { error: authError } = await signIn(email, password);
    setSubmitting(false);
    if (authError) {
      setError("Email ou mot de passe incorrect. Utilisez le lien de connexion par email si vous n'avez pas encore défini de mot de passe.");
    } else {
      navigate({ to: "/" });
    }
  };

  // Connexion par lien magique : indispensable pour les comptes invités qui
  // n'ont pas encore défini de mot de passe (sinon ils restent bloqués).
  const handleMagicLink = async () => {
    if (!email.trim()) { setError("Renseignez votre email pour recevoir un lien de connexion."); return; }
    setError(null); setInfo(null); setSubmitting(true);
    const { error: err } = await signInWithMagicLink(email);
    setSubmitting(false);
    if (err) setError(err);
    else setInfo("Lien de connexion envoyé. Consultez votre boîte mail et cliquez sur le lien pour vous connecter.");
  };

  // Réinitialisation / première définition du mot de passe.
  const handleReset = async () => {
    if (!email.trim()) { setError("Renseignez votre email pour réinitialiser votre mot de passe."); return; }
    setError(null); setInfo(null); setSubmitting(true);
    const { error: err } = await sendPasswordReset(email);
    setSubmitting(false);
    if (err) setError(err);
    else setInfo("Email envoyé. Cliquez sur le lien reçu pour définir votre mot de passe.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FCF9F2] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[#111111]">Beev</h1>
          <p className="mt-1 text-sm text-[#5F5F64]">Espace administrateur</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-[#DCDAD4] bg-white p-6 shadow-sm"
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#111111]">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#DCDAD4] px-3 py-2 text-sm focus:border-[#35DA76] focus:outline-none focus:ring-1 focus:ring-[#35DA76]"
              placeholder="vous@beev.co"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#111111]">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#DCDAD4] px-3 py-2 text-sm focus:border-[#35DA76] focus:outline-none focus:ring-1 focus:ring-[#35DA76]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {info && (
            <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{info}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-[#111111] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        {/* Alternatives sans mot de passe : indispensables pour les comptes
            fraîchement invités (lien magique) ou ayant oublié leur mot de passe. */}
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={submitting}
            className="w-full rounded-md border border-[#DCDAD4] bg-white px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F5F3EF] disabled:opacity-50"
          >
            Recevoir un lien de connexion par email
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={submitting}
            className="w-full text-center text-xs text-[#5F5F64] underline hover:text-[#111111] disabled:opacity-50"
          >
            Définir / réinitialiser mon mot de passe
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-[#5F5F64]">
          Accès réservé aux collaborateurs Beev.
        </p>
      </div>
    </div>
  );
}
