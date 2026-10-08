import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useClientsStore } from "@/lib/clientsStore";
import { useEntitlement } from "@/lib/rateLoadingHooks";
import { setEntitlementFn } from "@/lib/rateLoading.functions";

type Mode = "disabled" | "limited" | "unlimited";
type Period = "monthly" | "annual" | "contract";

export function RateLoadingEntitlementPanel() {
  const clients = useClientsStore((s) => s.clients);
  const [tenantId, setTenantId] = useState<string>("");
  useEffect(() => {
    if (!tenantId && clients[0]) setTenantId(clients[0].id);
  }, [clients, tenantId]);

  const { data: ent, isLoading } = useEntitlement(tenantId);
  const save = useServerFn(setEntitlementFn);
  const qc = useQueryClient();

  const [mode, setMode] = useState<Mode>("disabled");
  const [limit, setLimit] = useState(50);
  const [period, setPeriod] = useState<Period>("monthly");
  const [bonus, setBonus] = useState(0);
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ent) return;
    setMode(ent.usageMode);
    setLimit(ent.quotaLimit ?? 50);
    setPeriod((ent.quotaPeriod as Period) ?? "monthly");
    setBonus(ent.bonusUnits);
    setFrom(ent.effectiveFrom ?? "");
    setUntil(ent.effectiveUntil ?? "");
  }, [ent]);

  async function handleSave() {
    setSaving(true);
    try {
      await save({
        data: {
          tenantId,
          enabled: mode !== "disabled",
          usageMode: mode,
          quotaLimit: mode === "limited" ? limit : null,
          quotaPeriod: period,
          bonusUnits: bonus,
          effectiveFrom: from || null,
          effectiveUntil: until || null,
          internalNote: note || null,
        },
      });
      await qc.invalidateQueries({ queryKey: ["rl-entitlement", tenantId] });
      toast.success("Franquia atualizada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const total = (ent?.quotaLimit ?? 0) + (ent?.bonusUnits ?? 0);
  const pct = ent && ent.usageMode === "limited" && total > 0 ? Math.min(100, (ent.used / total) * 100) : 0;
  const input = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Rate Loading — ativação e franquia</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ligue a verificação de carregamento por cliente e defina quantas verificações ele pode usar.
          </p>
        </div>
        <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name} · {c.type}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : (
        <>
          {ent && (
            <div className="mt-6 rounded-md border border-border bg-muted/30 p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span>Consumidas: <strong>{ent.consumed}</strong> · Reservadas: <strong>{ent.reserved}</strong></span>
                <span>
                  {ent.usageMode === "unlimited" ? "Ilimitado" : ent.usageMode === "limited" ? `Disponíveis: ${ent.available} de ${total}` : "Desabilitado"}
                </span>
              </div>
              {ent.usageMode === "limited" && (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              )}
              {ent.nextReset && (
                <p className="mt-2 text-xs text-muted-foreground">Período {ent.periodKey} · renova em {new Date(ent.nextReset).toLocaleDateString("pt-BR")}</p>
              )}
            </div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted-foreground">Status
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className={input}>
                <option value="disabled">Desabilitado</option>
                <option value="limited">Limitado por franquia</option>
                <option value="unlimited">Ilimitado</option>
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">Período de renovação
              <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={input}>
                <option value="monthly">Mensal</option>
                <option value="annual">Anual</option>
                <option value="contract">Por contrato</option>
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">Franquia (verificações)
              <input type="number" min={0} disabled={mode !== "limited"} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={input} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">Bônus avulso
              <input type="number" min={0} value={bonus} onChange={(e) => setBonus(Number(e.target.value))} className={input} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">Vigência — início
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">Vigência — fim
              <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className={input} />
            </label>
            <label className="text-xs font-medium text-muted-foreground sm:col-span-2">Nota interna
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background p-2 text-sm" />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleSave} disabled={saving || !tenantId} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
