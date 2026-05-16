import { describe, expect, it } from "vitest";

import {
  buildRetrospectiveTrends,
  calculatePlanFactMetrics,
  type ClosedProjectSnapshot
} from "./index";

function snapshotFixture(input: {
  id: string;
  tenantId?: string;
  templateId?: string;
  templateKey?: string;
  accountId?: string;
  closedAt?: string;
  plannedStartDate?: string;
  plannedFinishDate?: string;
  actualFinishDate?: string;
  plannedWorkHours?: number;
  actualWorkHours?: number;
  overloadCount?: number;
  kpiSeverity?: "none" | "attention" | "warning" | "critical";
}): ClosedProjectSnapshot {
  return {
    id: input.id,
    tenantId: input.tenantId ?? "tenant-a",
    projectId: `${input.id}-project`,
    version: 1,
    capturedAt: "2026-05-20T10:00:00+07:00",
    project: {
      title: `${input.id} project`,
      lifecycleStatus: "completed",
      sourceDraftId: `${input.id}-draft`,
      sourceOpportunity: {
        type: "crm_opportunity",
        opportunityId: `${input.id}-opportunity`,
        ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
        contactIds: [],
        plannedStartDate: input.plannedStartDate ?? "2026-05-01",
        desiredFinishDate: input.plannedFinishDate ?? "2026-05-10"
      },
      processTemplate: {
        templateId: input.templateId ?? "template-delivery",
        key: input.templateKey ?? "delivery.standard",
        label: "Delivery",
        version: 3
      }
    },
    closure: {
      decisionId: `${input.id}-closure`,
      actorId: "user-project-manager-a",
      closedAt: input.closedAt ?? "2026-05-20T09:00:00+07:00",
      auditEventId: `${input.id}-audit`,
      qualityScore: 4,
      clientSatisfactionScore: 4,
      lessonsLearned: []
    },
    metrics: {
      stageCount: 2,
      completedStageCount: 2,
      taskCount: 4,
      openTaskCount: 0,
      plannedWorkHours: input.plannedWorkHours ?? 100
    },
    scheduleSummary: {
      plannedStartDate: input.plannedStartDate ?? "2026-05-01",
      plannedFinishDate: input.plannedFinishDate ?? "2026-05-10",
      actualFinishDate: input.actualFinishDate ?? "2026-05-12"
    },
    resourceSummary: {
      plannedWorkHours: input.plannedWorkHours ?? 100,
      actualWorkHours: input.actualWorkHours ?? 125,
      overloadCount: input.overloadCount ?? 1
    },
    kpiSummary: [
      {
        evaluationId: `${input.id}-kpi`,
        definitionId: "kpi-schedule-variance",
        definitionVersion: 1,
        value: 12,
        severity: input.kpiSeverity ?? "warning",
        evaluatedAt: "2026-05-20T08:00:00+07:00"
      }
    ],
    sourceRefs: [{ type: "project", id: `${input.id}-project` }]
  };
}

describe("retrospective plan/fact metrics and trends", () => {
  it("calculates deterministic plan/fact variance metrics from one closed snapshot", () => {
    const metrics = calculatePlanFactMetrics(
      snapshotFixture({
        id: "snapshot-a",
        plannedStartDate: "2026-05-01",
        plannedFinishDate: "2026-05-10",
        actualFinishDate: "2026-05-13",
        plannedWorkHours: 100,
        actualWorkHours: 130,
        overloadCount: 2,
        kpiSeverity: "critical"
      })
    );

    expect(metrics).toMatchObject([
      {
        id: "snapshot-a:work_hours",
        tenantId: "tenant-a",
        snapshotId: "snapshot-a",
        metricKey: "work_hours",
        plannedValue: 100,
        actualValue: 130,
        varianceValue: 30,
        variancePercent: 30,
        severity: "warning",
        sourceSnapshotIds: ["snapshot-a"]
      },
      {
        id: "snapshot-a:schedule_days",
        metricKey: "schedule_days",
        plannedValue: 10,
        actualValue: 13,
        varianceValue: 3,
        variancePercent: 30,
        severity: "warning",
        sourceSnapshotIds: ["snapshot-a"]
      },
      {
        id: "snapshot-a:overload_count",
        metricKey: "overload_count",
        plannedValue: 0,
        actualValue: 2,
        varianceValue: 2,
        severity: "warning",
        sourceSnapshotIds: ["snapshot-a"]
      },
      {
        id: "snapshot-a:kpi_drift",
        metricKey: "kpi_drift",
        plannedValue: 0,
        actualValue: 1,
        varianceValue: 1,
        severity: "critical",
        sourceSnapshotIds: ["snapshot-a"]
      }
    ]);
  });

  it("builds tenant-scoped recurring trend signals grouped by template, client, period, and project type", () => {
    const snapshots = [
      snapshotFixture({ id: "snapshot-a", templateId: "template-a", accountId: "client-a", closedAt: "2026-05-20T09:00:00+07:00" }),
      snapshotFixture({ id: "snapshot-b", templateId: "template-a", accountId: "client-a", closedAt: "2026-05-25T09:00:00+07:00", actualWorkHours: 140, actualFinishDate: "2026-05-15" }),
      snapshotFixture({ id: "snapshot-c", tenantId: "tenant-b", templateId: "template-b", accountId: "client-b" })
    ];

    const templateTrends = buildRetrospectiveTrends({ tenantId: "tenant-a", snapshots, groupBy: "template" });
    const clientTrends = buildRetrospectiveTrends({ tenantId: "tenant-a", snapshots, groupBy: "client" });
    const periodTrends = buildRetrospectiveTrends({ tenantId: "tenant-a", snapshots, groupBy: "period" });
    const projectTypeTrends = buildRetrospectiveTrends({ tenantId: "tenant-a", snapshots, groupBy: "project_type" });

    expect(templateTrends.map((trend) => trend.id)).toEqual([
      "tenant-a:template:template-a:kpi_drift",
      "tenant-a:template:template-a:overload",
      "tenant-a:template:template-a:schedule_delay",
      "tenant-a:template:template-a:work_variance"
    ]);
    expect(templateTrends[0]).toMatchObject({
      tenantId: "tenant-a",
      groupBy: "template",
      groupKey: "template-a",
      sourceSnapshotIds: ["snapshot-a", "snapshot-b"],
      occurrenceCount: 2,
      severity: "warning"
    });
    expect(clientTrends[0]?.groupKey).toBe("client-a");
    expect(periodTrends[0]?.groupKey).toBe("2026-05");
    expect(projectTypeTrends[0]?.groupKey).toBe("delivery.standard");
    expect(templateTrends.some((trend) => trend.sourceSnapshotIds.includes("snapshot-c"))).toBe(false);
  });

  it("returns stable trend read models after input snapshots are mutated later", () => {
    const snapshots = [
      snapshotFixture({ id: "snapshot-stable-a", actualWorkHours: 130 }),
      snapshotFixture({ id: "snapshot-stable-b", actualWorkHours: 140 })
    ];

    const trends = buildRetrospectiveTrends({ tenantId: "tenant-a", snapshots, groupBy: "template" });
    snapshots[0]!.resourceSummary.actualWorkHours = 1;
    (snapshots[0]!.project.processTemplate as { templateId: string }).templateId = "template-mutated";

    expect(trends.find((trend) => trend.trendKey === "work_variance")).toMatchObject({
      groupKey: "template-delivery",
      sourceSnapshotIds: ["snapshot-stable-a", "snapshot-stable-b"],
      averageVariancePercent: 35
    });
  });

  it("rejects invalid or cross-tenant trend inputs without returning partial data", () => {
    expect(() =>
      calculatePlanFactMetrics(
        snapshotFixture({
          id: "snapshot-invalid",
          plannedStartDate: "bad-date",
          plannedFinishDate: "2026-05-10",
          actualFinishDate: "2026-05-12"
        })
      )
    ).toThrow(/scheduleSummary/);

    expect(() =>
      buildRetrospectiveTrends({
        tenantId: "tenant-a",
        snapshots: [snapshotFixture({ id: "snapshot-cross", tenantId: "tenant-b" })],
        groupBy: "template"
      })
    ).toThrow(/tenant/);

    expect(() =>
      buildRetrospectiveTrends({
        tenantId: "tenant-a",
        snapshots: [snapshotFixture({ id: "snapshot-bad-period", closedAt: "not-a-timestamp" })],
        groupBy: "period"
      })
    ).toThrow(/closedAt/);

    expect(() =>
      buildRetrospectiveTrends({
        tenantId: "tenant-a",
        snapshots: [snapshotFixture({ id: "snapshot-bad-group" })],
        groupBy: "portfolio" as never
      })
    ).toThrow(/groupBy/);
  });
});
