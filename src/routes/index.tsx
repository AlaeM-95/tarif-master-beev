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
import { Switch } from "@/components/ui/switch";
import { Trash2, FileDown, RotateCcw, Plus, Zap, Battery, Gauge, Settings2, Presentation, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useChargers, useEnergy, useVehicles, fmtEur, type EnergyParams } from "@/lib/store";
import { computeTco, generateProposalPdf, type SelectedCharger, type SelectedVehicle } from "@/lib/pdf";
import { MANDATORY_SERVICES, type Charger, type ChargerDeployment, type LineItem, type Vehicle } from "@/lib/catalog";

export const Route = createFileRoute("/")({
  component: App,
  head: () => ({
    meta: [
      { title: "Beev · Générateur d'offre commerciale grand compte" },
      { name: "description", content: "Outil interne Beev : véhicules + bornes (domicile / site), TCO par véhicule, vue présentation et PDF B2B." },
    ],
  }),
});

function App() {
  const { vehicles, update: updateVehicle, reset: resetVehicles } = useVehicles();
  const { chargers, update: updateCharger, reset: resetChargers } = useChargers();
  const { energy, set: setEnergy, reset: resetEnergy } = useEnergy();

  const [selectedV, setSelectedV] = useState<Record<string, SelectedVehicle>>({});
  const [selectedC, setSelectedC] = useState<Record<string, SelectedCharger>>({});
  const [presenting, setPresenting] = useState(false);

  const [client, setClient] = useState({
    company: "", contact: "", email: "",
    salesRep: "", salesRepEmail: "", salesRepPhone: "",
    date: new Date().toLocaleDateString("fr-FR"),
    notes: "Offre valable 30 jours. Tarifs TTC sous réserve de disponibilité constructeur, d'évolution de la fiscalité applicable et d'acceptation par la direction des risques du loueur. TCO indicatif, calculé hors malus.",
  });

  const counts = useMemo(() => ({
    v: Object.keys(selectedV).length,
    c: Object.keys(selectedC).length,
  }), [selectedV, selectedC]);

  const toggleV = (v: Vehicle) => {
    setSelectedV((s) => {
      if (s[v.id]) { const { [v.id]: _, ...rest } = s; return rest; }
      return {
        ...s,
        [v.id]: {
          vehicle: v, quantity: 1, discountPct: 0,
          negotiatedMonthly: v.monthlyLld,
          durationMonths: 48, kmPerYear: energy.kmPerYear,
          includeTco: false,
          services: [],
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

  const chargersHome = chargers.filter((c) => c.deployment === "domicile");
  const chargersSite = chargers.filter((c) => c.deployment === "site");

  if (presenting) {
    return <PresentationMode
      client={client} energy={energy}
      vehicles={Object.values(selectedV)}
      chargers={Object.values(selectedC)}
      onClose={() => setPresenting(false)}
      onExport={exportPdf}
    />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-primary text-primary-foreground font-bold text-xl">B</div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Beev · Offre commerciale grand compte</h1>
              <p className="text-xs text-muted-foreground">Véhicules · Bornes domicile & site · TCO · Présentation & PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">{counts.v} véh. · {counts.c} borne(s)</Badge>
            <Button variant="outline" onClick={() => setPresenting(true)} disabled={counts.v + counts.c === 0} className="gap-2">
              <Presentation className="w-4 h-4" /> Présenter au client
            </Button>
            <Button onClick={exportPdf} disabled={counts.v + counts.c === 0} className="gap-2">
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
              <TabsTrigger value="home">Bornes domicile ({chargersHome.length})</TabsTrigger>
              <TabsTrigger value="site">Bornes site entreprise ({chargersSite.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="vehicles" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Catalogue synchronisé avec le calculateur TCO Beev. Loyers exprimés en TTC.</p>
                <Button variant="ghost" size="sm" onClick={resetVehicles} className="gap-2"><RotateCcw className="w-3 h-3" /> Réinitialiser</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {vehicles.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} selected={!!selectedV[v.id]}
                    onToggle={() => toggleV(v)} onUpdate={(p) => updateVehicle(v.id, p)} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="home" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Catalogue B2B2E — kit collaborateur clé en main (pose 0–10 m incluse). Modèles V2C & Hager.</p>
                <Button variant="ghost" size="sm" onClick={resetChargers} className="gap-2"><RotateCcw className="w-3 h-3" /> Réinitialiser</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {chargersHome.map((c) => (
                  <ChargerCard key={c.id} charger={c} selected={!!selectedC[c.id]}
                    onToggle={() => toggleC(c)} onUpdate={(p) => updateCharger(c.id, p)} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="site" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Catalogue site entreprise — devis détaillé site par site (matériel + IRVE + génie civil).</p>
                <Button variant="ghost" size="sm" onClick={resetChargers} className="gap-2"><RotateCcw className="w-3 h-3" /> Réinitialiser</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {chargersSite.map((c) => (
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
              {counts.v + counts.c === 0 ? (
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
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setPresenting(true)} className="gap-2">
                      <Presentation className="w-4 h-4" /> Présenter
                    </Button>
                    <Button onClick={exportPdf} className="gap-2">
                      <FileDown className="w-4 h-4" /> PDF
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
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
          <CardTitle className="text-base">Paramètres TCO & énergie (par défaut)</CardTitle>
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
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">Chaque véhicule peut ensuite avoir sa propre durée, son propre kilométrage et son propre TCO (à activer dans le panneau de droite).</p>
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
            <p className="text-xs text-primary font-medium">{fmtEur(vehicle.monthlyLld)} TTC/mois</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)}>{editing ? "OK" : "Éditer"}</Button>
        </div>
        {editing && (
          <div className="space-y-2 pt-2 border-t">
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Prix TTC" value={vehicle.priceTtc} onChange={(n) => onUpdate({ priceTtc: n })} />
              <NumField label="LLD €/mois TTC" value={vehicle.monthlyLld} onChange={(n) => onUpdate({ monthlyLld: n })} />
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
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold leading-tight">{charger.brand} {charger.model}</h3>
              <Badge variant="secondary" className="text-[10px]">{charger.powerKw} kW</Badge>
              <Badge variant="outline" className="text-[10px]">{charger.deployment === "domicile" ? "Domicile" : "Site"}</Badge>
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
            <p className="text-xs text-muted-foreground">{charger.deployment === "domicile" ? "Forfait clé en main HT" : "Borne HT"}</p>
            <p className="font-semibold">{fmtEur(charger.priceHt)}</p>
            {charger.installPriceHt > 0 && <p className="text-xs text-primary">+ pose ~{fmtEur(charger.installPriceHt)} HT</p>}
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
  const [newSvc, setNewSvc] = useState("");
  const tco = computeTco(sv, energy);
  const addSvc = () => {
    const t = newSvc.trim();
    if (!t) return;
    onChange({ services: [...sv.services, t] });
    setNewSvc("");
  };
  const delSvc = (i: number) => onChange({ services: sv.services.filter((_, idx) => idx !== i) });
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
        <NumField label="Loyer TTC/mois" value={sv.negotiatedMonthly} onChange={(n) => onChange({ negotiatedMonthly: n })} />
        <NumField label="Durée (mois)" value={sv.durationMonths} onChange={(n) => onChange({ durationMonths: n })} />
        <NumField label="Km / an" value={sv.kmPerYear} onChange={(n) => onChange({ kmPerYear: n })} />
        <div className="flex items-end gap-2 pb-1">
          <Switch id={`tco-${sv.vehicle.id}`} checked={sv.includeTco} onCheckedChange={(b) => onChange({ includeTco: b })} />
          <Label htmlFor={`tco-${sv.vehicle.id}`} className="text-[11px] leading-tight">Inclure TCO dans la présentation</Label>
        </div>
      </div>
      {sv.includeTco && (
        <div className="rounded-md bg-card p-2 text-[11px] grid grid-cols-3 gap-1">
          <div><div className="text-muted-foreground">Loyer/100km</div><div className="font-semibold">{tco.lease100.toFixed(2)} €</div></div>
          <div><div className="text-muted-foreground">Énergie/100km</div><div className="font-semibold">{tco.energy100.toFixed(2)} €</div></div>
          <div><div className="text-muted-foreground">TCO/100km</div><div className="font-semibold text-primary">{tco.tco100.toFixed(2)} €</div></div>
        </div>
      )}
      <div className="flex gap-1">
        <button type="button" onClick={() => setTab(tab === "svc" ? "none" : "svc")} className="flex-1 text-xs px-2 py-1.5 rounded-md border bg-card hover:bg-accent/40">Prestations · {3 + sv.services.length}</button>
        <button type="button" onClick={() => setTab(tab === "opt" ? "none" : "opt")} className="flex-1 text-xs px-2 py-1.5 rounded-md border bg-card hover:bg-accent/40">Options · {sv.options.length}</button>
      </div>
      {tab === "svc" && (
        <div className="rounded-md border bg-card p-2 space-y-2">
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-muted-foreground">Toujours incluses (non décochables)</p>
            {MANDATORY_SERVICES.map((s) => (
              <div key={s} className="flex items-center gap-2 text-xs">
                <Checkbox checked disabled />
                <span className="leading-tight">{s}</span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-muted-foreground">Prestations additionnelles libres</p>
            {sv.services.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={s} onChange={(e) => onChange({ services: sv.services.map((x, idx) => idx === i ? e.target.value : x) })} className="h-7 text-xs" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => delSvc(i)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
            <div className="flex gap-1">
              <Input placeholder="Ex. Pneumatiques hiver inclus" value={newSvc} onChange={(e) => setNewSvc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSvc(); } }} className="h-7 text-xs" />
              <Button size="sm" variant="outline" onClick={addSvc} className="h-7 px-2"><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
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
  const isHome = sc.charger.deployment === "domicile";

  return (
    <div className="rounded-lg border bg-secondary/30 p-3 space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{sc.charger.brand} {sc.charger.model}</p>
          <p className="text-xs text-muted-foreground">{isHome ? "Domicile collaborateur" : "Site entreprise"} · {sc.charger.powerKw} kW · {fmtEur(total)} HT</p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}><Trash2 className="w-3 h-3" /></Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TxtField label={isHome ? "Collaborateur" : "Site (nom)"} value={sc.siteName} onChange={(s) => onChange({ siteName: s })} />
        <TxtField label="Contact" value={sc.siteContact} onChange={(s) => onChange({ siteContact: s })} />
        <div className="col-span-2"><TxtField label="Adresse" value={sc.siteAddress} onChange={(s) => onChange({ siteAddress: s })} /></div>
        <NumField label={isHome ? "Nb collab." : "Quantité bornes"} value={sc.quantity} onChange={(n) => onChange({ quantity: n })} />
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

// ============ PRESENTATION MODE (vue client plein écran) ============

type Slide =
  | { kind: "cover" }
  | { kind: "vehicle"; sv: SelectedVehicle }
  | { kind: "chargers-home"; items: SelectedCharger[] }
  | { kind: "chargers-site"; items: SelectedCharger[] };

function PresentationMode({ client, energy, vehicles, chargers, onClose, onExport }: {
  client: any; energy: EnergyParams;
  vehicles: SelectedVehicle[]; chargers: SelectedCharger[];
  onClose: () => void; onExport: () => void;
}) {
  const slides: Slide[] = useMemo(() => {
    const s: Slide[] = [{ kind: "cover" }];
    vehicles.forEach((sv) => s.push({ kind: "vehicle", sv }));
    const home = chargers.filter((c) => c.charger.deployment === "domicile");
    const site = chargers.filter((c) => c.charger.deployment === "site");
    if (home.length) s.push({ kind: "chargers-home", items: home });
    if (site.length) s.push({ kind: "chargers-site", items: site });
    return s;
  }, [vehicles, chargers]);

  const [i, setI] = useState(0);
  const slide = slides[i];

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground font-bold grid place-content-center">B</div>
            <div>
              <p className="text-sm font-semibold">Beev × {client.company || "Votre entreprise"}</p>
              <p className="text-xs text-muted-foreground">Mode présentation · {i + 1}/{slides.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="gap-1"><ChevronLeft className="w-4 h-4" /> Préc.</Button>
            <Button variant="outline" size="sm" onClick={() => setI(Math.min(slides.length - 1, i + 1))} disabled={i === slides.length - 1} className="gap-1">Suiv. <ChevronRight className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={onExport} className="gap-2"><FileDown className="w-4 h-4" /> PDF</Button>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-8 py-12">
        {slide.kind === "cover" && <CoverSlide client={client} nbV={vehicles.length} nbC={chargers.length} />}
        {slide.kind === "vehicle" && <VehicleSlide sv={slide.sv} energy={energy} />}
        {slide.kind === "chargers-home" && <ChargersSlide title="Bornes domicile collaborateurs" subtitle="Kit B2B2E clé en main · pose 0–10 m incluse" items={slide.items} />}
        {slide.kind === "chargers-site" && <ChargersSlide title="Bornes site entreprise" subtitle="Déploiement IRVE · matériel + génie civil" items={slide.items} />}
      </main>
    </div>
  );
}

function CoverSlide({ client, nbV, nbC }: { client: any; nbV: number; nbC: number }) {
  return (
    <div className="max-w-4xl mx-auto py-12">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Offre commerciale · {client.date}</p>
      <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">Beev × {client.company || "Votre entreprise"}</h1>
      <p className="text-xl text-muted-foreground mb-12">
        {nbV > 0 && nbC > 0 ? "Véhicules électriques & infrastructure de recharge."
          : nbC > 0 ? "Bornes de recharge — déploiement clé en main."
          : "Sélection de véhicules pour votre flotte."}
      </p>
      <Separator className="mb-8" />
      <div className="grid sm:grid-cols-2 gap-8">
        <div>
          <p className="text-xs uppercase text-muted-foreground mb-2">Préparée pour</p>
          <p className="text-2xl font-semibold">{client.company || "—"}</p>
          {client.contact && <p className="text-muted-foreground">{client.contact}</p>}
          {client.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground mb-2">Préparée par</p>
          <p className="text-2xl font-semibold">{client.salesRep || "Beev"}</p>
          {client.salesRepEmail && <p className="text-muted-foreground">{client.salesRepEmail}</p>}
          {client.salesRepPhone && <p className="text-sm text-muted-foreground">{client.salesRepPhone}</p>}
        </div>
      </div>
      <div className="mt-12 grid grid-cols-2 gap-6">
        <div className="border rounded-2xl p-6"><p className="text-5xl font-bold">{nbV}</p><p className="text-sm text-muted-foreground mt-1">véhicule{nbV > 1 ? "s" : ""} étudié{nbV > 1 ? "s" : ""}</p></div>
        <div className="border rounded-2xl p-6"><p className="text-5xl font-bold">{nbC}</p><p className="text-sm text-muted-foreground mt-1">solution{nbC > 1 ? "s" : ""} de recharge</p></div>
      </div>
    </div>
  );
}

function VehicleSlide({ sv, energy }: { sv: SelectedVehicle; energy: EnergyParams }) {
  const v = sv.vehicle;
  const tco = computeTco(sv, energy);
  const services = [...MANDATORY_SERVICES, ...sv.services.filter((s) => !MANDATORY_SERVICES.includes(s as any))];
  return (
    <div className="max-w-6xl mx-auto">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Véhicule</p>
      <h2 className="text-4xl font-bold mb-1">{v.brand} {v.model}</h2>
      <p className="text-lg text-muted-foreground mb-8">{v.version} · {v.category} · {v.energy}</p>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8 mb-8">
        <div className="rounded-2xl overflow-hidden bg-muted aspect-video">
          <img src={v.image} alt={`${v.brand} ${v.model}`} className="w-full h-full object-cover" />
        </div>
        <div className="rounded-2xl bg-primary text-primary-foreground p-8 flex flex-col justify-center">
          <p className="text-xs uppercase opacity-70 mb-2">Loyer mensuel TTC · {sv.durationMonths} mois</p>
          <p className="text-6xl font-bold tracking-tight">{fmtEur(sv.negotiatedMonthly)}</p>
          <p className="text-sm opacity-80 mt-2">× {sv.quantity} véhicule{sv.quantity > 1 ? "s" : ""} · {sv.kmPerYear.toLocaleString("fr-FR")} km/an</p>
          {sv.discountPct > 0 && (
            <p className="text-xs opacity-70 mt-4">Prix catalogue {fmtEur(v.priceTtc)} TTC · remise négociée -{sv.discountPct}%</p>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <p className="text-xs uppercase text-muted-foreground mb-3">Caractéristiques</p>
          <div className="grid grid-cols-2 gap-3">
            <KV k="Énergie" v={v.energy} />
            <KV k="Autonomie WLTP" v={v.rangeWltp ? `${v.rangeWltp} km` : "—"} />
            <KV k="Batterie" v={v.batteryKwh ? `${v.batteryKwh} kWh` : "—"} />
            <KV k="Puissance" v={`${v.powerHp} ch`} />
            <KV k="Conso" v={v.energy === "Électrique" ? `${v.consumption} kWh/100` : `${v.consumption} L/100`} />
            <KV k="CO₂" v={`${v.co2} g/km`} />
          </div>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground mb-3">Prestations comprises dans le loyer</p>
          <ul className="space-y-1.5">
            {services.map((s) => <li key={s} className="text-sm flex gap-2"><span className="text-primary">●</span>{s}</li>)}
          </ul>
          {sv.options.length > 0 && (
            <>
              <p className="text-xs uppercase text-muted-foreground mt-6 mb-3">Options & accessoires</p>
              <ul className="space-y-1.5 text-sm">
                {sv.options.map((o, i) => <li key={i} className="flex justify-between"><span>{o.label}</span><span className="text-muted-foreground">× {o.qty}</span></li>)}
              </ul>
            </>
          )}
        </div>
      </div>

      {sv.includeTco && (
        <div className="mt-8 border-l-4 border-primary bg-secondary/40 p-6 rounded-r-2xl">
          <p className="text-xs uppercase text-muted-foreground mb-3">TCO aux 100 km · {sv.durationMonths} mois · {sv.kmPerYear.toLocaleString("fr-FR")} km/an</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <KPI k="Loyer / 100 km" v={`${tco.lease100.toFixed(2)} €`} />
            <KPI k="Énergie / 100 km" v={`${tco.energy100.toFixed(2)} €`} />
            <KPI k="TCO / 100 km" v={`${tco.tco100.toFixed(2)} €`} highlight />
            <KPI k="vs essence ref." v={tco.economy100 >= 0 ? `+${tco.economy100.toFixed(2)} €` : `${tco.economy100.toFixed(2)} €`} />
          </div>
        </div>
      )}
    </div>
  );
}

function ChargersSlide({ title, subtitle, items }: { title: string; subtitle: string; items: SelectedCharger[] }) {
  return (
    <div className="max-w-6xl mx-auto">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Infrastructure de recharge</p>
      <h2 className="text-4xl font-bold mb-1">{title}</h2>
      <p className="text-lg text-muted-foreground mb-8">{subtitle}</p>

      <div className="space-y-6">
        {items.map((sc) => {
          const total = sc.lineItems.reduce((a, li) => a + li.qty * li.unitHt, 0);
          return (
            <div key={sc.charger.id} className="border rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
                <div>
                  <h3 className="text-2xl font-semibold">{sc.siteName || `${sc.charger.brand} ${sc.charger.model}`}</h3>
                  <p className="text-muted-foreground">{sc.charger.brand} {sc.charger.model} · {sc.charger.powerKw} kW · {sc.charger.type}</p>
                  {sc.siteAddress && <p className="text-sm text-muted-foreground mt-1">{sc.siteAddress}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase text-muted-foreground">Investissement HT</p>
                  <p className="text-3xl font-bold">{fmtEur(total * sc.quantity)}</p>
                  {sc.quantity > 1 && <p className="text-xs text-muted-foreground">{fmtEur(total)} × {sc.quantity}</p>}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-2">Atouts matériel</p>
                  <ul className="space-y-1 text-sm">
                    {sc.charger.features.map((f) => <li key={f} className="flex gap-2"><span className="text-primary">●</span>{f}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-2">Devis détaillé</p>
                  <ul className="space-y-1 text-sm">
                    {sc.lineItems.map((li, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="truncate">{li.label}</span>
                        <span className="text-muted-foreground tabular-nums whitespace-nowrap">{li.qty} × {fmtEur(li.unitHt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return <div className="border-b pb-2"><p className="text-[10px] uppercase text-muted-foreground">{k}</p><p className="font-medium">{v}</p></div>;
}
function KPI({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return <div><p className="text-[10px] uppercase text-muted-foreground">{k}</p><p className={`font-bold ${highlight ? "text-2xl text-primary" : "text-xl"}`}>{v}</p></div>;
}
