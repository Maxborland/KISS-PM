"use client";

import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { useCallback, useMemo, useState } from "react";

import { SectionFeedback } from "../../../components/workspace-ui";
import type { PlanningPermissions } from "../hooks/usePlanningPermissions";
import { currentMonthIso, parseMonthIso } from "./monthIso";
import { MonthlyResourceMatrix } from "./MonthlyResourceMatrix";
import { countOverloadDays, isOrgCapacityTree } from "./resourceMatrixTypes";
import { useWorkspaceCapacityTree } from "./useWorkspaceCapacityTree";

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
  projectId: string;
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

  const canLoad = props.permissions.canReadProjectResources;
  const treeQuery = useWorkspaceCapacityTree(monthIso, canLoad, props.projectId);

  const matrix = treeQuery.data;
  const overloadCount = useMemo(
    () => (matrix && isOrgCapacityTree(matrix) ? countOverloadDays(matrix) : 0),
    [matrix]
  );

  const hasMatrixContent =
    matrix !== undefined &&
    isOrgCapacityTree(matrix) &&
    matrix.orgGroups.some((group) =>
      group.units.some((unit) => unit.positions.some((position) => position.rows.length > 0))
    );

  if (!props.permissions.canReadProjectResources) {
    return (
      <SectionFeedback
        state={{ canRead: false, isLoading: false, error: null }}
        emptyLabel="Нет права на чтение ресурсов проекта."
      />
    );
  }

  if (!props.permissions.canReadProjectPlan) {
    return (
      <SectionFeedback
        state={{ canRead: false, isLoading: false, error: null }}
        emptyLabel="Нет права на чтение плана проекта."
      />
    );
  }

  return (
    <section className="planning-pane" data-testid="planning-resources-pane">
      <header className="planning-pane__header">
        <h2>Ресурсы</h2>
        <button className="secondary-button" type="button" onClick={props.onOpenAssignments}>
          Открыть в Назначениях
        </button>
      </header>
      <p className="planning-pane__muted">
        Перегруз считается по суммарной загрузке сотрудника во всех проектах (employee-total).
      </p>
      {treeQuery.isLoading ? (
        <SectionFeedback state={{ canRead: true, isLoading: true, error: null }} emptyLabel="" />
      ) : null}
      {treeQuery.error ? (
        <SectionFeedback
          state={{
            canRead: true,
            isLoading: false,
            error:
              treeQuery.error instanceof Error ? treeQuery.error.message : "Ошибка загрузки матрицы"
          }}
          emptyLabel=""
        />
      ) : null}
      {matrix && !treeQuery.isLoading ? (
        <>
          {overloadCount > 0 ? (
            <p className="planning-pane__alert">Перегруз (employee-total): {overloadCount} ячеек</p>
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
        </>
      ) : null}
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
  return value ? parseMonthIso(value) : null;
}

function writeMonthToUrl(monthIso: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("month", monthIso);
  window.history.replaceState(null, "", url.toString());
}
