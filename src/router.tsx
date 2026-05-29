import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // QueryClient avec config robuste : pas de retry infini en cas d'erreur réseau
  // (évite que l'app boucle sur des requêtes Supabase qui échouent).
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1, // 1 retry max (au lieu de 3 par défaut)
        retryDelay: 1500,
        staleTime: 30_000,
        refetchOnWindowFocus: false, // évite les refetch chaotiques au focus
      },
      mutations: {
        retry: 0, // les mutations ne sont jamais retried (évite les doubles inserts)
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
