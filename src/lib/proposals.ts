import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Database } from "./database.types";
import type { ProjectType } from "./catalog";
import type { SelectedCharger, SelectedVehicle } from "./pdf";
import type { EnergyParams } from "./store";

type ProposalRow = Database["public"]["Tables"]["proposals"]["Row"];
type ProposalInsert = Database["public"]["Tables"]["proposals"]["Insert"];

export type ProposalStatus = "draft" | "sent" | "signed" | "refused" | "expired";

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  signed: "Signée",
  refused: "Refusée",
  expired: "Expirée",
};

export const PROPOSAL_STATUS_COLOR: Record<ProposalStatus, string> = {
  draft: "bg-gray-200 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  signed: "bg-[#35DA76] text-[#111111]",
  refused: "bg-red-100 text-red-800",
  expired: "bg-yellow-100 text-yellow-800",
};

export type Proposal = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ProposalStatus;
  followUpDate: string | null;
  clientCompany: string;
  clientContact: string;
  clientEmail: string;
  clientNotes: string;
  proposalDate: string;
  salesRepName: string;
  salesRepEmail: string;
  salesRepPhone: string;
  projectType: ProjectType;
  selectedVehicles: SelectedVehicle[];
  selectedChargers: SelectedCharger[];
  energyParams: EnergyParams | null;
  totalAmount: number;
  vehicleCount: number;
  chargerCount: number;
  internalNotes: string;
};

function dbToProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    followUpDate: row.follow_up_date,
    clientCompany: row.client_company,
    clientContact: row.client_contact ?? "",
    clientEmail: row.client_email ?? "",
    clientNotes: row.client_notes ?? "",
    proposalDate: row.proposal_date ?? "",
    salesRepName: row.sales_rep_name ?? "",
    salesRepEmail: row.sales_rep_email ?? "",
    salesRepPhone: row.sales_rep_phone ?? "",
    projectType: row.project_type as ProjectType,
    selectedVehicles: (Array.isArray(row.selected_vehicles) ? row.selected_vehicles : []) as SelectedVehicle[],
    selectedChargers: (Array.isArray(row.selected_chargers) ? row.selected_chargers : []) as SelectedCharger[],
    energyParams: row.energy_params as EnergyParams | null,
    totalAmount: row.total_amount,
    vehicleCount: row.vehicle_count,
    chargerCount: row.charger_count,
    internalNotes: row.internal_notes ?? "",
  };
}

// Calcule le montant total d'une proposition (loyers annuels véhicules + prix bornes HT)
function computeTotal(
  selectedV: SelectedVehicle[],
  selectedC: SelectedCharger[],
): number {
  let total = 0;
  selectedV.forEach((sv) => {
    total += sv.negotiatedMonthly * 12 * sv.quantity;
  });
  selectedC.forEach((sc) => {
    const sum = sc.lineItems.reduce((a, li) => a + li.qty * li.unitHt, 0);
    total += sum * sc.quantity;
  });
  return Math.round(total);
}

export type SaveProposalInput = {
  id?: string;
  clientCompany: string;
  clientContact: string;
  clientEmail: string;
  clientNotes: string;
  proposalDate: string;
  salesRepName: string;
  salesRepEmail: string;
  salesRepPhone: string;
  projectType: ProjectType;
  selectedVehicles: SelectedVehicle[];
  selectedChargers: SelectedCharger[];
  energyParams: EnergyParams;
  status?: ProposalStatus;
  followUpDate?: string | null;
  internalNotes?: string;
};

async function fetchProposals(): Promise<Proposal[]> {
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Erreur fetch proposals:", error);
    return [];
  }
  return (data ?? []).map(dbToProposal);
}

async function fetchProposal(id: string): Promise<Proposal | null> {
  const { data, error } = await supabase.from("proposals").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return dbToProposal(data);
}

export function useProposals() {
  const qc = useQueryClient();
  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["proposals"],
    queryFn: fetchProposals,
    staleTime: 15_000,
  });

  const save = async (input: SaveProposalInput): Promise<{ id: string | null; error: string | null }> => {
    const total = computeTotal(input.selectedVehicles, input.selectedChargers);
    const row: ProposalInsert = {
      client_company: input.clientCompany,
      client_contact: input.clientContact || null,
      client_email: input.clientEmail || null,
      client_notes: input.clientNotes || null,
      proposal_date: input.proposalDate || null,
      sales_rep_name: input.salesRepName || null,
      sales_rep_email: input.salesRepEmail || null,
      sales_rep_phone: input.salesRepPhone || null,
      project_type: input.projectType,
      selected_vehicles: input.selectedVehicles as unknown as Database["public"]["Tables"]["proposals"]["Insert"]["selected_vehicles"],
      selected_chargers: input.selectedChargers as unknown as Database["public"]["Tables"]["proposals"]["Insert"]["selected_chargers"],
      energy_params: input.energyParams as unknown as Database["public"]["Tables"]["proposals"]["Insert"]["energy_params"],
      total_amount: total,
      vehicle_count: input.selectedVehicles.length,
      charger_count: input.selectedChargers.length,
      status: input.status ?? "draft",
      follow_up_date: input.followUpDate ?? null,
      internal_notes: input.internalNotes ?? null,
    };

    if (input.id) {
      const { error } = await supabase.from("proposals").update(row).eq("id", input.id);
      if (error) return { id: null, error: error.message };
      await qc.invalidateQueries({ queryKey: ["proposals"] });
      await qc.invalidateQueries({ queryKey: ["proposal", input.id] });
      return { id: input.id, error: null };
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("proposals")
        .insert({ ...row, created_by: user?.id ?? null })
        .select("id")
        .single();
      if (error || !data) return { id: null, error: error?.message ?? "Création échouée" };
      await qc.invalidateQueries({ queryKey: ["proposals"] });
      return { id: data.id, error: null };
    }
  };

  const updateStatus = async (id: string, status: ProposalStatus): Promise<{ error: string | null }> => {
    const { error } = await supabase.from("proposals").update({ status }).eq("id", id);
    if (error) return { error: error.message };
    await qc.invalidateQueries({ queryKey: ["proposals"] });
    await qc.invalidateQueries({ queryKey: ["proposal", id] });
    return { error: null };
  };

  const updateFollowUp = async (id: string, date: string | null): Promise<{ error: string | null }> => {
    const { error } = await supabase.from("proposals").update({ follow_up_date: date }).eq("id", id);
    if (error) return { error: error.message };
    await qc.invalidateQueries({ queryKey: ["proposals"] });
    await qc.invalidateQueries({ queryKey: ["proposal", id] });
    return { error: null };
  };

  const updateInternalNotes = async (id: string, notes: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from("proposals").update({ internal_notes: notes }).eq("id", id);
    if (error) return { error: error.message };
    await qc.invalidateQueries({ queryKey: ["proposals"] });
    await qc.invalidateQueries({ queryKey: ["proposal", id] });
    return { error: null };
  };

  const remove = async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from("proposals").delete().eq("id", id);
    if (error) return { error: error.message };
    await qc.invalidateQueries({ queryKey: ["proposals"] });
    return { error: null };
  };

  // Crée une copie d'une proposition existante avec un nouvel id et un statut
  // 'draft'. Le nom de société est suffixé '(copie)' pour différencier visuel-
  // lement et désamorcer la détection de doublon à la prochaine sauvegarde.
  const duplicate = async (id: string): Promise<{ id: string | null; error: string | null }> => {
    const original = await fetchProposal(id);
    if (!original) return { id: null, error: "Proposition source introuvable" };
    const total = computeTotal(original.selectedVehicles, original.selectedChargers);
    const { data: { user } } = await supabase.auth.getUser();
    const row: ProposalInsert = {
      client_company: `${original.clientCompany} (copie)`,
      client_contact: original.clientContact || null,
      client_email: original.clientEmail || null,
      client_notes: original.clientNotes || null,
      proposal_date: original.proposalDate || null,
      sales_rep_name: original.salesRepName || null,
      sales_rep_email: original.salesRepEmail || null,
      sales_rep_phone: original.salesRepPhone || null,
      project_type: original.projectType,
      selected_vehicles: original.selectedVehicles as unknown as Database["public"]["Tables"]["proposals"]["Insert"]["selected_vehicles"],
      selected_chargers: original.selectedChargers as unknown as Database["public"]["Tables"]["proposals"]["Insert"]["selected_chargers"],
      energy_params: original.energyParams as unknown as Database["public"]["Tables"]["proposals"]["Insert"]["energy_params"],
      total_amount: total,
      vehicle_count: original.selectedVehicles.length,
      charger_count: original.selectedChargers.length,
      status: "draft",
      follow_up_date: null,
      internal_notes: original.internalNotes || null,
      created_by: user?.id ?? null,
    };
    const { data, error } = await supabase
      .from("proposals")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) return { id: null, error: error?.message ?? "Duplication échouée" };
    await qc.invalidateQueries({ queryKey: ["proposals"] });
    return { id: data.id, error: null };
  };

  return { proposals, isLoading, save, updateStatus, updateFollowUp, updateInternalNotes, remove, duplicate };
}

export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: ["proposal", id],
    queryFn: () => (id ? fetchProposal(id) : null),
    enabled: !!id,
    staleTime: 10_000,
  });
}
