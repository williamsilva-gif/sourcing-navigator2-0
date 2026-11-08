import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { proximityGoogleTestFn } from "@/lib/proximity/proximity.functions";

type Result = Awaited<ReturnType<typeof proximityGoogleTestFn>>;
const labels: Record<string, string> = {
  ok: "Conectado",
  key_missing: "Chave do servidor ausente",
  restricted: "Chave restrita/API não habilitada",
  billing: "Faturamento Google não habilitado",
  quota: "Limite de consultas",
  network: "Falha de rede/tempo",
  auth: "Credencial inválida",
  google_mismatch: "Google sem resultado",
  google_error: "Erro Google",
};
export function GoogleMapsTest() {
  const test = useServerFn(proximityGoogleTestFn);
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  return (
    <div className="rounded-md border border-border p-3 text-sm space-y-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
          setBusy(true); setErr("");
          try { setR(await test()); } catch (e) { setErr(e instanceof Error ? e.message : "Falha"); }
          finally { setBusy(false); }
        }}>
          {busy ? "Testando…" : "Testar Google Maps"}
        </Button>
        <span className="text-xs text-muted-foreground">1 consulta real (endereço público), sem alterar dados.</span>
      </div>
      {err && <p className="text-destructive">{err}</p>}
      {r && (
        <dl data-testid="google-test" className="grid grid-cols-[auto_1fr] gap-x-3 text-xs">
          <dt>Resultado</dt><dd className={r.ok ? "text-primary font-semibold" : "text-destructive font-semibold"}>{labels[r.category] ?? r.category}</dd>
          <dt>Modo</dt><dd>{r.mode === "gateway" ? "Conector Lovable" : "Chave servidor direta"}</dd>
          <dt>Status API</dt><dd>{r.status ?? "—"}</dd>
          {"formatted_address" in r && <><dt>Endereço</dt><dd>{r.formatted_address ?? "—"}</dd>
          <dt>Precisão</dt><dd>{r.location_type ?? "—"}</dd>
          <dt>Lat/Lng</dt><dd>{r.lat ?? "—"}, {r.lng ?? "—"}</dd>
          <dt>Place ID</dt><dd>{r.place_id ?? "—"}</dd></>}
          {r.message && <><dt>Mensagem</dt><dd>{r.message}</dd></>}
        </dl>
      )}
    </div>
  );
}
