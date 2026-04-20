import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Bell, Mail, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RFP_INVITED_HOTELS, RFP_PROGRAMS, type HotelResponseStatus } from "./rfpProgramData";

const STATUS_META: Record<HotelResponseStatus, { icon: typeof Clock; tone: string; bg: string }> = {
  "Submetido": { icon: CheckCircle2, tone: "text-success", bg: "bg-success/15 text-success" },
  "Em preenchimento": { icon: Clock, tone: "text-warning", bg: "bg-warning/15 text-warning" },
  "Não respondeu": { icon: AlertCircle, tone: "text-destructive", bg: "bg-destructive/15 text-destructive" },
  "Recusado": { icon: XCircle, tone: "text-muted-foreground", bg: "bg-muted text-muted-foreground" },
};

export function HotelResponseTracker() {
  const [rfpFilter, setRfpFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const activeRfps = useMemo(
    () => RFP_PROGRAMS.filter((r) => r.status !== "Rascunho" && r.status !== "Encerrado"),
    [],
  );

  const filtered = useMemo(() => {
    return RFP_INVITED_HOTELS.filter((h) => {
      const matchRfp = rfpFilter === "all" || h.rfpId === rfpFilter;
      const matchStatus = statusFilter === "all" || h.status === statusFilter;
      return matchRfp && matchStatus;
    });
  }, [rfpFilter, statusFilter]);

  const summary = useMemo(() => {
    const acc: Record<HotelResponseStatus, number> = {
      "Submetido": 0,
      "Em preenchimento": 0,
      "Não respondeu": 0,
      "Recusado": 0,
    };
    filtered.forEach((h) => {
      acc[h.status]++;
    });
    return acc;
  }, [filtered]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Respostas dos hotéis</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe o status individual de cada hotel convidado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={rfpFilter} onValueChange={setRfpFilter}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os RFPs ativos</SelectItem>
              {activeRfps.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Submetido">Submetido</SelectItem>
              <SelectItem value="Em preenchimento">Em preenchimento</SelectItem>
              <SelectItem value="Não respondeu">Não respondeu</SelectItem>
              <SelectItem value="Recusado">Recusado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(Object.keys(summary) as HotelResponseStatus[]).map((s) => {
          const meta = STATUS_META[s];
          const Icon = meta.icon;
          return (
            <div key={s} className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${meta.tone}`} />
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {s}
                </p>
              </div>
              <p className={`mt-1 text-xl font-semibold ${meta.tone}`}>{summary[s]}</p>
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hotel</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Lembretes</TableHead>
              <TableHead>Última atividade</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((h) => {
              const meta = STATUS_META[h.status];
              return (
                <TableRow key={h.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{h.hotel}</p>
                      <p className="text-xs text-muted-foreground">{h.brand}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{h.city}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{h.contact}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={meta.bg}>
                      {h.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`text-sm font-medium ${
                        h.remindersSent >= 3 ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {h.remindersSent}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {h.respondedAt ? `Respondeu em ${h.respondedAt}` : `Enviado em ${h.sentAt}`}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {h.status === "Não respondeu" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toast.success(`Lembrete enviado para ${h.contact}`)}
                        >
                          <Bell className="mr-1 h-3 w-3" />
                          Lembrar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toast.info(`Email aberto para ${h.contact}`)}
                      >
                        <Mail className="mr-1 h-3 w-3" />
                        Contatar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum hotel encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
