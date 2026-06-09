import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Database } from "./database.types";
import type { ProjectType } from "./catalog";

type Row = Database["public"]["Tables"]["pdf_texts"]["Row"];
type Insert = Database["public"]["Tables"]["pdf_texts"]["Insert"];

export type PdfTextScope = "common" | ProjectType;
export type PdfTextKind = "text" | "multiline" | "list";

export type PdfText = {
  id: string;
  scope: PdfTextScope;
  slug: string;
  category: string;
  label: string;
  kind: PdfTextKind;
  contentText: string | null;
  contentList: string[] | null;
  position: number;
  active: boolean;
};

function dbToText(row: Row): PdfText {
  return {
    id: row.id,
    scope: row.scope as PdfTextScope,
    slug: row.slug,
    category: row.category,
    label: row.label,
    kind: row.kind as PdfTextKind,
    contentText: row.content_text,
    contentList: Array.isArray(row.content_list) ? (row.content_list as string[]) : null,
    position: row.position,
    active: row.active,
  };
}

async function fetchPdfTexts(): Promise<PdfText[]> {
  const { data, error } = await supabase
    .from("pdf_texts")
    .select("*")
    .eq("active", true)
    .order("scope")
    .order("category")
    .order("position");
  if (error) {
    console.error("[pdf_texts] fetch error:", error);
    return [];
  }
  return (data ?? []).map(dbToText);
}

// Hook UI admin
export function usePdfTexts() {
  return useQuery({
    queryKey: ["pdf_texts"],
    queryFn: fetchPdfTexts,
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch async direct (utilisé par pdf.ts au moment de la génération)
export async function loadPdfTexts(): Promise<PdfText[]> {
  return fetchPdfTexts();
}

export function usePdfTextsMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pdf_texts"] });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Insert> }) => {
      const { error } = await supabase.from("pdf_texts").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
  return { update };
}

// Helper de lookup utilisé dans pdf.ts : retourne le texte pour un (scope, slug)
// donné, ou la valeur de fallback hardcodée si la migration n'a pas été
// appliquée. Lookup priorité : overrides par devis -> scope spécifique au
// type projet -> scope 'common' -> fallback.
export type PdfTextMap = Map<string, PdfText>;

// Surcharges locales du devis courant : clé = "scope:slug", valeur = texte
// (string pour text/multiline) ou tableau (list). Renseignées par le commercial
// depuis l'éditeur WYSIWYG avant la génération du PDF, persistées en local
// par devis. PRIORITÉ MAX sur tout (DB + fallback).
export type PdfTextOverrides = Record<string, string | string[]>;
let TEXT_OVERRIDES: PdfTextOverrides | null = null;
export function setPdfTextOverrides(overrides: PdfTextOverrides | null) {
  TEXT_OVERRIDES = overrides;
}
export function getPdfTextOverrides(): PdfTextOverrides | null {
  return TEXT_OVERRIDES;
}

export function buildPdfTextMap(texts: PdfText[]): PdfTextMap {
  const map = new Map<string, PdfText>();
  for (const t of texts) map.set(`${t.scope}:${t.slug}`, t);
  return map;
}

function readOverrideText(scope: PdfTextScope, slug: string): string | null {
  if (!TEXT_OVERRIDES) return null;
  const v = TEXT_OVERRIDES[`${scope}:${slug}`] ?? TEXT_OVERRIDES[`common:${slug}`];
  if (typeof v === "string") return v;
  return null;
}
function readOverrideList(scope: PdfTextScope, slug: string): string[] | null {
  if (!TEXT_OVERRIDES) return null;
  const v = TEXT_OVERRIDES[`${scope}:${slug}`] ?? TEXT_OVERRIDES[`common:${slug}`];
  if (Array.isArray(v)) return v;
  return null;
}

export function lookupText(
  map: PdfTextMap,
  scope: PdfTextScope,
  slug: string,
  fallback: string,
): string {
  // 1) Override par devis (priorité max)
  const o = readOverrideText(scope, slug);
  if (o !== null) return o;
  // 2) Valeur DB
  const entry = map.get(`${scope}:${slug}`) ?? map.get(`common:${slug}`);
  if (!entry || entry.kind === "list") return fallback;
  return entry.contentText ?? fallback;
}

export function lookupList(
  map: PdfTextMap,
  scope: PdfTextScope,
  slug: string,
  fallback: string[],
): string[] {
  const o = readOverrideList(scope, slug);
  if (o !== null) return o;
  const entry = map.get(`${scope}:${slug}`) ?? map.get(`common:${slug}`);
  if (!entry || entry.kind !== "list") return fallback;
  return entry.contentList ?? fallback;
}
