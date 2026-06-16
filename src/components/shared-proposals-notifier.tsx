// Notifie l'utilisateur, à la connexion, qu'une (ou plusieurs) proposition(s)
// lui ont été partagées par un autre commercial. Les propositions déjà notifiées
// sont mémorisées en localStorage (par utilisateur) pour ne notifier que les
// nouveautés. Un clic sur « Voir » ouvre « Partagées avec moi ».

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useProposals } from "@/lib/proposals";

export function SharedProposalsNotifier() {
  const { user } = useAuth();
  const { proposals } = useProposals();
  const firedRef = useRef(false);

  useEffect(() => {
    const uid = user?.id;
    if (!uid || proposals.length === 0) return;

    const sharedWithMe = proposals.filter(
      (p) => p.createdBy !== uid && (p.sharedWith.includes(uid) || p.assignedTo === uid),
    );
    if (sharedWithMe.length === 0) return;

    const key = `beev_seen_shared_${uid}`;
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem(key) || "[]"); } catch { /* ignore */ }
    const fresh = sharedWithMe.filter((p) => !seen.includes(p.id));
    if (fresh.length === 0) return;

    // Évite un double déclenchement lors d'un refetch rapide.
    if (firedRef.current) return;
    firedRef.current = true;

    const msg = fresh.length === 1
      ? `Une proposition « ${fresh[0].clientCompany || "Sans nom"} » a été partagée avec vous`
      : `${fresh.length} propositions ont été partagées avec vous`;
    toast.info(msg, {
      duration: 9000,
      description: "Retrouvez-les dans « Partagées avec moi ».",
      action: { label: "Voir", onClick: () => { window.location.href = "/proposals"; } },
    });

    try { localStorage.setItem(key, JSON.stringify([...seen, ...fresh.map((p) => p.id)])); } catch { /* ignore */ }
  }, [user, proposals]);

  return null;
}
