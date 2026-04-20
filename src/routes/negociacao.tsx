import { createFileRoute } from "@tanstack/react-router";
import { Handshake } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/negociacao")({
  head: () => ({ meta: [{ title: "Negociação — SourcingHub" }] }),
  component: () => (
    <ModulePlaceholder
      module="Negociação"
      description="Timeline visual de rodadas de negociação com hotéis e tracking de contraproposições."
      icon={Handshake}
    />
  ),
});