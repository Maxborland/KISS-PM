import { describe, expect, it } from "vitest";

import {
  createRetrospectiveInsights,
  markRetrospectiveInsightHandled,
  readRetrospectiveInsight,
  type ClosedProjectSnapshot,
  type RetrospectiveTrend
} from "./index";

function snapshotFixture(input: {
  id: string;
  tenantId?: string;
  lessonSeverity?: "positive" | "attention" | "critical";
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
        accountId: "client-a",
        contactIds: [],
        plannedStartDate: "2026-05-01",
        desiredFinishDate: "2026-05-10"
      },
      processTemplate: {
        templateId: "template-delivery",
        key: "delivery.standard",
        label: "Delivery",
        version: 3
      }
    },
    closure: {
      decisionId: `${input.id}-closure`,
      actorId: "user-project-manager-a",
      closedAt: "2026-05-20T09:00:00+07:00",
      auditEventId: `${input.id}-audit`,
      lessonsLearned: [
        {
          id: `${input.id}-lesson`,
          categoryKey: "template",
          summary: "Добавить раннюю проверку шаблона поставки.",
          recommendation: "Обновить шаблон будущих проектов.",
          severity: input.lessonSeverity ?? "attention"
        }
      ]
    },
    metrics: {
      stageCount: 2,
      completedStageCount: 2,
      taskCount: 4,
      openTaskCount: 0,
      plannedWorkHours: 100
    },
    scheduleSummary: {
      plannedStartDate: "2026-05-01",
      plannedFinishDate: "2026-05-10",
      actualFinishDate: "2026-05-12"
    },
    resourceSummary: {
      plannedWorkHours: 100,
      actualWorkHours: 125,
      overloadCount: 1
    },
    kpiSummary: [],
    sourceRefs: [{ type: "project", id: `${input.id}-project` }]
  };
}

function trendFixture(input: {
  id: string;
  tenantId?: string;
  severity?: "attention" | "warning" | "critical";
  sourceSnapshotIds?: string[];
}): RetrospectiveTrend {
  const sourceSnapshotIds = input.sourceSnapshotIds ?? ["snapshot-a", "snapshot-b"];
  return {
    id: input.id,
    tenantId: input.tenantId ?? "tenant-a",
    trendKey: "work_variance",
    groupBy: "template",
    groupKey: "template-delivery",
    occurrenceCount: 2,
    severity: input.severity ?? "warning",
    averageVarianceValue: 25,
    averageVariancePercent: 25,
    sourceSnapshotIds,
    sourceMetricIds: sourceSnapshotIds.map((snapshotId) => `${snapshotId}:work_hours`)
  };
}

describe("retrospective insight model", () => {
  it("derives actionable tenant-scoped insights with snapshot, trend, and lesson trace", () => {
    const insights = createRetrospectiveInsights({
      tenantId: "tenant-a",
      generatedAt: "2026-05-21T09:00:00+07:00",
      trends: [trendFixture({ id: "trend-work-variance" })],
      snapshots: [snapshotFixture({ id: "snapshot-a" }), snapshotFixture({ id: "snapshot-b", lessonSeverity: "critical" })]
    });

    expect(insights).toHaveLength(1);
    expect(insights[0]).toMatchObject({
      id: "insight-trend-work-variance",
      tenantId: "tenant-a",
      status: "open",
      severity: "critical",
      title: "Recurring work variance for template template-delivery",
      recommendation: "Обновить шаблон будущих проектов.",
      sourceTrendId: "trend-work-variance",
      sourceSnapshotIds: ["snapshot-a", "snapshot-b"],
      sourceLessonIds: ["snapshot-a:snapshot-a-lesson", "snapshot-b:snapshot-b-lesson"]
    });
  });

  it("returns immutable insight readback after source objects are mutated", () => {
    const snapshot = snapshotFixture({ id: "snapshot-stable" });
    const trend = trendFixture({ id: "trend-stable", sourceSnapshotIds: ["snapshot-stable"] });
    const [insight] = createRetrospectiveInsights({
      tenantId: "tenant-a",
      generatedAt: "2026-05-21T09:00:00+07:00",
      trends: [trend],
      snapshots: [snapshot]
    });
    if (insight === undefined) throw new Error("fixture should create insight");

    snapshot.closure.lessonsLearned[0]!.summary = "Поздняя правка";
    (trend as unknown as { sourceSnapshotIds: string[] }).sourceSnapshotIds = ["mutated"];

    const readback = readRetrospectiveInsight(insight);

    expect(readback.sourceSnapshotIds).toEqual(["snapshot-stable"]);
    expect(readback.sourceLessons[0]?.summary).toBe("Добавить раннюю проверку шаблона поставки.");
  });

  it("marks an insight handled only with governed action and audit evidence", () => {
    const [insight] = createRetrospectiveInsights({
      tenantId: "tenant-a",
      generatedAt: "2026-05-21T09:00:00+07:00",
      trends: [trendFixture({ id: "trend-handled", sourceSnapshotIds: ["snapshot-a"] })],
      snapshots: [snapshotFixture({ id: "snapshot-a" })]
    });
    if (insight === undefined) throw new Error("fixture should create insight");

    expect(() =>
      markRetrospectiveInsightHandled(insight, {
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        handledAt: "2026-05-21T10:00:00+07:00",
        commandType: "template_improvement.apply",
        actionExecutionId: "",
        auditEventId: "audit-improvement"
      })
    ).toThrow(/actionExecutionId/);

    const handled = markRetrospectiveInsightHandled(insight, {
      tenantId: "tenant-a",
      actorId: "tenant-admin-a",
      handledAt: "2026-05-21T10:00:00+07:00",
      commandType: "template_improvement.apply",
      actionExecutionId: "action-template-improvement",
      auditEventId: "audit-improvement"
    });

    expect(handled).toMatchObject({
      status: "handled",
      handledBy: "tenant-admin-a",
      handledAt: "2026-05-21T10:00:00+07:00",
      handledByAction: {
        commandType: "template_improvement.apply",
        actionExecutionId: "action-template-improvement",
        auditEventId: "audit-improvement"
      }
    });
    expect(() =>
      markRetrospectiveInsightHandled(handled, {
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        handledAt: "2026-05-21T11:00:00+07:00",
        commandType: "template_improvement.apply",
        actionExecutionId: "action-second",
        auditEventId: "audit-second"
      })
    ).toThrow(/already handled/);
  });

  it("rejects cross-tenant trend or snapshot sources before returning insight data", () => {
    expect(() =>
      createRetrospectiveInsights({
        tenantId: "tenant-a",
        generatedAt: "2026-05-21T09:00:00+07:00",
        trends: [trendFixture({ id: "trend-tenant-b", tenantId: "tenant-b" })],
        snapshots: [snapshotFixture({ id: "snapshot-a" })]
      })
    ).toThrow(/tenant/);

    expect(() =>
      createRetrospectiveInsights({
        tenantId: "tenant-a",
        generatedAt: "2026-05-21T09:00:00+07:00",
        trends: [trendFixture({ id: "trend-cross-snapshot" })],
        snapshots: [snapshotFixture({ id: "snapshot-a", tenantId: "tenant-b" })]
      })
    ).toThrow(/tenant/);
  });

  it("does not create weak insights without actionable severity and source snapshot trace", () => {
    expect(
      createRetrospectiveInsights({
        tenantId: "tenant-a",
        generatedAt: "2026-05-21T09:00:00+07:00",
        trends: [trendFixture({ id: "trend-none", severity: "attention" })],
        snapshots: [snapshotFixture({ id: "snapshot-a" }), snapshotFixture({ id: "snapshot-b" })]
      })
    ).toHaveLength(1);

    expect(
      createRetrospectiveInsights({
        tenantId: "tenant-a",
        generatedAt: "2026-05-21T09:00:00+07:00",
        trends: [{ ...trendFixture({ id: "trend-not-actionable" }), severity: "none" }],
        snapshots: [
          snapshotFixture({ id: "snapshot-a", lessonSeverity: "positive" }),
          snapshotFixture({ id: "snapshot-b", lessonSeverity: "positive" })
        ]
      })
    ).toEqual([]);

    expect(() =>
      createRetrospectiveInsights({
        tenantId: "tenant-a",
        generatedAt: "2026-05-21T09:00:00+07:00",
        trends: [{ ...trendFixture({ id: "trend-no-source" }), sourceSnapshotIds: [], sourceMetricIds: [] }],
        snapshots: []
      })
    ).toThrow(/sourceSnapshotIds/);
  });
});
