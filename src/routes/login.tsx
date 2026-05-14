import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Hotel, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPrimaryRole, landingForRole } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "",
  }),
  head: () => ({ meta: [{ title: "Entrar — Navigator Sourcing CoPilot" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    // Load roles to decide landing
    const { data: roles } = await supabase
      .from("user_roles")
      .select("tenant_id, role")
      .eq("user_id", data.user!.id);
    const primary = getPrimaryRole((roles ?? []) as { tenant_id: string; role: import("@/hooks/useAuth").AppRole }[]);
    const dest = search.redirect || landingForRole(primary);
    toast.success("Bem-vindo!");
    navigate({ to: dest });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Hotel className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Navigator</p>
            <p className="text-[11px] text-muted-foreground">Sourcing CoPilot</p>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-foreground">Entrar na sua conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesso para Travel Academy, TMCs, Clientes e Hotéis.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="voce@empresa.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Novo por aqui?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
