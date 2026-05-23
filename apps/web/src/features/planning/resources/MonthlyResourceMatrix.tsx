"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { CrossProjectTaskTooltip } from "./CrossProjectTaskTooltip";
import { MonthNavigation } from "./MonthNavigation";
import { ResourceDayDrawer } from "./ResourceDayDrawer";
import { ResourceMatrixOrgSection } from "./ResourceMatrixOrgSection";
import { ResourceMatrixRowGroup } from "./ResourceMatrixRowGroup";
import { isOrgCapacityTree, type OrgCapacityTree } from "./resourceMatrixTypes";
import { useCrossProjectTasks } from "./useCrossProjectTasks";
import type {
  MonthlyResourceMatrix as MatrixModel,
  ResourceMatrixGroup
} from "./resourceMatrixTypes";
import { aggregateResourceMatrixRowDays } from "./resourceMatrixTypes";
import {
  resourceMatrixGridTemplateColumns
} from "./resourceMatrixLayout";

export function MonthlyResourceMatrix(props: {
  matrix: MatrixModel | OrgCapacityTree;
  monthIso: string;
  onMonthChange: (monthIso: string) => void;
}) {
  const [hover, setHover] = useState<{
    resourceId: string;
    date: string;
    top: number;
    left: number;
  } | null>(null);
  const [drawerKey, setDrawerKey] = useState<{ resourceId: string; date: string } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const monthRange = useMemo(() => {
    if (props.matrix.days.length === 0) return null;
    return {
      fromDate: props.matrix.days[0]!.date,
      toDate: props.matrix.days[props.matrix.days.length - 1]!.date
    };
  }, [props.matrix.days]);

  const hoverLookup = useMemo(() => {
    if (!hover || !monthRange) return null;
    return {
      assigneeUserId: hover.resourceId,
      fromDate: monthRange.fromDate,
      toDate: monthRange.toDate
    };
  }, [hover, monthRange]);

  const drawerLookup = useMemo(() => {
    if (!drawerKey) return null;
    return {
      assigneeUserId: drawerKey.resourceId,
      fromDate: drawerKey.date,
      toDate: drawerKey.date
    };
  }, [drawerKey]);

  const hoverTasks = useCrossProjectTasks(hoverLookup);
  const drawerTasks = useCrossProjectTasks(drawerLookup);

  const handleHover = useCallback(
    (input: { resourceId: string; date: string } | null) => {
      if (!input) {
        setHover(null);
        return;
      }
      const viewport = viewportRef.current;
      if (!viewport) {
        setHover({ ...input, top: 80, left: 200 });
        return;
      }
      const cell = viewport.querySelector(
        `[data-testid="resource-matrix-cell-${input.resourceId}-${input.date}"]`
      );
      if (cell instanceof HTMLElement) {
        const rect = cell.getBoundingClientRect();
        setHover({ ...input, top: rect.bottom + 4, left: rect.left });
        return;
      }
      setHover({ ...input, top: 80, left: 200 });
    },
    []
  );

  const handleActivate = useCallback((input: { resourceId: string; date: string }) => {
    setDrawerKey(input);
  }, []);

  const orgMatrix = isOrgCapacityTree(props.matrix) ? props.matrix : null;

  const resourceNameByResourceId = useMemo(() => {
    const map = new Map<string, string>();
    if (orgMatrix) {
      for (const directionGroup of orgMatrix.orgGroups) {
        for (const unitGroup of directionGroup.units) {
          for (const positionGroup of unitGroup.positions) {
            for (const row of positionGroup.rows) map.set(row.user.id, row.user.name);
          }
        }
      }
      return map;
    }
    for (const group of props.matrix.groups) {
      for (const row of group.rows) map.set(row.user.id, row.user.name);
    }
    for (const row of props.matrix.unassignedRows) {
      map.set(row.user.id, row.user.name);
    }
    return map;
  }, [orgMatrix, props.matrix.groups, props.matrix.unassignedRows]);

  const gridTemplateColumns = resourceMatrixGridTemplateColumns(props.matrix.days.length);

  return (
    <div className="planning-resource-matrix" data-testid="planning-resource-matrix">
      <MonthNavigation monthIso={props.monthIso} onChange={props.onMonthChange} />
      <div className="planning-resource-matrix__viewport" ref={viewportRef}>
        <div className="planning-resource-matrix__grid" style={{ gridTemplateColumns }}>
          <div
            className="planning-resource-matrix__header"
            style={{ gridTemplateColumns }}
          >
            <div className="planning-resource-matrix__sticky-col">Ресурс</div>
            {props.matrix.days.map((day) => (
              <div
                key={day.date}
                className={[
                  "planning-resource-matrix__day-cell",
                  day.isHoliday ? "is-holiday" : day.isWeekend ? "is-weekend" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={day.date}
              >
                {parseDayLabel(day.date)}
              </div>
            ))}
          </div>
          {orgMatrix ? (
            <ResourceMatrixOrgSection
              orgGroups={orgMatrix.orgGroups}
              gridTemplateColumns={gridTemplateColumns}
              onActivate={handleActivate}
              onHover={handleHover}
            />
          ) : (
            props.matrix.groups.map((group) => (
              <ResourceMatrixRowGroup
                key={group.position.id}
                group={group}
                onActivate={handleActivate}
                onHover={handleHover}
              />
            ))
          )}
          {!orgMatrix && props.matrix.unassignedRows.length > 0 ? (
            <ResourceMatrixRowGroup
              group={buildUnassignedGroup(props.matrix)}
              onActivate={handleActivate}
              onHover={handleHover}
            />
          ) : null}
        </div>
      </div>

      <CrossProjectTaskTooltip
        isVisible={hover !== null}
        isLoading={hoverTasks.isLoading}
        error={hoverTasks.error}
        tasks={hoverTasks.tasks}
        position={hover ? { top: hover.top, left: hover.left } : null}
      />

      <ResourceDayDrawer
        open={drawerKey !== null}
        onOpenChange={(open) => {
          if (!open) setDrawerKey(null);
        }}
        resourceName={drawerKey ? resourceNameByResourceId.get(drawerKey.resourceId) ?? drawerKey.resourceId : null}
        date={drawerKey?.date ?? null}
        tasks={drawerTasks.tasks}
        isLoading={drawerTasks.isLoading}
        error={drawerTasks.error}
      />
    </div>
  );
}

function parseDayLabel(dateIso: string): string {
  return dateIso.slice(8, 10);
}

function buildUnassignedGroup(matrix: MatrixModel): ResourceMatrixGroup {
  return {
    position: { id: "__unassigned__", name: "Внешние ресурсы", users: [] },
    rows: matrix.unassignedRows,
    positionDays: aggregateResourceMatrixRowDays(matrix.days, matrix.unassignedRows)
  };
}
