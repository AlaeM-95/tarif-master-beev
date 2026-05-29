import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Database } from "./database.types";
import type { ProjectType } from "./catalog";

type PillarRow = Database["public"]["Tables"]["beev_pillars"]["Row"];
type PillarInsert = Database["public"]["Tables"]["beev_pillars"]["Insert"];

export type BeevPillar = {
  id: string;
  projectType: ProjectType;
  position: number;
  title: string;
  metric: string;
  details: string[];
  active: boolean;
};

function dbToPillar(row: PillarRow): BeevPillar {
  return {
    id: row.id,
    projectType: row.project_type as ProjectType,
    position: row.position,
    title: row.title,
    metric: row.metric,
    details: Array.isArray(row.details) ? (row.details as string[]) : [],
    active: row.active,
  };
}

async function fetchBeevPillars(): Promise<BeevPillar[]> {
  const { data, error } = await supabase
    .from("beev_pillars")
    .select("*")
    .eq("active", true)
    .order("project_type", { ascending: true })
    .order("position", { ascending: true });
  if (error) {
    console.error("[beev_pillars] fetch error:", error);
    return [];
  }
  return (data ?? []).map(dbToPillar);
}

// Hook côté UI commercial / PDF — cache 5 min, les piliers changent rarement.
export function useBeevPillars() {
  return useQuery({
    queryKey: ["beev_pillars"],
    queryFn: fetchBeevPillars,
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch direct (async, pour pdf.ts au moment de la génération)
export async function loadBeevPillars(): Promise<BeevPillar[]> {
  return fetchBeevPillars();
}

export function useBeevPillarsMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["beev_pillars"] });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PillarInsert> }) => {
      const { error } = await supabase.from("beev_pillars").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { update };
}
