"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const apiOrigin = process.env.NEXT_PUBLIC_KISS_PM_API_ORIGIN ?? "";

export type ProductionCalendarException = {
  id: string;
  date: string;
  workingMinutes: number;
  reason: string | null;
  resourceId: string | null;
};

export type ProductionCalendarSnapshot = {
  calendarId: string;
  year: number;
  workingWeekdays: number[];
  workingMinutesPerDay: number;
  exceptions: ProductionCalendarException[];
};

export type ProductionCalendarBulkInput = {
  exceptions: Array<{
    id?: string;
    date: string;
    workingMinutes: number;
    reason?: string | null;
    resourceId?: string | null;
  }>;
};

const productionCalendarKey = (year: number) => ["production-calendar", year] as const;

export function useProductionCalendar(year: number, enabled: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: productionCalendarKey(year),
    queryFn: () => fetchProductionCalendar(year),
    enabled
  });

  const mutation = useMutation({
    mutationFn: (input: ProductionCalendarBulkInput) => upsertProductionCalendar(input),
    onSuccess: (data) => {
      queryClient.setQueryData(productionCalendarKey(data.year), data);
    }
  });

  return {
    snapshot: query.data,
    isLoading: query.isLoading,
    error: query.error,
    bulkUpsert: mutation.mutateAsync,
    isSaving: mutation.isPending,
    saveError: mutation.error
  };
}

async function fetchProductionCalendar(year: number): Promise<ProductionCalendarSnapshot> {
  const response = await fetch(
    `${apiOrigin}/api/tenant/current/production-calendar?year=${year}`,
    { credentials: "same-origin" }
  );
  if (!response.ok) {
    throw new Error(`production_calendar_load_failed_${response.status}`);
  }
  return (await response.json()) as ProductionCalendarSnapshot;
}

async function upsertProductionCalendar(
  input: ProductionCalendarBulkInput
): Promise<ProductionCalendarSnapshot> {
  const response = await fetch(`${apiOrigin}/api/tenant/current/production-calendar/bulk`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `production_calendar_save_failed_${response.status}`);
  }
  return (await response.json()) as ProductionCalendarSnapshot;
}
