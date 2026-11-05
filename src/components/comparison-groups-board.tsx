// Vue « Groupes de comparaison » : tableau plein écran pour organiser les véhicules
// chiffrés du devis en groupes. Un véhicule peut figurer dans plusieurs groupes sans
// être dupliqué (une seule fiche dans le PDF, une page de comparaison par groupe).
// Chaque groupe a sa couleur, la même partout dans l'outil.

import { useState, type ReactNode } from "react";
import { AlertTriangle, Check, CheckCircle2, Layers, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { SelectedVehicle } from "@/lib/pdf";
import { groupIssues, groupTone, vehicleGroups, type GroupIssue } from "@/lib/comparison-groups";

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
  /** Ouvre le panneau de réglages du véhicule (loyer, TCO, options…). */
  onOpenVehicle: (sv: SelectedVehicle) => void;
  onPatchVehicle: (sv: SelectedVehicle, patch: Partial<SelectedVehicle>) => void;
  /** La page « Comparateur par groupe » est-elle activée dans la configuration PDF ? */
  pageEnabled: boolean;
  onEnablePage: () => void;
};

export function ComparisonGroupsBoard({ vehicles, groupNames, onSetGroups, onCreateGroup, onRenameGroup, onDeleteGroup, onGoVehicles, onOpenVehicle, onPatchVehicle, pageEnabled, onEnablePage }: Props) {
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
                  <button type="button" onClick={() => onOpenVehicle(sv)} title="Ouvrir le panneau de ce véhicule" className="flex w-full items-center gap-2.5 rounded-md text-left hover:bg-muted/50">
                    <Thumb sv={sv} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{nameOf(sv)}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {sv.vehicle.version}{sv.vehicle.isCurrentFleet ? " · flotte actuelle" : ""}
                      </p>
                    </div>
                    {sv.negotiatedMonthly > 0
                      ? <span className="flex-none text-xs font-semibold tabular-nums">{eur0(sv.negotiatedMonthly)}<span className="font-normal text-muted-foreground">/mois</span></span>
                      : <span className="flex-none rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Loyer à saisir</span>}
                  </button>
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
                onOpenVehicle={onOpenVehicle}
                onPatchVehicle={onPatchVehicle}
                pageEnabled={pageEnabled}
                onEnablePage={onEnablePage}
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
                  <p className="text-[11px] text-muted-foreground">Comparés ensemble dans une page « sans groupe » du PDF.</p>
                  <ul className="space-y-1.5">
                    {free.map((sv) => (
                      <li key={keyOf(sv)}>
                        <button type="button" onClick={() => onOpenVehicle(sv)} title="Ouvrir le panneau de ce véhicule" className="flex w-full items-center gap-2.5 rounded-md text-left hover:bg-muted/50">
                          <Thumb sv={sv} />
                          <span className="min-w-0 flex-1 truncate text-sm">{nameOf(sv)} <span className="text-muted-foreground">{sv.vehicle.version}</span></span>
                        </button>
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

function GroupCard({ name, index, members, candidates, onAdd, onRemove, onRename, onDelete, onOpenVehicle, onPatchVehicle, pageEnabled, onEnablePage }: {
  name: string;
  index: number;
  members: SelectedVehicle[];
  candidates: SelectedVehicle[];
  onAdd: (sv: SelectedVehicle) => void;
  onRemove: (sv: SelectedVehicle) => void;
  onRename: (to: string) => void;
  onDelete: () => void;
  onOpenVehicle: (sv: SelectedVehicle) => void;
  onPatchVehicle: (sv: SelectedVehicle, patch: Partial<SelectedVehicle>) => void;
  pageEnabled: boolean;
  onEnablePage: () => void;
}) {
  const t = groupTone(index);
  const issues = groupIssues(members, pageEnabled);
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
        <span
          className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold ${issues.length === 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
          title={issues.length === 0 ? "La page de comparaison de ce groupe sera dans le PDF" : "Points à compléter pour afficher la page de comparaison"}
        >
          {issues.length === 0 ? "Comparateur prêt" : `${issues.length} à compléter`}
        </span>
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
        <IssueList
          issues={issues}
          members={members}
          onOpenVehicle={onOpenVehicle}
          onPatchVehicle={onPatchVehicle}
          onEnablePage={onEnablePage}
        />
        <ul className="space-y-1.5">
          {members.map((sv) => (
            <li key={keyOf(sv)} className="flex items-center gap-1 rounded-xl border bg-background p-1.5">
              <button type="button" onClick={() => onOpenVehicle(sv)} title="Ouvrir le panneau de ce véhicule" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-0.5 text-left hover:bg-muted/50">
                <Thumb sv={sv} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{nameOf(sv)}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {sv.vehicle.version}
                    {sv.vehicle.isCurrentFleet ? " · flotte actuelle" : ""}
                    {sv.negotiatedMonthly > 0 ? ` · ${eur0(sv.negotiatedMonthly)}/mois` : ""}
                  </p>
                </div>
                {!(sv.negotiatedMonthly > 0) && <span className="flex-none rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Loyer à saisir</span>}
              </button>
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

/** Liste des points manquants pour la page de comparaison d'un groupe, avec le correctif en un clic. */
function IssueList({ issues, members, onOpenVehicle, onPatchVehicle, onEnablePage }: {
  issues: GroupIssue[];
  members: SelectedVehicle[];
  onOpenVehicle: (sv: SelectedVehicle) => void;
  onPatchVehicle: (sv: SelectedVehicle, patch: Partial<SelectedVehicle>) => void;
  onEnablePage: () => void;
}) {
  if (issues.length === 0) {
    return (
      <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5 flex-none" /> Tout est prêt : la page de comparaison de ce groupe sera dans le PDF.
      </p>
    );
  }
  return (
    <div className="space-y-1.5 rounded-lg bg-amber-50 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900">
        <AlertTriangle className="h-3.5 w-3.5 flex-none" /> Pour afficher le comparateur de ce groupe :
      </p>
      <ul className="space-y-1.5">
        {issues.map((it, i) => (
          <li key={`${it.kind}-${i}`} className="flex items-start justify-between gap-2 text-[11px] text-amber-900">
            <span>{it.text}</span>
            {it.kind === "disabled" && <FixButton onClick={onEnablePage}>Activer</FixButton>}
            {it.kind === "loyer" && it.vehicle && <FixButton onClick={() => onOpenVehicle(it.vehicle!)}>Saisir</FixButton>}
            {it.kind === "current" && it.vehicle && <FixButton onClick={() => onPatchVehicle(it.vehicle!, { vehicle: { ...it.vehicle!.vehicle, isCurrentFleet: false } })}>Retirer ce statut</FixButton>}
            {it.kind === "tco" && <FixButton onClick={() => members.forEach((sv) => onPatchVehicle(sv, { includeTco: true }))}>Activer</FixButton>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FixButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex-none rounded-full border border-amber-400 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100">
      {children}
    </button>
  );
}

/** Encadré affiché en tête du panneau d'un véhicule : état du comparateur de chacun de ses groupes. */
export function VehicleGroupsStatus({ sv, allVehicles, groupNames, pageEnabled, onEnablePage, onPatchVehicle, onOpenVehicle }: {
  sv: SelectedVehicle;
  allVehicles: SelectedVehicle[];
  groupNames: string[];
  pageEnabled: boolean;
  onEnablePage: () => void;
  onPatchVehicle: (sv: SelectedVehicle, patch: Partial<SelectedVehicle>) => void;
  onOpenVehicle: (sv: SelectedVehicle) => void;
}) {
  const mine = vehicleGroups(sv);
  if (mine.length === 0) return null;
  return (
    <div className="space-y-2.5 rounded-xl border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Comparateur par groupe</p>
      {mine.map((g) => {
        const members = allVehicles.filter((x) => vehicleGroups(x).includes(g));
        const t = groupTone(Math.max(0, groupNames.indexOf(g)));
        return (
          <div key={g} className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: t.text }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.dot }} /> {g}
              <span className="text-xs font-normal text-muted-foreground">· {members.length} véhicule{members.length > 1 ? "s" : ""}</span>
            </p>
            <IssueList issues={groupIssues(members, pageEnabled)} members={members} onOpenVehicle={onOpenVehicle} onPatchVehicle={onPatchVehicle} onEnablePage={onEnablePage} />
          </div>
        );
      })}
    </div>
  );
}
