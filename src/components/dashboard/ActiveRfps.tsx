import { ArrowRight, Circle } from "lucide-react";

const rfps = [
  { client: "Acme Travel Corp", region: "LATAM", hotels: 124, status: "negotiating", deadline: "12 dias" },
  { client: "GlobalTech Inc.", region: "EMEA", hotels: 87, status: "analyzing", deadline: "5 dias" },
  { client: "Northwind Group", region: "APAC", hotels: 56, status: "draft", deadline: "21 dias" },
  { client: "Vertex Industries", region: "AMER", hotels: 142, status: "negotiating", deadline: "8 dias" },
];

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "text-muted-foreground" },
  analyzing: { label: "Em análise", color: "text-info" },
  negotiating: { label: "Negociando", color: "text-warning-foreground" },
  closed: { label: "Concluído", color: "text-success" },
};

export function ActiveRfps() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">RFPs ativos</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{rfps.length} processos em andamento</p>
        </div>
        <button className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover">
          Ver todos <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="divide-y divide-border">
        {rfps.map((r) => {
          const s = statusMap[r.status];
          return (
            <li
              key={r.client}
              className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{r.client}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.region} · {r.hotels} hotéis
                </p>
              </div>
              <div className="ml-4 text-right">
                <p className={`flex items-center justify-end gap-1.5 text-xs font-medium ${s.color}`}>
                  <Circle className="h-2 w-2 fill-current" />
                  {s.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.deadline}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}