import { useAuth, getPrimaryRole } from "@/hooks/useAuth";
import { useEffectiveFeature } from "@/hooks/useEffectiveAccess";
import { useAppConfigStore, useActiveClientId, TA_WORKSPACE_ID } from "@/lib/appConfigStore";

/**
 * Returns whether `key` is enabled for the current context.
 * - TA editing a client (impersonating): reads from the local TA config store.
 * - TA in own workspace: always true.
 * - Tenant user: reads server-side effective access (user overrides → client template).
 */
export function useFeatureEnabled(key: string): boolean {
  const { roles } = useAuth();
  const primary = getPrimaryRole(roles);
  const isTa = primary === "ta_master" || primary === "ta_staff";
  const clientId = useActiveClientId();
  const localFlag = useAppConfigStore((s) => {
    const cfg = s.configByClient[clientId];
    if (!cfg?.features) return true;
    const v = cfg.features[key];
    return v === undefined ? true : v;
  });
  const effective = useEffectiveFeature(key);
  if (isTa) {
    // TA in own workspace = unrestricted; impersonating a client = local TA store
    return clientId === TA_WORKSPACE_ID ? true : localFlag;
  }
  return effective;
}

