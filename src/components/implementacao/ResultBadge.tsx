import { Badge } from "@/components/ui/badge";
import { RESULT_LABELS } from "@/lib/rateLoadingHooks";

const TONE_CLASS: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  bad: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-sky-500/15 text-sky-600 border-sky-500/30",
};

export function ResultBadge({ code }: { code: string | null | undefined }) {
  if (!code) return <Badge variant="outline">Não verificado</Badge>;
  const meta = RESULT_LABELS[code] ?? { label: code, tone: "info" as const };
  return (
    <Badge variant="outline" className={TONE_CLASS[meta.tone]}>
      {meta.label}
    </Badge>
  );
}
