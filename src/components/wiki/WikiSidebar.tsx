import { useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { ChevronRight, ChevronDown, FileText, Search, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { WikiPage, WikiTreeNode } from "@/lib/wikiRepo";
import { buildTree } from "@/lib/wikiRepo";
import { useEnabledModules, type ModuleKey } from "@/lib/appConfigStore";

interface Props {
  pages: WikiPage[];
}

function filterByModule(pages: WikiPage[], enabled: Record<ModuleKey, boolean>): WikiPage[] {
  return pages.filter((p) => {
    if (!p.module_key) return true;
    const key = p.module_key as ModuleKey;
    return enabled[key] !== false;
  });
}

export function WikiSidebar({ pages }: Props) {
  const enabled = useEnabledModules();
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const filtered = filterByModule(pages, enabled);
    if (!query.trim()) return filtered;
    const q = query.toLowerCase();
    // When searching, flatten matches and ignore hierarchy
    return filtered.filter(
      (p) => p.title.toLowerCase().includes(q) || p.content_md.toLowerCase().includes(q),
    );
  }, [pages, enabled, query]);

  const tree = useMemo(() => (query.trim() ? null : buildTree(visible)), [visible, query]);

  return (
    <aside className="w-[280px] shrink-0 border-r border-border bg-card/40">
      <div className="border-b border-border px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Documentação</h2>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      <nav className="overflow-y-auto px-2 py-3" style={{ maxHeight: "calc(100vh - 200px)" }}>
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            {query ? "Nada encontrado." : "Nenhuma página ainda."}
          </p>
        ) : tree ? (
          <ul className="space-y-0.5">
            {tree.map((node) => (
              <TreeItem key={node.id} node={node} depth={0} />
            ))}
          </ul>
        ) : (
          <ul className="space-y-0.5">
            {visible.map((p) => (
              <li key={p.id}>
                <PageLink slug={p.slug} title={p.title} depth={0} />
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}

function TreeItem({ node, depth }: { node: WikiTreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <div className="flex items-center">
        {hasChildren ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-7 w-5 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={open ? "Recolher" : "Expandir"}
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <PageLink slug={node.slug} title={node.title} depth={depth} />
      </div>
      {open && hasChildren && (
        <ul className="space-y-0.5">
          {node.children.map((c) => (
            <TreeItem key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function PageLink({ slug, title, depth }: { slug: string; title: string; depth: number }) {
  const params = useParams({ strict: false }) as { slug?: string };
  const active = params.slug === slug;
  return (
    <Link
      to="/wiki/$slug"
      params={{ slug }}
      className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
        active
          ? "bg-primary/10 font-semibold text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{title}</span>
    </Link>
  );
}
