import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlanningPreviewApplyBar, commandLabel } from "./PlanningPreviewApplyBar";
import { createPlanningReadModelFixture } from "./planningReadModel.test-utils";

describe("PlanningPreviewApplyBar", () => {
  it("renders preview version delta and enables apply when validation has no blocking issues", () => {
    const html = renderToStaticMarkup(
      <PlanningPreviewApplyBar
        previewState={{
          command: { type: "baseline.capture", payload: { baselineId: "baseline-a", label: "Baseline" } },
          preview: {
            before: createPlanningReadModelFixture({ planVersion: 3 }),
            after: createPlanningReadModelFixture({ planVersion: 4 }),
            planDelta: {},
            validationIssues: [],
            permissionPreview: { allowed: true, reason: "" },
            auditPreview: {
              actionType: "planning.baseline.capture",
              sourceWorkflow: "planning",
              planVersionBefore: 3,
              planVersionAfter: 4
            }
          }
        }}
        previewError=""
        applyError=""
        isPreviewPending={false}
        isApplyPending={false}
        canApply
        onApply={() => undefined}
        onCancel={() => undefined}
      />
    );

    expect(html).toContain("Фиксация baseline");
    expect(html).toContain("Версия 3");
    expect(html).toContain("Применить");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("keeps apply disabled when preview contains blocking validation", () => {
    const html = renderToStaticMarkup(
      <PlanningPreviewApplyBar
        previewState={{
          command: {
            type: "task.update_schedule",
            payload: {
              taskId: "task-a",
              plannedStart: "2026-06-10",
              plannedFinish: "2026-06-01"
            }
          },
          preview: {
            before: createPlanningReadModelFixture({ planVersion: 3 }),
            after: createPlanningReadModelFixture({ planVersion: 3 }),
            planDelta: {},
            validationIssues: [{
              code: "planning_command_invalid",
              severity: "error",
              message: "Финиш раньше старта",
              entity: { type: "task", id: "task-a" }
            }],
            permissionPreview: { allowed: true, reason: "" },
            auditPreview: {
              actionType: "planning.task.update_schedule",
              sourceWorkflow: "planning",
              planVersionBefore: 3,
              planVersionAfter: 3
            }
          }
        }}
        previewError=""
        applyError=""
        isPreviewPending={false}
        isApplyPending={false}
        canApply
        onApply={() => undefined}
        onCancel={() => undefined}
      />
    );

    expect(html).toContain("блокирующих замечаний: 1");
    expect(html).toContain("disabled=\"\"");
  });

  it("keeps labels stable for command types exposed by the planning engine", () => {
    expect(commandLabel("assignment.upsert")).toBe("Назначение ресурса");
    expect(commandLabel("project.deadline.move")).toBe("Перенос deadline");
  });
});
