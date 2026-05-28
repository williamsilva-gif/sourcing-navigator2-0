import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/selecao")({
  head: () => ({
    meta: [
      { title: "Diretório de Hotéis — SourcingHub" },
      { name: "description", content: "Diretório consolidado com a matriz de hotéis contratados, cobertura geográfica e exportação para PDF/Excel." },
    ],
  }),
});
