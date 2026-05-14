import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Trash2, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth, getPrimaryRole } from "@/hooks/useAuth";
import { consentManager, type ConsentState, type ConsentHistoryEntry } from "@/lib/consentManager";
import { exportMyDataFn, requestAccountDeletionFn } from "@/lib/privacy.functions";

export const Route = createFileRoute("/account/privacy")({
  head: () => ({
    meta: [
      { title: "Meus dados e privacidade — SourcingHub" },
      {
        name: "description",
        content:
          "Visualize seus dados, exporte, gerencie consentimentos e solicite exclusão da conta.",
      },
    ],
  }),
  component: AccountPrivacyPage,
});

function AccountPrivacyPage() {
  const { user, ready, roles } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<ConsentState>(consentManager.getState());
  const [history, setHistory] = useState<ConsentHistoryEntry[]>([]);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState("");

  const exportData = useServerFn(exportMyDataFn);
  const requestDeletion = useServerFn(requestAccountDeletionFn);

  const isAdminMaster = getPrimaryRole(roles) === "ta_master";

  useEffect(() => {
    setHistory(consentManager.getConsentHistory());
    const unsub = consentManager.subscribe((s) => {
      setState(s);
      setHistory(consentManager.getConsentHistory());
    });
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/login" });
  }, [ready, user, navigate]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado");
    } catch (e) {
      toast.error("Falha ao exportar", { description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await requestDeletion({ data: { reason } });
      toast.success("Solicitação registrada", {
        description: "Nossa equipe processará em até 30 dias.",
      });
      setDeleteOpen(false);
      setReason("");
    } catch (e) {
      toast.error("Não foi possível solicitar", { description: (e as Error).message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Meus dados e privacidade</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Conforme LGPD e GDPR, você tem controle total sobre seus dados.
        </p>

        {/* Identificação */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Sua conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="E-mail" value={user.email ?? "—"} />
            <Row label="ID de usuário" value={user.id} mono />
            <Row label="Papel principal" value={getPrimaryRole(roles) ?? "—"} />
          </CardContent>
        </Card>

        {/* Consentimentos */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Consentimentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConsentRow
              label="Cookies essenciais"
              description="Necessários para o app funcionar."
              checked
              disabled
            />
            <ConsentRow
              label="Cookies funcionais"
              description="Lembram preferências de UI."
              checked={state.cookies_functional}
              onChange={(v) => consentManager.setConsent("cookies_functional", v)}
            />
            <ConsentRow
              label="Cookies de analytics"
              description="Métricas agregadas de uso do produto."
              checked={state.cookies_analytics}
              onChange={(v) => consentManager.setConsent("cookies_analytics", v)}
            />
            <ConsentRow
              label="Cookies de marketing"
              description="Comunicações personalizadas."
              checked={state.cookies_marketing}
              onChange={(v) => consentManager.setConsent("cookies_marketing", v)}
            />
            <ConsentRow
              label="E-mails de marketing"
              description="Novidades, dicas e webinars."
              checked={Boolean(state.marketing_email)}
              onChange={(v) => consentManager.setConsent("marketing_email", v)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                consentManager.revokeAll();
                toast.success("Consentimentos revogados");
              }}
            >
              Revogar todos
            </Button>
          </CardContent>
        </Card>

        {/* Portabilidade */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Exportar meus dados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Baixe um arquivo JSON com todos os dados que mantemos sobre você (perfil, papéis,
              consentimentos, vínculos com hotéis).
            </p>
            <Button onClick={handleExport} disabled={exporting} className="mt-3">
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Baixar JSON
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Exclusão */}
        <Card className="mt-6 border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Excluir conta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Solicita a exclusão definitiva da sua conta e dos dados associados. Será processada em
              até 30 dias, salvo dados que devemos reter por obrigação legal.
            </p>
            {isAdminMaster ? (
              <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                Contas <strong>Admin Master</strong> não podem ser auto-excluídas para evitar deixar
                a operação sem administrador. Transfira a função antes.
              </div>
            ) : (
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                className="mt-3"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Solicitar exclusão
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Histórico */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Histórico de consentimentos</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {history.slice(0, 30).map((h, i) => (
                  <li key={i} className="flex justify-between py-2">
                    <span className="text-muted-foreground">
                      {new Date(h.at).toLocaleString("pt-BR")} · {h.type}
                    </span>
                    <span
                      className={
                        h.granted ? "font-medium text-emerald-600" : "font-medium text-destructive"
                      }
                    >
                      {h.granted ? "concedido" : "negado"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar solicitação de exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Sua conta será desativada e os dados pessoais removidos em até 30 dias. Esta ação não
              pode ser desfeita após o processamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Enviando…" : "Confirmar exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs text-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}

function ConsentRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
