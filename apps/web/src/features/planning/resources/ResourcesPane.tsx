"use client";

import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { useCallback, useMemo, useState } from "react";

import {
  hasOrgDirections,
  useOrgStructure,
  type OrgStructureTrack
} from "../../org-structure/useOrgStructure";
import {
  computeOrgMonthlyResourceMatrix,
  type OrgMonthlyResourceMatrix
} from "./computeOrgResourceMatrix";

import { useAbsences } from "../../absences/useAbsences";
import { useProductionCalendar } from "../../production-calendar/useProductionCalendar";
import type { PlanningPermissions } from "../hooks/usePlanningPermissions";
import { MonthlyResourceMatrix, currentMonthIso } from "./MonthlyResourceMatrix";
import {
  computeMonthlyResourceMatrix,
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
  const [orgTrack, setOrgTrack] = useState<OrgStructureTrack>("functional");

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

  const monthRange = useMemo(() => monthIsoToDateRange(monthIso), [monthIso]);
  const absencesQuery = useAbsences(
    monthRange.fromDate,
    monthRange.toDate,
    props.permissions.canReadAbsences
  );
  const canReadOrgStructure = props.permissions.canReadOrgStructure;
  const orgStructureQuery = useOrgStructure(canReadOrgStructure);

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

  const matrixInput = useMemo(
    () => ({
      readModel: props.readModel,
      workspaceUsers: matrixUsers,
      workspacePositions: props.workspacePositions,
      monthIso,
      absences: absencesQuery.absences,
      productionCalendar: calendar.snapshot
        ? {
            workingWeekdays: calendar.snapshot.workingWeekdays,
            workingMinutesPerDay: calendar.snapshot.workingMinutesPerDay,
            exceptions: calendar.snapshot.exceptions
          }
        : undefined
    }),
    [
      absencesQuery.absences,
      calendar.snapshot,
      matrixUsers,
      monthIso,
      props.readModel,
      props.workspacePositions
    ]
  );

  const matrix = useMemo(() => {
    if (orgStructureQuery.orgStructure && hasOrgDirections(orgStructureQuery.orgStructure, orgTrack)) {
      return computeOrgMonthlyResourceMatrix({
        ...matrixInput,
        orgTrack,
        orgStructure: orgStructureQuery.orgStructure
      });
    }
    return computeMonthlyResourceMatrix(matrixInput);
  }, [matrixInput, orgStructureQuery.orgStructure, orgTrack]);

  const overloads = (props.readModel?.resourceLoad as { overloads?: Array<Record<string, unknown>> })
    ?.overloads ?? [];
  const orgGroups = isOrgMatrix(matrix) ? matrix.orgGroups : [];
  const hasMatrixContent =
    orgGroups.length > 0 || matrix.groups.length > 0 || matrix.unassignedRows.length > 0;
  const showOrgTrackToggle =
    canReadOrgStructure &&
    (hasOrgDirections(orgStructureQuery.orgStructure, "functional") ||
      hasOrgDirections(orgStructureQuery.orgStructure, "project"));

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
      {showOrgTrackToggle ? (
        <div className="planning-resource-matrix__track-toggle" data-testid="resource-matrix-track-toggle">
          <button
            type="button"
            className={orgTrack === "functional" ? "primary-button" : "secondary-button"}
            onClick={() => setOrgTrack("functional")}
          >
            Функциональная структура
          </button>
          <button
            type="button"
            className={orgTrack === "project" ? "primary-button" : "secondary-button"}
            onClick={() => setOrgTrack("project")}
          >
            Проектная структура
          </button>
        </div>
      ) : null}
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

function monthIsoToDateRange(monthIso: string): { fromDate: string; toDate: string } {
  const [yearText, monthText] = monthIso.split("-");
  const year = Number.parseInt(yearText ?? "", 10);
  const monthIndex = Number.parseInt(monthText ?? "", 10) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    const fallback = currentMonthIso();
    return monthIsoToDateRange(fallback);
  }
  const fromDate = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const toDate = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { fromDate, toDate };
}

function isOrgMatrix(
  matrix: ReturnType<typeof computeMonthlyResourceMatrix> | OrgMonthlyResourceMatrix
): matrix is OrgMonthlyResourceMatrix {
  return "hierarchyMode" in matrix && matrix.hierarchyMode === "org";
}

function writeMonthToUrl(monthIso: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("month", monthIso);
  window.history.replaceState(null, "", url.toString());
}
