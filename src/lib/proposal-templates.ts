import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Database } from "./database.types";
import type { ProjectType } from "./catalog";
import type { SelectedCharger, SelectedVehicle } from "./pdf";
import type { EnergyParams } from "./store";

type Row = Database["public"]["Tables"]["proposal_templates"]["Row"];
type Insert = Database["public"]["Tables"]["proposal_templates"]["Insert"];

export type ProposalTemplate = {
  id: string;
  name: string;
  description: string | null;
  projectType: ProjectType;
  selectedVehicles: SelectedVehicle[];
  selectedChargers: SelectedCharger[];
  energyParams: EnergyParams | null;
  position: number;
  active: boolean;
};

function dbToTemplate(row: Row): ProposalTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    projectType: row.project_type as ProjectType,
    selectedVehicles: Array.isArray(row.selected_vehicles) ? (row.selected_vehicles as SelectedVehicle[]) : [],
    selectedChargers: Array.isArray(row.selected_chargers) ? (row.selected_chargers as SelectedCharger[]) : [],
    energyParams: row.energy_params as EnergyParams | null,
    position: row.position,
    active: row.active,
  };
}

async function fetchTemplates(): Promise<ProposalTemplate[]> {
  const { data, error } = await supabase
    .from("proposal_templates")
    .select("*")
    .eq("active", true)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[templates] fetch error:", error);
    return [];
  }
  return (data ?? []).map(dbToTemplate);
}

export function useProposalTemplates() {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["proposal_templates"],
    queryFn: fetchTemplates,
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: async (input: {
      name: string;
      description: string | null;
      projectType: ProjectType;
      selectedVehicles: SelectedVehicle[];
      selectedChargers: SelectedCharger[];
      energyParams: EnergyParams | null;
    }) => {
      const row: Insert = {
        name: input.name,
        description: input.description,
        project_type: input.projectType,
        selected_vehicles: input.selectedVehicles as unknown as Insert["selected_vehicles"],
        selected_chargers: input.selectedChargers as unknown as Insert["selected_chargers"],
        energy_params: input.energyParams as unknown as Insert["energy_params"],
      };
      const { data, error } = await supabase.from("proposal_templates").insert(row).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "Création échouée");
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposal_templates"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("proposal_templates").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposal_templates"] }),
  });

  return { templates, isLoading, create, remove };
}
