import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  SlidersHorizontal,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Download,
  Star,
  Mail,
  Calendar,
} from "lucide-react";
import { RFP_ROWS, type RfpRow, type RfpStatus } from "./rfpData";
import { cn } from "@/lib/utils";

type SortKey =
  | "hotel"
  | "city"
  | "tier"
  | "adr"
  | "variation"
  | "roomNights"
  | "spend"
  | "scoreTotal"
  | "status";

type SortDir = "asc" | "desc";

const STATUS_META: Record<RfpStatus, { label: string; cls: string; icon: typeof Check }> = {
  approved: {
    label: "Aprovado",
    cls: "bg-success-soft text-success border-success/20",
    icon: CheckCircle2,
  },
  negotiation: {
    label: "Em negociação",
    cls: "bg-warning-soft text-warning-foreground border-warning/30",
    icon: AlertCircle,
  },
  rejected: {
    label: "Rejeitado",
    cls: "bg-destructive-soft text-destructive border-destructive/20",
    icon: XCircle,
  },
  pending: {
    label: "Pendente",
    cls: "bg-info-soft text-info border-info/20",
    icon: Clock,
  },
};

const TIER_OPTIONS = ["Luxury", "Upscale", "Midscale", "Economy"] as const;
const STATUS_OPTIONS: RfpStatus[] = ["approved", "negotiation", "rejected", "pending"];

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString("en-US")}`;
}

function fmtNum(n: number) {
  return n.toLocaleString("en-US");
}

export function RfpComparisonTable() {
  const [sortKey, setSortKey] = useState<SortKey>("scoreTotal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<RfpStatus>>(new Set());
  const [cityFilter, setCityFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const cities = useMemo(() => [...new Set(RFP_ROWS.map((r) => r.city))].sort(), []);

  const filtered = useMemo(() => {
    return RFP_ROWS.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.hotel.toLowerCase().includes(q) &&
          !r.brand.toLowerCase().includes(q) &&
          !r.city.toLowerCase().includes(q)
        )
          return false;
      }
      if (tierFilter.size && !tierFilter.has(r.tier)) return false;
      if (statusFilter.size && !statusFilter.has(r.status)) return false;
      if (cityFilter && r.city !== cityFilter) return false;
      return true;
    });
  }, [search, tierFilter, statusFilter, cityFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av);
      const bs = String(bv);
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const allOnPageSelected = paged.length > 0 && paged.every((r) => selected.has(r.id));

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  function toggleExpand(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePageAll() {
    setSelected((s) => {
      const next = new Set(s);
      if (allOnPageSelected) {
        paged.forEach((r) => next.delete(r.id));
      } else {
        paged.forEach((r) => next.add(r.id));
      }
      return next;
    });
  }

  function toggleSetItem<T>(setter: (fn: (prev: Set<T>) => Set<T>) => void, item: T) {
    setter((s) => {
      const next = new Set(s);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
    setPage(1);
  }

  function clearAllFilters() {
    setSearch("");
    setTierFilter(new Set());
    setStatusFilter(new Set());
    setCityFilter("");
    setPage(1);
  }

  const activeFilterCount =
    (search ? 1 : 0) +
    tierFilter.size +
    statusFilter.size +
    (cityFilter ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-card)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar hotel, marca ou cidade..."
              className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
              showFilters || activeFilterCount > 0
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-card text-foreground hover:bg-secondary",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Limpar
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{sorted.length}</span> de {RFP_ROWS.length}{" "}
            respostas
          </span>
          {selected.size > 0 && (
            <span className="rounded-md border border-primary/30 bg-primary-soft px-2 py-0.5 font-medium text-primary">
              {selected.size} selecionado{selected.size > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:grid-cols-3">
          <FilterGroup label="Tier">
            <div className="flex flex-wrap gap-1.5">
              {TIER_OPTIONS.map((t) => (
                <Chip
                  key={t}
                  active={tierFilter.has(t)}
                  onClick={() => toggleSetItem(setTierFilter, t)}
                >
                  {t}
                </Chip>
              ))}
            </div>
          </FilterGroup>
          <FilterGroup label="Status">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <Chip
                  key={s}
                  active={statusFilter.has(s)}
                  onClick={() => toggleSetItem(setStatusFilter, s)}
                >
                  {STATUS_META[s].label}
                </Chip>
              ))}
            </div>
          </FilterGroup>
          <FilterGroup label="Cidade">
            <select
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Todas as cidades</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FilterGroup>
        </div>
      )}

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary-soft px-4 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium text-primary">
            {selected.size} hotéis selecionados para ação em lote
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <BulkAction icon={Check}>Aprovar</BulkAction>
            <BulkAction icon={Mail}>Solicitar revisão</BulkAction>
            <BulkAction icon={Download}>Exportar CSV</BulkAction>
            <button
              onClick={() => setSelected(new Set())}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Limpar seleção
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={togglePageAll}
                    className="h-3.5 w-3.5 cursor-pointer rounded border-border text-primary focus:ring-1 focus:ring-ring"
                  />
                </th>
                <th className="w-8 px-1 py-2.5"></th>
                <SortHeader k="hotel" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>
                  Hotel
                </SortHeader>
                <SortHeader k="city" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>
                  Cidade
                </SortHeader>
                <SortHeader k="tier" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>
                  Tier
                </SortHeader>
                <SortHeader
                  k="adr"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  align="right"
                >
                  ADR / Cap
                </SortHeader>
                <SortHeader
                  k="variation"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  align="right"
                >
                  Δ Cap
                </SortHeader>
                <SortHeader
                  k="roomNights"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  align="right"
                >
                  RN
                </SortHeader>
                <SortHeader
                  k="spend"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  align="right"
                >
                  Spend
                </SortHeader>
                <SortHeader
                  k="scoreTotal"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  align="right"
                >
                  Score
                </SortHeader>
                <SortHeader k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>
                  Status
                </SortHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhuma resposta encontrada com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                paged.map((row) => {
                  const isExpanded = expanded.has(row.id);
                  const isSelected = selected.has(row.id);
                  const status = STATUS_META[row.status];
                  const StatusIcon = status.icon;
                  return (
                    <RowGroup key={row.id}>
                      <tr
                        className={cn(
                          "transition-colors",
                          isSelected ? "bg-primary-soft/40" : "hover:bg-secondary/40",
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(row.id)}
                            className="h-3.5 w-3.5 cursor-pointer rounded border-border text-primary focus:ring-1 focus:ring-ring"
                          />
                        </td>
                        <td className="px-1 py-2.5">
                          <button
                            onClick={() => toggleExpand(row.id)}
                            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            aria-label={isExpanded ? "Recolher" : "Expandir"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium text-foreground">{row.hotel}</div>
                          <div className="text-[11px] text-muted-foreground">{row.brand}</div>
                        </td>
                        <td className="py-2.5 pr-3 text-foreground">{row.city}</td>
                        <td className="py-2.5 pr-3">
                          <TierBadge tier={row.tier} />
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          <span className="font-medium text-foreground">${row.adr}</span>
                          <span className="text-muted-foreground"> / ${row.cap}</span>
                        </td>
                        <td
                          className={cn(
                            "py-2.5 pr-3 text-right font-medium tabular-nums",
                            row.variation > 0 ? "text-destructive" : "text-success",
                          )}
                        >
                          {row.variation > 0 ? "+" : ""}
                          {row.variation.toFixed(1)}%
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-foreground">
                          {fmtNum(row.roomNights)}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-foreground">
                          {fmtMoney(row.spend)}
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          <ScoreBadge score={row.scoreTotal} />
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                              status.cls,
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-secondary/30">
                          <td colSpan={11} className="px-4 py-4">
                            <ExpandedDetails row={row} />
                          </td>
                        </tr>
                      )}
                    </RowGroup>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 border-t border-border px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Linhas por página:</span>
            <div className="flex gap-0.5 rounded-md border border-border bg-secondary p-0.5">
              {([25, 50, 100] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setPageSize(n);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded px-2 py-0.5 font-medium transition-colors",
                    pageSize === n
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <span>
              {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, sorted.length)} de {sorted.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 font-medium text-foreground">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function SortHeader({
  children,
  k,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  children: React.ReactNode;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn(
        "py-2.5 pr-3 text-[11px] font-medium uppercase tracking-wide",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      <button
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active ? "text-foreground" : "",
          align === "right" ? "flex-row-reverse" : "",
        )}
      >
        {children}
        <Icon className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} />
      </button>
    </th>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-secondary",
      )}
    >
      {active && <Check className="h-3 w-3" />}
      {children}
    </button>
  );
}

function BulkAction({
  icon: Icon,
  children,
}: {
  icon: typeof Check;
  children: React.ReactNode;
}) {
  return (
    <button className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary">
      <Icon className="h-3 w-3" />
      {children}
    </button>
  );
}

function TierBadge({ tier }: { tier: RfpRow["tier"] }) {
  const map: Record<RfpRow["tier"], string> = {
    Luxury: "bg-info-soft text-info border-info/20",
    Upscale: "bg-primary-soft text-primary border-primary/20",
    Midscale: "bg-secondary text-muted-foreground border-border",
    Economy: "bg-success-soft text-success border-success/20",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium",
        map[tier],
      )}
    >
      {tier}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "bg-success text-success-foreground"
      : score >= 70
        ? "bg-warning text-warning-foreground"
        : "bg-destructive text-destructive-foreground";
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-[2rem] items-center justify-center rounded px-1.5 text-[11px] font-semibold tabular-nums",
        tone,
      )}
    >
      {score}
    </span>
  );
}

function ExpandedDetails({ row }: { row: RfpRow }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div>
        <SectionTitle>Score breakdown</SectionTitle>
        <div className="space-y-2">
          <ScoreBar label="Comercial" value={row.scoreCommercial} weight="50%" />
          <ScoreBar label="Compliance" value={row.scoreCompliance} weight="30%" />
          <ScoreBar label="Localização" value={row.scoreLocation} weight="20%" />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Score total ponderado
          </span>
          <ScoreBadge score={row.scoreTotal} />
        </div>
      </div>

      <div>
        <SectionTitle>Amenities & políticas</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <AmenityRow ok={row.breakfast} label="Café da manhã" />
          <AmenityRow ok={row.wifi} label="Wi-Fi grátis" />
          <AmenityRow ok={row.lra} label="LRA garantido" />
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-[11px]">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Cancel.:</span>
            <span className="font-medium text-foreground">{row.cancellation}h</span>
          </div>
        </div>
      </div>

      <div>
        <SectionTitle>Resposta & contato</SectionTitle>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            Recebida em{" "}
            <span className="font-medium text-foreground">
              {new Date(row.responseDate).toLocaleDateString("pt-BR")}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3 w-3" />
            <a
              href={`mailto:${row.contact}`}
              className="font-medium text-primary hover:underline"
            >
              {row.contact}
            </a>
          </div>
          <p className="mt-2 rounded-md border border-border bg-card p-2 text-[11px] leading-relaxed text-muted-foreground">
            <Star className="mr-1 inline h-3 w-3 -translate-y-px text-warning" />
            {row.notes}
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h5 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h5>
  );
}

function ScoreBar({ label, value, weight }: { label: string; value: number; weight: string }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          {label} <span className="text-[10px]">({weight})</span>
        </span>
        <span className="font-medium tabular-nums text-foreground">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            value >= 85 ? "bg-success" : value >= 70 ? "bg-warning" : "bg-destructive",
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function AmenityRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-[11px]">
      {ok ? (
        <Check className="h-3 w-3 text-success" />
      ) : (
        <X className="h-3 w-3 text-destructive" />
      )}
      <span className={cn(ok ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </div>
  );
}