import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientsPanel } from "@/components/admin/ClientsPanel";
import { ModulesPanel } from "@/components/admin/ModulesPanel";
import { RolesPanel } from "@/components/admin/RolesPanel";
import { BusinessRulesPanel } from "@/components/admin/BusinessRulesPanel";
import { useAppConfigStore } from "@/lib/appConfigStore";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Application Configuration — SourcingHub" },
      { name: "description", content: "Configuração de clientes, módulos, papéis e regras de negócio." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const role = useAppConfigStore((s) => s.user.role);
  const enabled = useAppConfigStore((s) => s.enabledModules.admin);

  if (role !== "admin" || !enabled) {
    return (
      <AppShell>
        <div className="mx-auto mt-20 max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold text-foreground">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área é exclusiva para administradores com o módulo Admin habilitado.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">Application Configuration</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie clientes, módulos habilitados, papéis de usuário e regras do motor de decisão.
        </p>
      </div>

      <Tabs defaultValue="clients" className="space-y-6">
        <TabsList>
          <TabsTrigger value="clients">Clientes</TabsTrigger>
          <TabsTrigger value="modules">Módulos</TabsTrigger>
          <TabsTrigger value="roles">Usuários & Papéis</TabsTrigger>
          <TabsTrigger value="rules">Regras de Negócio</TabsTrigger>
        </TabsList>
        <TabsContent value="clients"><ClientsPanel /></TabsContent>
        <TabsContent value="modules"><ModulesPanel /></TabsContent>
        <TabsContent value="roles"><RolesPanel /></TabsContent>
        <TabsContent value="rules"><BusinessRulesPanel /></TabsContent>
      </Tabs>
    </AppShell>
  );
}
