/**
 * Типы «сырого» входа для workspace capacity.
 * Сборка employee-day в UX-6 выполняется в API из plan snapshots активных проектов
 * (см. `apps/api/src/capacity/capacityService.ts`), а не отдельным SQL-агрегатором.
 */

export type WorkspaceCapacityProjectLoad = {
  projectId: string;
  /** Day buckets из planning read-model (granularity day). */
  dayBucketDates: string[];
};

export type WorkspaceCapacityInputBundle = {
  tenantId: string;
  monthIso: string;
  fromDate: string;
  toDate: string;
  projectLoads: WorkspaceCapacityProjectLoad[];
};
