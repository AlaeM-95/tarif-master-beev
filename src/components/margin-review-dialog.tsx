import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Percent, FileText, ExternalLink, FileDown } from "lucide-react";
import { lineItemClientUnit, lineItemClientTotal, type SelectedCharger } from "@/lib/pdf";
import type { LineItem } from "@/lib/catalog";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

type Props = {
  open: boolean;
  onClose: () => void;
  selectedChargers: SelectedCharger[];
  onUpdateLineItem: (chargerId: string, lineIndex: number, patch: Partial<LineItem>) => void;
  onConfirm: () => Promise<void> | void;
};

export function MarginReviewDialog({ open, onClose, selectedChargers, onUpdateLineItem, onConfirm }: Props) {
  let grandTotalClient = 0;
  let grandTotalAchat = 0;
  selectedChargers.forEach((sc) => {
    sc.lineItems.forEach((li) => {
      grandTotalClient += lineItemClientTotal(li) * sc.quantity;
      grandTotalAchat += li.qty * li.unitHt * sc.quantity;
    });
  });
  const margeAbs = grandTotalClient - grandTotalAchat;
  const margePct = grandTotalAchat > 0 ? (margeAbs / grandTotalAchat) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-[#3809EA]" /> Validation des marges avant génération
          </DialogTitle>
          <DialogDescription>
            Ajustez les marges par ligne. Les <strong>PU client</strong> sont les seuls
            prix qui apparaîtront dans le PDF client. Le <strong>prix d'achat (technicien)</strong>
            et la <strong>marge</strong> restent privés.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {selectedChargers.map((sc) => {
            const totalAchat = sc.lineItems.reduce((a, li) => a + li.qty * li.unitHt, 0);
            const totalClient = sc.lineItems.reduce((a, li) => a + lineItemClientTotal(li), 0);
            const margeSite = totalClient - totalAchat;
            const margeSitePct = totalAchat > 0 ? (margeSite / totalAchat) * 100 : 0;

            return (
              <div key={sc.charger.id} className="rounded-lg border border-border overflow-hidden">
                <div className="bg-[#FAF8F4] px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-semibold text-sm">{sc.charger.brand} {sc.charger.model}</p>
                    <p className="text-xs text-muted-foreground">{sc.siteName || "Site non nommé"} · {sc.quantity} borne(s)</p>
                  </div>
                  {sc.technicianQuoteUrl && (
                    <Button asChild variant="outline" size="sm" className="gap-2">
                      <a href={sc.technicianQuoteUrl} target="_blank" rel="noopener noreferrer">
                        <FileText className="w-3 h-3" /> Voir devis technicien <ExternalLink className="w-3 h-3" />
                      </a>
                    </Button>
                  )}
                </div>

                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-[1fr_50px_90px_90px_100px] gap-2 text-[10px] uppercase text-muted-foreground px-1">
                    <span>Désignation</span>
                    <span className="text-right">Qté</span>
                    <span className="text-right">PU achat</span>
                    <span className="text-right text-[#3809EA]">Marge %</span>
                    <span className="text-right">PU client</span>
                  </div>
                  {sc.lineItems.map((li, i) => (
                    <div key={i} className="grid grid-cols-[1fr_50px_90px_90px_100px] gap-2 items-center text-xs">
                      <span className="truncate">{li.label}</span>
                      <span className="text-right">{li.qty}</span>
                      <span className="text-right text-muted-foreground">{fmt(li.unitHt)}</span>
                      <Input
                        type="number"
                        value={li.marginPct ?? 0}
                        onChange={(e) => onUpdateLineItem(sc.charger.id, i, { marginPct: Number(e.target.value) })}
                        className="h-7 text-xs text-right border-[#3809EA]/30"
                        step={0.5}
                      />
                      <span className="text-right font-semibold text-[#3809EA]">{fmt(lineItemClientUnit(li))}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-[#FAF8F4] px-4 py-2 border-t flex justify-between items-center text-xs flex-wrap gap-2">
                  <span className="text-muted-foreground">Total achat <strong className="text-[#111111]">{fmt(totalAchat)}</strong></span>
                  <Badge variant="outline" className="text-[#3809EA] border-[#3809EA]/30">
                    Marge {fmt(margeSite)} ({margeSitePct.toFixed(1)} %)
                  </Badge>
                  <span className="font-semibold">Total client <strong>{fmt(totalClient)}</strong></span>
                </div>
              </div>
            );
          })}

          <div className="rounded-lg border-2 border-[#35DA76] bg-[#35DA76]/5 p-4">
            <p className="text-xs uppercase text-muted-foreground">Récapitulatif</p>
            <div className="flex items-end justify-between mt-1 flex-wrap gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Total achat (privé)</p>
                <p className="text-lg font-semibold">{fmt(grandTotalAchat)}</p>
              </div>
              <div>
                <p className="text-xs text-[#3809EA]">Marge totale (privé)</p>
                <p className="text-lg font-semibold text-[#3809EA]">{fmt(margeAbs)} ({margePct.toFixed(1)} %)</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#5F5F64]">Total client (PDF)</p>
                <p className="text-2xl font-bold text-[#111111]">{fmt(grandTotalClient)}</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={async () => { await onConfirm(); onClose(); }} className="gap-2 bg-[#111111] hover:bg-[#111111]/90">
            <FileDown className="w-4 h-4" /> Générer le PDF client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
