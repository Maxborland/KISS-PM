import { describe, expect, it } from "vitest";

import {
  changeTaskStatus,
  closeManagedProjectWithClosure,
  createManagedProjectFromDraft,
  createProcessTemplate,
  createProjectDraftFromOpportunity,
  createTaskFromStageTaskTemplate
} from "@kiss-pm/project-core";

import { createClosedProjectSnapshot, readClosedProjectSnapshot } from "./index";

const tenantId = "tenant-a";

function makeClosedProjectFixture() {
  const draft = createProjectDraftFromOpportunity({
    id: "project-draft-retro",
    tenantId,
    title: "Ретро проект",
    createdBy: "user-project-manager-a",
    createdAt: "2026-05-15T05:00:00+07:00",
    correlationId: "corr-retro-draft",
    sourceOpportunity: {
      tenantId,
      type: "crm_opportunity",
      opportunityId: "opportunity-retro",
      title: "Ретро проект",
      contactIds: [],
      plannedStartDate: "2026-06-01",
      desiredFinishDate: "2026-06-30"
    },
    processTemplate: {
      tenantId,
      templateId: "process-template-retro",
      key: "implementation.retro",
      label: "Ретро процесс",
      version: 4,
      matchConfidence: 1,
      assumptions: []
    },
    demand: {
      tenantId,
      totalPlannedWorkHours: 20,
      scenarioKey: "baseline",
      scenarioLabel: "Базовый сценарий",
      formulaKey: "phase3.template_scope_linear",
      formulaVersion: 1,
      confidence: 1,
      stageRoleDemands: []
    },
    feasibility: {
      tenantId,
      status: "fit",
      severity: "none",
      expectedWindow: { startDate: "2026-06-01", endDate: "2026-06-30" },
      blockerCodes: []
    }
  });
  const processTemplate = createProcessTemplate({
    id: "process-template-retro",
    tenantId,
    key: "implementation.retro",
    label: "Ретро процесс",
    active: true,
    version: 4,
    updatedAt: "2026-05-15T05:01:00+07:00",
    stages: [
      {
        id: "stage-delivery",
        tenantId,
        key: "delivery",
        label: "Исполнение",
        sortOrder: 10,
        active: true,
        version: 2,
        updatedAt: "2026-05-15T05:01:00+07:00",
        requiredArtifactTemplates: [],
        approvalTemplates: [],
        taskTemplates: [
          {
            id: "task-delivery",
            tenantId,
            key: "delivery_package",
            label: "Комплект",
            defaultParticipantRoleKeys: ["executor"],
            required: true
          }
        ]
      }
    ]
  });
  const project = createManagedProjectFromDraft({
    id: "project-retro",
    draft,
    processTemplate,
    createdBy: "user-project-manager-a",
    createdAt: "2026-05-15T05:02:00+07:00",
    correlationId: "corr-retro-project"
  });
  const withTask = createTaskFromStageTaskTemplate(project, {
    id: "task-delivery",
    tenantId,
    stageId: "project-retro:stage-delivery",
    taskTemplateId: "task-delivery",
    taskTemplateKey: "delivery_package",
    dueDate: "2026-06-30",
    plannedWorkHours: 20,
    actorId: "user-project-manager-a",
    createdAt: "2026-05-15T05:03:00+07:00",
    correlationId: "corr-retro-task"
  });
  const done = changeTaskStatus(withTask, {
    id: "task-delivery-done",
    tenantId,
    taskId: "task-delivery",
    toStatus: "done",
    actorId: "user-project-manager-a",
    changedAt: "2026-05-15T05:04:00+07:00",
    correlationId: "corr-retro-task-done"
  });

  const closed = closeManagedProjectWithClosure(done, {
    id: "closure-decision-retro",
    tenantId,
    actorId: "user-project-manager-a",
    checklist: {
      id: "closure-checklist-retro",
      tenantId,
      projectId: "project-retro",
      version: 1,
      requirements: [
        {
          id: "closure-req-summary",
          tenantId,
          key: "final_kpi_summary",
          label: "Итог KPI",
          field: "final_kpi_summary",
          required: true
        }
      ]
    },
    closureData: {
      tenantId,
      projectId: "project-retro",
      finalKpiSummary: "Проект закрыт в допустимых KPI.",
      qualityScore: 5,
      clientSatisfactionScore: 4,
      lessonsLearned: [
        {
          id: "lesson-template",
          categoryKey: "template",
          summary: "Шаблон стадии сработал стабильно.",
          severity: "positive"
        }
      ]
    },
    closedAt: "2026-05-15T05:05:00+07:00",
    correlationId: "corr-retro-close",
    auditEventId: "audit-retro-close"
  });
  if (!closed.ok) throw new Error("fixture project should close");

  return closed;
}

describe("closed project snapshot foundation", () => {
  it("captures a tenant-scoped immutable closure snapshot with source refs", () => {
    const closed = makeClosedProjectFixture();

    const snapshot = createClosedProjectSnapshot({
      id: "snapshot-retro-1",
      version: 1,
      capturedAt: "2026-05-15T05:06:00+07:00",
      project: closed.project,
      closureDecision: closed.closureDecision,
      scheduleSummary: {
        baselineId: "baseline-retro",
        plannedStartDate: "2026-06-01",
        plannedFinishDate: "2026-06-30",
        actualFinishDate: "2026-06-28"
      },
      resourceSummary: {
        plannedWorkHours: 20,
        actualWorkHours: 18,
        overloadCount: 0
      },
      kpiSummary: [
        {
          evaluationId: "kpi-eval-retro",
          definitionId: "kpi-schedule-variance",
          definitionVersion: 2,
          value: -2,
          severity: "none",
          evaluatedAt: "2026-05-15T05:05:30+07:00"
        }
      ]
    });

    expect(snapshot).toMatchObject({
      id: "snapshot-retro-1",
      tenantId,
      projectId: "project-retro",
      version: 1,
      project: {
        title: "Ретро проект",
        lifecycleStatus: "completed",
        processTemplate: {
          templateId: "process-template-retro",
          version: 4
        }
      },
      closure: {
        decisionId: "closure-decision-retro",
        auditEventId: "audit-retro-close"
      },
      metrics: {
        stageCount: 1,
        completedStageCount: 1,
        taskCount: 1,
        openTaskCount: 0,
        plannedWorkHours: 20
      }
    });
    expect(snapshot.sourceRefs.map((ref) => ref.type)).toEqual([
      "project",
      "process_template",
      "closure_decision",
      "schedule_baseline",
      "kpi_evaluation"
    ]);
  });

  it("does not change after source project objects are mutated later", () => {
    const closed = makeClosedProjectFixture();
    const snapshot = createClosedProjectSnapshot({
      id: "snapshot-retro-stable",
      version: 1,
      capturedAt: "2026-05-15T05:06:00+07:00",
      project: closed.project,
      closureDecision: closed.closureDecision,
      scheduleSummary: {
        plannedStartDate: "2026-06-01",
        plannedFinishDate: "2026-06-30"
      },
      resourceSummary: {
        plannedWorkHours: 20,
        actualWorkHours: 18,
        overloadCount: 0
      },
      kpiSummary: []
    });

    closed.project.tasks[0]!.plannedWorkHours = 999;
    closed.project.processTemplateSnapshot.version = 99;
    closed.closureDecision.closureData.lessonsLearned[0]!.summary = "Поздняя правка";

    const readback = readClosedProjectSnapshot(snapshot);

    expect(readback.metrics.plannedWorkHours).toBe(20);
    expect(readback.project.processTemplate.version).toBe(4);
    expect(readback.closure.lessonsLearned[0]?.summary).toBe("Шаблон стадии сработал стабильно.");
  });

  it("rejects mismatched tenant closure decisions before returning snapshot data", () => {
    const closed = makeClosedProjectFixture();

    expect(() =>
      createClosedProjectSnapshot({
        id: "snapshot-tenant-mismatch",
        version: 1,
        capturedAt: "2026-05-15T05:06:00+07:00",
        project: closed.project,
        closureDecision: { ...closed.closureDecision, tenantId: "tenant-b" },
        scheduleSummary: {},
        resourceSummary: {
          plannedWorkHours: 20,
          actualWorkHours: 18,
          overloadCount: 0
        },
        kpiSummary: []
      })
    ).toThrow(/closure decision tenant mismatch/);
  });

  it("rejects invalid KPI summary values before snapshot capture", () => {
    const closed = makeClosedProjectFixture();

    expect(() =>
      createClosedProjectSnapshot({
        id: "snapshot-invalid-kpi",
        version: 1,
        capturedAt: "2026-05-15T05:06:00+07:00",
        project: closed.project,
        closureDecision: closed.closureDecision,
        scheduleSummary: {},
        resourceSummary: {
          plannedWorkHours: 20,
          actualWorkHours: 18,
          overloadCount: 0
        },
        kpiSummary: [
          {
            evaluationId: "kpi-eval-invalid",
            definitionId: "kpi-invalid",
            definitionVersion: 1,
            value: Number.NaN,
            severity: "green" as never,
            evaluatedAt: "2026-05-15T05:05:30+07:00"
          }
        ]
      })
    ).toThrow(/kpiSummary/);
  });
});
