import { describe, expect, it } from "vitest";

import {
  changeTaskStatus,
  closeManagedProjectWithClosure,
  createManagedProjectFromDraft,
  createProcessTemplate,
  createProjectDraftFromOpportunity,
  createTaskFromStageTaskTemplate,
  evaluateProjectClosureReadiness
} from "./index";

const tenantId = "tenant-a";
const actorId = "user-project-manager-a";

function makeDraft() {
  return createProjectDraftFromOpportunity({
    id: "project-draft-closure",
    tenantId,
    title: "Закрываемый проект",
    createdBy: actorId,
    createdAt: "2026-05-15T04:00:00+07:00",
    correlationId: "corr-closure-draft",
    sourceOpportunity: {
      tenantId,
      type: "crm_opportunity",
      opportunityId: "opportunity-closure",
      title: "Закрываемый проект",
      contactIds: [],
      plannedStartDate: "2026-06-01",
      desiredFinishDate: "2026-06-30"
    },
    processTemplate: {
      tenantId,
      templateId: "process-template-closure",
      key: "implementation.closure",
      label: "Процесс закрытия",
      version: 2,
      matchConfidence: 1,
      assumptions: []
    },
    demand: {
      tenantId,
      totalPlannedWorkHours: 16,
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
}

function makeProcessTemplate(includeSecondRequiredTask = false) {
  return createProcessTemplate({
    id: "process-template-closure",
    tenantId,
    key: "implementation.closure",
    label: "Процесс закрытия",
    active: true,
    version: 2,
    updatedAt: "2026-05-15T04:01:00+07:00",
    stages: [
      {
        id: "stage-delivery",
        tenantId,
        key: "delivery",
        label: "Исполнение",
        sortOrder: 10,
        active: true,
        version: 1,
        updatedAt: "2026-05-15T04:01:00+07:00",
        requiredArtifactTemplates: [],
        approvalTemplates: [],
        taskTemplates: [
          {
            id: "task-final-package",
            tenantId,
            key: "final_package",
            label: "Финальный комплект",
            defaultParticipantRoleKeys: ["executor"],
            required: true
          },
          ...(includeSecondRequiredTask
            ? [
                {
                  id: "task-client-acceptance",
                  tenantId,
                  key: "client_acceptance",
                  label: "Приемка клиента",
                  defaultParticipantRoleKeys: ["executor"],
                  required: true
                }
              ]
            : [])
        ]
      }
    ]
  });
}

function makeProjectWithRequiredTask(status: "todo" | "done" = "todo", includeSecondRequiredTask = false) {
  const project = createManagedProjectFromDraft({
    id: "project-closure",
    draft: makeDraft(),
    processTemplate: makeProcessTemplate(includeSecondRequiredTask),
    createdBy: actorId,
    createdAt: "2026-05-15T04:02:00+07:00",
    correlationId: "corr-closure-project"
  });

  const withTask = createTaskFromStageTaskTemplate(project, {
    id: "task-final-package",
    tenantId,
    stageId: "project-closure:stage-delivery",
    taskTemplateId: "task-final-package",
    taskTemplateKey: "final_package",
    dueDate: "2026-06-30",
    plannedWorkHours: 16,
    actorId,
    createdAt: "2026-05-15T04:03:00+07:00",
    correlationId: "corr-final-task"
  });

  const withSecondTask = includeSecondRequiredTask
    ? createTaskFromStageTaskTemplate(withTask, {
        id: "task-client-acceptance",
        tenantId,
        stageId: "project-closure:stage-delivery",
        taskTemplateId: "task-client-acceptance",
        taskTemplateKey: "client_acceptance",
        dueDate: "2026-06-30",
        plannedWorkHours: 4,
        actorId,
        createdAt: "2026-05-15T04:03:30+07:00",
        correlationId: "corr-client-acceptance-task"
      })
    : withTask;

  if (status === "done") {
    return changeTaskStatus(withSecondTask, {
      id: "task-status-final-done",
      tenantId,
      taskId: "task-final-package",
      toStatus: "done",
      actorId,
      changedAt: "2026-05-15T04:04:00+07:00",
      correlationId: "corr-final-task-done"
    });
  }

  return withSecondTask;
}

function makeChecklist() {
  return {
    id: "closure-checklist-standard",
    tenantId,
    projectId: "project-closure",
    version: 1,
    requirements: [
      {
        id: "closure-req-summary",
        tenantId,
        key: "final_kpi_summary",
        label: "Итог KPI",
        field: "final_kpi_summary" as const,
        required: true
      },
      {
        id: "closure-req-quality",
        tenantId,
        key: "quality_score",
        label: "Оценка качества",
        field: "quality_score" as const,
        required: true
      },
      {
        id: "closure-req-lessons",
        tenantId,
        key: "lessons_learned",
        label: "Уроки проекта",
        field: "lessons_learned" as const,
        required: true
      }
    ]
  };
}

function makeCompleteClosureData() {
  return {
    tenantId,
    projectId: "project-closure",
    finalKpiSummary: "Сроки выдержаны, переработка закрыта корректирующим действием.",
    qualityScore: 4,
    clientSatisfactionScore: 5,
    closingSummary: "Проект закрыт с подтвержденными результатами.",
    lessonsLearned: [
      {
        id: "lesson-briefing",
        categoryKey: "process",
        summary: "Ранний брифинг снизил количество доработок.",
        recommendation: "Добавить обязательный стартовый брифинг в шаблон.",
        severity: "attention" as const
      }
    ]
  };
}

describe("project closure workflow domain", () => {
  it("reports missing closure fields and open required tasks without mutating the project", () => {
    const project = makeProjectWithRequiredTask("todo");

    const readiness = evaluateProjectClosureReadiness(project, {
      checklist: makeChecklist(),
      closureData: {
        tenantId,
        projectId: "project-closure",
        lessonsLearned: []
      }
    });

    expect(readiness.ok).toBe(false);
    expect(readiness.blockers.map((blocker) => blocker.code)).toEqual([
      "missing_closure_requirement",
      "missing_closure_requirement",
      "missing_closure_requirement",
      "open_required_task"
    ]);
    expect(project.lifecycleStatus).toBe("active");
    expect(project.currentStageId).toBe("project-closure:stage-delivery");
  });

  it("closes the project with complete closure data and records an auditable closure decision", () => {
    const project = makeProjectWithRequiredTask("done");

    const result = closeManagedProjectWithClosure(project, {
      id: "closure-decision-1",
      tenantId,
      actorId,
      checklist: makeChecklist(),
      closureData: makeCompleteClosureData(),
      closedAt: "2026-05-15T04:05:00+07:00",
      correlationId: "corr-close-project",
      auditEventId: "audit-close-project"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected closure to succeed");
    expect(result.project.lifecycleStatus).toBe("completed");
    expect(result.project.currentStageId).toBeNull();
    expect(result.closureDecision).toMatchObject({
      id: "closure-decision-1",
      tenantId,
      projectId: "project-closure",
      actorId,
      closedAt: "2026-05-15T04:05:00+07:00",
      auditEventId: "audit-close-project",
      correlationId: "corr-close-project"
    });
    expect(result.closureDecision.closureData.lessonsLearned[0]?.summary).toContain("Ранний брифинг");
    expect(project.lifecycleStatus).toBe("active");
  });

  it("allows an open required-task blocker only with a targeted governed override audit reference", () => {
    const project = makeProjectWithRequiredTask("todo");

    const denied = closeManagedProjectWithClosure(project, {
      id: "closure-decision-denied",
      tenantId,
      actorId,
      checklist: makeChecklist(),
      closureData: makeCompleteClosureData(),
      closedAt: "2026-05-15T04:05:00+07:00",
      correlationId: "corr-close-denied",
      auditEventId: "audit-close-denied"
    });

    expect(denied.ok).toBe(false);
    if (denied.ok) throw new Error("expected closure blocker");
    expect(denied.readiness.blockers.map((blocker) => blocker.code)).toEqual(["open_required_task"]);

    const genericOverride = closeManagedProjectWithClosure(project, {
      id: "closure-decision-generic-override",
      tenantId,
      actorId,
      checklist: makeChecklist(),
      closureData: makeCompleteClosureData(),
      closedAt: "2026-05-15T04:05:00+07:00",
      correlationId: "corr-close-generic-override",
      auditEventId: "audit-close-generic-override",
      blockerOverrides: [
        {
          blockerCode: "open_required_task",
          reason: "Финальный комплект принят как риск закрытия после управленческого решения.",
          auditEventId: "audit-accepted-open-task-risk"
        }
      ]
    });

    expect(genericOverride.ok).toBe(false);

    const approved = closeManagedProjectWithClosure(project, {
      id: "closure-decision-override",
      tenantId,
      actorId,
      checklist: makeChecklist(),
      closureData: makeCompleteClosureData(),
      closedAt: "2026-05-15T04:05:00+07:00",
      correlationId: "corr-close-override",
      auditEventId: "audit-close-override",
      blockerOverrides: [
        {
          blockerCode: "open_required_task",
          taskId: "task-final-package",
          reason: "Финальный комплект принят как риск закрытия после управленческого решения.",
          auditEventId: "audit-accepted-open-task-risk"
        }
      ]
    });

    expect(approved.ok).toBe(true);
    if (!approved.ok) throw new Error("expected closure override");
    expect(approved.closureDecision.blockerOverrides).toEqual([
      {
        blockerCode: "open_required_task",
        taskId: "task-final-package",
        reason: "Финальный комплект принят как риск закрытия после управленческого решения.",
        auditEventId: "audit-accepted-open-task-risk"
      }
    ]);
  });

  it("does not let one targeted override silently cover another open required task", () => {
    const project = makeProjectWithRequiredTask("todo", true);

    const result = closeManagedProjectWithClosure(project, {
      id: "closure-decision-partial-override",
      tenantId,
      actorId,
      checklist: makeChecklist(),
      closureData: makeCompleteClosureData(),
      closedAt: "2026-05-15T04:05:00+07:00",
      correlationId: "corr-close-partial-override",
      auditEventId: "audit-close-partial-override",
      blockerOverrides: [
        {
          blockerCode: "open_required_task",
          taskId: "task-final-package",
          reason: "Финальный комплект принят как риск закрытия после управленческого решения.",
          auditEventId: "audit-accepted-open-task-risk"
        }
      ]
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected partial override to keep closure blocked");
    expect(result.readiness.blockers.map((blocker) => blocker.taskId)).toEqual([
      "task-final-package",
      "task-client-acceptance"
    ]);
  });

  it("rejects tenant mismatch before exposing closure state", () => {
    const project = makeProjectWithRequiredTask("done");

    const readiness = evaluateProjectClosureReadiness(project, {
      checklist: { ...makeChecklist(), tenantId: "tenant-b" },
      closureData: makeCompleteClosureData()
    });

    expect(readiness.ok).toBe(false);
    expect(readiness.blockers).toEqual([
      {
        code: "tenant_mismatch",
        message: "Closure checklist tenant does not match project tenant",
        requirementId: "closure-checklist-standard",
        field: "tenantId",
        overridable: false
      }
    ]);
  });
});
