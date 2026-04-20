import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/rfp")({
  head: () => ({ meta: [{ title: "RFP — SourcingHub" }] }),
  component: () => (
    <ModulePlaceholder
      module="RFP"
      description="Criação multi-etapa de RFPs, distribuição para hotéis e gestão de respostas."
      icon={FileText}
    />
  ),
});