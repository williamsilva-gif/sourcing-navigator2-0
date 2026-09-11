import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  useEligibleHotels,
  usePortalConnections,
  useRateLoadingMutations,
} from "@/lib/rateLoadingHooks";

function addDays(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function NewCampaignDialog({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const { data: hotels = [] } = useEligibleHotels(tenantId);
  const { data: connections = [] } = usePortalConnections(tenantId);
  const m = useRateLoadingMutations(tenantId);

  const eligible = useMemo(() => hotels.filter((h) => h.eligible), [hotels]);
  const blocked = useMemo(() => hotels.filter((h) => !h.eligible), [hotels]);

  const [name, setName] = useState("Verificação de carregamento");
  const [connectionId, setConnectionId] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]);
  const [stays, setStays] = useState([{ checkIn: addDays(30), checkOut: addDays(31) }]);
  const [tolerance, setTolerance] = useState({ amount: 0, percent: 1 });
  const [rules, setRules] = useState({
    matchRoomType: true,
    matchRatePlan: true,
    requireLra: false,
    requireTaxesIncluded: false,
    matchCancellation: true,
  });
  const [preview, setPreview] = useState<{ checks: number; available: number; sufficient: boolean } | null>(null);

  const payload = {
    tenantId,
    name,
    portalConnectionId: connectionId,
    awardedProgramIds: selected,
    stays,
    occupancies: [{ rooms: 1, adults: 1, children: 0 }],
    rules: {
      toleranceAmount: tolerance.amount,
      tolerancePercent: tolerance.percent,
      ...rules,
    },
  };

  const runPreview = async () => {
    try {
      const r = await m.previewCampaign(payload);
      setPreview(r);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const submit = async () => {
    try {
      const r = await m.createCampaign.mutateAsync(payload);
      toast.success(`Campanha criada com ${r.checks} verificações na fila.`);
      setOpen(false);
      setSelected([]);
      setPreview(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nova verificação</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nova verificação de carregamento</DialogTitle>
          <DialogDescription>
            Cada combinação de hotel, período e ocupação consome uma verificação da franquia.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Conexão de portal</Label>
              <Select value={connectionId} onValueChange={setConnectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {connections
                    .filter((c) => c.hasCredential && c.status !== "disabled")
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.displayName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Check-in</Label>
                <Input
                  type="date"
                  value={stays[0].checkIn}
                  onChange={(e) => setStays([{ ...stays[0], checkIn: e.target.value }])}
                />
              </div>
              <div>
                <Label>Check-out</Label>
                <Input
                  type="date"
                  value={stays[0].checkOut}
                  onChange={(e) => setStays([{ ...stays[0], checkOut: e.target.value }])}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tolerância (valor)</Label>
                <Input
                  type="number"
                  value={tolerance.amount}
                  onChange={(e) => setTolerance({ ...tolerance, amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Tolerância (%)</Label>
                <Input
                  type="number"
                  value={tolerance.percent}
                  onChange={(e) => setTolerance({ ...tolerance, percent: Number(e.target.value) })}
                />
              </div>
            </div>
            <Separator />
            {(
              [
                ["matchRoomType", "Comparar tipo de quarto"],
                ["matchRatePlan", "Comparar plano tarifário"],
                ["requireLra", "Exigir LRA"],
                ["requireTaxesIncluded", "Exigir impostos inclusos"],
                ["matchCancellation", "Comparar política de cancelamento"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={rules[k]}
                  onCheckedChange={(v) => setRules({ ...rules, [k]: v === true })}
                />
                {label}
              </label>
            ))}
          </div>

          <div>
            <Label>Hotéis elegíveis ({eligible.length})</Label>
            <ScrollArea className="mt-2 h-72 rounded-md border p-2">
              {eligible.map((h) => (
                <label key={h.awardedProgramId} className="flex items-center gap-2 py-1 text-sm">
                  <Checkbox
                    checked={selected.includes(h.awardedProgramId)}
                    onCheckedChange={() => toggle(h.awardedProgramId)}
                  />
                  <span className="truncate">
                    {h.hotelName} · {h.city}
                  </span>
                </label>
              ))}
              {blocked.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <p className="px-1 text-xs text-muted-foreground">
                    {blocked.length} hotéis sem acordo final completo — complete os dados na aba Acordos.
                  </p>
                </>
              )}
            </ScrollArea>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelected(eligible.map((h) => h.awardedProgramId))}>
                Selecionar todos
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Limpar
              </Button>
            </div>
          </div>
        </div>

        {preview && (
          <p className={`text-sm ${preview.sufficient ? "text-muted-foreground" : "text-destructive"}`}>
            {preview.checks} verificações serão executadas.{" "}
            {preview.sufficient
              ? "Franquia suficiente."
              : `Franquia insuficiente (${preview.available} disponíveis).`}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={runPreview} disabled={selected.length === 0}>
            Simular consumo
          </Button>
          <Button
            onClick={submit}
            disabled={!connectionId || selected.length === 0 || m.createCampaign.isPending}
          >
            Executar verificação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
