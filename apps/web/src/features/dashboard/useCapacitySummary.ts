"use client";

import { useQuery } from "@tanstack/react-query";

export type CapacitySummary = {
  monthIso: string;
  generatedAt: string;
  overloadProjectIds: string[];
  overloadUserCount: number;
  buckets: { low: number; mid: number; high: number };
};

const apiOrigin = process.env.NEXT_PUBLIC_KISS_PM_API_ORIGIN ?? "";

export function useCapacitySummary(monthIso: string, enabled: boolean) {
  return useQuery({
    queryKey: ["workspace-capacity-summary", monthIso],
    queryFn: () => fetchCapacitySummary(monthIso),
    enabled: enabled && monthIso.length > 0,
    staleTime: 30_000
  });
}

async function fetchCapacitySummary(monthIso: string): Promise<CapacitySummary> {
  const params = new URLSearchParams({ monthIso });
  const response = await fetch(`${apiOrigin}/api/workspace/capacity/summary?${params.toString()}`, {
    credentials: "same-origin"
  });
  if (!response.ok) {
    throw new Error(`capacity_summary_${response.status}`);
  }
  return (await response.json()) as CapacitySummary;
}
