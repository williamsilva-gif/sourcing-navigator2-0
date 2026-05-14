import { createFileRoute, useOutletContext } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import type { WikiPage } from "@/lib/wikiRepo";

export const Route = createFileRoute("/wiki/")({
  component: WikiIndex,
});

function WikiIndex() {
  const { pages, isTaMaster } = useOutletContext<{ pages: WikiPage[]; isTaMaster: boolean }>();
  return (
    <div className="rounded-lg border border-border bg-card p-10 text-center">
      <BookOpen className="mx-auto h-10 w-10 text-primary" />
      <h1 className="mt-4 text-2xl font-semibold">Central de Documentação</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {pages.length === 0
          ? isTaMaster
            ? "Nenhuma página ainda. Clique em \"Nova página\" para começar."
            : "Documentação em construção."
          : "Selecione uma página no menu lateral."}
      </p>
    </div>
  );
}
