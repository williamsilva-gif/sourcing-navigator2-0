import { useAppConfigStore, useActiveClientId } from "@/lib/appConfigStore";

/**
 * Retorna se a feature está habilitada para o contexto ativo (workspace TA ou cliente).
 * Default: true (se nunca foi configurada).
 */
export function useFeatureEnabled(key: string): boolean {
  const clientId = useActiveClientId();
  return useAppConfigStore((s) => {
    const cfg = s.configByClient[clientId];
    if (!cfg?.features) return true;
    const v = cfg.features[key];
    return v === undefined ? true : v;
  });
}
