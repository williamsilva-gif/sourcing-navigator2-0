import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/rfp")({
  head: () => ({
    meta: [
      { title: "RFP — SourcingHub" },
      { name: "description", content: "Criação multi-etapa de RFPs, distribuição para hotéis e gestão centralizada de respostas." },
    ],
  }),
});
