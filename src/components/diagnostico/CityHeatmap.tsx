import { MapPin } from "lucide-react";

interface CityRow {
  city: string;
  state: string;
  roomNights: number;
  spend: number;
  hotels: number;
  adr: number;
  cap: number;
}

const cities: CityRow[] = [
  { city: "São Paulo", state: "SP", roomNights: 18420, spend: 5840000, hotels: 42, adr: 317, cap: 320 },
  { city: "Rio de Janeiro", state: "RJ", roomNights: 9870, spend: 3210000, hotels: 28, adr: 325, cap: 310 },
  { city: "Brasília", state: "DF", roomNights: 6240, spend: 1980000, hotels: 19, adr: 317, cap: 330 },
  { city: "Belo Horizonte", state: "MG", roomNights: 4180, spend: 1080000, hotels: 14, adr: 258, cap: 270 },
  { city: "Curitiba", state: "PR", roomNights: 3520, spend: 850000, hotels: 12, adr: 241, cap: 250 },
  { city: "Porto Alegre", state: "RS", roomNights: 3110, spend: 780000, hotels: 11, adr: 250, cap: 260 },
  { city: "Recife", state: "PE", roomNights: 2680, spend: 620000, hotels: 9, adr: 231, cap: 240 },
  { city: "Salvador", state: "BA", roomNights: 2240, spend: 540000, hotels: 8, adr: 241, cap: 245 },
  { city: "Fortaleza", state: "CE", roomNights: 1980, spend: 420000, hotels: 7, adr: 212, cap: 230 },
  { city: "Manaus", state: "AM", roomNights: 1420, spend: 380000, hotels: 6, adr: 267, cap: 250 },
];

const max = Math.max(...cities.map((c) => c.roomNights));

function intensity(n: number) {
  const ratio = n / max;
  // map 0-1 to soft → strong primary
  const lightness = 0.95 - ratio * 0.5; // 0.45 strongest, 0.95 lightest
  const chroma = 0.04 + ratio * 0.16;
  return `oklch(${lightness} ${chroma} 258)`;
}

function fmtNumber(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function CityHeatmap() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Distribuição geográfica de room nights
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Top 10 cidades por volume — últimos 12 meses
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Menor</span>
          <div className="flex h-2 w-24 overflow-hidden rounded-full">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((r) => (
              <div
                key={r}
                className="flex-1"
                style={{ backgroundColor: intensity(r * max) }}
              />
            ))}
          </div>
          <span>Maior</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {cities.map((c) => {
          const overCap = c.adr > c.cap;
          return (
            <div
              key={c.city}
              className="group relative overflow-hidden rounded-md border border-border/60 p-3 transition-shadow hover:shadow-[var(--shadow-elevated)]"
              style={{ backgroundColor: intensity(c.roomNights) }}
            >
              <div className="flex items-start justify-between">
                <MapPin
                  className="h-3.5 w-3.5"
                  style={{
                    color:
                      c.roomNights / max > 0.55
                        ? "oklch(1 0 0 / 0.85)"
                        : "oklch(0.45 0.03 254)",
                  }}
                />
                {overCap && (
                  <span className="rounded-sm bg-destructive-soft px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-destructive">
                    +cap
                  </span>
                )}
              </div>
              <p
                className="mt-2 truncate text-sm font-semibold"
                style={{
                  color:
                    c.roomNights / max > 0.55
                      ? "oklch(1 0 0)"
                      : "oklch(0.27 0.04 254)",
                }}
              >
                {c.city}
              </p>
              <p
                className="text-[10px] uppercase tracking-wide"
                style={{
                  color:
                    c.roomNights / max > 0.55
                      ? "oklch(1 0 0 / 0.7)"
                      : "oklch(0.45 0.03 254)",
                }}
              >
                {c.state} · {c.hotels} hotéis
              </p>
              <p
                className="mt-2 font-mono text-base font-semibold tabular-nums"
                style={{
                  color:
                    c.roomNights / max > 0.55
                      ? "oklch(1 0 0)"
                      : "oklch(0.27 0.04 254)",
                }}
              >
                {fmtNumber(c.roomNights)}
              </p>
              <p
                className="text-[10px]"
                style={{
                  color:
                    c.roomNights / max > 0.55
                      ? "oklch(1 0 0 / 0.75)"
                      : "oklch(0.45 0.03 254)",
                }}
              >
                {fmtCurrency(c.spend)} · ADR ${c.adr}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}