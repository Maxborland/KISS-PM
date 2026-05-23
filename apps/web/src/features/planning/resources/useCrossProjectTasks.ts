"use client";

import { useEffect, useRef, useState } from "react";

const apiOrigin = process.env.NEXT_PUBLIC_KISS_PM_API_ORIGIN ?? "";

export type CrossProjectTask = {
  id: string;
  title: string;
  projectId: string;
  projectTitle: string;
  plannedStart: string;
  plannedFinish: string;
  workMinutes: number;
  createdAt: string;
  statusId: string;
};

export type CrossProjectTasksLookupKey = {
  assigneeUserId: string;
  fromDate: string;
  toDate: string;
} | null;

export type CrossProjectTasksLookupResult = {
  tasks: CrossProjectTask[] | null;
  isLoading: boolean;
  error: string | null;
};

const DEBOUNCE_MS = 220;

export function useCrossProjectTasks(
  lookup: CrossProjectTasksLookupKey
): CrossProjectTasksLookupResult {
  const [state, setState] = useState<CrossProjectTasksLookupResult>({
    tasks: null,
    isLoading: false,
    error: null
  });
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lookup) {
      lastKeyRef.current = null;
      setState({ tasks: null, isLoading: false, error: null });
      return undefined;
    }
    const key = `${lookup.assigneeUserId}|${lookup.fromDate}|${lookup.toDate}`;
    if (key === lastKeyRef.current) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      lastKeyRef.current = key;
      setState((current) => ({ ...current, isLoading: true, error: null }));
      void fetchScheduledTasks(lookup).then(
        (tasks) => {
          if (cancelled) return;
          setState({ tasks, isLoading: false, error: null });
        },
        (error: unknown) => {
          if (cancelled) return;
          setState({
            tasks: [],
            isLoading: false,
            error: error instanceof Error ? error.message : "scheduled_tasks_fetch_failed"
          });
        }
      );
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [lookup]);

  return state;
}

async function fetchScheduledTasks(input: {
  assigneeUserId: string;
  fromDate: string;
  toDate: string;
}): Promise<CrossProjectTask[]> {
  const url = new URL(`${apiOrigin}/api/tenant/current/scheduled-tasks`, window.location.origin);
  url.searchParams.set("assigneeUserId", input.assigneeUserId);
  url.searchParams.set("fromDate", input.fromDate);
  url.searchParams.set("toDate", input.toDate);
  const response = await fetch(apiOrigin ? url.toString() : url.pathname + url.search, {
    credentials: "same-origin"
  });
  if (!response.ok) throw new Error(`scheduled_tasks_${response.status}`);
  const body = (await response.json()) as { tasks: CrossProjectTask[] };
  return body.tasks ?? [];
}
