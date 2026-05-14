import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "ta_master" | "ta_staff"
  | "tmc_admin" | "tmc_user"
  | "corp_admin" | "corp_user"
  | "hotel_admin" | "hotel_user";

export interface UserRoleRow {
  tenant_id: string;
  role: AppRole;
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roles: UserRoleRow[];
}

// ---------- Module-level singleton cache ----------
// Keeps auth state stable across component remounts so UI elements that depend
// on `roles` (e.g. the "TA Console" link) don't flicker every time a route
// re-mounts the Header.
let cached: AuthState = { session: null, user: null, loading: true, roles: [] };
const listeners = new Set<(s: AuthState) => void>();
let initialized = false;

function setCached(next: Partial<AuthState>) {
  cached = { ...cached, ...next };
  listeners.forEach((fn) => fn(cached));
}

async function loadRolesFor(uid: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("tenant_id, role")
    .eq("user_id", uid);
  setCached({ roles: (data ?? []) as UserRoleRow[] });
}

function ensureInit() {
  if (initialized) return;
  initialized = true;

  supabase.auth.onAuthStateChange((_event, sess) => {
    setCached({ session: sess, user: sess?.user ?? null });
    if (sess?.user) {
      // Defer DB query so we never call Supabase synchronously inside the listener
      setTimeout(() => loadRolesFor(sess.user.id), 0);
    } else {
      setCached({ roles: [] });
    }
  });

  supabase.auth.getSession().then(({ data }) => {
    setCached({ session: data.session, user: data.session?.user ?? null, loading: false });
    if (data.session?.user) loadRolesFor(data.session.user.id);
  });
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(cached);

  useEffect(() => {
    ensureInit();
    listeners.add(setState);
    // Sync once on mount in case state changed between render and effect
    setState(cached);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}

export function getPrimaryRole(roles: UserRoleRow[]): AppRole | null {
  if (!roles.length) return null;
  const order: AppRole[] = [
    "ta_master", "ta_staff",
    "tmc_admin", "tmc_user",
    "corp_admin", "corp_user",
    "hotel_admin", "hotel_user",
  ];
  for (const r of order) {
    if (roles.find((x) => x.role === r)) return r;
  }
  return roles[0].role;
}

export function landingForRole(role: AppRole | null): string {
  if (!role) return "/onboarding";
  if (role.startsWith("ta_")) return "/";
  if (role.startsWith("tmc_")) return "/";
  if (role.startsWith("corp_")) return "/";
  if (role.startsWith("hotel_")) return "/hotel/rfps";
  return "/";
}
