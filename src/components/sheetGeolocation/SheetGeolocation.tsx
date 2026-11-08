import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Upload, Play, Pause, Square, Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { sheetRows, type Kind } from "@/lib/proximity/core";
import {
  fields,
  suggest,
  parseSheet,
  enrich,
  resultCells,
  extraHeaders,
  counts,
  readWorkbook as workbook,
  type Row,
  type Mapping,
} from "@/lib/sheetGeolocation/core";
import {
  listSheetJobs,
  getSheetJob,
  createSheetJob,
  importSheetJob,
  controlSheetJob,
  batchSheetJob,
} from "@/lib/sheetGeolocation/jobs.functions";
const selectClass =
  "h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground";
const labels = { pending: "Pendente", high: "Alta confiança", review: "Revisão", error: "Falha" };
function download(bytes: ArrayBuffer, filename: string) {
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function SheetGeolocation({ tenants }: { tenants: { id: string; name: string }[] }) {
  const [tenantId, setTenant] = useState(
    tenants.find((t) => /travel academy/i.test(t.name))?.id ?? tenants[0]?.id ?? "",
  );
  const [jobId, setJob] = useState("");
  const [file, setFile] = useState<File>();
  const [book, setBook] = useState<XLSX.WorkBook>();
  const [sheet, setSheet] = useState("");
  const [header, setHeader] = useState(1);
  const [kind, setKind] = useState<Kind>("office");
  const [mapping, setMapping] = useState<Mapping>({});
  const [budget, setBudget] = useState(2000);
  const [confirmed, setConfirmed] = useState(false);
  const [cost, setCost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const cache = useQueryClient();
  const list = useServerFn(listSheetJobs),
    get = useServerFn(getSheetJob),
    create = useServerFn(createSheetJob),
    commit = useServerFn(importSheetJob),
    control = useServerFn(controlSheetJob),
    batch = useServerFn(batchSheetJob);
  const jobs = useQuery({
    queryKey: ["sheet-geolocation", "list", tenantId],
    queryFn: () => list({ data: { tenantId } }),
    enabled: !!tenantId,
  });
  const detail = useQuery({
    queryKey: ["sheet-geolocation", "job", tenantId, jobId],
    queryFn: () => get({ data: { tenantId, jobId } }),
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data?.status === "running" ? 3000 : false),
  });
  const job = detail.data;
  const rows = (job?.rows ?? []) as unknown as Row[];
  const stats = counts(rows);
  const complete = job?.status === "processed" && stats.total > 0 && stats.pending === 0;
  const waiting =
    stats.pending > 0 &&
    rows.every((r) => r.status !== "pending" || (r.nextRetry ?? 0) > Date.now());
  const nextRetry = waiting
    ? Math.min(...rows.filter((r) => r.status === "pending").map((r) => r.nextRetry ?? 0))
    : undefined;
  const visible = rows.filter((r) => !filter || r.status === filter);
  const refresh = useCallback(
    () => cache.invalidateQueries({ queryKey: ["sheet-geolocation"] }),
    [cache],
  );
  const loop = useRef(false);
  // No processing on mount/reopen. Only the explicit Start click enables orchestration in this tab.
  const [run, setRun] = useState(false);
  useEffect(() => {
    setRun(false);
    setCost(false);
  }, [tenantId, jobId]);
  useEffect(() => {
    if (job?.status !== "running") setRun(false);
  }, [job?.status]);
  useEffect(() => {
    if (!run || !jobId || job?.status !== "running") return;
    let stopped = false;
    const tick = async () => {
      if (stopped || loop.current) return;
      loop.current = true;
      try {
        const r = await batch({ data: { tenantId, jobId } });
        if ("error" in r && r.error) {
          toast.error(r.error);
          setRun(false);
        }
        await refresh();
      } catch (e) {
        setRun(false);
        toast.error(e instanceof Error ? e.message : "Falha no lote");
      } finally {
        loop.current = false;
      }
    };
    const timer = setInterval(() => void tick(), 2500);
    void tick();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [run, jobId, tenantId, job?.status, batch, refresh]);
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
  const chooseSheet = (name: string, w = book, h = header) => {
    setSheet(name);
    if (w) setMapping(suggest(sheetRows(w, name)[h - 1] ?? []));
    setConfirmed(false);
  };
  const matrix = book && sheet ? sheetRows(book, sheet) : [];
  const headers = matrix[header - 1] ?? [];
  let preview: Row[] = [];
  let previewError = "";
  if (book && file && sheet) {
    try {
      preview = parseSheet(book, sheet, header, mapping, kind, file.name);
    } catch (e) {
      previewError = e instanceof Error ? e.message : "Arquivo inválido";
    }
  }
  const save = async () => {
    if (!file || !book || !confirmed) return;
    let current =
      job?.status === "draft" && job.filename === file.name && job.kind === kind ? job : undefined;
    if (!current) {
      current = await create({ data: { tenantId, filename: file.name, kind } });
      setJob(current.id);
    }
    const upload = await supabase.storage
      .from("sheet-geolocation-originals")
      .upload(current.storage_path, file, { upsert: false });
    if (upload.error && !/already exists|duplicate/i.test(upload.error.message))
      throw new Error(upload.error.message);
    if (upload.error) {
      const existing = await supabase.storage
        .from("sheet-geolocation-originals")
        .download(current.storage_path);
      if (existing.error || !existing.data)
        throw new Error("Não foi possível verificar o original já arquivado.");
      const left = new Uint8Array(await existing.data.arrayBuffer());
      const right = new Uint8Array(await file.arrayBuffer());
      if (left.length !== right.length || left.some((byte, index) => byte !== right[index]))
        throw new Error(
          "O arquivo difere do original privado; selecione Novo arquivo independente.",
        );
    }
    const saved = await commit({
      data: { tenantId, jobId: current.id, sheet, header, mapping, budget, confirmed: true },
    });
    setJob(saved.id);
    cache.setQueryData(["sheet-geolocation", "job", tenantId, saved.id], saved);
    await refresh();
    setBook(undefined);
    setFile(undefined);
    setConfirmed(false);
    toast.success("Original privado e linhas preservados; nenhuma consulta Google iniciada.");
  };
  const prepare = async () => {
    if (!job?.sheet || !job.header_row) return;
    const source = await supabase.storage
      .from("sheet-geolocation-originals")
      .download(job.storage_path);
    if (source.error || !source.data) throw new Error("Original privado indisponível.");
    const w = workbook(new Uint8Array(await source.data.arrayBuffer()));
    enrich(w, job.sheet, job.header_row, rows);
    // All original rows stay in the main sheet; separate status sheets carry source row numbers for audit.
    for (const status of ["high", "review", "error", "pending"] as const) {
      const title = `GEO_${status}`;
      let unique = title;
      let i = 1;
      while (w.SheetNames.includes(unique)) unique = `${title}_${i++}`;
      XLSX.utils.book_append_sheet(
        w,
        XLSX.utils.aoa_to_sheet([
          ["Linha original", ...extraHeaders],
          ...rows.filter((r) => r.status === status).map((r) => [r.index + 1, ...resultCells(r)]),
        ]),
        unique,
      );
    }
    download(
      XLSX.write(w, { type: "array", bookType: "xlsx" }),
      `${job.filename.replace(/\.(xlsx|csv)$/i, "")}_geolocalizado.xlsx`,
    );
  };
  return (
    <div className="space-y-6 text-foreground">
      <header className="border-b border-border pb-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Geolocalização de Planilhas
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Arquivos independentes · originais privados · endereço original preservado
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Cliente da planilha"
          className={selectClass}
          value={tenantId}
          onChange={(e) => {
            setTenant(e.target.value);
            setJob("");
          }}
        >
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Processamento de planilha"
          className={`${selectClass} max-w-full`}
          value={jobId}
          onChange={(e) => setJob(e.target.value)}
        >
          <option value="">Novo arquivo independente</option>
          {jobs.data?.map((j) => (
            <option key={j.id} value={j.id}>
              {j.filename} · {j.sheet ?? "não confirmado"} ·{" "}
              {j.id === job?.id ? job.status : j.status}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="icon"
          title="Atualizar processamentos"
          aria-label="Atualizar processamentos"
          onClick={() => void refresh()}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <section className="space-y-4 border-b border-border pb-6">
        <h3 className="font-semibold">Arquivo e mapeamento</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            Tipo
            <select
              aria-label="Tipo de planilha"
              className={`${selectClass} w-full`}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind);
                setConfirmed(false);
              }}
            >
              <option value="office">Escritórios</option>
              <option value="hotel">Hotéis</option>
              <option value="store">Lojas</option>
            </select>
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            Original XLSX / CSV
            <Input
              aria-label="Arquivo para geolocalização"
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                  void action(async () => {
                    const w = workbook(new Uint8Array(await f.arrayBuffer()));
                    setFile(f);
                    setBook(w);
                    setHeader(1);
                    chooseSheet(w.SheetNames[0] ?? "", w, 1);
                  });
              }}
            />
          </label>
          <label className="space-y-1 text-sm">
            Limite de consultas Google
            <Input
              aria-label="Limite de consultas Google"
              type="number"
              min={1}
              max={6000}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            />
          </label>
        </div>
        <p className="text-sm text-warning">
          Consultas Google são cobradas por uso. Hotéis podem consumir até três consultas por
          tentativa; o limite interrompe o lote.
        </p>
        {book && (
          <>
            <div className="flex flex-wrap gap-3">
              <label className="space-y-1 text-sm">
                Aba
                <select
                  aria-label="Aba da planilha"
                  className={`${selectClass} block`}
                  value={sheet}
                  onChange={(e) => chooseSheet(e.target.value)}
                >
                  {book.SheetNames.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                Linha de cabeçalho
                <Input
                  className="w-28"
                  aria-label="Linha de cabeçalho da planilha"
                  type="number"
                  min={1}
                  max={100}
                  value={header}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    setHeader(h);
                    chooseSheet(sheet, book, h);
                  }}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(fields).map(([key, label]) => (
                <label className="space-y-1 text-sm" key={key}>
                  {label}
                  <select
                    aria-label={`Mapear ${label}`}
                    className={`${selectClass} w-full`}
                    value={mapping[key as keyof Mapping] ?? ""}
                    onChange={(e) => {
                      setMapping((m) => ({
                        ...m,
                        [key]: e.target.value === "" ? undefined : Number(e.target.value),
                      }));
                      setConfirmed(false);
                    }}
                  >
                    <option value="">Não mapeado</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {XLSX.utils.encode_col(i)} · {h || "Sem título"}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="text-sm">
              {preview.length} linhas preservadas · {preview.filter((r) => r.notes.length).length}{" "}
              linhas com observações
            </p>
            {previewError && (
              <p role="alert" className="text-sm text-destructive">
                {previewError}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    {[
                      "Linha",
                      "Nome / código",
                      "Logradouro",
                      "Número",
                      "Cidade / UF",
                      "CEP",
                      "Observações",
                    ].map((h) => (
                      <th key={h} className="border-b border-border p-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 8).map((r) => (
                    <tr key={r.index}>
                      <td className="p-2">{r.index + 1}</td>
                      <td className="p-2">{r.entity.name || r.entity.code || "—"}</td>
                      <td className="p-2">{r.entity.address}</td>
                      <td className="p-2">{r.entity.number || "—"}</td>
                      <td className="p-2">
                        {r.entity.city} / {r.entity.uf}
                      </td>
                      <td className="p-2">{r.entity.cep}</td>
                      <td className="p-2">{r.notes.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Confirmo a aba, o tipo e o mapeamento acima
            </label>
            <Button
              disabled={busy || !confirmed || !!previewError || !preview.length}
              onClick={() => void action(save)}
            >
              <Upload className="mr-2 h-4 w-4" />
              Salvar arquivo e mapeamento
            </Button>
          </>
        )}
      </section>
      {job && (
        <section className="space-y-4">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h3 className="font-semibold break-all">{job.filename}</h3>
              <p className="text-sm text-muted-foreground">
                Original privado · {job.sheet ?? "aguardando mapeamento"} ·{" "}
                {job.status === "processed"
                  ? "Tentativas encerradas; confira revisões e falhas"
                  : job.status}{" "}
                · {job.requests_reserved}/{job.request_budget} consultas reservadas
              </p>
            </div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const f = await supabase.storage
                    .from("sheet-geolocation-originals")
                    .download(job.storage_path);
                  if (f.error || !f.data) throw new Error("Original indisponível");
                  const url = URL.createObjectURL(f.data);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = job.filename;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 30000);
                })
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Arquivo original
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                ["total", "Linhas"],
                ["high", "Alta confiança"],
                ["review", "Revisão"],
                ["error", "Falhas"],
                ["pending", "Pendentes"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="border-l-2 border-border pl-3">
                <div className="text-2xl font-semibold">{stats[key]}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
          {complete && (
            <div role="status" className="border-l-2 border-primary pl-3">
              <p className="font-semibold">
                Processamento finalizado — {stats.total} de {stats.total} linhas analisadas
              </p>
              <p className="text-sm">
                Alta confiança: {stats.high} · Revisão: {stats.review} · Falhas: {stats.error}
              </p>
            </div>
          )}
          {waiting && job.status === "running" && nextRetry && (
            <p role="status" className="text-sm text-warning">
              Aguardando nova tentativa — {new Date(nextRetry).toLocaleString("pt-BR")}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Linhas em revisão ou com falha não são coordenadas aprovadas.
          </p>
          <p className="text-sm">
            Verificados: {stats.high}/{stats.total} · checkpoint de tentativas: {job.checkpoint}/
            {stats.total}
          </p>
          <progress
            className="h-2 w-full accent-primary"
            value={stats.total - stats.pending}
            max={stats.total || 1}
            aria-label="Linhas analisadas"
          />
          {job.last_error && (
            <p role="alert" className="text-sm text-destructive">
              {job.last_error}
            </p>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={cost} onChange={(e) => setCost(e.target.checked)} />
            Autorizo consultas cobradas pelo Google, até o limite deste arquivo
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !cost || !stats.pending || job.status === "draft" || run}
              onClick={() =>
                void action(async () => {
                  await control({
                    data: { tenantId, jobId, status: "running", confirmedCost: true },
                  });
                  setRun(true);
                })
              }
            >
              <Play className="mr-2 h-4 w-4" />
              Iniciar / retomar Google
            </Button>
            <Button
              variant="outline"
              disabled={busy || job.status === "draft" || complete}
              onClick={() => {
                setRun(false);
                void action(() => control({ data: { tenantId, jobId, status: "paused" } }));
              }}
            >
              <Pause className="mr-2 h-4 w-4" />
              Pausar
            </Button>
            <Button
              variant="outline"
              disabled={busy || job.status === "draft" || complete}
              onClick={() => {
                setRun(false);
                void action(() => control({ data: { tenantId, jobId, status: "cancelled" } }));
              }}
            >
              <Square className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button
              variant={complete ? "default" : "outline"}
              disabled={busy || !rows.length}
              onClick={() => void action(prepare)}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {complete ? "Baixar Excel final" : "Baixar Excel parcial"}
            </Button>
          </div>
          <select
            aria-label="Filtrar status geocodificação"
            className={selectClass}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Todos os status</option>
            {Object.entries(labels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {visible.length} linhas neste filtro · o Excel preserva todas as linhas originais
          </p>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-background">
                <tr>
                  {[
                    "Linha",
                    "Nome / código",
                    "Endereço original",
                    "Status",
                    "Latitude",
                    "Longitude",
                    "Precisão",
                    "Observações",
                  ].map((h) => (
                    <th className="border-b border-border p-2" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 100).map((r) => (
                  <tr key={r.index} className="border-b border-border">
                    <td className="p-2">{r.index + 1}</td>
                    <td className="p-2">{r.entity.name || r.entity.code || "—"}</td>
                    <td className="min-w-48 p-2">
                      {r.entity.address}, {r.entity.number} · {r.entity.city}/{r.entity.uf}
                    </td>
                    <td className="p-2">{labels[r.status]}</td>
                    <td className="p-2">{r.geo?.lat ?? "—"}</td>
                    <td className="p-2">{r.geo?.lng ?? "—"}</td>
                    <td className="p-2">{r.precision ?? "—"}</td>
                    <td className="min-w-48 p-2">{r.notes.join("; ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
