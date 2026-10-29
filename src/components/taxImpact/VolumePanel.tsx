import { useState } from "react";
import type * as XLSX from "xlsx";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { commitTaxVolumeFn } from "@/lib/taxImpact.v11.functions";
import {
  volumeBook,
  volumePreview,
  parseVolume,
  volumeStats,
  volumeFields,
  type VolumeMapping,
  type VolumeField,
} from "@/lib/taxImpact/volume";
export function VolumePanel({
  tenantId,
  analysisId,
  onSaved,
}: {
  tenantId: string;
  analysisId: string;
  onSaved: () => void;
}) {
  const commit = useServerFn(commitTaxVolumeFn);
  const [file, setFile] = useState<File | null>(null),
    [wb, setWb] = useState<XLSX.WorkBook | null>(null),
    [sheet, setSheet] = useState(""),
    [mapping, setMapping] = useState<VolumeMapping>({}),
    [parsed, setParsed] = useState<ReturnType<typeof parseVolume> | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load(f: File | undefined) {
    setError("");
    setParsed(null);
    setConfirmed(false);
    setFile(null);
    setWb(null);
    if (!f) return;
    try {
      if (!/\.(xlsx|csv)$/i.test(f.name)) throw new Error("Selecione XLSX ou CSV.");
      const book = volumeBook(new Uint8Array(await f.arrayBuffer()), /\.csv$/i.test(f.name)),
        name = book.SheetNames.includes("Base Volume") ? "Base Volume" : book.SheetNames[0];
      setWb(book);
      setSheet(name);
      setMapping(volumePreview(book, name).mapping);
      setFile(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Arquivo inválido");
    }
  }
  async function save() {
    if (!file || !parsed || !confirmed) return;
    setBusy(true);
    setError("");
    try {
      const id = crypto.randomUUID(),
        ext = /\.csv$/i.test(file.name) ? "csv" : "xlsx";
      const uploaded = await supabase.storage
        .from("tax-impact-originals")
        .upload(`${tenantId}/${analysisId}/volume-${id}.${ext}`, file, { upsert: false });
      if (uploaded.error) throw new Error("Upload privado não concluído.");
      await commit({
        data: {
          tenantId,
          analysisId,
          importId: id,
          filename: file.name,
          sheet,
          mapping,
          confirmed: true,
        },
      });
      setFile(null);
      setWb(null);
      setParsed(null);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  const preview = wb ? volumePreview(wb, sheet) : null;
  const stats = parsed ? volumeStats(parsed.rows) : null;
  return (
    <section className="space-y-3 border-t border-border py-5">
      <h3 className="font-semibold">Volumetria histórica</h3>
      <p className="text-xs text-muted-foreground">
        Histórico realizado e projeção separados · Base Volume · até 20.000 linhas / 10 MB
      </p>
      <input
        aria-label="Arquivo volumetria"
        type="file"
        accept=".xlsx,.csv"
        disabled={busy}
        onChange={(e) => void load(e.target.files?.[0])}
      />
      {wb && preview && (
        <>
          <label className="block text-sm">
            Aba de volumetria
            <select
              aria-label="Aba volumetria"
              className="ml-2 rounded-md border border-input bg-background p-2"
              value={sheet}
              onChange={(e) => {
                setSheet(e.target.value);
                setMapping(volumePreview(wb, e.target.value).mapping);
                setParsed(null);
                setConfirmed(false);
              }}
            >
              {wb.SheetNames.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(volumeFields).map(([f, label]) => (
              <label key={f} className="text-xs">
                {label}
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background p-2"
                  aria-label={`Volume ${label}`}
                  value={mapping[f as VolumeField] ?? ""}
                  onChange={(e) => {
                    const next = { ...mapping };
                    if (e.target.value === "") delete next[f as VolumeField];
                    else next[f as VolumeField] = Number(e.target.value);
                    setMapping(next);
                    setParsed(null);
                    setConfirmed(false);
                  }}
                >
                  <option value="">Não mapeado</option>
                  {preview.columns
                    .filter((c) => c.name)
                    .map((c) => (
                      <option key={c.index} value={c.index}>
                        {c.index + 1}. {c.name}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </div>
          <Button
            variant="outline"
            onClick={() => {
              try {
                setParsed(parseVolume(wb, sheet, mapping));
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Falha no preview");
              }
            }}
          >
            Validar volumetria
          </Button>
        </>
      )}
      {parsed && stats && (
        <>
          <p className="text-sm">
            {parsed.rows.length} linhas válidas · {parsed.errors.length} ocorrências · 2025:{" "}
            {stats.fy25.toLocaleString("pt-BR")} diárias · Jan–Mai 2026:{" "}
            {stats.n26.toLocaleString("pt-BR")} diárias · ADR realizado:{" "}
            {stats.adr26?.toFixed(2) ?? "indeterminado"}
          </p>
          <div className="max-h-40 overflow-auto text-xs">
            {parsed.rows.slice(0, 5).map((r) => (
              <p key={r.row}>
                {r.hotel} · {r.cnpj} · {r.month}/{r.year} · {r.nights} diárias · R${" "}
                {r.amount.toFixed(2)}
              </p>
            ))}
            {parsed.errors.slice(0, 50).map((r) => (
              <p className="text-warning-foreground" key={r.row}>
                Linha {r.row}: {r.message}
              </p>
            ))}
          </div>
          <label className="flex gap-2 text-sm">
            <Checkbox
              aria-label="Confirmar volumetria"
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
            />
            Confirmo check-in, diárias e Tarifa como valor total transacionado, não ADR.
          </label>
          <Button disabled={busy || !confirmed} onClick={() => void save()}>
            Salvar volumetria
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
