import { useEffect, useRef } from "react";
import { useDecisionStore, type AlertType, type AlertSeverity } from "@/lib/decisionStore";
import type { CriticalAlert } from "@/components/dashboard/decisionData";

function typeFromAlertId(id: string): AlertType {
  if (id.endsWith("-adr")) return "ADR_VARIANCE";
  if (id.endsWith("-leak") || id.includes("leak")) return "SMART_LEAKAGE";
  if (id.endsWith("-comp")) return "SAVINGS_MISSED";
  if (id.endsWith("-conc")) return "HOTEL_DEPENDENCY";
  return "SAVINGS_MISSED";
}

function cityFromAlertId(id: string): string | null {
  // pattern: alert-{city}-suffix or alert-leak-global
  const parts = id.split("-");
  if (parts.length < 3) return null;
  const suffix = parts[parts.length - 1];
  const middle = parts.slice(1, -1).join("-");
  if (middle === "leak" && suffix === "global") return null;
  return middle || null;
}

/** Auto-hydrate decisionStore and persist derived alerts whenever they change. */
export function useDecisionHydration(
  clientTenantId: string | null | undefined,
  derivedAlerts: CriticalAlert[],
) {
  const hydrate = useDecisionStore((s) => s.hydrate);
  const upsertDerivedAlerts = useDecisionStore((s) => s.upsertDerivedAlerts);
  const hydratedForTenant = useDecisionStore((s) => s.hydratedForTenant);

  // Hydrate once per tenant
  useEffect(() => {
    if (!clientTenantId) return;
    if (hydratedForTenant === clientTenantId) return;
    void hydrate(clientTenantId);
  }, [clientTenantId, hydratedForTenant, hydrate]);

  // Persist derived alerts — debounced via signature dedupe in the engine
  const lastSyncedSignatureRef = useRef<string>("");
  useEffect(() => {
    if (!clientTenantId) return;
    if (hydratedForTenant !== clientTenantId) return;
    if (derivedAlerts.length === 0) return;

    // Build a stable cache key so we don't re-upsert identical lists
    const signature = derivedAlerts
      .map((a) => `${a.id}:${a.severity}`)
      .sort()
      .join("|");
    if (signature === lastSyncedSignatureRef.current) return;
    lastSyncedSignatureRef.current = signature;

    void upsertDerivedAlerts(
      clientTenantId,
      derivedAlerts.map((a) => ({
        signature: a.id,
        type: typeFromAlertId(a.id),
        severity: a.severity as AlertSeverity,
        title: a.title,
        description: a.description,
        impactedCity: cityFromAlertId(a.id),
        impactedHotel: null,
        financialImpact: 0,
        metadata: { metric: a.metric, opportunityId: a.opportunityId ?? null },
      })),
    );
  }, [clientTenantId, hydratedForTenant, derivedAlerts, upsertDerivedAlerts]);
}
