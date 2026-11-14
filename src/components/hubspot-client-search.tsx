// « Importer depuis HubSpot » : le commercial cherche une société ou un contact
// dans le CRM, choisit le résultat, puis le contact de la société. La fiche client
// du devis est remplie (société, SIREN, adresse, effectif, contact, email).
// Lecture seule : rien n'est modifié dans HubSpot.

import { useEffect, useState } from "react";
import { Building2, Loader2, Search, User, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clientPatchFromCompany,
  clientPatchFromContact,
  contactName,
  getHubspotCompany,
  searchHubspot,
  type HubspotCompany,
  type HubspotContact,
} from "@/lib/hubspot";

export function HubspotClientSearch({ client, setClient }: { client: any; setClient: (c: any) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState<HubspotCompany[]>([]);
  const [contacts, setContacts] = useState<HubspotContact[]>([]);
  // Société choisie : on affiche ses contacts pour choisir l'interlocuteur.
  const [picked, setPicked] = useState<{ company: HubspotCompany; contacts: HubspotContact[] } | null>(null);

  useEffect(() => {
    if (!open || picked) return;
    const q = query.trim();
    if (q.length < 2) { setCompanies([]); setContacts([]); setError(""); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchHubspot(q);
        if (cancelled) return;
        setCompanies(r.companies);
        setContacts(r.contacts);
        setError("");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "HubSpot indisponible");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, open, picked]);

  const close = () => { setOpen(false); setPicked(null); setQuery(""); setCompanies([]); setContacts([]); setError(""); };

  const pickCompany = async (id: string, preferredContact?: HubspotContact) => {
    setLoading(true);
    try {
      const r = await getHubspotCompany(id);
      const patch = { ...clientPatchFromCompany(r.company), ...(preferredContact ? clientPatchFromContact(preferredContact) : {}) };
      setClient({ ...client, ...patch, companyCategory: "" });
      if (preferredContact || r.contacts.length === 0) {
        toast.success(`Client importé depuis HubSpot : ${r.company.name}`);
        close();
      } else if (r.contacts.length === 1) {
        setClient({ ...client, ...patch, ...clientPatchFromContact(r.contacts[0]), companyCategory: "" });
        toast.success(`Client importé depuis HubSpot : ${r.company.name} · ${contactName(r.contacts[0])}`);
        close();
      } else {
        setPicked(r);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "HubSpot indisponible");
    } finally {
      setLoading(false);
    }
  };

  const pickContact = (c: HubspotContact) => {
    if (c.companyId) { void pickCompany(c.companyId, c); return; }
    setClient({ ...client, ...clientPatchFromContact(c), company: client.company || c.companyName });
    toast.success(`Contact importé depuis HubSpot : ${contactName(c)}`);
    close();
  };

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setOpen(true)}
        title="Rechercher la société ou le contact dans HubSpot et remplir la fiche client">
        <Building2 className="w-3.5 h-3.5" />
        Importer depuis HubSpot
      </Button>
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">
          {picked ? `Contacts de ${picked.company.name}` : "Rechercher dans HubSpot"}
        </p>
        <button type="button" onClick={close} className="text-muted-foreground hover:text-foreground" title="Fermer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {!picked && (
        <div className="relative">
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Société, contact ou email" className="pr-9 h-8 text-sm" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </span>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!picked && !error && query.trim().length >= 2 && !loading && companies.length === 0 && contacts.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucun résultat dans HubSpot.</p>
      )}

      {!picked && companies.length > 0 && (
        <ul className="max-h-48 overflow-auto divide-y rounded border bg-background">
          {companies.map((c) => (
            <li key={c.id}>
              <button type="button" disabled={loading} onClick={() => pickCompany(c.id)} className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex gap-2">
                <Building2 className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium truncate">{c.name || "(sans nom)"}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {[c.siren && `SIREN ${c.siren}`, [c.postalCode, c.city].filter(Boolean).join(" "), c.domain].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!picked && contacts.length > 0 && (
        <ul className="max-h-40 overflow-auto divide-y rounded border bg-background">
          {contacts.map((c) => (
            <li key={c.id}>
              <button type="button" disabled={loading} onClick={() => pickContact(c)} className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex gap-2">
                <User className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium truncate">{contactName(c) || c.email}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {[c.jobTitle, c.companyName, c.email].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <>
          <ul className="max-h-56 overflow-auto divide-y rounded border bg-background">
            {picked.contacts.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => {
                  setClient({ ...client, ...clientPatchFromCompany(picked.company), ...clientPatchFromContact(c), companyCategory: "" });
                  toast.success(`Client importé depuis HubSpot : ${picked.company.name} · ${contactName(c)}`);
                  close();
                }} className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex gap-2">
                  <User className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{contactName(c) || c.email}</span>
                    <span className="block text-[11px] text-muted-foreground truncate">{[c.jobTitle, c.email, c.phone].filter(Boolean).join(" · ")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { toast.success(`Société importée depuis HubSpot : ${picked.company.name}`); close(); }}>
            Garder la société sans contact
          </Button>
        </>
      )}
      <p className="text-[10px] text-muted-foreground">Source : HubSpot (lecture seule)</p>
    </div>
  );
}
