import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { AWARDED, DEMAND_TARGETS, AMENITY_LABELS, type AwardedHotel } from "./selectionData";

function aggregates() {
  const total = AWARDED.length;
  const primaries = AWARDED.filter((h) => h.status === "primary").length;
  const totalNights = AWARDED.reduce((s, h) => s + h.roomNights, 0);
  const weightedAdr = AWARDED.reduce((s, h) => s + h.finalAdr * h.roomNights, 0) / totalNights;
  const totalSpend = AWARDED.reduce((s, h) => s + h.finalAdr * h.roomNights, 0);
  const baselineSpend = AWARDED.reduce((s, h) => s + h.startingAdr * h.roomNights, 0);
  const savings = baselineSpend - totalSpend;
  const cities = new Set(AWARDED.map((h) => h.city)).size;
  return { total, primaries, totalNights, weightedAdr, totalSpend, baselineSpend, savings, cities };
}

function fmt$(n: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0); }

export function exportPdf() {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const agg = aggregates();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Programa Anual de Hospedagem 2025–2026", 40, 28);
  doc.setFontSize(10);
  doc.text("SourcingHub · Acme Travel Corp", 40, 46);
  doc.text(new Date().toLocaleDateString("pt-BR"), pageWidth - 40, 46, { align: "right" });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.text("Resumo executivo", 40, 90);

  const summary = [
    ["Hotéis selecionados", String(agg.total)],
    ["Hotéis primários", String(agg.primaries)],
    ["Cidades cobertas", String(agg.cities)],
    ["Room nights/ano", agg.totalNights.toLocaleString("pt-BR")],
    ["ADR médio ponderado", fmt$(agg.weightedAdr)],
    ["Spend total", fmt$(agg.totalSpend)],
    ["Economia vs baseline", `${fmt$(agg.savings)} (${((agg.savings / agg.baselineSpend) * 100).toFixed(1)}%)`],
  ];
  autoTable(doc, {
    startY: 100,
    head: [["Métrica", "Valor"]],
    body: summary,
    theme: "grid",
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold" } },
    margin: { left: 40, right: 40 },
  });

  const cityBreak = Object.entries(
    AWARDED.reduce<Record<string, { hotels: number; nights: number; spend: number }>>((acc, h) => {
      acc[h.city] ??= { hotels: 0, nights: 0, spend: 0 };
      acc[h.city].hotels += 1;
      acc[h.city].nights += h.roomNights;
      acc[h.city].spend += h.roomNights * h.finalAdr;
      return acc;
    }, {}),
  ).map(([city, d]) => {
    const target = DEMAND_TARGETS[city] ?? d.nights;
    const coverage = ((d.nights / target) * 100).toFixed(0) + "%";
    return [city, String(d.hotels), d.nights.toLocaleString("pt-BR"), target.toLocaleString("pt-BR"), coverage, fmt$(d.spend)];
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY1 = (doc as any).lastAutoTable.finalY + 20;
  doc.setFontSize(12);
  doc.text("Cobertura geográfica por cidade", 40, lastY1);
  autoTable(doc, {
    startY: lastY1 + 10,
    head: [["Cidade", "Hotéis", "Room nights", "Target", "Cobertura", "Spend"]],
    body: cityBreak,
    theme: "grid",
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 40, right: 40 },
  });

  doc.addPage();
  doc.setFontSize(14);
  doc.text("Matriz final de hotéis", 40, 40);
  autoTable(doc, {
    startY: 56,
    head: [["Hotel", "Cidade", "Tier", "Status", "ADR final", "Cap", "Δ%", "Room nights", "Spend", "Quality", "Compliance"]],
    body: AWARDED.map((h) => {
      const delta = ((h.finalAdr - h.startingAdr) / h.startingAdr) * 100;
      return [
        h.hotel,
        h.city,
        h.tier,
        h.status === "primary" ? "Primário" : "Backup",
        fmt$(h.finalAdr),
        fmt$(h.cap),
        `${delta.toFixed(1)}%`,
        h.roomNights.toLocaleString("pt-BR"),
        fmt$(h.finalAdr * h.roomNights),
        String(h.qualityScore),
        `${h.compliance}%`,
      ];
    }),
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    margin: { left: 20, right: 20 },
  });

  doc.save(`programa-anual-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportXlsx() {
  const wb = XLSX.utils.book_new();
  const agg = aggregates();

  const summary = [
    ["Programa Anual de Hospedagem 2025–2026"],
    ["Cliente", "Acme Travel Corp"],
    ["Gerado em", new Date().toLocaleDateString("pt-BR")],
    [],
    ["Métrica", "Valor"],
    ["Hotéis selecionados", agg.total],
    ["Hotéis primários", agg.primaries],
    ["Cidades cobertas", agg.cities],
    ["Room nights/ano", agg.totalNights],
    ["ADR médio ponderado (BRL)", Math.round(agg.weightedAdr)],
    ["Spend total (BRL)", agg.totalSpend],
    ["Baseline spend (BRL)", agg.baselineSpend],
    ["Economia (BRL)", agg.savings],
    ["Economia (%)", Number(((agg.savings / agg.baselineSpend) * 100).toFixed(2))],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Resumo");

  const matrixHeader = ["Hotel", "Marca", "Cidade", "Tier", "Status", "ADR Inicial", "ADR Final", "City Cap", "Δ% vs Inicial", "Room Nights", "Spend Anual", "Quality Score", "Compliance %", "Amenities", "Cancelamento (h)", "Contrato Início", "Contrato Fim"];
  const matrixBody = AWARDED.map((h: AwardedHotel) => {
    const delta = Number((((h.finalAdr - h.startingAdr) / h.startingAdr) * 100).toFixed(2));
    return [
      h.hotel, h.brand, h.city, h.tier,
      h.status === "primary" ? "Primário" : "Backup",
      h.startingAdr, h.finalAdr, h.cap, delta,
      h.roomNights, h.finalAdr * h.roomNights,
      h.qualityScore, h.compliance,
      h.amenities.map((a) => AMENITY_LABELS[a] ?? a).join(", "),
      h.cancellationHours, h.contractStart, h.contractEnd,
    ];
  });
  const matrixSheet = XLSX.utils.aoa_to_sheet([matrixHeader, ...matrixBody]);
  matrixSheet["!cols"] = matrixHeader.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, matrixSheet, "Matriz Final");

  const cityRows = Object.entries(
    AWARDED.reduce<Record<string, { hotels: number; nights: number; spend: number }>>((acc, h) => {
      acc[h.city] ??= { hotels: 0, nights: 0, spend: 0 };
      acc[h.city].hotels += 1;
      acc[h.city].nights += h.roomNights;
      acc[h.city].spend += h.roomNights * h.finalAdr;
      return acc;
    }, {}),
  ).map(([city, d]) => {
    const target = DEMAND_TARGETS[city] ?? d.nights;
    return [city, d.hotels, d.nights, target, Number(((d.nights / target) * 100).toFixed(1)), d.spend];
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["Cidade", "Hotéis", "Room Nights", "Target", "Cobertura %", "Spend Anual"], ...cityRows]),
    "Cobertura por Cidade",
  );

  XLSX.writeFile(wb, `programa-anual-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
