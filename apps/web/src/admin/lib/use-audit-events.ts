"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createAdminClient, type AuditEvent } from "./admin-client";
import { createMockAdminFetch } from "./mock-admin-backend";
import { useAdminRuntime } from "./admin-runtime";

export type AuditLoadStatus = "loading" | "ready" | "error";

/**
 * Хук журнала аудита (admin «Аудит»). Лёгкий брат useAdmin/useSecurityPolicy:
 * тот же выбор транспорта по AdminRuntime (live → боевой createAdminClient на /api/*,
 * mock → contract-mock fetchImpl на каждый монтаж). Грузит последние события
 * GET /api/tenant/current/audit-events?limit=N.
 */
export function useAuditEvents(limit = 50) {
  const { live } = useAdminRuntime();
  const fetchRef = useRef<typeof fetch | null>(null);
  if (fetchRef.current === null && !live) fetchRef.current = createMockAdminFetch();
  const clientRef = useRef<ReturnType<typeof createAdminClient> | null>(null);
  if (clientRef.current === null) {
    clientRef.current = live
      ? createAdminClient({ apiOrigin: "" })
      : createAdminClient({ apiOrigin: "", fetchImpl: fetchRef.current! });
  }
  const client = clientRef.current;

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [status, setStatus] = useState<AuditLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await client.listAuditEvents(limit);
      setEvents(res.auditEvents);
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { events, status, error, reload: load };
}
