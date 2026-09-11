import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PORTAL_ADAPTERS } from "@/lib/rateLoading/adapters";
import { usePortalConnections, useRateLoadingMutations } from "@/lib/rateLoadingHooks";

export function PortalConnectionsPanel({ tenantId }: { tenantId: string }) {
  const { data: connections = [], isLoading } = usePortalConnections(tenantId);
  const m = useRateLoadingMutations(tenantId);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    portalName: "",
    portalAdapterKey: "mock",
    baseUrl: "http://127.0.0.1:4599",
    authType: "password",
    mfaMode: "none",
  });

  const [credFor, setCredFor] = useState<string | null>(null);
  const [cred, setCred] = useState({ username: "", password: "", readOnly: false, authorized: false });

  const submitConnection = async () => {
    try {
      await m.saveConnection.mutateAsync({ tenantId, ...form });
      toast.success("Conexão de portal salva. Configure a credencial para ativá-la.");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const submitCredential = async () => {
    if (!credFor) return;
    try {
      await m.setCredential.mutateAsync({
        connectionId: credFor,
        tenantId,
        username: cred.username,
        password: cred.password,
        readOnlyConfirmed: cred.readOnly,
        authorizationConfirmed: cred.authorized,
      });
      toast.success("Credencial armazenada de forma criptografada.");
      setCredFor(null);
      setCred({ username: "", password: "", readOnly: false, authorized: false });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Conexões de portal</CardTitle>
          <CardDescription>
            A verificação é somente leitura: o robô consulta a tarifa e registra evidência. Nenhuma reserva é feita.
          </CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}>Nova conexão</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && connections.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma conexão configurada. Use o portal de testes antes de conectar um portal real.
          </p>
        )}
        {connections.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.displayName}</span>
                <Badge variant="outline">{c.portalAdapterKey}</Badge>
                <Badge variant={c.status === "verified" ? "default" : "secondary"}>{c.status}</Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {c.baseUrl} · {c.usernameMasked ?? "sem credencial"}
                {c.lastTestStatus ? ` · último teste: ${c.lastTestStatus}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCredFor(c.id)}>
                {c.hasCredential ? "Rotacionar credencial" : "Definir credencial"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!c.hasCredential}
                onClick={() =>
                  m.testConnection
                    .mutateAsync({ connectionId: c.id, tenantId })
                    .then(() => toast.success("Teste de conexão enfileirado."))
                    .catch((e) => toast.error((e as Error).message))
                }
              >
                Testar conexão
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  m.disableConnection
                    .mutateAsync({ connectionId: c.id, tenantId })
                    .then(() => toast.success("Conexão desativada."))
                }
              >
                Desativar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conexão de portal</DialogTitle>
            <DialogDescription>Somente domínios aprovados pelo adaptador são aceitos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome interno</Label>
              <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </div>
            <div>
              <Label>Portal / OBT</Label>
              <Input value={form.portalName} onChange={(e) => setForm({ ...form, portalName: e.target.value })} />
            </div>
            <div>
              <Label>Adaptador</Label>
              <Select
                value={form.portalAdapterKey}
                onValueChange={(v) => setForm({ ...form, portalAdapterKey: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PORTAL_ADAPTERS.map((a) => (
                    <SelectItem key={a.key} value={a.key}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Endereço base</Label>
              <Input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
            </div>
            <div>
              <Label>Autenticação com verificação em duas etapas</Label>
              <Select value={form.mfaMode} onValueChange={(v) => setForm({ ...form, mfaMode: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não usa</SelectItem>
                  <SelectItem value="manual">Sim — exige ação humana</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitConnection} disabled={m.saveConnection.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!credFor} onOpenChange={(o) => !o && setCredFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credencial do portal</DialogTitle>
            <DialogDescription>
              A senha é criptografada e nunca é exibida novamente, nem para a Travel Academy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Usuário</Label>
              <Input
                autoComplete="off"
                value={cred.username}
                onChange={(e) => setCred({ ...cred, username: e.target.value })}
              />
            </div>
            <div>
              <Label>Senha</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={cred.password}
                onChange={(e) => setCred({ ...cred, password: e.target.value })}
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={cred.readOnly}
                onCheckedChange={(v) => setCred({ ...cred, readOnly: v === true })}
              />
              <span>Confirmo que o acesso será usado apenas para consulta, sem realizar reservas.</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={cred.authorized}
                onCheckedChange={(v) => setCred({ ...cred, authorized: v === true })}
              />
              <span>Confirmo que o cliente autorizou este acesso automatizado ao portal.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCredFor(null)}>
              Cancelar
            </Button>
            <Button onClick={submitCredential} disabled={m.setCredential.isPending}>
              Salvar credencial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
