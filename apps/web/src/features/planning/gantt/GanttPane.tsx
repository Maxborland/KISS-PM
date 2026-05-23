"use client";

import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { useMemo } from "react";

import {
  readCalculatedProjectFinish,
  readProjectPlannedFinish,
  readProjectPlannedStart
} from "../planningReadModelAccess";
import { buildWbsRows } from "../grid/wbsRows";

const ROW_HEIGHT = 32;

export function GanttPane(props: {
  readModel: PlanningReadModel | undefined;
  zoom: "day" | "week" | "month";
}) {
  const rows = useMemo(() => buildWbsRows(props.readModel), [props.readModel]);
  const rangeStart = readProjectPlannedStart(props.readModel);
  const rangeFinish =
    readCalculatedProjectFinish(props.readModel) ?? readProjectPlannedFinish(props.readModel);
  const dayWidth = props.zoom === "day" ? 28 : props.zoom === "week" ? 14 : 8;

  return (
    <div className="planning-gantt-pane" data-testid="planning-gantt-pane">
      <div className="planning-gantt-timeline" data-zoom={props.zoom}>
        <span>{rangeStart ?? "—"}</span>
        <span>{rangeFinish ?? "—"}</span>
      </div>
      <div className="planning-gantt-canvas">
        <svg className="planning-gantt-deps" aria-hidden="true">
          {(props.readModel?.authored.dependencies ?? []).map((dependency) => (
            <line
              key={String(dependency.id)}
              x1={20}
              y1={12}
              x2={80}
              y2={28}
              className="planning-gantt-dep-line"
            />
          ))}
        </svg>
        {rows.map((row, index) => {
          const start = row.start ?? row.finish ?? rangeStart ?? "";
          const finish = row.finish ?? start;
          const left = start ? dayOffset(rangeStart ?? start, start) * dayWidth : index * 4;
          const width = Math.max(dayWidth, dayOffset(start || finish, finish || start) * dayWidth);
          return (
            <div
              key={row.id}
              className="planning-gantt-row"
              style={{ height: ROW_HEIGHT, transform: `translateY(${index * ROW_HEIGHT}px)` }}
            >
              {row.isCritical ? <span className="planning-gantt-critical-stripe" /> : null}
              <div
                className="planning-gantt-bar"
                style={{ left, width }}
                title={`${row.title}: ${start} — ${finish}`}
              />
              <div className="planning-gantt-baseline" style={{ left, width: width * 0.9 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function dayOffset(from: string, to: string): number {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}
