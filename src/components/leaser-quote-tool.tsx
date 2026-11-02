// Devis loueur : importer le PDF d'un loueur (Ayvens, Arval, BPCE Car Lease,
// Alphabet), contrôler ce qui a été lu, produire le devis Beev et l'ajouter au
// devis en cours. Le format est commun à tous les loueurs ; la décomposition du
// loyer suit ce que chaque loueur indique, et les points douteux sont signalés
// pour confirmation avant tout envoi.

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileDown, FilePlus2, FileSearch, Loader2, PenLine, Plus, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Vehicle } from "@/lib/catalog";
import { useLeaserOffers } from "@/lib/leaser-offers";
import {
  LEASER_LABEL,
  SCOPE_LABELS,
  AUTO_FLAGS,
  assuranceMonthly,
  blankQuote,
  blockingFlags,
  effectiveEcoOk,
  finalizeQuote,
  flagResolved,
  isExpired,
  kmPerYear,
  matchCatalogue,
  netDownPayment,
  parseLeaserQuotePdf,
  rentLinesSum,
  validUntil,
  type LeaserId,
  type LeaserQuote,
  type ScopeKey,
  type ScopeValue,
} from "@/lib/leaser-quote";
import { LEASER_QUOTE_CSS, printLeaserQuote, renderLeaserQuoteHtml } from "@/lib/leaser-quote-html";

export type LeaserQuoteDraft = { quote: LeaserQuote; vehicle: Vehicle; ecoOk: boolean };

type ClientLite = { company?: string; salesRep?: string; salesRepEmail?: string; salesRepPhone?: string };

type Props = {
  vehicles: Vehicle[];
  client: ClientLite;
  canSaveOffer: boolean;
  onAddToDevis: (draft: LeaserQuoteDraft) => void;
};

const eur2 = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const SELECT_CLS = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const OFFER_LEASER_NAME: Record<LeaserId, string> = { ayvens: "Ayvens", arval: "Arval", alphabet: "Alphabet", bpce: "BPCE Lease", autre: "" };

function Field({ label, flagKey, q, children, className = "" }: { label: string; flagKey?: string; q: LeaserQuote; children: React.ReactNode; className?: string }) {
  const f = flagKey ? q.flags.find((x) => x.field === flagKey && !flagResolved(q, x)) : undefined;
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className={f ? "rounded-md ring-2 ring-amber-400/70" : ""}>{children}</div>
      {f && <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">{f.note}</p>}
    </div>
  );
}

function NumInput({ value, onChange, step = "any", placeholder }: { value: number | null; onChange: (v: number | null) => void; step?: string; placeholder?: string }) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    />
  );
}

export function LeaserQuoteTool({ vehicles, client, canSaveOffer, onAddToDevis }: Props) {
  const [quotes, setQuotes] = useState<LeaserQuote[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const { create: createOffer } = useLeaserOffers();

  const q = quotes.find((x) => x.id === currentId) ?? null;

  const update = (fn: (x: LeaserQuote) => LeaserQuote) => {
    if (!q) return;
    setQuotes((all) => all.map((x) => (x.id === q.id ? fn(x) : x)));
  };
  const setVeh = (patch: Partial<LeaserQuote["vehicle"]>) => update((x) => ({ ...x, vehicle: { ...x.vehicle, ...patch } }));
  const setPrice = (patch: Partial<LeaserQuote["price"]>) => update((x) => ({ ...x, price: { ...x.price, ...patch } }));
  const setCt = (patch: Partial<LeaserQuote["contract"]>) => update((x) => ({ ...x, contract: { ...x.contract, ...patch } }));
  const setDp = (patch: Partial<LeaserQuote["downPayment"]>) => update((x) => ({ ...x, downPayment: { ...x.downPayment, ...patch, ambiguous: false } }));

  const matches = useMemo(() => (q ? matchCatalogue(q, vehicles) : []), [q?.vehicle.brand, q?.vehicle.model, q?.vehicle.finition, vehicles]);
  const chosenId = q ? (choice[q.id] ?? (matches[0] && matches[0].score >= 3 ? matches[0].vehicle.id : "")) : "";
  const chosen = vehicles.find((v) => v.id === chosenId);
  const ecoOk = q ? effectiveEcoOk(q, chosen?.ecoScoreBool) : false;
  const blockers = q ? blockingFlags(q) : [];
  const expired = q ? isExpired(q) : false;

  const addFiles = async (files: FileList | File[]) => {
    const pdfs = Array.from(files).filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
    if (pdfs.length === 0) { toast.error("Déposez un fichier PDF de devis loueur."); return; }
    setBusy(true);
    try {
      const added: LeaserQuote[] = [];
      for (const f of pdfs) {
        try { added.push(await parseLeaserQuotePdf(f)); }
        catch (e) { toast.error(`Lecture impossible : ${f.name}${e instanceof Error ? ` (${e.message})` : ""}`); }
      }
      if (added.length) {
        setQuotes((all) => [...all, ...added]);
        setCurrentId(added[0].id);
        const unknown = added.filter((a) => a.leaser === "autre").length;
        toast.success(`${added.length} devis lu${added.length > 1 ? "s" : ""}${unknown ? ` · ${unknown} loueur non reconnu` : ""}`);
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addManual = () => {
    const m = finalizeQuote(blankQuote("autre"), false);
    setQuotes((all) => [...all, m]);
    setCurrentId(m.id);
  };

  const remove = (id: string) => {
    setQuotes((all) => all.filter((x) => x.id !== id));
    if (currentId === id) setCurrentId(quotes.find((x) => x.id !== id)?.id ?? null);
  };

  const toggleConfirmed = (field: string, on: boolean) =>
    update((x) => ({
      ...x,
      confirmed: on ? Array.from(new Set([...x.confirmed, field])) : x.confirmed.filter((f) => f !== field),
      // Apport confirmé tel quel (0 €) : on lève l'ambiguïté affichée sur le devis.
      downPayment: field === "apport" && on ? { ...x.downPayment, ambiguous: false } : x.downPayment,
    }));

  const renderOpts = () => ({
    ecoOk,
    photoSrc: chosen?.image || undefined,
    clientName: client.company || "",
    advisor: { name: client.salesRep, email: client.salesRepEmail, phone: client.salesRepPhone },
  });

  const previewHtml = useMemo(
    () => (q ? renderLeaserQuoteHtml(q, { ...renderOpts(), logoSrc: "/images/logo-beev-noir.png" }) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, ecoOk, chosen?.image, client.company, client.salesRep, client.salesRepEmail, client.salesRepPhone],
  );

  const ready = !!q && blockers.length === 0 && q.rent.totalTtc > 0 && q.contract.months > 0 && !!q.vehicle.brand;

  const handleAdd = () => {
    if (!q) return;
    if (!chosen) { toast.error("Choisissez le véhicule du catalogue Beev correspondant."); return; }
    onAddToDevis({ quote: q, vehicle: chosen, ecoOk });
  };

  const handleSaveOffer = async () => {
    if (!q || !chosen) { toast.error("Choisissez d'abord le véhicule du catalogue Beev."); return; }
    const name = OFFER_LEASER_NAME[q.leaser] || q.leaserLabel;
    try {
      await createOffer.mutateAsync({ vehicleId: chosen.id, loueur: name, kind: "loueur", durationMonths: q.contract.months, kmTotal: q.contract.km, monthlyPriceTtc: q.rent.totalTtc });
      toast.success(`Offre ${name} enregistrée : elle pré-remplira le loyer de ce véhicule`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    }
  };

  const setScope = (k: ScopeKey, v: ScopeValue) => update((x) => ({ ...x, scope: { ...x.scope, [k]: v } }));

  return (
    <section className="space-y-6 lg:col-span-2">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Devis loueur</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Importez le devis PDF d'un loueur : il est lu automatiquement et présenté au format Beev. Vérifiez les points signalés, téléchargez le devis client ou ajoutez le véhicule au devis en cours.
          </p>
        </div>
      </div>

      {/* 1. Import */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files); }}
          className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
        >
          {busy ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Lecture du devis…</p>
          ) : (
            <>
              <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Déposez un ou plusieurs devis PDF ici</p>
              <p className="text-xs text-muted-foreground">Ayvens, Arval, BPCE Car Lease, Alphabet. Un autre loueur se saisit à la main.</p>
              <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                <Button size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5"><FileSearch className="w-3.5 h-3.5" /> Choisir un PDF</Button>
                <Button size="sm" variant="outline" onClick={addManual} className="gap-1.5"><PenLine className="w-3.5 h-3.5" /> Saisie manuelle</Button>
              </div>
            </>
          )}
          <input ref={fileRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => e.target.files && void addFiles(e.target.files)} />
        </div>

        {quotes.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {quotes.map((x) => {
              const n = blockingFlags(x).length;
              return (
                <div key={x.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left ${x.id === currentId ? "border-primary bg-muted" : "bg-card"}`}>
                  <button type="button" onClick={() => setCurrentId(x.id)} className="text-left min-w-0">
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">{x.leaserLabel}</p>
                    <p className="text-sm font-semibold truncate max-w-[220px]">{x.vehicle.brand || "Véhicule"} {x.vehicle.model}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{x.rent.totalTtc > 0 ? `${eur2(x.rent.totalTtc)} / mois · ${x.contract.months} mois` : "à compléter"}</p>
                  </button>
                  {n > 0 ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" aria-label={`${n} point(s) à vérifier`} /> : <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" aria-label="Prêt" />}
                  <button type="button" onClick={() => remove(x.id)} className="text-muted-foreground hover:text-destructive" title="Retirer ce devis"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              );
            })}
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} className="gap-1.5 self-center"><Plus className="w-3.5 h-3.5" /> Ajouter</Button>
          </div>
        )}
      </div>

      {q && (
        <>
          {/* 2. Points à vérifier */}
          {(blockers.length > 0 || expired || q.flags.some((f) => f.status === "absent") || (q.rent.lines.length > 0 && Math.abs(rentLinesSum(q) - q.rent.totalTtc) > 0.05)) ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 space-y-2">
              <p className="text-sm font-semibold inline-flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> À contrôler avant l'envoi au client</p>
              <ul className="space-y-1.5">
                {q.flags.map((f) => (
                  <li key={f.field} className="text-sm flex items-start gap-2">
                    {f.status === "check" ? (
                      <Checkbox id={`flag-${f.field}`} checked={flagResolved(q, f)} disabled={AUTO_FLAGS.has(f.field)} onCheckedChange={(v) => toggleConfirmed(f.field, v === true)} className="mt-0.5" />
                    ) : (
                      <span className="w-4 h-4 mt-0.5 rounded-full bg-muted text-[10px] grid place-content-center text-muted-foreground flex-shrink-0">–</span>
                    )}
                    <label htmlFor={f.status === "check" ? `flag-${f.field}` : undefined} className={flagResolved(q, f) ? "text-muted-foreground line-through" : ""}>
                      {f.note}{f.status === "check" && !AUTO_FLAGS.has(f.field) ? <span className="text-xs text-muted-foreground"> · cochez une fois vérifié</span> : null}
                    </label>
                  </li>
                ))}
                {expired && (
                  <li className="text-sm flex items-start gap-2">
                    <span className="w-4 h-4 mt-0.5 rounded-full bg-amber-200 text-[10px] grid place-content-center text-amber-900 flex-shrink-0">!</span>
                    <span>Offre du loueur expirée depuis le {validUntil(q)?.toLocaleDateString("fr-FR")} : demandez une nouvelle cotation avant d'envoyer le devis.</span>
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-4 text-sm inline-flex items-center gap-2 w-full">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Tous les champs ont été lus et recoupés.
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)] items-start">
            {/* 3. Contrôle et saisie */}
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold">Devis et client</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Loueur" q={q} flagKey="loueur">
                    <select className={SELECT_CLS} value={q.leaser} onChange={(e) => update((x) => ({ ...x, leaser: e.target.value as LeaserId, leaserLabel: LEASER_LABEL[e.target.value as LeaserId] }))}>
                      {(Object.keys(LEASER_LABEL) as LeaserId[]).map((k) => <option key={k} value={k}>{LEASER_LABEL[k]}</option>)}
                    </select>
                  </Field>
                  <Field label="N° d'offre" q={q} flagKey="offre"><Input value={q.offerNumber} onChange={(e) => update((x) => ({ ...x, offerNumber: e.target.value }))} /></Field>
                  <Field label="Client" q={q} flagKey="client" className="col-span-2">
                    <div className="flex gap-2">
                      <Input value={q.client} placeholder={client.company || "Société du client"} onChange={(e) => update((x) => ({ ...x, client: e.target.value }))} />
                      {client.company && q.client !== client.company && (
                        <Button type="button" size="sm" variant="outline" onClick={() => update((x) => ({ ...x, client: client.company ?? "" }))} title="Reprendre le client du devis Beev">Client Beev</Button>
                      )}
                    </div>
                  </Field>
                  <Field label="Date de l'offre" q={q}><Input type="date" value={q.dateIso} onChange={(e) => update((x) => ({ ...x, dateIso: e.target.value }))} /></Field>
                  <Field label="Validité (jours)" q={q}><NumInput value={q.validityDays} onChange={(v) => update((x) => ({ ...x, validityDays: v, validityMonths: null }))} /></Field>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold">Véhicule</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Marque" q={q} flagKey="vehicule"><Input value={q.vehicle.brand} onChange={(e) => setVeh({ brand: e.target.value })} /></Field>
                  <Field label="Modèle" q={q}><Input value={q.vehicle.model} onChange={(e) => setVeh({ model: e.target.value })} /></Field>
                  <Field label="Finition" q={q} className="col-span-2"><Input value={q.vehicle.finition} onChange={(e) => setVeh({ finition: e.target.value })} /></Field>
                  <Field label="Puissance (ch)" q={q} flagKey="puissance"><NumInput value={q.vehicle.powerHp} onChange={(v) => setVeh({ powerHp: v })} /></Field>
                  <Field label="CV fiscaux" q={q}><NumInput value={q.vehicle.fiscalHp} onChange={(v) => setVeh({ fiscalHp: v })} /></Field>
                  <Field label="CO2 (g/km)" q={q}><NumInput value={q.vehicle.co2} onChange={(v) => setVeh({ co2: v })} /></Field>
                  <Field label="Éco-score (abattement AEN 70 %)" q={q} flagKey="ecoscore">
                    <select className={SELECT_CLS} value={q.vehicle.ecoScoreOk == null ? "auto" : q.vehicle.ecoScoreOk ? "oui" : "non"} onChange={(e) => setVeh({ ecoScoreOk: e.target.value === "auto" ? null : e.target.value === "oui" })}>
                      <option value="auto">Selon le catalogue Beev</option>
                      <option value="oui">Oui, éco-scoré</option>
                      <option value="non">Non</option>
                    </select>
                  </Field>
                </div>
                <Field label="Véhicule du catalogue Beev" q={q}>
                  <select className={SELECT_CLS} value={chosenId} onChange={(e) => setChoice((c) => ({ ...c, [q.id]: e.target.value }))}>
                    <option value="">Choisir…</option>
                    {matches.length > 0 && (
                      <optgroup label="Correspondances">
                        {matches.map(({ vehicle: v }) => <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.version}</option>)}
                      </optgroup>
                    )}
                    <optgroup label="Tout le catalogue">
                      {[...vehicles].sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`)).map((v) => <option key={`all-${v.id}`} value={v.id}>{v.brand} {v.model} · {v.version}</option>)}
                    </optgroup>
                  </select>
                </Field>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold">Prix, contrat et loyer</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Prix catalogue TTC (€)" q={q} flagKey="prix"><NumInput value={q.price.catalogueTtc} onChange={(v) => setPrice({ catalogueTtc: v })} /></Field>
                  <Field label="Options TTC (€)" q={q}><NumInput value={q.price.optionsTtc} onChange={(v) => setPrice({ optionsTtc: v })} /></Field>
                  <Field label="Catalogue + options TTC (€)" q={q} className="col-span-2"><NumInput value={q.price.totalTtc} onChange={(v) => setPrice({ totalTtc: v })} placeholder="si le devis ne sépare pas les deux" /></Field>
                  <Field label="Durée (mois)" q={q} flagKey="contrat"><NumInput value={q.contract.months || null} onChange={(v) => setCt({ months: v ?? 0 })} step="1" /></Field>
                  <Field label="Kilométrage du contrat" q={q}><NumInput value={q.contract.km || null} onChange={(v) => setCt({ km: v ?? 0 })} step="1000" /></Field>
                  <Field label="Loyer mensuel TTC (€)" q={q} flagKey="loyer"><NumInput value={q.rent.totalTtc || null} onChange={(v) => update((x) => ({ ...x, rent: { ...x.rent, totalTtc: v ?? 0 } }))} /></Field>
                  <Field label="Km supplémentaire (€/km)" q={q} flagKey="kmSupp"><NumInput value={q.contract.kmSuppTtc} onChange={(v) => setCt({ kmSuppTtc: v })} /></Field>
                  <Field label="1er loyer majoré (€)" q={q} flagKey="apport"><NumInput value={q.downPayment.amount || null} onChange={(v) => setDp({ amount: v ?? 0 })} /></Field>
                  <Field label="Prime CEE (€)" q={q}><NumInput value={q.downPayment.ceePrime || null} onChange={(v) => setDp({ ceePrime: v ?? 0 })} /></Field>
                </div>
                {q.rent.lines.length > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1" aria-label="Décomposition du loyer lue sur le devis">
                    {q.rent.lines.map((l, i) => (
                      <div key={i} className="flex justify-between gap-3"><span>{l.label}{l.derived ? " (déduit)" : ""}</span><span className="tabular-nums font-medium">{eur2(l.amount)}</span></div>
                    ))}
                    <div className={`flex justify-between gap-3 border-t pt-1 ${Math.abs(rentLinesSum(q) - q.rent.totalTtc) > 0.05 ? "text-amber-700 font-semibold" : "text-muted-foreground"}`}>
                      <span>Somme des lignes</span><span className="tabular-nums">{eur2(rentLinesSum(q))}</span>
                    </div>
                    {assuranceMonthly(q) > 0 && <div className="flex justify-between gap-3 text-muted-foreground"><span>dont assurance</span><span className="tabular-nums">{eur2(assuranceMonthly(q))}</span></div>}
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold">Prestations du loyer</h3>
                <div className="grid grid-cols-2 gap-3">
                  {SCOPE_LABELS.map(([k, label]) => (
                    <Field key={k} label={label} q={q}>
                      <select className={SELECT_CLS} value={q.scope[k] == null ? "?" : String(q.scope[k])} onChange={(e) => setScope(k, e.target.value === "?" ? null : (Number(e.target.value) as ScopeValue))}>
                        <option value="1">Inclus</option>
                        <option value="0">Exclu / non proposé</option>
                        <option value="?">À confirmer</option>
                      </select>
                    </Field>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Devis Beev */}
            <div className="space-y-3 min-w-0">
              <div className="rounded-xl border bg-card p-3 flex items-center gap-2 flex-wrap">
                <Button size="sm" disabled={!ready} onClick={() => void printLeaserQuote(q, renderOpts())} className="gap-1.5" title={ready ? "Ouvre le devis Beev prêt à enregistrer en PDF" : "Confirmez les points à vérifier"}>
                  <FileDown className="w-3.5 h-3.5" /> Télécharger le PDF
                </Button>
                <Button size="sm" variant="outline" disabled={!ready || !chosen} onClick={handleAdd} className="gap-1.5" title={chosen ? "Crée la ligne dans le devis en cours" : "Choisissez le véhicule du catalogue"}>
                  <FilePlus2 className="w-3.5 h-3.5" /> Ajouter au devis en cours
                </Button>
                {canSaveOffer && (
                  <Button size="sm" variant="ghost" disabled={!ready || !chosen || createOffer.isPending} onClick={() => void handleSaveOffer()} className="gap-1.5" title="Mémorise ce loyer comme offre loueur du véhicule">
                    <Save className="w-3.5 h-3.5" /> Enregistrer l'offre loueur
                  </Button>
                )}
                {!ready && <span className="text-xs text-muted-foreground">{blockers.length > 0 ? `${blockers.length} point(s) à confirmer` : "Loyer, durée et véhicule requis"}</span>}
                {ready && !chosen && <span className="text-xs text-muted-foreground">Choisissez le véhicule du catalogue pour l'ajouter au devis.</span>}
                {ready && chosen && <span className="text-xs text-muted-foreground tabular-nums">Apport net {eur2(netDownPayment(q))} · {kmPerYear(q).toLocaleString("fr-FR")} km / an</span>}
              </div>
              <div className="lq-wrap rounded-xl border bg-white overflow-hidden shadow-sm">
                <style>{LEASER_QUOTE_CSS}</style>
                <article className="lq-paper" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
