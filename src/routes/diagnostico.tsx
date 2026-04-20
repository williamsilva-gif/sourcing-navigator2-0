import { createFileRoute } from "@tanstack/react-router";
import { Stethoscope } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico — SourcingHub" },
      { name: "description", content: "Diagnóstico do programa de hotelaria corporativa." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      module="Diagnóstico"
      description="Heatmap geográfico de room nights, distribuição de ADR vs city caps e análise de baseline do programa."
      icon={Stethoscope}
    />
  ),
});