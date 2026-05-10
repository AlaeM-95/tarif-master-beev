import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, FileDown, RotateCcw, Plus, Zap, Battery, Gauge, Settings2 } from "lucide-react";
import { useChargers, useEnergy, useVehicles, fmtEur, type EnergyParams } from "@/lib/store";
import { computeTco, generateProposalPdf, type SelectedCharger, type SelectedVehicle } from "@/lib/pdf";
import { VEHICLE_SERVICES, type Charger, type LineItem, type Vehicle } from "@/lib/catalog";

export const Route = createFileRoute("/")({
  component: App,
  head: () => ({
    meta: [
      { title: "Beev · Générateur d'offre commerciale grand compte" },
      { name: "description", content: "Outil interne Beev pour créer des offres B2B PDF : véhicules électriques avec TCO, bornes site par site." },
    ],
  }),
});

function App() {
  const { vehicles, update: updateVehicle, reset: resetVehicles } = useVehicles();
  const { chargers, update: updateCharger, reset: resetChargers } = useChargers();
  const { energy, set: setEnergy, reset: resetEnergy } = useEnergy();

  const [selectedV, setSelectedV] = useState<Record<string, SelectedVehicle>>({});
  const [selectedC, setSelectedC] = useState<Record<string, SelectedCharger>>({});

  const [client, setClient] = useState({
    company: "",
    contact: "",
    email: "",
    salesRep: "",
    salesRepEmail: "",
    salesRepPhone: "",
    date: new Date().toLocaleDateString("fr-FR"),
    notes: "Offre valable 30 jours. Tarifs HT et TTC sous réserve de disponibilité constructeur, d'évolution de la fiscalité applicable et d'acceptation par la direction des risques du loueur. TCO indicatif, calculé hors malus.",
  });

  const totals = useMemo(() => {
    const v = Object.values(selectedV);
    const c = Object.values(selectedC);
    const monthly = v.reduce((s, x) => s + x.negotiatedMonthly * x.quantity, 0);
    const upfront = v.reduce((s, x) => s + x.vehicle.priceTtc * (1 - x.discountPct / 100) * x.quantity, 0);
    const ch = c.reduce((s, x) => s + x.lineItems.reduce((a, li) => a + li.qty * li.unitHt, 0) * x.quantity, 0);
    return { monthly, upfront, chargers: ch, count: v.length + c.length };
  }, [selectedV, selectedC]);

  const toggleV = (v: Vehicle) => {
    setSelectedV((s) => {
      if (s[v.id]) { const { [v.id]: _, ...rest } = s; return rest; }
      return {
        ...s,
        [v.id]: {
          vehicle: v, quantity: 1, discountPct: 0,
          negotiatedMonthly: v.monthlyLld,
          durationMonths: 48, kmPerYear: energy.kmPerYear,
          services: v.services ?? [],
          options: [],
        },
      };
    });
  };
  const toggleC = (c: Charger) => {
    setSelectedC((s) => {
      if (s[c.id]) { const { [c.id]: _, ...rest } = s; return rest; }
      return {
        ...s,
        [c.id]: {
          charger: c, quantity: 1, discountPct: 0, installIncluded: true,
          siteName: "", siteAddress: "", siteContact: "",
          lineItems: c.defaultLineItems ? c.defaultLineItems.map(x => ({ ...x })) : [
            { label: `${c.brand} ${c.model}`, qty: 1, unitHt: c.priceHt },
            { label: "Pose & raccordement IRVE", qty: 1, unitHt: c.installPriceHt },
          ],
        },
      };
    });
  };

  const exportPdf = async () => {
    if (!client.company) { alert("Renseignez au moins le nom de la société client."); return; }
    await generateProposalPdf({
      client, energy,
      vehicles: Object.values(selectedV),
      chargers: Object.values(selectedC),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-primary text-primary-foreground font-bold text-xl">B</div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Beev · Offre commerciale grand compte</h1>
              <p className="text-xs text-muted-foreground">Catalogue véhicules + bornes · TCO · génération PDF B2B</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">{totals.count} ligne{totals.count > 1 ? "s" : ""}</Badge>
            <Button onClick={exportPdf} disabled={totals.count === 0} className="gap-2">
              <FileDown className="w-4 h-4" /> Générer le PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-8">
          <ClientCard client={client} setClient={setClient} />
          <EnergyCard energy={energy} setEnergy={setEnergy} reset={resetEnergy} />

          <Tabs defaultValue="vehicles">
            <TabsList>
              <TabsTrigger value="vehicles">Véhicules ({vehicles.length})</TabsTrigger>
              <TabsTrigger value="chargers">Bornes ({chargers.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="vehicles" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Catalogue synchronisé avec le calculateur TCO Beev. Tu peux modifier prix/loyer/spec puis sélectionner.</p>
                <Button variant="ghost" size="sm" onClick={resetVehicles} className="gap-2">
                  <RotateCcw className="w-3 h-3" /> Réinitialiser
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {vehicles.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} selected={!!selectedV[v.id]}
                    onToggle={() => toggleV(v)} onUpdate={(p) => updateVehicle(v.id, p)} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="chargers" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Devis détaillé site par site (matériel + IRVE). Utilise Alfen Eve Double Pro-line pour le standard pro.</p>
                <Button variant="ghost" size="sm" onClick={resetChargers} className="gap-2">
                  <RotateCcw className="w-3 h-3" /> Réinitialiser
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {chargers.map((c) => (
                  <ChargerCard key={c.id} charger={c} selected={!!selectedC[c.id]}
                    onToggle={() => toggleC(c)} onUpdate={(p) => updateCharger(c.id, p)} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="lg:sticky lg:top-24 self-start space-y-4 max-h-[calc(100vh-7rem)] overflow-auto">
          <Card>
            <CardHeader><CardTitle className="text-base">Sélection en cours</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {totals.count === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun produit sélectionné.</p>
              ) : (
                <>
                  {Object.values(selectedV).map((sv) => (
                    <SelectedVehicleRow key={sv.vehicle.id} sv={sv} energy={energy}
                      onChange={(p) => setSelectedV((s) => ({ ...s, [sv.vehicle.id]: { ...sv, ...p } }))}
                      onRemove={() => toggleV(sv.vehicle)} />
                  ))}
                  {Object.values(selectedC).map((sc) => (
                    <SelectedChargerRow key={sc.charger.id} sc={sc}
                      onChange={(p) => setSelectedC((s) => ({ ...s, [sc.charger.id]: { ...sc, ...p } }))}
                      onRemove={() => toggleC(sc.charger)} />
                  ))}

                  <Separator />
                  <div className="space-y-1.5 text-sm">
                    <Row k="Loyer global HT" v={`${fmtEur(totals.monthly)} / mois`} />
                    <Row k="Achat véhicules TTC" v={fmtEur(totals.upfront)} />
                    <Row k="Bornes + IRVE HT" v={fmtEur(totals.chargers)} />
                  </div>
                  <Button onClick={exportPdf} className="w-full gap-2">
                    <FileDown className="w-4 h-4" /> Télécharger l'offre
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="font-medium tabular-nums">{v}</span></div>;
}

function ClientCard({ client, setClient }: { client: any; setClient: (c: any) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Informations client & commercial</CardTitle></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Société *"><Input value={client.company} onChange={(e) => setClient({ ...client, company: e.target.value })} placeholder="Ex. BIG France" /></Field>
        <Field label="Contact client"><Input value={client.contact} onChange={(e) => setClient({ ...client, contact: e.target.value })} placeholder="Nom Prénom" /></Field>
        <Field label="Email client"><Input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /></Field>
        <Field label="Date"><Input value={client.date} onChange={(e) => setClient({ ...client, date: e.target.value })} /></Field>
        <Field label="Commercial Beev"><Input value={client.salesRep} onChange={(e) => setClient({ ...client, salesRep: e.target.value })} placeholder="Alaé Mahmoudi" /></Field>
        <Field label="Email commercial"><Input value={client.salesRepEmail} onChange={(e) => setClient({ ...client, salesRepEmail: e.target.value })} placeholder="alae@beev.co" /></Field>
        <Field label="Téléphone commercial"><Input value={client.salesRepPhone} onChange={(e) => setClient({ ...client, salesRepPhone: e.target.value })} placeholder="+33 6 ..." /></Field>
        <Field label="Notes & conditions" className="sm:col-span-2">
          <Textarea rows={3} value={client.notes} onChange={(e) => setClient({ ...client, notes: e.target.value })} />
        </Field>
      </CardContent>
    </Card>
  );
}

function EnergyCard({ energy, setEnergy, reset }: { energy: EnergyParams; setEnergy: (e: EnergyParams) => void; reset: () => void }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">Paramètres TCO & énergie</CardTitle>
        </div>
        <Button variant="ghost" size="sm" onClick={reset} className="gap-2"><RotateCcw className="w-3 h-3" /> Reset</Button>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <NumField label="Durée (années)" value={energy.durationYears} onChange={(n) => setEnergy({ ...energy, durationYears: n })} />
        <NumField label="Km / an" value={energy.kmPerYear} onChange={(n) => setEnergy({ ...energy, kmPerYear: n })} />
        <NumField label="Essence €/L" value={energy.fuelPriceL} onChange={(n) => setEnergy({ ...energy, fuelPriceL: n })} step={0.01} />
        <NumField label="kWh domicile €" value={energy.kWhHome} onChange={(n) => setEnergy({ ...energy, kWhHome: n })} step={0.01} />
        <NumField label="kWh public €" value={energy.kWhPublic} onChange={(n) => setEnergy({ ...energy, kWhPublic: n })} step={0.01} />
        <NumField label="Mix domicile %" value={energy.mixHomePct} onChange={(n) => setEnergy({ ...energy, mixHomePct: n })} />
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className}`}><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function VehicleCard({ vehicle, selected, onToggle, onUpdate }: { vehicle: Vehicle; selected: boolean; onToggle: () => void; onUpdate: (p: Partial<Vehicle>) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <Card className={`overflow-hidden transition-all ${selected ? "ring-2 ring-primary" : "hover:shadow-md"}`}>
      <div className="aspect-video bg-muted overflow-hidden">
        <img src={vehicle.image} alt={`${vehicle.brand} ${vehicle.model}`} className="w-full h-full object-cover" loading="lazy" />
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold leading-tight">{vehicle.brand} {vehicle.model}</h3>
              <Badge variant="secondary" className="text-[10px]">{vehicle.energy}</Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{vehicle.version}</p>
          </div>
          <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-1" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <Spec icon={<Gauge className="w-3 h-3" />} v={vehicle.rangeWltp ? `${vehicle.rangeWltp} km` : `${vehicle.co2} g/km`} />
          <Spec icon={<Battery className="w-3 h-3" />} v={vehicle.batteryKwh ? `${vehicle.batteryKwh} kWh` : "—"} />
          <Spec icon={<Zap className="w-3 h-3" />} v={`${vehicle.powerHp} ch`} />
        </div>
        <div className="flex items-end justify-between pt-1">
          <div>
            <p className="text-xs text-muted-foreground">À partir de</p>
            <p className="font-semibold">{fmtEur(vehicle.priceTtc)} <span className="text-xs text-muted-foreground">TTC</span></p>
            <p className="text-xs text-primary font-medium">{fmtEur(vehicle.monthlyLld)} HT/mois</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)}>{editing ? "OK" : "Éditer"}</Button>
        </div>
        {editing && (
          <div className="space-y-2 pt-2 border-t">
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Prix TTC" value={vehicle.priceTtc} onChange={(n) => onUpdate({ priceTtc: n })} />
              <NumField label="LLD €/mois" value={vehicle.monthlyLld} onChange={(n) => onUpdate({ monthlyLld: n })} />
              <NumField label="Autonomie km" value={vehicle.rangeWltp} onChange={(n) => onUpdate({ rangeWltp: n })} />
              <NumField label="Batterie kWh" value={vehicle.batteryKwh} onChange={(n) => onUpdate({ batteryKwh: n })} />
              <NumField label="Puissance ch" value={vehicle.powerHp} onChange={(n) => onUpdate({ powerHp: n })} />
              <NumField label="Conso" value={vehicle.consumption} onChange={(n) => onUpdate({ consumption: n })} step={0.1} />
              <NumField label="CO₂ g/km" value={vehicle.co2} onChange={(n) => onUpdate({ co2: n })} />
              <NumField label="CV fiscaux" value={vehicle.fiscalHp} onChange={(n) => onUpdate({ fiscalHp: n })} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">Image (URL)</Label>
              <Input value={vehicle.image} onChange={(e) => onUpdate({ image: e.target.value })} className="h-8 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TxtField label="Version" value={vehicle.version} onChange={(s) => onUpdate({ version: s })} />
              <TxtField label="Catégorie" value={vehicle.category} onChange={(s) => onUpdate({ category: s })} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChargerCard({ charger, selected, onToggle, onUpdate }: { charger: Charger; selected: boolean; onToggle: () => void; onUpdate: (p: Partial<Charger>) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <Card className={`overflow-hidden transition-all ${selected ? "ring-2 ring-primary" : "hover:shadow-md"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold leading-tight">{charger.brand} {charger.model}</h3>
              <Badge variant="secondary" className="text-[10px]">{charger.powerKw} kW</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{charger.type}</p>
          </div>
          <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-1" />
        </div>
        <ul className="text-xs text-muted-foreground space-y-1">
          {charger.features.slice(0, 4).map((f) => <li key={f} className="flex gap-1.5"><Plus className="w-3 h-3 mt-0.5 text-primary" />{f}</li>)}
        </ul>
        <div className="flex items-end justify-between pt-1">
          <div>
            <p className="text-xs text-muted-foreground">Borne HT</p>
            <p className="font-semibold">{fmtEur(charger.priceHt)}</p>
            <p className="text-xs text-primary">+ pose ~{fmtEur(charger.installPriceHt)} HT</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)}>{editing ? "OK" : "Éditer"}</Button>
        </div>
        {editing && (
          <div className="space-y-2 pt-2 border-t">
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Prix borne HT" value={charger.priceHt} onChange={(n) => onUpdate({ priceHt: n })} />
              <NumField label="Pose HT (réf.)" value={charger.installPriceHt} onChange={(n) => onUpdate({ installPriceHt: n })} />
              <NumField label="Puissance kW" value={charger.powerKw} onChange={(n) => onUpdate({ powerKw: n })} />
              <TxtField label="Type" value={charger.type} onChange={(s) => onUpdate({ type: s })} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">Image (URL)</Label>
              <Input value={charger.image} onChange={(e) => onUpdate({ image: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NumField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">{label}</Label><Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8" /></div>;
}
function TxtField({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  return <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">{label}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" /></div>;
}
function Spec({ icon, v }: { icon: React.ReactNode; v: string }) {
  return <div className="flex items-center gap-1">{icon}<span>{v}</span></div>;
}

// ============ SELECTED ROWS ============

function SelectedVehicleRow({ sv, energy, onChange, onRemove }: { sv: SelectedVehicle; energy: EnergyParams; onChange: (p: Partial<SelectedVehicle>) => void; onRemove: () => void }) {
  const [tab, setTab] = useState<"none" | "svc" | "opt">("none");
  const tco = computeTco(sv, energy);
  const toggleSvc = (s: string) => {
    const next = sv.services.includes(s) ? sv.services.filter((x) => x !== s) : [...sv.services, s];
    onChange({ services: next });
  };
  const setOpt = (i: number, p: Partial<LineItem>) => onChange({ options: sv.options.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const addOpt = () => onChange({ options: [...sv.options, { label: "Nouvelle option", qty: 1, unitHt: 0 }] });
  const delOpt = (i: number) => onChange({ options: sv.options.filter((_, idx) => idx !== i) });

  return (
    <div className="rounded-lg border bg-secondary/40 p-3 space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{sv.vehicle.brand} {sv.vehicle.model}</p>
          <p className="text-xs text-muted-foreground truncate">{sv.vehicle.version}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}><Trash2 className="w-3 h-3" /></Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumField label="Quantité" value={sv.quantity} onChange={(n) => onChange({ quantity: n })} />
        <NumField label="Remise %" value={sv.discountPct} onChange={(n) => onChange({ discountPct: n })} step={0.5} />
        <NumField label="LLD €/mois" value={sv.negotiatedMonthly} onChange={(n) => onChange({ negotiatedMonthly: n })} />
        <NumField label="Durée mois" value={sv.durationMonths} onChange={(n) => onChange({ durationMonths: n })} />
      </div>
      <div className="rounded-md bg-card p-2 text-[11px] grid grid-cols-3 gap-1">
        <div><div className="text-muted-foreground">Loyer/100km</div><div className="font-semibold">{tco.lease100.toFixed(2)} €</div></div>
        <div><div className="text-muted-foreground">Énergie/100km</div><div className="font-semibold">{tco.energy100.toFixed(2)} €</div></div>
        <div><div className="text-muted-foreground">TCO/100km</div><div className="font-semibold text-primary">{tco.tco100.toFixed(2)} €</div></div>
      </div>
      <div className="flex gap-1">
        <button type="button" onClick={() => setTab(tab === "svc" ? "none" : "svc")} className="flex-1 text-xs px-2 py-1.5 rounded-md border bg-card hover:bg-accent/40">Prestations · {sv.services.length}</button>
        <button type="button" onClick={() => setTab(tab === "opt" ? "none" : "opt")} className="flex-1 text-xs px-2 py-1.5 rounded-md border bg-card hover:bg-accent/40">Options · {sv.options.length}</button>
      </div>
      {tab === "svc" && (
        <div className="rounded-md border bg-card p-2 max-h-52 overflow-auto space-y-1">
          {VEHICLE_SERVICES.map((s) => (
            <label key={s} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-accent/30 rounded px-1.5 py-1">
              <Checkbox checked={sv.services.includes(s)} onCheckedChange={() => toggleSvc(s)} className="mt-0.5" />
              <span className="leading-tight">{s}</span>
            </label>
          ))}
        </div>
      )}
      {tab === "opt" && (
        <div className="rounded-md border bg-card p-2 space-y-2">
          {sv.options.map((o, i) => (
            <div key={i} className="grid grid-cols-[1fr_50px_70px_24px] gap-1 items-center">
              <Input value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} className="h-7 text-xs" />
              <Input type="number" value={o.qty} onChange={(e) => setOpt(i, { qty: Number(e.target.value) })} className="h-7 text-xs" />
              <Input type="number" value={o.unitHt} onChange={(e) => setOpt(i, { unitHt: Number(e.target.value) })} className="h-7 text-xs" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => delOpt(i)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addOpt} className="w-full gap-1 h-7 text-xs"><Plus className="w-3 h-3" /> Ajouter une option</Button>
        </div>
      )}
    </div>
  );
}

function SelectedChargerRow({ sc, onChange, onRemove }: { sc: SelectedCharger; onChange: (p: Partial<SelectedCharger>) => void; onRemove: () => void }) {
  const [openLi, setOpenLi] = useState(false);
  const setLi = (i: number, p: Partial<LineItem>) => onChange({ lineItems: sc.lineItems.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const addLi = () => onChange({ lineItems: [...sc.lineItems, { label: "Nouvelle ligne", qty: 1, unitHt: 0 }] });
  const delLi = (i: number) => onChange({ lineItems: sc.lineItems.filter((_, idx) => idx !== i) });
  const total = sc.lineItems.reduce((a, li) => a + li.qty * li.unitHt, 0);

  return (
    <div className="rounded-lg border bg-secondary/30 p-3 space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{sc.charger.brand} {sc.charger.model}</p>
          <p className="text-xs text-muted-foreground">{sc.charger.powerKw} kW · {fmtEur(total)} HT</p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}><Trash2 className="w-3 h-3" /></Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TxtField label="Site (nom)" value={sc.siteName} onChange={(s) => onChange({ siteName: s })} />
        <TxtField label="Contact site" value={sc.siteContact} onChange={(s) => onChange({ siteContact: s })} />
        <div className="col-span-2"><TxtField label="Adresse" value={sc.siteAddress} onChange={(s) => onChange({ siteAddress: s })} /></div>
        <NumField label="Quantité bornes" value={sc.quantity} onChange={(n) => onChange({ quantity: n })} />
        <NumField label="Remise %" value={sc.discountPct} onChange={(n) => onChange({ discountPct: n })} step={0.5} />
      </div>
      <button type="button" onClick={() => setOpenLi((o) => !o)} className="w-full text-xs px-2 py-1.5 rounded-md border bg-card hover:bg-accent/40 flex justify-between">
        <span>Devis détaillé · {sc.lineItems.length} lignes</span><span>{openLi ? "▴" : "▾"}</span>
      </button>
      {openLi && (
        <div className="rounded-md border bg-card p-2 space-y-2">
          {sc.lineItems.map((li, i) => (
            <div key={i} className="grid grid-cols-[1fr_50px_70px_24px] gap-1 items-center">
              <Input value={li.label} onChange={(e) => setLi(i, { label: e.target.value })} className="h-7 text-xs" />
              <Input type="number" value={li.qty} onChange={(e) => setLi(i, { qty: Number(e.target.value) })} className="h-7 text-xs" />
              <Input type="number" value={li.unitHt} onChange={(e) => setLi(i, { unitHt: Number(e.target.value) })} className="h-7 text-xs" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => delLi(i)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addLi} className="w-full gap-1 h-7 text-xs"><Plus className="w-3 h-3" /> Ajouter une ligne</Button>
        </div>
      )}
    </div>
  );
}
