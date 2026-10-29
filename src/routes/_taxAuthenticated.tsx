import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';

// Isolated client-side gate: the legacy authenticated parent runs during SSR.
// Do not change that parent or any existing module to add this new module.
export const Route = createFileRoute('/_taxAuthenticated')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: '/login', search: { redirect: location.href } });
    if (data.user.user_metadata?.must_set_password === true) throw redirect({ to: '/set-password' });
  },
  component: () => <Outlet />,
});
