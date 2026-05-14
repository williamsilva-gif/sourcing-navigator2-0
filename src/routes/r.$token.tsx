import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getInvitationByTokenFn,
  submitInvitationResponseFn,
} from "@/lib/rfp.functions";

export const Route = createFileRoute("/r/$token")({
  head: () => ({
    meta: [
      { title: "Responder RFP" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicResponsePage,
});

function PublicResponsePage() {
  const { token } = Route.useParams();
  const getInvitation = useServerFn(getInvitationByTokenFn);
  const submit = useServerFn(submitInvitationResponseFn);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["public-invitation", token],
    queryFn: () => getInvitation({ data: { token } }),
    retry: false,
  });

  const meta = useMemo(
    () => (data?.rfp.metadata ?? {}) as Record<string, unknown>,
    [data],
  );
  const questions = useMemo(
    () => (meta.questions ?? {}) as Record<string, boolean>,
    [meta],
  );

  const initial = useMemo(() => {
    const r = (data?.existingResponse?.rates ?? {}) as Record<string, string>;
    return {
      adr_lra: r.adr_lra ?? "",
      adr_dynamic: r.adr_dynamic ?? "",
      currency: r.currency ?? "BRL",
      inclusions: r.inclusions ?? "",
      cancellation: r.cancellation ?? "",
      contact_name: r.contact_name ?? "",
      contact_email: r.contact_email ?? "",
      notes: r.notes ?? "",
    };
  }, [data]);

  const [form, setForm] = useState(initial);
  // Re-sync when initial changes
  useMemo(() => setForm(initial), [initial]);

  const mutation = useMutation({
    mutationFn: () => submit({ data: { token, rates: form } }),
    onSuccess: () => {
      toast.success("Resposta enviada");
      refetch();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao enviar"),
  });

  if (isLoading) {
    return <Centered>Carregando convite…</Centered>;
  }
  if (error || !data) {
    return (
      <Centered>
        <p className="text-destructive">
          Convite não encontrado ou expirado.
        </p>
      </Centered>
    );
  }

  const submitted = !!data.existingResponse;

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-6 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">{data.rfp.name}</h1>
        </div>

        <div className="mb-4 rounded-lg border border-border bg-card p-4 text-sm">
          <p>
            <strong>Cliente:</strong> {data.rfp.client_name}
          </p>
          <p>
            <strong>Hotel:</strong> {data.hotel?.name ?? "—"} · {data.hotel?.city ?? ""}
          </p>
          {data.rfp.deadline && (
            <p>
              <strong>Prazo:</strong>{" "}
              {new Date(data.rfp.deadline).toLocaleDateString()}
            </p>
          )}
        </div>

        {submitted && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
            <div>
              <p className="font-medium text-success">Resposta já submetida</p>
              <p className="text-xs text-muted-foreground">
                Enviada em{" "}
                {new Date(data.existingResponse!.submitted_at).toLocaleString()}
                . Você pode atualizá-la abaixo.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          {(questions.rates ?? true) && (
            <Section title="Tarifas">
              <div className="grid grid-cols-2 gap-3">
                <Field label="ADR LRA" value={form.adr_lra} onChange={(v) => setForm({ ...form, adr_lra: v })} placeholder="350" />
                <Field label="ADR Dynamic" value={form.adr_dynamic} onChange={(v) => setForm({ ...form, adr_dynamic: v })} placeholder="380" />
                <Field label="Moeda" value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} placeholder="BRL" />
              </div>
            </Section>
          )}
          {(questions.inclusions ?? true) && (
            <Section title="Inclusões">
              <Textarea rows={3} value={form.inclusions} onChange={(e) => setForm({ ...form, inclusions: e.target.value })} placeholder="Café, Wi-Fi, parking…" />
            </Section>
          )}
          {(questions.policies ?? true) && (
            <Section title="Políticas">
              <Textarea rows={3} value={form.cancellation} onChange={(e) => setForm({ ...form, cancellation: e.target.value })} placeholder="Cancelamento, no-show, garantia…" />
            </Section>
          )}
          {(questions.commercial ?? true) && (
            <Section title="Contato comercial">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} />
                <Field label="E-mail" value={form.contact_email} onChange={(v) => setForm({ ...form, contact_email: v })} placeholder="comercial@hotel.com" />
              </div>
            </Section>
          )}
          <Section title="Observações">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Section>

          <div className="flex justify-end border-t border-border pt-4">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              <Send className="mr-1.5 h-4 w-4" />
              {mutation.isPending ? "Enviando…" : submitted ? "Atualizar resposta" : "Enviar resposta"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
