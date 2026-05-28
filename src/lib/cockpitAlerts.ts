// Cockpit aggregator — one summary alert per operational module.
// Each alert is tagged with a module key so the Critical Alerts cards
// look visually distinct and link to the corresponding operational
// card below via DOM anchor.

import { useMemo } from "react";
import { useBaselineStore } from "@/lib/baselineStore";
import { filterByWindow, type PeriodWindow } from "@/lib/periodFilter";
import { computeAdrVariance } from "@/lib/adrVarianceAnalysis";
import { computeDistanceLeakage } from "@/lib/distanceLeakageAnalysis";
import { computeRateLoading } from "@/lib/rateLoadingAnalysis";
import { computeHotelUnderperformance } from "@/lib/hotelUnderperformanceAnalysis";
import { computeHotelDependency } from "@/lib/hotelDependencyAnalysis";
import { computeSavingsMissed } from "@/lib/savingsMissedAnalysis";

export type CockpitModule =
  | "ADR_VARIANCE"
  | "SMART_LEAKAGE"
  | "RATE_LOADING"
  | "HOTEL_UNDERPERFORMANCE"
  | "HOTEL_DEPENDENCY"
  | "SAVINGS_MISSED";

export type CockpitSeverity = "high" | "medium" | "low";

export interface CockpitAlert {
  module: CockpitModule;
  moduleLabel: string; // short tag
  anchorId: string; // DOM id to scroll to
  severity: CockpitSeverity;
  title: string;
  description: string;
  metric: string;
  financialImpact: number;
  count: number; // how many sub-findings the module produced
}

const MODULE_META: Record<
  CockpitModule,
  { label: string; anchorId: string }
> = {
  ADR_VARIANCE: { label: "ADR realizado × negociado", anchorId: "module-adr-variance" },
  SMART_LEAKAGE: { label: "Leakage por distância", anchorId: "module-smart-leakage" },
  RATE_LOADING: { label: "Rate loading failure", anchorId: "module-rate-loading" },
  HOTEL_UNDERPERFORMANCE: { label: "Hotel underperformance", anchorId: "module-underperformance" },
  HOTEL_DEPENDENCY: { label: "Dependência de hotel", anchorId: "module-dependency" },
  SAVINGS_MISSED: { label: "Savings não capturados", anchorId: "module-savings-missed" },
};

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `US$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `US$ ${Math.round(v / 1000)}k`;
  return `US$ ${Math.round(v)}`;
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function sevFromCount(count: number, high: number, medium: number): CockpitSeverity {
  if (count >= high) return "high";
  if (count >= medium) return "medium";
  return "low";
}

export function useCockpitAlerts(window?: PeriodWindow | null): CockpitAlert[] {
  const allBookings = useBaselineStore((s) => s.bookings);
  const contracts = useBaselineStore((s) => s.contracts);
  const hotels = useBaselineStore((s) => s.hotels);

  return useMemo(() => {
    const bookings = window ? filterByWindow(allBookings, window) : allBookings;
    if (!bookings.length) return [];

    const out: CockpitAlert[] = [];

    // 1. ADR Variance
    if (contracts.length > 0) {
      const adr = computeAdrVariance(bookings, contracts);
      if (adr.flaggedCount > 0) {
        const top = adr.rows.find((r) => r.severity !== "ok");
        out.push({
          module: "ADR_VARIANCE",
          moduleLabel: MODULE_META.ADR_VARIANCE.label,
          anchorId: MODULE_META.ADR_VARIANCE.anchorId,
          severity: sevFromCount(adr.flaggedCount, 5, 2),
          title: top
            ? `ADR realizado ${(top.variancePct >= 0 ? "+" : "")}${top.variancePct.toFixed(1)}% vs negociado — ${top.hotel}`
            : `ADR realizado divergente em ${adr.flaggedCount} hotéis`,
          description: `${adr.flaggedCount} hotéis com tarifa reservada acima do negociado. Causas prováveis: tarifa não carregada, baixa disponibilidade, LRA não respeitado.`,
          metric: `${adr.flaggedCount} hotéis · ${fmtUsd(adr.totalLeakage)} leakage`,
          financialImpact: adr.totalLeakage,
          count: adr.flaggedCount,
        });
      }
    }

    // 2. Smart Leakage (distance-based)
    if (contracts.length > 0 && hotels.length > 0) {
      const leak = computeDistanceLeakage(bookings, contracts, hotels);
      if (leak.flaggedCount > 0) {
        out.push({
          module: "SMART_LEAKAGE",
          moduleLabel: MODULE_META.SMART_LEAKAGE.label,
          anchorId: MODULE_META.SMART_LEAKAGE.anchorId,
          severity: sevFromCount(leak.flaggedCount, 4, 2),
          title: leak.topCity
            ? `Leakage de ${fmtPct(leak.totalLeakagePct)} em ${leak.topCity}`
            : `Leakage de ${fmtPct(leak.totalLeakagePct)} em ${leak.flaggedCount} cidades`,
          description: `Reservas em hotéis fora do diretório dentro de ${(leak.radiusM / 1000).toFixed(1)}km de hotéis contratados não utilizados. Savings perdidos estimados.`,
          metric: `${leak.flaggedCount} cidades · ${fmtUsd(leak.totalMissedSavings)} perdidos`,
          financialImpact: leak.totalMissedSavings,
          count: leak.flaggedCount,
        });
      }
    }

    // 3. Rate Loading
    if (contracts.length > 0) {
      const rate = computeRateLoading(bookings, contracts);
      if (rate.flaggedHotels > 0) {
        out.push({
          module: "RATE_LOADING",
          moduleLabel: MODULE_META.RATE_LOADING.label,
          anchorId: MODULE_META.RATE_LOADING.anchorId,
          severity: sevFromCount(rate.flaggedHotels, 4, 2),
          title: `Falha de carregamento suspeita em ${rate.flaggedHotels} hotéis`,
          description: `${rate.affectedBookings} reservas acima do negociado. Possíveis causas: tarifa não publicada em canais, blackout, inconsistência LRA, divergência tarifária.`,
          metric: `${rate.flaggedHotels} hotéis · ${fmtUsd(rate.totalLoss)} estimado`,
          financialImpact: rate.totalLoss,
          count: rate.flaggedHotels,
        });
      }
    }

    // 4. Hotel Underperformance
    if (contracts.length > 0) {
      const under = computeHotelUnderperformance(bookings, contracts);
      if (under.flaggedHotels > 0) {
        out.push({
          module: "HOTEL_UNDERPERFORMANCE",
          moduleLabel: MODULE_META.HOTEL_UNDERPERFORMANCE.label,
          anchorId: MODULE_META.HOTEL_UNDERPERFORMANCE.anchorId,
          severity: sevFromCount(under.flaggedHotels, 4, 2),
          title: `${under.flaggedHotels} hotéis contratados com volume abaixo do esperado`,
          description: `Gap acumulado de ${Math.round(under.totalGapRn).toLocaleString("pt-BR")} room nights. Risco de perda de poder de barganha na próxima negociação.`,
          metric: `${under.flaggedHotels} hotéis · ${fmtUsd(under.totalMissedSpend)} de spend não capturado`,
          financialImpact: under.totalMissedSpend,
          count: under.flaggedHotels,
        });
      }
    }

    // 5. Hotel Dependency
    {
      const dep = computeHotelDependency(bookings, contracts);
      if (dep.flaggedCities > 0) {
        out.push({
          module: "HOTEL_DEPENDENCY",
          moduleLabel: MODULE_META.HOTEL_DEPENDENCY.label,
          anchorId: MODULE_META.HOTEL_DEPENDENCY.anchorId,
          severity: sevFromCount(dep.flaggedCities, 4, 2),
          title: dep.worstCity
            ? `Dependência alta em ${dep.worstCity}: ${fmtPct(dep.worstConcentrationPct)} em 1 hotel`
            : `Dependência alta em ${dep.flaggedCities} cidades`,
          description: `Concentração excessiva em um único hotel reduz alavancagem de negociação e aumenta risco operacional.`,
          metric: `${dep.flaggedCities} cidades · pior caso ${fmtPct(dep.worstConcentrationPct)}`,
          financialImpact: 0,
          count: dep.flaggedCities,
        });
      }
    }

    // 6. Savings Missed (always shown when total > 0)
    if (contracts.length > 0) {
      const under = computeHotelUnderperformance(bookings, contracts);
      const sav = computeSavingsMissed(bookings, contracts, under.totalMissedSpend, under.totalGapRn);
      if (sav.totalMissed > 0) {
        out.push({
          module: "SAVINGS_MISSED",
          moduleLabel: MODULE_META.SAVINGS_MISSED.label,
          anchorId: MODULE_META.SAVINGS_MISSED.anchorId,
          severity: sav.totalMissed > 100_000 ? "high" : sav.totalMissed > 25_000 ? "medium" : "low",
          title: `${fmtUsd(sav.totalMissed)} em savings não capturados`,
          description: `Composto por reservas fora do diretório (${fmtUsd(sav.outOfDirectoryAmount)}) e subutilização de hotéis contratados (${fmtUsd(sav.underperformanceAmount)}).`,
          metric: sav.topCity ? `Principal cidade: ${sav.topCity}` : `${fmtUsd(sav.totalMissed)} acumulado`,
          financialImpact: sav.totalMissed,
          count: 1,
        });
      }
    }

    // Sort: high → medium → low, then financial impact desc
    const sevOrder: Record<CockpitSeverity, number> = { high: 0, medium: 1, low: 2 };
    out.sort((a, b) => {
      const s = sevOrder[a.severity] - sevOrder[b.severity];
      return s !== 0 ? s : b.financialImpact - a.financialImpact;
    });
    return out;
  }, [allBookings, contracts, hotels, window]);
}
