import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_proximityAuthenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
    const role = await supabase.rpc("is_ta_master", { _user_id: data.user.id });
    if (role.error || !role.data) throw new Error("Acesso restrito a TA master/staff.");
  },
  component: () => <Outlet />,
});
