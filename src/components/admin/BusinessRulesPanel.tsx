import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useClientsStore } from "@/lib/clientsStore";
import {
  useAppConfigStore,
  useThresholds,
  useDefaultCap,
  useCanConfigure,
  type Thresholds,
} from "@/lib/appConfigStore";
import { useDecisionData, useDecisionPreview } from "@/components/dashboard/decisionData";

const FIELDS: { key: keyof Thresholds; label: string; help: string; suffix: string; min: number; max: number }[] = [
  { key: "adrGapPct", label: "ADR gap mínimo", help: "Quando ADR fica X% acima do cap, dispara alerta.", suffix: "%", min: 0, max: 100 },
  { key: "compliancePct", label: "Compliance mínimo", help: "Abaixo disso, alerta de compliance.", suffix: "%", min: 0, max: 100 },
  { key: "leakagePct", label: "Leakage máximo", help: "Acima disso, alerta de leakage por cidade/global.", suffix: "%", min: 0, max: 100 },
  { key: "concentrationPct", label: "Concentração top-2", help: "Acima disso, alerta de concentração de fornecedores.", suffix: "%", min: 0, max: 100 },
];

const pct = (label: string) =>
  z
    .number({ invalid_type_error: `${label} deve ser numérico` })
    .finite(`${label} inválido`)
    .min(0, `${label} não pode ser negativo`)
    .max(100, `${label} não pode passar de 100%`);

const formSchema = z.object({
  adrGapPct: pct("ADR gap"),
  compliancePct: pct("Compliance"),
  leakagePct: pct("Leakage"),
  concentrationPct: pct("Concentração"),
  defaultCap: z
    .number({ invalid_type_error: "Cap deve ser numérico" })
    .finite("Cap inválido")
    .min(1, "Cap deve ser ≥ 1")
    .max(10000, "Cap deve ser ≤ 10.000"),
});

type FormState = z.infer<typeof formSchema>;
type FieldErrors = Partial<Record<keyof FormState, string>>;

export function BusinessRulesPanel() {
  const clientId = useClientsStore((s) => s.selectedClientId);
  const clientName = useClientsStore((s) => s.clients.find((c) => c.id === clientId)?.name ?? clientId);
  const thresholds = useThresholds();
  const defaultCap = useDefaultCap();
  const setThreshold = useAppConfigStore((s) => s.setThreshold);
  const setDefaultCap = useAppConfigStore((s) => s.setDefaultCap);
  const canEdit = useCanConfigure();

  const initial = useMemo<FormState>(
    () => ({ ...thresholds, defaultCap }),
    [thresholds, defaultCap],
  );

  const [draft, setDraft] = useState<Record<keyof FormState, string>>(() => ({
    adrGapPct: String(initial.adrGapPct),
    compliancePct: String(initial.compliancePct),
    leakagePct: String(initial.leakagePct),
    concentrationPct: String(initial.concentrationPct),
    defaultCap: String(initial.defaultCap),
  }));
  const [errors, setErrors] = useState<FieldErrors>({});

  // Reset draft when client changes (or persisted values change externally)
  useEffect(() => {
    setDraft({
      adrGapPct: String(initial.adrGapPct),
      compliancePct: String(initial.compliancePct),
      leakagePct: String(initial.leakagePct),
      concentrationPct: String(initial.concentrationPct),
      defaultCap: String(initial.defaultCap),
    });
    setErrors({});
  }, [clientId, initial.adrGapPct, initial.compliancePct, initial.leakagePct, initial.concentrationPct, initial.defaultCap]);

  const dirty =
    draft.adrGapPct !== String(initial.adrGapPct) ||
    draft.compliancePct !== String(initial.compliancePct) ||
    draft.leakagePct !== String(initial.leakagePct) ||
    draft.concentrationPct !== String(initial.concentrationPct) ||
    draft.defaultCap !== String(initial.defaultCap);

  // Build a sanitized preview snapshot from the draft. We clamp values so a
  // mid-typing state (e.g. "") doesn't break the engine; the formal validation
  // still runs on Save.
  const previewThresholds = useMemo<Thresholds>(() => {
    const clamp = (raw: string, fallback: number) => {
      const n = Number(raw);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(100, Math.max(0, n));
    };
    return {
      adrGapPct: clamp(draft.adrGapPct, initial.adrGapPct),
      compliancePct: clamp(draft.compliancePct, initial.compliancePct),
      leakagePct: clamp(draft.leakagePct, initial.leakagePct),
      concentrationPct: clamp(draft.concentrationPct, initial.concentrationPct),
    };
  }, [draft, initial]);

  const previewCap = useMemo(() => {
    const n = Number(draft.defaultCap);
    if (!Number.isFinite(n) || n < 1) return initial.defaultCap;
    return Math.min(10000, n);
  }, [draft.defaultCap, initial.defaultCap]);

  const current = useDecisionData();
  const preview = useDecisionPreview(previewThresholds, previewCap);

  const deltaAlerts = preview.alerts.length - current.alerts.length;
  const deltaOpps = preview.opportunities.length - current.opportunities.length;

  const update = (key: keyof FormState, raw: string) => {
    setDraft((d) => ({ ...d, [key]: raw }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSave = () => {
    if (!canEdit) return;
    const parsed = formSchema.safeParse({
      adrGapPct: Number(draft.adrGapPct),
      compliancePct: Number(draft.compliancePct),
      leakagePct: Number(draft.leakagePct),
      concentrationPct: Number(draft.concentrationPct),
      defaultCap: Number(draft.defaultCap),
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormState;
        if (!next[k]) next[k] = issue.message;
      }
      setErrors(next);
      toast.error("Corrija os campos destacados antes de salvar.");
      return;
    }

    const { defaultCap: cap, ...th } = parsed.data;
    (Object.keys(th) as (keyof Thresholds)[]).forEach((k) => setThreshold(clientId, k, th[k]));
    setDefaultCap(clientId, cap);
    setErrors({});
    toast.success(`Regras salvas para ${clientName}.`);
  };

  const handleReset = () => {
    setDraft({
      adrGapPct: String(initial.adrGapPct),
      compliancePct: String(initial.compliancePct),
      leakagePct: String(initial.leakagePct),
      concentrationPct: String(initial.concentrationPct),
      defaultCap: String(initial.defaultCap),
    });
    setErrors({});
  };

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Regras de negócio</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cliente ativo: <span className="font-semibold text-foreground">{clientName}</span> · ao salvar, alertas e oportunidades são recalculados.
          </p>
        </div>
        {!canEdit && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
            Somente leitura
          </span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const err = errors[f.key];
          return (
            <label key={f.key} className="block rounded-md border border-border bg-background p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</span>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={f.min}
                  max={f.max}
                  step={1}
                  value={draft[f.key]}
                  disabled={!canEdit}
                  onChange={(e) => update(f.key, e.target.value)}
                  aria-invalid={!!err}
                  className={`h-9 w-24 rounded-md border bg-card px-2 text-sm disabled:opacity-50 ${
                    err ? "border-destructive" : "border-input"
                  }`}
                />
                <span className="text-sm text-muted-foreground">{f.suffix}</span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{f.help}</p>
              {err && <p className="mt-1 text-[11px] font-medium text-destructive">{err}</p>}
            </label>
          );
        })}

        <label className="block rounded-md border border-border bg-background p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cap padrão por cidade</span>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">US$</span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              max={10000}
              step={10}
              value={draft.defaultCap}
              disabled={!canEdit}
              onChange={(e) => update("defaultCap", e.target.value)}
              aria-invalid={!!errors.defaultCap}
              className={`h-9 w-28 rounded-md border bg-card px-2 text-sm disabled:opacity-50 ${
                errors.defaultCap ? "border-destructive" : "border-input"
              }`}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Usado quando uma cidade não tem cap explícito definido em ações.
          </p>
          {errors.defaultCap && (
            <p className="mt-1 text-[11px] font-medium text-destructive">{errors.defaultCap}</p>
          )}
        </label>
      </div>

      <ImpactPreview
        dirty={dirty}
        currentAlerts={current.alerts.length}
        currentOpps={current.opportunities.length}
        previewAlerts={preview.alerts.length}
        previewOpps={preview.opportunities.length}
        deltaAlerts={deltaAlerts}
        deltaOpps={deltaOpps}
        sampleAlerts={preview.alerts.slice(0, 3).map((a) => a.title)}
        sampleOpps={preview.opportunities.slice(0, 3).map((o) => o.scope)}
        source={preview.source}
      />

      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={!canEdit || !dirty}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canEdit || !dirty}
          className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Salvar regras
        </button>
      </div>
    </section>
  );
}
