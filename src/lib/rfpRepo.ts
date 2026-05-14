// Client-side React Query helpers for the RFP module.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createRfpFn,
  listRfpsFn,
  getRfpFn,
  cancelRfpFn,
  type RfpRecord,
} from "./rfp.functions";

export const RFP_KEYS = {
  all: ["rfps"] as const,
  list: () => ["rfps", "list"] as const,
  detail: (id: string) => ["rfps", "detail", id] as const,
};

export interface CreateRfpInput {
  name: string;
  clientTenantId: string;
  cycle: string;
  briefing?: string;
  cities: string[];
  pois?: unknown[];
  hotelStrategy?: "preferred" | "open" | "curated";
  requirements?: string[];
  questions?: Record<string, boolean>;
  openDate: string;
  deadline: string;
  hotelIds: string[];
  suggestedCap?: number;
}

export function useRfps() {
  const list = useServerFn(listRfpsFn);
  return useQuery({
    queryKey: RFP_KEYS.list(),
    queryFn: () => list() as Promise<RfpRecord[]>,
  });
}

export function useRfp(id: string | null) {
  const get = useServerFn(getRfpFn);
  return useQuery({
    queryKey: RFP_KEYS.detail(id ?? ""),
    queryFn: () => get({ data: { id: id! } }),
    enabled: !!id,
  });
}

export function useCreateRfp() {
  const create = useServerFn(createRfpFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRfpInput) => create({ data: input as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RFP_KEYS.all }),
  });
}

export function publicResponseUrl(invitationId: string): string {
  if (typeof window === "undefined") return `/r/${invitationId}`;
  return `${window.location.origin}/r/${invitationId}`;
}
