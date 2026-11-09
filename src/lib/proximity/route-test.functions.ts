import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runIsolatedRouteTest } from "./route-test";

export const isolatedRouteTestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc("is_ta_master", { _user_id: context.userId });
    return runIsolatedRouteTest({
      isMaster: !role.error && role.data === true,
      key: process.env["GOOGLE_MAPS_API_KEY"],
      auth: process.env["LOVABLE_API_KEY"],
      gateway: process.env["PROXIMITY_GOOGLE_GATEWAY"] === "true",
      request: fetch,
    });
  });
