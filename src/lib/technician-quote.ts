// Helper d'invocation de l'Edge Function parse-technician-quote.
// L'Edge Function télécharge le PDF, appelle l'API Anthropic et renvoie
// la liste structurée des lignes. Cf. supabase/functions/parse-technician-quote.

import { supabase } from "./supabase";

export type ParsedQuoteLine = {
  label: string;
  qty: number;
  unit: string;
  unitHt: number;
};

export type ParsedQuote = {
  supplier: string;
  quoteNumber: string;
  quoteDate: string;
  totalHt: number;
  lines: ParsedQuoteLine[];
  usage?: { input_tokens?: number; output_tokens?: number } | null;
};

export async function parseTechnicianQuote(pdfUrl: string): Promise<ParsedQuote> {
  if (!pdfUrl) throw new Error("URL du PDF manquante.");
  const { data, error } = await supabase.functions.invoke("parse-technician-quote", {
    body: { pdfUrl },
  });
  if (error) {
    // Le SDK Supabase enveloppe l'erreur ; on tente d'extraire le message de la réponse
    const msg = (error as { message?: string }).message ?? "Erreur Edge Function.";
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  if (!data || !Array.isArray(data.lines)) {
    throw new Error("Réponse invalide de l'Edge Function (lines manquant).");
  }
  return data as ParsedQuote;
}
