import type { ReactNode } from "react";
import { useLocation, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { LegalFooter } from "@/components/privacy/LegalFooter";
import { useEnabledModules, type ModuleKey } from "@/lib/appConfigStore";

const PATH_TO_MODULE: Record<string, ModuleKey> = {
  "/": "dashboard",
  "/diagnostico": "diagnostico",
  "/estrategia": "estrategia",
  "/rfp": "rfp",
  "/analise": "analise",
  "/negociacao": "negociacao",
  "/selecao": "selecao",
  "/implementacao": "implementacao",
  "/monitoramento": "monitoramento",
  "/monetizacao": "monetizacao",
  "/admin": "admin",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const enabled = useEnabledModules();
  const moduleKey = PATH_TO_MODULE[pathname];
  const blocked = moduleKey && !enabled[moduleKey];

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[260px]">
        <Header />
        <main className="mx-auto max-w-[1600px] px-6 py-8">
          {blocked ? <ModuleDisabled module={moduleKey!} /> : children}
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}

function ModuleDisabled({ module }: { module: ModuleKey }) {
  return (
    <div className="mx-auto mt-20 max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
      <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
      <h1 className="mt-4 text-lg font-semibold text-foreground">Módulo desabilitado</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        O módulo <span className="font-semibold text-foreground">{module}</span> não está habilitado para o cliente atual.
      </p>
      <Link
        to="/"
        className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
