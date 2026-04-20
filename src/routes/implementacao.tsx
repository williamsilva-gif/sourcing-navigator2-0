import { createFileRoute } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/implementacao")({
  head: () => ({ meta: [{ title: "Implementação — SourcingHub" }] }),
  component: () => (
    <ModulePlaceholder
      module="Implementação"
      description="Checklist interativo de loading de tarifas em GDS, OBT e validação por hotel."
      icon={Rocket}
    />
  ),
});