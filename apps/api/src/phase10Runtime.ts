import { createActionExecutionLog } from "@kiss-pm/action-engine";
import type { ActionExecutionLog } from "@kiss-pm/action-engine";
import type { TenantId, TenantUserId } from "@kiss-pm/domain-core";
import {
  publishProcessTemplatePreview,
  previewProcessTemplatePublish
} from "@kiss-pm/project-core";
import type {
  ProcessTemplate,
  ProcessTemplateBuilderDraft,
  ProcessTemplatePublishAudit,
  ProcessTemplatePublishPreview,
  ProcessTemplatePublishResult
} from "@kiss-pm/project-core";
import {
  createTenantLabelSet,
  publishTenantLabelSetPreview,
  previewTenantLabelSetPublish
} from "@kiss-pm/tenant-config";
import type {
  TenantLabelSet,
  TenantLabelSetPublishAudit,
  TenantLabelSetPublishPreview,
  TenantLabelSetPublishResult
} from "@kiss-pm/tenant-config";

const PHASE10_TIMESTAMP_START = Date.parse("2026-08-01T00:00:00.000Z");

type Phase10TenantState = {
  labelPreviews: Map<string, TenantLabelSetPublishPreview>;
  labelActionExecutions: ActionExecutionLog[];
  processTemplatePreviews: Map<string, ProcessTemplatePublishPreview>;
  processTemplateActionExecutions: ActionExecutionLog[];
};

export type Phase10RuntimeState = ReturnType<typeof createPhase10RuntimeState>;

function clone<T>(value: T): T {
  return structuredClone(value) as T;
}

function stalePreview(message: string): Error & { code: "stale_preview" } {
  return Object.assign(new Error(message), { code: "stale_preview" as const });
}

export function createPhase10RuntimeState() {
  const states = new Map<TenantId, Phase10TenantState>();
  let timestampCounter = 0;

  function now(): string {
    timestampCounter += 1;
    return new Date(PHASE10_TIMESTAMP_START + timestampCounter * 60_000).toISOString();
  }

  function getState(tenantId: TenantId): Phase10TenantState {
    const existing = states.get(tenantId);
    if (existing !== undefined) return existing;
    const next = {
      labelPreviews: new Map<string, TenantLabelSetPublishPreview>(),
      labelActionExecutions: [],
      processTemplatePreviews: new Map<string, ProcessTemplatePublishPreview>(),
      processTemplateActionExecutions: []
    };
    states.set(tenantId, next);

    return next;
  }

  function previewLabels(input: {
    labelSet: TenantLabelSet;
    actorId: TenantUserId;
    changes: Array<{ key: string; label: string }>;
    affectedRuntimeSurfaces: string[];
  }): TenantLabelSetPublishPreview {
    const state = getState(input.labelSet.tenantId);
    const preview = previewTenantLabelSetPublish(input.labelSet, {
      id: `preview-tenant-labels-${input.labelSet.tenantId}-${input.labelSet.configurationVersion}-${state.labelPreviews.size + 1}`,
      actorId: input.actorId,
      changes: input.changes,
      affectedRuntimeSurfaces: input.affectedRuntimeSurfaces,
      createdAt: now()
    });
    state.labelPreviews.set(preview.id, clone(preview));

    return clone(preview);
  }

  function publishLabels(input: {
    labelSet: TenantLabelSet;
    actorId: TenantUserId;
    accessProfileId?: string;
    previewId: string;
    auditEventId: string;
  }): TenantLabelSetPublishResult & { actionExecution: ActionExecutionLog } {
    const state = getState(input.labelSet.tenantId);
    const preview = state.labelPreviews.get(input.previewId);
    if (preview === undefined) {
      throw stalePreview("tenant label preview is missing or stale");
    }
    if (preview.actorId !== input.actorId) {
      throw stalePreview("tenant label preview is stale");
    }

    const result = publishTenantLabelSetPreview(input.labelSet, {
      preview,
      expectedConfigurationVersion: input.labelSet.configurationVersion,
      auditEventId: input.auditEventId,
      publishedAt: now()
    });
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId: input.labelSet.tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId: `tenant-labels-${input.labelSet.tenantId}-${input.labelSet.configurationVersion}`
      },
      commandType: "tenant_label_set.publish",
      requiredPermission: "tenant.config.write",
      status: "succeeded",
      source: { entityType: "tenantLabelSet", entityId: input.labelSet.tenantId },
      target: { entityType: "tenantLabelSet", entityId: input.labelSet.tenantId },
      before: {
        configurationVersion: input.labelSet.configurationVersion,
        labels: clone(input.labelSet.labels),
        preview
      },
      after: {
        configurationVersion: result.labelSet.configurationVersion,
        labels: clone(result.labelSet.labels)
      },
      timestamp: now(),
      auditEventIds: [input.auditEventId],
      permissionTrace: ["policy:permission tenant.config.write allowed"],
      preconditionTrace: ["precondition:dry-run preview confirmed", "precondition:label keys configured"],
      trace: ["tenant_labels:preview confirmed", "tenant_labels:runtime projection refreshed"]
    });
    state.labelActionExecutions = [...state.labelActionExecutions, actionExecution];
    state.labelPreviews.clear();

    return { ...result, actionExecution: clone(actionExecution) };
  }

  function listLabelActionExecutions(tenantId: TenantId): ActionExecutionLog[] {
    return getState(tenantId).labelActionExecutions.map((entry) => clone(entry));
  }

  function previewProcessTemplate(input: {
    template: ProcessTemplate;
    actorId: TenantUserId;
    expectedTemplateVersion: number;
    draft: ProcessTemplateBuilderDraft;
    activeProjectTemplateVersions: number[];
    affectedRuntimeSurfaces: string[];
  }): ProcessTemplatePublishPreview {
    const state = getState(input.template.tenantId);
    const preview = previewProcessTemplatePublish(input.template, {
      id: `preview-process-template-${input.template.tenantId}-${input.template.version}-${state.processTemplatePreviews.size + 1}`,
      actorId: input.actorId,
      expectedTemplateVersion: input.expectedTemplateVersion,
      draft: input.draft,
      activeProjectTemplateVersions: input.activeProjectTemplateVersions,
      affectedRuntimeSurfaces: input.affectedRuntimeSurfaces,
      createdAt: now()
    });
    state.processTemplatePreviews.set(preview.id, clone(preview));

    return clone(preview);
  }

  function publishProcessTemplate(input: {
    template: ProcessTemplate;
    actorId: TenantUserId;
    accessProfileId?: string;
    previewId: string;
    auditEventId: string;
  }): ProcessTemplatePublishResult & { actionExecution: ActionExecutionLog } {
    const state = getState(input.template.tenantId);
    const preview = state.processTemplatePreviews.get(input.previewId);
    if (preview === undefined) {
      throw stalePreview("process template preview is missing or stale");
    }
    if (preview.actorId !== input.actorId || preview.before.templateId !== input.template.id) {
      throw stalePreview("process template preview is stale");
    }

    const result = publishProcessTemplatePreview(input.template, {
      preview,
      expectedTemplateVersion: input.template.version,
      auditEventId: input.auditEventId,
      publishedAt: now()
    });
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId: input.template.tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId: `process-template-${input.template.tenantId}-${input.template.id}-${input.template.version}`
      },
      commandType: "process_template.publish",
      requiredPermission: "project.template.write",
      status: "succeeded",
      source: { entityType: "processTemplate", entityId: input.template.id },
      target: { entityType: "processTemplate", entityId: input.template.id },
      before: {
        templateVersion: input.template.version,
        label: input.template.label,
        preview
      },
      after: {
        templateVersion: result.template.version,
        label: result.template.label,
        activeStageKeys: result.template.stages.filter((stage) => stage.active).map((stage) => stage.key)
      },
      timestamp: now(),
      auditEventIds: [input.auditEventId],
      permissionTrace: ["policy:permission project.template.write allowed"],
      preconditionTrace: ["precondition:dry-run preview confirmed", "precondition:existing active projects retain snapshots"],
      trace: ["process_template:preview confirmed", "process_template:future version published"]
    });
    state.processTemplateActionExecutions = [...state.processTemplateActionExecutions, actionExecution];
    state.processTemplatePreviews.clear();

    return { ...result, actionExecution: clone(actionExecution) };
  }

  function listProcessTemplateActionExecutions(tenantId: TenantId): ActionExecutionLog[] {
    return getState(tenantId).processTemplateActionExecutions.map((entry) => clone(entry));
  }

  function cloneLabelSet(labelSet: TenantLabelSet): TenantLabelSet {
    return createTenantLabelSet(labelSet);
  }

  return {
    now,
    cloneLabelSet,
    previewLabels,
    publishLabels,
    listLabelActionExecutions,
    previewProcessTemplate,
    publishProcessTemplate,
    listProcessTemplateActionExecutions
  };
}

export function buildRuntimeLabelProjection(labelSet: TenantLabelSet) {
  const labels = labelSet.labels;
  return {
    roles: [
      {
        key: "project_manager",
        label: labels["runtime.role.project_manager"] ?? labels["role.project_manager"] ?? "Project manager"
      },
      {
        key: "resource_manager",
        label: labels["runtime.role.resource_manager"] ?? labels["role.resource_manager"] ?? "Resource manager"
      },
      {
        key: "executor",
        label: labels["runtime.role.executor"] ?? labels["role.executor"] ?? "Executor"
      }
    ],
    stages: [
      {
        key: "initiation",
        label: labels["runtime.stage.initiation"] ?? "Initiation"
      },
      {
        key: "delivery",
        label: labels["runtime.stage.delivery"] ?? "Delivery"
      }
    ],
    controlSurfaces: [
      {
        key: "portfolio.control",
        label: labels["navigation.portfolio"] ?? "Portfolio"
      },
      {
        key: "resources.load",
        label: labels["navigation.resources"] ?? "Resources"
      }
    ]
  };
}

export function tenantLabelPublishAuditDto(audit: TenantLabelSetPublishAudit) {
  return {
    ...audit,
    changedKeys: [...audit.changedKeys]
  };
}

export function processTemplatePublishAuditDto(audit: ProcessTemplatePublishAudit) {
  return { ...audit };
}
