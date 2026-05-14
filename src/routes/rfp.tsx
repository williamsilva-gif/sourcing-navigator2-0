import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  city: z.string().optional(),
  suggestedCap: z.coerce.number().optional(),
  openWizard: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/rfp")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "RFP — SourcingHub" },
      { name: "description", content: "Criação multi-etapa de RFPs, distribuição para hotéis e gestão centralizada de respostas." },
    ],
  }),
});
