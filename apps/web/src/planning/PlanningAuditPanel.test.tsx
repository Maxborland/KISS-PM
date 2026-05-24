import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AuditEvent } from "../api";
import {
  PlanningAuditPanel,
  filterPlanningAuditEvents,
  formatPlanVersionChange
} from "./PlanningAuditPanel";

describe("PlanningAuditPanel", () => {
  it("renders a permission explanation without audit read access", () => {
    const html = renderToStaticMarkup(
      <PlanningAuditPanel
        projectId="project-alpha"
        auditEvents={[]}
        canReadAudit={false}
        isLoading={false}
        error={null}
      />
    );

    expect(html).toContain("Нужно право tenant.audit_events.read");
  });

  it("renders planning audit rows for the current project only", () => {
    const html = renderToStaticMarkup(
      <PlanningAuditPanel
        projectId="project-alpha"
        auditEvents={[
          auditEventFixture("event-a", "project-alpha", "planning.baseline.captured"),
          auditEventFixture("event-b", "project-beta", "planning.task.updated")
        ]}
        canReadAudit={true}
        isLoading={false}
        error={null}
      />
    );

    expect(html).toContain("Baseline зафиксирован");
    expect(html).toContain("planVersion 3 -&gt; 4");
    expect(html).not.toContain("project-beta");
  });

  it("filters only planning events for the selected project", () => {
    expect(filterPlanningAuditEvents([
      auditEventFixture("event-a", "project-alpha", "planning.task.updated"),
      auditEventFixture("event-b", "project-alpha", "task.status_changed"),
      auditEventFixture("event-c", "project-beta", "planning.task.updated")
    ], "project-alpha").map((event) => event.id)).toEqual(["event-a"]);
  });

  it("formats planVersion evidence from audit snapshots", () => {
    expect(formatPlanVersionChange(auditEventFixture(
      "event-a",
      "project-alpha",
      "planning.task.updated"
    ))).toBe("planVersion 3 -> 4");
  });
});

function auditEventFixture(
  id: string,
  projectId: string,
  actionType: string
): AuditEvent {
  return {
    id,
    tenantId: "tenant-alpha",
    actorUserId: "user-alpha",
    actionType,
    sourceWorkflow: "planning",
    sourceEntity: { type: "Project", id: projectId },
    beforeState: { planVersion: 3 },
    afterState: { planVersion: 4 },
    correlationId: "correlation-a",
    createdAt: "2026-06-01T10:00:00.000Z"
  };
}
