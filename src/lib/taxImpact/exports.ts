import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { RULE_VERSION, LIMITATIONS, simulateNight, budget, type Scenario } from "./simulation";
import { volumeStats, matchVolumes, type VolumeRow } from "./volume";
import { officialSources, type SourceCheck } from "./sources";
import type { Comparison } from "./core";
export type ExportData = {
  name: string;
  results: Comparison[];
  scenario: Scenario;
  source: SourceCheck | null;
  volumeSummary: unknown;
  volumeRows?: VolumeRow[];
};
export function excelReport(data: ExportData) {
  const wb = XLSX.utils.book_new();
  const header = [
    "Rede",
    "Hotel",
    "Cidade",
    "CNPJ",
    "Status original",
    "Match",
    "SGL 2026",
    "SGL 2027",
    "Variação SGL",
    "DBL 2026",
    "DBL 2027",
    "Variação DBL",
    "ISS 2026 %",
    "PIS 2026 %",
    "ISS 2027 %",
    "CBS 2027 %",
    "IBS 2027 %",
    "P neutro SGL",
    "Residual SGL",
    "CBS R$ SGL",
    "IBS R$ SGL",
    "Total 2026 SGL",
    "Total 2027 SGL",
    "Base / limitação",
  ];
  const rows: unknown[][] = [header];
  data.results.forEach((r) => {
    const s = simulateNight(r, "single", data.scenario),
      p = r.proposal ?? r.baseline;
    const line: unknown[] = [
      p?.network,
      p?.hotel,
      p?.city,
      p?.cnpj,
      r.proposal?.statusRaw,
      r.match,
      r.single.before,
      r.single.after,
      null,
      r.double.before,
      r.double.after,
      null,
      s.before?.percent.iss,
      s.before?.percent.pis,
      s.after?.percent.iss,
      s.after?.percent.cbs,
      s.after?.percent.ibs,
      null,
      null,
      s.after?.cbs,
      s.after?.ibs,
      s.before?.total,
      s.after?.total,
      s.reason,
    ];
    rows.push(line);
    const safe = (v: unknown) => (typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v);
    rows[rows.length - 1] = line.map(safe);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  data.results.forEach((r, i) => {
    const n = i + 2,
      s = simulateNight(r, "single", data.scenario);
    if (r.single.state === "comparable")
      ws[`I${n}`] = {
        t: "n",
        f: `IF(G${n}>0,(H${n}-G${n})/G${n},0)`,
        v: (r.single.percent ?? 0) / 100,
        z: "0.00%",
      };
    if (r.double.state === "comparable")
      ws[`L${n}`] = {
        t: "n",
        f: `IF(J${n}>0,(K${n}-J${n})/J${n},0)`,
        v: (r.double.percent ?? 0) / 100,
        z: "0.00%",
      };
    if (s.neutral !== null) {
      ws[`R${n}`] = {
        t: "n",
        f: `ROUND(G${n}*(1-(M${n}+N${n})/100)/(1-(O${n}+P${n}+Q${n})/100),2)`,
        v: s.neutral,
        z: "0.00",
      };
      ws[`S${n}`] = { t: "n", f: `H${n}-R${n}`, v: s.residual ?? 0, z: "0.00" };
    }
  });
  ws["!cols"] = header.map((_, i) => ({ wch: i === 1 || i === 23 ? 45 : 18 }));
  XLSX.utils.book_append_sheet(wb, ws, "Comparação filtrada");
  const program = data.results.flatMap((r) =>
      r.proposal ? [r.proposal] : r.baseline ? [r.baseline] : [],
    ),
    volume = data.volumeRows ?? [],
    portfolio = volumeStats(volume),
    matched = matchVolumes(program, volume);
  const detail: unknown[][] = [
    [
      "Hotel",
      "Ocupação",
      "ISS26 R$",
      "PIS26 R$",
      "Serviço26 R$",
      "ISS27 R$",
      "CBS27 R$",
      "IBS27 R$",
      "Serviço27 R$",
      "Total26",
      "Total27",
      "FY25 noites",
      "JanMai25 noites",
      "JanMai26 noites",
      "ADR25 REAL",
      "ADR26 JanMai REAL",
      "Sazonalidade",
      "FY26 ESTIMADO",
      "Crescimento27 %",
      "FY27 ESTIMADO",
      "Método",
      "Qualidade",
      "Mix Single %",
      "Orçamento26",
      "Orçamento27",
      "Delta orçamento",
    ],
  ];
  data.results.forEach((r) => {
    const p = r.proposal ?? r.baseline,
      v = volumeStats(
        matched.assignments.get(p?.id ?? "") ?? [],
        data.scenario.growthPct,
        portfolio.seasonality ?? undefined,
      ),
      single = simulateNight(r, "single", data.scenario),
      double = simulateNight(r, "double", data.scenario),
      annual = budget(
        single.before?.total ?? null,
        single.after?.total ?? null,
        double.before?.total ?? null,
        double.after?.total ?? null,
        v.projected27,
        data.scenario.singleShare,
      );
    for (const o of ["single", "double"] as const) {
      const t = o === "single" ? single : double;
      detail.push([
        p?.hotel,
        o,
        t.before?.iss,
        t.before?.pis,
        t.before?.service ?? "Incluso/não segregado",
        t.after?.iss,
        t.after?.cbs,
        t.after?.ibs,
        t.after?.service ?? "Incluso/não segregado",
        t.before?.total,
        t.after?.total,
        v.fy25,
        v.n25,
        v.n26,
        v.adr25,
        v.adr26,
        v.seasonality,
        v.projected26,
        data.scenario.growthPct,
        v.projected27,
        v.method,
        v.quality,
        data.scenario.singleShare,
        o === "single" ? annual?.before : null,
        o === "single" ? annual?.after : null,
        o === "single" ? annual?.delta : null,
      ]);
    }
  });
  const ds = XLSX.utils.aoa_to_sheet(detail);
  detail.slice(1).forEach((_, i) => {
    const n = i + 2;
    if (typeof detail[n - 1][19] === "number") {
      ds[`R${n}`] = {
        t: "n",
        f: `IF(Q${n}>0,N${n}/Q${n},0)`,
        v: Number(detail[n - 1][17]),
        z: "0.00",
      };
      ds[`T${n}`] = { t: "n", f: `R${n}*(1+S${n}/100)`, v: Number(detail[n - 1][19]), z: "0.00" };
    }
    for (const c of ["C", "D", "E", "F", "G", "H", "I", "J", "K", "O", "P", "X", "Y", "Z"])
      if (ds[`${c}${n}`]?.t === "n") ds[`${c}${n}`].z = "0.00";
  });
  ds["!cols"] = detail[0].map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ds, "Diárias e volume");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Análise", data.name],
      [
        "SIMULADO",
        /demo|simula/i.test(data.name) ? "DADOS SIMULADOS NÃO CONTRATUAIS" : "Cenário hipotético",
      ],
      ["Versão", RULE_VERSION],
      ["Verificação", data.source?.checkedAt ?? "NÃO VERIFICADO"],
      ["TCU", data.source?.tcu.status ?? "unverified"],
      ["Senado", "NÃO CONFIRMADO"],
      ["Limitações", LIMITATIONS],
      ...Object.entries(data.scenario).map(([k, v]) => [k, JSON.stringify(v)]),
      ["Volume", JSON.stringify(data.volumeSummary)],
      ...Object.entries(officialSources).map(([k, v]) => [k, v]),
    ]),
    "Premissas e fontes",
  );
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true }));
}
export function pdfReport(data: ExportData) {
  const doc = new jsPDF();
  doc.setFont("helvetica");
  doc.setFontSize(16);
  doc.text("Tax Impact Check | Executivo", 14, 18);
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(data.name, 180), 14, 26);
  doc.text(`Versão ${RULE_VERSION} | ${data.results.length} unidades filtradas`, 14, 40);
  doc.text(
    /demo|simula/i.test(data.name)
      ? "DADOS SIMULADOS NÃO CONTRATUAIS"
      : "CENÁRIO HIPOTÉTICO — NÃO É TRIBUTO DEFINITIVO",
    14,
    46,
  );
  doc.text(`TCU: ${data.source?.tcu.status ?? "não verificado"} | Senado: não confirmado`, 14, 52);
  autoTable(doc, {
    startY: 58,
    head: [["Rede / Hotel", "SGL 2026", "SGL 2027", "Delta %", "Neutro / residual"]],
    body: data.results.map((r) => {
      const s = simulateNight(r, "single", data.scenario);
      return [
        `${r.proposal?.network ?? r.baseline?.network} / ${r.proposal?.hotel ?? r.baseline?.hotel}`,
        r.single.before?.toFixed(2) ?? "—",
        r.single.after?.toFixed(2) ?? "—",
        r.single.percent?.toFixed(2) ?? "indeterminado",
        `${s.neutral?.toFixed(2) ?? "—"} / ${s.residual?.toFixed(2) ?? "—"}`,
      ];
    }),
    styles: { fontSize: 7 },
    columnStyles: { 0: { cellWidth: 70 } },
  });
  doc.addPage();
  doc.setFontSize(12);
  doc.text("Decomposição por ocupação (R$)", 14, 18);
  autoTable(doc, {
    startY: 25,
    head: [
      [
        "Hotel / ocupação",
        "Total26 / 27",
        "ISS26 / 27",
        "PIS26",
        "CBS27 / IBS27",
        "Serviço26 / 27",
      ],
    ],
    body: data.results.flatMap((r) =>
      (["single", "double"] as const).map((o) => {
        const t = simulateNight(r, o, data.scenario),
          f = (v: number | null | undefined) =>
            v === null || v === undefined ? "não segregado" : v.toFixed(2);
        return [
          `${r.proposal?.hotel ?? r.baseline?.hotel} / ${o}`,
          `${f(t.before?.total)} / ${f(t.after?.total)}`,
          `${f(t.before?.iss)} / ${f(t.after?.iss)}`,
          f(t.before?.pis),
          `${f(t.after?.cbs)} / ${f(t.after?.ibs)}`,
          `${f(t.before?.service)} / ${f(t.after?.service)}`,
        ];
      }),
    ),
    styles: { fontSize: 7 },
  });
  doc.addPage();
  doc.setFontSize(12);
  doc.text("Premissas, memória e limitações", 14, 18);
  doc.setFontSize(9);
  let y = 28;
  for (const text of [
    LIMITATIONS,
    "P_neutral=P0*(1-t0)/(1-t1). CBS=(11.30%-0.10pp)*60%=6.72%; IBS=0.10%*60%=0.06%.",
    JSON.stringify(data.scenario),
    `Volume: ${JSON.stringify(data.volumeSummary)}`,
    `Consulta: ${data.source?.checkedAt ?? "NÃO VERIFICADO"}`,
    ...Object.values(officialSources),
  ]) {
    const lines = doc.splitTextToSize(text, 180);
    if (y + lines.length * 4 > 280) {
      doc.addPage();
      y = 18;
    }
    doc.text(lines, 14, y);
    y += lines.length * 4 + 5;
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
export function downloadReport(bytes: Uint8Array, name: string, mime: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: mime }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
