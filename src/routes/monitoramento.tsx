import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/monitoramento")({
  head: () => ({ meta: [{ title: "Monitoramento — SourcingHub" }] }),
  component: () => (
    <ModulePlaceholder
      module="Monitoramento"
      description="ADR real vs negociado, treemap de leakage por categoria e alertas de não-conformidade."
      icon={Activity}
    />
  ),
});