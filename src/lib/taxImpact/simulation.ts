import { z } from "zod";
import type { Comparison, Row } from "./core";
export const RULE_VERSION = "TIC-1.1-2026-10-29";
export const scenarioSchema = z.object({
  regime2026: z
    .enum(["unknown", "cumulative", "illustrative", "simples", "custom"])
    .default("unknown"),
  customPis: z.number().min(0).max(30).default(3.65),
  regime2027: z.enum(["unknown", "regular"]).default("unknown"),
  inclusion: z.enum(["unknown", "inclusive", "extra"]).default("unknown"),
  issIncludedPct: z.number().min(0).max(30).nullable().default(null),
  growthPct: z.number().min(-50).max(100).default(0),
  singleShare: z.number().min(0).max(100).nullable().default(null),
  maxIncrease: z.number().min(-100).max(200).nullable().default(null),
  cityCaps: z.record(z.string(), z.number().positive().max(100000)).default({}),
  negotiateNeutral: z.boolean().default(false),
});
export type Scenario = z.infer<typeof scenarioSchema>;
export const defaultScenario = scenarioSchema.parse({});
export const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const referenceRates = () => ({ cbs: (11.3 - 0.1) * 0.6, ibs: (0.05 + 0.05) * 0.6 });
export const LIMITATIONS =
  "Hipótese, não tributo definitivo nem causalidade do reajuste. Senado/enquadramento, créditos do fornecedor, base ISS, regime do serviço, custos/margem e alimentação separada podem alterar o resultado. Sem crédito de hotelaria para adquirente (art. 283). Serviço comercial e TMC não são IBS/CBS de hospedagem. Não estima imposto líquido pago pelo hotel.";
export type Night = {
  total: number;
  quoted: number;
  iss: number;
  pis: number;
  cbs: number;
  ibs: number;
  service: number | null;
  percent: { iss: number; pis: number; cbs: number; ibs: number };
  model: string;
};
function issRate(row: Row, s: Scenario) {
  if (row.iss.kind === "percent") return row.iss.value;
  if (row.iss.kind === "not_applicable") return 0;
  if (row.iss.kind === "included") return s.issIncludedPct;
  return null;
}
export function nightComposition(
  row: Row | null,
  occupancy: "single" | "double",
  year: 2026 | 2027,
  s: Scenario,
): Night | null {
  if (!row || row.currency !== "BRL" || row.rateType !== "fixed" || s.inclusion === "unknown")
    return null;
  const price = row[occupancy];
  const iss = issRate(row, s);
  if (
    price === null ||
    price <= 0 ||
    iss === null ||
    ["missing", "unknown"].includes(row.service.kind)
  )
    return null;
  if (s.regime2026 === "unknown" || s.regime2026 === "simples" || s.regime2027 !== "regular")
    return null;
  const pis =
    year === 2026
      ? s.regime2026 === "cumulative"
        ? 3.65
        : s.regime2026 === "illustrative"
          ? 9.25
          : s.customPis
      : 0;
  const rates = referenceRates();
  const cbs = year === 2027 ? rates.cbs : 0,
    ibs = year === 2027 ? rates.ibs : 0;
  const servicePct = row.service.kind === "percent" ? (row.service.value ?? 0) : 0;
  // Inclusive proxy: nominal shares of quoted gross, not a statutory gross-up or net liability.
  // Extra: user expressly assumes quoted net lodging, taxes each on net base, commercial service separate.
  const total =
    s.inclusion === "inclusive" ? price : price * (1 + (iss + pis + cbs + ibs + servicePct) / 100);
  return {
    quoted: price,
    total: roundMoney(total),
    iss: roundMoney((price * iss) / 100),
    pis: roundMoney((price * pis) / 100),
    cbs: roundMoney((price * cbs) / 100),
    ibs: roundMoney((price * ibs) / 100),
    service: row.service.kind === "included" ? null : roundMoney((price * servicePct) / 100),
    percent: { iss, pis, cbs, ibs },
    model:
      s.inclusion === "inclusive"
        ? "Proxy de participações nominais sobre tarifa bruta; não adicionar novamente ao total. Serviço incluso: valor embutido não segregado, não zero."
        : "Hipótese de base líquida comum; ISS/PIS/CBS/IBS e serviço extra sobre cotação líquida, sem gross-up. Serviço incluso não é adicionado novamente.",
  };
}
export function simulateNight(r: Comparison, occupancy: "single" | "double", s: Scenario) {
  const before = nightComposition(r.baseline, occupancy, 2026, s),
    after = nightComposition(r.proposal, occupancy, 2027, s);
  if (!["matched", "manual"].includes(r.match) || !before || !after)
    return {
      before,
      after,
      neutral: null,
      residual: null,
      reason:
        "Indeterminado: confirme regime, impostos inclusos/extras, ISS e unidade; requer tarifas fixas BRL.",
    };
  let neutral: number | null = null;
  if (s.inclusion === "inclusive") {
    const t0 = (before.percent.iss + before.percent.pis) / 100,
      t1 = (after.percent.iss + after.percent.cbs + after.percent.ibs) / 100;
    if (t0 < 1 && t1 < 1) neutral = roundMoney((before.quoted * (1 - t0)) / (1 - t1));
  }
  return {
    before,
    after,
    neutral,
    residual: neutral === null ? null : roundMoney(after.quoted - neutral),
    reason:
      neutral === null
        ? "Proxy fiscal neutro exige tarifa bruta inclusiva."
        : "P_neutral=P0*(1-t0)/(1-t1); residual=P_proposta-P_neutral. Não demonstra causa tributária.",
  };
}
export function budget(
  beforeSingle: number | null,
  afterSingle: number | null,
  beforeDouble: number | null,
  afterDouble: number | null,
  nights: number | null,
  share: number | null,
) {
  if (nights === null || nights < 0 || share === null || share < 0 || share > 100) return null;
  if (
    (share > 0 && (beforeSingle === null || afterSingle === null)) ||
    (share < 100 && (beforeDouble === null || afterDouble === null))
  )
    return null;
  const w = share / 100;
  const before = nights * ((beforeSingle ?? 0) * w + (beforeDouble ?? 0) * (1 - w)),
    after = nights * ((afterSingle ?? 0) * w + (afterDouble ?? 0) * (1 - w));
  return {
    before: roundMoney(before),
    after: roundMoney(after),
    delta: roundMoney(after - before),
  };
}
export function negotiate(r: Comparison, s: Scenario, benchmark: number | null) {
  const p = r.proposal,
    delta = r.single.percent,
    sim = simulateNight(r, "single", s);
  const reasons: string[] = [];
  const cap = p ? s.cityCaps[`${p.city}/${p.state}`] : undefined;
  if (
    !p ||
    !["matched", "manual"].includes(r.match) ||
    r.single.state !== "comparable" ||
    p.status === "rejected"
  )
    return {
      action: "INSUFICIENTE",
      reasons: ["Unidade/tarifa comparável ausente ou proposta reprovada."],
      counter: null,
    };
  if (cap !== undefined && p.single !== null && p.single > cap)
    reasons.push("Tarifa Single supera teto definido para a cidade.");
  if (s.maxIncrease !== null && delta !== null && delta > s.maxIncrease)
    reasons.push("Reajuste supera limite do gestor.");
  if (r.changes.some((c) => c.includes("perda de benefício")))
    reasons.push("Perda de benefício no programa.");
  if (s.negotiateNeutral && sim.neutral === null)
    return {
      action: "INSUFICIENTE",
      reasons: ["Objetivo fiscal neutro exige hipótese comparável confirmada."],
      counter: null,
      benchmark,
    };
  if (s.negotiateNeutral && sim.residual !== null && sim.residual > 0)
    reasons.push("Tarifa supera proxy fiscal neutro escolhido.");
  const targets = [
    cap,
    s.maxIncrease !== null && r.baseline?.single !== null && r.baseline?.single !== undefined
      ? r.baseline.single * (1 + s.maxIncrease / 100)
      : undefined,
    s.negotiateNeutral ? sim.neutral : undefined,
  ].filter((v): v is number => typeof v === "number" && v > 0);
  return {
    action: reasons.length
      ? "RENEGOCIAR"
      : s.maxIncrease === null && cap === undefined && !s.negotiateNeutral
        ? "INSUFICIENTE"
        : "RECOMENDAR APROVAR",
    reasons: reasons.length
      ? reasons
      : ["Sem violação dos objetivos selecionados; recomendação não altera status pendente."],
    counter: targets.length ? roundMoney(Math.min(...targets)) : null,
    benchmark,
  };
}
