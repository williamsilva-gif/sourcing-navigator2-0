import { useState } from "react";
import type * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  importFields,
  importHeaders,
  suggestImport,
  parseImport,
  loadImport,
  type ImportMapping,
} from "@/lib/crossingTenKm/import";
import type { Point } from "@/lib/crossingTenKm/core";
export function CoordinateImport({
  kind,
  onConfirm,
}: {
  kind: Point["kind"];
  onConfirm: (rows: Point[], filename: string) => void;
}) {
  const [book, setBook] = useState<XLSX.WorkBook>(),
    [filename, setFilename] = useState(""),
    [sheet, setSheet] = useState(""),
    [header, setHeader] = useState(1),
    [mapping, setMapping] = useState<ImportMapping>({}),
    [error, setError] = useState("");
  const headers = book ? importHeaders(book, sheet, header) : [];
  let preview: ReturnType<typeof parseImport> | undefined;
  let issue = error;
  if (book)
    try {
      preview = parseImport(book, sheet, header, mapping, kind, filename);
    } catch (e) {
      issue = e instanceof Error ? e.message : "Arquivo inválido";
    }
  const select = (b: XLSX.WorkBook, s: string, h: number) => {
    setSheet(s);
    setHeader(h);
    setMapping(suggestImport(importHeaders(b, s, h)));
  };
  return (
    <div className="min-w-0 space-y-3 border-y border-border py-4">
      <label className="block text-sm font-medium">
        {kind === "office"
          ? "Importar escritórios atualizados (Excel/CSV)"
          : "Importar hotéis geolocalizados (Excel/CSV)"}
        <Input
          className="mt-2"
          type="file"
          aria-label={
            kind === "office"
              ? "Importar escritórios atualizados (Excel/CSV)"
              : "Importar hotéis geolocalizados (Excel/CSV)"
          }
          accept=".xlsx,.csv"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBook(undefined);
            setError("");
            try {
              if (!/\.(xlsx|csv)$/i.test(f.name)) throw new Error("Use XLSX ou CSV.");
              const b = loadImport(new Uint8Array(await f.arrayBuffer()));
              const s = b.SheetNames[0];
              if (!s) throw new Error("Arquivo vazio.");
              setFilename(f.name);
              setBook(b);
              select(b, s, 1);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Arquivo inválido.");
            }
          }}
        />
      </label>
      {book && (
        <>
          <p className="break-all text-sm text-muted-foreground">
            {filename} · fonte completa independente · nenhuma linha histórica será adicionada
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              Aba
              <select
                aria-label={`Aba importação ${kind}`}
                className="ml-2 h-9 max-w-full rounded-md border border-input bg-background px-2"
                value={sheet}
                onChange={(e) => select(book, e.target.value, header)}
              >
                {book.SheetNames.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Linha de cabeçalho
              <Input
                aria-label={`Cabeçalho importação ${kind}`}
                type="number"
                min={1}
                max={100}
                className="w-24"
                value={header}
                onChange={(e) => select(book, sheet, Number(e.target.value))}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(importFields).map(([k, label]) => (
              <label className="min-w-0 text-sm" key={k}>
                {label}
                <select
                  aria-label={`${label} importação ${kind}`}
                  className="mt-1 h-9 w-full min-w-0 rounded-md border border-input bg-background px-2"
                  value={mapping[k as keyof ImportMapping] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({
                      ...m,
                      [k]: e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                >
                  <option value="">Não mapear</option>
                  {headers.map((h, c) => (
                    <option key={c} value={c}>
                      {c + 1} · {h || "Sem título"}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {preview && (
            <>
              <p role="status" className="text-sm">
                {preview.count} de {preview.expected} linhas esperadas ·{" "}
                {preview.count - preview.invalid} coordenadas aptas · {preview.invalid}{" "}
                ausentes/inválidas · {preview.duplicates.length} códigos duplicados ·{" "}
                {preview.missingCodes} códigos vazios
              </p>
              {!preview.countValid && (
                <p className="text-sm text-destructive">
                  A base atualizada deve conter exatamente 631 escritórios. Confira aba e cabeçalho.
                </p>
              )}
              <div className="overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      {["Código/CNPJ", "Cidade/UF", "Latitude", "Longitude", "Precisão"].map(
                        (h) => (
                          <th key={h} className="p-2">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.points.slice(0, 5).map((p) => (
                      <tr key={p.id}>
                        <td className="p-2">{p.code}</td>
                        <td className="p-2">
                          {p.city}/{p.uf}
                        </td>
                        <td className="p-2">{String(p.lat)}</td>
                        <td className="p-2">{String(p.lng)}</td>
                        <td className="p-2">{p.precision}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                disabled={!preview.canConfirm}
                onClick={() => {
                  if (preview) {
                    onConfirm(preview.points, filename);
                    setBook(undefined);
                  }
                }}
              >
                Usar {preview.count}{" "}
                {kind === "office" ? "escritórios atualizados" : "hotéis importados"}
              </Button>
            </>
          )}
        </>
      )}
      {issue && (
        <p role="alert" className="text-sm text-destructive">
          {issue}
        </p>
      )}
    </div>
  );
}
