"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AbsenceType } from "./absenceTypes";

const apiOrigin = process.env.NEXT_PUBLIC_KISS_PM_API_ORIGIN ?? "";

export type ResourceAbsence = {
  id: string;
  userId: string;
  type: AbsenceType;
  dateFrom: string;
  dateTo: string;
  status: string;
  reason: string | null;
};

export type CreateAbsenceInput = {
  userId: string;
  type: AbsenceType;
  dateFrom: string;
  dateTo: string;
  reason?: string | null;
};

const absencesKey = (fromDate: string, toDate: string) =>
  ["tenant-absences", fromDate, toDate] as const;

export function useAbsences(fromDate: string, toDate: string, enabled: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: absencesKey(fromDate, toDate),
    queryFn: () => fetchAbsences(fromDate, toDate),
    enabled
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateAbsenceInput) => createAbsence(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-absences"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAbsence(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-absences"] });
    }
  });

  return {
    absences: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createAbsence: createMutation.mutateAsync,
    deleteAbsence: deleteMutation.mutateAsync,
    isSaving: createMutation.isPending || deleteMutation.isPending
  };
}

async function fetchAbsences(fromDate: string, toDate: string): Promise<ResourceAbsence[]> {
  const response = await fetch(
    `${apiOrigin}/api/tenant/current/absences?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`,
    { credentials: "same-origin" }
  );
  if (!response.ok) {
    throw new Error(`absences_load_failed_${response.status}`);
  }
  const body = (await response.json()) as { absences: ResourceAbsence[] };
  return body.absences;
}

async function createAbsence(input: CreateAbsenceInput): Promise<ResourceAbsence> {
  const response = await fetch(`${apiOrigin}/api/tenant/current/absences`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `absences_create_failed_${response.status}`);
  }
  const body = (await response.json()) as { absence: ResourceAbsence };
  return body.absence;
}

async function deleteAbsence(id: string): Promise<void> {
  const response = await fetch(`${apiOrigin}/api/tenant/current/absences/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "x-kiss-pm-action": "same-origin" }
  });
  if (!response.ok) {
    throw new Error(`absences_delete_failed_${response.status}`);
  }
}

export function monthRangeIso(monthIso: string): { fromDate: string; toDate: string } {
  const [yearText, monthText] = monthIso.split("-");
  const year = Number.parseInt(yearText ?? "2026", 10);
  const monthIndex = Number.parseInt(monthText ?? "1", 10) - 1;
  const fromDate = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const toDate = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  return { fromDate, toDate };
}
