export const officialSources = {
  tcu: "https://sites.tcu.gov.br/reforma-tributaria/visao-cbs-2027.html",
  tcuNews:
    "https://portal.tcu.gov.br/imprensa/noticias/tcu-calcula-aliquota-de-referencia-de-113-para-novo-tributo-sobre-consumo",
  senate: "https://www25.senado.leg.br/web/atividade/materias",
  law: "https://www2.camara.leg.br/legin/fed/leicom/2025/leicomplementar-214-16-janeiro-2025-796905-normaatualizada-pl.html",
  revenue:
    "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria-do-consumo/entenda",
  pis: "https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=70038",
};
export const saoPauloDay = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export function parseCbsReference(html: string) {
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");
  const values = [
    ...text.matchAll(
      /(?:CBS|al[ií]quota(?: de refer[eê]ncia)?)[^%]{0,180}?(\d{1,2}[.,]\d{1,4})\s*%/gi,
    ),
  ]
    .map((m) => Number(m[1].replace(",", ".")))
    .filter((v) => v > 0 && v < 30);
  const unique = [...new Set(values)];
  if (!unique.length || unique.some((v) => Math.abs(v - unique[0]) > 0.1)) return null;
  return { reference: unique[0], rounded: Math.round(unique[0] * 10) / 10 };
}
export type SourceCheck = {
  day: string;
  checkedAt: string;
  tcu: {
    url: string;
    status: "validated" | "unverified";
    reference: number | null;
    rounded: number | null;
  };
  senate: { url: string; status: "unverified"; message: string };
  message: string;
};
export async function fetchOfficialSources(
  fetcher: typeof fetch = fetch,
  date = new Date(),
): Promise<SourceCheck> {
  const result: SourceCheck = {
    day: saoPauloDay(date),
    checkedAt: date.toISOString(),
    tcu: { url: officialSources.tcu, status: "unverified", reference: null, rounded: null },
    senate: {
      url: officialSources.senate,
      status: "unverified",
      message:
        "Consulta não comprova ausência ou publicação de resolução; alíquota definitiva não confirmada.",
    },
    message:
      "Não foi possível verificar hoje. Referência versionada 11,30% é hipótese, não definitiva.",
  };
  // Fixed allowlist; response size and redirects are bounded. Never fetch a URL supplied by the browser.
  async function read(url: string) {
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(12000),
      redirect: "error",
      headers: { Accept: "text/html" },
    });
    if (!response.ok) throw new Error("Fonte indisponível");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Sem conteúdo");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Resposta acima do limite");
      }
      chunks.push(value);
    }
    const all = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      all.set(c, offset);
      offset += c.length;
    }
    return new TextDecoder().decode(all);
  }
  try {
    const parsed = parseCbsReference(await read(officialSources.tcu));
    if (parsed) {
      result.tcu = {
        url: officialSources.tcu,
        status: "validated",
        reference: parsed.reference,
        rounded: parsed.rounded,
      };
      result.message =
        parsed.rounded === 11.3
          ? "Referência TCU consultada; Senado e enquadramento ainda não confirmados."
          : "Referência TCU diverge da regra versionada. Sem alteração automática do cenário.";
    }
  } catch {
    /* fail closed */
  }
  try {
    await read(officialSources.senate);
    result.senate.message =
      "Página oficial consultada, mas não há parser confiável de resolução aplicável. Definitiva NÃO VERIFICADA.";
  } catch {
    /* status remains unverified */
  }
  return result;
}
