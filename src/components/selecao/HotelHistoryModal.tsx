import { FileText, BarChart3, Handshake, CheckSquare, Calendar, Download, ExternalLink, Trophy, TrendingDown, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AMENITY_LABELS, type AwardedHotel } from "./selectionData";

interface HotelHistoryModalProps {
  hotel: AwardedHotel | null;
  onOpenChange: (open: boolean) => void;
}

interface TimelineEvent {
  stage: "rfp" | "analysis" | "negotiation" | "selection";
  date: string;
  title: string;
  description: string;
  icon: typeof FileText;
  metric?: { label: string; value: string; tone?: "success" | "warning" | "default" };
}

function fmt$(n: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0); }

function buildTimeline(h: AwardedHotel): TimelineEvent[] {
  const start = new Date(h.contractStart).getTime();
  const day = 1000 * 60 * 60 * 24;
  const d = (offset: number) => new Date(start - offset * day).toISOString().slice(0, 10);
  const rounds = Math.max(2, Math.round((h.startingAdr - h.finalAdr) / 12) + 1);
  const savingsPct = ((h.startingAdr - h.finalAdr) / h.startingAdr) * 100;

  return [
    {
      stage: "rfp",
      date: d(120),
      title: "RFP enviado",
      description: `Convite enviado ao hotel ${h.hotel} para o ciclo anual de hospedagem corporativa em ${h.city}.`,
      icon: FileText,
      metric: { label: "City cap", value: fmt$(h.cap) },
    },
    {
      stage: "rfp",
      date: d(95),
      title: "Proposta inicial recebida",
      description: `Hotel respondeu ao RFP com ADR de ${fmt$(h.startingAdr)} para ${h.roomNights.toLocaleString("pt-BR")} room nights.`,
      icon: FileText,
      metric: { label: "ADR inicial", value: fmt$(h.startingAdr), tone: h.startingAdr > h.cap ? "warning" : "default" },
    },
    {
      stage: "analysis",
      date: d(80),
      title: "Análise comparativa",
      description: `Score técnico ${h.qualityScore}/100, compliance ${h.compliance}%, ranking #${Math.ceil((100 - h.qualityScore) / 10) + 1} no tier ${h.tier}.`,
      icon: BarChart3,
      metric: { label: "Quality score", value: `${h.qualityScore}/100`, tone: h.qualityScore >= 90 ? "success" : "default" },
    },
    {
      stage: "negotiation",
      date: d(60),
      title: `Negociação iniciada (${rounds} rodadas)`,
      description: `Contraproposta enviada visando alinhar ADR ao city cap. Hotel revisou condições incluindo ${h.amenities.map((a) => AMENITY_LABELS[a]).join(", ")}.`,
      icon: Handshake,
      metric: { label: "Δ vs inicial", value: `-${savingsPct.toFixed(1)}%`, tone: "success" },
    },
    {
      stage: "negotiation",
      date: d(35),
      title: "Acordo final fechado",
      description: `ADR fechado em ${fmt$(h.finalAdr)} com cancelamento de ${h.cancellationHours}h e pacote completo de amenities.`,
      icon: Handshake,
      metric: { label: "ADR final", value: fmt$(h.finalAdr), tone: h.finalAdr <= h.cap ? "success" : "warning" },
    },
    {
      stage: "selection",
      date: d(15),
      title: `Selecionado como ${h.status === "primary" ? "Primário" : "Backup"}`,
      description: `Hotel incluído no programa anual ${new Date(h.contractStart).getFullYear()}–${new Date(h.contractEnd).getFullYear()} para ${h.city}, vigência ${h.contractStart} a ${h.contractEnd}.`,
      icon: CheckSquare,
      metric: { label: "Spend anual", value: fmt$(h.finalAdr * h.roomNights), tone: "success" },
    },
  ];
}

const STAGE_META: Record<TimelineEvent["stage"], { label: string; cls: string; ring: string }> = {
  rfp: { label: "RFP", cls: "bg-info-soft text-info", ring: "ring-info/30" },
  analysis: { label: "Análise", cls: "bg-warning-soft text-warning-foreground", ring: "ring-warning/30" },
  negotiation: { label: "Negociação", cls: "bg-primary-soft text-primary", ring: "ring-primary/30" },
  selection: { label: "Seleção", cls: "bg-success-soft text-success", ring: "ring-success/30" },
};

function buildDocuments(h: AwardedHotel) {
  return [
    { name: `RFP_${h.hotel.replace(/\s+/g, "_")}_2025.pdf`, type: "RFP", size: "184 KB", date: "2025-02-01" },
    { name: `Proposta_inicial_${h.brand}_${h.city.replace(/\s+/g, "")}.xlsx`, type: "Proposta", size: "42 KB", date: "2025-02-26" },
    { name: `Scorecard_analise_${h.id}.pdf`, type: "Análise", size: "96 KB", date: "2025-03-13" },
    { name: `Contrato_final_${h.hotel.replace(/\s+/g, "_")}.pdf`, type: "Contrato", size: "312 KB", date: "2025-05-17" },
  ];
}

export function HotelHistoryModal({ hotel, onOpenChange }: HotelHistoryModalProps) {
  if (!hotel) return null;
  const timeline = buildTimeline(hotel);
  const docs = buildDocuments(hotel);
  const savings = (hotel.startingAdr - hotel.finalAdr) * hotel.roomNights;
  const savingsPct = ((hotel.startingAdr - hotel.finalAdr) / hotel.startingAdr) * 100;

  return (
    <Dialog open={!!hotel} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {hotel.tier}
                  </span>
                  <span className="text-xs text-muted-foreground">{hotel.city} · {hotel.brand}</span>
                </div>
                <DialogTitle className="mt-1">{hotel.hotel}</DialogTitle>
                <DialogDescription>
                  Histórico completo do hotel: do RFP à seleção final no programa.
                </DialogDescription>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
              hotel.status === "primary" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
            }`}>
              {hotel.status === "primary" ? <><Trophy className="h-3 w-3" /> Primário</> : "Backup"}
            </span>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 divide-x divide-border rounded-lg border border-border md:grid-cols-4">
          <Metric label="ADR final" value={fmt$(hotel.finalAdr)} tone={hotel.finalAdr <= hotel.cap ? "success" : "warning"} />
          <Metric label="City cap" value={fmt$(hotel.cap)} />
          <Metric label="Room nights" value={hotel.roomNights.toLocaleString("pt-BR")} />
          <Metric label="Economia" value={`-${savingsPct.toFixed(1)}%`} hint={fmt$(savings)} tone="success" />
        </div>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            Timeline do processo
          </h3>
          <ol className="relative ml-3 space-y-4 border-l border-border pl-6">
            {timeline.map((ev, i) => {
              const Icon = ev.icon;
              const meta = STAGE_META[ev.stage];
              return (
                <li key={i} className="relative">
                  <span className={`absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full bg-card ring-4 ${meta.ring} ${meta.cls}`}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="rounded-md border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.cls}`}>
                          {meta.label}
                        </span>
                        <p className="text-sm font-medium text-foreground">{ev.title}</p>
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {new Date(ev.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{ev.description}</p>
                    {ev.metric && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-muted/60 px-2 py-1 text-[11px]">
                        <span className="text-muted-foreground">{ev.metric.label}:</span>
                        <span className={`font-mono font-semibold tabular-nums ${
                          ev.metric.tone === "success" ? "text-success" :
                          ev.metric.tone === "warning" ? "text-warning-foreground" : "text-foreground"
                        }`}>{ev.metric.value}</span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            Documentos
          </h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {docs.map((doc) => (
              <li key={doc.name} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{doc.name}</p>
                    <p className="text-[10px] text-muted-foreground">{doc.type} · {doc.size} · {new Date(doc.date).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-muted/30 p-3">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
            <Shield className="h-3.5 w-3.5 text-primary" />
            Resumo do contrato
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs md:grid-cols-3">
            <div><dt className="text-muted-foreground">Vigência</dt><dd className="font-medium text-foreground">{hotel.contractStart} → {hotel.contractEnd}</dd></div>
            <div><dt className="text-muted-foreground">Cancelamento</dt><dd className="font-medium text-foreground">{hotel.cancellationHours}h</dd></div>
            <div><dt className="text-muted-foreground">Compliance</dt><dd className="font-medium text-foreground">{hotel.compliance}%</dd></div>
            <div className="col-span-2 md:col-span-3">
              <dt className="text-muted-foreground">Amenities incluídas</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {hotel.amenities.map((a) => (
                  <span key={a} className="rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-foreground ring-1 ring-border">
                    {AMENITY_LABELS[a] ?? a}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </section>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button size="sm">
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir contrato
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "success" | "warning" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning-foreground" : "text-foreground";
  return (
    <div className="px-3 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${cls}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// silence unused import warning if savings unused
export const _UNUSED = TrendingDown;
