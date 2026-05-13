import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, FileText, MapPin, Users, ListChecks, Send, Target } from "lucide-react";
import { RfpPoiStep, type RfpPoi } from "./RfpPoiStep";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RFP_REQUIREMENT_TEMPLATES } from "./rfpProgramData";

const CITIES = [
  "São Paulo", "Rio de Janeiro", "Belo Horizonte", "Brasília", "Curitiba",
  "Porto Alegre", "Recife", "Salvador", "Foz do Iguaçu", "Buenos Aires",
  "Santiago", "Lima", "Bogotá", "Cidade do México", "Miami", "Nova York",
];

const STEPS = [
  { id: 1, label: "Briefing", icon: FileText },
  { id: 2, label: "Cobertura", icon: MapPin },
  { id: 3, label: "Pontos de interesse", icon: Target },
  { id: 4, label: "Hotéis", icon: Users },
  { id: 5, label: "Requisitos", icon: ListChecks },
  { id: 6, label: "Distribuição", icon: Send },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateRfpWizard({ open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [client, setClient] = useState("Acme Holdings");
  const [cycle, setCycle] = useState("2026");
  const [briefing, setBriefing] = useState("");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [pois, setPois] = useState<RfpPoi[]>([]);
  const [hotelStrategy, setHotelStrategy] = useState("preferred");
  const [estimatedHotels, setEstimatedHotels] = useState("80");
  const [reqs, setReqs] = useState<string[]>(
    RFP_REQUIREMENT_TEMPLATES.filter((r) => r.required).map((r) => r.id),
  );
  const [deadline, setDeadline] = useState("2025-12-15");
  const [openDate, setOpenDate] = useState("2025-11-01");

  const reset = () => {
    setStep(1);
    setName("");
    setBriefing("");
    setSelectedCities([]);
    setPois([]);
    setReqs(RFP_REQUIREMENT_TEMPLATES.filter((r) => r.required).map((r) => r.id));
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleCity = (c: string) => {
    setSelectedCities((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const toggleReq = (id: string) => {
    setReqs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const canAdvance = () => {
    if (step === 1) return name.trim().length > 0 && briefing.trim().length > 0;
    if (step === 2) return selectedCities.length > 0;
    if (step === 5) return reqs.length > 0;
    return true;
  };

  const handleSubmit = () => {
    toast.success(`RFP "${name}" criado e distribuído para ~${estimatedHotels} hotéis em ${selectedCities.length} cidades`);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Criar novo RFP</DialogTitle>
          <DialogDescription>
            Etapa {step} de {STEPS.length}: {STEPS[step - 1].label}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex items-center justify-between">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const completed = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                      completed
                        ? "border-success bg-success text-success-foreground"
                        : active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {completed ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span
                    className={`mt-1 text-[10px] font-medium ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`mx-2 h-0.5 flex-1 ${
                      completed ? "bg-success" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="min-h-[280px] space-y-4">
          {step === 1 && (
            <>
              <div>
                <Label htmlFor="name">Nome do RFP</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: RFP Global 2026 — Programa Corporativo"
                  maxLength={120}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="client">Cliente</Label>
                  <Select value={client} onValueChange={setClient}>
                    <SelectTrigger id="client">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Acme Holdings">Acme Holdings</SelectItem>
                      <SelectItem value="Globex Pharma">Globex Pharma</SelectItem>
                      <SelectItem value="Initech Industries">Initech Industries</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cycle">Ciclo</Label>
                  <Select value={cycle} onValueChange={setCycle}>
                    <SelectTrigger id="cycle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                      <SelectItem value="2027">2027</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="briefing">Briefing</Label>
                <Textarea
                  id="briefing"
                  value={briefing}
                  onChange={(e) => setBriefing(e.target.value)}
                  placeholder="Contexto do programa, objetivos, público-alvo de viajantes..."
                  rows={5}
                  maxLength={1000}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {briefing.length}/1000 caracteres
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-muted-foreground">
                Selecione as cidades onde o programa será aplicado.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {CITIES.map((c) => {
                  const active = selectedCities.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCity(c)}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        active
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-card text-foreground hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{c}</span>
                        {active && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{selectedCities.length}</strong> cidades selecionadas
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Label>Estratégia de convite</Label>
                <Select value={hotelStrategy} onValueChange={setHotelStrategy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preferred">Apenas hotéis preferenciais (Preferred + Strategic)</SelectItem>
                    <SelectItem value="open">Mercado aberto — todos hotéis qualificados</SelectItem>
                    <SelectItem value="curated">Lista curada manualmente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="estimated">Hotéis estimados</Label>
                <Input
                  id="estimated"
                  type="number"
                  value={estimatedHotels}
                  onChange={(e) => setEstimatedHotels(e.target.value)}
                  min={1}
                  max={500}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Baseado em {selectedCities.length} cidades e estratégia "{hotelStrategy}"
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                Os hotéis serão filtrados automaticamente pela estratégia escolhida e
                pelos clusters definidos no módulo de Estratégia.
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-sm text-muted-foreground">
                Marque os requisitos obrigatórios e desejáveis para participar do programa.
              </p>
              <div className="space-y-2">
                {RFP_REQUIREMENT_TEMPLATES.map((r) => {
                  const checked = reqs.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                        checked ? "border-primary bg-primary-soft/50" : "border-border bg-card"
                      }`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleReq(r.id)} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{r.label}</p>
                          {r.required && (
                            <Badge variant="secondary" className="bg-warning/15 text-warning text-[10px]">
                              Obrigatório
                            </Badge>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="open">Data de abertura</Label>
                  <Input
                    id="open"
                    type="date"
                    value={openDate}
                    onChange={(e) => setOpenDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="deadline">Prazo final</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-semibold text-foreground">Resumo do RFP</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">Nome:</dt>
                  <dd className="font-medium text-foreground">{name || "—"}</dd>
                  <dt className="text-muted-foreground">Cliente:</dt>
                  <dd className="font-medium text-foreground">{client}</dd>
                  <dt className="text-muted-foreground">Ciclo:</dt>
                  <dd className="font-medium text-foreground">{cycle}</dd>
                  <dt className="text-muted-foreground">Cidades:</dt>
                  <dd className="font-medium text-foreground">{selectedCities.length}</dd>
                  <dt className="text-muted-foreground">Hotéis estimados:</dt>
                  <dd className="font-medium text-foreground">~{estimatedHotels}</dd>
                  <dt className="text-muted-foreground">Requisitos:</dt>
                  <dd className="font-medium text-foreground">{reqs.length}</dd>
                  <dt className="text-muted-foreground">Distribuição:</dt>
                  <dd className="font-medium text-foreground">{openDate} → {deadline}</dd>
                </dl>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            {step < STEPS.length ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
                Próximo
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit}>
                <Send className="mr-1.5 h-4 w-4" />
                Distribuir RFP
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
