// Encart "Véhicule du moment" — mise en avant marketing sur la home
// commerciale. Affiche le 1er véhicule marqué featured=true dans le catalogue,
// avec une grande photo principale + galerie de vignettes + specs clés + CTA.
//
// Sélection du featured : éditable par ops/admin dans /admin/vehicles (champ
// featured sur la fiche véhicule). Une seule mise en avant active à la fois ;
// si plusieurs vehicles.featured sont true, le premier de la liste gagne.
//
// Le composant retourne null si aucun véhicule n'est featured, pour ne pas
// occuper d'espace inutilement sur la home.

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Battery, Gauge, Zap } from "lucide-react";
import type { Vehicle } from "@/lib/catalog";
import { fmtEur } from "@/lib/store";

export function VehicleSpotlight({
  vehicles,
  onCompare,
}: {
  vehicles: Vehicle[];
  onCompare?: () => void;
}) {
  // 1er véhicule featured ; on inclut la photo principale dans la galerie
  const v = vehicles.find((x) => x.featured);
  // Hooks doivent être appelés avant tout return conditionnel
  const photos: string[] = v
    ? Array.from(new Set([v.image, ...(v.gallery ?? [])].filter(Boolean)))
    : [];
  const [activeIdx, setActiveIdx] = useState(0);
  if (!v) return null;
  const activePhoto = photos[activeIdx] ?? v.image;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-beev-rose" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-beev-black">
          Véhicule du moment
        </h2>
      </div>
      <Card className="overflow-hidden border-beev-rose/40 bg-gradient-to-br from-beev-beige to-white">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Photo principale + miniatures */}
            <div className="bg-beev-violet-20 p-6 flex flex-col gap-3">
              <div className="aspect-[4/3] bg-white rounded-lg overflow-hidden flex items-center justify-center">
                {activePhoto ? (
                  <img
                    src={activePhoto}
                    alt={`${v.brand} ${v.model}`}
                    className="w-full h-full object-contain p-4"
                    loading="lazy"
                  />
                ) : (
                  <div className="text-beev-black/40 text-sm italic">Photo à venir</div>
                )}
              </div>
              {photos.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {photos.slice(0, 4).map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      className={`aspect-square rounded-md overflow-hidden bg-white border-2 transition-all ${
                        i === activeIdx
                          ? "border-beev-rose shadow-md"
                          : "border-transparent hover:border-beev-rose/40"
                      }`}
                    >
                      <img src={p} alt={`Vue ${i + 1}`} className="w-full h-full object-contain p-1" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Specs + CTA */}
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge className="bg-beev-rose-30 text-beev-black border-beev-rose mb-2 text-[10px]">
                    {v.energy}
                  </Badge>
                  <h3 className="text-2xl font-bold text-beev-black leading-tight">
                    {v.brand} {v.model}
                  </h3>
                  <p className="text-sm text-beev-black/70 mt-0.5">{v.version}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase text-beev-black/60">À partir de</p>
                  <p className="text-xl font-bold text-beev-black">{fmtEur(v.monthlyLld)}/mois</p>
                  <p className="text-[10px] text-beev-black/60">LLD HT</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 py-3 border-y border-beev-rose/20">
                <Spec icon={<Battery className="w-4 h-4 text-beev-rose" />} label="Batterie" value={`${v.batteryKwh} kWh`} />
                <Spec icon={<Gauge className="w-4 h-4 text-beev-rose" />} label="Autonomie" value={`${v.rangeWltp} km`} />
                <Spec icon={<Zap className="w-4 h-4 text-beev-rose" />} label="Puissance" value={`${v.powerHp} ch`} />
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-beev-black/80">
                <div className="flex justify-between"><span>Consommation</span><span className="font-semibold">{v.energy === "Électrique" ? `${v.consumptionElec ?? v.consumption} kWh/100km` : `${v.consumptionThermal ?? v.consumption} L/100km`}</span></div>
                <div className="flex justify-between"><span>Puissance fiscale</span><span className="font-semibold">{v.fiscalHp} CV</span></div>
                <div className="flex justify-between"><span>CO₂</span><span className="font-semibold">{v.co2} g/km</span></div>
                <div className="flex justify-between"><span>Catégorie</span><span className="font-semibold">{v.category}</span></div>
              </div>

              {onCompare && (
                <Button onClick={onCompare} variant="default" className="mt-auto gap-2">
                  Comparer avec d'autres véhicules
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-[10px] text-beev-black/60 uppercase">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-sm font-semibold text-beev-black">{value}</span>
    </div>
  );
}
