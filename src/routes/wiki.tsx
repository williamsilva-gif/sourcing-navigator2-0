import { useState } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { WikiSidebar } from "@/components/wiki/WikiSidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { createWikiPage, slugify, type WikiPage } from "@/lib/wikiRepo";
import { useWikiPages } from "@/lib/wikiStore";
import { useAuth, getPrimaryRole } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/wiki")({
  component: WikiLayout,
});

function WikiLayout() {
  const { roles, user } = useAuth();
  const role = getPrimaryRole(roles);
  const isTaMaster = role === "ta_master" || role === "ta_staff";
  const navigate = useNavigate();
  const { pages, reload } = useWikiPages();
  const [newOpen, setNewOpen] = useState(false);

  return (
    <AppShell>
      <div className="-mx-6 -my-8 flex min-h-[calc(100vh-70px)]">
        <WikiSidebar pages={pages} />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl px-8 py-8">
            {isTaMaster && (
              <div className="mb-6 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova página
                </Button>
              </div>
            )}
            <Outlet />
          </div>
        </div>
      </div>

      <NewPageDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        pages={pages}
        userId={user?.id ?? null}
        onCreated={async (slug) => {
          await reload();
          navigate({ to: "/wiki/$slug", params: { slug } });
        }}
      />
    </AppShell>
  );
}

function NewPageDialog({
  open, onOpenChange, pages, userId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pages: WikiPage[];
  userId: string | null;
  onCreated: (slug: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const base = slugify(title);
      const existing = new Set(pages.map((p) => p.slug));
      let candidate = base;
      let i = 2;
      while (existing.has(candidate)) candidate = `${base}-${i++}`;
      await createWikiPage({
        title: title.trim(),
        slug: candidate,
        parent_id: parentId || null,
        module_key: null,
        userId,
      });
      toast.success("Página criada");
      onOpenChange(false);
      setTitle("");
      setParentId("");
      onCreated(candidate);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar página");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova página</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" autoFocus />
          </div>
          <div>
            <Label className="text-xs">Página pai (opcional)</Label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— Raiz —</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !title.trim()}>
            {saving ? "Criando..." : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
