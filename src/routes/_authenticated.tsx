import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const redirectTo = location.href && location.href !== "/login" ? location.href : "/";
      throw redirect({ to: "/login", search: { redirect: redirectTo } });
    }
  },
  component: () => <Outlet />,
});
