// Edge Function Supabase · parse-technician-quote
// Reçoit l'URL Storage d'un PDF de devis technicien, le télécharge,
// l'envoie à l'API Anthropic en base64, parse la réponse JSON et la
// renvoie au frontend.
//
// Déploiement :
//   supabase functions deploy parse-technician-quote --no-verify-jwt
//
// Secrets requis (Dashboard Supabase > Edge Functions > Manage secrets) :
//   ANTHROPIC_API_KEY = sk-ant-xxx
//
// Le frontend appelle :
//   supabase.functions.invoke("parse-technician-quote", { body: { pdfUrl } })

// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-5-20250929";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXTRACT_PROMPT = `Tu es un assistant qui extrait les lignes d'un devis d'installation IRVE (bornes de recharge VE).

Le PDF ci-joint est un devis envoyé par un technicien partenaire à Beev. Extrais TOUTES les lignes de prestation (matériel, main d'œuvre, forfaits, déplacements).

Règles strictes :
- Retourne UNIQUEMENT du JSON valide, sans markdown, sans backticks, sans commentaire avant ou après
- Tous les prix sont HT (hors taxes) — ignore la TVA, le total TTC et les lignes de récapitulatif
- Ne renvoie PAS les lignes "Total HT", "TVA", "Total TTC", "Sous-total", "Remise globale"
- Si une quantité est manquante, mets 1
- Si un prix unitaire est manquant, mets 0
- Le label doit être la désignation complète, telle quelle (préserve casse, accents, ponctuation, références techniques entre parenthèses)
- L'unité est "forfait" / "article" / "m" / "h" / "u" / "ml" selon ce qui est écrit ; mets "u" par défaut

Format JSON strict attendu :
{
  "supplier": "<nom de la société émettrice du devis>",
  "quoteNumber": "<numéro de devis ou chaîne vide>",
  "quoteDate": "<date d'émission au format YYYY-MM-DD ou chaîne vide>",
  "totalHt": <nombre décimal — total HT figurant sur le devis>,
  "lines": [
    {"label": "<désignation complète>", "qty": <nombre>, "unit": "<unité>", "unitHt": <prix unitaire HT>}
  ]
}`;

async function callAnthropic(pdfBase64: string): Promise<any> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            },
            { type: "text", text: EXTRACT_PROMPT },
          ],
        },
      ],
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${errText.slice(0, 500)}`);
  }
  return await resp.json();
}

function uint8ToBase64(bytes: Uint8Array): string {
  // Conversion sans dépasser la limite d'arguments de fromCharCode pour les gros PDFs
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée côté Edge Function." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const pdfUrl: string | undefined = body?.pdfUrl;
    if (!pdfUrl || typeof pdfUrl !== "string") {
      return new Response(
        JSON.stringify({ error: "pdfUrl manquant ou invalide." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Télécharger le PDF (URL publique Supabase Storage)
    const pdfResp = await fetch(pdfUrl);
    if (!pdfResp.ok) {
      return new Response(
        JSON.stringify({ error: `Impossible de télécharger le PDF (${pdfResp.status}).` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const ct = pdfResp.headers.get("content-type") ?? "";
    if (!ct.includes("pdf") && !ct.includes("octet-stream")) {
      // On laisse passer mais on log
      console.warn(`[parse-quote] content-type inattendu: ${ct}`);
    }
    const pdfBytes = new Uint8Array(await pdfResp.arrayBuffer());
    if (pdfBytes.byteLength === 0) {
      return new Response(
        JSON.stringify({ error: "PDF vide." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (pdfBytes.byteLength > 30 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "PDF trop volumineux (max 30 Mo)." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const pdfBase64 = uint8ToBase64(pdfBytes);

    // Appel Anthropic
    const result = await callAnthropic(pdfBase64);
    const text: string = result?.content?.[0]?.text ?? "";
    if (!text) throw new Error("Réponse Anthropic vide.");

    // Extraction du premier bloc JSON ({...})
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) {
      return new Response(
        JSON.stringify({ error: "Aucun JSON détecté dans la réponse Claude.", raw: text.slice(0, 1000) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    let parsed: any;
    try {
      parsed = JSON.parse(m[0]);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: `JSON invalide retourné par Claude : ${(e as Error).message}`, raw: m[0].slice(0, 1000) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sanitization défensive
    const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
    const cleanLines = lines
      .map((l: any) => ({
        label: String(l?.label ?? "").trim(),
        qty: Number(l?.qty ?? 1) || 1,
        unit: String(l?.unit ?? "u").trim() || "u",
        unitHt: Math.max(0, Number(l?.unitHt ?? 0) || 0),
      }))
      .filter((l: any) => l.label.length > 0);

    return new Response(
      JSON.stringify({
        supplier: String(parsed.supplier ?? "").trim(),
        quoteNumber: String(parsed.quoteNumber ?? "").trim(),
        quoteDate: String(parsed.quoteDate ?? "").trim(),
        totalHt: Number(parsed.totalHt ?? 0) || 0,
        lines: cleanLines,
        usage: result?.usage ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[parse-quote] error", e);
    return new Response(
      JSON.stringify({ error: (e as Error)?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
