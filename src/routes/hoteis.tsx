import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Hotel as HotelIcon, Plus, Pencil, Trash2, MapPin, Search, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useBaselineStore } from "@/lib/baselineStore";
import { hotelSchema, type Hotel } from "@/lib/baselineSchemas";
import { HotelForm } from "@/components/hotels/HotelForm";
import { downloadTemplate, readSpreadsheet } from "@/lib/xlsxTemplates";

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
  const hotels = useBaselineStore((s) => s.hotels);
  const upsertHotel = useBaselineStore((s) => s.upsertHotel);
  const upsertHotelsBulk = useBaselineStore((s) => s.upsertHotelsBulk);
  const deleteHotel = useBaselineStore((s) => s.deleteHotel);
  const [editing, setEditing] = useState<Hotel | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return hotels;
    return hotels.filter((h) =>
      [h.code, h.name, h.city, h.state_province, h.country_code, h.address]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [hotels, query]);

  function handleSave(h: Hotel) {
    upsertHotel(h);
    setEditing(null);
  }

  function handleDelete(code: string, name: string) {
    if (!confirm(`Remover o hotel ${name}?`)) return;
    deleteHotel(code);
    toast.info(`${name} removido`);
  }

  async function handleBulk(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImporting(true);
    let totalAdded = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    const errorSamples: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const rows = await readSpreadsheet(file);
        const valid: Hotel[] = [];
        rows.forEach((r, i) => {
          const res = hotelSchema.safeParse(r);
          if (res.success) valid.push(res.data);
          else {
            totalErrors++;
            if (errorSamples.length < 5) {
              errorSamples.push(`L${i + 2}: ${res.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
            }
          }
        });
        const { added, updated } = upsertHotelsBulk(valid);
        totalAdded += added;
        totalUpdated += updated;
      }
      toast.success(`${totalAdded} novos · ${totalUpdated} atualizados`, {
        description: totalErrors > 0 ? `${totalErrors} linhas com erro · ex: ${errorSamples[0]}` : undefined,
      });
    } catch (e) {
      toast.error(`Falha na importação: ${(e as Error).message}`);
    } finally {
      setImporting(false);
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
                {hotels.length} hotéis · cadastro manual ou importado · mesmo schema da planilha
              </p>
            </div>
          </div>
          {editing === null && (
            <button
              onClick={() => setEditing("new")}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo hotel
            </button>
          )}
        </header>

        {editing !== null ? (
          <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="mb-4 text-base font-semibold text-foreground">
              {editing === "new" ? "Cadastrar novo hotel" : `Editar ${editing.name}`}
            </h2>
            <HotelForm
              initial={editing === "new" ? undefined : editing}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
              existingCodes={hotels.map((h) => h.code)}
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

            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {hotels.length === 0
                  ? "Nenhum hotel cadastrado. Use “Novo hotel” ou importe via Diagnóstico."
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
                    {filtered.map((h) => (
                      <tr key={h.code} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{h.code}</td>
                        <td className="px-3 py-2 font-medium text-foreground">{h.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {h.city}
                          {h.state_province ? ` / ${h.state_province}` : ""}
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
                            <button
                              onClick={() => setEditing(h)}
                              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                              aria-label="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(h.code, h.name)}
                              className="rounded p-1 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                              aria-label="Remover"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
