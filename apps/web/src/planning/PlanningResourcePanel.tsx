import type { BucketGranularity } from "@kiss-pm/domain";

import type { PlanningReadModel } from "./planningReadModelMapper";
import "./planningWorkspace.css";

type ResourceLoadBucket = PlanningReadModel["resourceLoad"]["buckets"][number];
type ResourceOverload = PlanningReadModel["resourceLoad"]["overloads"][number];
type OverloadReason = ResourceOverload["reasons"][number];

export type ResourceSheetRow = {
  resourceId: string;
  positionId: string | null;
  teamId: string | null;
  assignedMinutes: number;
  capacityMinutes: number;
  reservedMinutes: number;
  freeMinutes: number;
  overloadMinutes: number;
  taskCount: number;
  assignmentCount: number;
  reservationCount: number;
  calendarExceptionCount: number;
};

export type ResourceMatrixRow = {
  resourceId: string;
  bucketStart: string;
  granularity: BucketGranularity;
  plannedMinutes: number;
  availableMinutes: number;
  reservedMinutes: number;
  freeMinutes: number;
  overloadMinutes: number;
  taskIds: string[];
};

export function PlanningResourcePanel(props: {
  readModel: PlanningReadModel;
}) {
  const sheetRows = buildResourceSheetRows(props.readModel);
  const dayRows = buildResourceMatrixRows(props.readModel, "day");
  const weekRows = buildResourceMatrixRows(props.readModel, "week");
  const monthRows = buildResourceMatrixRows(props.readModel, "month");

  return (
    <section className="planning-side-panel planning-resource-panel">
      <div>
        <h3>Ресурсный лист</h3>
        <p className="muted">Источник: backend resourceLoad read model.</p>
      </div>
      <div className="planning-resource-sheet" role="table" aria-label="Ресурсный лист">
        <div className="planning-resource-sheet-header" role="row">
          <span>Ресурс</span>
          <span>План</span>
          <span>Доступно</span>
          <span>Перегруз</span>
        </div>
        {sheetRows.length === 0 ? (
          <p className="muted">Ресурсная загрузка пока пуста.</p>
        ) : (
          sheetRows.map((row) => (
            <div className="planning-resource-sheet-row" key={row.resourceId} role="row">
              <span>
                <strong>{row.resourceId}</strong>
                <small>{row.positionId ?? "позиция не задана"} / {row.teamId ?? "команда не задана"}</small>
              </span>
              <span>{formatHours(row.assignedMinutes)}</span>
              <span>{formatHours(row.capacityMinutes)}</span>
              <span className={row.overloadMinutes > 0 ? "danger" : ""}>
                {formatHours(row.overloadMinutes)}
              </span>
              <small className="planning-resource-sheet-meta">
                {row.taskCount} задач, {row.assignmentCount} назначений, {row.reservationCount} резервов, {row.calendarExceptionCount} исключений
              </small>
            </div>
          ))
        )}
      </div>
      <div className="planning-resource-matrix" aria-label="Матрица загрузки">
        <h3>Матрица загрузки</h3>
        <p className="muted">planned / available / reserved / free / overload</p>
        <ResourceMatrixTable label="День" rows={dayRows} />
        <ResourceMatrixTable label="Неделя" rows={weekRows} />
        <ResourceMatrixTable label="Месяц" rows={monthRows} />
      </div>
      <div className="planning-resource-overloads">
        <h3>Причины перегруза</h3>
        {props.readModel.resourceLoad.overloads.length === 0 ? (
          <p className="muted">Перегрузов по текущему read model нет.</p>
        ) : (
          <ul>
            {props.readModel.resourceLoad.overloads.map((overload) => (
              <li key={`${overload.resourceId}:${overload.granularity}:${overload.date}`}>
                <strong>{overload.resourceId} / {overload.date}: {formatHours(overload.overloadMinutes)}</strong>
                <span>{overload.taskIds.length} задач: {overload.taskIds.join(", ")}</span>
                <small>{overload.reasons.map(formatOverloadReason).join("; ")}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function buildResourceSheetRows(readModel: PlanningReadModel): ResourceSheetRow[] {
  const rowsByResourceId = new Map<string, ResourceSheetRow>();
  const idSetsByResourceId = new Map<string, {
    taskIds: Set<string>;
    assignmentIds: Set<string>;
    reservationIds: Set<string>;
    calendarExceptionIds: Set<string>;
  }>();
  for (const bucket of readModel.resourceLoad.buckets.filter((candidate) => candidate.granularity === "day")) {
    const row = rowsByResourceId.get(bucket.resourceId) ?? emptyResourceSheetRow(bucket);
    const idSets = idSetsByResourceId.get(bucket.resourceId) ?? {
      taskIds: new Set<string>(),
      assignmentIds: new Set<string>(),
      reservationIds: new Set<string>(),
      calendarExceptionIds: new Set<string>()
    };
    row.assignedMinutes += bucket.assignedMinutes;
    row.capacityMinutes += bucket.capacityMinutes;
    row.reservedMinutes += bucket.reservedMinutes;
    row.freeMinutes += bucket.freeMinutes;
    addIds(idSets.taskIds, bucket.taskIds);
    addIds(idSets.assignmentIds, bucket.assignmentIds);
    addIds(idSets.reservationIds, bucket.reservationIds);
    addIds(idSets.calendarExceptionIds, bucket.calendarExceptionIds);
    row.taskCount = idSets.taskIds.size;
    row.assignmentCount = idSets.assignmentIds.size;
    row.reservationCount = idSets.reservationIds.size;
    row.calendarExceptionCount = idSets.calendarExceptionIds.size;
    rowsByResourceId.set(bucket.resourceId, row);
    idSetsByResourceId.set(bucket.resourceId, idSets);
  }
  for (const overload of readModel.resourceLoad.overloads.filter((candidate) => candidate.granularity === "day")) {
    const row = rowsByResourceId.get(overload.resourceId) ?? emptyResourceSheetRow(overload);
    row.overloadMinutes += overload.overloadMinutes;
    rowsByResourceId.set(overload.resourceId, row);
  }
  return [...rowsByResourceId.values()].sort((left, right) => left.resourceId.localeCompare(right.resourceId));
}

export function buildResourceMatrixRows(
  readModel: PlanningReadModel,
  granularity: BucketGranularity
): ResourceMatrixRow[] {
  const overloadMinutesByBucket = new Map(
    readModel.resourceLoad.overloads
      .filter((overload) => overload.granularity === granularity)
      .map((overload) => [resourceBucketKey(overload.resourceId, overload.granularity, overload.date), overload.overloadMinutes])
  );
  return readModel.resourceLoad.buckets
    .filter((bucket) => bucket.granularity === granularity)
    .map((bucket) => ({
      resourceId: bucket.resourceId,
      bucketStart: bucket.date,
      granularity: bucket.granularity,
      plannedMinutes: bucket.assignedMinutes,
      availableMinutes: bucket.capacityMinutes,
      reservedMinutes: bucket.reservedMinutes,
      freeMinutes: bucket.freeMinutes,
      overloadMinutes: overloadMinutesByBucket.get(resourceBucketKey(bucket.resourceId, bucket.granularity, bucket.date)) ?? 0,
      taskIds: bucket.taskIds
    }))
    .sort((left, right) =>
      left.resourceId.localeCompare(right.resourceId) || left.bucketStart.localeCompare(right.bucketStart)
    );
}

export function formatOverloadReason(reason: OverloadReason): string {
  if (reason.type === "task") return `Задача: ${reason.id}`;
  if (reason.type === "assignment") return `Назначение: ${reason.id}`;
  if (reason.type === "reservation") return `Резерв: ${reason.id}`;
  return `Исключение календаря: ${reason.id}`;
}

function ResourceMatrixTable(props: {
  label: string;
  rows: readonly ResourceMatrixRow[];
}) {
  if (props.rows.length === 0) return null;
  return (
    <div className="planning-resource-matrix-group">
      <strong>{props.label}</strong>
      <table className="planning-resource-matrix-table">
        <thead>
          <tr>
            <th>Ресурс</th>
            <th>Период</th>
            <th>План</th>
            <th>Доступно</th>
            <th>Резерв</th>
            <th>Свободно</th>
            <th>Перегруз</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={`${row.resourceId}:${row.granularity}:${row.bucketStart}`}>
              <td>{row.resourceId}</td>
              <td>{row.bucketStart}</td>
              <td>{formatHours(row.plannedMinutes)}</td>
              <td>{formatHours(row.availableMinutes)}</td>
              <td>{formatHours(row.reservedMinutes)}</td>
              <td>{formatHours(row.freeMinutes)}</td>
              <td className={row.overloadMinutes > 0 ? "danger" : ""}>{formatHours(row.overloadMinutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function emptyResourceSheetRow(bucket: ResourceLoadBucket): ResourceSheetRow {
  return {
    resourceId: bucket.resourceId,
    positionId: bucket.positionId,
    teamId: bucket.teamId,
    assignedMinutes: 0,
    capacityMinutes: 0,
    reservedMinutes: 0,
    freeMinutes: 0,
    overloadMinutes: 0,
    taskCount: 0,
    assignmentCount: 0,
    reservationCount: 0,
    calendarExceptionCount: 0
  };
}

function addIds(target: Set<string>, ids: readonly string[]) {
  for (const id of ids) target.add(id);
}

function resourceBucketKey(resourceId: string, granularity: BucketGranularity, date: string): string {
  return `${resourceId}:${granularity}:${date}`;
}

function formatHours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10} ч`;
}
