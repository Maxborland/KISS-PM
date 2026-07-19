"use client";

import { useCallback, useMemo, useState } from "react";

import { DomainApiError, guardMutation, type MutationResult } from "../../lib/domain-client";
import { useDomainClient } from "../../lib/use-domain-client";
import { useResource, type LoadStatus } from "../../lib/use-resource";
import {
  createAdminClient,
  type AbsenceCreateInput,
  type BackgroundJobEvent,
  type BackgroundJobRun,
  type BackgroundJobStatus,
  type ProductionCalendar,
  type ProductionCalendarBulkItem,
  type ResourceAbsence,
  type WorkspaceUser
} from "./admin-client";
import { createMockAdminFetch } from "./mock-admin-backend";
import { useAdminRuntime } from "./admin-runtime";

/* ============================================================
   Хуки операционных админ-поверхностей (Н3/Н4): отсутствия,
   производственный календарь, фоновые задачи. Братья useAdmin /
   useSecurityPolicy: транспорт по AdminRuntime (live → боевой
   createAdminClient на /api/*, mock → contract-mock на монтаж).
   ============================================================ */

export type AdminOpsLoadStatus = LoadStatus;

// Подгрузка справочника, закрытого для текущей роли: 403 → fallback (не валит поверхность).
async function optionalForbidden<T>(request: Promise<T>, fallback: T): Promise<T> {
  try {
    return await request;
  } catch (e) {
    if (e instanceof DomainApiError && e.status === 403) return fallback;
    throw e;
  }
}

/**
 * Отсутствия за период (боевой GET требует ОБЯЗАТЕЛЬНЫЙ период ≤ 370 дней).
 * Справочник пользователей грузится толерантно (403 → пустой список): роль
 * только с tenant.absences.* всё равно видит отсутствия — по id участника.
 */
export function useAbsences(fromDate: string, toDate: string) {
  const { live } = useAdminRuntime();
  const client = useDomainClient(live, createAdminClient, createMockAdminFetch);

  const loader = useCallback(async (): Promise<{ absences: ResourceAbsence[]; users: WorkspaceUser[] }> => {
    const [absences, users] = await Promise.all([
      client.listAbsences(fromDate, toDate),
      optionalForbidden(client.listUsers(), { users: [] })
    ]);
    return { absences: absences.absences, users: users.users };
  }, [client, fromDate, toDate]);
  const { data, status, error, setData, reload } = useResource(loader);

  // Создание: перезагрузка списка (сервер — источник истины по фильтру периода).
  const create = useCallback(
    (input: AbsenceCreateInput): Promise<MutationResult> =>
      guardMutation(async () => {
        await client.createAbsence(input);
        await reload();
      }),
    [client, reload]
  );

  const remove = useCallback(
    (absenceId: string): Promise<MutationResult> =>
      guardMutation(async () => {
        await client.deleteAbsence(absenceId);
        setData((d) => (d ? { ...d, absences: d.absences.filter((a) => a.id !== absenceId) } : d));
      }),
    [client, setData]
  );

  return { absences: data?.absences ?? [], users: data?.users ?? [], hasData: data !== null, status, error, reload, create, remove };
}

/** Производственный календарь выбранного года + bulk-upsert исключений. */
export function useProductionCalendar(year: number) {
  const { live } = useAdminRuntime();
  const client = useDomainClient(live, createAdminClient, createMockAdminFetch);

  const loader = useCallback(async (): Promise<ProductionCalendar> => client.getProductionCalendar(year), [client, year]);
  const { data: calendar, status, error, reload } = useResource(loader);

  // Ответ bulk — календарь ТЕКУЩЕГО года (боевой контракт), поэтому после
  // мутации честно перезагружаем выбранный год, а не подменяем данные ответом.
  const upsertExceptions = useCallback(
    (items: ProductionCalendarBulkItem[]): Promise<MutationResult> =>
      guardMutation(async () => {
        await client.bulkUpsertProductionCalendarExceptions(items);
        await reload();
      }),
    [client, reload]
  );

  return { calendar, status, error, reload, upsertExceptions };
}

/**
 * Фоновые задачи (read-only): список прогонов с фильтром статуса + точечная
 * подгрузка событий прогона. GET-роута расписаний в API нет — расписания
 * здесь честно не показываются.
 */
export function useBackgroundJobs() {
  const { live } = useAdminRuntime();
  const client = useDomainClient(live, createAdminClient, createMockAdminFetch);
  const [statusFilter, setStatusFilter] = useState<BackgroundJobStatus | "">("");

  const loader = useCallback(
    async (): Promise<BackgroundJobRun[]> =>
      (await client.listBackgroundJobRuns(statusFilter ? { status: statusFilter } : {})).runs,
    [client, statusFilter]
  );
  const { data, status, error, reload } = useResource(loader);

  const getEvents = useCallback(
    async (runId: string): Promise<BackgroundJobEvent[] | null> => {
      try {
        return (await client.listBackgroundJobEvents(runId)).events;
      } catch {
        return null;
      }
    },
    [client]
  );

  return useMemo(
    () => ({ runs: data ?? [], hasData: data !== null, status, error, reload, getEvents, statusFilter, setStatusFilter }),
    [data, status, error, reload, getEvents, statusFilter]
  );
}
