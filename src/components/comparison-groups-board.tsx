// Vue « Groupes de comparaison » : tableau plein écran pour organiser les véhicules
// chiffrés du devis en groupes. Un véhicule peut figurer dans plusieurs groupes sans
// être dupliqué (une seule fiche dans le PDF, une page de comparaison par groupe).
// Chaque groupe a sa couleur, la même partout dans l'outil.

import { useState } from "react";
import { Check, Layers, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { SelectedVehicle } from "@/lib/pdf";
import { groupTone, vehicleGroups } from "@/lib/comparison-groups";

const eur0 = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const keyOf = (sv: SelectedVehicle) => sv.instanceId ?? sv.vehicle.id;
const nameOf = (sv: SelectedVehicle) => `${sv.vehicle.brand} ${sv.vehicle.model}`.trim();

/** Pastilles cliquables : une par groupe, colorée quand le véhicule en fait partie. */
export function GroupChips({ names, value, onChange, onCreate }: {
  names: string[];
  value: string[];
  onChange: (groups: string[]) => void;
  /** Si fourni, affiche « + Nouveau groupe ». */
  onCreate?: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const toggle = (g: string) => onChange(value.includes(g) ? value.filter((x) => x !== g) : [...value, g]);
  const commit = () => {
    const n = draft.trim();
    if (n && onCreate) {
      onCreate(n);
      if (!value.includes(n)) onChange([...value, n]);
    }
    setDraft("");
    setAdding(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {names.map((g, i) => {
        const on = value.includes(g);
        const t = groupTone(i);
        return (
          <button
            key={g}
            type="button"
            aria-pressed={on}
            title={on ? `Retirer de « ${g} »` : `Ajouter à « ${g} »`}
            onClick={() => toggle(g)}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors"
            style={on ? { background: t.bg, borderColor: t.dot, color: t.text } : { background: "transparent", borderColor: "#E3DFD5", color: "#8B877E" }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: on ? t.dot : "#CFCAC0" }} />
            {g}
            {on && <Check className="h-3 w-3" />}
          </button>
        );
      })}
      {onCreate && (adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(""); setAdding(false); }
          }}
          placeholder="Nom du groupe"
          className="h-7 w-36 rounded-full border border-input bg-background px-3 text-[11px]"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-foreground/40 hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Nouveau groupe
        </button>
      ))}
    </div>
  );
}

function Thumb({ sv }: { sv: SelectedVehicle }) {
  return (
    <div className="grid h-9 w-14 flex-none place-content-center overflow-hidden rounded-md bg-[#FCF9F2]">
      <img src={sv.vehicle.image} alt="" loading="lazy" className="max-h-9 max-w-14 object-contain mix-blend-multiply" />
    </div>
  );
}

type Props = {
  vehicles: SelectedVehicle[];
  groupNames: string[];
  onSetGroups: (sv: SelectedVehicle, groups: string[]) => void;
  onCreateGroup: (name: string) => void;
  onRenameGroup: (from: string, to: string) => void;
  onDeleteGroup: (name: string) => void;
  onGoVehicles: () => void;
};

export function ComparisonGroupsBoard({ vehicles, groupNames, onSetGroups, onCreateGroup, onRenameGroup, onDeleteGroup, onGoVehicles }: Props) {
  const [search, setSearch] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [newName, setNewName] = useState("");

  const q = search.trim().toLowerCase();
  const free = vehicles.filter((sv) => vehicleGroups(sv).length === 0);
  const shown = vehicles.filter((sv) => {
    if (onlyFree && vehicleGroups(sv).length > 0) return false;
    return !q || `${nameOf(sv)} ${sv.vehicle.version}`.toLowerCase().includes(q);
  });
  const submitNew = () => {
    const n = newName.trim();
    if (!n) return;
    onCreateGroup(n);
    setNewName("");
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl space-y-1">
          <h2 className="flex items-center gap-2 text-xl font-semibold"><Layers className="h-5 w-5" /> Groupes de comparaison</h2>
          <p className="text-sm text-muted-foreground">
            Chaque groupe donne une page de comparaison dans le PDF. Un même véhicule peut figurer dans plusieurs groupes
            sans être dupliqué : sa fiche n'apparaît qu'une fois.
          </p>
        </div>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); submitNew(); }}>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nouveau groupe (ex. SUV, Remplacement 3008)" className="h-9 w-72" />
          <Button type="submit" size="sm" className="gap-1.5" disabled={!newName.trim()}><Plus className="h-4 w-4" /> Créer</Button>
        </form>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Aucun véhicule dans le devis : ajoutez-en d'abord, puis rangez-les ici par groupe.</p>
          <Button onClick={onGoVehicles}>Choisir des véhicules</Button>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[340px_1fr]">
          {/* Véhicules du devis : un clic sur une pastille ajoute / retire le véhicule d'un groupe */}
          <aside className="space-y-3 rounded-2xl border bg-card p-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-auto">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Véhicules du devis ({vehicles.length})</p>
              <button
                type="button"
                onClick={() => setOnlyFree((x) => !x)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${onlyFree ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              >
                Sans groupe ({free.length})
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un véhicule" className="h-8 pl-8 text-xs" />
            </div>
            <ul className="space-y-2">
              {shown.map((sv) => (
                <li key={keyOf(sv)} className="space-y-2 rounded-xl border bg-background p-2.5">
                  <div className="flex items-center gap-2.5">
                    <Thumb sv={sv} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{nameOf(sv)}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {sv.vehicle.version}{sv.vehicle.isCurrentFleet ? " · flotte actuelle" : ""}
                      </p>
                    </div>
                    {sv.negotiatedMonthly > 0 && <span className="flex-none text-xs font-semibold tabular-nums">{eur0(sv.negotiatedMonthly)}<span className="font-normal text-muted-foreground">/mois</span></span>}
                  </div>
                  <GroupChips names={groupNames} value={vehicleGroups(sv)} onChange={(gs) => onSetGroups(sv, gs)} />
                </li>
              ))}
              {shown.length === 0 && <li className="px-1 py-6 text-center text-xs text-muted-foreground">Aucun véhicule ne correspond.</li>}
            </ul>
          </aside>

          {/* Un bloc coloré par groupe */}
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {groupNames.map((g, i) => (
              <GroupCard
                key={g}
                name={g}
                index={i}
                members={vehicles.filter((sv) => vehicleGroups(sv).includes(g))}
                candidates={vehicles.filter((sv) => !vehicleGroups(sv).includes(g))}
                onAdd={(sv) => onSetGroups(sv, [...vehicleGroups(sv), g])}
                onRemove={(sv) => onSetGroups(sv, vehicleGroups(sv).filter((x) => x !== g))}
                onRename={(to) => onRenameGroup(g, to)}
                onDelete={() => onDeleteGroup(g)}
              />
            ))}
            <div className="space-y-3 rounded-2xl border border-dashed bg-card/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">Sans groupe</p>
                <span className="text-xs text-muted-foreground">{free.length}</span>
              </div>
              {free.length === 0 ? (
                <p className="text-xs text-muted-foreground">Tous les véhicules sont rangés dans un groupe.</p>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground">Comparés ensemble dans le comparateur général du PDF.</p>
                  <ul className="space-y-1.5">
                    {free.map((sv) => (
                      <li key={keyOf(sv)} className="flex items-center gap-2.5">
                        <Thumb sv={sv} />
                        <span className="min-w-0 flex-1 truncate text-sm">{nameOf(sv)} <span className="text-muted-foreground">{sv.vehicle.version}</span></span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function GroupCard({ name, index, members, candidates, onAdd, onRemove, onRename, onDelete }: {
  name: string;
  index: number;
  members: SelectedVehicle[];
  candidates: SelectedVehicle[];
  onAdd: (sv: SelectedVehicle) => void;
  onRemove: (sv: SelectedVehicle) => void;
  onRename: (to: string) => void;
  onDelete: () => void;
}) {
  const t = groupTone(index);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const commit = () => {
    const n = draft.trim();
    if (n && n !== name) onRename(n);
    setEditing(false);
  };
  return (
    <div className="overflow-hidden rounded-2xl border bg-card" style={{ borderColor: t.border }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: t.bg }}>
        <span className="h-3 w-3 flex-none rounded-full" style={{ background: t.dot }} />
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(name); setEditing(false); }
            }}
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm font-semibold"
          />
        ) : (
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: t.text }}>{name}</h3>
        )}
        <span className="text-xs font-medium" style={{ color: t.text }}>{members.length}</span>
        <button type="button" title="Renommer le groupe" className="rounded p-1 hover:bg-black/5" onClick={() => { setDraft(name); setEditing(true); }}>
          <Pencil className="h-3.5 w-3.5" style={{ color: t.text }} />
        </button>
        <button
          type="button"
          title="Supprimer le groupe (les véhicules restent dans le devis)"
          className="rounded p-1 hover:bg-black/5"
          onClick={() => {
            if (members.length === 0 || window.confirm(`Supprimer le groupe « ${name} » ? Les ${members.length} véhicule(s) restent dans le devis.`)) onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" style={{ color: t.text }} />
        </button>
      </div>
      <div className="space-y-2 p-3">
        {members.length < 2 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            {members.length === 0 ? "Groupe vide." : "Un seul véhicule."} Il en faut au moins 2 pour une page de comparaison dans le PDF.
          </p>
        )}
        <ul className="space-y-1.5">
          {members.map((sv) => (
            <li key={keyOf(sv)} className="flex items-center gap-2.5 rounded-xl border bg-background p-2">
              <Thumb sv={sv} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{nameOf(sv)}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {sv.vehicle.version}
                  {sv.vehicle.isCurrentFleet ? " · flotte actuelle" : ""}
                  {sv.negotiatedMonthly > 0 ? ` · ${eur0(sv.negotiatedMonthly)}/mois` : ""}
                </p>
              </div>
              <button type="button" title="Retirer du groupe" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => onRemove(sv)}>
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={candidates.length === 0}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2 text-xs font-semibold text-muted-foreground hover:border-foreground/40 hover:text-foreground disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter un véhicule
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-72 overflow-auto">
            {candidates.map((sv) => (
              <DropdownMenuItem key={keyOf(sv)} onSelect={() => onAdd(sv)} className="cursor-pointer gap-2">
                <span className="min-w-0 flex-1 truncate">{nameOf(sv)} <span className="text-muted-foreground">{sv.vehicle.version}</span></span>
                {sv.negotiatedMonthly > 0 && <span className="text-xs tabular-nums text-muted-foreground">{eur0(sv.negotiatedMonthly)}</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
