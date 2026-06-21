import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth, getPrimaryRole } from "./useAuth";
import { getMyEffectiveAccessFn } from "@/lib/userAccess.functions";

interface AccessMaps {
  modules: Record<string, boolean>;
  features: Record<string, boolean>;
  ready: boolean;
  isTa: boolean;
}

const empty: AccessMaps = { modules: {}, features: {}, ready: false, isTa: false };

/**
 * Returns the effective modules/features for the signed-in user against
 * their primary tenant. TA master/staff get unrestricted access (everything true).
 */
export function useEffectiveAccess(): AccessMaps {
  const { user, roles, ready } = useAuth();
  const primary = getPrimaryRole(roles);
  const isTa = primary === "ta_master" || primary === "ta_staff";
  const tenantId = roles[0]?.tenant_id ?? null;
  const fn = useServerFn(getMyEffectiveAccessFn);
  const [state, setState] = useState<AccessMaps>(empty);

  useEffect(() => {
    if (!ready || !user) {
      setState(empty);
      return;
    }
    if (isTa) {
      setState({ modules: {}, features: {}, ready: true, isTa: true });
      return;
    }
    if (!tenantId) {
      setState({ ...empty, ready: true });
      return;
    }
    let cancelled = false;
    fn({ data: { tenantId } })
      .then((r) => {
        if (cancelled) return;
        setState({ modules: r.modules, features: r.features, ready: true, isTa: false });
      })
      .catch(() => {
        if (!cancelled) setState({ modules: {}, features: {}, ready: true, isTa: false });
      });
    return () => {
      cancelled = true;
    };
  }, [ready, user?.id, tenantId, isTa, fn]);

  return state;
}

/** Module enabled for current user. TA = always true. Unknown = true (default-on). */
export function useEffectiveModule(key: string): boolean {
  const acc = useEffectiveAccess();
  if (acc.isTa) return true;
  const v = acc.modules[key];
  return v === undefined ? true : v;
}

/** Feature enabled for current user. TA = always true. Unknown = true. */
export function useEffectiveFeature(key: string): boolean {
  const acc = useEffectiveAccess();
  if (acc.isTa) return true;
  const v = acc.features[key];
  return v === undefined ? true : v;
}
