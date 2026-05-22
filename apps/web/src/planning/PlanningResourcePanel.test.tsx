import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  PlanningResourcePanel,
  buildResourceMatrixRows,
  buildResourceSheetRows,
  formatOverloadReason,
  overloadToScenarioTarget
} from "./PlanningResourcePanel";
import { createPlanningReadModelFixture } from "./planningReadModel.test-utils";

describe("PlanningResourcePanel", () => {
  it("renders resource sheet, load matrix and overload reason drilldown from backend read model", () => {
    const html = renderToStaticMarkup(
      <PlanningResourcePanel readModel={createPlanningReadModelFixture()} />
    );

    expect(html).toContain("Ресурсный лист");
    expect(html).toContain("Матрица загрузки");
    expect(html).toContain("planned / available / reserved / free / overload");
    expect(html).toContain("resource-alpha");
    expect(html).toContain("10 ч");
    expect(html).toContain("8 ч");
    expect(html).toContain("Причины перегруза");
    expect(html).toContain("Задача: task-a");
  });

  it("renders real scenario entry points for day overloads when preview is allowed", () => {
    const html = renderToStaticMarkup(
      <PlanningResourcePanel
        readModel={createPlanningReadModelFixture()}
        canPreviewScenarios={true}
        onScenarioTarget={() => undefined}
      />
    );

    expect(html).toContain("Сценарии");
    expect(html).toContain("Построить сценарии для этого перегруза");
  });

  it("builds resource sheet rows without computing new planning facts", () => {
    const rows = buildResourceSheetRows(createPlanningReadModelFixture());

    expect(rows).toEqual([{
      resourceId: "resource-alpha",
      positionId: "position-engineer",
      teamId: null,
      assignedMinutes: 600,
      capacityMinutes: 480,
      reservedMinutes: 60,
      freeMinutes: 0,
      overloadMinutes: 180,
      taskCount: 1,
      assignmentCount: 1,
      reservationCount: 1,
      calendarExceptionCount: 0
    }]);
  });

  it("deduplicates task, assignment, reservation and exception counts across day buckets", () => {
    const base = createPlanningReadModelFixture();
    const firstBucket = base.resourceLoad.buckets[0];
    if (!firstBucket) throw new Error("Resource fixture must include a day bucket");
    const rows = buildResourceSheetRows(createPlanningReadModelFixture({
      resourceLoad: {
        ...base.resourceLoad,
        buckets: [
          firstBucket,
          {
            ...firstBucket,
            date: "2026-06-02",
            assignedMinutes: 120,
            capacityMinutes: 480,
            reservedMinutes: 0,
            freeMinutes: 360
          }
        ]
      }
    }));

    expect(rows[0]?.taskCount).toBe(1);
    expect(rows[0]?.assignmentCount).toBe(1);
    expect(rows[0]?.reservationCount).toBe(1);
  });

  it("keeps day, week and month matrix rows separated by backend granularity", () => {
    const readModel = createPlanningReadModelFixture({
      resourceLoad: {
        buckets: [
          ...createPlanningReadModelFixture().resourceLoad.buckets,
          {
            resourceId: "resource-alpha",
            positionId: "position-engineer",
            teamId: null,
            projectId: "project-alpha",
            date: "2026-W23",
            granularity: "week",
            assignedMinutes: 1200,
            reservedMinutes: 60,
            capacityMinutes: 2400,
            freeMinutes: 1140,
            taskIds: ["task-a"],
            assignmentIds: ["assignment-a"],
            reservationIds: ["reservation-a"],
            calendarExceptionIds: []
          },
          {
            resourceId: "resource-alpha",
            positionId: "position-engineer",
            teamId: null,
            projectId: "project-alpha",
            date: "2026-06",
            granularity: "month",
            assignedMinutes: 2400,
            reservedMinutes: 60,
            capacityMinutes: 9600,
            freeMinutes: 7140,
            taskIds: ["task-a"],
            assignmentIds: ["assignment-a"],
            reservationIds: ["reservation-a"],
            calendarExceptionIds: []
          }
        ],
        overloads: [],
        freeCapacityBuckets: []
      }
    });

    expect(buildResourceMatrixRows(readModel, "day")).toHaveLength(1);
    expect(buildResourceMatrixRows(readModel, "week")[0]?.bucketStart).toBe("2026-W23");
    expect(buildResourceMatrixRows(readModel, "month")[0]?.bucketStart).toBe("2026-06");
  });

  it("uses backend overload rows instead of recomputing overloads from matrix buckets", () => {
    const base = createPlanningReadModelFixture();
    const firstBucket = base.resourceLoad.buckets[0];
    if (!firstBucket) throw new Error("Resource fixture must include a day bucket");
    const readModel = createPlanningReadModelFixture({
      resourceLoad: {
        ...base.resourceLoad,
        buckets: [{
          ...firstBucket,
          assignedMinutes: 600,
          reservedMinutes: 60,
          capacityMinutes: 480
        }],
        overloads: []
      }
    });

    expect(buildResourceMatrixRows(readModel, "day")[0]?.overloadMinutes).toBe(0);
  });

  it("formats overload reason types in Russian user language", () => {
    expect(formatOverloadReason({ type: "assignment", id: "assignment-a" })).toBe("Назначение: assignment-a");
    expect(formatOverloadReason({ type: "reservation", id: "reservation-a" })).toBe("Резерв: reservation-a");
    expect(formatOverloadReason({ type: "calendar_exception", id: "exception-a" })).toBe("Исключение календаря: exception-a");
  });

  it("converts overload drilldown rows into scenario targets", () => {
    const overload = createPlanningReadModelFixture().resourceLoad.overloads[0];
    if (!overload) throw new Error("Resource fixture must include an overload");

    expect(overloadToScenarioTarget(overload)).toEqual({
      type: "resource_overload",
      resourceId: "resource-alpha",
      date: "2026-06-01",
      overloadMinutes: 180,
      taskIds: ["task-a"]
    });
  });
});
