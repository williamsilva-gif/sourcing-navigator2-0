import { useMemo, useState } from "react";
import {
  MapPin,
  ChevronDown,
  ChevronUp,
  Send,
  Mail,
  XCircle,
  Check,
  AlertTriangle,
  Building2,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";
import { useBaselineStore } from "@/lib/baselineStore";
import { useClientsStore } from "@/lib/clientsStore";
import { useDecisionStore } from "@/lib/decisionStore";
import { filterByWindow, type PeriodWindow } from "@/lib/periodFilter";
import {
  computeDistanceLeakage,
  distanceLeakageSignature,
  DEFAULT_LEAKAGE_RADIUS_M,
  type CityLeakageGroup,
} from "@/lib/distanceLeakageAnalysis";
import { fmtUsd } from "@/components/dashboard/decisionData";

interface Props {
  window: PeriodWindow | null;
}

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function fmtDist(m: number | null) {
  if (m == null) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function fmtPct(v: number) {
  return `${v.toFixed(1)}%`;
}

export function SmartLeakageCard({ window }: Props) {
  const allBookings = useBaselineStore((s) => s.bookings);
  const contracts = useBaselineStore((s) => s.contracts);
  const hotels = useBaselineStore((s) => s.hotels);
  const clientTenantId = useClientsStore((s) => s.selectedClientId);

  const bookings = useMemo(
    () => (window ? filterByWindow(allBookings, window) : allBookings),
    [allBookings, window],
  );

  const summary = useMemo(
    () => computeDistanceLeakage(bookings, contracts, hotels, DEFAULT_LEAKAGE_RADIUS_M),
    [bookings, contracts, hotels],
  );

  const persistedAlerts = useDecisionStore((s) => s.alerts);
  const actions = useDecisionStore((s) => s.actions);
  const upsertDerivedAlerts = useDecisionStore((s) => s.upsertDerivedAlerts);
  const createAction = useDecisionStore((s) => s.createAction);
  const setAlertStatus = useDecisionStore((s) => s.setAlertStatus);

  const periodLabel = window?.label ?? "all";

  const persistedBySig = useMemo(() => {
    const m = new Map<string, (typeof persistedAlerts)[number]>();
    persistedAlerts.forEach((a) => m.set(a.signature, a));
    return m;
  }, [persistedAlerts]);

  const openActionByAlert = useMemo(() => {
    const m = new Map<string, (typeof actions)[number]>();
    actions.forEach((a) => {
      if (a.alert_id && a.status !== "COMPLETED" && a.status !== "IGNORED")
        m.set(a.alert_id, a);
    });
    return m;
  }, [actions]);

  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [openCity, setOpenCity] = useState<string | null>(null);

  const sendAlert = async (
    group: CityLeakageGroup,
    variant: "account" | "hotel",
    targetHotel?: string,
    contact?: string | null,
  ) => {
    if (!clientTenantId) {
      toast.error("Selecione um cliente para enviar alertas.");
      return;
    }
    // CRITICAL: alerts to hotels must only be sent to contracted hotels.
    if (variant === "hotel") {
      const contracted = new Set(contracts.map((c) => c.hotel.trim().toLowerCase()));
      if (!targetHotel || !contracted.has(targetHotel.trim().toLowerCase())) {
        toast.error("Só é possível alertar hotéis contratados.");
        return;
      }
    }
    const sig = distanceLeakageSignature(periodLabel, group.city, variant, targetHotel);
    setBusy(sig);
    try {
      await upsertDerivedAlerts(clientTenantId, [
        {
          signature: sig,
          type: "SMART_LEAKAGE",
          severity: group.severity === "ok" ? "low" : group.severity,
          title:
            variant === "account"
              ? `Leakage ${fmtPct(group.leakagePct)} em ${group.city} — acionar Account Manager`
              : `Leakage ${fmtPct(group.leakagePct)} em ${group.city} — acionar ${targetHotel}`,
          description: `${group.leakedRows.length} hotéis fora da diretoria em ${group.city} dentro de ${(DEFAULT_LEAKAGE_RADIUS_M / 1000).toFixed(1)} km. Savings perdidos estimados: ${fmtUsd(group.missedSavings)}.`,
          impactedCity: group.city,
          impactedHotel: targetHotel ?? group.referenceContractedHotel,
          financialImpact: group.missedSavings,
          metadata: {
            radiusM: DEFAULT_LEAKAGE_RADIUS_M,
            leakedRoomNights: group.leakedRoomNights,
            totalRoomNights: group.totalRoomNights,
            leakagePct: group.leakagePct,
            leakedRows: group.leakedRows,
            referenceContractedHotel: group.referenceContractedHotel,
            variant,
            targetHotel: targetHotel ?? null,
            periodLabel,
          },
        },
      ]);

      const persisted = useDecisionStore.getState().alerts.find((a) => a.signature === sig);
      if (!persisted) {
        toast.error("Não foi possível registrar o alerta.");
        return;
      }

      const subject =
        variant === "account"
          ? `Leakage de ${fmtPct(group.leakagePct)} em ${group.city} — ação requerida`
          : `Revisão de disponibilidade em ${targetHotel} — ${group.city}`;

      const body =
        variant === "account"
          ? `Olá,\n\nIdentificamos ${group.leakedRows.length} hotéis fora da diretoria em ${group.city} ` +
            `dentro de um raio de ${(DEFAULT_LEAKAGE_RADIUS_M / 1000).toFixed(1)} km de hotéis contratados.\n\n` +
            `Métricas:\n- Leakage: ${fmtPct(group.leakagePct)} (${group.leakedRoomNights}/${group.totalRoomNights} room nights)\n` +
            `- Savings perdidos estimados: ${fmtUsd(group.missedSavings)}\n` +
            `- Hotel contratado de referência: ${group.referenceContractedHotel ?? "n/d"}\n\n` +
            `Use o link de resposta para confirmar revisão de política, comentar e anexar evidências.`
          : `Olá,\n\nDetectamos reservas fora da diretoria em ${group.city} dentro de ${(DEFAULT_LEAKAGE_RADIUS_M / 1000).toFixed(1)} km de ${targetHotel}.\n\n` +
            `Solicitamos:\n` +
            `1) Confirmação de que a tarifa contratada está carregada em todos os canais\n` +
            `2) Confirmação de disponibilidade (LRA) nas datas em análise\n` +
            `3) Plano de captura das reservas vazadas\n\n` +
            `Use o link de resposta para comentar e anexar evidências.`;

      await createAction({
        clientTenantId,
        alertId: persisted.id,
        type: variant === "account" ? "SEND_ALERT" : "FOLLOW_UP",
        status: "SENT",
        emailRecipients: contact ? [contact] : undefined,
        payload: {
          variant,
          targetHotel: targetHotel ?? null,
          city: group.city,
          leakagePct: group.leakagePct,
          missedSavings: group.missedSavings,
          leakedRows: group.leakedRows,
          referenceContractedHotel: group.referenceContractedHotel,
          radiusM: DEFAULT_LEAKAGE_RADIUS_M,
          periodLabel,
          emailTemplate: { subject, body, to: contact ?? null },
        },
      });
      toast.success(
        variant === "account"
          ? `Alerta enviado ao Account Manager — ${group.city}`
          : `Alerta enviado a ${targetHotel}`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Falha ao enviar alerta.");
    } finally {
      setBusy(null);
    }
  };

  const ignoreCity = async (group: CityLeakageGroup) => {
    if (!clientTenantId) return;
    const sigs = [
      distanceLeakageSignature(periodLabel, group.city, "account"),
      ...group.nearbyUnusedContracted.map((n) =>
        distanceLeakageSignature(periodLabel, group.city, "hotel", n.hotel),
      ),
    ];
    setBusy(sigs[0]);
    try {
      for (const sig of sigs) {
        const persisted = persistedBySig.get(sig);
        if (persisted) await setAlertStatus(persisted.id, "dismissed");
      }
      toast.success(`${group.city} arquivado.`);
    } finally {
      setBusy(null);
    }
  };

  if (bookings.length === 0 || contracts.length === 0 || hotels.length === 0) return null;
  if (summary.groups.length === 0) return null;

  const tone =
    summary.totalLeakagePct >= 25
      ? "text-destructive"
      : summary.totalLeakagePct >= 10
        ? "text-warning-foreground"
        : "text-info";

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              Leakage inteligente por distância
            </h2>
            {summary.flaggedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
                <AlertTriangle className="h-3 w-3" />
                {summary.flaggedCount}{" "}
                {summary.flaggedCount === 1 ? "cidade afetada" : "cidades afetadas"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Reservas fora da diretoria dentro de{" "}
            {(DEFAULT_LEAKAGE_RADIUS_M / 1000).toFixed(1)} km de hotéis contratados.
          </p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex h-8 items-center gap-1 rounded-md border border-input bg-card px-2.5 text-xs font-semibold text-foreground hover:border-primary/40"
        >
          {expanded ? "Recolher" : "Detalhes"}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCell
          label="Leakage geral"
          value={<span className={tone}>{fmtPct(summary.totalLeakagePct)}</span>}
        />
        <SummaryCell
          label="Savings perdidos estimados"
          value={fmtUsd(summary.totalMissedSavings)}
        />
        <SummaryCell label="Cidade mais impactada" value={summary.topCity ?? "—"} />
      </div>

      {expanded && (
        <div className="mt-5 space-y-2">
          {summary.groups.map((g) => {
            const isOpen = openCity === g.city;
            const accountSig = distanceLeakageSignature(periodLabel, g.city, "account");
            const accountAlert = persistedBySig.get(accountSig);
            const accountTracked = accountAlert
              ? openActionByAlert.has(accountAlert.id)
              : false;
            return (
              <div
                key={g.city}
                className="overflow-hidden rounded-md border border-border"
              >
                <button
                  onClick={() => setOpenCity(isOpen ? null : g.city)}
                  className="flex w-full items-center justify-between gap-3 bg-muted/30 px-3 py-2 text-left hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">{g.city}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        g.severity === "high"
                          ? "bg-destructive-soft text-destructive"
                          : g.severity === "medium"
                            ? "bg-warning-soft text-warning-foreground"
                            : g.severity === "low"
                              ? "bg-info-soft text-info"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {fmtPct(g.leakagePct)} leakage
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{g.leakedRows.length} hotéis vazados</span>
                    <span className="font-semibold text-foreground">
                      {fmtUsd(g.missedSavings)}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-border bg-background/40 p-4">
                    {/* Reference contracted hotel */}
                    <div className="flex items-start gap-2 rounded-md border border-border bg-card p-3 text-xs">
                      <Building2 className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-semibold uppercase tracking-wider text-muted-foreground">
                          Hotel contratado de referência
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">
                          {g.referenceContractedHotel ?? "Nenhum hotel contratado com uso em " + g.city}
                        </p>
                        {g.referenceContractedHotelContact && (
                          <p className="text-muted-foreground">
                            Contato: {g.referenceContractedHotelContact}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Leaked bookings (outside directory) */}
                    {g.leakedRows.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Hotéis fora da diretoria
                        </p>
                        <div className="overflow-hidden rounded-md border border-border">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/40 uppercase tracking-wider text-muted-foreground">
                              <tr>
                                <th className="px-2 py-1.5 text-left font-semibold">Hotel</th>
                                <th className="px-2 py-1.5 text-right font-semibold">ADR</th>
                                <th className="px-2 py-1.5 text-right font-semibold">RN</th>
                                <th className="px-2 py-1.5 text-left font-semibold">
                                  Mais próximo (contratado)
                                </th>
                                <th className="px-2 py-1.5 text-right font-semibold">Dist.</th>
                                <th className="px-2 py-1.5 text-right font-semibold">
                                  Savings perdidos
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.leakedRows.map((r) => (
                                <tr key={r.hotel} className="border-t border-border">
                                  <td className="px-2 py-1.5 font-medium text-foreground">
                                    {r.hotel}
                                  </td>
                                  <td className="px-2 py-1.5 text-right">{fmtBrl(r.realizedAdr)}</td>
                                  <td className="px-2 py-1.5 text-right text-muted-foreground">
                                    {r.roomNights}
                                  </td>
                                  <td className="px-2 py-1.5 text-muted-foreground">
                                    {r.nearestContractedHotel ?? "—"}
                                  </td>
                                  <td className="px-2 py-1.5 text-right text-muted-foreground">
                                    {fmtDist(r.nearestDistanceM)}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-semibold text-destructive">
                                    {fmtUsd(r.missedSavings)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Nearby unused contracted hotels */}
                    {g.nearbyUnusedContracted.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Hotéis contratados próximos sem uso
                        </p>
                        <div className="space-y-1.5">
                          {g.nearbyUnusedContracted.map((n) => {
                            const sig = distanceLeakageSignature(
                              periodLabel,
                              g.city,
                              "hotel",
                              n.hotel,
                            );
                            const persisted = persistedBySig.get(sig);
                            const tracked = persisted
                              ? openActionByAlert.has(persisted.id)
                              : false;
                            return (
                              <div
                                key={n.hotel}
                                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-xs"
                              >
                                <div className="flex items-start gap-2">
                                  <Navigation className="mt-0.5 h-3.5 w-3.5 text-info" />
                                  <div>
                                    <p className="font-medium text-foreground">{n.hotel}</p>
                                    <p className="text-muted-foreground">
                                      {fmtDist(n.distanceM)} · ADR negociado{" "}
                                      {fmtBrl(n.negotiatedAdr)}
                                      {n.contact ? ` · ${n.contact}` : ""}
                                    </p>
                                  </div>
                                </div>
                                {tracked ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
                                    <Check className="h-3 w-3" /> Na Watchlist
                                  </span>
                                ) : (
                                  <button
                                    onClick={() =>
                                      sendAlert(g, "hotel", n.hotel, n.contact || null)
                                    }
                                    disabled={busy === sig}
                                    className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-semibold text-foreground hover:border-primary/40 disabled:opacity-40"
                                  >
                                    <Mail className="h-3 w-3" />
                                    Alertar hotel
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* City-level actions */}
                    <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                      {accountTracked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
                          <Check className="h-3 w-3" /> AM na Watchlist
                        </span>
                      ) : (
                        <button
                          onClick={() => sendAlert(g, "account")}
                          disabled={busy === accountSig}
                          className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-semibold text-foreground hover:border-primary/40 disabled:opacity-40"
                        >
                          <Send className="h-3 w-3" />
                          Alertar Account Manager
                        </button>
                      )}
                      <button
                        onClick={() => ignoreCity(g)}
                        disabled={busy !== null}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
                      >
                        <XCircle className="h-3 w-3" />
                        Ignorar cidade
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SummaryCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}
