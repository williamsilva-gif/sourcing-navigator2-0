import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, RefreshCw, Save } from "lucide-react";
import {
  getTaxScenarioFn,
  saveTaxScenarioFn,
  checkTaxSourcesFn,
} from "@/lib/taxImpact.v11.functions";
import {
  defaultScenario,
  scenarioSchema,
  simulateNight,
  negotiate,
  budget,
  RULE_VERSION,
  LIMITATIONS,
  type Scenario,
} from "@/lib/taxImpact/simulation";
import {
  matchVolumes,
  volumeStats,
  volumeProvenance,
  volumeProvenanceLabel,
  type VolumeRow,
} from "@/lib/taxImpact/volume";
import { officialSources, type SourceCheck } from "@/lib/taxImpact/sources";
import { excelReport, pdfReport, downloadReport } from "@/lib/taxImpact/exports";
import type { Comparison, Row } from "@/lib/taxImpact/core";
import { VolumePanel } from "./VolumePanel";
const cash = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "indeterminado"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function SimulationPanel({
  tenantId,
  analysisId,
  name,
  results,
  program,
}: {
  tenantId: string;
  analysisId: string;
  name: string;
  results: Comparison[];
  program: Row[];
}) {
  const get = useServerFn(getTaxScenarioFn),
    save = useServerFn(saveTaxScenarioFn),
    check = useServerFn(checkTaxSourcesFn);
  const query = useQuery({
    queryKey: ["tic-v11", tenantId, analysisId],
    queryFn: () => get({ data: { tenantId, analysisId } }),
    retry: false,
  });
  const [s, setS] = useState<Scenario>(defaultScenario),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [source, setSource] = useState<SourceCheck | null>(null),
    [city, setCity] = useState(""),
    [cap, setCap] = useState("");
  useEffect(() => {
    if (!loaded && query.data) {
      const parsed = scenarioSchema.safeParse(query.data.scenario?.parameters ?? {});
      if (parsed.success) setS(parsed.data);
      setLoaded(true);
    }
  }, [query.data, loaded]);
  const volume = useMemo(
    () => (query.data?.volumes[0]?.rows ?? []) as unknown as VolumeRow[],
    [query.data],
  );
  const portfolio = useMemo(() => volumeStats(volume, s.growthPct), [volume, s.growthPct]);
  const provenance = volumeProvenance(query.data?.volumes[0]);
  const linked = useMemo(() => matchVolumes(program, volume), [program, volume]);
  const filteredVolume = results.flatMap(
    (r) => linked.assignments.get(r.proposal?.id ?? r.baseline?.id ?? "") ?? [],
  );
  const filteredStats = volumeStats(
    filteredVolume,
    s.growthPct,
    portfolio.seasonality ?? undefined,
  );
  const derived = results.map((r) => {
    const p = r.proposal ?? r.baseline,
      hotelRows = linked.assignments.get(p?.id ?? "") ?? [],
      v = volumeStats(hotelRows, s.growthPct, portfolio.seasonality ?? undefined),
      single = simulateNight(r, "single", s),
      double = simulateNight(r, "double", s);
    const sameCity = program.filter(
      (h) =>
        h.city === p?.city &&
        h.state === p?.state &&
        h.id !== p?.id &&
        h.single !== null &&
        h.currency === p?.currency,
    );
    const benchmark = sameCity.length
      ? sameCity.reduce((a, h) => a + (h.single ?? 0), 0) / sameCity.length
      : null;
    const decision = negotiate(r, s, benchmark);
    const annual = budget(
      single.before?.total ?? null,
      single.after?.total ?? null,
      double.before?.total ?? null,
      double.after?.total ?? null,
      v.projected27,
      s.singleShare,
    );
    return { r, p, v, single, double, decision, annual };
  });
  const annual = derived
      .filter((d) => d.annual !== null)
      .reduce((a, d) => a + (d.annual?.delta ?? 0), 0),
    projected = derived.reduce((a, d) => a + (d.v.projected27 ?? 0), 0);
  const annualCovered = derived
    .filter((d) => d.annual !== null)
    .reduce((a, d) => a + (d.v.projected27 ?? 0), 0);
  const totalsByNetwork = [...new Set(derived.map((d) => d.p?.network ?? "Sem rede"))].map((n) => ({
    network: n,
    rows: derived.filter((d) => (d.p?.network ?? "Sem rede") === n),
  }));
  function patch<K extends keyof Scenario>(key: K, value: Scenario[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
    setMessage("");
  }
  async function saveParams() {
    setBusy(true);
    setError("");
    try {
      await save({ data: { tenantId, analysisId, parameters: s } });
      setMessage("Premissas salvas nesta análise.");
      await query.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setError("");
    const result = await check({ data: { tenantId, analysisId } });
    const current = result.result as unknown as SourceCheck | null;
    setSource(current);
    setMessage(
      (result.lastValidated
        ? `Última referência validada preservada: ${JSON.stringify(result.lastValidated)}. `
        : "") + (current?.message ?? "Verificação em andamento ou indisponível; não verificado."),
    );
    return current;
  }
  async function exportFile(kind: "pdf" | "xlsx") {
    setBusy(true);
    setError("");
    try {
      let current: SourceCheck | null = null;
      try {
        current = await verify();
      } catch {
        setMessage("Não foi possível verificar hoje; relatório marcado NÃO VERIFICADO.");
      }
      const data = {
        name,
        results,
        scenario: s,
        source: current,
        volumeRows: volume,
        programRows: program,
        volumeProvenance: provenance,
        volumeSummary: {
          ...filteredStats,
          projected27: projected,
          budgetDelta: s.singleShare === null ? null : annual,
          ambiguousRows: linked.ambiguous.length,
          unmatchedRows: linked.unmatched.length,
        },
      };
      const bytes = kind === "pdf" ? pdfReport(data) : excelReport(data);
      downloadReport(
        bytes,
        `Tax-Impact-${/demo|simula/i.test(name) ? "SIMULADO-" : ""}${analysisId}.${kind}`,
        kind === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Exportação não concluída.");
    } finally {
      setBusy(false);
    }
  }
  const input = "mt-1 w-full rounded-md border border-input bg-background p-2 text-sm";
  return (
    <section className="space-y-5 border-y border-border py-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Simulação por diária e negociação</h3>
          <p className="text-xs text-muted-foreground">
            {RULE_VERSION} · hipóteses do regime regular, não tributo definitivo
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void saveParams()}>
            <Save className="mr-2 h-4 w-4" />
            Salvar premissas
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void exportFile("xlsx")}>
            <Download className="mr-2 h-4 w-4" />
            Excel filtrado
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void exportFile("pdf")}>
            <Download className="mr-2 h-4 w-4" />
            PDF filtrado
          </Button>
        </div>
      </div>
      {/demo|simula/i.test(name) && (
        <p className="border-l-4 border-warning bg-warning-soft p-3 text-sm font-semibold text-warning-foreground">
          TARIFAS RFP SIMULADAS NÃO CONTRATUAIS
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-xs">
          Regime 2026
          <select
            aria-label="Regime 2026"
            className={input}
            value={s.regime2026}
            onChange={(e) => patch("regime2026", e.target.value as Scenario["regime2026"])}
          >
            <option value="unknown">Desconhecido · indeterminado</option>
            <option value="cumulative">Hipótese cumulativo · PIS/Cofins 3,65%</option>
            <option value="illustrative">Não cumulativo ilustrativo · 9,25%</option>
            <option value="simples">Simples · cálculo bloqueado</option>
            <option value="custom">Personalizado</option>
          </select>
        </label>
        <label className="text-xs">
          Regime 2027
          <select
            aria-label="Regime 2027"
            className={input}
            value={s.regime2027}
            onChange={(e) => patch("regime2027", e.target.value as Scenario["regime2027"])}
          >
            <option value="unknown">Não confirmado · indeterminado</option>
            <option value="regular">Hipótese regular específico hotelaria</option>
          </select>
        </label>
        <label
          className="text-xs"
          title="Inclusivo: proxy nominal sobre bruto. Extra: cotação líquida, base comum explicitamente assumida. Não se presume base fiscal real."
        >
          Modelagem dos impostos
          <select
            aria-label="Modelagem impostos"
            className={input}
            value={s.inclusion}
            onChange={(e) => patch("inclusion", e.target.value as Scenario["inclusion"])}
          >
            <option value="unknown">Desconhecido · indeterminado</option>
            <option value="inclusive">Hipótese tarifa bruta inclusiva · proxy</option>
            <option value="extra">Hipótese tarifa líquida + impostos extras</option>
          </select>
        </label>
        <label className="text-xs">
          ISS nominal quando escrito “incluso” (%)
          <input
            aria-label="ISS incluso percentual"
            className={input}
            type="number"
            min={0}
            max={30}
            step="0.01"
            value={s.issIncludedPct ?? ""}
            onChange={(e) =>
              patch(
                "issIncludedPct",
                e.target.value === "" ? null : Math.min(30, Math.max(0, Number(e.target.value))),
              )
            }
          />
        </label>
        {s.regime2026 === "custom" && (
          <label className="text-xs">
            PIS/Cofins personalizado (%)
            <input
              className={input}
              type="number"
              min={0}
              max={30}
              value={s.customPis}
              onChange={(e) =>
                patch("customPis", Math.min(30, Math.max(0, Number(e.target.value))))
              }
            />
          </label>
        )}
        <label className="text-xs">
          Reajuste máximo do gestor (%)
          <input
            aria-label="Reajuste máximo"
            className={input}
            type="number"
            min={-100}
            max={200}
            step="0.01"
            value={s.maxIncrease ?? ""}
            onChange={(e) =>
              patch(
                "maxIncrease",
                e.target.value === ""
                  ? null
                  : Math.min(200, Math.max(-100, Number(e.target.value))),
              )
            }
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={s.negotiateNeutral}
            onCheckedChange={(v) => patch("negotiateNeutral", v === true)}
          />
          Negociar proxy fiscal neutro (hipótese)
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="text-xs">
          Cidade / UF
          <select
            aria-label="Cidade teto"
            className={input}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="">Selecionar</option>
            {[...new Set(program.map((p) => `${p.city}/${p.state}`))].sort().map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Teto Single (R$)
          <input
            aria-label="Teto cidade"
            className={input}
            type="number"
            min="0.01"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
        </label>
        <Button
          variant="outline"
          className="self-end"
          disabled={!city || !(Number(cap) > 0) || Number(cap) > 100000}
          onClick={() => patch("cityCaps", { ...s.cityCaps, [city]: Number(cap) })}
        >
          Definir teto
        </Button>
        {Object.entries(s.cityCaps).map(([c, v]) => (
          <Button
            key={c}
            size="sm"
            variant="ghost"
            onClick={() => {
              const next = { ...s.cityCaps };
              delete next[c];
              patch("cityCaps", next);
            }}
          >
            {c}: {cash(v)} ×
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        CBS referência 11,30% − 0,10 p.p., redução hotelaria 40% = 6,72%. IBS (0,05% + 0,05%) × 60%
        = 0,06%. ISS continua em 2027; serviço é encargo comercial. Enquadramento não validado por
        CNPJ.
      </p>
      {s.regime2026 === "unknown" && (
        <p className="text-xs text-warning-foreground">
          Regime 2026 sem comprovação. Ilustrações inclusivas:{" "}
          {derived
            .slice(0, 3)
            .map((d) => {
              const a = simulateNight(d.r, "single", {
                  ...s,
                  regime2026: "cumulative",
                  regime2027: "regular",
                }),
                b = simulateNight(d.r, "single", {
                  ...s,
                  regime2026: "illustrative",
                  regime2027: "regular",
                });
              return `${d.p?.hotel}: neutro cumulativo 3,65% ${cash(a.neutral)} / não cumulativo ilustrativo 9,25% ${cash(b.neutral)}`;
            })
            .join("; ")}
          . Não atribui regime real ao hotel; escolha inclusiva e ISS ainda obrigatórias.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setS(defaultScenario)}>
          Preset conservador · desconhecido
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setS({ ...s, regime2026: "cumulative", regime2027: "regular", inclusion: "inclusive" })
          }
        >
          Preset hipótese cumulativa inclusiva
        </Button>
      </div>
      <VolumePanel
        tenantId={tenantId}
        analysisId={analysisId}
        onSaved={() => void query.refetch()}
      />
      {query.data?.volumes.map((v) => (
        <details key={v.id} className="text-xs">
          <summary>
            {v.filename} · {Array.isArray(v.rows) ? v.rows.length : 0} linhas ·{" "}
            {Array.isArray(v.errors) ? v.errors.length : 0} ocorrências
          </summary>
          <p className="break-all">
            {volumeProvenance(v).originalInStorage
              ? `${v.file_hash} · ${v.storage_path}`
              : "Base derivada mensal — arquivo XLSX original NÃO armazenado; caminho convencional não comprova upload."}
          </p>
        </details>
      ))}
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="space-y-3 text-sm">
          Crescimento 2027: {s.growthPct.toFixed(1)}%
          <Slider
            aria-label="Crescimento 2027"
            min={-50}
            max={100}
            step={1}
            value={[s.growthPct]}
            onValueChange={(v) => patch("growthPct", v[0])}
          />
        </label>
        <div className="space-y-3 text-sm">
          <label className="flex gap-2">
            <Checkbox
              aria-label="Definir mix"
              checked={s.singleShare !== null}
              onCheckedChange={(v) => patch("singleShare", v === true ? 50 : null)}
            />
            Mix Single/Double explicitamente definido
          </label>
          {s.singleShare !== null ? (
            <label>
              Single {s.singleShare}% / Double {100 - s.singleShare}%
              <Slider
                aria-label="Mix Single"
                min={0}
                max={100}
                value={[s.singleShare]}
                onValueChange={(v) => patch("singleShare", v[0])}
              />
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              Impacto de mix bloqueado. Intervalos 100% Single / 100% Double disponíveis nos
              detalhes.
            </p>
          )}
        </div>
      </div>
      <dl className="grid gap-4 sm:grid-cols-4">
        {[
          ["FY2025 realizado · filtro", filteredStats.fy25.toLocaleString("pt-BR")],
          ["Jan–Mai2026 realizado · filtro", filteredStats.n26.toLocaleString("pt-BR")],
          [
            "FY2027 estimado · hotéis com base",
            derived.some((d) => d.v.projected27 !== null)
              ? Math.round(projected).toLocaleString("pt-BR")
              : "sem base",
          ],
          [
            "Delta orçamento · cobertura válida",
            s.singleShare === null || !derived.some((d) => d.annual)
              ? "indeterminado"
              : cash(annual),
          ],
        ].map(([label, value]) => (
          <div key={label} className="border-l-2 border-primary pl-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Cobertura orçamentária: {annualCovered.toFixed(0)} / {projected.toFixed(0)} diárias
        projetadas nos filtros. Não extrapola hotéis sem tarifa/mix/base válida.
      </p>
      <p className="text-xs text-muted-foreground">
        Portfolio histórico completo · FY2025: {portfolio.fy25.toLocaleString("pt-BR")} diárias ·
        Jan–Mai2025: {portfolio.n25.toLocaleString("pt-BR")} · Jan–Mai2026:{" "}
        {portfolio.n26.toLocaleString("pt-BR")} diárias. Gasto FY2025: {cash(portfolio.spend25)} ·
        Jan–Mai2026: {cash(portfolio.spend26)}. ADR FY2025: {cash(portfolio.adr25)} · Jan–Mai2026:{" "}
        {cash(portfolio.adr26)}.
      </p>
      <p className="text-xs text-muted-foreground">
        ADR 2025 realizado: {cash(filteredStats.adr25)} · Jan–Mai2026: {cash(filteredStats.adr26)}.
        Portfolio Jan–Mai/FY2025:{" "}
        {portfolio.seasonality === null
          ? "sem base"
          : (portfolio.seasonality * 100).toFixed(4) + "%"}
        . FY2026 portfolio estimado:{" "}
        {portfolio.projected26 === null
          ? "sem base"
          : Math.round(portfolio.projected26).toLocaleString("pt-BR")}{" "}
        diárias. {volume.length - linked.unmatched.length - linked.ambiguous.length} linhas de
        volume atribuídas · {linked.assignments.size} hotéis cobertos · {linked.unmatched.length}{" "}
        linhas não localizadas · {linked.ambiguous.length} ambíguas; excluídas da atribuição.{" "}
        {derived.filter((d) => d.v.projected26 === null).length} hotéis sem base 2026. Cobertura
        apenas do programa; totais do portfolio completo não são duplicados nem atribuídos a hotéis
        incertos.
      </p>
      <p role="status" className="text-xs text-warning-foreground">
        {volumeProvenanceLabel(provenance)}
      </p>
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted text-left">
            <tr>
              {[
                "Rede / hotel",
                "Single · total 2026→27",
                "CBS / IBS 2027",
                "Proxy neutro / residual",
                "Decisão / detalhe",
              ].map((h) => (
                <th key={h} className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {derived.map((d) => (
              <tr key={d.r.id} className="border-t border-border align-top">
                <td className="min-w-48 p-3">
                  {d.p?.network}
                  <p className="font-medium">{d.p?.hotel}</p>
                </td>
                <td className="p-3">
                  {cash(d.single.before?.total)} → {cash(d.single.after?.total)}
                </td>
                <td className="p-3">
                  {cash(d.single.after?.cbs)} / {cash(d.single.after?.ibs)}
                </td>
                <td className="p-3">
                  {cash(d.single.neutral)} / {cash(d.single.residual)}
                </td>
                <td className="min-w-64 p-3">
                  <p className="font-semibold">{d.decision.action}</p>
                  <details>
                    <summary className="cursor-pointer text-primary">
                      Expandir memória de cálculo
                    </summary>
                    <div className="max-w-lg space-y-2 py-2">
                      <p>
                        {d.decision.reasons.join(" ")} · Contra proposta: {cash(d.decision.counter)}
                      </p>
                      <p>
                        Benchmark interno mesma cidade (cotação Single; não mercado externo):{" "}
                        {cash(d.decision.benchmark)}
                      </p>
                      <p>
                        {d.single.reason} {d.single.before?.model}
                      </p>
                      {(["single", "double"] as const).map((o) => {
                        const sim = d[o];
                        return (
                          <div key={o}>
                            <p className="font-medium">
                              {o === "single" ? "Single" : "Double"}: {cash(sim.before?.total)} →{" "}
                              {cash(sim.after?.total)}
                            </p>
                            <p>
                              2026 ISS {cash(sim.before?.iss)} / PIS-Cofins {cash(sim.before?.pis)}{" "}
                              / serviço {cash(sim.before?.service)}
                            </p>
                            <p>
                              2027 ISS {cash(sim.after?.iss)} / CBS {cash(sim.after?.cbs)} / IBS{" "}
                              {cash(sim.after?.ibs)} / serviço {cash(sim.after?.service)}
                            </p>
                            <p>
                              Neutro {cash(sim.neutral)} · Residual {cash(sim.residual)}
                            </p>
                          </div>
                        );
                      })}
                      <p>
                        ADR 2025: {cash(d.v.adr25)} · ADR Jan–Mai26: {cash(d.v.adr26)} · Tarifa RFP
                        Single: {cash(d.p?.single)}
                      </p>
                      <p>
                        FY25 {d.v.fy25} · Jan–Mai25 {d.v.n25} · Jan–Mai26 {d.v.n26} · FY26 estimado{" "}
                        {d.v.projected26?.toFixed(0) ?? "sem base"} · FY27 estimado{" "}
                        {d.v.projected27?.toFixed(0) ?? "sem base"} · Qualidade: {d.v.quality} ·{" "}
                        {d.v.method}
                      </p>
                      <p>
                        Intervalo anual 100% Single / 100% Double:{" "}
                        {cash(
                          budget(
                            d.single.before?.total ?? null,
                            d.single.after?.total ?? null,
                            null,
                            null,
                            d.v.projected27,
                            100,
                          )?.delta,
                        )}{" "}
                        /{" "}
                        {cash(
                          budget(
                            null,
                            null,
                            d.double.before?.total ?? null,
                            d.double.after?.total ?? null,
                            d.v.projected27,
                            0,
                          )?.delta,
                        )}
                      </p>
                      <p>{LIMITATIONS} Cancelamento: sem coluna disponível.</p>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 className="text-sm font-semibold">Projeção por rede · filtros ativos</h4>
      <div className="space-y-2">
        {totalsByNetwork.map((g) => {
          const nights = g.rows.reduce((a, d) => a + (d.v.projected27 ?? 0), 0);
          return (
            <div
              key={g.network}
              className="grid grid-cols-[minmax(100px,1fr)_3fr_80px] items-center gap-3 text-xs"
            >
              <span>{g.network}</span>
              <meter className="h-4 w-full" min={0} max={Math.max(projected, 1)} value={nights} />
              <span>{Math.round(nights)} diárias</span>
            </div>
          );
        })}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-primary">
          Fontes, verificação e versão normativa
        </summary>
        <p className="py-2">
          LC214 arts. 12, 281–283, 344, 347; alimentação separada art. 280. Texto legal versionado,
          não atualização jurídica automática. {LIMITATIONS}
        </p>
        {Object.entries(officialSources).map(([k, url]) => (
          <a
            key={k}
            className="block break-all text-primary underline"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            {k}: {url}
          </a>
        ))}
        <p>
          TCU:{" "}
          {source?.tcu.status === "validated"
            ? "REFERÊNCIA VERIFICADA (não definitiva)"
            : "NÃO VERIFICADO"}{" "}
          · Senado: NÃO VERIFICADO · {source?.checkedAt ?? "sem consulta nesta sessão"}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void verify().catch((e) => setError(e.message))}
        >
          <RefreshCw className="mr-2 h-3 w-3" />
          Checar fontes oficiais
        </Button>
      </details>
      {message && (
        <p role="status" className="text-xs text-warning-foreground">
          {message}
        </p>
      )}
      {(error || query.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error || query.error?.message}
        </p>
      )}
    </section>
  );
}
