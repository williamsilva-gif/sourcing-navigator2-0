export async function google(path: string, init?: RequestInit) {
  const key = process.env["GOOGLE_MAPS_API_KEY"];
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY não configurada.");
  // Existing project uses a directly supplied server key. Gateway mode is explicit, never inferred from an unrelated Lovable key.
  const gateway = process.env["PROXIMITY_GOOGLE_GATEWAY"] === "true";
  const auth = process.env["LOVABLE_API_KEY"];
  if (gateway && !auth) throw new Error("Credencial de conexão Google ausente.");
  const url = gateway
    ? `https://connector-gateway.lovable.dev/google_maps${path}`
    : path.startsWith("/places/")
      ? `https://places.googleapis.com${path.slice(7)}`
      : `https://maps.googleapis.com${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
  const headers = new Headers(init?.headers);
  if (!gateway && path.startsWith("/places/")) headers.set("X-Goog-Api-Key", key);
  if (gateway) {
    headers.set("Authorization", `Bearer ${auth}`);
    headers.set("X-Connection-Api-Key", key);
  }
  const r = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(15000) });
  if (!r.ok) {
    const body = await r.text();
    if (r.status === 403) {
      if (body.includes("API_KEY_HTTP_REFERRER_BLOCKED"))
        throw new Error(
          "Google 403: chave servidor restrita por site. No Google Cloud, use restrição por IP ou None somente para a chave servidor.",
        );
      if (body.includes("API_KEY_SERVICE_BLOCKED"))
        throw new Error(
          "Google 403: habilite a API solicitada e inclua-a nas APIs permitidas da chave servidor.",
        );
      throw new Error(
        "Google negou acesso (403): verifique restrições e APIs habilitadas da chave servidor.",
      );
    }
    throw new Error(`Google HTTP ${r.status}: ${body.slice(0, 300).replaceAll(key, "[REDACTED]")}`);
  }
  return r.json();
}
