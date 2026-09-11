import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewCampaignDialog } from "@/components/implementacao/NewCampaignDialog";
import { ResultBadge } from "@/components/implementacao/ResultBadge";
import { useCampaignDetail, useCampaigns, useRateLoadingMutations } from "@/lib/rateLoadingHooks";

function CampaignDetail({ campaignId, tenantId }: { campaignId: string; tenantId: string }) {
  const { data, isLoading } = useCampaignDetail(campaignId);
  const m = useRateLoadingMutations(tenantId);
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            m.rerun
              .mutateAsync({ tenantId, campaignId, failuresOnly: true })
              .then((r) => toast.success(`${r.queued} verificações reenfileiradas.`))
              .catch((e) => toast.error((e as Error).message))
          }
        >
          Reexecutar apenas falhas
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hotel</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Esperado</TableHead>
            <TableHead>Encontrado</TableHead>
            <TableHead>Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.checks.map((c) => {
            const attempt = data.attempts.find((a) => a.check_id === c.id);
            const offer = attempt?.found_offer as { currency?: string; rate_amount?: number } | null;
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.hotel_name}
                  <div className="text-xs text-muted-foreground">{c.city}</div>
                </TableCell>
                <TableCell className="text-xs">
                  {c.check_in} → {c.check_out}
                </TableCell>
                <TableCell className="text-sm">
                  {c.expected_currency} {Number(c.expected_rate_amount ?? 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-sm">
                  {offer?.rate_amount != null ? `${offer.currency} ${offer.rate_amount.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell>
                  <ResultBadge code={c.latest_result_code} />
                  {attempt?.result_summary && (
                    <div className="mt-1 max-w-xs text-xs text-muted-foreground">{attempt.result_summary}</div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function CampaignsPanel({ tenantId }: { tenantId: string }) {
  const { data: campaigns = [], isLoading } = useCampaigns(tenantId);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Verificações</CardTitle>
          <CardDescription>Cada execução gera evidência auditável por hotel.</CardDescription>
        </div>
        <NewCampaignDialog tenantId={tenantId} />
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && campaigns.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma verificação executada até agora.</p>
        )}
        {campaigns.map((c) => (
          <button
            key={c.id}
            onClick={() => setOpenId(c.id)}
            className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.name}</span>
                <Badge variant="secondary">{c.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {c.completedChecks}/{c.totalChecks} concluídas
                {c.lastRun ? ` · última execução ${new Date(c.lastRun).toLocaleString("pt-BR")}` : ""}
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="text-emerald-600">{c.passed} ok</span>
              <span className="text-amber-600">{c.mismatch} divergentes</span>
              <span className="text-destructive">{c.notLoaded} não carregadas</span>
              <span className="text-muted-foreground">{c.technicalErrors} erros</span>
            </div>
          </button>
        ))}
      </CardContent>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Detalhe da verificação</SheetTitle>
            <SheetDescription>Comparação entre o acordo final e o que o portal exibiu.</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {openId && <CampaignDetail campaignId={openId} tenantId={tenantId} />}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
