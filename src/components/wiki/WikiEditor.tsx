import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WikiMarkdown } from "./WikiMarkdown";
import { Eye, Pencil } from "lucide-react";

const MODULE_OPTIONS: { value: string; label: string }[] = [
  { value: "__none__", label: "— Geral (sem módulo) —" },
  { value: "dashboard", label: "Dashboard" },
  { value: "diagnostico", label: "Diagnóstico" },
  { value: "estrategia", label: "Estratégia" },
  { value: "rfp", label: "RFP" },
  { value: "analise", label: "Análise" },
  { value: "negociacao", label: "Negociação" },
  { value: "selecao", label: "Seleção" },
  { value: "implementacao", label: "Implementação" },
  { value: "monitoramento", label: "Monitoramento" },
  { value: "monetizacao", label: "Monetização" },
  { value: "admin", label: "Admin" },
];

export interface WikiEditorValue {
  title: string;
  content_md: string;
  module_key: string | null;
}

interface Props {
  initial: WikiEditorValue;
  saving?: boolean;
  onSave: (v: WikiEditorValue) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}

export function WikiEditor({ initial, saving, onSave, onCancel, onDelete }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content_md);
  const [moduleKey, setModuleKey] = useState<string>(initial.module_key ?? "__none__");
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs">Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Módulo</Label>
          <Select value={moduleKey} onValueChange={setModuleKey}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODULE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setTab("edit")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
            tab === "edit" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
        <button
          onClick={() => setTab("preview")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
            tab === "preview" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Eye className="h-3.5 w-3.5" /> Preview
        </button>
      </div>

      {tab === "edit" ? (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[480px] font-mono text-xs"
          placeholder="# Título&#10;&#10;Escreva em **markdown**.&#10;&#10;- Item&#10;- Outro item&#10;&#10;```js&#10;console.log('snippet')&#10;```"
        />
      ) : (
        <div className="min-h-[480px] rounded-md border border-border bg-card p-6">
          <WikiMarkdown source={content} />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          {onDelete && (
            <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
              Excluir página
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button
            size="sm"
            disabled={saving || !title.trim()}
            onClick={() => onSave({ title: title.trim(), content_md: content, module_key: moduleKey === "__none__" ? null : moduleKey })}
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
