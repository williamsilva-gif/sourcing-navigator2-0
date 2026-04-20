import { useMemo, useState } from "react";
import { Search, ArrowUpDown, Trophy, Shield, Building2, Wifi, Coffee, Car, Dumbbell, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AWARDED, AMENITY_LABELS, type AwardedHotel } from "./selectionData";

const AMENITY_ICON: Record<string, typeof Wifi> = {
  breakfast: Coffee, wifi: Wifi, lra: Lock, parking: Car, gym: Dumbbell,
};

type SortKey = "city" | "finalAdr" | "roomNights" | "qualityScore" | "compliance";

function fmt$(n: number) { return `$${n.toLocaleString("en-US")}`; }

export function AwardedMatrix() {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("city");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [tierFilter, setTierFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return AWARDED.filter((h) => {
      const matches = !ql || h.hotel.toLowerCase().includes(ql) || h.city.toLowerCase().includes(ql) || h.brand.toLowerCase().includes(ql);
      const tierOk = tierFilter === "all" || h.tier === tierFilter;
      return matches && tierOk;
    }).sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [q, sortKey, sortDir, tierFilter]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <section className="rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">Matriz final de hotéis adjudicados</h2>
            <p className="text-xs text-muted-foreground">{filtered.length} de {AWARDED.length} hotéis · primários e backups</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="h-8 w-56 pl-8 text-xs" placeholder="Buscar hotel, cidade, marca..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex h-8 items-center gap-1 rounded-md border border-input bg-background p-0.5 text-xs">
            {(["all", "Luxury", "Upscale", "Midscale"] as const).map((t) => (
              <button key={t} onClick={() => setTierFilter(t)}
                className={`rounded px-2 py-1 transition-colors ${tierFilter === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "all" ? "Todos" : t}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <Th>Hotel</Th>
              <Th sortable onClick={() => toggleSort("city")} active={sortKey === "city"} dir={sortDir}>Cidade</Th>
              <Th>Tier</Th>
              <Th>Status</Th>
              <Th sortable onClick={() => toggleSort("finalAdr")} active={sortKey === "finalAdr"} dir={sortDir} className="text-right">ADR final</Th>
              <Th className="text-right">Cap</Th>
              <Th sortable onClick={() => toggleSort("roomNights")} active={sortKey === "roomNights"} dir={sortDir} className="text-right">Room nights</Th>
              <Th className="text-right">Spend</Th>
              <Th>Amenities</Th>
              <Th sortable onClick={() => toggleSort("qualityScore")} active={sortKey === "qualityScore"} dir={sortDir} className="text-right">Quality</Th>
              <Th sortable onClick={() => toggleSort("compliance")} active={sortKey === "compliance"} dir={sortDir} className="text-right">Compl.</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((h) => <Row key={h.id} h={h} />)}
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">Nenhum hotel encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children, sortable, onClick, active, dir, className = "" }: { children: React.ReactNode; sortable?: boolean; onClick?: () => void; active?: boolean; dir?: "asc" | "desc"; className?: string }) {
  return (
    <th className={`px-3 py-2.5 font-semibold ${className}`}>
      {sortable ? (
        <button onClick={onClick} className={`inline-flex items-center gap-1 ${active ? "text-foreground" : ""} hover:text-foreground`}>
          {children}
          <ArrowUpDown className={`h-3 w-3 ${active ? (dir === "asc" ? "rotate-0" : "rotate-180") : "opacity-50"}`} />
        </button>
      ) : children}
    </th>
  );
}

function Row({ h }: { h: AwardedHotel }) {
  const spend = h.finalAdr * h.roomNights;
  const overCap = h.finalAdr > h.cap;
  return (
    <tr className="text-foreground hover:bg-muted/30">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">{h.hotel}</p>
            <p className="text-[10px] text-muted-foreground">{h.brand}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">{h.city}</td>
      <td className="px-3 py-2.5">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{h.tier}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          h.status === "primary" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
        }`}>
          {h.status === "primary" ? <><Trophy className="h-2.5 w-2.5" />Primário</> : "Backup"}
        </span>
      </td>
      <td className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${overCap ? "text-destructive" : "text-success"}`}>
        {fmt$(h.finalAdr)}
      </td>
      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{fmt$(h.cap)}</td>
      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{h.roomNights.toLocaleString("pt-BR")}</td>
      <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">{fmt$(spend)}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          {h.amenities.map((a) => {
            const Icon = AMENITY_ICON[a];
            return Icon ? (
              <span key={a} className="flex h-5 w-5 items-center justify-center rounded bg-muted text-muted-foreground" title={AMENITY_LABELS[a]}>
                <Icon className="h-3 w-3" />
              </span>
            ) : null;
          })}
        </div>
      </td>
      <td className="px-3 py-2.5 text-right">
        <ScorePill value={h.qualityScore} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="inline-flex items-center gap-1 text-xs">
          <Shield className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono font-semibold tabular-nums">{h.compliance}%</span>
        </span>
      </td>
    </tr>
  );
}

function ScorePill({ value }: { value: number }) {
  const tone = value >= 90 ? "bg-success-soft text-success" : value >= 80 ? "bg-warning-soft text-warning-foreground" : "bg-muted text-muted-foreground";
  return <span className={`inline-flex min-w-[2.25rem] justify-center rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${tone}`}>{value}</span>;
}

