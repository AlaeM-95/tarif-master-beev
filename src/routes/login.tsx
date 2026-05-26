import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    setSubmitting(true);
    const { error: authError } = await signIn(email, password);
    setSubmitting(false);
    if (authError) {
      setError("Email ou mot de passe incorrect");
    } else {
      navigate({ to: "/" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] px-4">
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
              required
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

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-[#111111] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[#5F5F64]">
          Accès réservé aux administrateurs Beev.
        </p>
      </div>
    </div>
  );
}
