// Champ « Société » avec recherche d'entreprise (API Recherche d'entreprises).
//
// Le commercial tape un nom, un sigle, un SIREN ou un SIRET : une liste de
// suggestions (raison sociale, ville, effectif) apparaît ; au choix, la société
// est renseignée et le SIREN, l'adresse du siège, l'effectif et la catégorie
// sont mémorisés sur le devis (client.siren, companyAddress, companyCity,
// companyEffectif, companyCategory). La saisie libre reste possible : l'API est une aide, pas
// une obligation (client hors France, nom commercial, API indisponible).

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, BadgeCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchCompanies, formatSiren, type CompanyHit } from "@/lib/company-search";

const CLEARED = { siren: "", companyAddress: "", companyCity: "", companyEffectif: "", companyCategory: "" };

/** Champ société + pastille de vérification. `client` / `setClient` suivent le
 *  state de la page (objet libre). */
export function CompanySearchField({ client, setClient }: { client: any; setClient: (c: any) => void }) {
  const [hits, setHits] = useState<CompanyHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(-1);
  // La recherche ne part que sur une frappe de l'utilisateur, jamais sur une
  // valeur rechargée (devis repris, sélection d'un résultat).
  const typedRef = useRef(false);
  const company: string = client.company ?? "";

  useEffect(() => {
    if (!typedRef.current) return;
    if (company.replace(/\s/g, "").length < 3) {
      setHits([]);
      setError("");
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchCompanies(company, ctrl.signal);
        setHits(r);
        setError("");
        setActive(-1);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        setHits([]);
        setError(e instanceof Error ? e.message : "Recherche indisponible");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [company]);

  const pick = (h: CompanyHit) => {
    typedRef.current = false;
    setClient({
      ...client,
      company: h.name,
      siren: h.siren,
      companyAddress: h.address,
      companyCity: [h.postalCode, h.city].filter(Boolean).join(" "),
      companyEffectif: h.effectif,
      companyCategory: h.category,
    });
    setOpen(false);
    setHits([]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % hits.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? hits.length - 1 : i - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(hits[active]); }
    else if (e.key === "Escape") setOpen(false);
  };

  const showList = open && company.replace(/\s/g, "").length >= 3 && (loading || error || hits.length > 0 || typedRef.current);
  const where = [client.companyCity, client.companyEffectif, client.companyCategory].filter(Boolean);

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          value={company}
          onChange={(e) => {
            typedRef.current = true;
            setOpen(true);
            setClient({ ...client, company: e.target.value, ...CLEARED });
          }}
          onFocus={() => { if (typedRef.current) setOpen(true); }}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder="Nom, sigle ou SIREN — ex. BIG France"
          autoComplete="off"
          className="pr-9"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </span>

        {showList && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            {error ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">{error} — vous pouvez saisir la société à la main.</p>
            ) : hits.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">{loading ? "Recherche…" : "Aucune entreprise trouvée — saisie libre conservée."}</p>
            ) : (
              <ul role="listbox">
                {hits.map((h, i) => (
                  <li key={h.siren} role="option" aria-selected={i === active}>
                    {/* onMouseDown : le clic doit passer avant le blur de l'input */}
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); pick(h); }}
                      onMouseEnter={() => setActive(i)}
                      className={`w-full text-left px-3 py-2 text-sm ${i === active ? "bg-muted" : ""}`}
                    >
                      <span className="block font-medium truncate">{h.name}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">
                        {[`SIREN ${formatSiren(h.siren)}`, [h.postalCode, h.city].filter(Boolean).join(" "), h.effectif, h.category].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t px-3 py-1 text-[10px] text-muted-foreground">Source : API Recherche d'entreprises (data.gouv.fr)</p>
          </div>
        )}
      </div>

      {client.siren && (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground" title={client.companyAddress || undefined}>
          <BadgeCheck className="w-3.5 h-3.5 mt-px shrink-0 text-emerald-600" />
          <span className="min-w-0">
            Entreprise vérifiée · SIREN {formatSiren(String(client.siren))}
            {where.length > 0 && <> · {where.join(" · ")}</>}
          </span>
          <button
            type="button"
            title="Retirer les informations d'entreprise (garde le nom saisi)"
            onClick={() => setClient({ ...client, ...CLEARED })}
            className="ml-auto shrink-0 rounded p-0.5 hover:bg-muted"
          >
            <X className="w-3 h-3" />
          </button>
        </p>
      )}
    </div>
  );
}
