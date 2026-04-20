import { createFileRoute } from "@tanstack/react-router";
import { CheckSquare } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/selecao")({
  head: () => ({ meta: [{ title: "Seleção — SourcingHub" }] }),
  component: () => (
    <ModulePlaceholder
      module="Seleção"
      description="Hotel scoring matrix preço vs qualidade e seleção final do programa por mercado."
      icon={CheckSquare}
    />
  ),
});