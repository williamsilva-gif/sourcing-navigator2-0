import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Export all data the server holds about the authenticated user.
export const exportMyDataFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profile, roles, consents, deletionReq, hotelMembers] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("*").eq("user_id", userId),
      supabase
        .from("consent_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("account_deletion_requests").select("*").eq("user_id", userId),
      supabase.from("hotel_members").select("*").eq("user_id", userId),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      userId,
      profile: profile.data ?? null,
      roles: roles.data ?? [],
      consents: consents.data ?? [],
      deletionRequests: deletionReq.data ?? [],
      hotelMemberships: hotelMembers.data ?? [],
    };
  });

// Request account deletion. Trigger blocks ta_master accounts at the DB layer.
export const requestAccountDeletionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reason?: string }) => ({
    reason: typeof input?.reason === "string" ? input.reason.slice(0, 500) : null,
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("account_deletion_requests").insert({
      user_id: userId,
      reason: data.reason,
      status: "pending",
    });
    if (error) {
      // surface the trigger's plain message for ta_master
      throw new Error(error.message);
    }
    return { ok: true };
  });
