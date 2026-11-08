import { createFileRoute } from "@tanstack/react-router";
import { ProximityPage } from "@/components/proximity/ProximityPage";
export const Route = createFileRoute("/_proximityAuthenticated/raio-proximidade")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Raio & Proximidade — Navigator" },
      {
        name: "description",
        content:
          "Raio de hotéis e unidades e geolocalização independente de planilhas, com originais privados, validação e resultados auditáveis.",
      },
      { property: "og:title", content: "Raio & Proximidade — Navigator" },
      {
        property: "og:description",
        content:
          "Raio e geolocalização independente de planilhas com endereços originais preservados e resultados auditáveis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProximityPage,
});
