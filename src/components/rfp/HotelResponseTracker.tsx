import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, Mail, Copy, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRfps, useRfp, publicResponseUrl } from "@/lib/rfpRepo";

const STATUS_META: Record<string, { icon: typeof Clock; bg: string }> = {
  "Submetido": { icon: CheckCircle2, bg: "bg-success/15 text-success" },
  "Em preenchimento": { icon: Clock, bg: "bg-warning/15 text-warning" },
  "Não respondeu": { icon: AlertCircle, bg: "bg-destructive/15 text-destructive" },
};

export function HotelResponseTracker() {
  const { data: rfps = [] } = useRfps();
  const [rfpFilter, setRfpFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const selectedId = rfpFilter === "all" ? rfps[0]?.id ?? null : rfpFilter;
  const { data: detail } = useRfp(selectedId);

  const allInvitations = detail?.invitations ?? [];
  const filtered = useMemo(() => {
    return allInvitations.filter((h) => statusFilter === "all" || h.status === statusFilter);
  }, [allInvitations, statusFilter]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Respostas dos hotéis</h2>
          <p className="text-sm text-muted-foreground">Status individual por hotel convidado</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={rfpFilter} onValueChange={setRfpFilter}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Selecione RFP" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Primeiro RFP</SelectItem>
              {rfps.map((r) => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Submetido">Submetido</SelectItem>
              <SelectItem value="Em preenchimento">Em preenchimento</SelectItem>
              <SelectItem value="Não respondeu">Não respondeu</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hotel</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((h) => {
              const meta = STATUS_META[h.status] ?? STATUS_META["Não respondeu"];
              const url = publicResponseUrl(h.id);
              return (
                <TableRow key={h.id}>
                  <TableCell><p className="font-medium text-foreground">{h.hotel_name}</p></TableCell>
                  <TableCell className="text-sm">{h.hotel_city}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{h.hotel_email || "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className={meta.bg}>{h.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copiado"))}>
                        <Copy className="mr-1 h-3 w-3" />Link
                      </Button>
                      {h.hotel_email && (
                        <Button size="sm" variant="ghost" onClick={() => { window.location.href = `mailto:${h.hotel_email}?subject=Convite RFP&body=Acesse: ${url}`; }}>
                          <Mail className="mr-1 h-3 w-3" />Email
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Nenhum convite.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
