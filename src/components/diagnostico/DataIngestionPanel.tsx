import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  RefreshCw,
} from "lucide-react";
import { useBaselineStore } from "@/lib/baselineStore";
import { SCHEMA_LABELS, SCHEMA_HEADERS, type DatasetType } from "@/lib/baselineSchemas";
import { downloadTemplate, readSpreadsheet } from "@/lib/xlsxTemplates";
import { useSnapshotStore } from "@/lib/snapshotStore";
import { generateDemoBookings, generateDemoContracts } from "@/lib/demoData";

const TYPES: DatasetType[] = ["bookings", "hotels", "contracts"];

export function DataIngestionPanel() {
  const { uploads, ingest, removeUpload, bookings, hotels, contracts, setUseDemo, useDemo } = useBaselineStore();
  const [activeType, setActiveType] = useState<DatasetType>("bookings");
  const [isDragging, setIsDragging] = useState(false);
  const [errorOpenId, setErrorOpenId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    let ingestedAny = false;
    for (const file of arr) {
      try {
        const rows = await readSpreadsheet(file);
        if (rows.length === 0) {
          toast.error(`${file.name}: arquivo vazio ou ilegível`);
          continue;
        }
        const rec = ingest(activeType, file.name, rows);
        if (rec.status === "ok") {
          toast.success(`${file.name}: ${rec.rowCount} linhas importadas`);
          ingestedAny = true;
        } else if (rec.status === "partial") {
          toast.warning(`${file.name}: ${rec.rowCount} ok · ${rec.errorCount} com erro`);
          ingestedAny = true;
        } else {
          toast.error(`${file.name}: nenhuma linha válida (${rec.errorCount} erros)`);
        }
      } catch (e) {
        toast.error(`${file.name}: falha ao ler · ${(e as Error).message}`);
      }
    }
    // Auto-trigger continuous evaluation after a successful ingest
    if (ingestedAny && activeType === "bookings") {
      useSnapshotStore.getState().evaluate();
      const snap = useSnapshotStore.getState().current;
      if (snap) {
        toast.info(`Recomendações atualizadas · ${snap.alerts.length} alertas · ${snap.opportunities.length} oportunidades`);
      }
    }
  }

  function recalculate() {
    if (uploads.length === 0) {
      toast.info("Carregue pelo menos um arquivo de bookings antes de recalcular");
      return;
    }
    toast.success(
      `Baseline recalculado · ${bookings.length} bookings · ${hotels.length} hotéis · ${contracts.length} contratos`,
    );
  }

  function loadDemoDataset() {
    // Bookings 2024 + 2025 (500/ano) + contratos vigentes para os dois anos.
    const bks = generateDemoBookings(500, [2024, 2025]);
    const ctrs = generateDemoContracts([2024, 2025]);
    const recB = ingest("bookings", "demo-bookings-2024-2025.synthetic", bks);
    const recC = ingest("contracts", "demo-contracts-2024-2025.synthetic", ctrs);
    useSnapshotStore.getState().evaluate();
    const snap = useSnapshotStore.getState().current;
    toast.success(`Demo carregado · ${recB.rowCount} bookings · ${recC.rowCount} contratos`, {
      description: snap
        ? `${snap.alerts.length} alertas · ${snap.opportunities.length} oportunidades · 2024 vs 2025 disponível`
        : "2024 vs 2025 disponível para comparação",
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Ingestão de dados do programa</h2>
            <p className="text-xs text-muted-foreground">
              Suba bookings, hotéis e contratos · dados em memória nesta sessão (persistência em breve)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={useDemo}
              onChange={(e) => setUseDemo(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Usar dados demo se vazio
          </label>
          <button
            onClick={loadDemoDataset}
            title="Injeta bookings 2024 + 2025 e contratos vigentes para comparação YoY"
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary-soft/40 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary-soft"
          >
            <Database className="h-3.5 w-3.5" />
            Carregar demo 2024+2025
          </button>
          <button
            onClick={recalculate}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recalcular baseline
          </button>
        </div>
      </header>

      <div className="space-y-4 p-5">
        {/* Type selector */}
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeType === t
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {SCHEMA_LABELS[t]}
            </button>
          ))}
          <button
            onClick={() => downloadTemplate(activeType)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar template {activeType}.xlsx
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-8 transition-colors ${
            isDragging ? "border-primary bg-primary-soft" : "border-border bg-muted/30"
          }`}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">
            Arraste {SCHEMA_LABELS[activeType].toLowerCase()} aqui
          </p>
          <p className="text-xs text-muted-foreground">.xlsx, .xls ou .csv · até 50k linhas</p>
          <button
            onClick={() => fileInput.current?.click()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
          >
            <Upload className="h-3.5 w-3.5" />
            Selecionar arquivo
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="mt-3 text-[11px] text-muted-foreground">
            Colunas esperadas: <span className="font-mono">{SCHEMA_HEADERS[activeType].join(", ")}</span>
          </p>
        </div>

        {/* Upload list */}
        {uploads.length > 0 && (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Arquivo</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-right">Linhas</th>
                  <th className="px-3 py-2 text-right">Erros</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Quando</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => (
                  <>
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium text-foreground">{u.filename}</td>
                      <td className="px-3 py-2 text-muted-foreground">{u.type}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">{u.rowCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {u.errorCount > 0 ? (
                          <button
                            onClick={() => setErrorOpenId(errorOpenId === u.id ? null : u.id)}
                            className="text-destructive underline-offset-2 hover:underline"
                          >
                            {u.errorCount}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(u.uploadedAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => {
                            removeUpload(u.id);
                            toast.info(`${u.filename} removido`);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                    {errorOpenId === u.id && u.errors.length > 0 && (
                      <tr key={`${u.id}-errors`} className="bg-destructive-soft/30">
                        <td colSpan={7} className="px-3 py-2 text-[11px] text-destructive">
                          <ul className="space-y-0.5">
                            {u.errors.map((err, i) => (
                              <li key={i} className="font-mono">• {err}</li>
                            ))}
                            {u.errorCount > u.errors.length && (
                              <li className="italic">… e mais {u.errorCount - u.errors.length} erros</li>
                            )}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: "ok" | "partial" | "error" }) {
  if (status === "ok")
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
        <CheckCircle2 className="h-3 w-3" />Processado
      </span>
    );
  if (status === "partial")
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">
        <AlertTriangle className="h-3 w-3" />Parcial
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-destructive-soft px-2 py-0.5 text-[11px] font-semibold text-destructive">
      <XCircle className="h-3 w-3" />Erro
    </span>
  );
}