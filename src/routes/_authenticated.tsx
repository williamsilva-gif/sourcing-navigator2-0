import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const redirectTo = location.href && location.href !== "/login" ? location.href : "/";
      throw redirect({ to: "/login", search: { redirect: redirectTo } });
    }
    // Force password setup if the user was invited and never created one
    const meta = data.session.user.user_metadata ?? {};
    if (meta.must_set_password === true && location.pathname !== "/set-password") {
      throw redirect({ to: "/set-password" });
    }
  },
  component: () => <Outlet />,
});
