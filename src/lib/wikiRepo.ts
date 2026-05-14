import { supabase } from "@/integrations/supabase/client";

export interface WikiPage {
  id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  module_key: string | null;
  content_md: string;
  position: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function listWikiPages(): Promise<WikiPage[]> {
  const { data, error } = await supabase
    .from("wiki_pages")
    .select("*")
    .order("position", { ascending: true })
    .order("title", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WikiPage[];
}

export async function getWikiPage(slug: string): Promise<WikiPage | null> {
  const { data, error } = await supabase
    .from("wiki_pages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as WikiPage) ?? null;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export async function createWikiPage(input: {
  title: string;
  slug: string;
  parent_id: string | null;
  module_key: string | null;
  userId: string | null;
}): Promise<WikiPage> {
  const { data, error } = await supabase
    .from("wiki_pages")
    .insert({
      title: input.title,
      slug: input.slug,
      parent_id: input.parent_id,
      module_key: input.module_key,
      content_md: `# ${input.title}\n\nEscreva aqui.`,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as WikiPage;
}

export async function updateWikiPage(
  id: string,
  patch: Partial<Pick<WikiPage, "title" | "content_md" | "module_key" | "parent_id" | "position">> & { userId?: string | null },
): Promise<void> {
  const { userId, ...rest } = patch;
  const { error } = await supabase
    .from("wiki_pages")
    .update({ ...rest, updated_by: userId ?? null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteWikiPage(id: string): Promise<void> {
  const { error } = await supabase.from("wiki_pages").delete().eq("id", id);
  if (error) throw error;
}

export interface WikiTreeNode extends WikiPage {
  children: WikiTreeNode[];
}

export function buildTree(pages: WikiPage[]): WikiTreeNode[] {
  const map = new Map<string, WikiTreeNode>();
  pages.forEach((p) => map.set(p.id, { ...p, children: [] }));
  const roots: WikiTreeNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}
