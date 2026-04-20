import { createFileRoute } from "@tanstack/react-router";
import { DollarSign } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/monetizacao")({
  head: () => ({ meta: [{ title: "Monetização — SourcingHub" }] }),
  component: () => (
    <ModulePlaceholder
      module="Monetização"
      description="Waterfall chart dos savings calculados e projeção mensal de success fees."
      icon={DollarSign}
    />
  ),
});