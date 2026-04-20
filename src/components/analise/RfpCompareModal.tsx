import { useEffect } from "react";
import {
  X,
  Check,
  Trophy,
  Mail,
  Calendar,
  Building2,
  MapPin,
  Download,
} from "lucide-react";
import type { RfpRow, RfpStatus } from "./rfpData";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<RfpStatus, string> = {
  approved: "Aprovado",
  negotiation: "Em negociação",
  rejected: "Rejeitado",
  pending: "Pendente",
};

const STATUS_CLS: Record<RfpStatus, string> = {
  approved: "bg-success-soft text-success border-success/20",
  negotiation: "bg-warning-soft text-warning-foreground border-warning/30",
  rejected: "bg-destructive-soft text-destructive border-destructive/20",
  pending: "bg-info-soft text-info border-info/20",
};

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString("en-US")}`;
}

function fmtNum(n: number) {
  return n.toLocaleString("en-US");
}

type Direction = "max" | "min" | "true" | "none";

interface Attr {
  label: string;
  get: (r: RfpRow) => React.ReactNode;
  rank?: (r: RfpRow) => number | boolean | null;
  direction?: Direction;
}

interface Section {
  title: string;
  attrs: Attr[];
}

const SECTIONS: Section[] = [
  {
    title: "Identidade",
    attrs: [
      { label: "Marca", get: (r) => r.brand },
      { label: "Cidade", get: (r) => r.city },
      { label: "Tier", get: (r) => r.tier },
    ],
  },
  {
    title: "Comercial",
    attrs: [
      {
        label: "ADR negociado",
        get: (r) => `$${r.adr}`,
        rank: (r) => r.adr,
        direction: "min",
      },
      { label: "City cap", get: (r) => `$${r.cap}` },
      {
        label: "Variação vs cap",
        get: (r) => (
          <span
            className={cn(
              "font-medium tabular-nums",
              r.variation > 0 ? "text-destructive" : "text-success",
            )}
          >
            {r.variation > 0 ? "+" : ""}
            {r.variation.toFixed(1)}%
          </span>
        ),
        rank: (r) => r.variation,
        direction: "min",
      },
      {
        label: "Room nights",
        get: (r) => fmtNum(r.roomNights),
        rank: (r) => r.roomNights,
        direction: "max",
      },
      {
        label: "Spend anual",
        get: (r) => fmtMoney(r.spend),
        rank: (r) => r.spend,
        direction: "max",
      },
    ],
  },
  {
    title: "Compliance & políticas",
    attrs: [
      {
        label: "Café da manhã",
        get: (r) => <BoolPill ok={r.breakfast} />,
        rank: (r) => r.breakfast,
        direction: "true",
      },
      {
        label: "Wi-Fi grátis",
        get: (r) => <BoolPill ok={r.wifi} />,
        rank: (r) => r.wifi,
        direction: "true",
      },
      {
        label: "LRA garantido",
        get: (r) => <BoolPill ok={r.lra} />,
        rank: (r) => r.lra,
        direction: "true",
      },
      {
        label: "Cancelamento",
        get: (r) => `${r.cancellation}h`,
        rank: (r) => r.cancellation,
        direction: "min",
      },
    ],
  },
  {
    title: "Score & status",
    attrs: [
      {
        label: "Score comercial (50%)",
        get: (r) => r.scoreCommercial,
        rank: (r) => r.scoreCommercial,
        direction: "max",
      },
      {
        label: "Score compliance (30%)",
        get: (r) => r.scoreCompliance,
        rank: (r) => r.scoreCompliance,
        direction: "max",
      },
      {
        label: "Score localização (20%)",
        get: (r) => r.scoreLocation,
        rank: (r) => r.scoreLocation,
        direction: "max",
      },
      {
        label: "Score total ponderado",
        get: (r) => (
          <span className="text-base font-semibold tabular-nums text-foreground">
            {r.scoreTotal}
          </span>
        ),
        rank: (r) => r.scoreTotal,
        direction: "max",
      },
      {
        label: "Status",
        get: (r) => (
          <span
            className={cn(
              "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
              STATUS_CLS[r.status],
            )}
          >
            {STATUS_LABEL[r.status]}
          </span>
        ),
      },
    ],
  },
  {
    title: "Resposta & contato",
    attrs: [
      {
        label: "Data de resposta",
        get: (r) => new Date(r.responseDate).toLocaleDateString("pt-BR"),
      },
      {
        label: "Contato comercial",
        get: (r) => (
          <a
            href={`mailto:${r.contact}`}
            className="text-primary hover:underline"
          >
            {r.contact}
          </a>
        ),
      },
    ],
  },
];

function bestIndex(rows: RfpRow[], attr: Attr): number | null {
  if (!attr.rank || !attr.direction || attr.direction === "none") return null;
  const values = rows.map((r) => attr.rank!(r));
  if (attr.direction === "true") {
    const trues = values
      .map((v, i) => (v === true ? i : -1))
      .filter((i) => i >= 0);
    if (trues.length === 0 || trues.length === rows.length) return null;
    return trues[0]; // mark first; we'll mark all in render via separate check
  }
  const nums = values as number[];
  if (new Set(nums).size === 1) return null;
  if (attr.direction === "max") {
    return nums.indexOf(Math.max(...nums));
  }
  return nums.indexOf(Math.min(...nums));
}

function isBest(rows: RfpRow[], attr: Attr, idx: number): boolean {
  if (!attr.rank || !attr.direction || attr.direction === "none") return false;
  const values = rows.map((r) => attr.rank!(r));
  if (attr.direction === "true") {
    const trueCount = values.filter((v) => v === true).length;
    if (trueCount === 0 || trueCount === rows.length) return false;
    return values[idx] === true;
  }
  const nums = values as number[];
  if (new Set(nums).size === 1) return false;
  const target = attr.direction === "max" ? Math.max(...nums) : Math.min(...nums);
  return nums[idx] === target;
}

export function RfpCompareModal({
  rows,
  onClose,
}: {
  rows: RfpRow[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Determine overall winner (highest scoreTotal)
  const winnerIdx = rows.reduce(
    (best, r, i, arr) => (r.scoreTotal > arr[best].scoreTotal ? i : best),
    0,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-foreground/40 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        className="flex w-full flex-col overflow-hidden bg-background shadow-2xl sm:max-w-6xl sm:rounded-lg sm:border sm:border-border"
        role="dialog"
        aria-modal="true"
        aria-label="Comparação de hotéis"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Comparação lado a lado
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {rows.length} hotéis · destaques marcam o melhor valor por atributo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="hidden h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary sm:inline-flex">
              <Download className="h-3.5 w-3.5" />
              Exportar PDF
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            {/* Hotel headers row */}
            <thead className="sticky top-0 z-10 bg-card shadow-sm">
              <tr className="border-b border-border">
                <th className="w-44 bg-card px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:w-56">
                  Atributo
                </th>
                {rows.map((r, i) => (
                  <th
                    key={r.id}
                    className={cn(
                      "min-w-[180px] border-l border-border px-4 py-3 text-left align-top",
                      i === winnerIdx && "bg-primary-soft/40",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                          i === winnerIdx
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {i === winnerIdx ? (
                          <Trophy className="h-4 w-4" />
                        ) : (
                          <Building2 className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {r.hotel}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {r.city}
                        </div>
                        {i === winnerIdx && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded border border-primary/30 bg-card px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <Trophy className="h-2.5 w-2.5" />
                            Melhor score
                          </span>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {SECTIONS.map((section) => (
                <SectionBlock
                  key={section.title}
                  section={section}
                  rows={rows}
                  winnerIdx={winnerIdx}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <LegendDot className="bg-success" label="Melhor valor" />
            <LegendDot className="bg-primary" label="Vencedor geral" />
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Fechar comparação
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionBlock({
  section,
  rows,
  winnerIdx,
}: {
  section: Section;
  rows: RfpRow[];
  winnerIdx: number;
}) {
  return (
    <>
      <tr className="bg-secondary/50">
        <td
          colSpan={rows.length + 1}
          className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {section.title}
        </td>
      </tr>
      {section.attrs.map((attr) => (
        <tr key={attr.label} className="border-b border-border">
          <td className="bg-card px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
            {attr.label}
          </td>
          {rows.map((r, i) => {
            const best = isBest(rows, attr, i);
            return (
              <td
                key={r.id}
                className={cn(
                  "border-l border-border px-4 py-2.5 align-top text-foreground",
                  i === winnerIdx && "bg-primary-soft/20",
                  best && "relative",
                )}
              >
                <div className="flex items-center gap-1.5">
                  {best && (
                    <span
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"
                      title="Melhor valor"
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-xs",
                      best && "font-semibold text-success",
                    )}
                  >
                    {attr.get(r)}
                  </span>
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function BoolPill({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check className="h-3 w-3" /> Sim
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <X className="h-3 w-3" /> Não
    </span>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", className)} />
      {label}
    </span>
  );
}