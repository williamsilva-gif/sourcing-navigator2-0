import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { WikiMarkdown } from "@/components/wiki/WikiMarkdown";
import { WikiEditor } from "@/components/wiki/WikiEditor";
import { Pencil, ChevronRight, Calendar } from "lucide-react";
import { updateWikiPage, deleteWikiPage, type WikiPage } from "@/lib/wikiRepo";
import { useWikiPages } from "@/lib/wikiStore";
import { useAuth, getPrimaryRole } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/wiki/$slug")({
  component: WikiPageView,
});

function WikiPageView() {
  const { slug } = Route.useParams();
  const { pages, reload } = useWikiPages();
  const { user, roles } = useAuth();
  const role = getPrimaryRole(roles);
  const isTaMaster = role === "ta_master" || role === "ta_staff";
  const navigate = useNavigate();

  const page = useMemo(() => pages.find((p) => p.slug === slug), [pages, slug]);
  const breadcrumb = useMemo<WikiPage[]>(() => {
    if (!page) return [];
    const map = new Map<string, WikiPage>(pages.map((p) => [p.id, p]));
    const chain: WikiPage[] = [];
    let cur: WikiPage | undefined = page;
    while (cur) {
      chain.unshift(cur);
      cur = cur.parent_id ? map.get(cur.parent_id) : undefined;
    }
    return chain;
  }, [page, pages]);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!page) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">Página não encontrada.</p>
      </div>
    );
  }

  if (editing) {
    return (
      <WikiEditor
        initial={{ title: page.title, content_md: page.content_md, module_key: page.module_key }}
        saving={saving}
        onCancel={() => setEditing(false)}
        onSave={async (v) => {
          setSaving(true);
          try {
            await updateWikiPage(page.id, { ...v, userId: user?.id ?? null });
            await reload();
            toast.success("Salvo");
            setEditing(false);
          } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Erro ao salvar");
          } finally {
            setSaving(false);
          }
        }}
        onDelete={async () => {
          if (!confirm(`Excluir "${page.title}" e todas as subpáginas?`)) return;
          try {
            await deleteWikiPage(page.id);
            toast.success("Excluído");
            await reload();
            navigate({ to: "/wiki" });
          } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Erro ao excluir");
          }
        }}
      />
    );
  }

  return (
    <article>
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {breadcrumb.map((b, i) => (
          <span key={b.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            <span className={i === breadcrumb.length - 1 ? "text-foreground" : ""}>{b.title}</span>
          </span>
        ))}
      </nav>

      <header className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Atualizado em {new Date(page.updated_at).toLocaleDateString("pt-BR")}
            </span>
            {page.module_key && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                {page.module_key}
              </span>
            )}
          </div>
        </div>
        {isTaMaster && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
          </Button>
        )}
      </header>

      <WikiMarkdown source={page.content_md} />
    </article>
  );
}
