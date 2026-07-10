import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Search, Palette, Globe, Car, Home as HomeIcon, Building2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
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

type TopTab = "apparence" | "communs" | ProjectType;

function AdminPdfPage() {
  const { loading } = useAuth();
  const { can } = usePermissions();
  const allowed = can("backoffice_pdf");
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !allowed) navigate({ to: "/login" });
  }, [loading, allowed, navigate]);

  const { settings, steps, isLoading, getSettings, getSteps, updateSettings, updateStep } = usePdfSettings();
  const [activeTab, setActiveTab] = useState<TopTab>("apparence");
  const [search, setSearch] = useState("");

  if (loading || isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Chargement...</div>;
  }
  if (!allowed) return null;

  const tabIcon = (t: TopTab) => {
    if (t === "apparence") return <Palette className="w-4 h-4" />;
    if (t === "communs") return <Globe className="w-4 h-4" />;
    if (t === "vehicles") return <Car className="w-4 h-4" />;
    if (t === "home") return <HomeIcon className="w-4 h-4" />;
    return <Building2 className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-[#FCF9F2]">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Retour</Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Personnalisation du PDF</h1>
              <p className="text-xs text-muted-foreground">Toutes les couleurs, images, textes et étapes du PDF sont éditables ici.</p>
            </div>
          </div>
          {/* Barre de recherche globale */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un texte, une couleur, une étape..."
              className="pl-9"
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TopTab)}>
          <TabsList className="mb-6">
            <TabsTrigger value="apparence" className="gap-2">{tabIcon("apparence")} Apparence</TabsTrigger>
            <TabsTrigger value="communs" className="gap-2">{tabIcon("communs")} Communs</TabsTrigger>
            <TabsTrigger value="vehicles" className="gap-2">{tabIcon("vehicles")} Véhicules</TabsTrigger>
            <TabsTrigger value="home" className="gap-2">{tabIcon("home")} Domicile</TabsTrigger>
            <TabsTrigger value="site" className="gap-2">{tabIcon("site")} Site</TabsTrigger>
          </TabsList>

          {/* Onglet APPARENCE : couleurs, logo, image couverture (s'applique à tous les projets via vehicles par défaut) */}
          <TabsContent value="apparence" className="space-y-6">
            <p className="text-xs text-muted-foreground">
              Les couleurs et images s'appliquent à <strong>tous</strong> les types de projet. Pour personnaliser un type
              en particulier (rare), passez par l'onglet projet correspondant.
            </p>
            {(Object.keys(PROJECT_LABELS) as ProjectType[]).map((t) => {
              const s = getSettings(t);
              if (!s) return null;
              return (
                <Card key={t}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      {tabIcon(t)} Charte {PROJECT_LABELS[t]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AppearanceSection
                      settings={s}
                      onSave={async (patch) => {
                        const res = await updateSettings(t, patch);
                        if (res.error) toast.error(res.error); else toast.success("Paramètres enregistrés");
                      }}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Onglet COMMUNS : textes partagés entre tous les types (couverture, footer, labels) */}
          <TabsContent value="communs" className="space-y-6">
            <p className="text-xs text-muted-foreground">
              Textes partagés sur toutes les pages : tagline, validité, footer, labels universels.
            </p>
            <PdfTextsEditor scope="common" filter={search} />
          </TabsContent>

          {/* Onglets projet : accordions par section du PDF */}
          {(Object.keys(PROJECT_LABELS) as ProjectType[]).map((t) => {
            const s = getSettings(t);
            const stepsForType = getSteps(t);
            if (!s) {
              return (
                <TabsContent key={t} value={t}>
                  <p className="text-sm text-muted-foreground">
                    Aucun paramètre trouvé pour {PROJECT_LABELS[t]}. Lancez le script SQL 002_pdf_settings.sql sur Supabase.
                  </p>
                </TabsContent>
              );
            }
            return (
              <TabsContent key={t} value={t} className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Tous les textes et étapes spécifiques au PDF en mode <strong>{PROJECT_LABELS[t]}</strong>. Dépliez chaque section
                  pour éditer.
                </p>
                <Accordion type="multiple" defaultValue={["textes"]} className="space-y-2">
                  <AccordionItem value="textes" className="border rounded-md bg-card px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <span className="text-sm font-semibold">Sous-titres et textes principaux (sous-titre catalogue, intro Pourquoi Beev, conditions)</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <TextSettingsSection
                        settings={s}
                        onSave={async (patch) => {
                          const res = await updateSettings(t, patch);
                          if (res.error) toast.error(res.error); else toast.success("Paramètres enregistrés");
                        }}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="texts-list" className="border rounded-md bg-card px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <span className="text-sm font-semibold">Textes par page (couverture, fiche, parcours, en bref, prochaines étapes...)</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <PdfTextsEditor scope={t} filter={search} hideCardWrapper />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="pillars" className="border rounded-md bg-card px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <span className="text-sm font-semibold">Engagements Beev (3 piliers — "Ce que Beev s'engage à tenir")</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <PillarsEditor projectType={t} hideCardWrapper />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="journey" className="border rounded-md bg-card px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <span className="text-sm font-semibold">Parcours client — étapes (cadrage, audit, pose, supervision...)</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <JourneyStepsEditor
                        steps={stepsForType}
                        onSaveStep={async (id, patch) => {
                          const res = await updateStep(id, patch);
                          if (res.error) toast.error(res.error); else toast.success("Étape mise à jour");
                        }}
                        hideCardWrapper
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </TabsContent>
            );
          })}
        </Tabs>
      </main>
    </div>
  );
}

// Section couleurs + images extraite pour l'onglet "Apparence"
function AppearanceSection({ settings, onSave }: { settings: PdfSettings; onSave: (patch: Partial<PdfSettings>) => Promise<void> }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => { setDraft(settings); }, [settings]);
  const save = (patch: Partial<PdfSettings>) => onSave(patch);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold mb-3">Couleurs de la charte</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ColorField label="Noir principal" value={draft.colorInk} onChange={(v) => setDraft({ ...draft, colorInk: v })} onBlur={(v) => save({ colorInk: v })} />
          <ColorField label="Vert (accent)" value={draft.colorAccent} onChange={(v) => setDraft({ ...draft, colorAccent: v })} onBlur={(v) => save({ colorAccent: v })} />
          <ColorField label="Bleu/Violet" value={draft.colorLavender} onChange={(v) => setDraft({ ...draft, colorLavender: v })} onBlur={(v) => save({ colorLavender: v })} />
          <ColorField label="Fond cream" value={draft.colorBg} onChange={(v) => setDraft({ ...draft, colorBg: v })} onBlur={(v) => save({ colorBg: v })} />
        </div>
      </section>
      <section className="grid md:grid-cols-2 gap-6">
        <ImageUpload
          currentUrl={draft.logoUrl ?? undefined}
          onChange={(url) => { setDraft({ ...draft, logoUrl: url }); save({ logoUrl: url || null }); }}
          folder="pdf"
          label="Logo Beev — fond clair (noir ou couleur)"
        />
        <ImageUpload
          currentUrl={draft.logoInverseUrl ?? undefined}
          onChange={(url) => { setDraft({ ...draft, logoInverseUrl: url }); save({ logoInverseUrl: url || null }); }}
          folder="pdf"
          label="Logo Beev — fond sombre (blanc)"
        />
        <ImageUpload
          currentUrl={draft.coverImageUrl ?? undefined}
          onChange={(url) => { setDraft({ ...draft, coverImageUrl: url }); save({ coverImageUrl: url || null }); }}
          folder="pdf"
          label="Image de couverture"
        />
      </section>
    </div>
  );
}

// Section textes pdf_settings (sous-titres + intro + bullets + conditions + BPA)
// extraite pour l'accordion "Sous-titres et textes principaux" dans les onglets projet.
function TextSettingsSection({ settings, onSave }: { settings: PdfSettings; onSave: (patch: Partial<PdfSettings>) => Promise<void> }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => { setDraft(settings); }, [settings]);
  const save = (patch: Partial<PdfSettings>) => onSave(patch);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Sous-titre de couverture</Label>
        <Input value={draft.coverSubtitle ?? ""} onChange={(e) => setDraft({ ...draft, coverSubtitle: e.target.value })} onBlur={() => save({ coverSubtitle: draft.coverSubtitle })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Sous-titre du catalogue (page de sélection commerciale)</Label>
        <Input value={draft.catalogSubtitle ?? ""} onChange={(e) => setDraft({ ...draft, catalogSubtitle: e.target.value })} onBlur={() => save({ catalogSubtitle: draft.catalogSubtitle })} placeholder="Ex : Kit clé en main, supervision et remboursement automatisé." />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">"Pourquoi Beev" — paragraphe d'intro</Label>
        <Textarea value={draft.whyBeevIntro ?? ""} onChange={(e) => setDraft({ ...draft, whyBeevIntro: e.target.value })} onBlur={() => save({ whyBeevIntro: draft.whyBeevIntro })} className="min-h-[100px]" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">"Pourquoi Beev" — bullets (une par ligne)</Label>
        <Textarea value={draft.whyBeevBullets.join("\n")} onChange={(e) => setDraft({ ...draft, whyBeevBullets: e.target.value.split("\n") })} onBlur={() => save({ whyBeevBullets: draft.whyBeevBullets.map((s) => s.trim()).filter(Boolean) })} className="min-h-[120px]" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Conditions commerciales</Label>
        <Textarea value={draft.validationConditions ?? ""} onChange={(e) => setDraft({ ...draft, validationConditions: e.target.value })} onBlur={() => save({ validationConditions: draft.validationConditions })} className="min-h-[80px]" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Titre Bon Pour Accord</Label>
          <Input value={draft.validationBpaTitle ?? ""} onChange={(e) => setDraft({ ...draft, validationBpaTitle: e.target.value })} onBlur={() => save({ validationBpaTitle: draft.validationBpaTitle })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Texte BPA</Label>
          <Textarea value={draft.validationBpaText ?? ""} onChange={(e) => setDraft({ ...draft, validationBpaText: e.target.value })} onBlur={() => save({ validationBpaText: draft.validationBpaText })} className="min-h-[80px]" />
        </div>
      </div>
    </div>
  );
}

// Ancien composant SettingsForm gardé pour compatibilité (référencé nulle part
// après ce refactor, mais conservé au cas où un test/import externe l'utilise).
function SettingsForm({ settings, onSave }: { settings: PdfSettings; onSave: (patch: Partial<PdfSettings>) => Promise<void> }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => { setDraft(settings); }, [settings]);
  const save = (patch: Partial<PdfSettings>) => onSave(patch);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Apparence et contenu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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
            label="Logo Beev — fond clair (noir ou couleur)"
          />
          <ImageUpload
            currentUrl={draft.logoInverseUrl ?? undefined}
            onChange={(url) => { setDraft({ ...draft, logoInverseUrl: url }); save({ logoInverseUrl: url || null }); }}
            folder="pdf"
            label="Logo Beev — fond sombre (blanc)"
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

function JourneyStepsEditor({ steps, onSaveStep, hideCardWrapper }: { steps: JourneyStep[]; onSaveStep: (id: string, patch: Partial<JourneyStep>) => Promise<void>; hideCardWrapper?: boolean }) {
  const body = (
    <div className="space-y-6">
      {steps.map((step) => (
        <StepEditor key={step.id} step={step} onSave={(patch) => onSaveStep(step.id, patch)} />
      ))}
    </div>
  );
  if (hideCardWrapper) return body;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parcours client (5 étapes)</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
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
function PillarsEditor({ projectType, hideCardWrapper }: { projectType: ProjectType; hideCardWrapper?: boolean }) {
  const { data: pillars = [], isLoading } = useBeevPillars();
  const { update } = useBeevPillarsMutations();

  const pillarsForType = pillars
    .filter((p) => p.projectType === projectType)
    .sort((a, b) => a.position - b.position);

  const body = (
    <div className="space-y-4">
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
    </div>
  );

  if (hideCardWrapper) return body;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagements Beev (3 piliers — "Ce que Beev s'engage à tenir")</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
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
function PdfTextsEditor({ scope, filter = "", hideCardWrapper = false }: { scope: "common" | ProjectType; filter?: string; hideCardWrapper?: boolean }) {
  const { data: all = [], isLoading } = usePdfTexts();
  const { update } = usePdfTextsMutations();
  const q = filter.trim().toLowerCase();
  // Filtre par recherche : matche label, category, contentText, ou items de contentList
  const texts = all
    .filter((t) => t.scope === scope)
    .filter((t) => {
      if (!q) return true;
      if (t.label.toLowerCase().includes(q)) return true;
      if (t.category.toLowerCase().includes(q)) return true;
      if (t.contentText && t.contentText.toLowerCase().includes(q)) return true;
      if (t.contentList && t.contentList.some((s) => s.toLowerCase().includes(q))) return true;
      return false;
    });

  if (isLoading) {
    const inner = <p className="text-sm text-muted-foreground">Chargement...</p>;
    if (hideCardWrapper) return inner;
    return (
      <Card>
        <CardHeader><CardTitle>Textes du PDF</CardTitle></CardHeader>
        <CardContent>{inner}</CardContent>
      </Card>
    );
  }

  if (texts.length === 0) {
    const inner = (
      <p className="text-sm text-muted-foreground">
        {q ? `Aucun texte ne correspond à "${filter}".` : "Aucun texte configuré pour ce scope. Appliquez la migration 013_pdf_texts.sql sur Supabase."}
      </p>
    );
    if (hideCardWrapper) return inner;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Textes du PDF {scope === "common" ? "(partagés)" : `(spécifiques ${scope})`}</CardTitle>
        </CardHeader>
        <CardContent>{inner}</CardContent>
      </Card>
    );
  }

  // Regroupement par catégorie pour l'affichage
  const byCategory = new Map<string, PdfText[]>();
  for (const t of texts) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }

  const body = (
    <div className="space-y-5">
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
    </div>
  );

  if (hideCardWrapper) return body;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Textes du PDF {scope === "common" ? "— communs (partagés entre tous les types de projet)" : `— spécifiques`}
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
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
