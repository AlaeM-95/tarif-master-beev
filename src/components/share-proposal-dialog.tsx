// Dialogue de partage d'une proposition, réutilisable (liste « mes propositions »
// et fiche proposition). Permet d'attribuer un responsable principal et de
// partager avec d'autres utilisateurs inscrits. La proposition est relue en
// direct depuis le cache (useProposals) pour refléter les changements.

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUsers, ROLE_LABELS } from "@/lib/users";
import { useProposals } from "@/lib/proposals";

export function ShareProposalDialog({ proposalId, onClose }: { proposalId: string | null; onClose: () => void }) {
  const { users } = useUsers();
  const { proposals, updateSharing } = useProposals();
  const proposal = proposalId ? proposals.find((p) => p.id === proposalId) : null;

  return (
    <Dialog open={!!proposalId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <span className="block w-10 h-1 rounded-full bg-beev-rose mb-1" />
          <DialogTitle>Partager {proposal ? `« ${proposal.clientCompany || "Sans nom"} »` : "la proposition"}</DialogTitle>
        </DialogHeader>
        {proposal && (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase text-muted-foreground">Responsable principal (attribué)</label>
              <select
                value={proposal.assignedTo ?? ""}
                onChange={async (e) => {
                  const val = e.target.value || null;
                  const res = await updateSharing(proposal.id, { assignedTo: val });
                  if (res.error) toast.error(res.error);
                  else toast.success(val ? "Proposition attribuée" : "Attribution retirée");
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Aucun (créateur seul) —</option>
                {users.filter((u) => u.role !== "visitor").map((u) => (
                  <option key={u.id} value={u.id}>{u.email} ({ROLE_LABELS[u.role]})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium uppercase text-muted-foreground">Partagé en plus avec ({proposal.sharedWith.length})</label>
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto rounded-md border p-2">
                {users
                  .filter((u) => u.role !== "visitor" && u.id !== proposal.createdBy && u.id !== proposal.assignedTo)
                  .map((u) => {
                    const isShared = proposal.sharedWith.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer p-1 hover:bg-accent/30 rounded">
                        <input
                          type="checkbox"
                          checked={isShared}
                          onChange={async (e) => {
                            const next = e.target.checked
                              ? [...proposal.sharedWith, u.id]
                              : proposal.sharedWith.filter((id) => id !== u.id);
                            const res = await updateSharing(proposal.id, { sharedWith: next });
                            if (res.error) toast.error(res.error);
                            else toast.success(e.target.checked ? `Partagé avec ${u.email}` : `Retiré ${u.email}`);
                          }}
                          className="h-4 w-4 accent-beev-bleu"
                        />
                        <span>{u.email}</span>
                        <span className="text-muted-foreground text-[10px]">({u.role})</span>
                      </label>
                    );
                  })}
                {users.filter((u) => u.role !== "visitor" && u.id !== proposal.createdBy && u.id !== proposal.assignedTo).length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 text-center">Aucun autre utilisateur disponible.</p>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">Les personnes attribuées ou cochées retrouveront cette proposition dans « Partagées avec moi » et recevront une notification.</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
