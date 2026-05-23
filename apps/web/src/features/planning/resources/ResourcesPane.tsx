"use client";

import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { useCallback, useMemo, useState } from "react";

import { useProductionCalendar } from "../../production-calendar/useProductionCalendar";
import type { PlanningPermissions } from "../hooks/usePlanningPermissions";
import { MonthlyResourceMatrix, currentMonthIso } from "./MonthlyResourceMatrix";
import {
  useMonthlyResourceMatrix,
  type ResourceMatrixUser
} from "./useMonthlyResourceMatrix";

export type ResourcesPaneWorkspaceUser = {
  id: string;
  name: string;
  positionId: string | null;
  positionName: string | null;
};

export type ResourcesPaneWorkspacePosition = {
  id: string;
  name: string;
};

export function ResourcesPane(props: {
  readModel: PlanningReadModel | undefined;
  permissions: PlanningPermissions;
  workspaceUsers: ResourcesPaneWorkspaceUser[];
  workspacePositions: ResourcesPaneWorkspacePosition[];
  onOpenAssignments: () => void;
}) {
  const [monthIso, setMonthIso] = useState<string>(() => readMonthFromUrl() ?? currentMonthIso());

  const handleMonthChange = useCallback((nextMonthIso: string) => {
    setMonthIso(nextMonthIso);
    writeMonthToUrl(nextMonthIso);
  }, []);

  const year = useMemo(() => {
    const [yearText] = monthIso.split("-");
    const parsed = Number.parseInt(yearText ?? "", 10);
    return Number.isFinite(parsed) ? parsed : new Date().getUTCFullYear();
  }, [monthIso]);

  const calendar = useProductionCalendar(year, props.permissions.canReadProjectPlan);

  const matrixUsers: ResourceMatrixUser[] = useMemo(
    () =>
      props.workspaceUsers.map((user) => ({
        id: user.id,
        name: user.name,
        positionId: user.positionId,
        positionName: user.positionName
      })),
    [props.workspaceUsers]
  );

  const matrix = useMonthlyResourceMatrix({
    readModel: props.readModel,
    workspaceUsers: matrixUsers,
    workspacePositions: props.workspacePositions,
    monthIso,
    productionCalendar: calendar.snapshot
      ? {
          workingWeekdays: calendar.snapshot.workingWeekdays,
          workingMinutesPerDay: calendar.snapshot.workingMinutesPerDay,
          exceptions: calendar.snapshot.exceptions
        }
      : undefined
  });

  const overloads = (props.readModel?.resourceLoad as { overloads?: Array<Record<string, unknown>> })
    ?.overloads ?? [];
  const hasMatrixContent =
    matrix.groups.length > 0 || matrix.unassignedRows.length > 0;

  return (
    <section className="planning-pane" data-testid="planning-resources-pane">
      <header className="planning-pane__header">
        <h2>Ресурсы</h2>
        <button className="secondary-button" type="button" onClick={props.onOpenAssignments}>
          Открыть в Назначениях
        </button>
      </header>
      {overloads.length > 0 ? (
        <p className="planning-pane__alert">Перегруз: {overloads.length} дней</p>
      ) : (
        <p className="planning-pane__muted">Перегруз не обнаружен.</p>
      )}
      {hasMatrixContent ? (
        <MonthlyResourceMatrix
          matrix={matrix}
          monthIso={monthIso}
          onMonthChange={handleMonthChange}
        />
      ) : (
        <p className="planning-pane__muted" data-testid="planning-resource-matrix-empty">
          Нет данных по ресурсам для отображения матрицы.
        </p>
      )}
      {!props.permissions.canManageProjectResources ? (
        <p title="Нужно право tenant.project_resources.manage">Только чтение ресурсов.</p>
      ) : null}
    </section>
  );
}

function readMonthFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const value = params.get("month");
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  return value;
}

function writeMonthToUrl(monthIso: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("month", monthIso);
  window.history.replaceState(null, "", url.toString());
}
