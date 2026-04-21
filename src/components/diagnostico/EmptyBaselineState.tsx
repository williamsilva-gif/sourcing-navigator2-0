import { Database, Upload } from "lucide-react";

export function EmptyBaselineState({ onUploadClick }: { onUploadClick?: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Database className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">
        Nenhum baseline carregado
      </h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
        Carregue um arquivo de bookings (Excel ou CSV) para gerar o diagnóstico real do programa.
        Enquanto isso, os módulos exibem dados de demonstração.
      </p>
      {onUploadClick && (
        <button
          onClick={onUploadClick}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          <Upload className="h-3.5 w-3.5" />
          Subir arquivo de bookings
        </button>
      )}
    </div>
  );
}