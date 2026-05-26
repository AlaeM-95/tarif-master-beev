import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Database } from "./database.types";
import type { ProjectType } from "./catalog";

type PdfSettingsRow = Database["public"]["Tables"]["pdf_settings"]["Row"];
type JourneyStepRow = Database["public"]["Tables"]["journey_steps"]["Row"];

export type PdfSettings = {
  projectType: ProjectType;
  colorInk: string;
  colorAccent: string;
  colorLavender: string;
  colorBg: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  coverSubtitle: string | null;
  whyBeevIntro: string | null;
  whyBeevBullets: string[];
  validationConditions: string | null;
  validationBpaText: string | null;
  validationBpaTitle: string | null;
};

export type JourneyStep = {
  id: string;
  projectType: ProjectType;
  position: number;
  stepNumber: string;
  title: string;
  summary: string;
  duration: string;
  beevActions: string[];
  clientActions: string[];
};

function dbToSettings(row: PdfSettingsRow): PdfSettings {
  return {
    projectType: row.project_type as ProjectType,
    colorInk: row.color_ink,
    colorAccent: row.color_accent,
    colorLavender: row.color_lavender,
    colorBg: row.color_bg,
    logoUrl: row.logo_url,
    coverImageUrl: row.cover_image_url,
    coverSubtitle: row.cover_subtitle,
    whyBeevIntro: row.why_beev_intro,
    whyBeevBullets: Array.isArray(row.why_beev_bullets) ? (row.why_beev_bullets as string[]) : [],
    validationConditions: row.validation_conditions,
    validationBpaText: row.validation_bpa_text,
    validationBpaTitle: row.validation_bpa_title,
  };
}

function dbToJourneyStep(row: JourneyStepRow): JourneyStep {
  return {
    id: row.id,
    projectType: row.project_type as ProjectType,
    position: row.position,
    stepNumber: row.step_number,
    title: row.title,
    summary: row.summary ?? "",
    duration: row.duration ?? "",
    beevActions: Array.isArray(row.beev_actions) ? (row.beev_actions as string[]) : [],
    clientActions: Array.isArray(row.client_actions) ? (row.client_actions as string[]) : [],
  };
}

async function fetchAllPdfSettings(): Promise<PdfSettings[]> {
  const { data, error } = await supabase.from("pdf_settings").select("*");
  if (error) {
    console.error("Erreur fetch pdf_settings:", error);
    return [];
  }
  return (data ?? []).map(dbToSettings);
}

async function fetchAllJourneySteps(): Promise<JourneyStep[]> {
  const { data, error } = await supabase
    .from("journey_steps")
    .select("*")
    .order("project_type")
    .order("position");
  if (error) {
    console.error("Erreur fetch journey_steps:", error);
    return [];
  }
  return (data ?? []).map(dbToJourneyStep);
}

// Récupération côté PDF (synchrone via cache React Query)
export function usePdfSettings() {
  const qc = useQueryClient();
  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ["pdf_settings"],
    queryFn: fetchAllPdfSettings,
    staleTime: 60_000,
  });
  const { data: steps = [], isLoading: stepsLoading } = useQuery({
    queryKey: ["journey_steps"],
    queryFn: fetchAllJourneySteps,
    staleTime: 60_000,
  });

  const updateSettings = async (
    projectType: ProjectType,
    patch: Partial<Omit<PdfSettings, "projectType">>,
  ): Promise<{ error: string | null }> => {
    const dbPatch: Partial<Database["public"]["Tables"]["pdf_settings"]["Insert"]> = {};
    if (patch.colorInk !== undefined) dbPatch.color_ink = patch.colorInk;
    if (patch.colorAccent !== undefined) dbPatch.color_accent = patch.colorAccent;
    if (patch.colorLavender !== undefined) dbPatch.color_lavender = patch.colorLavender;
    if (patch.colorBg !== undefined) dbPatch.color_bg = patch.colorBg;
    if (patch.logoUrl !== undefined) dbPatch.logo_url = patch.logoUrl;
    if (patch.coverImageUrl !== undefined) dbPatch.cover_image_url = patch.coverImageUrl;
    if (patch.coverSubtitle !== undefined) dbPatch.cover_subtitle = patch.coverSubtitle;
    if (patch.whyBeevIntro !== undefined) dbPatch.why_beev_intro = patch.whyBeevIntro;
    if (patch.whyBeevBullets !== undefined) dbPatch.why_beev_bullets = patch.whyBeevBullets;
    if (patch.validationConditions !== undefined) dbPatch.validation_conditions = patch.validationConditions;
    if (patch.validationBpaText !== undefined) dbPatch.validation_bpa_text = patch.validationBpaText;
    if (patch.validationBpaTitle !== undefined) dbPatch.validation_bpa_title = patch.validationBpaTitle;

    const { error } = await supabase
      .from("pdf_settings")
      .update(dbPatch)
      .eq("project_type", projectType);
    if (error) return { error: error.message };
    await qc.invalidateQueries({ queryKey: ["pdf_settings"] });
    return { error: null };
  };

  const updateStep = async (
    id: string,
    patch: Partial<Omit<JourneyStep, "id" | "projectType">>,
  ): Promise<{ error: string | null }> => {
    const dbPatch: Partial<Database["public"]["Tables"]["journey_steps"]["Insert"]> = {};
    if (patch.position !== undefined) dbPatch.position = patch.position;
    if (patch.stepNumber !== undefined) dbPatch.step_number = patch.stepNumber;
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.summary !== undefined) dbPatch.summary = patch.summary;
    if (patch.duration !== undefined) dbPatch.duration = patch.duration;
    if (patch.beevActions !== undefined) dbPatch.beev_actions = patch.beevActions;
    if (patch.clientActions !== undefined) dbPatch.client_actions = patch.clientActions;

    const { error } = await supabase.from("journey_steps").update(dbPatch).eq("id", id);
    if (error) return { error: error.message };
    await qc.invalidateQueries({ queryKey: ["journey_steps"] });
    return { error: null };
  };

  return {
    settings,
    steps,
    isLoading: settingsLoading || stepsLoading,
    getSettings: (type: ProjectType) => settings.find((s) => s.projectType === type),
    getSteps: (type: ProjectType) => steps.filter((s) => s.projectType === type).sort((a, b) => a.position - b.position),
    updateSettings,
    updateStep,
  };
}

// Récupération directe (async, pour pdf.ts au moment de la génération)
export async function loadPdfSettings(
  projectType: ProjectType,
): Promise<{ settings: PdfSettings | null; steps: JourneyStep[] }> {
  const [settingsRes, stepsRes] = await Promise.all([
    supabase.from("pdf_settings").select("*").eq("project_type", projectType).maybeSingle(),
    supabase.from("journey_steps").select("*").eq("project_type", projectType).order("position"),
  ]);
  return {
    settings: settingsRes.data ? dbToSettings(settingsRes.data) : null,
    steps: (stepsRes.data ?? []).map(dbToJourneyStep),
  };
}

// Helpers couleurs hex ↔ RGB pour jsPDF
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
