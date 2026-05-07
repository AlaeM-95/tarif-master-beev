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
import { Trash2, FileDown, RotateCcw, Plus, Zap, Battery, Gauge } from "lucide-react";
import { useChargers, useVehicles, fmtEur } from "@/lib/store";
import { generateProposalPdf, type SelectedCharger, type SelectedVehicle } from "@/lib/pdf";
import type { Charger, Vehicle } from "@/lib/catalog";

export const Route = createFileRoute("/")({
  component: App,
  head: () => ({
    meta: [
      { title: "Beev · Générateur de proposition commerciale" },
      { name: "description", content: "Outil interne Beev pour créer des propositions tarifaires PDF personnalisées : véhicules électriques et bornes de recharge." },
    ],
  }),
});

function App() {
  const { vehicles, update: updateVehicle, reset: resetVehicles } = useVehicles();
  const { chargers, update: updateCharger, reset: resetChargers } = useChargers();

  const [selectedV, setSelectedV] = useState<Record<string, SelectedVehicle>>({});
  const [selectedC, setSelectedC] = useState<Record<string, SelectedCharger>>({});

  const [client, setClient] = useState({
    company: "",
    contact: "",
    email: "",
    salesRep: "",
    date: new Date().toLocaleDateString("fr-FR"),
    notes: "Offre valable 30 jours. Livraison sous 3 à 6 mois selon disponibilité constructeur. Aides CEE déduites le cas échéant.",
  });

  const totals = useMemo(() => {
    const v = Object.values(selectedV);
    const c = Object.values(selectedC);
    const monthly = v.reduce((s, x) => s + x.negotiatedMonthly * x.quantity, 0);
    const upfront = v.reduce((s, x) => s + x.vehicle.priceTtc * (1 - x.discountPct / 100) * x.quantity, 0);
    const ch = c.reduce((s, x) => {
      const u = x.charger.priceHt * (1 - x.discountPct / 100);
      return s + (u + (x.installIncluded ? x.charger.installPriceHt : 0)) * x.quantity;
    }, 0);
    return { monthly, upfront, chargers: ch, count: v.length + c.length };
  }, [selectedV, selectedC]);

  const toggleV = (v: Vehicle) => {
    setSelectedV((s) => {
      if (s[v.id]) { const { [v.id]: _, ...rest } = s; return rest; }
      return {
        ...s,
        [v.id]: { vehicle: v, quantity: 1, discountPct: 0, negotiatedMonthly: v.monthlyLld, durationMonths: 36, kmPerYear: 15000 },
      };
    });
  };
  const toggleC = (c: Charger) => {
    setSelectedC((s) => {
      if (s[c.id]) { const { [c.id]: _, ...rest } = s; return rest; }
      return { ...s, [c.id]: { charger: c, quantity: 1, discountPct: 0, installIncluded: true } };
    });
  };

  const exportPdf = () => {
    if (!client.company) {
      alert("Renseignez au moins le nom de la société client.");
      return;
    }
    generateProposalPdf({
      client,
      vehicles: Object.values(selectedV),
      chargers: Object.values(selectedC),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-primary-foreground font-bold text-lg" style={{ background: "var(--gradient-primary)" }}>B</div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Beev · Proposition commerciale</h1>
              <p className="text-xs text-muted-foreground">Catalogue interne grand compte · génération PDF</p>
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

      <main className="container mx-auto px-6 py-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <ClientCard client={client} setClient={setClient} />

          <Tabs defaultValue="vehicles">
            <TabsList>
              <TabsTrigger value="vehicles">Véhicules ({vehicles.length})</TabsTrigger>
              <TabsTrigger value="chargers">Bornes ({chargers.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="vehicles" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Modifie les prix et caractéristiques, puis sélectionne les modèles à inclure.</p>
                <Button variant="ghost" size="sm" onClick={resetVehicles} className="gap-2">
                  <RotateCcw className="w-3 h-3" /> Réinitialiser
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {vehicles.map((v) => (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    selected={!!selectedV[v.id]}
                    onToggle={() => toggleV(v)}
                    onUpdate={(patch) => updateVehicle(v.id, patch)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="chargers" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Bornes pour collaborateurs (domicile) et entreprise.</p>
                <Button variant="ghost" size="sm" onClick={resetChargers} className="gap-2">
                  <RotateCcw className="w-3 h-3" /> Réinitialiser
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {chargers.map((c) => (
                  <ChargerCard
                    key={c.id}
                    charger={c}
                    selected={!!selectedC[c.id]}
                    onToggle={() => toggleC(c)}
                    onUpdate={(patch) => updateCharger(c.id, patch)}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="lg:sticky lg:top-24 self-start space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sélection en cours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {totals.count === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun produit sélectionné. Coche un véhicule ou une borne pour l'ajouter à la proposition.</p>
              ) : (
                <>
                  {Object.values(selectedV).map((sv) => (
                    <SelectedVehicleRow
                      key={sv.vehicle.id}
                      sv={sv}
                      onChange={(patch) => setSelectedV((s) => ({ ...s, [sv.vehicle.id]: { ...sv, ...patch } }))}
                      onRemove={() => toggleV(sv.vehicle)}
                    />
                  ))}
                  {Object.values(selectedC).map((sc) => (
                    <SelectedChargerRow
                      key={sc.charger.id}
                      sc={sc}
                      onChange={(patch) => setSelectedC((s) => ({ ...s, [sc.charger.id]: { ...sc, ...patch } }))}
                      onRemove={() => toggleC(sc.charger)}
                    />
                  ))}

                  <Separator />
                  <div className="space-y-1.5 text-sm">
                    <Row k="Véhicules (achat TTC)" v={fmtEur(totals.upfront)} />
                    <Row k="LLD mensuel HT" v={`${fmtEur(totals.monthly)} / mois`} />
                    <Row k="Bornes + install. HT" v={fmtEur(totals.chargers)} />
                  </div>
                  <Button onClick={exportPdf} className="w-full gap-2">
                    <FileDown className="w-4 h-4" /> Télécharger la proposition
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
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}

function ClientCard({ client, setClient }: { client: any; setClient: (c: any) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Informations client</CardTitle></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Société *"><Input value={client.company} onChange={(e) => setClient({ ...client, company: e.target.value })} placeholder="Ex. Acme SAS" /></Field>
        <Field label="Contact"><Input value={client.contact} onChange={(e) => setClient({ ...client, contact: e.target.value })} placeholder="Nom Prénom" /></Field>
        <Field label="Email"><Input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} placeholder="contact@acme.fr" /></Field>
        <Field label="Commercial Beev"><Input value={client.salesRep} onChange={(e) => setClient({ ...client, salesRep: e.target.value })} placeholder="Votre nom" /></Field>
        <Field label="Date"><Input value={client.date} onChange={(e) => setClient({ ...client, date: e.target.value })} /></Field>
        <Field label="Notes & conditions" className="sm:col-span-2">
          <Textarea rows={3} value={client.notes} onChange={(e) => setClient({ ...client, notes: e.target.value })} />
        </Field>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function VehicleCard({ vehicle, selected, onToggle, onUpdate }: { vehicle: Vehicle; selected: boolean; onToggle: () => void; onUpdate: (p: Partial<Vehicle>) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <Card className={`overflow-hidden transition-all ${selected ? "ring-2 ring-primary shadow-[var(--shadow-elevated)]" : "hover:shadow-[var(--shadow-soft)]"}`}>
      <div className="aspect-video bg-muted overflow-hidden">
        <img src={vehicle.image} alt={`${vehicle.brand} ${vehicle.model}`} className="w-full h-full object-cover" loading="lazy" />
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold leading-tight">{vehicle.brand} {vehicle.model}</h3>
              <Badge variant="secondary" className="text-[10px]">{vehicle.category}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{vehicle.version}</p>
          </div>
          <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-1" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <Spec icon={<Gauge className="w-3 h-3" />} v={`${vehicle.rangeWltp} km`} />
          <Spec icon={<Battery className="w-3 h-3" />} v={`${vehicle.batteryKwh} kWh`} />
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
          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            <NumField label="Prix TTC" value={vehicle.priceTtc} onChange={(n) => onUpdate({ priceTtc: n })} />
            <NumField label="LLD €/mois" value={vehicle.monthlyLld} onChange={(n) => onUpdate({ monthlyLld: n })} />
            <NumField label="Autonomie km" value={vehicle.rangeWltp} onChange={(n) => onUpdate({ rangeWltp: n })} />
            <NumField label="Batterie kWh" value={vehicle.batteryKwh} onChange={(n) => onUpdate({ batteryKwh: n })} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChargerCard({ charger, selected, onToggle, onUpdate }: { charger: Charger; selected: boolean; onToggle: () => void; onUpdate: (p: Partial<Charger>) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <Card className={`overflow-hidden transition-all ${selected ? "ring-2 ring-primary shadow-[var(--shadow-elevated)]" : "hover:shadow-[var(--shadow-soft)]"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold leading-tight">{charger.brand} {charger.model}</h3>
              <Badge variant="secondary" className="text-[10px]">{charger.powerKw} kW</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{charger.type}</p>
          </div>
          <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-1" />
        </div>
        <ul className="text-xs text-muted-foreground space-y-1">
          {charger.features.map((f) => (
            <li key={f} className="flex gap-1.5"><Plus className="w-3 h-3 mt-0.5 text-primary" />{f}</li>
          ))}
        </ul>
        <div className="flex items-end justify-between pt-1">
          <div>
            <p className="text-xs text-muted-foreground">Borne</p>
            <p className="font-semibold">{fmtEur(charger.priceHt)} <span className="text-xs text-muted-foreground">HT</span></p>
            <p className="text-xs text-primary">+ install. {fmtEur(charger.installPriceHt)} HT</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)}>{editing ? "OK" : "Éditer"}</Button>
        </div>
        {editing && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            <NumField label="Prix borne HT" value={charger.priceHt} onChange={(n) => onUpdate({ priceHt: n })} />
            <NumField label="Install. HT" value={charger.installPriceHt} onChange={(n) => onUpdate({ installPriceHt: n })} />
            <NumField label="Puissance kW" value={charger.powerKw} onChange={(n) => onUpdate({ powerKw: n })} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8" />
    </div>
  );
}

function SelectedVehicleRow({ sv, onChange, onRemove }: { sv: SelectedVehicle; onChange: (p: Partial<SelectedVehicle>) => void; onRemove: () => void }) {
  return (
    <div className="rounded-lg border bg-secondary/30 p-3 space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{sv.vehicle.brand} {sv.vehicle.model}</p>
          <p className="text-xs text-muted-foreground truncate">{sv.vehicle.version}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}><Trash2 className="w-3 h-3" /></Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniField label="Quantité" value={sv.quantity} onChange={(n) => onChange({ quantity: n })} />
        <MiniField label="Remise %" value={sv.discountPct} onChange={(n) => onChange({ discountPct: n })} step={0.5} />
        <MiniField label="LLD €/mois" value={sv.negotiatedMonthly} onChange={(n) => onChange({ negotiatedMonthly: n })} />
        <MiniField label="Durée mois" value={sv.durationMonths} onChange={(n) => onChange({ durationMonths: n })} />
      </div>
    </div>
  );
}

function SelectedChargerRow({ sc, onChange, onRemove }: { sc: SelectedCharger; onChange: (p: Partial<SelectedCharger>) => void; onRemove: () => void }) {
  return (
    <div className="rounded-lg border bg-secondary/30 p-3 space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{sc.charger.brand} {sc.charger.model}</p>
          <p className="text-xs text-muted-foreground">{sc.charger.powerKw} kW</p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}><Trash2 className="w-3 h-3" /></Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniField label="Quantité" value={sc.quantity} onChange={(n) => onChange({ quantity: n })} />
        <MiniField label="Remise %" value={sc.discountPct} onChange={(n) => onChange({ discountPct: n })} step={0.5} />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={sc.installIncluded} onCheckedChange={(v) => onChange({ installIncluded: !!v })} />
        Inclure l'installation
      </label>
    </div>
  );
}

function MiniField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground uppercase">{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 text-sm" />
    </div>
  );
}

function Spec({ icon, v }: { icon: React.ReactNode; v: string }) {
  return <div className="flex items-center gap-1">{icon}<span>{v}</span></div>;
}
