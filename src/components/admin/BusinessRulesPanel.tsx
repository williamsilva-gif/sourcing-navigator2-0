import { useAppConfigStore, type Thresholds } from "@/lib/appConfigStore";

const FIELDS: { key: keyof Thresholds; label: string; help: string; suffix: string }[] = [
  { key: "adrGapPct", label: "ADR gap mínimo", help: "Quando ADR fica X% acima do cap, dispara alerta.", suffix: "%" },
  { key: "compliancePct", label: "Compliance mínimo", help: "Abaixo disso, alerta de compliance.", suffix: "%" },
  { key: "leakagePct", label: "Leakage máximo", help: "Acima disso, alerta de leakage por cidade/global.", suffix: "%" },
  { key: "concentrationPct", label: "Concentração top-2", help: "Acima disso, alerta de concentração de fornecedores.", suffix: "%" },
];

export function BusinessRulesPanel() {
  const thresholds = useAppConfigStore((s) => s.thresholds);
  const setThreshold = useAppConfigStore((s) => s.setThreshold);
  const defaultCap = useAppConfigStore((s) => s.defaultCap);
  const setDefaultCap = useAppConfigStore((s) => s.setDefaultCap);

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-semibold text-foreground">Regras de negócio</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Thresholds usados pelo motor de recomendação. Mudanças recalculam alertas e oportunidades imediatamente.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block rounded-md border border-border bg-background p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {f.label}
            </span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                value={thresholds[f.key]}
                onChange={(e) => setThreshold(f.key, Number(e.target.value) || 0)}
                className="h-9 w-24 rounded-md border border-input bg-card px-2 text-sm"
              />
              <span className="text-sm text-muted-foreground">{f.suffix}</span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{f.help}</p>
          </label>
        ))}

        <label className="block rounded-md border border-border bg-background p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cap padrão por cidade
          </span>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">US$</span>
            <input
              type="number"
              value={defaultCap}
              onChange={(e) => setDefaultCap(Number(e.target.value) || 0)}
              className="h-9 w-28 rounded-md border border-input bg-card px-2 text-sm"
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Usado quando uma cidade não tem cap explícito definido em ações.
          </p>
        </label>
      </div>
    </section>
  );
}
