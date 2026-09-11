import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { CampaignsPanel } from "@/components/implementacao/CampaignsPanel";
import { PortalConnectionsPanel } from "@/components/implementacao/PortalConnectionsPanel";
import { useActiveClientId, TA_WORKSPACE_ID } from "@/lib/appConfigStore";
import {
  useEligibleHotels,
  useEntitlement,
  useRateLoadingMutations,
  useRateLoadingOverview,
} from "@/lib/rateLoadingHooks";

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent>}
    </Card>
  );
}

function RateLoadingHub() {
  const tenantId = useActiveClientId();
  const isTaWorkspace = tenantId === TA_WORKSPACE_ID;
  const { data: overview } = useRateLoadingOverview(tenantId);
  const { data: entitlement } = useEntitlement(tenantId);
  const { data: hotels = [] } = useEligibleHotels(tenantId);
  const m = useRateLoadingMutations(tenantId);

  if (isTaWorkspace) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Implementação</CardTitle>
            <CardDescription>
              Selecione um cliente no topo da tela para verificar o carregamento de tarifas.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const pending = hotels.filter((h) => !h.eligible);
  const quotaText =
    entitlement?.usageMode === "unlimited"
      ? "Ilimitado"
      : entitlement?.usageMode === "limited"
        ? `${entitlement.used} de ${(entitlement.quotaLimit ?? 0) + entitlement.bonusUnits}`
        : "Desativado";

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Implementação</h1>
        <p className="text-sm text-muted-foreground">
          Verificação de carregamento de tarifas: compara o acordo final com o que o portal realmente exibe.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="checks">Verificações</TabsTrigger>
          <TabsTrigger value="connections">Portais</TabsTrigger>
          <TabsTrigger value="pending">Pendências ({pending.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Kpi
              label="Conformidade"
              value={`${overview?.compliance ?? 0}%`}
              hint={`${overview?.loadedCorrectly ?? 0} de ${overview?.completedBusinessChecks ?? 0} verificações`}
            />
            <Kpi label="Com divergência" value={overview?.loadedWithMismatch ?? 0} />
            <Kpi label="Não carregadas" value={overview?.notLoaded ?? 0} />
            <Kpi
              label="Franquia"
              value={quotaText}
              hint={entitlement?.nextReset ? `Renova em ${new Date(entitlement.nextReset).toLocaleDateString("pt-BR")}` : undefined}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cobertura do programa</CardTitle>
              <CardDescription>
                {overview?.hotelsChecked ?? 0} hotéis já verificados · {overview?.evidenceCount ?? 0} evidências
                armazenadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={overview?.compliance ?? 0} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checks">
          <CampaignsPanel tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="connections">
          <PortalConnectionsPanel tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Hotéis sem acordo final completo</CardTitle>
                <CardDescription>
                  A verificação só roda com tarifa, moeda, vigência e base tarifária registradas.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  m.deriveTerms
                    .mutateAsync({ tenantId })
                    .then((r) => toast.success(`${r.created} acordos gerados a partir do programa fechado.`))
                    .catch((e) => toast.error((e as Error).message))
                }
              >
                Gerar a partir do programa fechado
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {pending.length === 0 && (
                <p className="text-sm text-muted-foreground">Todos os hotéis estão prontos para verificação.</p>
              )}
              {pending.map((h) => (
                <div key={h.awardedProgramId} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{h.hotelName}</p>
                    <p className="text-xs text-muted-foreground">{h.city}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{h.reasons.join(", ")}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const Route = createFileRoute("/implementacao")({
  head: () => ({
    meta: [
      { title: "Implementação — Verificação de carregamento de tarifas | SourcingHub" },
      {
        name: "description",
        content:
          "Verifique se as tarifas negociadas estão carregadas corretamente nos portais, com evidência auditável por hotel.",
      },
      { property: "og:title", content: "Implementação — Verificação de carregamento de tarifas" },
      {
        property: "og:description",
        content: "Compare o acordo final com o que o portal exibe e acompanhe a conformidade do programa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RateLoadingHub,
});
