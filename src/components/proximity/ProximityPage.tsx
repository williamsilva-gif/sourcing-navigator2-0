import { WALK_WARNING, fmtDuration, routeStatus } from "@/lib/proximity/routes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  MapPin,
  Upload,
  Play,
  Pause,
  Square,
  Download,
  RefreshCw,
  Database as DatabaseIcon,
  Plus,
  Route as RouteIcon,
} from "lucide-react";
import { GoogleMapsTest } from "@/components/proximity/GoogleMapsTest";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SheetGeolocation } from "@/components/sheetGeolocation/SheetGeolocation";
import { CrossingTenKm } from "@/components/crossingTenKm/CrossingTenKm";
import { supabase } from "@/integrations/supabase/client";
import {
  workbook,
  sheetRows,
  suggest,
  parse,
  fields,
  cityKey,
  inScope,
  validGeo,
  targetCities,
  type Entity,
  type Pair,
  type Kind,
  type Mapping,
} from "@/lib/proximity/core";
import {
  proximityTenantsFn,
  proximityListFn,
  proximityGetFn,
  proximityCreateFn,
  proximityImportFn,
  proximityControlFn,
  proximityBatchFn,
  proximityCompareFn,
  proximityManualFn,
  proximityRoutesFn,
  proximityCatalogFn,
  proximityCatalogSelectFn,
} from "@/lib/proximity/proximity.functions";
const proximityTenantsQuery = queryOptions({
  queryKey: ["proximity", "tenants"],
  queryFn: () => proximityTenantsFn(),
});
const selectClass =
  "h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground";
export function ProximityPage() {
  const { data: tenants } = useSuspenseQuery(proximityTenantsQuery);
  const [tab, setTab] = useState("radius");
  return (
    <AppShell>
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          <TabsTrigger value="radius">Raio & Proximidade</TabsTrigger>
          <TabsTrigger value="sheets">Geolocalização de Planilhas</TabsTrigger>
          <TabsTrigger value="crossing">Cruzamento 10 km</TabsTrigger>
        </TabsList>
        <TabsContent value="radius">
          <RadiusAnalysis />
        </TabsContent>
        <TabsContent value="sheets">
          <SheetGeolocation tenants={tenants} />
        </TabsContent>
        <TabsContent value="crossing">
          <CrossingTenKm tenants={tenants} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
function RadiusAnalysis() {
  const { data: tenants } = useSuspenseQuery(proximityTenantsQuery);
  const [tenantId, setTenant] = useState(
    tenants.find((t) => /travel academy/i.test(t.name))?.id ?? tenants[0]?.id ?? "",
  );
  const [jobId, setJob] = useState("");
  const [name, setName] = useState("RFP Claro 2027 — Raio & Proximidade");
  const cache = useQueryClient();
  const list = useServerFn(proximityListFn),
    get = useServerFn(proximityGetFn),
    create = useServerFn(proximityCreateFn),
    commit = useServerFn(proximityImportFn),
    control = useServerFn(proximityControlFn),
    batch = useServerFn(proximityBatchFn),
    recompare = useServerFn(proximityCompareFn),
    manual = useServerFn(proximityManualFn),
    routes = useServerFn(proximityRoutesFn),
    reuseCatalog = useServerFn(proximityCatalogFn),
    selectCatalog = useServerFn(proximityCatalogSelectFn);
  const jobs = useQuery({
    queryKey: ["proximity", "jobs", tenantId],
    queryFn: () => list({ data: { tenantId } }),
    enabled: !!tenantId,
  });
  const detail = useQuery({
    queryKey: ["proximity", "job", tenantId, jobId],
    queryFn: () => get({ data: { tenantId, jobId } }),
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data?.status === "running" ? 2500 : false),
  });
  const job = detail.data;
  const entities = (job?.entities ?? []) as unknown as Entity[];
  const pairs = (job?.pairs ?? []) as unknown as Pair[];
  const [busy, setBusy] = useState(false);
  const loopBusy = useRef(false);
  const catalogStop = useRef(false);
  const [catalogRunning, setCatalogRunning] = useState(false);
  const [catalogReview, setCatalogReview] = useState("");
  const [catalogSelection, setCatalogSelection] = useState("");
  const [catalogReason, setCatalogReason] = useState("");
  useEffect(
    () => () => {
      catalogStop.current = true;
    },
    [tenantId, jobId],
  );
  const [file, setFile] = useState<File>();
  const [book, setBook] = useState<XLSX.WorkBook>();
  const [sheet, setSheet] = useState("");
  const [header, setHeader] = useState(1);
  const [mapping, setMapping] = useState<Mapping>({});
  const [kind, setKind] = useState<Kind>("hotel");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("");
  const [block, setBlock] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("hotels");
  const [cross, setCross] = useState(false);
  const [reviewId, setReview] = useState("");
  const [placeId, setPlace] = useState("");
  const [reason, setReason] = useState("");
  const rows = book && sheet ? sheetRows(book, sheet) : [];
  const headers = rows[header - 1] ?? [];
  const preview = file ? parse(rows, header, mapping, kind, file.name, sheet) : [];
  const refresh = useCallback(() => cache.invalidateQueries({ queryKey: ["proximity"] }), [cache]);
  const action = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (job?.status !== "running") return;
    let stopped = false;
    const tick = async () => {
      if (stopped || loopBusy.current) return;
      loopBusy.current = true;
      try {
        const r = await batch({ data: { tenantId, jobId } });
        if ("error" in r && r.error) toast.error(r.error);
        await refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha no lote");
      } finally {
        loopBusy.current = false;
      }
    };
    const timer = setInterval(tick, 2500);
    void tick();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [job?.status, tenantId, jobId, batch, refresh]);
  const changeSheet = (value: string, w = book) => {
    setSheet(value);
    if (w) {
      const r = sheetRows(w, value);
      const index = r.slice(0, 30).findIndex((row) => Object.keys(suggest(row)).length >= 3);
      const hr = index < 0 ? 1 : index + 1;
      setHeader(hr);
      setMapping(suggest(r[hr - 1] ?? []));
    }
    if (/escrit/i.test(value)) setKind("office");
    else if (/loja/i.test(value)) setKind("store");
    else setKind("hotel");
  };
  const upload = async (f: File) => {
    try {
      const w = workbook(new Uint8Array(await f.arrayBuffer()));
      setFile(f);
      setBook(w);
      changeSheet(w.SheetNames.find((s) => /397.*hot/i.test(s)) ?? w.SheetNames[0], w);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Arquivo inválido");
    }
  };
  const saveImport = () =>
    action(async () => {
      if (!file || !jobId) throw new Error("Crie/selecione uma análise e arquivo.");
      const fileId = crypto.randomUUID();
      const path = `${tenantId}/${jobId}/${fileId}.${file.name.split(".").pop()?.toLowerCase()}`;
      const r = await supabase.storage
        .from("proximity-originals")
        .upload(path, file, { upsert: false });
      if (r.error) throw new Error(r.error.message);
      const result = await commit({
        data: {
          tenantId,
          jobId,
          fileId,
          filename: file.name,
          sheet,
          headerRow: header,
          kind,
          mapping,
          confirmed: true,
        },
      });
      toast.success(`${result.count} linhas importadas e preservadas.`);
      setFile(undefined);
      setBook(undefined);
    });
  const scoped = entities.filter((e) => inScope(e, entities));
  const catalogHotels = entities.filter((e) => e.kind === "hotel");
  const catalogCounts = {
    recovered: catalogHotels.filter(
      (e) => e.catalog?.status === "recovered" && e.geo?.source === "Navigator Cadastro",
    ).length,
    review: catalogHotels.filter((e) => e.catalog?.status === "review").length,
    invalid: catalogHotels.filter((e) => e.catalog?.status === "invalid").length,
    remaining: catalogHotels.filter((e) => !validGeo(e)).length,
    checked: catalogHotels.filter((e) => !!e.catalog).length,
  };
  const runCatalog = async () => {
    catalogStop.current = false;
    setCatalogRunning(true);
    setBusy(true);
    try {
      while (!catalogStop.current) {
        const result = await reuseCatalog({ data: { tenantId, jobId } });
        await refresh();
        if (result.busy) {
          toast.info("Outro lote em andamento; tente continuar após sua conclusão.");
          break;
        }
        if (!result.remaining) break;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no cadastro");
    } finally {
      setCatalogRunning(false);
      setBusy(false);
    }
  };
  const hotels = scoped.filter((e) => e.kind === "hotel");
  const units = scoped.filter((e) => e.kind !== "hotel");
  const located = scoped.filter(validGeo).length;
  const done = scoped.filter((e) => e.attempted).length;
  const importedHotels = entities.filter((e) => e.kind === "hotel");
  const cityTotals = new Map<string, Set<number>>();
  importedHotels.forEach((e) => {
    if (e.rn !== null) {
      const values = cityTotals.get(cityKey(e)) ?? new Set<number>();
      values.add(e.rn);
      cityTotals.set(cityKey(e), values);
    }
  });
  const conflictingCities = [...cityTotals.values()].filter((v) => v.size > 1).length;
  const retrying = scoped.filter((e) => !e.attempted && !!e.nextRetry).length;
  const metadata = (job?.imports ?? []) as Array<{ path?: string; original_in_storage?: boolean }>;
  const originalsArchived =
    metadata.length > 0 && metadata.every((m) => !!m.path && m.original_in_storage !== false);
  const filtered = entities.filter(
    (e) =>
      (view === "hotels" ? e.kind === "hotel" : e.kind !== "hotel") &&
      (!city || cityKey(e) === city) &&
      (!search ||
        `${e.name} ${e.code} ${e.address}`.toLowerCase().includes(search.toLowerCase())) &&
      (!block || (block === "yes" ? e.block : !e.block)) &&
      (!status ||
        (status === "high"
          ? validGeo(e)
          : status === "review"
            ? e.geo?.confidence === "review"
            : status === "pending"
              ? !e.attempted
              : !e.geo && !!e.attempted)),
  );
  const visibleIds = new Set(filtered.map((e) => e.id));
  const exportedPairs = pairs.filter((p) =>
    view === "hotels" ? visibleIds.has(p.hotelId) : visibleIds.has(p.unitId),
  );
  const exportExcel = () => {
    const w = XLSX.utils.book_new();
    const byId = new Map(entities.map((e) => [e.id, e]));
    XLSX.utils.book_append_sheet(
      w,
      XLSX.utils.json_to_sheet(
        filtered.map((e) => ({
          Nome: e.name,
          Código: e.code,
          Tipo: e.kind,
          Endereço: e.address,
          Número: e.number,
          Cidade: e.city,
          UF: e.uf,
          CEP: e.cep,
          "CPF/CNPJ original": e.document,
          "Block List": e.block ? "SIM" : "NÃO",
          Ativo: e.active,
          Universo: inScope(e, entities) ? "ALVO" : "FORA/PENDENTE",
          Latitude: e.geo?.lat,
          Longitude: e.geo?.lng,
          Confiança: e.geo?.confidence ?? "NÃO LOCALIZADO",
          Fonte: e.geo?.source ?? "",
          "Cadastro status": e.catalog?.status ?? "NÃO CONSULTADO",
          "Cadastro ID": e.catalog?.selectedId ?? "",
          "Cadastro código":
            e.catalog?.candidates.find((c) => c.hotel.id === e.catalog?.selectedId)?.hotel.code ??
            "",
          "Cadastro campos conferidos":
            e.catalog?.candidates
              .find((c) => c.hotel.id === e.catalog?.selectedId)
              ?.matchedFields.join("; ") ?? "",
          "Cadastro motivo": e.catalog?.reason ?? "",
          "Cadastro data": e.catalog?.checkedAt ?? "",
          "Place ID": e.geo?.placeId ?? "",
          "Número derivado Google (não original)": e.geo?.derivedNumber ?? "",
          "CEP derivado Google (não original)": e.geo?.derivedPostalCode ?? "",
          "Endereço derivado Google": e.geo?.formatted ?? "",
          Confirmação:
            e.geo?.confirmation === "establishment" ? "Local confirmado por estabelecimento" : "",
          Pendências: [...e.issues, ...(e.geo?.reasons ?? [])].join("; "),
          Arquivo: e.source.filename,
          Aba: e.source.sheet,
          Linha: e.source.row,
          ...Object.fromEntries(Object.entries(e.original).map(([k, v]) => [`Original ${k}`, v])),
        })),
      ),
      "Endereços filtrados",
    );
    XLSX.utils.book_append_sheet(
      w,
      XLSX.utils.json_to_sheet(
        exportedPairs.map((p) => {
          const h = byId.get(p.hotelId),
            u = byId.get(p.unitId);
          return {
            Hotel: h?.name,
            "Endereço hotel": h?.address,
            "Número hotel": h?.number,
            "CEP hotel": h?.cep,
            "Lat hotel": h?.geo?.lat,
            "Lng hotel": h?.geo?.lng,
            "Origem hotel": h?.geo?.source,
            "Cadastro ID hotel": h?.catalog?.selectedId,
            Unidade: u?.name,
            Código: u?.code,
            Categoria: p.kind,
            "Endereço unidade": u?.address,
            "Número unidade": u?.number,
            "CEP unidade": u?.cep,
            "Lat unidade": u?.geo?.lat,
            "Lng unidade": u?.geo?.lng,
            "Distância reta km": p.km,
            Raio: p.band,
            "Distância viária km": p.roadKm ?? null,
            "Fonte viária": p.roadSource ?? "NÃO CALCULADA",
            "Carro metros": p.roadMeters ?? null,
            "Carro duração min": p.roadDurationSec !== undefined ? p.roadDurationSec / 60 : null,
            "Carro status": routeStatus(p, "DRIVE"),
            "Carro data": p.roadAt ?? "",
            "Carro erro": p.roadError ?? "",
            "A pé km": p.walkKm ?? null,
            "A pé metros": p.walkMeters ?? null,
            "A pé duração min": p.walkDurationSec !== undefined ? p.walkDurationSec / 60 : null,
            "A pé fonte": p.walkSource ?? "NÃO CALCULADA",
            "A pé status": routeStatus(p, "WALK"),
            "A pé data": p.walkAt ?? "",
            "A pé erro": p.walkError ?? "",
            "Aviso a pé": p.walkStatus === "calculado" ? WALK_WARNING : "",
            "Mais próximo": p.nearest ? "MELHOR CANDIDATO" : "NÃO",
            Conclusão: p.definitive ? "DEFINITIVO NA CIDADE" : "PROVISÓRIO",
            "Cross municipality": p.cross,
            "Revisão limiar": p.boundary,
            Confiança: `${h?.geo?.confidence}/${u?.geo?.confidence}`,
            Fonte: "Haversine WGS84 / Google Geocoding",
            Pendências: p.definitive
              ? ""
              : p.reviewGeo
                ? "Coordenada em revisão TA (indicativa); completude insuficiente"
                : "Completude insuficiente ou município excepcional",
          };
        }),
      ),
      "Pares auditáveis",
    );
    XLSX.utils.book_append_sheet(
      w,
      XLSX.utils.json_to_sheet(
        filtered.flatMap(
          (e) =>
            e.catalog?.candidates.map((c) => ({
              Hotel: e.name,
              "Cadastro ID": c.hotel.id,
              Código: c.hotel.code,
              "Nome cadastro": c.hotel.name,
              "Endereço cadastro": c.hotel.address,
              "CEP cadastro": c.hotel.postal_code,
              Latitude: c.hotel.latitude,
              Longitude: c.hotel.longitude,
              Confiança: c.confidence,
              Inválido: c.invalid,
              "Campos conferidos": c.matchedFields.join("; "),
              Pendências: c.reasons.join("; "),
              "Referência geográfica": c.reference,
              "Distância referência km": c.distanceToCityKm,
              Selecionado: e.catalog?.selectedId === c.hotel.id,
              Motivo: e.catalog?.reason,
              Data: e.catalog?.checkedAt,
              Origem: "Navigator Cadastro",
            })) ?? [],
        ),
      ),
      "Candidatos cadastro",
    );
    XLSX.utils.book_append_sheet(
      w,
      XLSX.utils.json_to_sheet([
        {
          Análise: job?.name,
          "Escopo cliente": tenantId,
          "Gerado em": new Date().toISOString(),
          Hotéis: hotels.length,
          Unidades: units.length,
          Localizados: located,
          "Originais arquivados no Storage": originalsArchived
            ? "SIM"
            : "NÃO CONFIRMADO / IMPORTAÇÃO DIRETA",
          "Completude %": scoped.length ? (located / scoped.length) * 100 : 0,
          Observação:
            "Distância reta não é distância viária. Definitivo depende de todas as unidades ativas válidas na cidade/categoria.",
        },
      ]),
      "Proveniência",
    );
    XLSX.writeFile(w, "Raio-Proximidade.xlsx");
  };
  const review = entities.find((e) => e.id === reviewId);
  const catalogEntity = entities.find((e) => e.id === catalogReview);
  return (
    <div className="space-y-6 text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <MapPin className="h-6 w-6 text-primary" />
            Raio & Proximidade
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            RFP Claro 2027 · endereços confidenciais · distância em linha reta
          </p>
        </div>
        <span className="rounded-md bg-primary-soft px-3 py-1 text-xs text-primary">
          TA master / staff
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Cliente"
          className={selectClass}
          value={tenantId}
          onChange={(e) => {
            setTenant(e.target.value);
            setJob("");
            setCity("");
          }}
        >
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Análise"
          className={`${selectClass} max-w-full`}
          value={jobId}
          onChange={(e) => setJob(e.target.value)}
        >
          <option value="">Selecione análise</option>
          {jobs.data?.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name} · {j.status}
            </option>
          ))}
        </select>
        <Input
          aria-label="Nome da nova análise"
          className="max-w-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          disabled={busy || !tenantId}
          onClick={() =>
            action(async () => {
              const j = await create({ data: { tenantId, name } });
              setJob(j.id);
            })
          }
        >
          <Plus className="h-4 w-4" />
          Criar análise
        </Button>
      </div>
      {detail.error && (
        <p role="alert" className="text-destructive">
          {detail.error.message}
        </p>
      )}
      {job && (
        <>
          <div className="grid grid-cols-2 gap-4 border-y border-border py-5 md:grid-cols-6">
            {[
              ["Hotéis importados", `${importedHotels.length} / 397`],
              [
                "Escritórios importados",
                `${entities.filter((e) => e.kind === "office").length} / 666`,
              ],
              ["Lojas importadas", `${entities.filter((e) => e.kind === "store").length} / 135`],
              ["Cidades importadas", `${new Set(importedHotels.map(cityKey)).size} / 28`],
              ["Geocodificados", `${located} / ${scoped.length}`],
              [
                "Completude",
                `${scoped.length ? ((located / scoped.length) * 100).toFixed(1) : "0"}%`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <GoogleMapsTest />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={busy || job.status === "running" || !catalogHotels.length}
                onClick={() => void runCatalog()}
              >
                <DatabaseIcon className="h-4 w-4" />
                Reaproveitar coordenadas do Cadastro de Hotéis
              </Button>
              {catalogRunning && (
                <Button
                  variant="outline"
                  onClick={() => {
                    catalogStop.current = true;
                  }}
                >
                  Pausar consulta ao cadastro
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Cadastro primeiro, sem cobrança Google · {catalogCounts.checked}/
              {catalogHotels.length} consultados · {catalogCounts.recovered} recuperados ·{" "}
              {catalogCounts.review} requerem revisão · {catalogCounts.invalid} inválidos ·{" "}
              {catalogCounts.remaining} restantes para Google.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {job.status} · {done}/{scoped.length} processados ·{" "}
                {scoped.filter((e) => e.attempted && !e.geo).length} não localizados
              </span>
              <Button
                size="sm"
                disabled={
                  busy ||
                  !entities.length ||
                  (job.status === "running" &&
                    !!job.lease_until &&
                    Date.parse(job.lease_until) > Date.now())
                }
                onClick={() =>
                  action(() => control({ data: { tenantId, jobId, status: "running" } }))
                }
              >
                <Play className="h-4 w-4" />
                Geocodificar com Google / continuar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || job.status !== "running"}
                onClick={() =>
                  action(() => control({ data: { tenantId, jobId, status: "paused" } }))
                }
              >
                <Pause className="h-4 w-4" />
                Pausar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  action(() => control({ data: { tenantId, jobId, status: "cancelled" } }))
                }
              >
                <Square className="h-4 w-4" />
                Cancelar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {hotels.length} hotéis no escopo · {targetCities(entities).size} cidades com RN
              elegível · {scoped.filter((e) => e.geo?.confidence === "review").length} em revisão ·{" "}
              {retrying} aguardando nova tentativa ·{" "}
              {scoped.reduce((n, e) => n + (e.attempts ?? 0), 0)} tentativas registradas.
            </p>
            {!originalsArchived && (
              <p className="text-sm text-warning-foreground">
                Dados importados diretamente; arquivos originais não arquivados no Storage.
                Endereços originais preservados.
              </p>
            )}
            {!!conflictingCities && (
              <p role="alert" className="text-warning-foreground">
                {conflictingCities} cidades com totais RN divergentes: revisão necessária, sem somar
                valores repetidos por hotel.
              </p>
            )}
            <progress
              aria-label="Progresso geocoding"
              className="h-2 w-full accent-primary"
              max={Math.max(scoped.length, 1)}
              value={done}
            />
            <p className="text-xs text-muted-foreground">
              Lotes de até 12 endereços (4 simultâneos; escritórios e lojas primeiro), com
              checkpoint. Ao fechar a página o processamento pausa entre lotes; continuar retoma.
              Google pode cobrar por consulta.
            </p>
            {job.last_error && (
              <p role="alert" className="text-destructive">
                {job.last_error}
              </p>
            )}
            {hotels.length !== 397 && (
              <p className="text-sm text-warning-foreground">
                Contagem divergente: {hotels.length} hotéis-alvo importados; 397 é a referência, não
                um total preenchido artificialmente.
              </p>
            )}
            {entities.some((e) => e.kind === "hotel" && e.rn === null) && (
              <p className="text-sm text-warning-foreground">
                RNs ausentes: seleção de cidades ≥100 não pode ser confirmada integralmente.
              </p>
            )}
          </div>
          <section className="space-y-3 border-t border-border pt-5">
            <h2 className="text-lg font-semibold">Importar hotéis e unidades</h2>
            <Input
              type="file"
              aria-label="Planilha XLSX ou CSV"
              accept=".xlsx,.csv"
              disabled={job.status === "running"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
            {file && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Aba"
                    className={selectClass}
                    value={sheet}
                    onChange={(e) => changeSheet(e.target.value)}
                  >
                    {book?.SheetNames.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    Cabeçalho
                    <Input
                      aria-label="Linha do cabeçalho"
                      type="number"
                      min={1}
                      max={100}
                      className="w-20"
                      value={header}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setHeader(v);
                        setMapping(suggest(rows[v - 1] ?? []));
                      }}
                    />
                  </label>
                  <select
                    aria-label="Categoria de importação"
                    className={selectClass}
                    value={kind}
                    onChange={(e) => setKind(e.target.value as Kind)}
                  >
                    <option value="hotel">Hotéis</option>
                    <option value="office">Escritórios</option>
                    <option value="store">Lojas</option>
                  </select>
                  <span className="text-sm">
                    {preview.length} linhas · {preview.filter((e) => e.issues.length).length} com
                    alertas
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {Object.entries(fields).map(([k, label]) => (
                    <label
                      key={k}
                      className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"
                    >
                      {label}
                      <select
                        aria-label={`Mapear ${label}`}
                        className={selectClass}
                        value={mapping[k as keyof Mapping] ?? ""}
                        onChange={(e) =>
                          setMapping((m) => ({
                            ...m,
                            [k]: e.target.value === "" ? undefined : Number(e.target.value),
                          }))
                        }
                      >
                        <option value="">Não mapeado</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>
                            {XLSX.utils.encode_col(i)} · {h || "(sem título)"}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="max-h-48 overflow-auto rounded-md border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2">Linha</th>
                        <th>Nome</th>
                        <th>Endereço</th>
                        <th>Alertas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 20).map((e) => (
                        <tr key={e.id} className="border-t border-border">
                          <td className="p-2">{e.source.row}</td>
                          <td>{e.name}</td>
                          <td>
                            {e.address} {e.number} · {e.city}/{e.uf} · {e.cep}
                          </td>
                          <td>{e.issues.join("; ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button
                  disabled={
                    busy ||
                    !preview.length ||
                    mapping.address === undefined ||
                    mapping.city === undefined ||
                    mapping.uf === undefined
                  }
                  onClick={saveImport}
                >
                  <Upload className="h-4 w-4" />
                  Confirmar mapeamento e importar {preview.length} linhas
                </Button>
              </>
            )}
          </section>
          <section className="space-y-3 border-t border-border pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Comparações e pendências</h2>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={cross}
                    onChange={(e) => setCross(e.target.checked)}
                  />
                  Exceção: mesma UF sem unidade na cidade
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || job.status === "running"}
                  onClick={() =>
                    action(() => recompare({ data: { tenantId, jobId, allowCross: cross } }))
                  }
                >
                  <RefreshCw className="h-4 w-4" />
                  Recalcular
                </Button>
                <Button size="sm" disabled={!entities.length} onClick={exportExcel}>
                  <Download className="h-4 w-4" />
                  Excel filtrado
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Visão"
                className={selectClass}
                value={view}
                onChange={(e) => setView(e.target.value)}
              >
                <option value="hotels">Hotéis → unidades</option>
                <option value="units">Unidades → ranking de hotéis</option>
              </select>
              <Input
                aria-label="Buscar hotel ou unidade"
                className="max-w-xs"
                placeholder="Nome, código ou endereço"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Cidade"
                className={selectClass}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="">Todas as cidades</option>
                {[...new Map(entities.map((e) => [cityKey(e), `${e.city}/${e.uf}`])).entries()]
                  .sort()
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
              <select
                aria-label="Status geocoding"
                className={selectClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Todos os status</option>
                <option value="high">Alta confiança</option>
                <option value="review">Revisão</option>
                <option value="pending">Pendente</option>
                <option value="missing">Não localizado</option>
              </select>
              <select
                aria-label="Block List"
                className={selectClass}
                value={block}
                onChange={(e) => setBlock(e.target.value)}
              >
                <option value="">Block List: todos</option>
                <option value="yes">Flag SIM</option>
                <option value="no">Flag NÃO</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              {filtered.length} registros · {exportedPairs.length} pares ·{" "}
              {pairs.filter((p) => p.roadKm === undefined).length} rotas viárias não calculadas.
              Limiares ±100 m sinalizam revisão. A linha reta não indica o mais próximo de carro ou a pé. {WALK_WARNING}
            </p>
            <div className="max-h-[640px] overflow-auto rounded-md border border-border">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="p-3">Hotel / unidade</th>
                    <th>Cidade / endereço original</th>
                    <th>Localização</th>
                    <th>Proximidade / ranking</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const nearest = pairs
                      .filter((p) =>
                        view === "hotels" ? p.hotelId === e.id && p.nearest : p.unitId === e.id,
                      )
                      .sort((a, b) => a.km - b.km)
                      .slice(0, view === "hotels" ? 2 : 3);
                    return (
                      <tr key={e.id} className="border-t border-border align-top">
                        <td className="max-w-64 p-3 font-medium">
                          {e.name}
                          <p className="text-xs text-muted-foreground">
                            {e.code} {e.block ? "· Block List" : ""}{" "}
                            {!inScope(e, entities) ? "· Fora / pendente" : ""}
                          </p>
                        </td>
                        <td className="max-w-64 py-3 text-xs">
                          {e.city}/{e.uf}
                          <p>
                            {e.address}, {e.number}
                          </p>
                          <p>{e.cep}</p>
                        </td>
                        <td className="max-w-60 py-3 text-xs">
                          <span
                            className={
                              validGeo(e)
                                ? "text-success"
                                : e.geo
                                  ? "text-warning-foreground"
                                  : "text-muted-foreground"
                            }
                          >
                            {e.geo?.confidence ?? (e.attempted ? "NÃO LOCALIZADO" : "PENDENTE")}
                          </span>
                          <p>{e.geo ? `${e.geo.lat.toFixed(6)}, ${e.geo.lng.toFixed(6)}` : ""}</p>
                          {e.geo?.confirmation === "establishment" && (
                            <p>Local confirmado por estabelecimento</p>
                          )}
                          {e.geo?.derivedNumber && (
                            <p>Número Google (derivado): {e.geo.derivedNumber}</p>
                          )}
                          {e.lastAttemptError && <p>{e.lastAttemptError}</p>}
                          <p>{[...e.issues, ...(e.geo?.reasons ?? [])].join("; ")}</p>
                        </td>
                        <td className="max-w-72 py-3 text-xs">
                          {nearest.length
                            ? nearest.map((p) => (
                                <p key={`${p.hotelId}${p.unitId}`} className="mb-2">
                                  {
                                    entities.find(
                                      (v) => v.id === (view === "hotels" ? p.unitId : p.hotelId),
                                    )?.name
                                  }{" "}
                                  · {p.km.toFixed(3)} km · {p.band}
                                  <br />
                                  <strong>
                                    {p.definitive
                                      ? "DEFINITIVO NA CIDADE"
                                      : "PROVISÓRIO · melhor candidato localizado"}
                                  </strong>
                                  {p.reviewGeo ? " · coordenada em revisão (indicativa)" : ""}
                                  {p.cross ? " · município excepcional" : ""}
                                  {p.boundary ? " · REVISAR LIMIAR" : ""}
                                  <br />
                                  Reta {p.km.toFixed(3)} km · Carro:{" "}
                                  {p.roadKm !== undefined
                                    ? `${p.roadKm.toFixed(2)} km ${fmtDuration(p.roadDurationSec)}`
                                    : routeStatus(p, "DRIVE")}
                                  {p.roadError ? ` (${p.roadError})` : ""} · A pé:{" "}
                                  {p.walkKm !== undefined
                                    ? `${p.walkKm.toFixed(2)} km ${fmtDuration(p.walkDurationSec)} (beta)`
                                    : routeStatus(p, "WALK")}
                                  {p.walkError ? ` (${p.walkError})` : ""}
                                  {view === "hotels" && (
                                    <button
                                      type="button"
                                      className="ml-1 underline"
                                      disabled={busy || job.status === "running"}
                                      onClick={() =>
                                        action(() =>
                                          routes({
                                            data: {
                                              tenantId,
                                              jobId,
                                              hotelId: p.hotelId,
                                              unitId: p.unitId,
                                              modes: ["DRIVE", "WALK"],
                                              allowCross: true,
                                            },
                                          }),
                                        )
                                      }
                                    >
                                      rotas deste par
                                    </button>
                                  )}
                                </p>
                              ))
                            : "Sem candidato válido; não conclusivo"}
                        </td>
                        <td className="p-3">
                          {e.catalog && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy || job.status === "running"}
                              onClick={() => {
                                setCatalogReview(e.id);
                                setCatalogSelection(e.catalog?.selectedId ?? "");
                                setCatalogReason("");
                              }}
                            >
                              Candidatos do cadastro ({e.catalog.candidates.length})
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || job.status === "running"}
                            onClick={() => {
                              setReview(e.id);
                              setPlace(e.geo?.placeId ?? "");
                              setReason("");
                            }}
                          >
                            Revisar Place
                          </Button>
                          {e.kind === "hotel" && validGeo(e) && (
                            <Button
                              title="Carro e a pé (Google Routes) dos top 3 por linha reta, mesmo município"
                              size="sm"
                              variant="ghost"
                              disabled={busy || job.status === "running"}
                              onClick={() =>
                                action(() =>
                                  routes({
                                    data: { tenantId, jobId, hotelId: e.id, modes: ["DRIVE", "WALK"] },
                                  }),
                                )
                              }
                            >
                              <RouteIcon className="h-4 w-4" />
                              Rotas top 3
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {review && (
              <div className="space-y-2 rounded-md border border-border bg-card p-4">
                <h3 className="font-semibold">Revisão: {review.name}</h3>
                <p className="text-xs text-muted-foreground">
                  O endereço original permanece intacto. Place ID será consultado no Google e
                  validado; resultados imprecisos permanecem em revisão.
                </p>
                <Input
                  aria-label="Google Place ID"
                  placeholder="Google Place ID"
                  value={placeId}
                  onChange={(e) => setPlace(e.target.value)}
                />
                <Input
                  aria-label="Justificativa da revisão"
                  placeholder="Justificativa da revisão"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <Button
                  disabled={busy || reason.length < 10 || placeId.length < 5}
                  onClick={() =>
                    action(async () => {
                      const r = await manual({
                        data: { tenantId, jobId, entityId: reviewId, placeId, reason },
                      });
                      toast.success(`Revisão salva: ${r.confidence}`);
                      setReview("");
                    })
                  }
                >
                  Consultar e salvar revisão
                </Button>
                <Button variant="ghost" onClick={() => setReview("")}>
                  Fechar
                </Button>
              </div>
            )}
            {catalogEntity?.catalog && (
              <div
                role="dialog"
                aria-label="Revisão do cadastro"
                className="space-y-3 border border-border bg-card p-4"
              >
                <h3 className="font-semibold">Cadastro: {catalogEntity.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {catalogEntity.catalog.reason ??
                    "A seleção não substitui as validações de endereço e coordenadas."}
                </p>
                <select
                  aria-label="Candidato do cadastro"
                  className={`${selectClass} w-full`}
                  value={catalogSelection}
                  onChange={(e) => setCatalogSelection(e.target.value)}
                >
                  <option value="">Selecione candidato</option>
                  {catalogEntity.catalog.candidates.map((c) => (
                    <option key={c.hotel.id} value={c.hotel.id}>
                      {c.hotel.code} · {c.hotel.name} · {c.hotel.address} · {c.confidence}
                      {c.invalid ? " / INVÁLIDO" : ""}
                    </option>
                  ))}
                </select>
                {catalogEntity.catalog.candidates
                  .filter((c) => c.hotel.id === catalogSelection)
                  .map((c) => (
                    <div key={c.hotel.id} className="text-sm">
                      <p>Conferidos: {c.matchedFields.join(", ")}</p>
                      <p>Pendências: {c.reasons.join("; ") || "Nenhuma"}</p>
                      <p>Referência: {c.reference ?? "Não disponível"}</p>
                      <p>
                        Coordenadas: {c.hotel.latitude}, {c.hotel.longitude}
                      </p>
                    </div>
                  ))}
                <Input
                  aria-label="Motivo da seleção do cadastro"
                  value={catalogReason}
                  onChange={(e) => setCatalogReason(e.target.value)}
                  placeholder="Motivo da seleção"
                />
                <Button
                  disabled={busy || !catalogSelection || catalogReason.trim().length < 10}
                  onClick={() =>
                    action(async () => {
                      const result = await selectCatalog({
                        data: {
                          tenantId,
                          jobId,
                          entityId: catalogEntity.id,
                          catalogId: catalogSelection,
                          reason: catalogReason,
                        },
                      });
                      toast.success(
                        result.invalid
                          ? "Coordenadas rejeitadas; candidato auditado"
                          : result.confidence === "high"
                            ? "Coordenadas reaproveitadas"
                            : "Candidato salvo em revisão, sem reaproveitar coordenadas",
                      );
                      setCatalogReview("");
                    })
                  }
                >
                  Salvar seleção validada
                </Button>
                <Button variant="ghost" onClick={() => setCatalogReview("")}>
                  Fechar candidatos
                </Button>
              </div>
            )}
          </section>
        </>
      )}
      {!job && (
        <div className="border-t border-border py-12 text-muted-foreground">
          Selecione uma análise existente ou crie uma nova; os dados importados permanecem
          preservados.
        </div>
      )}
    </div>
  );
}
