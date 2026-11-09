import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Car, Footprints, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isolatedRouteTestFn } from "@/lib/proximity/route-test.functions";
import { TEST_MODES, testMapsLink, type RouteTestResult } from "@/lib/proximity/route-test";
import { WALK_WARNING } from "@/lib/proximity/routes";

export function IsolatedRouteTest() {
  const { roles } = useAuth();
  const test = useServerFn(isolatedRouteTestFn);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RouteTestResult[]>([]);
  const [error, setError] = useState("");
  if (!roles.some((role) => role.role === "ta_master")) return null;
  async function start() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      setResults(await test());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível executar o teste.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Teste de rotas — Radisson × Claro Belém"
      className="space-y-3 border-y border-border py-4 text-foreground"
    >
      <h2 className="text-base font-semibold">Teste de rotas — Radisson × Claro Belém</h2>
      <p className="text-sm text-muted-foreground">
        Radisson Hotel Maiorana Belém → Claro, Travessa Quintino Bocaiúva, 1186 · Belém/PA
      </p>
      <p className="text-xs text-muted-foreground">
        2 consultas Google por clique; podem gerar custos. Teste isolado, sem gravar na análise.
        Distâncias de rota, não raio em linha reta.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={start} disabled={busy} variant="outline">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Car className="h-4 w-4" />}
          {busy ? "Testando carro e caminhada…" : "Testar carro e caminhada"}
        </Button>
        {TEST_MODES.map((mode) => (
          <a
            key={mode}
            href={testMapsLink(mode)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary underline"
          >
            {mode === "DRIVE" ? <Car className="h-4 w-4" /> : <Footprints className="h-4 w-4" />}
            Google Maps — {mode === "DRIVE" ? "carro" : "a pé"}
          </a>
        ))}
      </div>
      <div aria-live="polite" className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {results.map((r) => (
          <div key={r.mode} className="space-y-1 text-sm">
            <p className="font-semibold">
              {r.mode === "DRIVE" ? "Carro (DRIVE)" : "Caminhada (WALK)"} · HTTP{" "}
              {r.httpStatus ?? "sem resposta"} · {r.error ? "Erro" : "Sucesso"}
            </p>
            {r.meters !== null && r.seconds !== null && (
              <p>
                {r.meters} m · {(r.meters / 1000).toFixed(2)} km · {r.seconds} s ·{" "}
                {(r.seconds / 60).toFixed(2)} min
              </p>
            )}
            {r.error && (
              <p className="whitespace-pre-wrap break-words text-destructive">{r.error}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {r.source} · {new Date(r.at).toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{WALK_WARNING}</p>
    </section>
  );
}
