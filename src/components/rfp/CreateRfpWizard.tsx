import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, FileText, MapPin, Users, ListChecks, Send, Target, Search, Copy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
import { listHotels } from "@/lib/hotelsRepo";
import { listVisibleTenants } from "@/lib/tenantsRepo";
import { useCreateRfp, publicResponseUrl } from "@/lib/rfpRepo";

const CITIES = [
  "São Paulo", "Rio de Janeiro", "Belo Horizonte", "Brasília", "Curitiba",
  "Porto Alegre", "Recife", "Salvador", "Foz do Iguaçu", "Buenos Aires",
  "Santiago", "Lima", "Bogotá", "Cidade do México", "Miami", "Nova York",
];

const STEPS = [
  { id: 1, label: "Briefing", icon: FileText },
  { id: 2, label: "Cobertura", icon: MapPin },
  { id: 3, label: "POIs", icon: Target },
  { id: 4, label: "Hotéis", icon: Users },
  { id: 5, label: "Requisitos", icon: ListChecks },
  { id: 6, label: "Distribuição", icon: Send },
];

const QUESTION_GROUPS: { id: string; label: string; description: string; required?: boolean }[] = [
  { id: "rates", label: "Tarifas (ADR LRA / não-LRA, dynamic discount, BAR-linked, moeda, validade)", description: "", required: true },
  { id: "inclusions", label: "Inclusões (café, Wi-Fi, parking, late checkout, upgrade)", description: "", required: true },
  { id: "policies", label: "Políticas (cancelamento, no-show, garantia, GDS code, comissão, central billing)", description: "", required: true },
  { id: "capacity", label: "Capacidade (nº quartos, salas de reunião, restaurante 24h)", description: "" },
  { id: "sustainability", label: "Sustentabilidade (GSTC, EarthCheck, relatório CO₂)", description: "" },
  { id: "commercial", label: "Comercial (contato, telefone, e-mail, prazo)", description: "", required: true },
];

interface Props {
  open: boolean;
  onClose: () => void;
  prefill?: { city?: string; suggestedCap?: number; name?: string };
}

export function CreateRfpWizard({ open, onClose, prefill }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [clientTenantId, setClientTenantId] = useState<string>("");
  const [cycle, setCycle] = useState("2026");
  const [briefing, setBriefing] = useState("");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [pois, setPois] = useState<RfpPoi[]>([]);
  const [hotelStrategy, setHotelStrategy] = useState<"preferred" | "open" | "curated">("preferred");
  const [selectedHotelIds, setSelectedHotelIds] = useState<Set<string>>(new Set());
  const [hotelSearch, setHotelSearch] = useState("");
  const [reqs, setReqs] = useState<string[]>(
    RFP_REQUIREMENT_TEMPLATES.filter((r) => r.required).map((r) => r.id),
  );
  const [questions, setQuestions] = useState<Record<string, boolean>>(
    () => Object.fromEntries(QUESTION_GROUPS.map((q) => [q.id, q.required ?? false])),
  );
  const [deadline, setDeadline] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10);
  });
  const [openDate, setOpenDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [createdInvitations, setCreatedInvitations] = useState<{ id: string; hotel_id: string }[] | null>(null);

  const tenants = useQuery({
    queryKey: ["tenants", "corp-list"],
    queryFn: listVisibleTenants,
  });
  const corpTenants = useMemo(
    () => (tenants.data ?? []).filter((t) => t.type === "CORP"),
    [tenants.data],
  );

  const hotels = useQuery({ queryKey: ["hotels", "all"], queryFn: listHotels });

  const createRfp = useCreateRfp();

  // Apply prefill on open
  useEffect(() => {
    if (!open) return;
    if (prefill?.city && !selectedCities.includes(prefill.city)) {
      setSelectedCities((cs) => Array.from(new Set([...cs, prefill.city!])));
    }
    if (prefill?.name && !name) setName(prefill.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Default tenant select to first CORP
  useEffect(() => {
    if (!clientTenantId && corpTenants.length > 0) setClientTenantId(corpTenants[0].id);
  }, [corpTenants, clientTenantId]);

  // Auto-recompute hotel selection when cities/strategy change
  const candidateHotels = useMemo(() => {
    const all = hotels.data ?? [];
    if (selectedCities.length === 0) return [];
    const cityNorm = new Set(selectedCities.map((c) => c.toLowerCase()));
    let pool = all.filter((h) => cityNorm.has((h.city || "").toLowerCase()));
    if (hotelStrategy === "preferred") {
      pool = pool.filter((h) => {
        const meta = h.metadata as Record<string, unknown> | undefined;
        const tier = typeof meta?.tier === "string" ? (meta.tier as string).toLowerCase() : "";
        return tier === "strategic" || tier === "preferred" || tier === "";
      });
    }
    return pool;
  }, [hotels.data, selectedCities, hotelStrategy]);

  // Auto-select all candidates when entering step 4 (unless curated)
  useEffect(() => {
    if (step !== 4) return;
    if (hotelStrategy === "curated") return;
    setSelectedHotelIds((prev) => {
      if (prev.size > 0) return prev;
      return new Set(candidateHotels.map((h) => h.id));
    });
  }, [step, candidateHotels, hotelStrategy]);

  const filteredCandidates = useMemo(() => {
    const q = hotelSearch.trim().toLowerCase();
    if (!q) return candidateHotels;
    return candidateHotels.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        (h.city ?? "").toLowerCase().includes(q) ||
        (h.code ?? "").toLowerCase().includes(q),
    );
  }, [candidateHotels, hotelSearch]);

  // Search across ALL hotels for adding outside the auto-filter
  const globalSearch = useMemo(() => {
    const q = hotelSearch.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const all = hotels.data ?? [];
    const candidateIds = new Set(candidateHotels.map((h) => h.id));
    return all
      .filter((h) => !candidateIds.has(h.id))
      .filter((h) => h.name.toLowerCase().includes(q) || (h.city ?? "").toLowerCase().includes(q))
      .slice(0, 10);
  }, [hotels.data, candidateHotels, hotelSearch]);

  const reset = () => {
    setStep(1);
    setName("");
    setBriefing("");
    setSelectedCities([]);
    setPois([]);
    setSelectedHotelIds(new Set());
    setHotelSearch("");
    setReqs(RFP_REQUIREMENT_TEMPLATES.filter((r) => r.required).map((r) => r.id));
    setCreatedInvitations(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleCity = (c: string) =>
    setSelectedCities((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const toggleReq = (id: string) =>
    setReqs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleHotel = (id: string) =>
    setSelectedHotelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canAdvance = () => {
    if (step === 1) return name.trim().length > 0 && briefing.trim().length > 0 && !!clientTenantId;
    if (step === 2) return selectedCities.length > 0;
    if (step === 4) return selectedHotelIds.size > 0;
    if (step === 5) return reqs.length > 0;
    return true;
  };

  const handleSubmit = async () => {
    if (!clientTenantId) {
      toast.error("Selecione um cliente.");
      return;
    }
    try {
      const result = await createRfp.mutateAsync({
        name,
        clientTenantId,
        cycle,
        briefing,
        cities: selectedCities,
        pois: pois as unknown[],
        hotelStrategy,
        requirements: reqs,
        questions,
        openDate,
        deadline: new Date(deadline).toISOString(),
        hotelIds: Array.from(selectedHotelIds),
        suggestedCap: prefill?.suggestedCap,
      });
      setCreatedInvitations(result.invitations);
      toast.success(`RFP "${name}" criado · ${result.invitations.length} hotéis convidados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar RFP");
    }
  };

  const copyAllLinks = () => {
    if (!createdInvitations) return;
    const lines = createdInvitations.map((inv) => publicResponseUrl(inv.id)).join("\n");
    navigator.clipboard.writeText(lines).then(() => toast.success("Links copiados"));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{createdInvitations ? `RFP "${name}" criado` : "Criar novo RFP"}</DialogTitle>
          <DialogDescription>
            {createdInvitations ? "Convites gerados — copie os links ou aguarde os hotéis responderem." : `Etapa ${step} de ${STEPS.length}: ${STEPS[step - 1].label}`}
          </DialogDescription>
        </DialogHeader>

        {createdInvitations ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-foreground">
              <p className="font-semibold">{createdInvitations.length} convites gerados.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cada hotel recebe um link único para preencher a resposta. Compartilhe os links abaixo com cada
                contato — o e-mail automático será enviado quando o domínio de e-mail estiver configurado.
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr><th className="px-3 py-2 text-left">Convite</th><th className="px-3 py-2 text-left">Link público</th><th /></tr>
                </thead>
                <tbody>
                  {createdInvitations.map((inv) => {
                    const url = publicResponseUrl(inv.id);
                    return (
                      <tr key={inv.id} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{inv.id.slice(0, 8)}…</td>
                        <td className="px-3 py-2"><a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{url}</a></td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copiado"))}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={copyAllLinks}>Copiar todos os links</Button>
              <Button onClick={handleClose}>Concluir</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              {STEPS.map((s, idx) => {
                const Icon = s.icon;
                const completed = step > s.id;
                const active = step === s.id;
                return (
                  <div key={s.id} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${completed ? "border-success bg-success text-success-foreground" : active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground"}`}>
                        {completed ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <span className={`mt-1 text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{s.label}</span>
                    </div>
                    {idx < STEPS.length - 1 && (<div className={`mx-2 h-0.5 flex-1 ${completed ? "bg-success" : "bg-border"}`} />)}
                  </div>
                );
              })}
            </div>

            <div className="min-h-[280px] space-y-4">
              {step === 1 && (
                <>
                  <div>
                    <Label htmlFor="name">Nome do RFP</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: RFP Global 2026 — Acme" maxLength={120} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="client">Cliente (Corp)</Label>
                      <Select value={clientTenantId} onValueChange={setClientTenantId}>
                        <SelectTrigger id="client">
                          <SelectValue placeholder={tenants.isLoading ? "Carregando..." : "Selecione um cliente"} />
                        </SelectTrigger>
                        <SelectContent>
                          {corpTenants.length === 0 && (<div className="px-3 py-2 text-xs text-muted-foreground">Nenhum cliente CORP encontrado. Cadastre em Admin → Clientes.</div>)}
                          {corpTenants.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="cycle">Ciclo</Label>
                      <Select value={cycle} onValueChange={setCycle}>
                        <SelectTrigger id="cycle"><SelectValue /></SelectTrigger>
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
                    <Textarea id="briefing" value={briefing} onChange={(e) => setBriefing(e.target.value)} placeholder="Contexto, objetivos, público-alvo..." rows={5} maxLength={1000} />
                    <p className="mt-1 text-xs text-muted-foreground">{briefing.length}/1000 caracteres</p>
                  </div>
                  {prefill?.suggestedCap && (
                    <div className="rounded-md bg-primary-soft/40 p-3 text-xs text-foreground">
                      <strong>CAP sugerido pelo Decision Center:</strong> R$ {prefill.suggestedCap.toFixed(0)} — será salvo como meta da RFP.
                    </div>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <p className="text-sm text-muted-foreground">Selecione as cidades onde o programa será aplicado.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {CITIES.map((c) => {
                      const active = selectedCities.includes(c);
                      return (
                        <button key={c} type="button" onClick={() => toggleCity(c)} className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${active ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-foreground hover:border-primary/40"}`}>
                          <div className="flex items-center justify-between"><span>{c}</span>{active && <Check className="h-3.5 w-3.5" />}</div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">{selectedCities.length}</strong> cidades selecionadas</p>
                </>
              )}

              {step === 3 && <RfpPoiStep pois={pois} onChange={setPois} />}

              {step === 4 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <Label>Estratégia</Label>
                      <Select value={hotelStrategy} onValueChange={(v) => { setHotelStrategy(v as typeof hotelStrategy); setSelectedHotelIds(new Set()); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="preferred">Preferenciais (Strategic/Preferred)</SelectItem>
                          <SelectItem value="open">Mercado aberto — todos da cidade</SelectItem>
                          <SelectItem value="curated">Curada — escolho cada um</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <Label>Buscar hotel</Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-8" value={hotelSearch} onChange={(e) => setHotelSearch(e.target.value)} placeholder="Nome, cidade ou código" />
                      </div>
                    </div>
                  </div>

                  {hotels.isLoading && <p className="text-sm text-muted-foreground">Carregando hotéis...</p>}

                  <div className="rounded-md border border-border">
                    <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2 text-xs">
                      <span><strong className="text-foreground">{selectedHotelIds.size}</strong> de {filteredCandidates.length} hotéis selecionados</span>
                      <div className="flex gap-2">
                        <button className="text-primary hover:underline" onClick={() => setSelectedHotelIds(new Set(filteredCandidates.map((h) => h.id)))}>Selecionar todos</button>
                        <button className="text-muted-foreground hover:underline" onClick={() => setSelectedHotelIds(new Set())}>Limpar</button>
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {filteredCandidates.length === 0 && (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                          Nenhum hotel encontrado com os filtros atuais.{" "}
                          {selectedCities.length === 0 && "Selecione pelo menos uma cidade na etapa anterior."}
                        </p>
                      )}
                      {filteredCandidates.map((h) => {
                        const checked = selectedHotelIds.has(h.id);
                        return (
                          <label key={h.id} className={`flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 text-sm hover:bg-muted/30 ${checked ? "bg-primary-soft/30" : ""}`}>
                            <Checkbox checked={checked} onCheckedChange={() => toggleHotel(h.id)} />
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{h.name}</p>
                              <p className="text-xs text-muted-foreground">{h.city} {h.code ? `· ${h.code}` : ""} {h.contact_email ? `· ${h.contact_email}` : ""}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {globalSearch.length > 0 && (
                    <div className="rounded-md border border-dashed border-border p-3">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">Outros resultados (fora do filtro de cidade/estratégia):</p>
                      <div className="space-y-1">
                        {globalSearch.map((h) => (
                          <button key={h.id} onClick={() => { toggleHotel(h.id); }} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/30">
                            <div>
                              <p className="font-medium text-foreground">{h.name}</p>
                              <p className="text-muted-foreground">{h.city}</p>
                            </div>
                            <span className="text-primary">{selectedHotelIds.has(h.id) ? "Remover" : "+ Adicionar"}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 5 && (
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-foreground">Requisitos contratuais</p>
                    <div className="space-y-2">
                      {RFP_REQUIREMENT_TEMPLATES.map((r) => {
                        const checked = reqs.includes(r.id);
                        return (
                          <label key={r.id} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${checked ? "border-primary bg-primary-soft/50" : "border-border bg-card"}`}>
                            <Checkbox checked={checked} onCheckedChange={() => toggleReq(r.id)} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">{r.label}</p>
                                {r.required && (<Badge variant="secondary" className="bg-warning/15 text-warning text-[10px]">Obrigatório</Badge>)}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-foreground">Dados solicitados ao hotel</p>
                    <p className="mb-2 text-xs text-muted-foreground">O hotel preencherá essas seções no link público da RFP.</p>
                    <div className="space-y-2">
                      {QUESTION_GROUPS.map((q) => {
                        const checked = !!questions[q.id];
                        return (
                          <label key={q.id} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${checked ? "border-primary bg-primary-soft/40" : "border-border bg-card"}`}>
                            <Checkbox checked={checked} onCheckedChange={() => setQuestions((s) => ({ ...s, [q.id]: !s[q.id] }))} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">{q.label}</p>
                                {q.required && (<Badge variant="secondary" className="bg-warning/15 text-warning text-[10px]">Recomendado</Badge>)}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {step === 6 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="open">Data de abertura</Label>
                      <Input id="open" type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="deadline">Prazo final</Label>
                      <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-sm font-semibold text-foreground">Resumo do RFP</p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <dt className="text-muted-foreground">Nome:</dt><dd className="font-medium text-foreground">{name || "—"}</dd>
                      <dt className="text-muted-foreground">Cliente:</dt><dd className="font-medium text-foreground">{corpTenants.find((t) => t.id === clientTenantId)?.name ?? "—"}</dd>
                      <dt className="text-muted-foreground">Ciclo:</dt><dd className="font-medium text-foreground">{cycle}</dd>
                      <dt className="text-muted-foreground">Cidades:</dt><dd className="font-medium text-foreground">{selectedCities.length}</dd>
                      <dt className="text-muted-foreground">POIs:</dt><dd className="font-medium text-foreground">{pois.length}</dd>
                      <dt className="text-muted-foreground">Hotéis convidados:</dt><dd className="font-medium text-foreground">{selectedHotelIds.size}</dd>
                      <dt className="text-muted-foreground">Requisitos:</dt><dd className="font-medium text-foreground">{reqs.length}</dd>
                      <dt className="text-muted-foreground">Distribuição:</dt><dd className="font-medium text-foreground">{openDate} → {deadline}</dd>
                    </dl>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
                <ChevronLeft className="mr-1 h-4 w-4" />Voltar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                {step < STEPS.length ? (
                  <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>Próximo<ChevronRight className="ml-1 h-4 w-4" /></Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={createRfp.isPending || selectedHotelIds.size === 0}>
                    <Send className="mr-1.5 h-4 w-4" />
                    {createRfp.isPending ? "Distribuindo..." : `Distribuir RFP (${selectedHotelIds.size} hotéis)`}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
