import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { Search, Calendar, Users, MapPin, Eye, Send, FileDown, Plus } from "lucide-react";
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
import { useRfps } from "@/lib/rfpRepo";

const STATUS_TONE: Record<string, string> = {
  "Rascunho": "bg-muted text-muted-foreground",
  "Em distribuição": "bg-primary-soft text-primary",
  "Coletando respostas": "bg-warning/15 text-warning",
  "Em análise": "bg-accent text-accent-foreground",
  "Encerrado": "bg-success/15 text-success",
};

interface Props {
  onView: (rfpId: string) => void;
  onCreate?: () => void;
}

export function RfpProgramList({ onView, onCreate }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: rfps = [], isLoading, refetch } = useRfps();

  // Refetch when remounted to pick up freshly created
  useEffect(() => { refetch(); }, [refetch]);

  const filtered = useMemo(() => {
    return rfps.filter((r) => {
      const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.client_name ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rfps, search, statusFilter]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Programas de RFP</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} de {rfps.length} programas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar RFP ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 pl-8" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Rascunho">Rascunho</SelectItem>
              <SelectItem value="Em distribuição">Em distribuição</SelectItem>
              <SelectItem value="Coletando respostas">Coletando respostas</SelectItem>
              <SelectItem value="Em análise">Em análise</SelectItem>
              <SelectItem value="Encerrado">Encerrado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => toast.success("Em breve: exportação CSV.")}>
            <FileDown className="mr-1.5 h-4 w-4" />Exportar
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>}
        {filtered.map((rfp) => {
          const responseRate = rfp.invited_count > 0 ? Math.round((rfp.responded_count / rfp.invited_count) * 100) : 0;
          const cities = Array.isArray((rfp.metadata as Record<string, unknown>)?.cities)
            ? ((rfp.metadata as Record<string, unknown>).cities as string[])
            : [];
          const daysToDeadline = rfp.deadline ? Math.ceil((new Date(rfp.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
          return (
            <div key={rfp.id} className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{rfp.name}</h3>
                    <Badge className={STATUS_TONE[rfp.status] ?? "bg-muted text-muted-foreground"} variant="secondary">{rfp.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {rfp.client_name || "Cliente"} · Ciclo {String((rfp.metadata as Record<string, unknown>)?.cycle ?? "—")}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                    <Stat icon={Users} label="Convidados" value={String(rfp.invited_count)} />
                    <Stat icon={MapPin} label="Cidades" value={String(cities.length)} />
                    <Stat icon={Calendar} label="Prazo" value={rfp.deadline ? (daysToDeadline > 0 ? `${daysToDeadline}d` : `${Math.abs(daysToDeadline)}d atrás`) : "—"} tone={daysToDeadline < 7 && daysToDeadline > 0 ? "warning" : "default"} />
                    <Stat icon={Send} label="Resposta" value={`${responseRate}%`} tone={responseRate >= 70 ? "success" : responseRate >= 40 ? "warning" : "default"} />
                  </div>
                  <div className="mt-3">
                    <Progress value={responseRate} className="h-1.5" />
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => onView(rfp.id)}>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />Detalhes
                </Button>
              </div>
            </div>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum RFP ainda.</p>
            {onCreate && <Button className="mt-3" onClick={onCreate}><Plus className="mr-1.5 h-4 w-4" />Criar primeiro RFP</Button>}
          </div>
        )}
      </div>
    </Card>
  );
}

function Stat({ icon: Icon, label, value, tone = "default" }: { icon: typeof Calendar; label: string; value: string; tone?: "default" | "success" | "warning" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" /><span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-0.5 text-sm font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
