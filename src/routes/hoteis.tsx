import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Hotel as HotelIcon, Plus, Pencil, Trash2, MapPin, Search, Upload, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { hotelSchema, type Hotel } from "@/lib/baselineSchemas";
import { HotelForm } from "@/components/hotels/HotelForm";
import { downloadTemplate, readSpreadsheet } from "@/lib/xlsxTemplates";
import {
  listHotels,
  createHotel,
  updateHotel,
  deleteHotelById,
  bulkUpsertByCode,
  type HotelWithLocal,
} from "@/lib/hotelsRepo";
import { useAuth, getPrimaryRole } from "@/hooks/useAuth";

export const Route = createFileRoute("/hoteis")({
  head: () => ({
    meta: [
      { title: "Hotéis — SourcingHub" },
      { name: "description", content: "Cadastro e edição de hotéis com validação de endereço no mapa." },
    ],
  }),
  component: HotelsPage,
});

function HotelsPage() {
  const { roles, loading: authLoading } = useAuth();
  const primaryRole = getPrimaryRole(roles);
  const isTa = primaryRole === "ta_master" || primaryRole === "ta_staff";
  const canDelete = isTa;

  const [hotels, setHotels] = useState<HotelWithLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HotelWithLocal | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, pageSize]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number; batch: number; batches: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      const rows = await listHotels();
      setHotels(rows);
    } catch (e) {
      toast.error(`Falha ao carregar hotéis: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    if (!q) return hotels;
    return hotels.filter((h) =>
      [h.code, h.name, h.city, h.state, h.country_code, h.address]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [hotels, debouncedQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = useMemo(
    () => filtered.slice(pageStart, pageStart + pageSize),
    [filtered, pageStart, pageSize],
  );

  async function handleSave(h: Hotel) {
    try {
      if (editing === "new") {
        await createHotel(h);
        toast.success(`${h.name} cadastrado`);
      } else if (editing) {
        await updateHotel(editing.id, h);
        toast.success(`${h.name} atualizado`);
      }
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error(`Falha ao salvar: ${(e as Error).message}`);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remover o hotel ${name}?`)) return;
    try {
      await deleteHotelById(id);
      toast.info(`${name} removido`);
      refresh();
    } catch (e) {
      toast.error(`Falha ao remover: ${(e as Error).message}`);
    }
  }

  async function handleBulk(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImporting(true);
    let totalErrors = 0;
    const errorSamples: string[] = [];
    const allValid: Hotel[] = [];
    try {
      for (const file of Array.from(files)) {
        const rows = await readSpreadsheet(file);
        rows.forEach((r, i) => {
          const res = hotelSchema.safeParse(r);
          if (res.success) allValid.push(res.data);
          else {
            totalErrors++;
            if (errorSamples.length < 5) {
              errorSamples.push(`L${i + 2}: ${res.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
            }
          }
        });
      }
      setImportProgress({ processed: 0, total: allValid.length, batch: 0, batches: Math.max(1, Math.ceil(allValid.length / 1000)) });
      const result = await bulkUpsertByCode(allValid, (info) => setImportProgress(info));
      const desc =
        (totalErrors > 0 ? `${totalErrors} linhas com erro · ex: ${errorSamples[0]}` : undefined) ??
        result.firstError;
      toast.success(`${result.added} novos · ${result.updated} atualizados${result.failed ? ` · ${result.failed} falharam` : ""}`, {
        description: desc,
      });
      refresh();
    } catch (e) {
      toast.error(`Falha na importação: ${(e as Error).message}`);
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:flex-wrap">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary">
              <HotelIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Hotéis cadastrados</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {hotels.length} hotéis no banco · sincronizados com o Supabase
              </p>
            </div>
          </div>
          {editing === null && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => downloadTemplate("hotels")}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
              >
                <Download className="h-3.5 w-3.5" />
                Template .xlsx
              </button>
              <button
                onClick={() => fileInput.current?.click()}
                disabled={importing}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {importing ? "Importando…" : "Upload em massa"}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleBulk(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => setEditing("new")}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo hotel
              </button>
            </div>
          )}
        </header>

        {importing && importProgress && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>
                Lote {importProgress.batch}/{importProgress.batches} · {importProgress.processed.toLocaleString("pt-BR")} de {importProgress.total.toLocaleString("pt-BR")} hotéis
              </span>
              <span className="font-mono text-foreground">
                {Math.round((importProgress.processed / Math.max(1, importProgress.total)) * 100)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${Math.min(100, (importProgress.processed / Math.max(1, importProgress.total)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {editing !== null ? (
          <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="mb-4 text-base font-semibold text-foreground">
              {editing === "new" ? "Cadastrar novo hotel" : `Editar ${editing.name}`}
            </h2>
            <HotelForm
              initial={editing === "new" ? undefined : (editing as unknown as Hotel)}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
              existingCodes={hotels.map((h) => h.code ?? "").filter(Boolean)}
            />
          </section>
        ) : (
          <section className="rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por código, nome, cidade…"
                className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground">{filtered.length} resultado(s)</span>
            </div>

            {loading || authLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando hotéis do banco…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {hotels.length === 0
                  ? "Nenhum hotel cadastrado no banco. Use “Novo hotel” ou “Upload em massa”."
                  : "Nenhum hotel corresponde à busca."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Código</th>
                      <th className="px-3 py-2 text-left">Nome</th>
                      <th className="px-3 py-2 text-left">Cidade / UF</th>
                      <th className="px-3 py-2 text-left">Endereço</th>
                      <th className="px-3 py-2 text-center">Estrelas</th>
                      <th className="px-3 py-2 text-left">Geo</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((h) => (
                      <tr key={h.id} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{h.code ?? "—"}</td>
                        <td className="px-3 py-2 font-medium text-foreground">{h.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {h.city}
                          {h.state ? ` / ${h.state}` : ""}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{h.address || "—"}</td>
                        <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                          {typeof h.star_rating === "number" ? `${h.star_rating}★` : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {typeof h.latitude === "number" && typeof h.longitude === "number" ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-success" />
                              <span className="font-mono">
                                {h.latitude.toFixed(3)}, {h.longitude.toFixed(3)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">sem coords.</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            {isTa ? (
                              <button
                                onClick={() => setEditing(h)}
                                className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                aria-label="Editar"
                                title="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <span
                                className="rounded p-1 text-muted-foreground/40"
                                title="Apenas TA pode editar hotéis existentes. Hotel pode editar o próprio na área de perfil."
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </span>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(h.id, h.name)}
                                className="rounded p-1 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                                aria-label="Remover"
                                title="Remover"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && !authLoading && filtered.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Linhas por página:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded border border-border bg-card px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
                  >
                    {[25, 50, 100, 200, 500].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  {(pageStart + 1).toLocaleString("pt-BR")}–{Math.min(pageStart + pageSize, filtered.length).toLocaleString("pt-BR")} de {filtered.length.toLocaleString("pt-BR")}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={currentPage === 1}
                    className="rounded border border-border px-2 py-1 hover:bg-secondary disabled:opacity-40"
                  >«</button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded border border-border px-2 py-1 hover:bg-secondary disabled:opacity-40"
                  >‹</button>
                  <span className="px-2 font-mono text-foreground">{currentPage}/{totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded border border-border px-2 py-1 hover:bg-secondary disabled:opacity-40"
                  >›</button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="rounded border border-border px-2 py-1 hover:bg-secondary disabled:opacity-40"
                  >»</button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
