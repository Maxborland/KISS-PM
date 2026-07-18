"use client";

import { useCallback, useEffect, useState } from "react";

import { useDomainClient } from "../../lib/use-domain-client";
import { useResource, type LoadStatus } from "../../lib/use-resource";
import { createAdminClient, type AuditEvent } from "./admin-client";
import { createMockAdminFetch } from "./mock-admin-backend";
import { useAdminRuntime } from "./admin-runtime";

// 403 → forbidden: журнал аудита закрыт без tenant.audit_events.read.
export type AuditLoadStatus = LoadStatus;

/**
 * Хук журнала аудита (admin «Аудит»). Лёгкий брат useAdmin/useSecurityPolicy:
 * тот же выбор транспорта по AdminRuntime (live → боевой createAdminClient на /api/*,
 * mock → contract-mock fetchImpl на каждый монтаж). Грузит последние события
 * GET /api/tenant/current/audit-events?limit=N.
 */
export function useAuditEvents(limit = 50) {
  const { live } = useAdminRuntime();
  const client = useDomainClient(live, createAdminClient, createMockAdminFetch);

  const loader = useCallback(async () => (await client.listAuditEvents(limit)).auditEvents, [client, limit]);
  const { data, status, error, reload: load } = useResource(loader);

  // Точечная выборка для deep-link ?event=: запись может быть старше окна ленты.
  const getEvent = useCallback(
    async (auditEventId: string): Promise<AuditEvent | null> => {
      try {
        return (await client.getAuditEvent(auditEventId)).auditEvent;
      } catch {
        return null;
      }
    },
    [client]
  );

  return { events: data ?? [], status, error, reload: load, getEvent };
}
