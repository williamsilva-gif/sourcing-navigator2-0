import { createFileRoute } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/estrategia")({
  head: () => ({ meta: [{ title: "Estratégia — SourcingHub" }] }),
  component: () => (
    <ModulePlaceholder
      module="Estratégia"
      description="Definição de tiering, city caps e estratégia de sourcing por mercado e cluster de hotéis."
      icon={Target}
    />
  ),
});