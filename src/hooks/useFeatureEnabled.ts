import { useAppConfigStore } from "@/lib/appConfigStore";
import { useClientsStore } from "@/lib/clientsStore";

/**
 * Retorna se a feature está habilitada para o cliente ativo.
 * Default: true (se nunca foi configurada).
 */
export function useFeatureEnabled(key: string): boolean {
  const clientId = useClientsStore((s) => s.selectedClientId);
  return useAppConfigStore((s) => {
    const cfg = s.configByClient[clientId];
    if (!cfg?.features) return true;
    const v = cfg.features[key];
    return v === undefined ? true : v;
  });
}
