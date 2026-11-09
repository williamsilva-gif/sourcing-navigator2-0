import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Download, MapPin, Play, X } from "lucide-react";
import { CoordinateImport } from "./CoordinateImport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { crossingSources } from "@/lib/crossingTenKm/sources.functions";
import {
  calculate,
  coords,
  points,
  supplement,
  type Result,
  type Supplement,
  type Point,
} from "@/lib/crossingTenKm/core";
import { parseSupplement, exportWorkbook } from "@/lib/crossingTenKm/files";
import type { Row } from "@/lib/sheetGeolocation/core";
const selectClass =
  "h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground";
const fmt = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const matches = (p: Point, q: string) =>
  `${p.name} ${p.code} ${p.city} ${p.uf} ${p.address}`
    .toLocaleLowerCase()
    .includes(q.toLocaleLowerCase());
export function CrossingTenKm({ tenants }: { tenants: { id: string; name: string }[] }) {
  const [tenantId, setTenant] = useState(
    tenants.find((t) => /travel academy/i.test(t.name))?.id ?? tenants[0]?.id ?? "",
  );
  const [hotelId, setHotel] = useState(""),
    [officeId, setOffice] = useState("");
  const [officeMode, setOfficeMode] = useState("upload");
  const [uploaded, setUploaded] = useState<
    Partial<Record<"hotel" | "office", { points: Point[]; filename: string }>>
  >({});
  const [extras, setExtras] = useState<{ hotel: Supplement[]; office: Supplement[] }>({
    hotel: [],
    office: [],
  });
  const [files, setFiles] = useState({ hotel: "", office: "" });
  const [result, setResult] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [view, setView] = useState("offices"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const read = useServerFn(crossingSources);
  const jobs = useQuery({
    queryKey: ["crossing-ten-km", tenantId],
    queryFn: () => read({ data: { tenantId } }),
    enabled: !!tenantId,
  });
  const hotels = jobs.data?.jobs.filter((j) => j.kind === "hotel") ?? [],
    offices = jobs.data?.jobs.filter((j) => j.kind === "office") ?? [];
  // Prefer the explicitly requested full sources; newer retry subsets must not replace 666 offices.
  const hid =
      hotelId ||
      hotels.find((j) => j.id === "3e252a30-20af-4584-8dfc-542d54f70644")?.id ||
      hotels[0]?.id ||
      "",
    oid =
      officeId ||
      offices.find((j) => j.id === "a7896096-48fb-4569-adf6-bb9e124b4e0d")?.id ||
      offices[0]?.id ||
      "";
  const hjob = hotels.find((j) => j.id === hid),
    ojob = offices.find((j) => j.id === oid);
  const clear = () => {
    setResult(null);
    setPage(0);
    setError("");
  };
  const upload = async (kind: "hotel" | "office", file: File) => {
    clear();
    setExtras((v) => ({ ...v, [kind]: [] }));
    setFiles((v) => ({ ...v, [kind]: "" }));
    try {
      if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error("Use CSV ou XLSX.");
      const rows = parseSupplement(new Uint8Array(await file.arrayBuffer()), file.name);
      setExtras((v) => ({ ...v, [kind]: rows }));
      setFiles((v) => ({ ...v, [kind]: file.name }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Arquivo inválido.");
    }
  };
  const run = async () => {
    setBusy(true);
    clear();
    try {
      const readPoints = async (kind: "hotel" | "office", id: string) => {
        const local = uploaded[kind];
        if (local && (kind === "hotel" || officeMode === "upload")) return local.points;
        if (kind === "office" && officeMode === "upload")
          throw new Error("Importe e confirme os 631 escritórios atualizados.");
        const data = await read({ data: { tenantId, jobId: id } });
        if (!data.job || data.job.kind !== kind) throw new Error("Selecione fontes concluídas.");
        return points(data.job.rows as unknown as Row[], kind, data.job.filename);
      };
      const [h, o] = await Promise.all([readPoints("hotel", hid), readPoints("office", oid)]);
      const hs = supplement(h, extras.hotel);
      const os = supplement(o, extras.office);
      setResult(calculate(hs.points, os.points, [...hs.audit, ...os.audit]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível calcular.");
    } finally {
      setBusy(false);
    }
  };
  const pairs =
    result?.pairs.filter((p) => matches(p.hotel, search) || matches(p.office, search)) ?? [];
  const summaries =
    result?.hotelSummary.filter(
      (h) => matches(h.hotel, search) || (h.nearest && matches(h.nearest, search)),
    ) ?? [];
  const visible =
    view === "offices"
      ? pairs.slice(page * 100, page * 100 + 100)
      : summaries.slice(page * 100, page * 100 + 100);
  const total = view === "offices" ? pairs.length : summaries.length;
  return (
    <section className="min-w-0 max-w-full space-y-6 text-foreground">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <MapPin className="h-6 w-6 text-primary" />
          Cruzamento 10 km
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Distância em linha reta · todas as cidades e UFs · sem consultas Google
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          Cliente
          <select
            aria-label="Cliente do cruzamento"
            className={selectClass}
            value={tenantId}
            onChange={(e) => {
              setTenant(e.target.value);
              setHotel("");
              setOffice("");
              setUploaded({});
              setOfficeMode("upload");
              setExtras({ hotel: [], office: [] });
              setFiles({ hotel: "", office: "" });
              clear();
            }}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          Hotéis · {uploaded.hotel?.points.length ?? hjob?.checkpoint ?? 0}
          <select
            aria-label="Fonte hotéis"
            className={selectClass}
            value={hid}
            onChange={(e) => {
              setHotel(e.target.value);
              setUploaded((v) => ({ ...v, hotel: undefined }));
              clear();
            }}
          >
            <option value="">Selecione arquivo concluído</option>
            {hotels.map((j) => (
              <option key={j.id} value={j.id}>
                {j.filename} · {j.checkpoint}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          Fonte principal de escritórios
          <select
            aria-label="Modo fonte escritórios"
            className={selectClass}
            value={officeMode}
            onChange={(e) => {
              setOfficeMode(e.target.value);
              clear();
            }}
          >
            <option value="upload">Nova planilha · 631 escritórios</option>
            <option value="historical">Arquivo histórico concluído</option>
          </select>
          {officeMode === "historical" && (
            <>
              Escritórios históricos · {ojob?.checkpoint ?? 0}
              <select
                aria-label="Fonte escritórios"
                className={selectClass}
                value={oid}
                onChange={(e) => {
                  setOffice(e.target.value);
                  clear();
                }}
              >
                <option value="">Selecione arquivo concluído</option>
                {offices.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.filename} · {j.checkpoint}
                  </option>
                ))}
              </select>
            </>
          )}
        </label>
      </div>
      {jobs.isLoading && <p role="status">Carregando arquivos concluídos…</p>}
      {jobs.isError && (
        <p role="alert" className="text-destructive">
          {jobs.error.message}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {officeMode === "upload" && (
          <CoordinateImport
            kind="office"
            onConfirm={(rows, filename) => {
              setUploaded((v) => ({ ...v, office: { points: rows, filename } }));
              setExtras((v) => ({ ...v, office: [] }));
              setFiles((v) => ({ ...v, office: "" }));
              clear();
            }}
          />
        )}
        <CoordinateImport
          kind="hotel"
          onConfirm={(rows, filename) => {
            setUploaded((v) => ({ ...v, hotel: { points: rows, filename } }));
            setExtras((v) => ({ ...v, hotel: [] }));
            setFiles((v) => ({ ...v, hotel: "" }));
            clear();
          }}
        />
      </div>
      {(["office", "hotel"] as const).map(
        (kind) =>
          uploaded[kind] &&
          (kind === "hotel" || officeMode === "upload") && (
            <div key={kind} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="break-all">
                Fonte ativa: {uploaded[kind]?.filename} · {uploaded[kind]?.points.length}{" "}
                {kind === "office" ? "escritórios" : "hotéis"} · somente neste navegador
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remover fonte importada ${kind}`}
                title="Remover fonte importada"
                onClick={() => {
                  setUploaded((v) => ({ ...v, [kind]: undefined }));
                  clear();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ),
      )}
      <div className="grid gap-4 border-y border-border py-4 md:grid-cols-2">
        {(["office", "hotel"] as const).map((kind) => (
          <div key={kind} className="min-w-0 space-y-2">
            <label className="block text-sm">
              Suplemento opcional · {kind === "office" ? "Código ESC" : "CNPJ do hotel"}
              <Input
                aria-label={`Suplemento ${kind === "office" ? "escritórios" : "hotéis"}`}
                type="file"
                accept=".csv,.xlsx"
                className="mt-2"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(kind, f);
                  e.target.value = "";
                }}
              />
            </label>
            {files[kind] && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="min-w-0 break-all">
                  {files[kind]} · {extras[kind].length} registros
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Remover suplemento"
                  aria-label={`Remover suplemento ${kind}`}
                  onClick={() => {
                    setExtras((v) => ({ ...v, [kind]: [] }));
                    setFiles((v) => ({ ...v, [kind]: "" }));
                    clear();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Coordenadas em revisão, aproximadas, postais ou municipais participam igualmente. A
        distância é indicativa e pode não representar a entrada ou o prédio. Suplementos preenchem
        somente campos vazios, sem alterar os arquivos existentes; duplicatas e coordenadas
        inválidas são descartadas com auditoria.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => void run()}
          disabled={
            busy ||
            (!uploaded.hotel && (!hid || jobs.isFetching)) ||
            (officeMode === "upload" ? !uploaded.office : !oid || jobs.isFetching)
          }
        >
          <Play className="mr-2 h-4 w-4" />
          {busy ? "Calculando…" : "Calcular proximidade 10 km"}
        </Button>
        {result && (
          <Button
            variant="outline"
            onClick={() => XLSX.writeFile(exportWorkbook(result), "Cruzamento-10km.xlsx")}
          >
            <Download className="mr-2 h-4 w-4" />
            Baixar Excel completo
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {result && (
        <>
          <div
            className="grid grid-cols-2 gap-4 border-y border-border py-5 lg:grid-cols-4"
            aria-label="Totais do cruzamento"
          >
            {[
              ["Hotéis", result.hotels.length],
              ["Escritórios", result.offices.length],
              ["Hotéis aptos", result.hotels.filter(coords).length],
              ["Escritórios aptos", result.offices.filter(coords).length],
              ["Hotéis sem coordenadas aptas", result.hotels.filter((p) => !coords(p)).length],
              [
                "Escritórios sem coordenadas aptas",
                result.offices.filter((p) => !coords(p)).length,
              ],
              ["Pares até 10 km", result.pairs.length],
              [
                "Escritórios sem hotel até 10 km",
                result.officeSummary.filter((o) => !o.count).length,
              ],
              [
                "Hotéis sem escritório até 10 km",
                result.hotelSummary.filter((h) => !h.count).length,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-2xl font-semibold tabular-nums">{value}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              value={view}
              onValueChange={(v) => {
                setView(v);
                setPage(0);
              }}
            >
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="offices">Escritórios → hotéis até 10 km</TabsTrigger>
                <TabsTrigger value="hotels">Hotéis → escritório mais próximo</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              aria-label="Buscar cruzamento"
              placeholder="Hotel, escritório, cidade, UF ou código"
              className="max-w-sm"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {total} {view === "offices" ? "pares" : "hotéis"} encontrados · Excel inclui todos os
            registros, inclusive zeros e sem coordenadas.
          </p>
          <div className="max-w-full overflow-x-auto border-y border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  {(view === "offices"
                    ? [
                        "Escritório / cidade",
                        "Hotel / CNPJ / cidade",
                        "Distância reta",
                        "Faixa",
                        "Precisão escritório / hotel",
                      ]
                    : [
                        "Hotel / CNPJ / cidade",
                        "Escritório mais próximo / cidade",
                        "Distância reta global",
                        "Escritórios ≤10 km",
                        "Precisão hotel / escritório",
                      ]
                  ).map((h) => (
                    <th key={h} className="p-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const pair = "office" in item ? item : null,
                    h = "hotel" in item ? item.hotel : null,
                    nearest = "nearest" in item ? item.nearest : null;
                  if (!h) return null;
                  const o = pair?.office ?? nearest;
                  const km = item.km;
                  return (
                    <tr
                      key={pair ? `${pair.office.id}-${h.id}` : h.id}
                      className="border-t border-border"
                    >
                      <td className="p-3">
                        {view === "offices" ? (
                          <>
                            {o?.code}
                            <small className="block text-muted-foreground">
                              {o?.city}/{o?.uf}
                            </small>
                          </>
                        ) : (
                          <>
                            {h.name}
                            <small className="block text-muted-foreground">
                              {h.code} · {h.city}/{h.uf}
                            </small>
                          </>
                        )}
                      </td>
                      <td className="p-3">
                        {view === "offices" ? (
                          <>
                            {h.name}
                            <small className="block text-muted-foreground">
                              {h.code} · {h.city}/{h.uf}
                            </small>
                          </>
                        ) : (
                          <>
                            {o?.code ?? "Sem coordenadas aptas"}
                            <small className="block text-muted-foreground">
                              {o ? `${o.city}/${o.uf}` : ""}
                            </small>
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap p-3 tabular-nums">
                        {fmt(km)}
                        {km !== null ? " km" : ""}
                      </td>
                      <td className="p-3">{pair?.band ?? ("count" in item ? item.count : "")}</td>
                      <td className="p-3 text-muted-foreground">
                        {view === "offices"
                          ? `${o?.precision} / ${h.precision}`
                          : `${h.precision} / ${o?.precision ?? "—"}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!total && (
              <p className="p-4 text-muted-foreground">Nenhum resultado para este filtro.</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>
              Página {page + 1} de {Math.max(1, Math.ceil(total / 100))}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={!page} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={(page + 1) * 100 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
          <details className="border-t border-border pt-4">
            <summary className="cursor-pointer text-sm font-medium">
              Escritórios sem hotéis no raio ·{" "}
              {result.officeSummary.filter((o) => !o.count && matches(o.office, search)).length}
            </summary>
            <div className="mt-3 max-h-64 overflow-auto text-sm">
              {result.officeSummary
                .filter((o) => !o.count && matches(o.office, search))
                .map((o) => (
                  <p key={o.office.id} className="py-1">
                    {o.office.code} · {o.office.city}/{o.office.uf} ·{" "}
                    {coords(o.office) ? "0 hotéis até 10 km" : "Sem coordenadas aptas"}
                  </p>
                ))}
            </div>
          </details>
          <details className="border-t border-border pt-4">
            <summary className="cursor-pointer text-sm font-medium">
              Auditoria dos suplementos
            </summary>
            <div className="mt-3 max-h-64 overflow-auto text-sm">
              {result.audit
                .filter(
                  (a) =>
                    !a.reason.startsWith("Incluída") && !a.reason.startsWith("Sem coordenadas"),
                )
                .map((a, i) => (
                  <p key={i} className="py-1">
                    {a.code} · {a.reason} · {a.source} · {a.precision}
                  </p>
                ))}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
