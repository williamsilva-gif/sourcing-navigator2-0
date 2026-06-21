import type { ReactNode } from "react";
import { useFeatureEnabled } from "@/hooks/useFeatureEnabled";

/**
 * Renderiza children apenas se a feature estiver habilitada para o cliente ativo.
 * Use para esconder botões/ações sensíveis em cada módulo.
 *
 *   <Feature flag="rfp.create"><Button>Novo RFP</Button></Feature>
 */
export function Feature({ flag, children, fallback = null }: { flag: string; children: ReactNode; fallback?: ReactNode }) {
  const enabled = useFeatureEnabled(flag);
  return <>{enabled ? children : fallback}</>;
}
