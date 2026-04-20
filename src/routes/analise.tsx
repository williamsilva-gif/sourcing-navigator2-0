import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/analise")({
  head: () => ({ meta: [{ title: "Análise — SourcingHub" }] }),
  component: () => (
    <ModulePlaceholder
      module="Análise"
      description="Tabelas avançadas comparativas, scoring de hotéis e drill-down em respostas de RFP."
      icon={BarChart3}
    />
  ),
});