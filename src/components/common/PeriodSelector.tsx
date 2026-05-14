// PeriodSelector — reusable period filter for Decision Center / Diagnóstico.
// Controlled component: parent owns `grain` + `period` (typically backed by
// search params) and gets notified of changes via onChange.

import { Calendar } from "lucide-react";
import type { Granularity } from "@/lib/periodFilter";

interface Props {
  grain: Granularity;
  period: string;
  availableYears: number[]; // years that actually have data
  onChange: (next: { grain: Granularity; period: string }) => void;
}

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;
const MONTHS = [
  ["01", "Jan"], ["02", "Fev"], ["03", "Mar"], ["04", "Abr"],
  ["05", "Mai"], ["06", "Jun"], ["07", "Jul"], ["08", "Ago"],
  ["09", "Set"], ["10", "Out"], ["11", "Nov"], ["12", "Dez"],
] as const;

export function PeriodSelector({ grain, period, availableYears, onChange }: Props) {
  const years = availableYears.length > 0
    ? availableYears
    : [new Date().getUTCFullYear()];

  // Parse current period into year + secondary segment for the dropdowns
  const currentYear = (() => {
    if (grain === "year") return Number(period) || years[0];
    if (grain === "quarter") return Number(period.slice(0, 4)) || years[0];
    if (grain === "month") return Number(period.slice(0, 4)) || years[0];
    if (grain === "custom") return Number(period.slice(0, 4)) || years[0];
    return years[0];
  })();

  const handleGrainChange = (g: Granularity) => {
    if (g === "year") onChange({ grain: g, period: String(currentYear) });
    else if (g === "quarter") onChange({ grain: g, period: `${currentYear}-Q1` });
    else if (g === "month") onChange({ grain: g, period: `${currentYear}-01` });
    else onChange({ grain: g, period: `${currentYear}-01-01_${currentYear}-12-31` });
  };

  const customStart = grain === "custom" ? period.slice(0, 10) : "";
  const customEnd = grain === "custom" ? period.slice(11, 21) : "";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <select
        value={grain}
        onChange={(e) => handleGrainChange(e.target.value as Granularity)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
      >
        <option value="year">Ano</option>
        <option value="quarter">Trimestre</option>
        <option value="month">Mês</option>
        <option value="custom">Intervalo</option>
      </select>

      {grain !== "custom" && (
        <select
          value={currentYear}
          onChange={(e) => {
            const y = e.target.value;
            if (grain === "year") onChange({ grain, period: y });
            else if (grain === "quarter") onChange({ grain, period: `${y}-${period.slice(5) || "Q1"}` });
            else if (grain === "month") onChange({ grain, period: `${y}-${period.slice(5) || "01"}` });
          }}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      )}

      {grain === "quarter" && (
        <select
          value={period.slice(5) || "Q1"}
          onChange={(e) => onChange({ grain, period: `${currentYear}-${e.target.value}` })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
        >
          {QUARTERS.map((q) => (
            <option key={q} value={q}>{q}</option>
          ))}
        </select>
      )}

      {grain === "month" && (
        <select
          value={period.slice(5) || "01"}
          onChange={(e) => onChange({ grain, period: `${currentYear}-${e.target.value}` })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
        >
          {MONTHS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      )}

      {grain === "custom" && (
        <>
          <input
            type="date"
            value={customStart}
            onChange={(e) => onChange({ grain, period: `${e.target.value}_${customEnd || e.target.value}` })}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => onChange({ grain, period: `${customStart || e.target.value}_${e.target.value}` })}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          />
        </>
      )}
    </div>
  );
}
