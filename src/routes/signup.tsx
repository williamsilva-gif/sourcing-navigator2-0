import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Hotel, Building2, Briefcase, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Cadastro — Navigator Sourcing CoPilot" }] }),
  component: SignupPage,
});

type AccountType = "HOTEL" | "TMC" | "CORP";

const ACCOUNT_OPTIONS: { value: AccountType; label: string; desc: string; icon: typeof Hotel }[] = [
  { value: "HOTEL", label: "Hotel", desc: "Receber RFPs e participar de leilões", icon: Hotel },
  { value: "TMC", label: "TMC", desc: "Travel Management Company", icon: Briefcase },
  { value: "CORP", label: "Cliente Corporativo", desc: "Empresa que viaja", icon: Building2 },
];

function SignupPage() {
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<AccountType>("HOTEL");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const orgLabel =
    accountType === "HOTEL"
      ? "Nome do hotel"
      : accountType === "TMC"
      ? "Nome da TMC"
      : "Nome da empresa";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          account_type: accountType,
          org_name: orgName,
        },
      },
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    toast.success("Conta criada! Verifique seu email para confirmar.");
    navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Hotel className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Navigator</p>
            <p className="text-[11px] text-muted-foreground">Criar conta</p>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-foreground">Criar conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o tipo de conta para começar.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {ACCOUNT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = accountType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAccountType(opt.value)}
                className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:border-primary/40"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
                <span className="text-[11px] leading-tight text-muted-foreground">{opt.desc}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground">Nome completo</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground">{orgLabel}</label>
            <input
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground">Email corporativo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar conta
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
