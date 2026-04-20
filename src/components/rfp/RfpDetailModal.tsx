import { toast } from "sonner";
import { Calendar, Users, MapPin, DollarSign, User, Send, Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { RfpProgram } from "./rfpProgramData";

interface Props {
  rfp: RfpProgram | null;
  onClose: () => void;
}

export function RfpDetailModal({ rfp, onClose }: Props) {
  if (!rfp) return null;
  const responseRate = rfp.invitedHotels > 0 ? Math.round((rfp.responsesReceived / rfp.invitedHotels) * 100) : 0;

  return (
    <Dialog open={!!rfp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rfp.name}</DialogTitle>
          <DialogDescription>
            {rfp.client} · Ciclo {rfp.cycle} · Owner {rfp.owner}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary-soft text-primary">
              {rfp.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Criado em {rfp.createdAt} · Prazo {rfp.deadline}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={Users} label="Convidados" value={String(rfp.invitedHotels)} />
            <Stat icon={Send} label="Respostas" value={`${rfp.responsesReceived} (${responseRate}%)`} />
            <Stat icon={MapPin} label="Cidades" value={String(rfp.cities.length)} />
            <Stat
              icon={DollarSign}
              label="Spend estimado"
              value={`$ ${(rfp.estimatedSpend / 1_000_000).toFixed(1)}M`}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progresso geral do programa</span>
              <span className="font-medium text-foreground">{rfp.progress}%</span>
            </div>
            <Progress value={rfp.progress} className="h-2" />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              Cidades cobertas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rfp.cities.map((c) => (
                <Badge key={c} variant="outline" className="text-xs">
                  {c}
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Linha do tempo
            </p>
            <ol className="space-y-2 text-sm">
              <TimelineItem date={rfp.createdAt} label="RFP criado" done />
              <TimelineItem
                date={rfp.createdAt}
                label="Distribuído para hotéis"
                done={rfp.status !== "Rascunho"}
              />
              <TimelineItem
                date="Em andamento"
                label="Coleta de respostas"
                done={rfp.status === "Em análise" || rfp.status === "Encerrado"}
                active={rfp.status === "Coletando respostas" || rfp.status === "Em distribuição"}
              />
              <TimelineItem
                date={rfp.deadline}
                label="Prazo final"
                done={rfp.status === "Encerrado"}
                active={rfp.status === "Em análise"}
              />
            </ol>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info(`Owner ${rfp.owner} notificado`)}
            >
              <User className="mr-1.5 h-3.5 w-3.5" />
              Falar com owner
            </Button>
            {rfp.status === "Coletando respostas" && (
              <Button
                size="sm"
                onClick={() =>
                  toast.success(
                    `Lembrete enviado para ${rfp.invitedHotels - rfp.responsesReceived} hotéis pendentes`,
                  )
                }
              >
                <Bell className="mr-1.5 h-3.5 w-3.5" />
                Enviar lembrete em massa
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TimelineItem({
  date,
  label,
  done = false,
  active = false,
}: {
  date: string;
  label: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <li className="flex items-center gap-3">
      <div
        className={`h-2.5 w-2.5 rounded-full ${
          done ? "bg-success" : active ? "bg-primary animate-pulse" : "bg-muted-foreground/40"
        }`}
      />
      <div className="flex-1">
        <p className={`text-sm ${done || active ? "font-medium text-foreground" : "text-muted-foreground"}`}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
    </li>
  );
}
