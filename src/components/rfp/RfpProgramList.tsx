import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Search, Calendar, Users, MapPin, Eye, Send, FileDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RFP_PROGRAMS, type RfpProgram, type RfpProgramStatus } from "./rfpProgramData";

const STATUS_TONE: Record<RfpProgramStatus, string> = {
  "Rascunho": "bg-muted text-muted-foreground",
  "Em distribuição": "bg-primary-soft text-primary",
  "Coletando respostas": "bg-warning/15 text-warning",
  "Em análise": "bg-accent text-accent-foreground",
  "Encerrado": "bg-success/15 text-success",
};

interface Props {
  onView: (rfp: RfpProgram) => void;
}

export function RfpProgramList({ onView }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return RFP_PROGRAMS.filter((r) => {
      const matchSearch =
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.client.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Programas de RFP</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} de {RFP_PROGRAMS.length} programas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar RFP ou cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Rascunho">Rascunho</SelectItem>
              <SelectItem value="Em distribuição">Em distribuição</SelectItem>
              <SelectItem value="Coletando respostas">Coletando respostas</SelectItem>
              <SelectItem value="Em análise">Em análise</SelectItem>
              <SelectItem value="Encerrado">Encerrado</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success("Exportando lista de RFPs em CSV...")}
          >
            <FileDown className="mr-1.5 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((rfp) => {
          const responseRate = rfp.invitedHotels > 0 ? Math.round((rfp.responsesReceived / rfp.invitedHotels) * 100) : 0;
          const daysToDeadline = Math.ceil(
            (new Date(rfp.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          );
          return (
            <div
              key={rfp.id}
              className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{rfp.name}</h3>
                    <Badge className={STATUS_TONE[rfp.status]} variant="secondary">
                      {rfp.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {rfp.client} · Ciclo {rfp.cycle} · Owner: {rfp.owner}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                    <Stat icon={Users} label="Hotéis convidados" value={String(rfp.invitedHotels)} />
                    <Stat icon={MapPin} label="Cidades" value={`${rfp.cities.length}`} />
                    <Stat
                      icon={Calendar}
                      label="Prazo"
                      value={
                        rfp.status === "Encerrado"
                          ? "Encerrado"
                          : daysToDeadline > 0
                            ? `${daysToDeadline}d restantes`
                            : `${Math.abs(daysToDeadline)}d atrasado`
                      }
                      tone={daysToDeadline < 7 && rfp.status !== "Encerrado" ? "warning" : "default"}
                    />
                    <Stat
                      icon={Send}
                      label="Taxa de resposta"
                      value={`${responseRate}%`}
                      tone={responseRate >= 70 ? "success" : responseRate >= 40 ? "warning" : "default"}
                    />
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progresso do programa</span>
                      <span className="font-medium text-foreground">{rfp.progress}%</span>
                    </div>
                    <Progress value={rfp.progress} className="h-1.5" />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={() => onView(rfp)}>
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Detalhes
                  </Button>
                  {rfp.status === "Coletando respostas" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        toast.success(`Lembrete enviado para ${rfp.invitedHotels - rfp.responsesReceived} hotéis pendentes`)
                      }
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      Enviar lembrete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhum RFP encontrado com os filtros atuais.
          </p>
        )}
      </div>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const cls =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-0.5 text-sm font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
