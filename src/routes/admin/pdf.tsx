import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { usePdfSettings, type PdfSettings, type JourneyStep } from "@/lib/pdf-settings";
import { useBeevPillars, useBeevPillarsMutations, type BeevPillar } from "@/lib/beev-pillars";
import { usePdfTexts, usePdfTextsMutations, type PdfText } from "@/lib/pdf-texts";
import { ImageUpload } from "@/components/image-upload";
import type { ProjectType } from "@/lib/catalog";

export const Route = createFileRoute("/admin/pdf")({
  component: AdminPdfPage,
});

const PROJECT_LABELS: Record<ProjectType, string> = {
  vehicles: "Véhicules",
  home: "Bornes domicile",
  site: "Bornes site",
};

function AdminPdfPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/login" });
  }, [loading, isAdmin, navigate]);

  const { settings, steps, isLoading, getSettings, getSteps, updateSettings, updateStep } = usePdfSettings();
  const [activeType, setActiveType] = useState<ProjectType>("vehicles");

  if (loading || isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Chargement...</div>;
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Retour</Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Personnalisation du PDF</h1>
              <p className="text-xs text-muted-foreground">Édite les couleurs, images, textes et étapes du parcours.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        {/* Section "communs" affichée hors tabs car partagée entre tous les types */}
        <PdfTextsEditor scope="common" />

        <Tabs value={activeType} onValueChange={(v) => setActiveType(v as ProjectType)}>
          <TabsList className="mb-6">
            {(Object.keys(PROJECT_LABELS) as ProjectType[]).map((t) => (
              <TabsTrigger key={t} value={t}>{PROJECT_LABELS[t]}</TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(PROJECT_LABELS) as ProjectType[]).map((t) => {
            const s = getSettings(t);
            const stepsForType = getSteps(t);
            if (!s) return <TabsContent key={t} value={t}><p className="text-sm text-muted-foreground">Aucun paramètre trouvé pour {t}. Lancez le script SQL 002_pdf_settings.sql dans Supabase.</p></TabsContent>;
            return (
              <TabsContent key={t} value={t} className="space-y-6">
                <SettingsForm settings={s} onSave={async (patch) => {
                  const res = await updateSettings(t, patch);
                  if (res.error) toast.error(res.error); else toast.success("Paramètres PDF enregistrés");
                }} />
                <JourneyStepsEditor steps={stepsForType} onSaveStep={async (id, patch) => {
                  const res = await updateStep(id, patch);
                  if (res.error) toast.error(res.error); else toast.success("Étape mise à jour");
                }} />
                <PillarsEditor projectType={t} />
                <PdfTextsEditor scope={t} />
              </TabsContent>
            );
          })}
        </Tabs>
      </main>
    </div>
  );
}

function SettingsForm({ settings, onSave }: { settings: PdfSettings; onSave: (patch: Partial<PdfSettings>) => Promise<void> }) {
  const [draft, setDraft] = useState(settings);

  // Sync if settings change externally
  useEffect(() => { setDraft(settings); }, [settings]);

  const save = (patch: Partial<PdfSettings>) => onSave(patch);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apparence et contenu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Couleurs */}
        <section>
          <h3 className="text-sm font-semibold mb-3">Couleurs de la charte</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ColorField label="Noir principal" value={draft.colorInk} onChange={(v) => setDraft({ ...draft, colorInk: v })} onBlur={(v) => save({ colorInk: v })} />
            <ColorField label="Vert (accent)" value={draft.colorAccent} onChange={(v) => setDraft({ ...draft, colorAccent: v })} onBlur={(v) => save({ colorAccent: v })} />
            <ColorField label="Bleu/Violet" value={draft.colorLavender} onChange={(v) => setDraft({ ...draft, colorLavender: v })} onBlur={(v) => save({ colorLavender: v })} />
            <ColorField label="Fond cream" value={draft.colorBg} onChange={(v) => setDraft({ ...draft, colorBg: v })} onBlur={(v) => save({ colorBg: v })} />
          </div>
        </section>

        {/* Images */}
        <section className="grid md:grid-cols-2 gap-6">
          <ImageUpload
            currentUrl={draft.logoUrl ?? undefined}
            onChange={(url) => { setDraft({ ...draft, logoUrl: url }); save({ logoUrl: url || null }); }}
            folder="pdf"
            label="Logo Beev (PNG/SVG)"
          />
          <ImageUpload
            currentUrl={draft.coverImageUrl ?? undefined}
            onChange={(url) => { setDraft({ ...draft, coverImageUrl: url }); save({ coverImageUrl: url || null }); }}
            folder="pdf"
            label="Image de couverture"
          />
        </section>

        {/* Textes */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Textes du PDF</h3>

          <div className="space-y-1">
            <Label className="text-xs">Sous-titre de couverture</Label>
            <Input
              value={draft.coverSubtitle ?? ""}
              onChange={(e) => setDraft({ ...draft, coverSubtitle: e.target.value })}
              onBlur={() => save({ coverSubtitle: draft.coverSubtitle })}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Sous-titre du catalogue (page de sélection commerciale)</Label>
            <Input
              value={draft.catalogSubtitle ?? ""}
              onChange={(e) => setDraft({ ...draft, catalogSubtitle: e.target.value })}
              onBlur={() => save({ catalogSubtitle: draft.catalogSubtitle })}
              placeholder="Ex : Kit clé en main, supervision et remboursement automatisé."
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">"Pourquoi Beev" — paragraphe d'intro</Label>
            <Textarea
              value={draft.whyBeevIntro ?? ""}
              onChange={(e) => setDraft({ ...draft, whyBeevIntro: e.target.value })}
              onBlur={() => save({ whyBeevIntro: draft.whyBeevIntro })}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">"Pourquoi Beev" — bullets (une par ligne)</Label>
            <Textarea
              value={draft.whyBeevBullets.join("\n")}
              onChange={(e) => setDraft({ ...draft, whyBeevBullets: e.target.value.split("\n") })}
              onBlur={() => save({ whyBeevBullets: draft.whyBeevBullets.map((s) => s.trim()).filter(Boolean) })}
              className="min-h-[120px]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Conditions commerciales</Label>
            <Textarea
              value={draft.validationConditions ?? ""}
              onChange={(e) => setDraft({ ...draft, validationConditions: e.target.value })}
              onBlur={() => save({ validationConditions: draft.validationConditions })}
              className="min-h-[80px]"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Titre Bon Pour Accord</Label>
              <Input
                value={draft.validationBpaTitle ?? ""}
                onChange={(e) => setDraft({ ...draft, validationBpaTitle: e.target.value })}
                onBlur={() => save({ validationBpaTitle: draft.validationBpaTitle })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Texte BPA</Label>
              <Textarea
                value={draft.validationBpaText ?? ""}
                onChange={(e) => setDraft({ ...draft, validationBpaText: e.target.value })}
                onBlur={() => save({ validationBpaText: draft.validationBpaText })}
                className="min-h-[80px]"
              />
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function ColorField({ label, value, onChange, onBlur }: { label: string; value: string; onChange: (v: string) => void; onBlur: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-input"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
          className="h-9 text-xs flex-1"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

function JourneyStepsEditor({ steps, onSaveStep }: { steps: JourneyStep[]; onSaveStep: (id: string, patch: Partial<JourneyStep>) => Promise<void> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parcours client (5 étapes)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {steps.map((step) => (
          <StepEditor key={step.id} step={step} onSave={(patch) => onSaveStep(step.id, patch)} />
        ))}
      </CardContent>
    </Card>
  );
}

function StepEditor({ step, onSave }: { step: JourneyStep; onSave: (patch: Partial<JourneyStep>) => Promise<void> }) {
  const [draft, setDraft] = useState(step);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Sync depuis le serveur uniquement quand on change d'étape (id différent),
  // pas à chaque refetch — évite d'écraser les modifs locales en cours.
  useEffect(() => { setDraft(step); }, [step.id]);

  // Auto-save debounced 800ms : à chaque modif, on attend la fin de la frappe
  // puis on persiste. Pas de bouton à cliquer, pas de risque d'oubli.
  useEffect(() => {
    const normalized = {
      ...draft,
      beevActions: draft.beevActions.map((s) => s.trim()).filter(Boolean),
      clientActions: draft.clientActions.map((s) => s.trim()).filter(Boolean),
    };
    const same =
      normalized.title === step.title &&
      normalized.summary === step.summary &&
      normalized.duration === step.duration &&
      JSON.stringify(normalized.beevActions) === JSON.stringify(step.beevActions) &&
      JSON.stringify(normalized.clientActions) === JSON.stringify(step.clientActions);
    if (same) return;
    const t = setTimeout(() => { onSaveRef.current(normalized); }, 800);
    return () => clearTimeout(t);
  }, [draft, step]);

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#35DA76] text-white flex items-center justify-center text-sm font-bold">{draft.stepNumber}</div>
          <h4 className="font-semibold">Étape {draft.position}</h4>
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Auto-sauvegardé</span>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Titre</Label>
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Durée</Label>
          <Input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} placeholder="ex: J → J+5" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Résumé</Label>
        <Textarea value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} className="min-h-[60px]" />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Actions Beev (une par ligne)</Label>
          <Textarea
            value={draft.beevActions.join("\n")}
            onChange={(e) => setDraft({ ...draft, beevActions: e.target.value.split("\n") })}
            className="min-h-[80px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Actions client (une par ligne)</Label>
          <Textarea
            value={draft.clientActions.join("\n")}
            onChange={(e) => setDraft({ ...draft, clientActions: e.target.value.split("\n") })}
            className="min-h-[80px]"
          />
        </div>
      </div>
    </div>
  );
}

// ============ ÉDITEUR DES PILIERS D'ENGAGEMENT ============
// Lit/écrit la table beev_pillars (3 piliers par type de projet).
// Auto-save 800ms debounced, comme les étapes du parcours.
function PillarsEditor({ projectType }: { projectType: ProjectType }) {
  const { data: pillars = [], isLoading } = useBeevPillars();
  const { update } = useBeevPillarsMutations();

  const pillarsForType = pillars
    .filter((p) => p.projectType === projectType)
    .sort((a, b) => a.position - b.position);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagements Beev (3 piliers — "Ce que Beev s'engage à tenir")</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
        {!isLoading && pillarsForType.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucun pilier configuré. Appliquez la migration 012_beev_pillars.sql sur Supabase.
          </p>
        )}
        {pillarsForType.map((p) => (
          <PillarEditor key={p.id} pillar={p} onSave={async (patch) => {
            try {
              await update.mutateAsync({ id: p.id, patch });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Erreur sauvegarde pilier");
            }
          }} />
        ))}
      </CardContent>
    </Card>
  );
}

function PillarEditor({ pillar, onSave }: { pillar: BeevPillar; onSave: (patch: Partial<{ title: string; metric: string; details: string[] }>) => Promise<void> }) {
  const [draft, setDraft] = useState({ title: pillar.title, metric: pillar.metric, details: pillar.details });
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Sync depuis le serveur uniquement quand l'id du pilier change (jamais à
  // chaque refetch). Évite d'écraser une frappe locale en cours.
  useEffect(() => {
    setDraft({ title: pillar.title, metric: pillar.metric, details: pillar.details });
  }, [pillar.id]);

  // Auto-save debounced 800ms après normalisation des détails (trim + filter).
  useEffect(() => {
    const normalized = {
      title: draft.title.trim(),
      metric: draft.metric.trim(),
      details: draft.details.map((s) => s.trim()).filter(Boolean),
    };
    const same =
      normalized.title === pillar.title &&
      normalized.metric === pillar.metric &&
      JSON.stringify(normalized.details) === JSON.stringify(pillar.details);
    if (same) return;
    const t = setTimeout(() => { onSaveRef.current(normalized); }, 800);
    return () => clearTimeout(t);
  }, [draft, pillar]);

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#3809EA] text-white flex items-center justify-center text-sm font-bold">
            {pillar.position + 1}
          </div>
          <h4 className="font-semibold">Pilier {pillar.position + 1}</h4>
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Auto-sauvegardé</span>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Titre</Label>
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ex : INTERLOCUTEUR UNIQUE" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Métrique mise en avant</Label>
          <Input value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value })} placeholder="Ex : Réponse J+1" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Détails (un par ligne, 4 idéalement)</Label>
        <Textarea
          value={draft.details.join("\n")}
          onChange={(e) => setDraft({ ...draft, details: e.target.value.split("\n") })}
          className="min-h-[100px]"
          placeholder="Un commercial grand compte dédié&#10;Hotline gestion de flotte mutualisée&#10;..."
        />
      </div>
    </div>
  );
}

// ============ ÉDITEUR GÉNÉRIQUE DES TEXTES PDF ============
// Lit/écrit la table pdf_texts. Affiche tous les textes du scope donné,
// groupés par catégorie. Auto-save 800ms debounced par texte.
function PdfTextsEditor({ scope }: { scope: "common" | ProjectType }) {
  const { data: all = [], isLoading } = usePdfTexts();
  const { update } = usePdfTextsMutations();
  const texts = all.filter((t) => t.scope === scope);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Textes du PDF</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Chargement...</p></CardContent>
      </Card>
    );
  }

  if (texts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Textes du PDF {scope === "common" ? "(partagés)" : `(spécifiques ${scope})`}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aucun texte configuré pour ce scope. Appliquez la migration
            013_pdf_texts.sql sur Supabase.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Regroupement par catégorie pour l'affichage
  const byCategory = new Map<string, PdfText[]>();
  for (const t of texts) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Textes du PDF {scope === "common" ? "— communs (partagés entre tous les types de projet)" : `— spécifiques`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {Array.from(byCategory.entries()).map(([cat, items]) => (
          <div key={cat} className="space-y-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{cat}</h4>
            <div className="space-y-3">
              {items.map((t) => (
                <PdfTextEditor key={t.id} text={t} onSave={async (patch) => {
                  try { await update.mutateAsync({ id: t.id, patch }); }
                  catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
                }} />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PdfTextEditor({ text, onSave }: {
  text: PdfText;
  onSave: (patch: Partial<{ content_text: string | null; content_list: string[] | null }>) => Promise<void>;
}) {
  const [draftText, setDraftText] = useState(text.contentText ?? "");
  const [draftList, setDraftList] = useState<string[]>(text.contentList ?? []);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    setDraftText(text.contentText ?? "");
    setDraftList(text.contentList ?? []);
  }, [text.id]);

  // Auto-save 800ms
  useEffect(() => {
    if (text.kind === "list") {
      const normalized = draftList.map((s) => s.trim()).filter(Boolean);
      if (JSON.stringify(normalized) === JSON.stringify(text.contentList ?? [])) return;
      const t = setTimeout(() => { onSaveRef.current({ content_list: normalized }); }, 800);
      return () => clearTimeout(t);
    } else {
      const normalized = draftText;
      if (normalized === (text.contentText ?? "")) return;
      const t = setTimeout(() => { onSaveRef.current({ content_text: normalized }); }, 800);
      return () => clearTimeout(t);
    }
  }, [draftText, draftList, text]);

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{text.label}</Label>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Auto-sauvegardé</span>
      </div>
      {text.kind === "text" && (
        <Input value={draftText} onChange={(e) => setDraftText(e.target.value)} className="text-sm" />
      )}
      {text.kind === "multiline" && (
        <Textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          className="min-h-[80px] text-sm"
        />
      )}
      {text.kind === "list" && (
        <Textarea
          value={draftList.join("\n")}
          onChange={(e) => setDraftList(e.target.value.split("\n"))}
          className="min-h-[120px] text-sm"
          placeholder="Une entrée par ligne"
        />
      )}
    </div>
  );
}
