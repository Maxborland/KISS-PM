import { describe, expect, it } from "vitest";

import {
  ProjectCoreModelError,
  advanceManagedProjectLifecycle,
  createManagedProjectFromDraft,
  createProcessTemplate,
  createProjectDraftFromOpportunity,
  getAllowedProjectLifecycleTransitions
} from "./index";

const tenantId = "tenant-a";

function makeDraft() {
  return createProjectDraftFromOpportunity({
    id: "project-draft-1",
    tenantId,
    title: "Внедрение портала АКМЕ",
    createdBy: "user-project-manager-a",
    createdAt: "2026-05-14T21:10:00.000Z",
    correlationId: "corr-project-draft-opportunity-seed-ready",
    sourceOpportunity: {
      tenantId,
      type: "crm_opportunity",
      opportunityId: "opportunity-seed-ready",
      title: "Внедрение портала АКМЕ",
      accountId: "account-opportunity-seed-ready",
      contactIds: ["contact-opportunity-seed-ready"],
      plannedStartDate: "2026-06-01",
      desiredFinishDate: "2026-06-30"
    },
    processTemplate: {
      tenantId,
      templateId: "process-template-tenant-a-implementation",
      key: "implementation.standard",
      label: "Стандартное внедрение",
      version: 3,
      matchConfidence: 0.9,
      assumptions: []
    },
    demand: {
      tenantId,
      totalPlannedWorkHours: 64,
      scenarioKey: "baseline",
      scenarioLabel: "Базовый сценарий",
      formulaKey: "phase3.template_scope_linear",
      formulaVersion: 1,
      confidence: 0.84,
      stageRoleDemands: [
        {
          stageKey: "initiation",
          stageLabel: "Инициация",
          roleKey: "project_manager",
          roleLabel: "Руководитель проекта",
          plannedWorkHours: 64
        }
      ]
    },
    feasibility: {
      tenantId,
      status: "fit",
      severity: "warning",
      expectedWindow: { startDate: "2026-06-01", endDate: "2026-06-30" },
      blockerCodes: []
    }
  });
}

function makeProcessTemplate() {
  return createProcessTemplate({
    id: "process-template-tenant-a-implementation",
    tenantId,
    key: "implementation.standard",
    label: "Стандартное внедрение",
    active: true,
    version: 3,
    updatedAt: "2026-05-15T03:30:00+07:00",
    stages: [
      {
        id: "stage-delivery",
        tenantId,
        key: "delivery",
        label: "Исполнение",
        sortOrder: 20,
        active: true,
        version: 2,
        updatedAt: "2026-05-15T03:29:00+07:00",
        requiredArtifactTemplates: [],
        approvalTemplates: [],
        taskTemplates: []
      },
      {
        id: "stage-initiation",
        tenantId,
        key: "initiation",
        label: "Инициация",
        sortOrder: 10,
        active: true,
        version: 1,
        updatedAt: "2026-05-15T03:28:00+07:00",
        requiredArtifactTemplates: [],
        approvalTemplates: [],
        taskTemplates: []
      },
      {
        id: "stage-disabled",
        tenantId,
        key: "legacy_stage",
        label: "Отключенный этап",
        sortOrder: 30,
        active: false,
        version: 1,
        updatedAt: "2026-05-15T03:27:00+07:00",
        requiredArtifactTemplates: [],
        approvalTemplates: [],
        taskTemplates: []
      }
    ]
  });
}

describe("project lifecycle state machine", () => {
  it("converts a Phase 3 draft into an active managed project with current stage and history", () => {
    const project = createManagedProjectFromDraft({
      id: "project-managed-1",
      draft: makeDraft(),
      processTemplate: makeProcessTemplate(),
      createdBy: "user-project-manager-a",
      createdAt: "2026-05-15T03:31:00+07:00",
      correlationId: "corr-managed-project-1"
    });

    expect(project).toMatchObject({
      id: "project-managed-1",
      tenantId,
      title: "Внедрение портала АКМЕ",
      lifecycleStatus: "active",
      currentStageId: "project-managed-1:stage-initiation",
      sourceDraftId: "project-draft-1",
      processTemplateSnapshot: {
        templateId: "process-template-tenant-a-implementation",
        version: 3
      }
    });
    expect(project.stages.map((stage) => [stage.id, stage.templateKey, stage.status])).toEqual([
      ["project-managed-1:stage-initiation", "initiation", "active"],
      ["project-managed-1:stage-delivery", "delivery", "pending"]
    ]);
    expect(project.stageHistory).toEqual([
      {
        id: "project-managed-1:history:created:stage-initiation",
        tenantId,
        projectId: "project-managed-1",
        stageId: "project-managed-1:stage-initiation",
        transition: "create_from_draft",
        fromStatus: null,
        toStatus: "active",
        actorId: "user-project-manager-a",
        occurredAt: "2026-05-15T03:31:00+07:00",
        correlationId: "corr-managed-project-1"
      }
    ]);
    expect(getAllowedProjectLifecycleTransitions(project)).toEqual(["advance_stage", "cancel_project"]);
  });

  it("advances stages immutably and completes the project from the final stage", () => {
    const project = createManagedProjectFromDraft({
      id: "project-managed-1",
      draft: makeDraft(),
      processTemplate: makeProcessTemplate(),
      createdBy: "user-project-manager-a",
      createdAt: "2026-05-15T03:31:00+07:00",
      correlationId: "corr-managed-project-1"
    });

    const advanced = advanceManagedProjectLifecycle(project, {
      tenantId,
      actorId: "user-project-principal-a",
      occurredAt: "2026-05-15T03:40:00+07:00",
      correlationId: "corr-advance-delivery",
      transition: "advance_stage",
      currentStageId: "project-managed-1:stage-initiation"
    });

    expect(advanced.ok).toBe(true);
    if (!advanced.ok) throw new Error("expected successful transition");
    expect(project.currentStageId).toBe("project-managed-1:stage-initiation");
    expect(project.stages.map((stage) => stage.status)).toEqual(["active", "pending"]);
    expect(advanced.project.currentStageId).toBe("project-managed-1:stage-delivery");
    expect(advanced.project.stages.map((stage) => [stage.templateKey, stage.status])).toEqual([
      ["initiation", "completed"],
      ["delivery", "active"]
    ]);
    expect(advanced.project.stageHistory.map((entry) => entry.transition)).toEqual([
      "create_from_draft",
      "advance_stage",
      "advance_stage"
    ]);
    expect(getAllowedProjectLifecycleTransitions(advanced.project)).toEqual(["complete_project", "cancel_project"]);

    const completed = advanceManagedProjectLifecycle(advanced.project, {
      tenantId,
      actorId: "user-project-principal-a",
      occurredAt: "2026-05-15T03:45:00+07:00",
      correlationId: "corr-complete-project",
      transition: "complete_project",
      currentStageId: "project-managed-1:stage-delivery"
    });

    expect(completed.ok).toBe(true);
    if (!completed.ok) throw new Error("expected complete transition");
    expect(completed.project.lifecycleStatus).toBe("completed");
    expect(completed.project.currentStageId).toBeNull();
    expect(completed.project.stages.map((stage) => [stage.templateKey, stage.status])).toEqual([
      ["initiation", "completed"],
      ["delivery", "completed"]
    ]);
    expect(getAllowedProjectLifecycleTransitions(completed.project)).toEqual([]);
  });

  it("returns typed errors for invalid transitions and does not mutate state", () => {
    const project = createManagedProjectFromDraft({
      id: "project-managed-1",
      draft: makeDraft(),
      processTemplate: makeProcessTemplate(),
      createdBy: "user-project-manager-a",
      createdAt: "2026-05-15T03:31:00+07:00",
      correlationId: "corr-managed-project-1"
    });
    const before = structuredClone(project);

    const result = advanceManagedProjectLifecycle(project, {
      tenantId,
      actorId: "user-project-principal-a",
      occurredAt: "2026-05-15T03:40:00+07:00",
      correlationId: "corr-invalid-complete",
      transition: "complete_project",
      currentStageId: "project-managed-1:stage-initiation"
    });

    expect(result).toEqual({
      ok: false,
      project,
      error: {
        code: "transition_not_allowed",
        message: "Project lifecycle transition is not allowed from the current state",
        details: {
          transition: "complete_project",
          lifecycleStatus: "active",
          currentStageId: "project-managed-1:stage-initiation"
        }
      }
    });
    expect(project).toEqual(before);
  });

  it("returns typed errors for malformed commands and contradictory project state", () => {
    const project = createManagedProjectFromDraft({
      id: "project-managed-1",
      draft: makeDraft(),
      processTemplate: makeProcessTemplate(),
      createdBy: "user-project-manager-a",
      createdAt: "2026-05-15T03:31:00+07:00",
      correlationId: "corr-managed-project-1"
    });
    const before = structuredClone(project);

    const malformed = advanceManagedProjectLifecycle(project, {
      tenantId,
      actorId: "user-project-principal-a",
      occurredAt: "2026-05-15T03:40:00+07:00",
      correlationId: "corr-malformed-transition",
      transition: "skip_stage",
      currentStageId: "project-managed-1:stage-initiation"
    } as never);

    expect(malformed.ok).toBe(false);
    if (malformed.ok) throw new Error("expected malformed transition to fail");
    expect(malformed.error).toEqual({
      code: "invalid_transition",
      message: "Project lifecycle transition command is invalid",
      details: {
        transition: "skip_stage",
        lifecycleStatus: "active",
        currentStageId: "project-managed-1:stage-initiation"
      }
    });
    expect(project).toEqual(before);

    const contradictory = advanceManagedProjectLifecycle(
      {
        ...project,
        currentStageId: "project-managed-1:stage-delivery",
        stages: project.stages.map((stage) =>
          stage.id === "project-managed-1:stage-delivery" ? { ...stage, status: "pending" } : stage
        )
      },
      {
        tenantId,
        actorId: "user-project-principal-a",
        occurredAt: "2026-05-15T03:40:00+07:00",
        correlationId: "corr-contradictory-stage",
        transition: "complete_project",
        currentStageId: "project-managed-1:stage-delivery"
      }
    );

    expect(contradictory.ok).toBe(false);
    if (contradictory.ok) throw new Error("expected contradictory stage state to fail");
    expect(contradictory.error.code).toBe("invalid_project_state");
    expect(contradictory.error.details).toEqual({
      lifecycleStatus: "active",
      currentStageId: "project-managed-1:stage-delivery",
      activeStageIds: "project-managed-1:stage-initiation"
    });

    const skippedPendingStage = advanceManagedProjectLifecycle(
      {
        ...project,
        currentStageId: "project-managed-1:stage-delivery",
        stages: project.stages.map((stage) => {
          if (stage.id === "project-managed-1:stage-initiation") return { ...stage, status: "pending" };
          if (stage.id === "project-managed-1:stage-delivery") return { ...stage, status: "active" };
          return stage;
        })
      },
      {
        tenantId,
        actorId: "user-project-principal-a",
        occurredAt: "2026-05-15T03:40:00+07:00",
        correlationId: "corr-skipped-pending-stage",
        transition: "complete_project",
        currentStageId: "project-managed-1:stage-delivery"
      }
    );

    expect(skippedPendingStage.ok).toBe(false);
    if (skippedPendingStage.ok) throw new Error("expected skipped pending stage state to fail");
    expect(skippedPendingStage.error.code).toBe("invalid_project_state");
    expect(skippedPendingStage.error.details).toEqual({
      lifecycleStatus: "active",
      currentStageId: "project-managed-1:stage-delivery",
      activeStageIds: "project-managed-1:stage-delivery",
      blockingStageIds: "project-managed-1:stage-initiation"
    });
  });

  it("rejects backdated transitions with typed errors and preserves audit chronology", () => {
    const project = createManagedProjectFromDraft({
      id: "project-managed-1",
      draft: makeDraft(),
      processTemplate: makeProcessTemplate(),
      createdBy: "user-project-manager-a",
      createdAt: "2026-05-15T03:31:00+07:00",
      correlationId: "corr-managed-project-1"
    });
    const before = structuredClone(project);

    const result = advanceManagedProjectLifecycle(project, {
      tenantId,
      actorId: "user-project-principal-a",
      occurredAt: "2026-05-15T03:30:59+07:00",
      correlationId: "corr-backdated-advance",
      transition: "advance_stage",
      currentStageId: "project-managed-1:stage-initiation"
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected backdated transition to fail");
    expect(result.error).toEqual({
      code: "transition_timestamp_invalid",
      message: "Project lifecycle transition timestamp cannot be earlier than current project or stage state",
      details: {
        occurredAt: "2026-05-15T03:30:59+07:00",
        projectUpdatedAt: "2026-05-15T03:31:00+07:00",
        currentStageStartedAt: "2026-05-15T03:31:00+07:00"
      }
    });
    expect(project).toEqual(before);
  });

  it("validates malformed nested process snapshots without raw TypeError crashes", () => {
    const project = createManagedProjectFromDraft({
      id: "project-managed-1",
      draft: makeDraft(),
      processTemplate: makeProcessTemplate(),
      createdBy: "user-project-manager-a",
      createdAt: "2026-05-15T03:31:00+07:00",
      correlationId: "corr-managed-project-1"
    });
    const malformedProject = {
      ...project,
      processTemplateSnapshot: {
        ...project.processTemplateSnapshot,
        stageTemplates: [
          {
            ...project.processTemplateSnapshot.stageTemplates[0]!,
            taskTemplates: [[]]
          }
        ]
      }
    } as never;

    expect(() =>
      advanceManagedProjectLifecycle(malformedProject, {
        tenantId,
        actorId: "user-project-principal-a",
        occurredAt: "2026-05-15T03:40:00+07:00",
        correlationId: "corr-malformed-snapshot",
        transition: "advance_stage",
        currentStageId: "project-managed-1:stage-initiation"
      })
    ).toThrow("managedProject.processTemplateSnapshot.stageTemplate.taskTemplate must be an object");
  });

  it("rejects template mismatch, inactive templates, and empty active stage sets", () => {
    expect(() =>
      createManagedProjectFromDraft({
        id: "project-managed-1",
        draft: makeDraft(),
        processTemplate: createProcessTemplate({
          ...makeProcessTemplate(),
          version: 4
        }),
        createdBy: "user-project-manager-a",
        createdAt: "2026-05-15T03:31:00+07:00",
        correlationId: "corr-managed-project-1"
      })
    ).toThrow("managedProject process template does not match draft snapshot");

    expect(() =>
      createManagedProjectFromDraft({
        id: "project-managed-1",
        draft: makeDraft(),
        processTemplate: createProcessTemplate({
          ...makeProcessTemplate(),
          active: false
        }),
        createdBy: "user-project-manager-a",
        createdAt: "2026-05-15T03:31:00+07:00",
        correlationId: "corr-managed-project-1"
      })
    ).toThrow("managedProject process template must be active");

    try {
      createManagedProjectFromDraft({
        id: "project-managed-1",
        draft: makeDraft(),
        processTemplate: createProcessTemplate({
          ...makeProcessTemplate(),
          stages: makeProcessTemplate().stages.map((stage) => ({ ...stage, active: false }))
        }),
        createdBy: "user-project-manager-a",
        createdAt: "2026-05-15T03:31:00+07:00",
        correlationId: "corr-managed-project-1"
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectCoreModelError);
      expect((error as ProjectCoreModelError).code).toBe("validation_error");
      expect((error as Error).message).toBe("managedProject process template must have at least one active stage");
    }
  });
});
