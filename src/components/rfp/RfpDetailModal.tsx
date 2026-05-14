import { useState } from "react";
import { Calendar, Users, MapPin, Send, Copy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRfp, publicResponseUrl, useCancelRfp } from "@/lib/rfpRepo";

interface Props {
  rfpId: string | null;
  onClose: () => void;
}

export function RfpDetailModal({ rfpId, onClose }: Props) {
  const { data, isLoading } = useRfp(rfpId);

  if (!rfpId) return null;

  return (
    <Dialog open={!!rfpId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.rfp.name ?? "Carregando..."}</DialogTitle>
          <DialogDescription>{data?.rfp.client_name ?? ""}</DialogDescription>
        </DialogHeader>

        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>}

        {data && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary-soft text-primary">{data.rfp.status}</Badge>
              <span className="text-xs text-muted-foreground">Prazo: {data.rfp.deadline ? new Date(data.rfp.deadline).toLocaleDateString() : "—"}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat icon={Users} label="Convidados" value={String(data.invitations.length)} />
              <Stat icon={Send} label="Respostas" value={String(data.responses.length)} />
              <Stat icon={MapPin} label="Cidades" value={String(((data.rfp.metadata as Record<string, unknown>)?.cities as string[] | undefined)?.length ?? 0)} />
              <Stat icon={Calendar} label="Ciclo" value={String((data.rfp.metadata as Record<string, unknown>)?.cycle ?? "—")} />
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Hotéis convidados</p>
              <div className="max-h-72 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr><th className="px-3 py-2 text-left">Hotel</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Link</th></tr>
                  </thead>
                  <tbody>
                    {data.invitations.map((inv) => {
                      const url = publicResponseUrl(inv.id);
                      return (
                        <tr key={inv.id} className="border-t border-border">
                          <td className="px-3 py-2"><p className="font-medium text-foreground">{inv.hotel_name}</p><p className="text-muted-foreground">{inv.hotel_city}</p></td>
                          <td className="px-3 py-2"><Badge variant="secondary" className={inv.status === "Submetido" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}>{inv.status}</Badge></td>
                          <td className="px-3 py-2"><Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Copiado"))}><Copy className="mr-1 h-3 w-3" />Copiar</Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {data.responses.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">Respostas recebidas</p>
                <div className="space-y-2">
                  {data.responses.map((r) => (
                    <details key={r.id} className="rounded-md border border-border bg-card p-3">
                      <summary className="cursor-pointer text-sm font-medium">Hotel {r.hotel_id.slice(0, 8)} · {new Date(r.submitted_at).toLocaleString()}</summary>
                      <pre className="mt-2 overflow-x-auto text-[11px] text-muted-foreground">{JSON.stringify(r.rates, null, 2)}</pre>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5"><Icon className="h-3 w-3 text-muted-foreground" /><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p></div>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}
