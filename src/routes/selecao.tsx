import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/selecao")({
  head: () => ({
    meta: [
      { title: "Seleção — SourcingHub" },
      { name: "description", content: "Programa anual consolidado com matriz de hotéis selecionados, cobertura geográfica e exportação para PDF/Excel." },
    ],
  }),
});
