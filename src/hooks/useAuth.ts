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

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        // Defer DB query — never call Supabase inside the listener directly
        setTimeout(() => loadRoles(sess.user.id), 0);
      } else {
        setRoles([]);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadRoles(data.session.user.id);
      setLoading(false);
    });

    async function loadRoles(uid: string) {
      const { data } = await supabase
        .from("user_roles")
        .select("tenant_id, role")
        .eq("user_id", uid);
      setRoles((data ?? []) as UserRoleRow[]);
    }

    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading, roles };
}

export function getPrimaryRole(roles: UserRoleRow[]): AppRole | null {
  if (!roles.length) return null;
  // Priority order
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
