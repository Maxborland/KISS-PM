"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DomainApiError } from "../../lib/domain-client";
import { useDomainClient } from "../../lib/use-domain-client";
import type { LoadStatus } from "../../lib/use-resource";
import { createAdminClient, type AuditEvent, type AuditEventFilter } from "./admin-client";
import { createMockAdminFetch } from "./mock-admin-backend";
import { useAdminRuntime } from "./admin-runtime";

// 403 → forbidden: журнал аудита закрыт без tenant.audit_events.read.
export type AuditLoadStatus = LoadStatus;

// Пользовательские фильтры (без внутренних limit/cursor — ими владеет хук).
export type AuditFilterState = Pick<
  AuditEventFilter,
  "actorUserId" | "actionType" | "executionResult" | "fromDate" | "toDate"
>;

const EMPTY_FILTER: AuditFilterState = {
  actorUserId: null,
  actionType: null,
  executionResult: null,
  fromDate: null,
  toDate: null
};

/**
 * Хук журнала аудита (admin «Аудит»). Транспорт по AdminRuntime (live → боевой
 * createAdminClient на /api/*, mock → contract-mock fetchImpl). Серверные фильтры
 * actorUserId/actionType/executionResult/fromDate/toDate + keyset-пагинация:
 * смена фильтра грузит первую страницу с нуля, «Показать ещё» дозагружает
 * следующую по nextCursor из ответа API.
 */
export function useAuditEvents(limit = 50) {
  const { live } = useAdminRuntime();
  const client = useDomainClient(live, createAdminClient, createMockAdminFetch);

  const [filter, setFilterState] = useState<AuditFilterState>(EMPTY_FILTER);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Игнорируем ответы устаревших запросов (гонка при быстрой смене фильтров).
  const requestSeqRef = useRef(0);

  const loadFirstPage = useCallback(
    async (next: AuditFilterState) => {
      const seq = (requestSeqRef.current += 1);
      setStatus("loading");
      setLoadingMore(false);
      try {
        const response = await client.listAuditEvents({ ...next, limit });
        if (seq !== requestSeqRef.current) return;
        setEvents(response.auditEvents);
        setNextCursor(response.nextCursor);
        setStatus("ready");
        setError(null);
      } catch (e) {
        if (seq !== requestSeqRef.current) return;
        if (e instanceof DomainApiError && e.status === 403) {
          setStatus("forbidden");
          setError(e.code);
          return;
        }
        setStatus("error");
        setError(e instanceof DomainApiError ? e.code : e instanceof Error ? e.message : "load_failed");
      }
    },
    [client, limit]
  );

  useEffect(() => {
    void loadFirstPage(filter);
  }, [loadFirstPage, filter]);

  // Применить фильтр (грузит первую страницу с нуля через эффект).
  const applyFilter = useCallback((patch: Partial<AuditFilterState>) => {
    setFilterState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilterState(EMPTY_FILTER);
  }, []);

  const reload = useCallback(async () => {
    await loadFirstPage(filter);
  }, [loadFirstPage, filter]);

  // «Показать ещё»: дозагрузка следующей страницы по keyset-курсору (append).
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const seq = requestSeqRef.current;
    setLoadingMore(true);
    try {
      const response = await client.listAuditEvents({ ...filter, limit, cursor: nextCursor });
      if (seq !== requestSeqRef.current) return;
      setEvents((prev) => [...prev, ...response.auditEvents]);
      setNextCursor(response.nextCursor);
    } catch {
      // Ошибку дозагрузки не роняем на всю ленту — курсор сохраняем для повтора.
    } finally {
      if (seq === requestSeqRef.current) setLoadingMore(false);
    }
  }, [client, filter, limit, loadingMore, nextCursor]);

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

  return {
    events,
    status,
    error,
    reload,
    getEvent,
    filter,
    applyFilter,
    resetFilter,
    nextCursor,
    hasMore: nextCursor !== null,
    loadMore,
    loadingMore
  };
}
