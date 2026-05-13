import { useMemo, useState } from "react";
import { Gavel, AlertCircle, Eye, ArrowLeft, Check, Hotel, Timer, MapPin, TrendingDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuctionLot } from "./negotiationData";

const CITY_OPTIONS = ["São Paulo", "Rio de Janeiro", "Brasília", "Belo Horizonte", "Curitiba", "Porto Alegre", "Recife", "Salvador"] as const;
const TIER_OPTIONS = ["Luxury", "Upscale", "Midscale"] as const;
const HOTEL_SUGGESTIONS = [
  "Marriott Paulista", "Hilton Morumbi", "Pullman Vila Olímpia", "Sheraton WTC",
  "Renaissance Faria Lima", "Grand Hyatt SP", "Tivoli Mofarrej",
  "Fairmont Copacabana", "Belmond Copacabana Palace", "JW Marriott Copacabana",
  "InterContinental Rio", "Windsor Atlântica", "Hilton Copacabana",
  "Royal Tulip Brasília", "Meliá Brasil 21", "Kubitschek Plaza",
  "Novotel Center Norte", "Mercure Pinheiros",
];

interface FormState {
  city: string;
  tier: AuctionLot["tier"] | "";
  roomNights: string;
  cap: string;
  startingAdr: string;
  durationHours: string;
  invitedHotels: string[];
  notes: string;
}

const INITIAL: FormState = {
  city: "",
  tier: "",
  roomNights: "",
  cap: "",
  startingAdr: "",
  durationHours: "24",
  invitedHotels: [],
  notes: "",
};

interface CreateLotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublish: (lot: AuctionLot) => void;
}

export function CreateLotModal({ open, onOpenChange, onPublish }: CreateLotModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [step, setStep] = useState<"form" | "preview">("form");
  const [hotelInput, setHotelInput] = useState("");

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.city) e.city = "Selecione uma cidade";
    if (!form.tier) e.tier = "Selecione um tier";
    const rn = Number(form.roomNights);
    if (!form.roomNights || Number.isNaN(rn) || rn < 50) e.roomNights = "Mínimo 50 room nights";
    else if (rn > 50000) e.roomNights = "Máximo 50.000 room nights";
    const cap = Number(form.cap);
    if (!form.cap || Number.isNaN(cap) || cap < 50) e.cap = "Cap deve ser ≥ R$ 50";
    const adr = Number(form.startingAdr);
    if (!form.startingAdr || Number.isNaN(adr) || adr < 50) e.startingAdr = "ADR inicial deve ser ≥ R$ 50";
    else if (cap && adr <= cap) e.startingAdr = "ADR inicial deve ser maior que o cap";
    const dur = Number(form.durationHours);
    if (!form.durationHours || Number.isNaN(dur) || dur < 1) e.durationHours = "Mínimo 1 hora";
    else if (dur > 168) e.durationHours = "Máximo 168 horas (7 dias)";
    if (form.invitedHotels.length < 2) e.invitedHotels = "Convide pelo menos 2 hotéis";
    else if (form.invitedHotels.length > 12) e.invitedHotels = "Máximo 12 hotéis";
    if (form.notes.length > 500) e.notes = "Máximo 500 caracteres";
    return e;
  }, [form]);

  const isValid = Object.keys(errors).length === 0;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addHotel = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || form.invitedHotels.includes(trimmed) || form.invitedHotels.length >= 12) return;
    update("invitedHotels", [...form.invitedHotels, trimmed]);
    setHotelInput("");
  };

  const removeHotel = (name: string) =>
    update("invitedHotels", form.invitedHotels.filter((h) => h !== name));

  const reset = () => {
    setForm(INITIAL);
    setStep("form");
    setHotelInput("");
  };

  const handlePublish = () => {
    const adr = Number(form.startingAdr);
    const cap = Number(form.cap);
    const rn = Number(form.roomNights);
    const dur = Number(form.durationHours);
    const lot: AuctionLot = {
      id: `lot-${Date.now()}`,
      city: form.city,
      tier: form.tier as AuctionLot["tier"],
      roomNights: rn,
      cap,
      startingAdr: adr,
      currentBest: adr,
      bidsCount: 0,
      participants: form.invitedHotels.length,
      endsInMinutes: Math.round(dur * 60),
      status: "live",
      bids: [],
    };
    onPublish(lot);
    reset();
    onOpenChange(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const previewSavings = (() => {
    const adr = Number(form.startingAdr) || 0;
    const cap = Number(form.cap) || 0;
    const rn = Number(form.roomNights) || 0;
    return { perNight: adr - cap, total: (adr - cap) * rn, pct: adr ? (((adr - cap) / adr) * 100).toFixed(1) : "0" };
  })();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary">
              <Gavel className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{step === "form" ? "Criar novo lote" : "Revisar lote antes de publicar"}</DialogTitle>
              <DialogDescription>
                {step === "form"
                  ? "Defina parâmetros do leilão reverso e convide hotéis."
                  : "Confira os detalhes. Hotéis serão notificados ao publicar."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Cidade" error={errors.city}>
                <Select value={form.city} onValueChange={(v) => update("city", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CITY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tier" error={errors.tier}>
                <Select value={form.tier} onValueChange={(v) => update("tier", v as AuctionLot["tier"])}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {TIER_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Room nights" error={errors.roomNights}>
                <Input type="number" inputMode="numeric" placeholder="ex: 2500" value={form.roomNights}
                  onChange={(e) => update("roomNights", e.target.value)} />
              </Field>
              <Field label="City cap (BRL)" error={errors.cap}>
                <Input type="number" inputMode="numeric" placeholder="ex: 290" value={form.cap}
                  onChange={(e) => update("cap", e.target.value)} />
              </Field>
              <Field label="ADR inicial (BRL)" error={errors.startingAdr}>
                <Input type="number" inputMode="numeric" placeholder="ex: 320" value={form.startingAdr}
                  onChange={(e) => update("startingAdr", e.target.value)} />
              </Field>
            </div>

            <Field label="Duração (horas)" error={errors.durationHours} hint="Quanto tempo o leilão fica aberto (1–168h).">
              <Input type="number" inputMode="numeric" placeholder="24" value={form.durationHours}
                onChange={(e) => update("durationHours", e.target.value)} />
            </Field>

            <Field label="Hotéis convidados" error={errors.invitedHotels} hint={`${form.invitedHotels.length}/12 selecionados (mínimo 2).`}>
              <div className="flex gap-2">
                <Input
                  list="hotel-suggestions"
                  placeholder="Digite e pressione Enter"
                  value={hotelInput}
                  onChange={(e) => setHotelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addHotel(hotelInput); }
                  }}
                />
                <datalist id="hotel-suggestions">
                  {HOTEL_SUGGESTIONS.filter((h) => !form.invitedHotels.includes(h)).map((h) =>
                    <option key={h} value={h} />)}
                </datalist>
                <Button type="button" variant="outline" size="sm" onClick={() => addHotel(hotelInput)}
                  disabled={!hotelInput.trim() || form.invitedHotels.length >= 12}>
                  Adicionar
                </Button>
              </div>
              {form.invitedHotels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.invitedHotels.map((h) => (
                    <span key={h} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-1 text-xs text-primary">
                      <Hotel className="h-3 w-3" />{h}
                      <button type="button" onClick={() => removeHotel(h)} className="ml-1 rounded-full hover:bg-primary/20 px-1" aria-label={`Remover ${h}`}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </Field>

            <Field label="Observações (opcional)" error={errors.notes} hint={`${form.notes.length}/500`}>
              <Textarea rows={3} placeholder="Termos especiais, café da manhã, cancelamento..." value={form.notes}
                onChange={(e) => update("notes", e.target.value)} />
            </Field>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{form.tier}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />{form.city}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-lg font-semibold text-foreground">Lote {form.city} · {form.tier}</h3>
                  <p className="text-xs text-muted-foreground">
                    {Number(form.roomNights).toLocaleString("pt-BR")} room nights · cap ${form.cap}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <Timer className="h-3 w-3" /> duração
                  </div>
                  <p className="mt-0.5 font-mono text-lg font-bold text-foreground">{form.durationHours}h</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border">
              <PreviewMetric label="ADR inicial" value={`$${form.startingAdr}`} />
              <PreviewMetric label="City cap" value={`$${form.cap}`} />
              <PreviewMetric label="Economia/noite" value={`-$${previewSavings.perNight}`} hint={`${previewSavings.pct}%`} tone="success" />
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                <TrendingDown className="h-3 w-3" /> Economia projetada total
              </p>
              <p className="mt-1 text-2xl font-bold text-success">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(previewSavings.total)}</p>
              <p className="text-[11px] text-muted-foreground">se todos os room nights fecharem ao city cap</p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                <Users className="h-3 w-3" /> Hotéis convidados ({form.invitedHotels.length})
              </p>
              <ul className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-2">
                {form.invitedHotels.map((h) => (
                  <li key={h} className="flex items-center gap-2 text-xs text-foreground">
                    <Check className="h-3 w-3 text-success" />{h}
                  </li>
                ))}
              </ul>
            </div>

            {form.notes && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Observações</p>
                <p className="mt-1 text-xs text-foreground">{form.notes}</p>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-xs text-warning-foreground">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Ao publicar, os {form.invitedHotels.length} hotéis serão notificados e o cronômetro inicia imediatamente.</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {step === "form" ? (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={() => setStep("preview")} disabled={!isValid}>
                <Eye className="h-3.5 w-3.5" /> Pré-visualizar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("form")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar e editar
              </Button>
              <Button onClick={handlePublish}>
                <Gavel className="h-3.5 w-3.5" /> Publicar lote
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3" />{error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function PreviewMetric({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "success" }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-base font-bold ${tone === "success" ? "text-success" : "text-foreground"}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
