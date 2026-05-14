import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { useWikiPages } from "@/lib/wikiStore";
import { useAuth, getPrimaryRole } from "@/hooks/useAuth";

export const Route = createFileRoute("/wiki/")({
  component: WikiIndex,
});

function WikiIndex() {
  const { pages } = useWikiPages();
  const { roles } = useAuth();
  const role = getPrimaryRole(roles);
  const isTaMaster = role === "ta_master" || role === "ta_staff";
  return (
    <div className="rounded-lg border border-border bg-card p-10 text-center">
      <BookOpen className="mx-auto h-10 w-10 text-primary" />
      <h1 className="mt-4 text-2xl font-semibold">Central de Documentação</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {pages.length === 0
          ? isTaMaster
            ? 'Nenhuma página ainda. Clique em "Nova página" para começar.'
            : "Documentação em construção."
          : "Selecione uma página no menu lateral."}
      </p>
    </div>
  );
}
