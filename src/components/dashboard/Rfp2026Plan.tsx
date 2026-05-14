// "Plano para RFP 2026" — turns the YoY comparison into actionable
// recommendations: top cities by 2025 leakage, suggested new cap (= 2025 ADR
// × 0.95 rounded), expected savings if applied, and which contracts must be
// renegotiated. Pure presentation; reads bookings + contracts from the store.

import { useMemo } from "react";
import { Sparkles, Target, ArrowRight } from "lucide-react";
import { useBaselineStore } from "@/lib/baselineStore";
import { capForBooking } from "@/lib/baselineStore";
import { filterByWindow, windowFor } from "@/lib/periodFilter";

function fmtBrl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

interface CityRecommendation {
  city: string;
  bookings: number;
  spend2025: number;
  adr2025: number;
  currentCap: number;
  suggestedCap2026: number;
  leakageSpend: number;
  estimatedSavings: number;
  hotelsToRenegotiate: string[];
}

export function Rfp2026Plan() {
  const allBookings = useBaselineStore((s) => s.bookings);
  const contracts = useBaselineStore((s) => s.contracts);

  const recs = useMemo<CityRecommendation[]>(() => {
    const w2025 = windowFor("year", "2025");
    if (!w2025) return [];
    const bookings2025 = filterByWindow(allBookings, w2025);
    if (bookings2025.length === 0) return [];

    const byCity = new Map<string, typeof bookings2025>();
    bookings2025.forEach((b) => {
      const arr = byCity.get(b.city) ?? [];
      arr.push(b);
      byCity.set(b.city, arr);
    });

    const out: CityRecommendation[] = [];
    byCity.forEach((bs, city) => {
      const rn = bs.reduce((s, b) => s + b.room_nights, 0);
      const spend = bs.reduce((s, b) => s + b.room_nights * b.adr, 0);
      const adr = rn > 0 ? spend / rn : 0;

      // City cap as average of contract caps for hotels in this city (2025).
      const cityContractCaps = contracts
        .filter((c) => bs.some((b) => b.hotel === c.hotel) && c.valid_until?.startsWith("2025"))
        .map((c) => c.cap);
      const currentCap = cityContractCaps.length
        ? Math.round(cityContractCaps.reduce((s, v) => s + v, 0) / cityContractCaps.length)
        : Math.round(adr);

      const overCap = bs.filter((b) => b.adr > capForBooking(b, contracts));
      const leakageSpend = overCap.reduce((s, b) => s + b.room_nights * b.adr, 0);

      // Suggest 2026 cap = 95% of current ADR, rounded to nearest 5.
      const suggestedCap2026 = Math.round((adr * 0.95) / 5) * 5;
      // Conservative savings assumption: 35% of current leakage spend recovered.
      const estimatedSavings = Math.round(leakageSpend * 0.35);

      // Hotels with ADR > current cap consistently → must renegotiate.
      const hotelsToRenegotiate = Array.from(
        new Set(overCap.map((b) => b.hotel))
      ).slice(0, 4);

      out.push({
        city,
        bookings: bs.length,
        spend2025: spend,
        adr2025: adr,
        currentCap,
        suggestedCap2026,
        leakageSpend,
        estimatedSavings,
        hotelsToRenegotiate,
      });
    });

    return out
      .filter((r) => r.estimatedSavings > 0)
      .sort((a, b) => b.estimatedSavings - a.estimatedSavings)
      .slice(0, 5);
  }, [allBookings, contracts]);

  if (recs.length === 0) return null;

  const totalSavings = recs.reduce((s, r) => s + r.estimatedSavings, 0);

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Plano para a RFP 2026
            </h2>
            <p className="text-xs text-muted-foreground">
              Baseado no comparativo 2024 → 2025 e nos contratos vigentes ·
              economia potencial estimada{" "}
              <span className="font-semibold text-foreground">{fmtBrl(totalSavings)}/ano</span>
            </p>
          </div>
        </div>
      </header>

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Cidade</th>
              <th className="px-3 py-2 text-right">ADR 2025</th>
              <th className="px-3 py-2 text-right">Cap atual</th>
              <th className="px-3 py-2 text-right">Cap sugerido 2026</th>
              <th className="px-3 py-2 text-right">Leakage 2025</th>
              <th className="px-3 py-2 text-right">Economia est.</th>
              <th className="px-3 py-2 text-left">Renegociar</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((r) => (
              <tr key={r.city} className="border-t border-border">
                <td className="px-3 py-2 font-medium text-foreground">{r.city}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {fmtBrl(r.adr2025)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {fmtBrl(r.currentCap)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                    <Target className="h-3 w-3" />
                    {fmtBrl(r.suggestedCap2026)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-warning">
                  {fmtBrl(r.leakageSpend)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-success">
                  {fmtBrl(r.estimatedSavings)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.hotelsToRenegotiate.length > 0 ? (
                    <span className="inline-flex flex-wrap items-center gap-1">
                      {r.hotelsToRenegotiate.slice(0, 2).map((h) => (
                        <span key={h} className="rounded bg-muted px-1.5 py-0.5">
                          {h}
                        </span>
                      ))}
                      {r.hotelsToRenegotiate.length > 2 && (
                        <span className="text-[11px]">+{r.hotelsToRenegotiate.length - 2}</span>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ArrowRight className="h-3 w-3" />
        Próximo passo: criar uma RFP em <span className="font-medium text-foreground">/rfp</span> com
        as cidades acima e os caps sugeridos como teto de aceitação.
      </p>
    </section>
  );
}
