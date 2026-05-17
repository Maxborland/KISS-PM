import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";

import { createPhase2RuntimeState } from "./phase2Runtime";
import type { Phase2RuntimeSession, Phase2RuntimeState } from "./phase2Runtime";
import { createPhase3CrmRuntimeState } from "./phase3Runtime";
import type {
  Phase3AccountCreateInput,
  Phase3ContactCreateInput,
  Phase3OpportunityCreateInput
} from "./phase3Runtime";
import { createPhase4RuntimeState } from "./phase4Runtime";
import type { Phase4CreateTaskParticipantInput } from "./phase4Runtime";
import { createPhase5RuntimeState } from "./phase5Runtime";
import { createPhase6RuntimeState } from "./phase6Runtime";
import type { ResourceResolutionCommand } from "./phase6Runtime";
import { createPhase7RuntimeState } from "./phase7Runtime";
import { createPhase8RuntimeState } from "./phase8Runtime";
import { createPhase9RuntimeState } from "./phase9Runtime";
import type { Phase9ClosureDataInput } from "./phase9Runtime";
import {
  actionConfigurationPublishAuditDto,
  buildRuntimeLabelProjection,
  configurationImportAuditDto,
  controlSurfaceLayoutPublishAuditDto,
  createPhase10RuntimeState,
  customFieldPublishAuditDto,
  kpiThresholdPublishAuditDto,
  processTemplatePublishAuditDto,
  tenantLabelPublishAuditDto
} from "./phase10Runtime";
import { createPhase11RuntimeState } from "./phase11Runtime";
import { validatePhase12DeploymentEnvironment } from "./phase12Deployment";
import type { Phase12DeploymentEnvironment } from "./phase12Deployment";
import { buildPhase12ReleaseReadinessReadModel } from "./phase12Readiness";
import type {
  KpiDefinitionBundle,
  KpiDefinitionConfigInput,
  KpiDefinitionPreviewInput,
  KpiEvaluationRunInput
} from "./phase7Runtime";
import type {
  ApprovalRequest,
  ManagedProject,
  ProcessTemplate,
  ProjectCustomFieldValue,
  ProjectArtifact,
  ProjectLifecycleTransitionError,
  ProjectStage,
  StageGateBlocker,
  Task,
  TaskComment,
  TaskParticipant,
  TaskParticipantRole,
  TaskStatusHistoryEntry
} from "@kiss-pm/project-core";
import { createProjectDraftFromOpportunity } from "@kiss-pm/project-core";
import type { ProjectClosureBlockerOverride } from "@kiss-pm/project-core";
import type { DependencyType, ScheduleBaselineSnapshot, SchedulePlan, ScheduleValidationIssue } from "@kiss-pm/scheduling-engine";
import {
  createIntegrationAdapterDefinition,
  createIntegrationConnection,
  IntegrationDomainError
} from "@kiss-pm/integrations";
import type {
  IntegrationAdapterDefinition,
  IntegrationConnection,
  MockAdapterCanonicalImportPayload,
  MockAdapterCanonicalImportPreview
} from "@kiss-pm/integrations";
import { createConfigurationImportPackageWithChecksum, previewConfigurationImport } from "@kiss-pm/tenant-config";
import type { ConfigurationExportPackage, CustomFieldDefinition, CustomFieldRegistry } from "@kiss-pm/tenant-config";

type ApiErrorCode =
  | "unauthenticated"
  | "permission_denied"
  | "tenant_mismatch"
  | "unsupported_scope"
  | "validation_error"
  | "not_found"
  | "conflict"
  | "precondition_failed"
  | "dry_run_required"
  | "stale_preview"
  | "adapter_rate_limited"
  | "adapter_unavailable"
  | "adapter_failure"
  | "not_implemented"
  | "test_mode_only";

export type CreateApiAppOptions = {
  allowTestFixtureReset?: boolean;
  deploymentEnvironment?: Phase12DeploymentEnvironment;
};

const scopeSchema = z.enum(["own", "project", "tenant", "all"]);

const upsertAccessProfileSchema = z.object({
  id: z.string().trim().min(1).optional(),
  version: z.number().int().positive().optional(),
  systemKey: z.string().trim().min(1),
  label: z.string().trim().min(1),
  permissions: z.array(z.string().trim().min(1)).min(1),
  scopeRules: z
    .array(
      z.object({
        permissionKey: z.string().trim().min(1),
        scope: scopeSchema,
        constraints: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
      })
    )
    .min(1),
  active: z.boolean()
});

const updateTenantLabelSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  expectedConfigurationVersion: z.number().int().positive()
});

const tenantLabelPreviewSchema = z
  .object({
    changes: z
      .array(
        z
          .object({
            key: z.string().trim().min(1),
            label: z.string().trim().min(1)
          })
          .strict()
      )
      .min(1),
    affectedRuntimeSurfaces: z.array(z.string().trim().min(1)).min(1)
  })
  .strict();

const tenantLabelPublishSchema = z
  .object({
    previewId: z.string().trim().min(1)
  })
  .strict();

const processTemplateTaskDraftSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1).optional(),
    defaultParticipantRoleKeys: z.array(z.string().trim().min(1)).optional(),
    required: z.boolean().optional()
  })
  .strict();

const processTemplateStageDraftSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1).optional(),
    sortOrder: z.number().int().positive().optional(),
    active: z.boolean().optional(),
    taskTemplates: z.array(processTemplateTaskDraftSchema).optional()
  })
  .strict();

const processTemplatePreviewSchema = z
  .object({
    templateId: z.string().trim().min(1),
    expectedTemplateVersion: z.number().int().positive(),
    draft: z
      .object({
        label: z.string().trim().min(1).optional(),
        active: z.boolean().optional(),
        stages: z.array(processTemplateStageDraftSchema).optional()
      })
      .strict(),
    affectedRuntimeSurfaces: z.array(z.string().trim().min(1)).min(1)
  })
  .strict();

const processTemplatePublishSchema = z
  .object({
    templateId: z.string().trim().min(1),
    previewId: z.string().trim().min(1)
  })
  .strict();

const customFieldMetadataValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.array(z.number())
]);

const customFieldDraftSchema = z
  .object({
    id: z.string().trim().min(1),
    targetEntityType: z.string().trim().min(1),
    key: z.string().trim().min(1),
    label: z.string().trim().min(1),
    valueType: z.string().trim().min(1),
    required: z.boolean(),
    active: z.boolean(),
    validationRules: z.record(z.string().trim().min(1), customFieldMetadataValueSchema).optional(),
    visibilityRules: z
      .array(
        z
          .object({
            surfaceKey: z.string().trim().min(1),
            visible: z.boolean()
          })
          .strict()
      )
      .optional(),
    permissionRules: z
      .object({
        readPermissionKey: z.string().trim().min(1).optional(),
        writePermissionKey: z.string().trim().min(1).optional()
      })
      .strict()
      .optional(),
    bindingFlags: z
      .object({
        usableInFilters: z.boolean(),
        usableInControlSurfaces: z.boolean(),
        usableInKpiSourceBindings: z.boolean()
      })
      .strict()
  })
  .strict();

const customFieldPreviewSchema = z
  .object({
    expectedRegistryVersion: z.number().int().positive(),
    draft: customFieldDraftSchema,
    affectedRuntimeSurfaces: z.array(z.string().trim().min(1)).min(1)
  })
  .strict();

const customFieldPublishSchema = z
  .object({
    previewId: z.string().trim().min(1)
  })
  .strict();

const projectCustomFieldValueSchema = z
  .object({
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])
  })
  .strict();

const permissionDiagnosticsSchema = z.object({
  permissionKey: z.string().trim().min(1),
  targetEntityType: z.string().trim().min(1),
  targetEntityId: z.string().trim().min(1).optional(),
  targetTenantId: z.string().trim().min(1).optional(),
  requestedScope: z.string().trim().min(1).optional()
});

const emptyBodySchema = z.object({}).strict();

const moneyAmountSchema = z
  .object({
    amount: z.number().positive(),
    currency: z.string().trim().regex(/^[A-Z]{3}$/)
  })
  .strict();

const accountCreateSchema = z
  .object({
    displayName: z.string().trim().min(1),
    legalName: z.string().trim().min(1).optional(),
    taxId: z.string().trim().min(1).optional()
  })
  .strict();

const contactCreateSchema = z
  .object({
    accountId: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1),
    email: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).optional(),
    roleLabel: z.string().trim().min(1).optional()
  })
  .strict();

const opportunityScopeHintSchema = z
  .object({
    key: z.string().trim().min(1),
    label: z.string().trim().min(1),
    value: z.union([z.string(), z.number(), z.boolean()])
  })
  .strict();

const opportunityCustomFieldRefSchema = z
  .object({
    definitionId: z.string().trim().min(1),
    key: z.string().trim().min(1)
  })
  .strict();

const createOpportunitySchema = z
  .object({
    title: z.string().trim().min(1),
    accountId: z.string().trim().min(1).optional(),
    contactIds: z.array(z.string().trim().min(1)).optional(),
    account: accountCreateSchema.optional(),
    contacts: z.array(contactCreateSchema).optional(),
    plannedStartDate: z.string().trim().min(1),
    desiredFinishDate: z.string().trim().min(1),
    expectedValue: moneyAmountSchema,
    probability: z.number().min(0).max(1),
    categoryKey: z.string().trim().min(1),
    typologyKey: z.string().trim().min(1),
    scopeHints: z.array(opportunityScopeHintSchema).optional(),
    customFieldRefs: z.array(opportunityCustomFieldRefSchema).optional()
  })
  .strict()
  .superRefine((input, context) => {
    if (input.accountId !== undefined && input.account !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["accountId"],
        message: "Use either accountId or account, not both"
      });
    }
    if (input.contactIds !== undefined && input.contacts !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["contactIds"],
        message: "Use either contactIds or contacts, not both"
      });
    }
  });

const projectFromTemplateSchema = z
  .object({
    projectDraftId: z.string().trim().min(1),
    projectId: z.string().trim().min(1).optional()
  })
  .strict();

const lifecycleTransitionSchema = z
  .object({
    transition: z.enum(["advance_stage", "complete_project", "cancel_project"])
  })
  .strict();

const artifactEvidenceSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    templateId: z.string().trim().min(1),
    templateKey: z.string().trim().min(1),
    status: z.enum(["submitted", "accepted", "rejected"]),
    evidenceRef: z.string().trim().min(1).optional()
  })
  .strict();

const approvalEvidenceSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    templateId: z.string().trim().min(1),
    templateKey: z.string().trim().min(1),
    decision: z.enum(["approved"]).optional()
  })
  .strict();

const taskParticipantCreateSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    userId: z.string().trim().min(1),
    role: z.enum(["executor", "co_executor", "requester", "controller", "approver", "observer"])
  })
  .strict();

const taskCreateSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    stageId: z.string().trim().min(1),
    taskTemplateId: z.string().trim().min(1),
    taskTemplateKey: z.string().trim().min(1),
    status: z.enum(["todo", "in_progress", "blocked", "done", "cancelled"]).optional(),
    dueDate: z.string().trim().min(1),
    plannedWorkHours: z.number().min(0),
    participants: z.array(taskParticipantCreateSchema).optional()
  })
  .strict();

const scheduleDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

const scheduleTaskCreateSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    stageId: z.string().trim().min(1),
    taskTemplateId: z.string().trim().min(1),
    taskTemplateKey: z.string().trim().min(1),
    status: z.enum(["todo", "in_progress", "blocked", "done", "cancelled"]).optional(),
    plannedStartDate: scheduleDateSchema,
    plannedFinishDate: scheduleDateSchema,
    plannedWorkHours: z.number().min(0),
    progressPercent: z.number().min(0).max(100),
    participants: z.array(taskParticipantCreateSchema).optional()
  })
  .strict();

const scheduleTaskUpdateSchema = z
  .object({
    plannedStartDate: scheduleDateSchema.optional(),
    plannedFinishDate: scheduleDateSchema.optional(),
    plannedWorkHours: z.number().min(0).optional(),
    progressPercent: z.number().min(0).max(100).optional()
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0);

const scheduleDependencyCreateSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    predecessorTaskId: z.string().trim().min(1),
    successorTaskId: z.string().trim().min(1),
    type: z.literal("finish_to_start")
  })
  .strict();

const scheduleBaselineCaptureSchema = z
  .object({
    id: z.string().trim().min(1).optional()
  })
  .strict();

const resourceReservationCreateSchema = z
  .object({
    id: z.string().trim().min(1),
    sourceType: z.enum(["opportunity", "project", "stage"]),
    sourceId: z.string().trim().min(1),
    resourceProfileId: z.string().trim().min(1).optional(),
    roleKey: z.string().trim().min(1),
    roleLabel: z.string().trim().min(1),
    periodStart: scheduleDateSchema,
    periodEnd: scheduleDateSchema,
    reservedHours: z.number().min(0),
    sourceLabel: z.string().trim().min(1)
  })
  .strict();

const resourceResolutionPreviewSchema = z
  .object({
    actionKey: z.enum(["shift_work", "split_work", "reassign_resource", "reserve_capacity", "accept_risk", "escalate"]),
    assignmentId: z.string().trim().min(1).optional(),
    reservationId: z.string().trim().min(1).optional(),
    targetResourceProfileId: z.string().trim().min(1).optional(),
    shiftDays: z.number().int().positive().optional(),
    splitHours: z.number().positive().optional(),
    reservedHours: z.number().positive().optional(),
    reason: z.string().trim().min(1)
  })
  .strict();

const resourceResolutionApplySchema = z
  .object({
    previewId: z.string().trim().min(1)
  })
  .strict();

const kpiSourceBindingSchema = z
  .object({
    key: z.string().trim().min(1),
    label: z.string().trim().min(1),
    sourceType: z.enum(["crm", "project", "schedule", "resource", "worklog", "task", "kpi"]),
    sourceField: z.string().trim().min(1),
    valueType: z.literal("number")
  })
  .strict();

const kpiThresholdConditionSchema = z.union([
  z.object({ operator: z.enum(["gt", "gte", "lt", "lte", "eq"]), value: z.number() }).strict(),
  z.object({ operator: z.literal("between"), min: z.number(), max: z.number(), inclusive: z.boolean().optional() }).strict()
]);

const kpiThresholdRuleSchema = z
  .object({
    id: z.string().trim().min(1),
    severity: z.enum(["attention", "warning", "critical"]),
    condition: kpiThresholdConditionSchema,
    explanation: z.string().trim().min(1),
    recommendedActionKeys: z.array(z.string().trim().min(1))
  })
  .strict();

const kpiDefinitionConfigSchema = z
  .object({
    id: z.string().trim().min(1),
    systemKey: z.string().trim().min(1),
    label: z.string().trim().min(1),
    entityType: z.enum(["opportunity", "project", "project_stage", "task", "resource"]),
    ownerRoleKey: z.string().trim().min(1),
    unit: z.string().trim().min(1),
    evaluationCadence: z.enum(["daily", "weekly", "monthly", "manual"]),
    formula: z
      .object({
        id: z.string().trim().min(1),
        expression: z.string().trim().min(1),
        sourceBindings: z.array(kpiSourceBindingSchema).min(1)
      })
      .strict(),
    thresholdRuleSet: z
      .object({
        id: z.string().trim().min(1),
        rules: z.array(kpiThresholdRuleSchema).min(1)
      })
      .strict()
  })
  .strict();

const kpiDefinitionPreviewSchema = kpiDefinitionConfigSchema
  .extend({
    sampleValues: z.record(z.string(), z.number())
  })
  .strict();

const kpiThresholdPreviewSchema = z
  .object({
    definitionId: z.string().trim().min(1),
    expectedVersion: z.number().int().positive(),
    rules: z.array(kpiThresholdRuleSchema).min(1),
    sampleValue: z.number(),
    affectedRuntimeSurfaces: z.array(z.string().trim().min(1)).min(1)
  })
  .strict();

const kpiThresholdPublishSchema = z
  .object({
    previewId: z.string().trim().min(1)
  })
  .strict();

const savedViewSchema = z
  .object({
    id: z.string().trim().min(1),
    key: z.string().trim().min(1),
    label: z.string().trim().min(1),
    ownerType: z.enum(["tenant", "user"]),
    filterKeys: z.array(z.string().trim().min(1)),
    sortKeys: z.array(z.string().trim().min(1)),
    groupKeys: z.array(z.string().trim().min(1)).optional(),
    scope: z.enum(["tenant", "role", "user"]).optional()
  })
  .strict();

const savedViewLayoutPreviewSchema = z
  .object({
    surfaceId: z.string().trim().min(1),
    expectedSurfaceVersion: z.number().int().positive(),
    viewLabel: z.string().trim().min(1),
    visibleFieldKeys: z.array(z.string().trim().min(1)).min(1),
    filterKeys: z.array(z.string().trim().min(1)),
    sortKeys: z.array(z.string().trim().min(1)),
    groupKeys: z.array(z.string().trim().min(1)),
    widgetKeys: z.array(z.string().trim().min(1)),
    actionSlotKeys: z.array(z.string().trim().min(1)),
    savedView: savedViewSchema,
    affectedRuntimeSurfaces: z.array(z.string().trim().min(1)).min(1)
  })
  .strict();

const savedViewLayoutPublishSchema = z
  .object({
    previewId: z.string().trim().min(1)
  })
  .strict();

const actionFormFieldConfigSchema = z
  .object({
    fieldKey: z.string().trim().min(1),
    label: z.string().trim().min(1).optional(),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional()
  })
  .strict();

const actionConfigEntrySchema = z
  .object({
    actionKey: z.string().trim().min(1),
    enabled: z.boolean(),
    formFields: z.array(actionFormFieldConfigSchema)
  })
  .strict();

const actionConfigurationPreviewSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    actionConfigs: z.array(actionConfigEntrySchema),
    affectedRuntimeSurfaces: z.array(z.string().trim().min(1)).min(1)
  })
  .strict();

const actionConfigurationPublishSchema = z
  .object({
    previewId: z.string().trim().min(1)
  })
  .strict();

const configurationExportActionFormFieldSchema = z
  .object({
    fieldKey: z.string().trim().min(1),
    label: z.string().trim().min(1).optional(),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional()
  })
  .strict();

const configurationExportActionConfigSchema = z
  .object({
    actionKey: z.string().trim().min(1),
    enabled: z.boolean(),
    formFields: z.array(configurationExportActionFormFieldSchema)
  })
  .strict();

const configurationImportPackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    tenantId: z.string().trim().min(1),
    configurationVersion: z.number().int().positive(),
    exportedAt: z.string().trim().min(1),
    checksum: z.string().trim().min(1),
    labelSet: z
      .object({
        tenantId: z.string().trim().min(1),
        configurationVersion: z.number().int().positive(),
        labels: z.record(z.string(), z.string().trim().min(1)),
        updatedAt: z.string().trim().min(1)
      })
      .strict(),
    customFieldRegistry: z
      .object({
        tenantId: z.string().trim().min(1),
        version: z.number().int().positive(),
        definitions: z.array(z.unknown()),
        updatedAt: z.string().trim().min(1)
      })
      .passthrough(),
    actionConfiguration: z
      .object({
        tenantId: z.string().trim().min(1),
        version: z.number().int().positive(),
        actionConfigs: z.array(configurationExportActionConfigSchema),
        updatedAt: z.string().trim().min(1)
      })
      .strict()
  })
  .strict();

const configurationImportPreviewSchema = z
  .object({
    package: configurationImportPackageSchema
  })
  .strict();

const configurationImportApplySchema = z
  .object({
    previewId: z.string().trim().min(1)
  })
  .strict();

const integrationImportPreviewSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    adapterId: z.string().trim().min(1),
    connectionId: z.string().trim().min(1),
    payloadFixtureKey: z.enum(["mock-crm-valid", "mock-crm-invalid"]),
    payloadFingerprint: z.string().trim().min(1).optional()
  })
  .strict();

const integrationImportApplySchema = z
  .object({
    previewId: z.string().trim().min(1),
    batchId: z.string().trim().min(1).optional(),
    idempotencyKey: z.string().trim().min(1).optional(),
    auditEventId: z.string().trim().min(1).optional(),
    confirmed: z.boolean()
  })
  .strict();

const integrationFailureModeSchema = z
  .object({
    code: z.enum(["adapter_rate_limited", "adapter_unavailable", "adapter_failure"]),
    message: z.string().trim().min(1),
    retryAfterSeconds: z.number().int().positive().optional()
  })
  .strict();

const kpiDefinitionVersionCommandSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).optional()
  })
  .strict();

const kpiSourceValueSchema = z
  .object({
    tenantId: z.string().trim().min(1),
    bindingKey: z.string().trim().min(1),
    value: z.number(),
    sourceEntityType: z.enum(["opportunity", "project", "project_stage", "task", "resource"]),
    sourceEntityId: z.string().trim().min(1),
    sourceField: z.string().trim().min(1),
    observedAt: z.string().trim().min(1)
  })
  .strict();

const kpiEvaluationRunSchema = z
  .object({
    definitionId: z.string().trim().min(1),
    entity: z
      .object({
        type: z.enum(["opportunity", "project", "project_stage", "task", "resource"]),
        id: z.string().trim().min(1)
      })
      .strict(),
    period: z
      .object({
        start: scheduleDateSchema,
        end: scheduleDateSchema
      })
      .strict(),
    sourceValues: z.array(kpiSourceValueSchema).optional()
  })
  .strict();

const controlActionTargetSchema = z
  .object({
    surfaceId: z.string().trim().min(1),
    surfaceKey: z.string().trim().min(1),
    rowId: z.string().trim().min(1),
    entityType: z.string().trim().min(1),
    entityId: z.string().trim().min(1)
  })
  .strict();

const controlActionPreviewSchema = z
  .object({
    target: controlActionTargetSchema,
    input: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

const controlActionExecuteSchema = z
  .object({
    previewId: z.string().trim().min(1).optional(),
    target: controlActionTargetSchema.optional(),
    input: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

const closureLessonSchema = z
  .object({
    id: z.string().trim().min(1),
    categoryKey: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    recommendation: z.string().trim().min(1).optional(),
    severity: z.enum(["positive", "attention", "critical"])
  })
  .strict();

const closureDataSchema = z
  .object({
    finalKpiSummary: z.string().trim().min(1).optional(),
    qualityScore: z.number().int().min(1).max(5).optional(),
    clientSatisfactionScore: z.number().int().min(1).max(5).optional(),
    closingSummary: z.string().trim().min(1).optional(),
    lessonsLearned: z.array(closureLessonSchema).optional()
  })
  .strict();

const closureBlockerOverrideSchema = z
  .object({
    blockerCode: z.enum([
      "tenant_mismatch",
      "project_not_active",
      "project_not_in_final_stage",
      "stage_gate_blocked",
      "missing_closure_requirement",
      "open_required_task"
    ]),
    requirementId: z.string().trim().min(1).optional(),
    taskId: z.string().trim().min(1).optional(),
    stageId: z.string().trim().min(1).optional(),
    reason: z.string().trim().min(1),
    auditEventId: z.string().trim().min(1)
  })
  .strict();

const closurePreviewSchema = z
  .object({
    closureData: closureDataSchema,
    blockerOverrides: z.array(closureBlockerOverrideSchema).optional()
  })
  .strict();

const closureApplySchema = z
  .object({
    previewId: z.string().trim().min(1).optional(),
    closureData: closureDataSchema.optional()
  })
  .strict();

const retrospectivePaginationQuerySchema = z
  .object({
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(50).default(25),
    templateId: z.string().trim().min(1).optional(),
    clientId: z.string().trim().min(1).optional(),
    period: z.string().trim().regex(/^\d{4}-\d{2}$/).optional()
  })
  .strict();

const retrospectiveTrendsQuerySchema = retrospectivePaginationQuerySchema
  .extend({
    groupBy: z.enum(["project_type", "template", "client", "period"]).default("template")
  })
  .strict();

const templateImprovementPreviewSchema = z
  .object({
    improvementKey: z.literal("add_acceptance_checkpoint").default("add_acceptance_checkpoint"),
    reason: z.string().trim().min(1)
  })
  .strict();

const templateImprovementApplySchema = z
  .object({
    previewId: z.string().trim().min(1).optional()
  })
  .strict();

const taskStatusUpdateSchema = z
  .object({
    toStatus: z.enum(["todo", "in_progress", "blocked", "done", "cancelled"])
  })
  .strict();

const taskCommentCreateSchema = z
  .object({
    body: z.string().trim().min(1)
  })
  .strict();

function errorDto(code: ApiErrorCode, message: string) {
  return { code, message };
}

function mapPolicyReasonToErrorCode(reasonCode: string): ApiErrorCode {
  if (reasonCode === "tenant_mismatch") return "tenant_mismatch";
  if (reasonCode === "unsupported_scope") return "unsupported_scope";
  return "permission_denied";
}

function accessProfileDto(profile: {
  id: string;
  tenantId: string;
  systemKey: string;
  label: string;
  permissions: string[];
  scopeRules: Array<{ permissionKey: string; scope: string; constraints?: Record<string, string | number | boolean> }>;
  active: boolean;
  version: number;
  updatedAt: string;
}) {
  return {
    id: profile.id,
    tenantId: profile.tenantId,
    systemKey: profile.systemKey,
    label: profile.label,
    permissions: [...profile.permissions],
    scopeRules: profile.scopeRules.map((rule) => ({
      permissionKey: rule.permissionKey,
      scope: rule.scope,
      ...(rule.constraints !== undefined ? { constraints: { ...rule.constraints } } : {})
    })),
    active: profile.active,
    version: profile.version,
    updatedAt: profile.updatedAt
  };
}

function auditEventDto(event: {
  id: string;
  tenantId: string;
  actorId: string;
  actionKey: string;
  target: { entityType: string; entityId: string };
  result: string;
  timestamp: string;
  correlationId: string;
  details?: unknown;
}) {
  return {
    id: event.id,
    tenantId: event.tenantId,
    actorId: event.actorId,
    actionKey: event.actionKey,
    target: { ...event.target },
    result: event.result,
    timestamp: event.timestamp,
    correlationId: event.correlationId,
    ...(event.details !== undefined ? { details: event.details } : {})
  };
}

async function parseJson(context: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    throw new Error("invalid_json");
  }
}

function requireSession(runtime: Phase2RuntimeState, testUserId: string | undefined): Phase2RuntimeSession {
  const session = runtime.resolveSession(testUserId);
  if (!session) {
    throw new Error("unauthenticated");
  }

  return session;
}

function assertAllowed(
  runtime: Phase2RuntimeState,
  session: Phase2RuntimeSession,
  permissionKey: string,
  target: { entityType: string; tenantId: string; entityId?: string; ownerId?: string },
  requestedScope?: string,
  contextRefs?: { projectIds?: string[] }
) {
  const evaluation = runtime.evaluatePolicy({
    session,
    permissionKey,
    target,
    ...(requestedScope !== undefined ? { requestedScope } : {}),
    ...(contextRefs !== undefined ? { contextRefs } : {})
  });

  if (!evaluation.allowed) {
    const code = mapPolicyReasonToErrorCode(evaluation.reasonCode);
    throw Object.assign(new Error(code), { code, status: 403 });
  }

  return evaluation;
}

function assertTaskActionRelation(
  session: Phase2RuntimeSession,
  project: ManagedProject,
  taskId: string,
  allowedRoles?: TaskParticipantRole[]
): void {
  if (session.profile.systemKey === "tenant_admin" || session.profile.systemKey === "project_manager") {
    return;
  }
  const isRelatedToTask = project.taskParticipants.some(
    (participant) =>
      participant.taskId === taskId &&
      participant.userId === session.user.id &&
      (allowedRoles === undefined || allowedRoles.includes(participant.role))
  );
  if (!isRelatedToTask) {
    throw Object.assign(new Error("permission_denied"), { code: "permission_denied", status: 403 });
  }
}

function assertTenantUsersExist(
  runtime: Phase2RuntimeState,
  session: Phase2RuntimeSession,
  participants: Phase4CreateTaskParticipantInput[] | undefined
): void {
  for (const participant of participants ?? []) {
    if (runtime.users.get(participant.userId)?.tenantId !== session.user.tenantId) {
      throw Object.assign(new Error("validation_error"), { code: "validation_error" });
    }
  }
}

function buildPhase11Adapter(tenantId: string): IntegrationAdapterDefinition {
  return createIntegrationAdapterDefinition({
    id: "adapter-mock-crm",
    tenantId,
    systemKey: "mock-crm",
    label: "Mock CRM",
    sourceSystem: "mock-crm",
    capabilities: ["import_preview", "import_apply", "health_check", "mapping_diagnostics", "failure_mode_test"],
    active: true
  });
}

function buildPhase11Connection(tenantId: string): IntegrationConnection {
  return createIntegrationConnection({
    id: tenantId === "tenant-a" ? "conn-mock-crm-a" : "conn-mock-crm-b",
    tenantId,
    adapterId: "adapter-mock-crm",
    label: "Mock CRM connection",
    sourceSystem: "mock-crm",
    status: "healthy",
    configuredAt: "2026-05-17T07:00:00+07:00"
  });
}

function phase11Payload(fixtureKey: "mock-crm-valid" | "mock-crm-invalid"): MockAdapterCanonicalImportPayload {
  const payload: MockAdapterCanonicalImportPayload = {
    opportunity: {
      externalId: "api-opp-100",
      title: "Импорт: API сделка",
      account: { externalId: "api-account-100", displayName: "API account" },
      contacts: [{ externalId: "api-contact-100", displayName: "API contact" }],
      plannedStartDate: "2026-12-01",
      desiredFinishDate: "2026-12-31",
      expectedValue: { amount: 2100000, currency: "RUB" },
      probability: 0.73,
      categoryKey: "implementation",
      typologyKey: "portal"
    },
    project: {
      externalId: "api-project-100",
      title: "Импорт: API проект",
      template: {
        templateId: "api-template",
        key: "implementation.integration_heavy",
        label: "Внедрение с интеграциями",
        version: 1,
        matchConfidence: 0.9,
        assumptions: []
      },
      demand: {
        totalPlannedWorkHours: 112,
        scenarioKey: "baseline",
        scenarioLabel: "Базовый сценарий",
        formulaKey: "phase11.api",
        formulaVersion: 1,
        confidence: 0.82,
        stageRoleDemands: []
      },
      feasibility: {
        status: "fit",
        severity: "none",
        blockerCodes: []
      }
    },
    tasks: [
      {
        externalId: "api-task-100",
        title: "API imported task",
        stageKey: "initiation",
        plannedWorkHours: 16,
        dueDate: "2026-12-15",
        participantRoleKeys: ["project_manager"]
      }
    ]
  };

  if (fixtureKey === "mock-crm-invalid") {
    return {
      ...payload,
      opportunity: {
        ...payload.opportunity,
        title: "",
        desiredFinishDate: "2026-11-01"
      }
    };
  }

  return payload;
}

export function createApiApp(options: CreateApiAppOptions = {}) {
  const app = new Hono();
  let runtime = createPhase2RuntimeState();
  let phase3Runtime = createPhase3CrmRuntimeState();
  let phase4Runtime = createPhase4RuntimeState();
  let phase5Runtime = createPhase5RuntimeState();
  let phase6Runtime = createPhase6RuntimeState();
  let phase7Runtime = createPhase7RuntimeState();
  let phase8Runtime = createPhase8RuntimeState();
  let phase9Runtime = createPhase9RuntimeState();
  let phase10Runtime = createPhase10RuntimeState();
  let phase11Runtime = createPhase11RuntimeState();
  let phase11ImportPreviewCounter = 0;

  app.get("/health", (context) =>
    context.json({
      status: "ok",
      service: "kiss-pm-api"
    })
  );

  app.get("/health/deployment", (context) => context.json(validatePhase12DeploymentEnvironment(options.deploymentEnvironment)));

  app.get("/api/ops/release-readiness", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "release.readiness.read", {
        entityType: "releaseReadiness",
        tenantId: session.user.tenantId,
        entityId: session.user.tenantId
      });

      return context.json(
        buildPhase12ReleaseReadinessReadModel({
          tenantId: session.user.tenantId,
          generatedAt: runtime.now(),
          deployment: validatePhase12DeploymentEnvironment(options.deploymentEnvironment)
        })
      );
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  function currentConfigurationVersion(session: Phase2RuntimeSession): number {
    return Math.max(
      session.labelSet.configurationVersion,
      phase10Runtime.getCustomFieldRegistry(session.user.tenantId).version,
      phase10Runtime.getActionConfiguration(session.user.tenantId).version
    );
  }

  function buildConfigurationExportPackage(session: Phase2RuntimeSession): ConfigurationExportPackage {
    const actionConfiguration = phase10Runtime.getActionConfiguration(session.user.tenantId);
    return createConfigurationImportPackageWithChecksum({
      schemaVersion: 1,
      tenantId: session.user.tenantId,
      configurationVersion: currentConfigurationVersion(session),
      exportedAt: runtime.now(),
      labelSet: session.labelSet,
      customFieldRegistry: phase10Runtime.getCustomFieldRegistry(session.user.tenantId),
      actionConfiguration: {
        tenantId: actionConfiguration.tenantId,
        version: actionConfiguration.version,
        actionConfigs: actionConfiguration.actionConfigs.map((entry) => ({
          actionKey: entry.actionKey,
          enabled: entry.enabled,
          formFields: entry.formFields.map((field) => ({
            fieldKey: field.fieldKey,
            ...(field.label !== undefined ? { label: field.label } : {}),
            ...(field.defaultValue !== undefined ? { defaultValue: field.defaultValue } : {})
          }))
        })),
        updatedAt: actionConfiguration.updatedAt
      }
    });
  }

  function configurationOverview(session: Phase2RuntimeSession) {
    const customFieldRegistry = phase10Runtime.getCustomFieldRegistry(session.user.tenantId);
    const actionConfiguration = phase10Runtime.getActionConfiguration(session.user.tenantId);
    return {
      active: {
        tenantId: session.user.tenantId,
        configurationVersion: currentConfigurationVersion(session),
        labelSetVersion: session.labelSet.configurationVersion,
        customFieldRegistryVersion: customFieldRegistry.version,
        actionConfigurationVersion: actionConfiguration.version
      },
      validation: {
        canPublish: true,
        issues: []
      },
      runtimeSurfaces: ["tenant.labels", "portfolio.control", "tenant.custom_fields", "tenant.action_config"],
      versions: {
        labelSet: [{ version: session.labelSet.configurationVersion, updatedAt: session.labelSet.updatedAt }],
        customFieldRegistry: [{ version: customFieldRegistry.version, updatedAt: customFieldRegistry.updatedAt }],
        actionConfiguration: [
          ...phase10Runtime.listPreviousActionConfigurations(session.user.tenantId).map((entry) => ({
            version: entry.version,
            updatedAt: entry.updatedAt
          })),
          { version: actionConfiguration.version, updatedAt: actionConfiguration.updatedAt }
        ]
      }
    };
  }

  function phase11Adapters(session: Phase2RuntimeSession): IntegrationAdapterDefinition[] {
    return [buildPhase11Adapter(session.user.tenantId)];
  }

  function phase11Connections(session: Phase2RuntimeSession): IntegrationConnection[] {
    return [buildPhase11Connection(session.user.tenantId)];
  }

  function requirePhase11Connection(session: Phase2RuntimeSession, adapterId: string, connectionId: string): IntegrationConnection {
    const connection = phase11Connections(session).find((item) => item.id === connectionId && item.adapterId === adapterId);
    if (connection === undefined) {
      throw Object.assign(new Error("not_found"), { code: "not_found" as const });
    }

    return connection;
  }

  function phase11Diagnostics(session: Phase2RuntimeSession) {
    return phase11Connections(session).map((connection) => {
      const failure = phase11Runtime.getConnectionFailureMode({
        tenantId: session.user.tenantId,
        connectionId: connection.id
      });

      return {
        tenantId: session.user.tenantId,
        adapterId: connection.adapterId,
        connectionId: connection.id,
        status: failure?.code === "adapter_rate_limited" ? "rate_limited" : failure === undefined ? "healthy" : "failed",
        ...(failure !== undefined ? { failure } : {})
      };
    });
  }

  function requirePhase11ImportedProjectMaterializationReady(
    session: Phase2RuntimeSession,
    preview: MockAdapterCanonicalImportPreview
  ): void {
    const projectDraftPreview = preview.canonical.projectDraft;
    const projectMapping = preview.mappingPreview.find((mapping) => mapping.canonicalEntityType === "project");
    if (projectDraftPreview === undefined || projectMapping === undefined) {
      return;
    }
    if (phase4Runtime.getProject(session.user.tenantId, projectMapping.canonicalEntityId) !== undefined) {
      return;
    }

    const processTemplate = phase4Runtime.getProcessTemplate(session.user.tenantId);
    const tenantProjects = phase4Runtime.listProjects(session.user.tenantId);
    for (const taskPreview of preview.canonical.tasks) {
      const stageTemplate = processTemplate.stages.find((candidate) => candidate.key === taskPreview.stageKey);
      const taskTemplate = stageTemplate?.taskTemplates[0];
      if (stageTemplate === undefined || taskTemplate === undefined) {
        throw Object.assign(new Error("imported task stage cannot be materialized into the canonical project template"), {
          code: "precondition_failed"
        });
      }
      const taskIdAlreadyExists = tenantProjects.some((project) => project.tasks.some((task) => task.id === taskPreview.id));
      if (taskIdAlreadyExists) {
        throw Object.assign(new Error("imported task canonical id already exists in another project"), { code: "conflict" });
      }
    }
  }

  function materializePhase11ImportedProject(session: Phase2RuntimeSession, preview: MockAdapterCanonicalImportPreview) {
    const projectDraftPreview = preview.canonical.projectDraft;
    const projectMapping = preview.mappingPreview.find((mapping) => mapping.canonicalEntityType === "project");
    if (projectDraftPreview === undefined || projectMapping === undefined) {
      return undefined;
    }
    const existingProject = phase4Runtime.getProject(session.user.tenantId, projectMapping.canonicalEntityId);
    if (existingProject !== undefined) {
      return existingProject;
    }

    const processTemplate = phase4Runtime.getProcessTemplate(session.user.tenantId);
    const projectDraft = createProjectDraftFromOpportunity({
      id: projectDraftPreview.id,
      tenantId: session.user.tenantId,
      title: projectDraftPreview.title,
      createdBy: session.user.id,
      createdAt: runtime.now(),
      correlationId: `corr-imported-draft-${preview.id}`,
      sourceOpportunity: projectDraftPreview.sourceOpportunity,
      processTemplate: {
        tenantId: session.user.tenantId,
        templateId: processTemplate.id,
        key: processTemplate.key,
        label: processTemplate.label,
        version: processTemplate.version,
        matchConfidence: 1,
        assumptions: []
      },
      demand: projectDraftPreview.demand,
      feasibility: projectDraftPreview.feasibility
    });

    let project = phase4Runtime.createManagedProjectFromTemplate({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      projectDraft,
      projectId: projectMapping.canonicalEntityId
    });

    for (const taskPreview of preview.canonical.tasks) {
      const stage = project.stages.find((candidate) => candidate.templateKey === taskPreview.stageKey);
      const stageTemplate = project.processTemplateSnapshot.stageTemplates.find((candidate) => candidate.key === stage?.templateKey);
      const taskTemplate = stageTemplate?.taskTemplates[0];
      if (stage === undefined || taskTemplate === undefined) {
        continue;
      }
      const taskExists = project.tasks.some((task) => task.id === taskPreview.id);
      if (taskExists) {
        continue;
      }
      const result = phase4Runtime.createTask({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        projectId: project.id,
        id: taskPreview.id,
        stageId: stage.id,
        taskTemplateId: taskTemplate.id,
        taskTemplateKey: taskTemplate.key,
        title: taskPreview.title,
        status: "todo",
        dueDate: taskPreview.dueDate,
        plannedWorkHours: taskPreview.plannedWorkHours,
        participants: [
          {
            userId: session.user.id,
            role: "executor"
          }
        ]
      });
      project = result.project;
    }

    runtime.appendAuditEvent({
      session,
      id: `audit-imported-project-materialized-${preview.id}`,
      actionKey: "integration.import.materialize_project",
      target: { entityType: "project", entityId: project.id },
      correlationId: `corr-imported-project-materialized-${preview.id}`,
      details: {
        before: { state: "not_materialized" },
        after: {
          projectId: project.id,
          taskIds: project.tasks.map((task) => task.id),
          importPreviewId: preview.id,
          importBatchSource: "phase11"
        }
      }
    });

    return project;
  }

  function appendConfigurationImportAudit(session: Phase2RuntimeSession, result: ReturnType<typeof phase10Runtime.applyConfigurationPackageImport>) {
    runtime.appendAuditEvent({
      session,
      id: result.audit.auditEventId,
      actionKey: result.audit.commandType,
      target: { entityType: "tenantConfiguration", entityId: session.user.tenantId },
      correlationId: result.actionExecution.correlationId,
      details: {
        before: { configurationVersion: result.audit.beforeVersion },
        after: { configurationVersion: result.audit.afterVersion, importedChecksum: result.audit.importedChecksum }
      }
    });
  }

  app.get("/api/tenant/configuration", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.read", {
        entityType: "tenantConfiguration",
        tenantId: session.user.tenantId
      });

      return context.json(configurationOverview(session));
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/tenant/configuration/versions", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.read", {
        entityType: "tenantConfiguration",
        tenantId: session.user.tenantId
      });

      return context.json({ versions: configurationOverview(session).versions });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/configuration/validate", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.read", {
        entityType: "tenantConfiguration",
        tenantId: session.user.tenantId
      });
      const body = await parseJson(context);
      const incomingPackage =
        typeof body === "object" && body !== null && "package" in body
          ? (configurationImportPackageSchema.parse((body as { package: unknown }).package) as ConfigurationExportPackage)
          : buildConfigurationExportPackage(session);
      const preview = previewConfigurationImport(buildConfigurationExportPackage(session), incomingPackage, {
        id: `validation-config-import-${session.user.tenantId}`,
        actorId: session.user.id,
        createdAt: runtime.now()
      });

      return context.json({
        validation: {
          canPublish: preview.canApply,
          issues: preview.validationIssues
        }
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/configuration/preview", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.read", {
        entityType: "tenantConfiguration",
        tenantId: session.user.tenantId
      });
      const body = configurationImportPreviewSchema.parse(await parseJson(context));
      const preview = phase10Runtime.previewConfigurationPackageImport({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        currentPackage: buildConfigurationExportPackage(session),
        incomingPackage: body.package as ConfigurationExportPackage
      });

      return context.json({ preview });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/configuration/publish", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "tenantConfiguration",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "tenant.config.import", {
        entityType: "tenantConfiguration",
        tenantId: session.user.tenantId
      });
      const body = configurationImportApplySchema.parse(await parseJson(context));
      const result = phase10Runtime.applyConfigurationPackageImport({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        currentPackage: buildConfigurationExportPackage(session),
        previewId: body.previewId,
        auditEventId: `audit-config-import-${session.user.tenantId}-${currentConfigurationVersion(session) + 1}`
      });
      runtime.replaceLabelSet(result.importedPackage.labelSet);
      appendConfigurationImportAudit(session, result);
      const refreshedSession = requireSession(runtime, context.req.query("testUser"));

      return context.json({
        result: {
          importedPackage: result.importedPackage,
          audit: configurationImportAuditDto(result.audit),
          actionExecution: actionExecutionDto(result.actionExecution)
        },
        readback: configurationOverview(refreshedSession)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/tenant/configuration/export", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.export", {
        entityType: "tenantConfiguration",
        tenantId: session.user.tenantId
      });

      return context.json({ package: buildConfigurationExportPackage(session) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/configuration/import/preview", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.import", {
        entityType: "tenantConfiguration",
        tenantId: session.user.tenantId
      });
      const body = configurationImportPreviewSchema.parse(await parseJson(context));
      const preview = phase10Runtime.previewConfigurationPackageImport({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        currentPackage: buildConfigurationExportPackage(session),
        incomingPackage: body.package as ConfigurationExportPackage
      });

      return context.json({ preview });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/configuration/import/apply", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "tenantConfiguration",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "tenant.config.import", {
        entityType: "tenantConfiguration",
        tenantId: session.user.tenantId
      });
      const body = configurationImportApplySchema.parse(await parseJson(context));
      const result = phase10Runtime.applyConfigurationPackageImport({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        currentPackage: buildConfigurationExportPackage(session),
        previewId: body.previewId,
        auditEventId: `audit-config-import-${session.user.tenantId}-${currentConfigurationVersion(session) + 1}`
      });
      runtime.replaceLabelSet(result.importedPackage.labelSet);
      appendConfigurationImportAudit(session, result);
      const refreshedSession = requireSession(runtime, context.req.query("testUser"));

      return context.json({
        result: {
          importedPackage: result.importedPackage,
          audit: configurationImportAuditDto(result.audit),
          actionExecution: actionExecutionDto(result.actionExecution)
        },
        readback: configurationOverview(refreshedSession)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/integrations/adapters", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "integration.read", {
        entityType: "integrationAdapter",
        tenantId: session.user.tenantId
      });

      return context.json({ adapters: phase11Adapters(session) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/integrations/connections", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "integration.read", {
        entityType: "integrationConnection",
        tenantId: session.user.tenantId
      });

      return context.json({ connections: phase11Connections(session) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/integrations/diagnostics", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "integration.read", {
        entityType: "integrationDiagnostics",
        tenantId: session.user.tenantId
      });

      return context.json({ diagnostics: phase11Diagnostics(session) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/integrations/connections/:connectionId/failure-mode", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "integration.admin", {
        entityType: "integrationConnection",
        tenantId: session.user.tenantId,
        entityId: context.req.param("connectionId")
      });
      const connection = phase11Connections(session).find((item) => item.id === context.req.param("connectionId"));
      if (connection === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      const body = integrationFailureModeSchema.parse(await parseJson(context));
      phase11Runtime.setConnectionFailureMode({
        tenantId: session.user.tenantId,
        adapterId: connection.adapterId,
        connectionId: connection.id,
        failure: {
          code: body.code,
          message: body.message,
          retryable: body.code === "adapter_rate_limited" || body.code === "adapter_unavailable",
          ...(body.retryAfterSeconds !== undefined ? { retryAfterSeconds: body.retryAfterSeconds } : {}),
          occurredAt: runtime.now()
        }
      });

      return context.json({ diagnostics: phase11Diagnostics(session) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.delete("/api/integrations/connections/:connectionId/failure-mode", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "integration.admin", {
        entityType: "integrationConnection",
        tenantId: session.user.tenantId,
        entityId: context.req.param("connectionId")
      });
      const connection = phase11Connections(session).find((item) => item.id === context.req.param("connectionId"));
      if (connection === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      phase11Runtime.clearConnectionFailureMode({ tenantId: session.user.tenantId, connectionId: connection.id });

      return context.json({ diagnostics: phase11Diagnostics(session) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/integrations/import/preview", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "integration.preview", {
        entityType: "integrationImportPreview",
        tenantId: session.user.tenantId
      });
      const body = integrationImportPreviewSchema.parse(await parseJson(context));
      const connection = requirePhase11Connection(session, body.adapterId, body.connectionId);
      const previewId =
        body.id ??
        `preview-api-import-${session.user.tenantId}-${String(++phase11ImportPreviewCounter).padStart(4, "0")}`;
      const preview = phase11Runtime.previewMockImport({
        id: previewId,
        tenantId: session.user.tenantId,
        adapterId: body.adapterId,
        connectionId: connection.id,
        sourceSystem: connection.sourceSystem,
        payloadFingerprint: body.payloadFingerprint ?? `fingerprint-${body.payloadFixtureKey}-v1`,
        receivedAt: runtime.now(),
        previewedAt: runtime.now(),
        payload: phase11Payload(body.payloadFixtureKey)
      });

      return context.json({
        preview,
        validationReport: phase11Runtime.getMigrationValidationReport({
          tenantId: session.user.tenantId,
          previewId: preview.id,
          generatedAt: runtime.now()
        }),
        dryRunSummary: phase11Runtime.getImportDryRunSummary({
          tenantId: session.user.tenantId,
          previewId: preview.id,
          generatedAt: runtime.now()
        })
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/integrations/import/previews/:previewId/report", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "integration.preview", {
        entityType: "integrationImportPreview",
        tenantId: session.user.tenantId,
        entityId: context.req.param("previewId")
      });

      return context.json({
        validationReport: phase11Runtime.getMigrationValidationReport({
          tenantId: session.user.tenantId,
          previewId: context.req.param("previewId"),
          generatedAt: runtime.now()
        })
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/integrations/import/previews/:previewId/dry-run", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "integration.preview", {
        entityType: "integrationImportPreview",
        tenantId: session.user.tenantId,
        entityId: context.req.param("previewId")
      });

      return context.json({
        dryRunSummary: phase11Runtime.getImportDryRunSummary({
          tenantId: session.user.tenantId,
          previewId: context.req.param("previewId"),
          generatedAt: runtime.now()
        })
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/integrations/import/apply", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "integration.apply", {
        entityType: "integrationImportBatch",
        tenantId: session.user.tenantId
      });
      const body = integrationImportApplySchema.parse(await parseJson(context));
      const applyInput = {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        previewId: body.previewId,
        batchId: body.batchId ?? `batch-api-import-${session.user.tenantId}`,
        idempotencyKey: body.idempotencyKey ?? `idem-api-import-${body.previewId}`,
        auditEventId: body.auditEventId ?? `audit-api-import-${body.previewId}`,
        appliedAt: runtime.now(),
        confirmed: body.confirmed
      };
      let preview: MockAdapterCanonicalImportPreview;
      try {
        preview = phase11Runtime.getImportPreview({
          tenantId: session.user.tenantId,
          previewId: body.previewId
        });
      } catch (error) {
        phase11Runtime.applyImport(applyInput);
        throw error;
      }
      requirePhase11ImportedProjectMaterializationReady(session, preview);
      const result = phase11Runtime.applyImport(applyInput);
      const materializedProject = materializePhase11ImportedProject(session, preview);

      return context.json({
        result,
        ...(materializedProject !== undefined ? { materializedProject: projectDto(materializedProject) } : {}),
        readback: {
          batches: phase11Runtime.listImportBatches(session.user.tenantId),
          mappings: phase11Runtime.listMappings(session.user.tenantId),
          audit: phase11Runtime.listSyncAudit(session.user.tenantId)
        }
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/integrations/import/batches", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "integration.read", {
        entityType: "integrationImportBatch",
        tenantId: session.user.tenantId,
      });

      return context.json({ batches: phase11Runtime.listImportBatches(session.user.tenantId) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/integrations/mappings", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "integration.mapping.read", {
        entityType: "externalMapping",
        tenantId: session.user.tenantId
      });

      return context.json({ mappings: phase11Runtime.listMappings(session.user.tenantId) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/integrations/audit", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "integration.audit.read", {
        entityType: "syncAuditEvent",
        tenantId: session.user.tenantId
      });

      return context.json({ audit: phase11Runtime.listSyncAudit(session.user.tenantId) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/tenants/current", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.read", {
        entityType: "tenant",
        tenantId: session.user.tenantId,
        entityId: session.tenant.id
      });

      return context.json({
        tenant: {
          id: session.tenant.id,
          label: session.tenant.label,
          configurationVersion: session.labelSet.configurationVersion
        },
        actor: {
          id: session.user.id,
          displayName: session.user.displayName,
          accessProfileId: session.user.accessProfileId
        },
        labels: { ...session.labelSet.labels },
        permissions: [...session.profile.permissions]
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/tenant/labels", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.read", {
        entityType: "tenantLabelSet",
        tenantId: session.user.tenantId
      });

      return context.json({
        labelSet: {
          tenantId: session.labelSet.tenantId,
          configurationVersion: session.labelSet.configurationVersion,
          labels: { ...session.labelSet.labels },
          updatedAt: session.labelSet.updatedAt
        },
        runtimeProjection: buildRuntimeLabelProjection(session.labelSet)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/labels/preview", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "tenantLabelSet",
        tenantId: session.user.tenantId
      });

      const body = tenantLabelPreviewSchema.parse(await parseJson(context));
      const preview = phase10Runtime.previewLabels({
        labelSet: session.labelSet,
        actorId: session.user.id,
        changes: body.changes,
        affectedRuntimeSurfaces: body.affectedRuntimeSurfaces
      });

      return context.json({
        preview,
        runtimeProjection: buildRuntimeLabelProjection({
          ...session.labelSet,
          configurationVersion: preview.after.configurationVersion,
          labels: preview.after.labels,
          updatedAt: preview.createdAt
        })
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/labels/publish", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "tenantLabelSet",
        tenantId: session.user.tenantId
      });

      const body = tenantLabelPublishSchema.parse(await parseJson(context));
      const auditEventId = `audit-p10-labels-${session.user.tenantId}-${session.labelSet.configurationVersion + 1}`;
      const result = phase10Runtime.publishLabels({
        labelSet: session.labelSet,
        actorId: session.user.id,
        accessProfileId: session.user.accessProfileId,
        previewId: body.previewId,
        auditEventId
      });
      const savedLabelSet = runtime.replaceLabelSet(result.labelSet);
      runtime.appendAuditEvent({
        session,
        id: result.audit.auditEventId,
        actionKey: result.audit.commandType,
        target: { entityType: "tenantLabelSet", entityId: session.user.tenantId },
        correlationId: result.actionExecution.correlationId,
        details: {
          before: { configurationVersion: result.audit.beforeConfigurationVersion },
          after: { configurationVersion: result.audit.afterConfigurationVersion },
          previousConfigurationVersion: result.audit.beforeConfigurationVersion,
          newConfigurationVersion: result.audit.afterConfigurationVersion
        }
      });

      return context.json({
        result: {
          labelSet: {
            tenantId: savedLabelSet.tenantId,
            configurationVersion: savedLabelSet.configurationVersion,
            labels: { ...savedLabelSet.labels },
            updatedAt: savedLabelSet.updatedAt
          },
          audit: tenantLabelPublishAuditDto(result.audit),
          actionExecution: actionExecutionDto(result.actionExecution)
        },
        readback: {
          runtimeProjection: buildRuntimeLabelProjection(savedLabelSet)
        }
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/tenant/process-templates", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.read", {
        entityType: "processTemplate",
        tenantId: session.user.tenantId
      });

      return context.json({
        templates: [processTemplateDto(phase4Runtime.getProcessTemplate(session.user.tenantId))]
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/process-templates/preview", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "processTemplate",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "project.template.write", {
        entityType: "processTemplate",
        tenantId: session.user.tenantId
      });

      const body = processTemplatePreviewSchema.parse(await parseJson(context));
      const template = phase4Runtime.getProcessTemplate(session.user.tenantId);
      if (template.id !== body.templateId) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      const preview = phase10Runtime.previewProcessTemplate({
        template,
        actorId: session.user.id,
        expectedTemplateVersion: body.expectedTemplateVersion,
        draft: body.draft,
        activeProjectTemplateVersions: phase4Runtime.listActiveProjectProcessTemplateVersions(
          session.user.tenantId,
          body.templateId
        ),
        affectedRuntimeSurfaces: body.affectedRuntimeSurfaces
      });

      return context.json({
        preview: {
          ...preview,
          after: {
            ...preview.after,
            template: processTemplateDto(preview.after.template)
          }
        }
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/process-templates/publish", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "processTemplate",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "project.template.write", {
        entityType: "processTemplate",
        tenantId: session.user.tenantId
      });

      const body = processTemplatePublishSchema.parse(await parseJson(context));
      const template = phase4Runtime.getProcessTemplate(session.user.tenantId);
      if (template.id !== body.templateId) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      const auditEventId = `audit-p10-process-template-${session.user.tenantId}-${template.version + 1}`;
      const result = phase10Runtime.publishProcessTemplate({
        template,
        actorId: session.user.id,
        accessProfileId: session.user.accessProfileId,
        previewId: body.previewId,
        auditEventId
      });
      const savedTemplate = phase4Runtime.replaceProcessTemplate(result.template);
      phase3Runtime.replaceProcessTemplateForFutureIntake(savedTemplate);
      runtime.appendAuditEvent({
        session,
        id: result.audit.auditEventId,
        actionKey: result.audit.commandType,
        target: { entityType: "processTemplate", entityId: savedTemplate.id },
        correlationId: result.actionExecution.correlationId,
        details: {
          before: { templateVersion: result.audit.beforeTemplateVersion },
          after: {
            templateVersion: result.audit.afterTemplateVersion,
            activeProjectTemplateVersions: phase4Runtime.listActiveProjectProcessTemplateVersions(
              session.user.tenantId,
              savedTemplate.id
            )
          }
        }
      });

      return context.json({
        result: {
          template: processTemplateDto(savedTemplate),
          audit: processTemplatePublishAuditDto(result.audit),
          actionExecution: actionExecutionDto(result.actionExecution)
        },
        readback: {
          activeTemplate: processTemplateDto(phase4Runtime.getProcessTemplate(session.user.tenantId))
        }
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/tenant/custom-fields", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.read", {
        entityType: "customFieldDefinition",
        tenantId: session.user.tenantId
      });

      return context.json({
        registry: customFieldRegistryDto(phase10Runtime.getCustomFieldRegistry(session.user.tenantId))
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/custom-fields/preview", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "customFieldDefinition",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "custom_field.write", {
        entityType: "customFieldDefinition",
        tenantId: session.user.tenantId
      });

      const body = customFieldPreviewSchema.parse(await parseJson(context));
      const preview = phase10Runtime.previewCustomField({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        expectedRegistryVersion: body.expectedRegistryVersion,
        draft: body.draft,
        affectedRuntimeSurfaces: body.affectedRuntimeSurfaces
      });

      return context.json({ preview });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/custom-fields/publish", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "customFieldDefinition",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "custom_field.write", {
        entityType: "customFieldDefinition",
        tenantId: session.user.tenantId
      });

      const body = customFieldPublishSchema.parse(await parseJson(context));
      const auditEventId = `audit-p10-custom-field-${session.user.tenantId}-${phase10Runtime.getCustomFieldRegistry(session.user.tenantId).version + 1}`;
      const result = phase10Runtime.publishCustomField({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        accessProfileId: session.user.accessProfileId,
        previewId: body.previewId,
        auditEventId
      });
      runtime.appendAuditEvent({
        session,
        id: result.audit.auditEventId,
        actionKey: result.audit.commandType,
        target: { entityType: "customFieldDefinition", entityId: result.audit.definitionId },
        correlationId: result.actionExecution.correlationId,
        details: {
          before: { registryVersion: result.audit.beforeRegistryVersion },
          after: { registryVersion: result.audit.afterRegistryVersion }
        }
      });

      return context.json({
        result: {
          registry: customFieldRegistryDto(result.registry),
          audit: customFieldPublishAuditDto(result.audit),
          actionExecution: actionExecutionDto(result.actionExecution)
        },
        readback: {
          registry: customFieldRegistryDto(phase10Runtime.getCustomFieldRegistry(session.user.tenantId))
        }
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/tenant/kpi-thresholds", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.read", {
        entityType: "kpiThresholdRuleSet",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "kpi:read", {
        entityType: "kpiThresholdRuleSet",
        tenantId: session.user.tenantId
      });

      const thresholds = phase7Runtime.listDefinitions(session.user.tenantId).map((bundle) => ({
        definitionId: bundle.definition.id,
        label: bundle.definition.label,
        thresholdRuleSet: bundle.thresholdRuleSet
      }));
      const primaryDefinitionId = thresholds[0]?.definitionId;
      const latestEvaluation =
        primaryDefinitionId !== undefined
          ? phase7Runtime.getLatestEvaluationForDefinition(session.user.tenantId, primaryDefinitionId)
          : undefined;

      return context.json({
        thresholds,
        latestEvaluation: latestEvaluation ?? null
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/kpi-thresholds/preview", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "kpiThresholdRuleSet",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "kpi.config:write", {
        entityType: "kpiThresholdRuleSet",
        tenantId: session.user.tenantId
      });

      const body = kpiThresholdPreviewSchema.parse(await parseJson(context));
      const bundle = phase7Runtime.getBundle(session.user.tenantId, body.definitionId);
      if (bundle === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      const preview = phase10Runtime.previewKpiThreshold({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        thresholdRuleSet: bundle.thresholdRuleSet,
        expectedVersion: body.expectedVersion,
        rules: body.rules,
        sampleValue: body.sampleValue,
        affectedRuntimeSurfaces: body.affectedRuntimeSurfaces
      });

      return context.json({ preview });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/kpi-thresholds/publish", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "kpiThresholdRuleSet",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "kpi.config:write", {
        entityType: "kpiThresholdRuleSet",
        tenantId: session.user.tenantId
      });

      const body = kpiThresholdPublishSchema.parse(await parseJson(context));
      const storedPreview = phase10Runtime.getKpiThresholdPreview(session.user.tenantId, body.previewId);
      if (storedPreview === undefined) {
        throw Object.assign(new Error("KPI threshold preview is missing or stale"), { code: "stale_preview" as const });
      }
      const matchingBundle = phase7Runtime
        .listDefinitions(session.user.tenantId)
        .find((bundle) => bundle.thresholdRuleSet.id === storedPreview.thresholdRuleSet.id);
      if (matchingBundle === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      const auditEventId = `audit-kpi-thresholds-${session.user.tenantId}-${matchingBundle.thresholdRuleSet.version + 1}`;
      const result = phase10Runtime.publishKpiThreshold({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        definitionId: matchingBundle.definition.id,
        thresholdRuleSet: matchingBundle.thresholdRuleSet,
        previewId: body.previewId,
        auditEventId
      });
      const readback = phase7Runtime.replaceThresholdRuleSet({
        tenantId: session.user.tenantId,
        definitionId: matchingBundle.definition.id,
        thresholdRuleSet: result.thresholdRuleSet
      });
      runtime.appendAuditEvent({
        session,
        id: result.audit.auditEventId,
        actionKey: result.audit.commandType,
        target: { entityType: "kpiThresholdRuleSet", entityId: result.thresholdRuleSet.id },
        correlationId: result.actionExecution.correlationId,
        details: {
          before: { thresholdRuleSetVersion: result.audit.beforeVersion },
          after: { thresholdRuleSetVersion: result.audit.afterVersion }
        }
      });

      return context.json({
        result: {
          thresholdRuleSet: result.thresholdRuleSet,
          audit: kpiThresholdPublishAuditDto(result.audit),
          actionExecution: actionExecutionDto(result.actionExecution)
        },
        readback: {
          thresholdRuleSet: readback.thresholdRuleSet
        }
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/tenant/saved-views", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.read", {
        entityType: "controlSurface",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "control.surface:read", {
        entityType: "controlSurface",
        tenantId: session.user.tenantId
      });
      const surfaceId = context.req.query("surfaceId") ?? "portfolio-control";
      const baseSurface = phase8Runtime.getSurface(session.user.tenantId, surfaceId);
      if (baseSurface === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      const activeSurface = phase10Runtime.getPublishedControlSurfaceLayout(session.user.tenantId, surfaceId) ?? baseSurface;

      return context.json({
        activeSurface,
        previousVersions: phase10Runtime
          .listPreviousControlSurfaceLayouts(session.user.tenantId, activeSurface.id)
          .map((definition) => ({
            id: definition.id,
            version: definition.version,
            viewLabel: definition.view.label,
            updatedAt: definition.updatedAt
          }))
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/saved-views/preview", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "controlSurface",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "control_surface.config.write", {
        entityType: "controlSurface",
        tenantId: session.user.tenantId
      });

      const body = savedViewLayoutPreviewSchema.parse(await parseJson(context));
      const surface =
        phase10Runtime.getPublishedControlSurfaceLayout(session.user.tenantId, body.surfaceId) ??
        phase8Runtime.getSurface(session.user.tenantId, body.surfaceId);
      if (surface === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      const preview = phase10Runtime.previewControlSurfaceLayout({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        definition: surface,
        expectedSurfaceVersion: body.expectedSurfaceVersion,
        draft: {
          viewLabel: body.viewLabel,
          visibleFieldKeys: body.visibleFieldKeys,
          filterKeys: body.filterKeys,
          sortKeys: body.sortKeys,
          groupKeys: body.groupKeys,
          widgetKeys: body.widgetKeys,
          actionSlotKeys: body.actionSlotKeys,
          savedView: body.savedView
        },
        affectedRuntimeSurfaces: body.affectedRuntimeSurfaces
      });

      return context.json({ preview });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/saved-views/publish", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "controlSurface",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "control_surface.config.write", {
        entityType: "controlSurface",
        tenantId: session.user.tenantId
      });

      const body = savedViewLayoutPublishSchema.parse(await parseJson(context));
      const storedPreview = phase10Runtime.getControlSurfaceLayoutPreview(session.user.tenantId, body.previewId);
      if (storedPreview === undefined) {
        throw Object.assign(new Error("control surface layout preview is missing or stale"), {
          code: "stale_preview" as const
        });
      }
      const activePreview = phase10Runtime.getPublishedControlSurfaceLayout(
        session.user.tenantId,
        storedPreview.surfaceDefinitionId
      );
      const baseSurface = activePreview ?? phase8Runtime.getSurface(session.user.tenantId, storedPreview.surfaceDefinitionId);
      if (baseSurface === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      const auditEventId = `audit-layout-${session.user.tenantId}-${baseSurface.version + 1}`;
      const result = phase10Runtime.publishControlSurfaceLayout({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        definition: baseSurface,
        previewId: body.previewId,
        auditEventId
      });
      runtime.appendAuditEvent({
        session,
        id: result.audit.auditEventId,
        actionKey: result.audit.commandType,
        target: { entityType: "controlSurface", entityId: result.definition.id },
        correlationId: result.actionExecution.correlationId,
        details: {
          before: { surfaceVersion: result.audit.beforeSurfaceVersion },
          after: { surfaceVersion: result.audit.afterSurfaceVersion, savedViewKey: result.audit.savedViewKey }
        }
      });

      return context.json({
        result: {
          surface: result.definition,
          audit: controlSurfaceLayoutPublishAuditDto(result.audit),
          actionExecution: actionExecutionDto(result.actionExecution)
        },
        readback: {
          activeSurface: phase10Runtime.getPublishedControlSurfaceLayout(session.user.tenantId, result.definition.id),
          previousVersions: phase10Runtime
            .listPreviousControlSurfaceLayouts(session.user.tenantId, result.definition.id)
            .map((definition) => ({
              id: definition.id,
              version: definition.version,
              viewLabel: definition.view.label,
              updatedAt: definition.updatedAt
            }))
        }
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/tenant/action-configs", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.read", {
        entityType: "actionConfiguration",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "control.surface:read", {
        entityType: "controlSurface",
        tenantId: session.user.tenantId
      });
      const configuration = phase10Runtime.getActionConfiguration(session.user.tenantId);
      const actions = phase8Runtime.listActionDefinitions(session.user.tenantId, "portfolio-control").map((definition) => {
        const enabled = phase10Runtime.isActionEnabled(session.user.tenantId, definition.key);
        return {
          id: definition.id,
          key: definition.key,
          label: definition.label,
          description: definition.description,
          version: definition.version,
          targetEntityType: definition.targetEntityType,
          commandType: definition.commandBinding.commandType,
          requiredPermission: definition.requiredPermission,
          dryRunRequired: definition.dryRunRequired,
          enabled,
          ...(enabled ? {} : { disabledReason: "configuration_disabled" }),
          inputSchema: definition.inputSchema,
          formFields: phase10Runtime.getActionFormFields(session.user.tenantId, definition.key)
        };
      });

      return context.json({
        configuration,
        actions,
        runtime: {
          affectedRuntimeSurfaces: ["portfolio.control"],
          disabledActionKeys: configuration.actionConfigs.filter((entry) => !entry.enabled).map((entry) => entry.actionKey)
        },
        previousVersions: phase10Runtime.listPreviousActionConfigurations(session.user.tenantId).map((entry) => ({
          version: entry.version,
          updatedAt: entry.updatedAt
        }))
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/action-configs/preview", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "actionConfiguration",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "action.config.write", {
        entityType: "actionConfiguration",
        tenantId: session.user.tenantId
      });
      const body = actionConfigurationPreviewSchema.parse(await parseJson(context));
      const preview = phase10Runtime.previewActionConfiguration({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        expectedVersion: body.expectedVersion,
        actionDefinitions: phase8Runtime.listActionDefinitions(session.user.tenantId, "portfolio-control"),
        draft: {
          actionConfigs: body.actionConfigs,
          affectedRuntimeSurfaces: body.affectedRuntimeSurfaces
        }
      });

      return context.json({ preview });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tenant/action-configs/publish", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "actionConfiguration",
        tenantId: session.user.tenantId
      });
      assertAllowed(runtime, session, "action.config.write", {
        entityType: "actionConfiguration",
        tenantId: session.user.tenantId
      });
      const body = actionConfigurationPublishSchema.parse(await parseJson(context));
      const storedPreview = phase10Runtime.getActionConfigurationPreview(session.user.tenantId, body.previewId);
      if (storedPreview === undefined) {
        throw Object.assign(new Error("action configuration preview is missing or stale"), {
          code: "stale_preview" as const
        });
      }
      const auditEventId = `audit-action-config-${session.user.tenantId}-${storedPreview.after.version}`;
      const result = phase10Runtime.publishActionConfiguration({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        previewId: body.previewId,
        auditEventId
      });
      runtime.appendAuditEvent({
        session,
        id: result.audit.auditEventId,
        actionKey: result.audit.commandType,
        target: { entityType: "actionConfiguration", entityId: session.user.tenantId },
        correlationId: result.actionExecution.correlationId,
        details: {
          before: { version: result.audit.beforeVersion },
          after: { version: result.audit.afterVersion, disabledActionKeys: result.audit.disabledActionKeys }
        }
      });

      const configuration = phase10Runtime.getActionConfiguration(session.user.tenantId);
      const actions = phase8Runtime.listActionDefinitions(session.user.tenantId, "portfolio-control").map((definition) => {
        const enabled = phase10Runtime.isActionEnabled(session.user.tenantId, definition.key);
        return {
          id: definition.id,
          key: definition.key,
          label: definition.label,
          description: definition.description,
          version: definition.version,
          targetEntityType: definition.targetEntityType,
          commandType: definition.commandBinding.commandType,
          requiredPermission: definition.requiredPermission,
          dryRunRequired: definition.dryRunRequired,
          enabled,
          ...(enabled ? {} : { disabledReason: "configuration_disabled" }),
          inputSchema: definition.inputSchema,
          formFields: phase10Runtime.getActionFormFields(session.user.tenantId, definition.key)
        };
      });

      return context.json({
        result: {
          configuration: result.configuration,
          audit: actionConfigurationPublishAuditDto(result.audit),
          actionExecution: actionExecutionDto(result.actionExecution)
        },
        readback: {
          configuration,
          actions,
          runtime: {
            affectedRuntimeSurfaces: ["portfolio.control"],
            disabledActionKeys: configuration.actionConfigs.filter((entry) => !entry.enabled).map((entry) => entry.actionKey)
          }
        }
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/tenant/configuration/audit", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "audit.read", {
        entityType: "auditEvent",
        tenantId: session.user.tenantId
      });

      return context.json({
        events: runtime.auditStore.listByTenant(session.user.tenantId).map(auditEventDto),
        actionExecutions: [
          ...phase10Runtime.listLabelActionExecutions(session.user.tenantId),
          ...phase10Runtime.listProcessTemplateActionExecutions(session.user.tenantId),
          ...phase10Runtime.listCustomFieldActionExecutions(session.user.tenantId),
          ...phase10Runtime.listCustomFieldValueActionExecutions(session.user.tenantId),
          ...phase10Runtime.listKpiThresholdActionExecutions(session.user.tenantId),
          ...phase10Runtime.listLayoutActionExecutions(session.user.tenantId),
          ...phase10Runtime.listActionConfigurationActionExecutions(session.user.tenantId),
          ...phase10Runtime.listConfigurationImportActionExecutions(session.user.tenantId)
        ].map(actionExecutionDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/admin/access-profiles", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "access_profile.read", {
        entityType: "accessProfile",
        tenantId: session.user.tenantId
      });

      return context.json({
        profiles: runtime.listProfiles(session.user.tenantId).map(accessProfileDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/admin/access-profiles", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "access_profile.write", {
        entityType: "accessProfile",
        tenantId: session.user.tenantId
      });

      const body = upsertAccessProfileSchema.parse(await parseJson(context));
      const profileId = body.id ?? `profile-${body.systemKey}-${session.user.tenantId}`;
      const existingProfile = runtime.getProfile(session.user.tenantId, profileId);

      if (existingProfile && body.version !== existingProfile.version) {
        return context.json(errorDto("conflict", "Версия профиля доступа устарела"), 409);
      }

      const permissionCatalog = runtime.permissionCatalog.filter((permission) => body.permissions.includes(permission.key));
      if (permissionCatalog.length !== body.permissions.length) {
        return context.json(errorDto("validation_error", "Запрошено неизвестное разрешение"), 400);
      }

      const profile = runtime.saveProfile({
        id: profileId,
        tenantId: session.user.tenantId,
        systemKey: body.systemKey,
        label: body.label,
        permissions: body.permissions,
        scopeRules: body.scopeRules.map((rule) => ({
          permissionKey: rule.permissionKey,
          scope: rule.scope,
          ...(rule.constraints !== undefined ? { constraints: rule.constraints } : {})
        })),
        active: body.active,
        version: existingProfile ? existingProfile.version + 1 : 1,
        updatedAt: runtime.now()
      });

      runtime.appendAuditEvent({
        session,
        actionKey: "access_profile.upsert",
        target: { entityType: "accessProfile", entityId: profile.id },
        details: {
          before: existingProfile ? accessProfileDto(existingProfile) : undefined,
          after: accessProfileDto(profile)
        }
      });

      return context.json(accessProfileDto(profile), existingProfile ? 200 : 201);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/admin/labels", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant_labels.write", {
        entityType: "tenantLabelSet",
        tenantId: session.user.tenantId
      });

      const body = updateTenantLabelSchema.parse(await parseJson(context));
      if (!Object.hasOwn(session.labelSet.labels, body.key)) {
        return context.json(errorDto("validation_error", "Метка не настроена для тенанта"), 400);
      }

      const result = runtime.updateLabelSet(session.user.tenantId, body);
      runtime.appendAuditEvent({
        session,
        actionKey: "tenant_label.update",
        target: { entityType: "tenantLabel", entityId: result.trace.changedLabel.key },
        details: {
          before: { label: result.trace.changedLabel.beforeLabel },
          after: { label: result.trace.changedLabel.afterLabel },
          previousConfigurationVersion: result.trace.previousConfigurationVersion,
          newConfigurationVersion: result.trace.configurationVersion,
          changedLabel: result.trace.changedLabel
        }
      });

      return context.json({
        tenantId: result.trace.tenantId,
        configurationVersion: result.trace.configurationVersion,
        previousConfigurationVersion: result.trace.previousConfigurationVersion,
        changedLabel: result.trace.changedLabel,
        labels: result.trace.labels
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/admin/permissions/evaluate", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "permission.diagnostics.read", {
        entityType: "permissionDiagnostics",
        tenantId: session.user.tenantId
      });

      const body = permissionDiagnosticsSchema.parse(await parseJson(context));
      const resolvedTargetTenantId = resolveDiagnosticsTargetTenantId(runtime, session, body);
      if (resolvedTargetTenantId === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      const evaluation = runtime.evaluatePolicy({
        session,
        permissionKey: body.permissionKey,
        target: {
          entityType: body.targetEntityType,
          tenantId: resolvedTargetTenantId
        },
        ...(body.requestedScope !== undefined ? { requestedScope: body.requestedScope } : {})
      });

      return context.json({
        allowed: evaluation.allowed,
        reasonCode: evaluation.reasonCode,
        ...(evaluation.scope !== undefined ? { scope: evaluation.scope } : {}),
        trace: evaluation.trace
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/tenant-isolation-probes/:probeId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const probeId = context.req.param("probeId");
      const probe = runtime.getProbe(probeId);
      if (!probe || probe.tenantId !== session.user.tenantId) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      assertAllowed(runtime, session, "tenant_probe.read", {
        entityType: "tenantIsolationProbe",
        tenantId: probe.tenantId,
        entityId: probe.id
      });

      return context.json({
        id: probe.id,
        tenantId: probe.tenantId,
        label: probe.label
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/audit/events", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "audit.read", {
        entityType: "auditEvent",
        tenantId: session.user.tenantId
      });

      return context.json({
        events: runtime.auditStore.listByTenant(session.user.tenantId).map(auditEventDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/audit", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "audit.read", {
        entityType: "auditEvent",
        tenantId: session.user.tenantId
      });
      const targetType = context.req.query("targetType");
      const targetId = context.req.query("targetId");
      const events = runtime.auditStore
        .listByTenant(session.user.tenantId)
        .filter((event) => targetType === undefined || event.target.entityType === targetType)
        .filter((event) => targetId === undefined || event.target.entityId === targetId)
        .map(auditEventDto);

      return context.json({ events });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/projects/from-template", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "project.create_from_template", {
        entityType: "project",
        tenantId: session.user.tenantId
      });

      const body = projectFromTemplateSchema.parse(await parseJson(context));
      const projectDraft = phase3Runtime.getProjectDraft(session.user.tenantId, body.projectDraftId);
      if (projectDraft === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      const project = phase4Runtime.createManagedProjectFromTemplate({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        projectDraft,
        ...(body.projectId !== undefined ? { projectId: body.projectId } : {})
      });
      runtime.appendAuditEvent({
        session,
        actionKey: "project.create_from_template",
        target: { entityType: "project", entityId: project.id },
        correlationId: project.correlationId,
        details: {
          before: { state: "not_created" },
          after: projectDto(project)
        }
      });

      return context.json({ project: projectDto(project) }, 201);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/projects/:projectId/schedule", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "project.read", {
        entityType: "project",
        tenantId: session.user.tenantId,
        entityId: projectId
      });

      const snapshot = phase5Runtime.getSchedule(project);

      return context.json(scheduleSnapshotDto(snapshot));
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/projects/:projectId/schedule/tasks", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "task.write", {
        entityType: "task",
        tenantId: session.user.tenantId,
        entityId: projectId
      });
      const body = scheduleTaskCreateSchema.parse(await parseJson(context));
      const taskId = body.id ?? `${projectId}:schedule-task:${project.tasks.length + 1}`;
      const scheduleFields = phase5Runtime.prepareTaskScheduleFields(project, taskId, {
        plannedStartDate: body.plannedStartDate,
        plannedFinishDate: body.plannedFinishDate,
        plannedWorkHours: body.plannedWorkHours,
        progressPercent: body.progressPercent
      });
      const participants: Phase4CreateTaskParticipantInput[] | undefined =
        body.participants === undefined
          ? undefined
          : body.participants.map((participant) => ({
              ...(participant.id !== undefined ? { id: participant.id } : {}),
              userId: participant.userId,
              role: participant.role
            }));
      assertTenantUsersExist(runtime, session, participants);
      const result = phase4Runtime.createTask({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        projectId,
        id: taskId,
        stageId: body.stageId,
        taskTemplateId: body.taskTemplateId,
        taskTemplateKey: body.taskTemplateKey,
        ...(body.status !== undefined ? { status: body.status } : {}),
        dueDate: scheduleFields.plannedFinishDate,
        plannedWorkHours: scheduleFields.plannedWorkHours,
        ...(participants !== undefined ? { participants } : {})
      });
      const snapshot = phase5Runtime.setTaskScheduleFields(result.project, result.task.id, scheduleFields);
      const actionExecution = phase5Runtime.recordActionExecution({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        projectId,
        commandType: "schedule.task.create",
        requiredPermission: "task.write",
        source: { entityType: "project", entityId: projectId },
        target: { entityType: "task", entityId: result.task.id },
        before: null,
        after: { task: taskDto(result.task), scheduleFields },
        trace: ["schedule:permission task.write allowed", "schedule:canonical task created"]
      });
      runtime.appendAuditEvent({
        session,
        actionKey: actionExecution.commandType,
        target: { entityType: "task", entityId: result.task.id },
        correlationId: actionExecution.correlationId,
        details: {
          before: undefined,
          after: { task: taskDto(result.task), scheduleFields, actionExecution: actionExecutionDto(actionExecution) }
        }
      });

      return context.json(
        {
          task: taskDto(result.task),
          participants: result.participants.map(taskParticipantDto),
          ...scheduleSnapshotDto(snapshot),
          actionExecution: actionExecutionDto(actionExecution)
        },
        201
      );
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.patch("/api/projects/:projectId/schedule/tasks/:taskId", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const taskId = context.req.param("taskId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined || !project.tasks.some((task) => task.id === taskId)) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "task.write", {
        entityType: "task",
        tenantId: session.user.tenantId,
        entityId: projectId
      });
      const body = scheduleTaskUpdateSchema.parse(await parseJson(context));
      const beforeFields = phase5Runtime.readTaskScheduleFields(project, taskId);
      const scheduleFields = phase5Runtime.prepareTaskSchedulePatch(project, taskId, body);
      const result = phase4Runtime.updateTaskPlanningFields({
        tenantId: session.user.tenantId,
        projectId,
        taskId,
        dueDate: scheduleFields.plannedFinishDate,
        plannedWorkHours: scheduleFields.plannedWorkHours,
        actorId: session.user.id
      });
      const snapshot = phase5Runtime.setTaskScheduleFields(result.project, taskId, scheduleFields);
      const actionExecution = phase5Runtime.recordActionExecution({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        projectId,
        commandType: "schedule.task.update",
        requiredPermission: "task.write",
        source: { entityType: "project", entityId: projectId },
        target: { entityType: "task", entityId: taskId },
        before: { task: taskDto(project.tasks.find((task) => task.id === taskId) as Task), scheduleFields: beforeFields ?? null },
        after: { task: taskDto(result.task), scheduleFields },
        trace: ["schedule:permission task.write allowed", "schedule:task schedule fields updated"]
      });
      runtime.appendAuditEvent({
        session,
        actionKey: actionExecution.commandType,
        target: { entityType: "task", entityId: taskId },
        correlationId: actionExecution.correlationId,
        details: {
          before: { scheduleFields: beforeFields ?? null },
          after: { task: taskDto(result.task), scheduleFields, actionExecution: actionExecutionDto(actionExecution) }
        }
      });

      return context.json({
        task: taskDto(result.task),
        ...scheduleSnapshotDto(snapshot),
        actionExecution: actionExecutionDto(actionExecution)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/projects/:projectId/schedule/dependencies", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "task.write", {
        entityType: "task",
        tenantId: session.user.tenantId,
        entityId: projectId
      });
      const body = scheduleDependencyCreateSchema.parse(await parseJson(context));
      try {
        const result = phase5Runtime.createDependency(project, {
          id: body.id ?? `dependency-${body.predecessorTaskId}-${body.successorTaskId}`,
          predecessorTaskId: body.predecessorTaskId,
          successorTaskId: body.successorTaskId,
          type: body.type as DependencyType
        });
        const actionExecution = phase5Runtime.recordActionExecution({
          tenantId: session.user.tenantId,
          actorId: session.user.id,
          ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
          projectId,
          commandType: "schedule.dependency.create",
          requiredPermission: "task.write",
          source: { entityType: "project", entityId: projectId },
          target: { entityType: "scheduleDependency", entityId: result.dependency.id },
          before: null,
          after: { dependency: result.dependency },
          trace: ["schedule:permission task.write allowed", "schedule:finish-to-start dependency stored"]
        });
        runtime.appendAuditEvent({
          session,
          actionKey: actionExecution.commandType,
          target: { entityType: "scheduleDependency", entityId: result.dependency.id },
          correlationId: actionExecution.correlationId,
          details: {
            before: undefined,
            after: { dependency: result.dependency, actionExecution: actionExecutionDto(actionExecution) }
          }
        });

        return context.json(
          {
            dependency: result.dependency,
            ...scheduleSnapshotDto(result.snapshot),
            actionExecution: actionExecutionDto(actionExecution)
          },
          201
        );
      } catch (error) {
        if (isSchedulePreconditionError(error)) {
          return context.json(
            {
              ...errorDto("precondition_failed", "Команда расписания заблокирована"),
              validationIssues: error.validationIssues.map(scheduleValidationIssueDto)
            },
            409
          );
        }
        throw error;
      }
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/projects/:projectId/schedule/baseline", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "task.write", {
        entityType: "task",
        tenantId: session.user.tenantId,
        entityId: projectId
      });
      const body = scheduleBaselineCaptureSchema.parse(await parseJson(context));
      const snapshot = phase5Runtime.captureBaseline(project, {
        id: body.id ?? `baseline-${projectId}-draft`,
        actorId: session.user.id
      });
      if (snapshot.baseline === undefined) {
        throw Object.assign(new Error("baseline capture failed"), { code: "validation_error" });
      }
      const actionExecution = phase5Runtime.recordActionExecution({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        projectId,
        commandType: "schedule.baseline.capture",
        requiredPermission: "task.write",
        source: { entityType: "project", entityId: projectId },
        target: { entityType: "scheduleBaseline", entityId: snapshot.baseline.id },
        before: null,
        after: { baseline: scheduleBaselineDto(snapshot.baseline) },
        trace: ["schedule:permission task.write allowed", "schedule:draft baseline captured"]
      });
      runtime.appendAuditEvent({
        session,
        actionKey: actionExecution.commandType,
        target: { entityType: "scheduleBaseline", entityId: snapshot.baseline.id },
        correlationId: actionExecution.correlationId,
        details: {
          before: undefined,
          after: { baseline: scheduleBaselineDto(snapshot.baseline), actionExecution: actionExecutionDto(actionExecution) }
        }
      });

      return context.json(
        {
          ...scheduleSnapshotDto(snapshot),
          baseline: scheduleBaselineDto(snapshot.baseline),
          actionExecution: actionExecutionDto(actionExecution)
        },
        201
      );
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/projects/:projectId/schedule/audit", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "audit.read", {
        entityType: "auditEvent",
        tenantId: session.user.tenantId,
        entityId: projectId
      });
      const actionExecutions = phase5Runtime.listActionExecutions(session.user.tenantId, projectId);
      const actionCorrelationIds = new Set(actionExecutions.map((actionExecution) => actionExecution.correlationId));
      const events = runtime.auditStore
        .listByTenant(session.user.tenantId)
        .filter((event) => actionCorrelationIds.has(event.correlationId))
        .map(auditEventDto);

      return context.json({
        events,
        actionExecutions: actionExecutions.map(actionExecutionDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/projects/:projectId/closure", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "project.closure.read", {
        entityType: "project",
        tenantId: session.user.tenantId,
        entityId: projectId
      });
      const closure = phase9Runtime.readClosure(project);

      return context.json({
        project: projectDto(project),
        checklist: closure.checklist,
        readiness: closure.readiness,
        snapshots: closure.snapshots,
        latestSnapshot: closure.latestSnapshot
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/projects/:projectId/closure/preview", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "project.close", {
        entityType: "project",
        tenantId: session.user.tenantId,
        entityId: projectId
      });
      const body = closurePreviewSchema.parse(await parseJson(context));
      const preview = phase9Runtime.previewClosure({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        project,
        closureData: body.closureData as Phase9ClosureDataInput,
        ...(body.blockerOverrides !== undefined
          ? { blockerOverrides: body.blockerOverrides as ProjectClosureBlockerOverride[] }
          : {})
      });

      return context.json({ preview });
    } catch (error) {
      if (hasBlockerError(error)) {
        const code = error.code === "stale_preview" ? "stale_preview" : "precondition_failed";
        return context.json(
          {
            ...errorDto(code, code === "stale_preview" ? "Предпросмотр устарел" : "Условия закрытия проекта не выполнены"),
            blockers: error.blockers.map(stageGateLikeBlockerDto)
          },
          409
        );
      }

      return handleRouteError(context, error);
    }
  });

  app.post("/api/projects/:projectId/closure/apply", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "project.close", {
        entityType: "project",
        tenantId: session.user.tenantId,
        entityId: projectId
      });
      const body = closureApplySchema.parse(await parseJson(context));
      phase9Runtime.validateApplyClosure({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        project,
        previewId: body.previewId
      });
      const auditEvent = runtime.appendAuditEvent({
        session,
        actionKey: "project.closure.apply",
        target: { entityType: "project", entityId: projectId },
        correlationId: `closure-${projectId}-audit`,
        details: { before: projectDto(project) }
      });
      const result = phase9Runtime.applyClosure({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        project,
        previewId: body.previewId,
        phase4Runtime,
        auditEventId: auditEvent.id
      });
      const readbackProject = phase4Runtime.getProject(session.user.tenantId, projectId);

      return context.json({
        result: {
          snapshotId: result.snapshot.id,
          closureDecision: result.closureDecision,
          actionExecution: actionExecutionDto(result.actionExecution)
        },
        readback: {
          project: readbackProject === undefined ? null : projectDto(readbackProject),
          snapshot: result.snapshot
        }
      });
    } catch (error) {
      if (hasBlockerError(error)) {
        const code = error.code === "stale_preview" ? "stale_preview" : "precondition_failed";
        return context.json(
          {
            ...errorDto(code, code === "stale_preview" ? "Предпросмотр устарел" : "Условия закрытия проекта не выполнены"),
            blockers: error.blockers.map(stageGateLikeBlockerDto)
          },
          409
        );
      }

      return handleRouteError(context, error);
    }
  });

  app.get("/api/retrospectives/snapshots", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "retrospective.read", {
        entityType: "closedProjectSnapshot",
        tenantId: session.user.tenantId
      });

      return context.json({ snapshots: phase9Runtime.listSnapshots(session.user.tenantId) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/retrospectives/snapshots/:snapshotId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const snapshotId = context.req.param("snapshotId");
      assertAllowed(runtime, session, "retrospective.read", {
        entityType: "closedProjectSnapshot",
        tenantId: session.user.tenantId,
        entityId: snapshotId
      });
      const snapshot = phase9Runtime.getSnapshot(session.user.tenantId, snapshotId);
      if (snapshot === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({ snapshot });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.all("/api/retrospectives/snapshots/:snapshotId", (context) =>
    context.json(errorDto("precondition_failed", "Закрытые снимки неизменяемы"), 405)
  );

  app.get("/api/retrospectives/closed-portfolio", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const query = retrospectivePaginationQuerySchema.parse({
        offset: context.req.query("offset"),
        limit: context.req.query("limit"),
        templateId: context.req.query("templateId"),
        clientId: context.req.query("clientId"),
        period: context.req.query("period")
      });
      assertAllowed(runtime, session, "retrospective.read", {
        entityType: "closedProjectSnapshot",
        tenantId: session.user.tenantId
      });
      const readModel = phase9Runtime.buildClosedPortfolioReadModel(session.user.tenantId, {
        actorPermissionKeys: session.profile.permissions,
        offset: query.offset,
        limit: query.limit,
        filters: {
          ...(query.templateId !== undefined ? { templateId: query.templateId } : {}),
          ...(query.clientId !== undefined ? { clientId: query.clientId } : {}),
          ...(query.period !== undefined ? { period: query.period } : {})
        }
      });

      return context.json(readModel);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/retrospectives/trends", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const query = retrospectiveTrendsQuerySchema.parse({
        offset: context.req.query("offset"),
        limit: context.req.query("limit"),
        groupBy: context.req.query("groupBy"),
        templateId: context.req.query("templateId"),
        clientId: context.req.query("clientId"),
        period: context.req.query("period")
      });
      assertAllowed(runtime, session, "retrospective.read", {
        entityType: "retrospectiveTrend",
        tenantId: session.user.tenantId
      });
      const readModel = phase9Runtime.listTrendReadModels(session.user.tenantId, {
        groupBy: query.groupBy,
        offset: query.offset,
        limit: query.limit,
        filters: {
          ...(query.templateId !== undefined ? { templateId: query.templateId } : {}),
          ...(query.clientId !== undefined ? { clientId: query.clientId } : {}),
          ...(query.period !== undefined ? { period: query.period } : {})
        }
      });

      return context.json(readModel);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/retrospectives/insights/:insightId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const insightId = context.req.param("insightId");
      assertAllowed(runtime, session, "retrospective.read", {
        entityType: "retrospectiveInsight",
        tenantId: session.user.tenantId,
        entityId: insightId
      });
      const readModel = phase9Runtime.getInsightReadModel(session.user.tenantId, insightId, session.profile.permissions);
      if (readModel === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json(readModel);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/retrospectives/insights/:insightId/template-improvement/preview", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const insightId = context.req.param("insightId");
      const readModel = phase9Runtime.getInsightReadModel(session.user.tenantId, insightId, session.profile.permissions);
      if (readModel === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "retrospective.improvement.write", {
        entityType: "retrospectiveInsight",
        tenantId: session.user.tenantId,
        entityId: insightId
      });
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "tenantConfiguration",
        tenantId: session.user.tenantId
      });
      const body = templateImprovementPreviewSchema.parse(await parseJson(context));
      const preview = phase9Runtime.previewTemplateImprovement({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        insightId,
        improvementKey: body.improvementKey,
        reason: body.reason
      });

      return context.json({ preview });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/retrospectives/insights/:insightId/template-improvement/apply", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const insightId = context.req.param("insightId");
      const readModel = phase9Runtime.getInsightReadModel(session.user.tenantId, insightId, session.profile.permissions);
      if (readModel === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "retrospective.improvement.write", {
        entityType: "retrospectiveInsight",
        tenantId: session.user.tenantId,
        entityId: insightId
      });
      assertAllowed(runtime, session, "tenant.config.write", {
        entityType: "tenantConfiguration",
        tenantId: session.user.tenantId
      });
      const body = templateImprovementApplySchema.parse(await parseJson(context));
      phase9Runtime.validateApplyTemplateImprovement({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        insightId,
        previewId: body.previewId
      });
      const auditEvent = runtime.appendAuditEvent({
        session,
        actionKey: "template_improvement.apply",
        target: { entityType: "retrospectiveInsight", entityId: insightId },
        correlationId: `template-improvement-${insightId}-audit`,
        details: {
          before: { insightId, sourceTrendId: readModel.insight.sourceTrendId },
          after: { previewId: body.previewId }
        }
      });
      const result = phase9Runtime.applyTemplateImprovement({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        insightId,
        previewId: body.previewId,
        auditEventId: auditEvent.id
      });

      return context.json({
        result: {
          preview: result.preview,
          insight: result.insight,
          template: {
            ...result.template,
            previousVersion: result.previousTemplateVersion
          },
          actionExecution: result.actionExecution
        }
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/retrospectives/audit", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "audit.read", {
        entityType: "auditEvent",
        tenantId: session.user.tenantId
      });
      const actionExecutions = phase9Runtime.listActionExecutions(session.user.tenantId);
      const actionCorrelationIds = new Set(actionExecutions.map((entry) => entry.correlationId));
      const events = runtime.auditStore
        .listByTenant(session.user.tenantId)
        .filter(
          (event) =>
            actionCorrelationIds.has(event.correlationId) ||
            event.actionKey.startsWith("project.closure") ||
            event.actionKey.startsWith("template_improvement")
        )
        .map(auditEventDto);

      return context.json({
        events,
        actionExecutions: actionExecutions.map(actionExecutionDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/resources/load", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "resource.read", {
        entityType: "resourceLoadBucket",
        tenantId: session.user.tenantId
      });

      return context.json(phase6Runtime.getProjection(session.user.tenantId));
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/resources/load/:bucketId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "resource.read", {
        entityType: "resourceLoadBucket",
        tenantId: session.user.tenantId,
        entityId: context.req.param("bucketId")
      });
      const bucket = phase6Runtime.getLoadBucket(session.user.tenantId, context.req.param("bucketId"));
      if (bucket === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({ bucket });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/resources/overloads/:overloadId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const overloadId = context.req.param("overloadId");
      assertAllowed(runtime, session, "resource.read", {
        entityType: "resourceOverload",
        tenantId: session.user.tenantId,
        entityId: overloadId
      });
      const detail = phase6Runtime.getOverloadDetail(session.user.tenantId, overloadId);
      if (detail === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json(detail);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/resources/reservations", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "resource.write", {
        entityType: "resourceReservation",
        tenantId: session.user.tenantId
      });
      const body = resourceReservationCreateSchema.parse(await parseJson(context));
      const before = phase6Runtime.getProjection(session.user.tenantId);
      const reservation = phase6Runtime.createReservation(session.user.tenantId, body);
      const after = phase6Runtime.getProjection(session.user.tenantId);
      runtime.appendAuditEvent({
        session,
        actionKey: "resource_reservation.create",
        target: { entityType: "resourceReservation", entityId: reservation.id },
        details: {
          before: { loadBuckets: before.loadBuckets },
          after: { reservation, loadBuckets: after.loadBuckets }
        }
      });

      return context.json({ reservation, readback: after }, 201);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/resources/overloads/:overloadId/preview", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const overloadId = context.req.param("overloadId");
      assertAllowed(runtime, session, "resource.write", {
        entityType: "resourceOverload",
        tenantId: session.user.tenantId,
        entityId: overloadId
      });
      const body = resourceResolutionPreviewSchema.parse(await parseJson(context));
      const preview = phase6Runtime.previewResolution(
        session.user.tenantId,
        session.user.id,
        overloadId,
        body as ResourceResolutionCommand
      );

      return context.json({ preview });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/resources/overloads/:overloadId/apply", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const overloadId = context.req.param("overloadId");
      assertAllowed(runtime, session, "resource.write", {
        entityType: "resourceOverload",
        tenantId: session.user.tenantId,
        entityId: overloadId
      });
      const body = resourceResolutionApplySchema.parse(await parseJson(context));
      const result = phase6Runtime.applyResolution({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        overloadId,
        previewId: body.previewId
      });
      const readback = phase6Runtime.getProjection(session.user.tenantId);
      runtime.appendAuditEvent({
        session,
        actionKey: result.actionExecution.commandType,
        target: result.actionExecution.target ?? result.actionExecution.source,
        correlationId: result.actionExecution.correlationId,
        details: {
          before: { loadBuckets: result.beforeLoadBuckets },
          after: {
            loadBuckets: result.afterLoadBuckets,
            overloadStatus: result.overloadStatus,
            actionExecution: actionExecutionDto(result.actionExecution)
          }
        }
      });

      return context.json({
        result: {
          ...result,
          actionExecution: actionExecutionDto(result.actionExecution)
        },
        readback
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/resources/audit", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "audit.read", {
        entityType: "auditEvent",
        tenantId: session.user.tenantId
      });
      const actionExecutions = [
        ...phase6Runtime.listActionExecutions(session.user.tenantId),
        ...phase8Runtime
          .listActionExecutions(session.user.tenantId)
          .filter((actionExecution) => actionExecution.commandType.startsWith("resource_resolution."))
      ];
      const actionCorrelationIds = new Set(actionExecutions.map((actionExecution) => actionExecution.correlationId));
      const events = runtime.auditStore
        .listByTenant(session.user.tenantId)
        .filter(
          (event) => actionCorrelationIds.has(event.correlationId) || event.actionKey.startsWith("resource_reservation.")
        )
        .map(auditEventDto);

      return context.json({
        events,
        actionExecutions: actionExecutions.map(actionExecutionDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/kpi/definitions", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "kpi:read", {
        entityType: "kpiDefinition",
        tenantId: session.user.tenantId
      });

      return context.json({
        definitions: phase7Runtime.listDefinitions(session.user.tenantId).map(kpiDefinitionListDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/kpi/definitions/preview", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "kpi.config:write", {
        entityType: "kpiDefinition",
        tenantId: session.user.tenantId
      });
      const body = kpiDefinitionPreviewSchema.parse(await parseJson(context)) as KpiDefinitionPreviewInput;
      const preview = phase7Runtime.previewDefinition(session.user.tenantId, body);

      return context.json({ preview });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/kpi/definitions", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "kpi.config:write", {
        entityType: "kpiDefinition",
        tenantId: session.user.tenantId
      });
      const body = kpiDefinitionConfigSchema.parse(await parseJson(context)) as KpiDefinitionConfigInput;
      const result = phase7Runtime.createDefinition({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        config: body
      });
      runtime.appendAuditEvent({
        session,
        actionKey: result.actionExecution.commandType,
        target: result.actionExecution.target ?? result.actionExecution.source,
        correlationId: result.actionExecution.correlationId,
        details: {
          before: result.actionExecution.before ?? undefined,
          after: result.actionExecution.after ?? undefined
        }
      });

      return context.json(
        {
          definition: result.definition.definition,
          formula: result.definition.formula,
          thresholdRuleSet: result.definition.thresholdRuleSet,
          result: { actionExecution: actionExecutionDto(result.actionExecution) },
          readback: { definitions: phase7Runtime.listDefinitions(session.user.tenantId).map(kpiDefinitionListDto) }
        },
        201
      );
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/kpi/definitions/:definitionId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const definitionId = context.req.param("definitionId");
      assertAllowed(runtime, session, "kpi:read", {
        entityType: "kpiDefinition",
        tenantId: session.user.tenantId,
        entityId: definitionId
      });
      const bundle = phase7Runtime.getBundle(session.user.tenantId, definitionId);
      if (bundle === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json(bundle);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/kpi/definitions/:definitionId/publish", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const definitionId = context.req.param("definitionId");
      assertAllowed(runtime, session, "kpi.config:write", {
        entityType: "kpiDefinition",
        tenantId: session.user.tenantId,
        entityId: definitionId
      });
      const body = kpiDefinitionVersionCommandSchema.parse(await parseJson(context));
      const result = phase7Runtime.publishDefinition({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        definitionId,
        expectedVersion: body.expectedVersion,
        ...(body.reason !== undefined ? { reason: body.reason } : {})
      });
      runtime.appendAuditEvent({
        session,
        actionKey: result.actionExecution.commandType,
        target: result.actionExecution.target ?? result.actionExecution.source,
        correlationId: result.actionExecution.correlationId,
        details: {
          before: result.actionExecution.before ?? undefined,
          after: result.actionExecution.after ?? undefined
        }
      });

      return context.json({
        result: { actionExecution: actionExecutionDto(result.actionExecution) },
        readback: result.definition
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/kpi/definitions/:definitionId/retire", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const definitionId = context.req.param("definitionId");
      assertAllowed(runtime, session, "kpi.config:write", {
        entityType: "kpiDefinition",
        tenantId: session.user.tenantId,
        entityId: definitionId
      });
      const body = kpiDefinitionVersionCommandSchema.parse(await parseJson(context));
      const result = phase7Runtime.retireDefinition({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        definitionId,
        expectedVersion: body.expectedVersion,
        ...(body.reason !== undefined ? { reason: body.reason } : {})
      });
      runtime.appendAuditEvent({
        session,
        actionKey: result.actionExecution.commandType,
        target: result.actionExecution.target ?? result.actionExecution.source,
        correlationId: result.actionExecution.correlationId,
        details: {
          before: result.actionExecution.before ?? undefined,
          after: result.actionExecution.after ?? undefined
        }
      });

      return context.json({
        result: { actionExecution: actionExecutionDto(result.actionExecution) },
        readback: result.definition
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/kpi/evaluations/run", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "kpi.evaluate:execute", {
        entityType: "kpiEvaluation",
        tenantId: session.user.tenantId
      });
      const body = kpiEvaluationRunSchema.parse(await parseJson(context)) as KpiEvaluationRunInput;
      const result = phase7Runtime.runEvaluation({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {}),
        command: body
      });
      runtime.appendAuditEvent({
        session,
        actionKey: result.actionExecution.commandType,
        target: result.actionExecution.target ?? result.actionExecution.source,
        correlationId: result.actionExecution.correlationId,
        details: {
          before: result.actionExecution.before ?? undefined,
          after: result.actionExecution.after ?? undefined
        }
      });

      return context.json({
        evaluation: result.evaluation,
        signal: result.signal,
        actionExecution: actionExecutionDto(result.actionExecution)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/kpi/evaluations/:evaluationId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const evaluationId = context.req.param("evaluationId");
      assertAllowed(runtime, session, "kpi:read", {
        entityType: "kpiEvaluation",
        tenantId: session.user.tenantId,
        entityId: evaluationId
      });
      const evaluation = phase7Runtime.getEvaluation(session.user.tenantId, evaluationId);
      if (evaluation === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({ evaluation });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/kpi/deviations", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "kpi:read", {
        entityType: "kpiDeviation",
        tenantId: session.user.tenantId
      });

      return context.json({ signals: phase7Runtime.listSignals(session.user.tenantId) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/kpi/deviations/:signalId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const signalId = context.req.param("signalId");
      assertAllowed(runtime, session, "kpi:read", {
        entityType: "kpiDeviation",
        tenantId: session.user.tenantId,
        entityId: signalId
      });
      const detail = phase7Runtime.getSignalDetail(session.user.tenantId, signalId);
      if (detail === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json(detail);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/kpi/audit", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "audit.read", {
        entityType: "auditEvent",
        tenantId: session.user.tenantId
      });
      const actionExecutions = phase7Runtime.listActionExecutions(session.user.tenantId);
      const actionCorrelationIds = new Set(actionExecutions.map((actionExecution) => actionExecution.correlationId));
      const events = runtime.auditStore
        .listByTenant(session.user.tenantId)
        .filter((event) => actionCorrelationIds.has(event.correlationId))
        .map(auditEventDto);

      return context.json({
        events,
        actionExecutions: actionExecutions.map(actionExecutionDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/control/surfaces", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "control.surface:read", {
        entityType: "controlSurface",
        tenantId: session.user.tenantId
      });
      return context.json({
        surfaces: phase8Runtime.listSurfaces(session.user.tenantId).map((surface) => ({
          id: surface.id,
          tenantId: surface.tenantId,
          key: surface.key,
          label: surface.label,
          surfaceType: surface.surfaceType,
          viewType: surface.view.viewType,
          status: surface.status,
          version: surface.version,
          updatedAt: surface.updatedAt
        }))
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/control/surfaces/:surfaceId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "control.surface:read", {
        entityType: "controlSurface",
        tenantId: session.user.tenantId,
        entityId: context.req.param("surfaceId")
      });
      const surface = phase8Runtime.getSurface(session.user.tenantId, context.req.param("surfaceId"));
      if (surface === undefined) {
        throw Object.assign(new Error("control surface not found"), { code: "not_found" });
      }

      return context.json({ surface });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/control/surfaces/:surfaceId/view", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "control.surface:read", {
        entityType: "controlSurface",
        tenantId: session.user.tenantId,
        entityId: context.req.param("surfaceId")
      });
      const model = phase8Runtime.buildReadModel({
        tenantId: session.user.tenantId,
        surfaceId: context.req.param("surfaceId"),
        actorPermissionKeys: session.profile.permissions,
        phase6Runtime,
        phase7Runtime,
        layoutDefinition: phase10Runtime.getPublishedControlSurfaceLayout(
          session.user.tenantId,
          context.req.param("surfaceId")
        ),
        customFields: phase10Runtime.getCustomFieldRegistry(session.user.tenantId).definitions,
        projects: phase4Runtime.listProjects(session.user.tenantId),
        page: {
          offset: Number(context.req.query("offset") ?? 0),
          limit: Number(context.req.query("limit") ?? 50)
        },
        isActionAllowed: (record, slot) =>
          runtime.evaluatePolicy({
            session,
            permissionKey: slot.requiredPermission,
            target: {
              entityType: slot.targetEntityType,
              tenantId: record.tenantId,
              entityId: record.entityId,
              ...(record.policyContext?.ownerId !== undefined ? { ownerId: record.policyContext.ownerId } : {}),
              ...(record.policyContext?.projectId !== undefined ? { projectId: record.policyContext.projectId } : {})
            },
            contextRefs: { projectIds: [record.policyContext?.projectId].filter((id): id is string => id !== undefined) }
          }).allowed,
        isActionConfigured: (_record, slot) => phase10Runtime.isActionEnabled(session.user.tenantId, slot.actionDefinitionKey),
        isDrilldownAllowed: (record, drilldown) =>
          runtime.evaluatePolicy({
            session,
            permissionKey: drilldown.requiredPermission,
            target: {
              entityType: drilldown.targetEntityType,
              tenantId: record.tenantId,
              entityId: record.drilldownParams.projectId ?? record.entityId,
              ...(record.policyContext?.ownerId !== undefined ? { ownerId: record.policyContext.ownerId } : {}),
              ...(record.policyContext?.projectId !== undefined ? { projectId: record.policyContext.projectId } : {})
            },
            contextRefs: { projectIds: [record.policyContext?.projectId].filter((id): id is string => id !== undefined) }
          }).allowed
      });

      return context.json(model);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/control/surfaces/:surfaceId/actions", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "control.surface:read", {
        entityType: "controlSurface",
        tenantId: session.user.tenantId,
        entityId: context.req.param("surfaceId")
      });
      return context.json({
        actions: phase8Runtime.listActionDefinitions(session.user.tenantId, context.req.param("surfaceId")).map((definition) => {
          const enabled = phase10Runtime.isActionEnabled(session.user.tenantId, definition.key);
          return ({
          id: definition.id,
          key: definition.key,
          label: definition.label,
          description: definition.description,
          version: definition.version,
          targetEntityType: definition.targetEntityType,
          commandType: definition.commandBinding.commandType,
          requiredPermission: definition.requiredPermission,
          dryRunRequired: definition.dryRunRequired,
          enabled,
          ...(enabled ? {} : { disabledReason: "configuration_disabled" }),
          inputSchema: definition.inputSchema,
          formFields: phase10Runtime.getActionFormFields(session.user.tenantId, definition.key)
        });
        })
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/control/actions/:actionDefinitionId/preview", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const actionDefinition = phase8Runtime.getActionDefinition(session.user.tenantId, context.req.param("actionDefinitionId"));
      if (!phase10Runtime.isActionEnabled(session.user.tenantId, actionDefinition.key)) {
        throw Object.assign(new Error("action disabled by tenant configuration"), { code: "permission_denied", status: 403 });
      }
      const body = controlActionPreviewSchema.parse(await parseJson(context));
      const policyContext = phase8Runtime.getActionTargetPolicyContext({
        tenantId: session.user.tenantId,
        target: body.target,
        phase6Runtime,
        phase7Runtime
      });
      assertAllowed(runtime, session, actionDefinition.requiredPermission, {
        entityType: policyContext.entityType,
        tenantId: policyContext.tenantId,
        entityId: policyContext.entityId,
        ...(policyContext.ownerId !== undefined ? { ownerId: policyContext.ownerId } : {}),
        ...(policyContext.projectId !== undefined ? { projectId: policyContext.projectId } : {})
      }, undefined, policyContext.contextRefs);
      const preview = phase8Runtime.previewAction({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actionDefinitionId: actionDefinition.id,
        target: body.target,
        commandInput: body.input ?? {},
        phase6Runtime,
        phase7Runtime
      });

      return context.json({ preview });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/control/actions/:actionDefinitionId/execute", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const actionDefinition = phase8Runtime.getActionDefinition(session.user.tenantId, context.req.param("actionDefinitionId"));
      if (!phase10Runtime.isActionEnabled(session.user.tenantId, actionDefinition.key)) {
        throw Object.assign(new Error("action disabled by tenant configuration"), { code: "permission_denied", status: 403 });
      }
      const body = controlActionExecuteSchema.parse(await parseJson(context));
      const previewForPolicy =
        body.previewId !== undefined ? phase8Runtime.getActionPreview(session.user.tenantId, body.previewId) : undefined;
      const targetForPolicy = previewForPolicy?.target ?? body.target;
      const targetPolicyContext =
        targetForPolicy !== undefined
          ? phase8Runtime.getActionTargetPolicyContext({
              tenantId: session.user.tenantId,
              target: targetForPolicy,
              phase6Runtime,
              phase7Runtime
            })
          : undefined;
      const permissionEvaluation =
        targetPolicyContext !== undefined
          ? assertAllowed(runtime, session, actionDefinition.requiredPermission, {
              entityType: targetPolicyContext.entityType,
              tenantId: targetPolicyContext.tenantId,
              entityId: targetPolicyContext.entityId,
              ...(targetPolicyContext.ownerId !== undefined ? { ownerId: targetPolicyContext.ownerId } : {}),
              ...(targetPolicyContext.projectId !== undefined ? { projectId: targetPolicyContext.projectId } : {})
            }, undefined, targetPolicyContext.contextRefs)
          : assertAllowed(runtime, session, actionDefinition.requiredPermission, {
              entityType: actionDefinition.targetEntityType,
              tenantId: session.user.tenantId
            });
      const boundCommandPermissionEvaluation =
        actionDefinition.key === "create_corrective_action" && targetPolicyContext !== undefined
          ? assertAllowed(runtime, session, "task.write", {
              entityType: "task",
              tenantId: targetPolicyContext.tenantId,
              ...(targetPolicyContext.projectId !== undefined ? { projectId: targetPolicyContext.projectId } : {})
            }, undefined, targetPolicyContext.contextRefs)
          : actionDefinition.key === "accept_risk" && targetPolicyContext !== undefined
            ? assertAllowed(runtime, session, "control.action:write", {
                entityType: targetPolicyContext.entityType,
                tenantId: targetPolicyContext.tenantId,
                entityId: targetPolicyContext.entityId,
                ...(targetPolicyContext.ownerId !== undefined ? { ownerId: targetPolicyContext.ownerId } : {}),
                ...(targetPolicyContext.projectId !== undefined ? { projectId: targetPolicyContext.projectId } : {})
              }, undefined, targetPolicyContext.contextRefs)
          : undefined;
      const result = phase8Runtime.executeAction({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        accessProfileId: session.user.accessProfileId,
        actionDefinitionId: actionDefinition.id,
        ...(body.target !== undefined ? { target: body.target } : {}),
        ...(body.input !== undefined ? { commandInput: body.input } : {}),
        ...(body.previewId !== undefined ? { previewId: body.previewId } : {}),
        phase4Runtime,
        phase6Runtime,
        phase7Runtime,
        permissionTrace: [
          ...permissionEvaluation.trace,
          ...(boundCommandPermissionEvaluation?.trace ?? [])
        ]
      });
      const auditEvent = runtime.appendAuditEvent({
        session,
        actionKey: result.commandType,
        target: result.target ?? result.source,
        correlationId: result.correlationId,
        details: {
          before: result.before ?? undefined,
          after: result.after ?? undefined
        }
      });
      const resultWithAudit = phase8Runtime.attachAuditEvent(session.user.tenantId, result, auditEvent.id);

      return context.json({ result: actionExecutionDto(resultWithAudit) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/control/actions/:executionId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "audit.read", {
        entityType: "actionExecution",
        tenantId: session.user.tenantId,
        entityId: context.req.param("executionId")
      });
      const actionExecution = phase8Runtime.getActionExecution(session.user.tenantId, context.req.param("executionId"));
      if (actionExecution === undefined) {
        throw Object.assign(new Error("action execution not found"), { code: "not_found" });
      }

      return context.json({ actionExecution });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/control/audit", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "audit.read", {
        entityType: "actionExecution",
        tenantId: session.user.tenantId
      });

      return context.json({ actionExecutions: phase8Runtime.listActionExecutions(session.user.tenantId) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/projects/:projectId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project !== undefined) {
        assertAllowed(runtime, session, "project.read", {
          entityType: "project",
          tenantId: session.user.tenantId,
          entityId: projectId
        });

        return context.json({ project: projectDto(project) });
      }

      assertAllowed(runtime, session, "project_draft.read", {
        entityType: "projectDraft",
        tenantId: session.user.tenantId,
        entityId: projectId
      });

      const projectDraft = phase3Runtime.getProjectDraft(session.user.tenantId, projectId);
      if (projectDraft === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({ projectDraft: projectDraftDto(projectDraft) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.put("/api/projects/:projectId/custom-fields/:fieldKey", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const fieldKey = context.req.param("fieldKey");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      const registry = phase10Runtime.getCustomFieldRegistry(session.user.tenantId);
      const definition = registry.definitions.find(
        (candidate) => candidate.targetEntityType === "project" && candidate.key === fieldKey
      );
      if (definition === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      const requiredPermission = definition.permissionRules?.writePermissionKey ?? "custom_field.write";
      assertAllowed(runtime, session, requiredPermission, {
        entityType: "project",
        tenantId: session.user.tenantId,
        entityId: projectId,
        ownerId: project.createdBy
      });
      const body = projectCustomFieldValueSchema.parse(await parseJson(context));
      const previousValue = project.customFieldValues.find((record) => record.fieldKey === fieldKey)?.value ?? null;
      const auditEventId = `audit-project-custom-field-${session.user.tenantId}-${projectId}-${fieldKey}`;
      const result = phase4Runtime.setProjectCustomFieldValue({
        tenantId: session.user.tenantId,
        projectId,
        definition,
        value: body.value as ProjectCustomFieldValue,
        actorId: session.user.id,
        auditEventId,
        correlationId: `corr-project-custom-field-${projectId}-${fieldKey}`
      });
      const actionExecution = phase10Runtime.recordProjectCustomFieldValueAction({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        accessProfileId: session.user.accessProfileId,
        projectId,
        fieldKey,
        requiredPermission,
        beforeValue: previousValue,
        afterValue: result.valueRecord.value,
        auditEventId
      });
      runtime.appendAuditEvent({
        session,
        id: auditEventId,
        actionKey: "project.custom_field.set",
        target: { entityType: "project", entityId: projectId },
        correlationId: actionExecution.correlationId,
        details: {
          before: { fieldKey, value: previousValue },
          after: { fieldKey, value: result.valueRecord.value }
        }
      });

      return context.json({
        result: {
          valueRecord: projectCustomFieldValueDto(result.valueRecord),
          actionExecution: actionExecutionDto(actionExecution)
        },
        readback: {
          project: projectDto(result.project)
        }
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/projects/:projectId/stages/:stageId/transition", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const stageId = context.req.param("stageId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "project.lifecycle.transition", {
        entityType: "project",
        tenantId: session.user.tenantId,
        entityId: projectId
      });
      const body = lifecycleTransitionSchema.parse(await parseJson(context));
      const result = phase4Runtime.transitionProjectStage(
        session.user.tenantId,
        projectId,
        stageId,
        body.transition,
        session.user.id
      );
      if (!result.ok) {
        return context.json(
          {
            ...errorDto("precondition_failed", "Условия перехода не выполнены"),
            transitionError: transitionErrorDto(result.error)
          },
          409
        );
      }
      runtime.appendAuditEvent({
        session,
        actionKey: `project.lifecycle.${body.transition}`,
        target: { entityType: "project", entityId: projectId },
        correlationId: `corr-api-project-transition-${projectId}-${body.transition}`,
        details: {
          before: projectDto(project),
          after: projectDto(result.project)
        }
      });

      return context.json({ project: projectDto(result.project) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/projects/:projectId/stages/:stageId/artifacts", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const stageId = context.req.param("stageId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "project.artifact.write", {
        entityType: "project",
        tenantId: session.user.tenantId,
        entityId: projectId
      });
      const body = artifactEvidenceSchema.parse(await parseJson(context));
      const nextProject = phase4Runtime.recordArtifact({
        tenantId: session.user.tenantId,
        projectId,
        stageId,
        ...(body.id !== undefined ? { id: body.id } : {}),
        templateId: body.templateId,
        templateKey: body.templateKey,
        status: body.status,
        ...(body.evidenceRef !== undefined ? { evidenceRef: body.evidenceRef } : {}),
        actorId: session.user.id
      });
      const artifact = latestById(nextProject.artifacts, body.id);
      runtime.appendAuditEvent({
        session,
        actionKey: "project.artifact.record",
        target: { entityType: "stage", entityId: stageId },
        details: {
          before: projectDto(project),
          after: projectDto(nextProject)
        }
      });

      return context.json({ artifact: artifact === undefined ? null : projectArtifactDto(artifact), project: projectDto(nextProject) }, 201);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/projects/:projectId/stages/:stageId/approvals", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const stageId = context.req.param("stageId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "project.approval.write", {
        entityType: "project",
        tenantId: session.user.tenantId,
        entityId: projectId
      });
      const body = approvalEvidenceSchema.parse(await parseJson(context));
      const nextProject = phase4Runtime.recordApproval({
        tenantId: session.user.tenantId,
        projectId,
        stageId,
        ...(body.id !== undefined ? { id: body.id } : {}),
        templateId: body.templateId,
        templateKey: body.templateKey,
        ...(body.decision !== undefined ? { decision: body.decision } : {}),
        actorId: session.user.id
      });
      const approval = latestById(nextProject.approvalRequests, body.id);
      runtime.appendAuditEvent({
        session,
        actionKey: "project.approval.record",
        target: { entityType: "stage", entityId: stageId },
        details: {
          before: projectDto(project),
          after: projectDto(nextProject)
        }
      });

      return context.json(
        { approval: approval === undefined ? null : approvalRequestDto(approval), project: projectDto(nextProject) },
        201
      );
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/projects/:projectId/tasks", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "task.read", {
        entityType: "task",
        tenantId: session.user.tenantId,
        entityId: projectId
      });

      return context.json({ tasks: phase4Runtime.listProjectTasks(session.user.tenantId, projectId).map(taskDto) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/projects/:projectId/tasks", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "task.write", {
        entityType: "task",
        tenantId: session.user.tenantId,
        entityId: projectId
      });
      const body = taskCreateSchema.parse(await parseJson(context));
      const participants: Phase4CreateTaskParticipantInput[] | undefined =
        body.participants === undefined
          ? undefined
          : body.participants.map((participant) => ({
              ...(participant.id !== undefined ? { id: participant.id } : {}),
              userId: participant.userId,
              role: participant.role
            }));
      assertTenantUsersExist(runtime, session, participants);
      const result = phase4Runtime.createTask({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        projectId,
        ...(body.id !== undefined ? { id: body.id } : {}),
        stageId: body.stageId,
        taskTemplateId: body.taskTemplateId,
        taskTemplateKey: body.taskTemplateKey,
        ...(body.status !== undefined ? { status: body.status } : {}),
        dueDate: body.dueDate,
        plannedWorkHours: body.plannedWorkHours,
        ...(participants !== undefined ? { participants } : {})
      });
      runtime.appendAuditEvent({
        session,
        actionKey: "task.create",
        target: { entityType: "task", entityId: result.task.id },
        correlationId: result.task.correlationId,
        details: {
          before: { state: "not_created" },
          after: {
            task: taskDto(result.task),
            participants: result.participants.map(taskParticipantDto)
          }
        }
      });

      return context.json(
        {
          task: taskDto(result.task),
          participants: result.participants.map(taskParticipantDto),
          project: projectDto(result.project)
        },
        201
      );
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.patch("/api/tasks/:taskId/status", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const taskId = context.req.param("taskId");
      const project = phase4Runtime.getTaskProject(session.user.tenantId, taskId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "task.status.write", {
        entityType: "task",
        tenantId: session.user.tenantId,
        entityId: taskId
      });
      assertTaskActionRelation(session, project, taskId, ["executor", "co_executor"]);
      const body = taskStatusUpdateSchema.parse(await parseJson(context));
      const beforeTask = project.tasks.find((task) => task.id === taskId);
      const nextProject = phase4Runtime.changeTaskStatus({
        tenantId: session.user.tenantId,
        taskId,
        toStatus: body.toStatus,
        actorId: session.user.id
      });
      const afterTask = nextProject.tasks.find((task) => task.id === taskId);
      runtime.appendAuditEvent({
        session,
        actionKey: "task.status.change",
        target: { entityType: "task", entityId: taskId },
        correlationId: `corr-api-task-status-${taskId}`,
        details: {
          before: beforeTask === undefined ? { state: "missing" } : taskDto(beforeTask),
          after: afterTask === undefined ? { state: "missing" } : taskDto(afterTask)
        }
      });

      return context.json({
        task: afterTask === undefined ? null : taskDto(afterTask),
        statusHistory: phase4Runtime.listTaskStatusHistory(session.user.tenantId, taskId).map(taskStatusHistoryDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/tasks/:taskId/comments", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const taskId = context.req.param("taskId");
      const project = phase4Runtime.getTaskProject(session.user.tenantId, taskId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "task.comment.write", {
        entityType: "task",
        tenantId: session.user.tenantId,
        entityId: taskId
      });
      assertTaskActionRelation(session, project, taskId);
      const body = taskCommentCreateSchema.parse(await parseJson(context));
      phase4Runtime.addTaskComment({
        tenantId: session.user.tenantId,
        taskId,
        body: body.body,
        authorId: session.user.id
      });
      const comments = phase4Runtime.listTaskComments(session.user.tenantId, taskId);
      const comment = comments[comments.length - 1];
      runtime.appendAuditEvent({
        session,
        actionKey: "task.comment.add",
        target: { entityType: "task", entityId: taskId },
        correlationId: comment?.correlationId,
        details: {
          before: { state: "not_created" },
          after: comment === undefined ? { state: "missing" } : taskCommentDto(comment)
        }
      });

      return context.json({ comment: comment === undefined ? null : taskCommentDto(comment) }, 201);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/my/tasks", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "task.read", {
        entityType: "task",
        tenantId: session.user.tenantId
      });
      const roles = parseTaskParticipantRoles(context.req.query("roles"));

      return context.json({
        tasks: phase4Runtime.listMyTasks(session.user.tenantId, session.user.id, roles).map(myTaskDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/kanban/projects/:projectId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const projectId = context.req.param("projectId");
      const project = phase4Runtime.getProject(session.user.tenantId, projectId);
      if (project === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      assertAllowed(runtime, session, "task.read", {
        entityType: "task",
        tenantId: session.user.tenantId,
        entityId: projectId
      });
      const kanban = phase4Runtime.getKanbanProject(session.user.tenantId, projectId);

      return context.json({
        projectId: kanban.projectId,
        columns: kanban.columns.map((column) => ({
          status: column.status,
          tasks: column.tasks.map(taskDto)
        }))
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/crm/accounts", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.read", {
        entityType: "account",
        tenantId: session.user.tenantId
      });

      return context.json({
        accounts: phase3Runtime.listAccounts(session.user.tenantId).map(accountDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/crm/accounts", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.write", {
        entityType: "account",
        tenantId: session.user.tenantId
      });

      const body: Phase3AccountCreateInput = accountCreateSchema.parse(await parseJson(context));
      const account = phase3Runtime.createAccount(session.user.tenantId, body);

      return context.json({ account: accountDto(account) }, 201);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/crm/accounts/:accountId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.read", {
        entityType: "account",
        tenantId: session.user.tenantId,
        entityId: context.req.param("accountId")
      });

      const account = phase3Runtime.getAccount(session.user.tenantId, context.req.param("accountId"));
      if (account === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({ account: accountDto(account) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/crm/contacts", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.read", {
        entityType: "contact",
        tenantId: session.user.tenantId
      });

      return context.json({
        contacts: phase3Runtime.listContacts(session.user.tenantId).map(contactDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/crm/contacts", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.write", {
        entityType: "contact",
        tenantId: session.user.tenantId
      });

      const body: Phase3ContactCreateInput = contactCreateSchema.parse(await parseJson(context));
      const contact = phase3Runtime.createContact(session.user.tenantId, body);

      return context.json({ contact: contactDto(contact) }, 201);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/crm/contacts/:contactId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.read", {
        entityType: "contact",
        tenantId: session.user.tenantId,
        entityId: context.req.param("contactId")
      });

      const contact = phase3Runtime.getContact(session.user.tenantId, context.req.param("contactId"));
      if (contact === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({ contact: contactDto(contact) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/crm/opportunities", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.read", {
        entityType: "opportunity",
        tenantId: session.user.tenantId
      });

      return context.json({
        opportunities: phase3Runtime.listOpportunities(session.user.tenantId).map(opportunityDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/crm/opportunities", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.write", {
        entityType: "opportunity",
        tenantId: session.user.tenantId
      });

      const body: Phase3OpportunityCreateInput = createOpportunitySchema.parse(await parseJson(context));
      const opportunity = phase3Runtime.createOpportunity(session.user.tenantId, body);

      return context.json({ opportunity: opportunityDto(opportunity) }, 201);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/api/crm/opportunities/:opportunityId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "crm.opportunity.read", {
        entityType: "opportunity",
        tenantId: session.user.tenantId,
        entityId: context.req.param("opportunityId")
      });

      const opportunity = phase3Runtime.getOpportunity(session.user.tenantId, context.req.param("opportunityId"));
      if (opportunity === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({ opportunity: opportunityDto(opportunity) });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/crm/opportunities/:opportunityId/readiness", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const opportunityId = context.req.param("opportunityId");
      assertAllowed(runtime, session, "crm.readiness.run", {
        entityType: "opportunity",
        tenantId: session.user.tenantId,
        entityId: opportunityId
      });
      emptyBodySchema.parse(await parseJson(context));

      const readiness = phase3Runtime.evaluateReadiness(session.user.tenantId, opportunityId);
      if (readiness === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({
        correlationId: `corr-readiness-${opportunityId}`,
        readiness
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/crm/opportunities/:opportunityId/template-match", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const opportunityId = context.req.param("opportunityId");
      assertAllowed(runtime, session, "crm.template_match.run", {
        entityType: "opportunity",
        tenantId: session.user.tenantId,
        entityId: opportunityId
      });
      emptyBodySchema.parse(await parseJson(context));

      const templateMatch = phase3Runtime.matchTemplate(session.user.tenantId, opportunityId);
      if (templateMatch === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({
        correlationId: `corr-template-match-${opportunityId}`,
        templateMatch
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/crm/opportunities/:opportunityId/feasibility", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const opportunityId = context.req.param("opportunityId");
      assertAllowed(runtime, session, "crm.feasibility.run", {
        entityType: "opportunity",
        tenantId: session.user.tenantId,
        entityId: opportunityId
      });
      emptyBodySchema.parse(await parseJson(context));

      const result = phase3Runtime.runFeasibility(session.user.tenantId, opportunityId);
      if (result === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      return context.json({
        correlationId: `corr-feasibility-${opportunityId}`,
        ...result
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/api/crm/opportunities/:opportunityId/project-draft", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const opportunityId = context.req.param("opportunityId");
      assertAllowed(runtime, session, "project_draft.create", {
        entityType: "opportunity",
        tenantId: session.user.tenantId,
        entityId: opportunityId
      });
      emptyBodySchema.parse(await parseJson(context));
      if (phase3Runtime.getOpportunity(session.user.tenantId, opportunityId) === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }
      const result = phase3Runtime.createProjectDraftFromOpportunity(session.user.tenantId, opportunityId, {
        actorId: session.user.id,
        ...(session.user.accessProfileId !== undefined ? { accessProfileId: session.user.accessProfileId } : {})
      });
      if (result === undefined) {
        return context.json(errorDto("validation_error", "Невозможно создать проектный черновик"), 400);
      }
      runtime.appendAuditEvent({
        session,
        actionKey: result.actionExecution.commandType,
        target: {
          entityType: result.actionExecution.source.entityType,
          entityId: result.actionExecution.source.entityId
        },
        correlationId: result.correlationId,
        details: {
          before: result.actionExecution.before ?? undefined,
          after: result.actionExecution.after ?? undefined
        }
      });

      return context.json(
        {
          correlationId: result.correlationId,
          projectDraft: projectDraftDto(result.projectDraft),
          actionExecution: actionExecutionDto(result.actionExecution)
        },
        201
      );
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/test-fixtures/reset", (context) => {
    if (!options.allowTestFixtureReset) {
      return context.json(errorDto("test_mode_only", "Сброс фикстур доступен только в тестовом режиме"), 403);
    }

    runtime = createPhase2RuntimeState();
    phase3Runtime = createPhase3CrmRuntimeState();
    phase4Runtime = createPhase4RuntimeState();
    phase5Runtime = createPhase5RuntimeState();
    phase6Runtime = createPhase6RuntimeState();
    phase7Runtime = createPhase7RuntimeState();
    phase8Runtime = createPhase8RuntimeState();
    phase9Runtime = createPhase9RuntimeState();
    phase10Runtime = createPhase10RuntimeState();
    phase11Runtime = createPhase11RuntimeState();
    phase11ImportPreviewCounter = 0;
    return context.json({ status: "reset" });
  });

  return app;
}

export type ApiApp = ReturnType<typeof createApiApp>;

function hasModelErrorCode(error: Error): error is Error & { code: "validation_error" | "conflict" } {
  return "code" in error && (error.code === "validation_error" || error.code === "conflict");
}

function hasActionEngineErrorCode(
  error: Error
): error is Error & { code: "validation_error" | "conflict" | "precondition_failed" | "tenant_mismatch" } {
  return (
    "code" in error &&
    (error.code === "validation_error" ||
      error.code === "conflict" ||
      error.code === "precondition_failed" ||
      error.code === "tenant_mismatch")
  );
}

function isSchedulePreconditionError(error: unknown): error is Error & {
  code: "precondition_failed";
  validationIssues: ScheduleValidationIssue[];
} {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "precondition_failed" &&
    "validationIssues" in error &&
    Array.isArray(error.validationIssues)
  );
}

function hasBlockerError(error: unknown): error is Error & { code: "precondition_failed" | "stale_preview"; blockers: Array<{ code: string }> } {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "precondition_failed" || error.code === "stale_preview") &&
    "blockers" in error &&
    Array.isArray(error.blockers)
  );
}

function accountDto(account: {
  id: string;
  tenantId: string;
  displayName: string;
  legalName?: string;
  taxId?: string;
  createdAt: string;
}) {
  return {
    id: account.id,
    tenantId: account.tenantId,
    displayName: account.displayName,
    ...(account.legalName !== undefined ? { legalName: account.legalName } : {}),
    ...(account.taxId !== undefined ? { taxId: account.taxId } : {}),
    createdAt: account.createdAt
  };
}

function contactDto(contact: {
  id: string;
  tenantId: string;
  accountId?: string;
  displayName: string;
  email?: string;
  phone?: string;
  roleLabel?: string;
}) {
  return {
    id: contact.id,
    tenantId: contact.tenantId,
    ...(contact.accountId !== undefined ? { accountId: contact.accountId } : {}),
    displayName: contact.displayName,
    ...(contact.email !== undefined ? { email: contact.email } : {}),
    ...(contact.phone !== undefined ? { phone: contact.phone } : {}),
    ...(contact.roleLabel !== undefined ? { roleLabel: contact.roleLabel } : {})
  };
}

function opportunityDto(opportunity: {
  id: string;
  tenantId: string;
  title: string;
  stageSystemKey: string;
  accountId?: string;
  contactIds: string[];
  plannedStartDate: string;
  desiredFinishDate: string;
  expectedValue: { amount: number; currency: string };
  probability: number;
  categoryKey: string;
  typologyKey: string;
  scopeHints: Array<{ key: string; label: string; value: string | number | boolean }>;
  customFieldRefs: Array<{ definitionId: string; key: string }>;
  source: { type: "manual" };
  createdAt: string;
}) {
  return {
    id: opportunity.id,
    tenantId: opportunity.tenantId,
    title: opportunity.title,
    stageSystemKey: opportunity.stageSystemKey,
    ...(opportunity.accountId !== undefined ? { accountId: opportunity.accountId } : {}),
    contactIds: [...opportunity.contactIds],
    plannedStartDate: opportunity.plannedStartDate,
    desiredFinishDate: opportunity.desiredFinishDate,
    expectedValue: { ...opportunity.expectedValue },
    probability: opportunity.probability,
    categoryKey: opportunity.categoryKey,
    typologyKey: opportunity.typologyKey,
    scopeHints: opportunity.scopeHints.map((hint) => ({ ...hint })),
    customFieldRefs: opportunity.customFieldRefs.map((fieldRef) => ({ ...fieldRef })),
    source: { ...opportunity.source },
    createdAt: opportunity.createdAt
  };
}

function projectDraftDto(projectDraft: {
  id: string;
  tenantId: string;
  title: string;
  status: string;
  sourceOpportunity: {
    type: "crm_opportunity";
    opportunityId: string;
    title: string;
    accountId?: string;
    contactIds: string[];
    plannedStartDate: string;
    desiredFinishDate: string;
  };
  processTemplate: {
    templateId: string;
    key: string;
    label: string;
    version: number;
    matchConfidence: number;
    assumptions: Array<{ code: string; message: string }>;
  };
  demand: {
    totalPlannedWorkHours: number;
    scenarioKey: string;
    scenarioLabel: string;
    formulaKey: string;
    formulaVersion: number;
    confidence: number;
    stageRoleDemands: Array<{
      stageKey: string;
      stageLabel: string;
      roleKey: string;
      roleLabel: string;
      plannedWorkHours: number;
    }>;
  };
  feasibility: {
    status: string;
    severity: string;
    expectedWindow: { startDate: string; endDate: string };
    blockerCodes: string[];
  };
  createdBy: string;
  createdAt: string;
  correlationId: string;
}) {
  return {
    id: projectDraft.id,
    tenantId: projectDraft.tenantId,
    title: projectDraft.title,
    status: projectDraft.status,
    sourceOpportunity: {
      ...projectDraft.sourceOpportunity,
      contactIds: [...projectDraft.sourceOpportunity.contactIds]
    },
    processTemplate: {
      ...projectDraft.processTemplate,
      assumptions: projectDraft.processTemplate.assumptions.map((assumption) => ({ ...assumption }))
    },
    demand: {
      ...projectDraft.demand,
      stageRoleDemands: projectDraft.demand.stageRoleDemands.map((demand) => ({ ...demand }))
    },
    feasibility: {
      ...projectDraft.feasibility,
      expectedWindow: { ...projectDraft.feasibility.expectedWindow },
      blockerCodes: [...projectDraft.feasibility.blockerCodes]
    },
    createdBy: projectDraft.createdBy,
    createdAt: projectDraft.createdAt,
    correlationId: projectDraft.correlationId
  };
}

function processTemplateDto(template: ProcessTemplate) {
  return {
    id: template.id,
    tenantId: template.tenantId,
    key: template.key,
    label: template.label,
    active: template.active,
    version: template.version,
    updatedAt: template.updatedAt,
    stages: template.stages.map((stage) => ({
      id: stage.id,
      tenantId: stage.tenantId,
      key: stage.key,
      label: stage.label,
      sortOrder: stage.sortOrder,
      active: stage.active,
      version: stage.version,
      updatedAt: stage.updatedAt,
      requiredArtifactTemplates: stage.requiredArtifactTemplates.map((template) => ({ ...template })),
      approvalTemplates: stage.approvalTemplates.map((template) => ({ ...template })),
      taskTemplates: stage.taskTemplates.map((template) => ({
        ...template,
        defaultParticipantRoleKeys: [...template.defaultParticipantRoleKeys]
      }))
    }))
  };
}

function customFieldDefinitionDto(definition: CustomFieldDefinition) {
  return {
    id: definition.id,
    tenantId: definition.tenantId,
    targetEntityType: definition.targetEntityType,
    key: definition.key,
    label: definition.label,
    valueType: definition.valueType,
    required: definition.required,
    active: definition.active,
    version: definition.version,
    ...(definition.validationRules !== undefined ? { validationRules: structuredClone(definition.validationRules) } : {}),
    ...(definition.visibilityRules !== undefined ? { visibilityRules: definition.visibilityRules.map((rule) => ({ ...rule })) } : {}),
    ...(definition.permissionRules !== undefined ? { permissionRules: { ...definition.permissionRules } } : {}),
    bindingFlags: { ...definition.bindingFlags },
    updatedAt: definition.updatedAt
  };
}

function customFieldRegistryDto(registry: CustomFieldRegistry) {
  return {
    tenantId: registry.tenantId,
    version: registry.version,
    definitions: registry.definitions.map(customFieldDefinitionDto),
    updatedAt: registry.updatedAt
  };
}

function actionExecutionDto(actionExecution: {
  id: string;
  tenantId: string;
  actorId: string;
  commandType: string;
  requiredPermission: string;
  status: string;
  source: { entityType: string; entityId: string };
  target?: { entityType: string; entityId: string };
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
  correlationId: string;
  sourceSurface?: { surfaceId: string; surfaceKey: string; rowId: string; actionSlotKey: string };
  inputSummary?: Record<string, unknown>;
  auditEventIds?: string[];
  permissionTrace?: string[];
  preconditionTrace?: string[];
  trace: string[];
}) {
  return {
    id: actionExecution.id,
    tenantId: actionExecution.tenantId,
    actorId: actionExecution.actorId,
    commandType: actionExecution.commandType,
    requiredPermission: actionExecution.requiredPermission,
    status: actionExecution.status,
    source: { ...actionExecution.source },
    ...(actionExecution.target !== undefined ? { target: { ...actionExecution.target } } : {}),
    before: actionExecution.before === null ? null : structuredClone(actionExecution.before),
    after: actionExecution.after === null ? null : structuredClone(actionExecution.after),
    timestamp: actionExecution.timestamp,
    correlationId: actionExecution.correlationId,
    ...(actionExecution.sourceSurface !== undefined ? { sourceSurface: { ...actionExecution.sourceSurface } } : {}),
    ...(actionExecution.inputSummary !== undefined ? { inputSummary: structuredClone(actionExecution.inputSummary) } : {}),
    ...(actionExecution.auditEventIds !== undefined ? { auditEventIds: [...actionExecution.auditEventIds] } : {}),
    ...(actionExecution.permissionTrace !== undefined ? { permissionTrace: [...actionExecution.permissionTrace] } : {}),
    ...(actionExecution.preconditionTrace !== undefined ? { preconditionTrace: [...actionExecution.preconditionTrace] } : {}),
    trace: [...actionExecution.trace]
  };
}

function kpiDefinitionListDto(bundle: KpiDefinitionBundle) {
  return {
    ...bundle.definition,
    formula: bundle.formula,
    thresholdRuleSet: bundle.thresholdRuleSet
  };
}

function scheduleValidationIssueDto(issue: ScheduleValidationIssue) {
  return {
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    ...(issue.nodeId !== undefined ? { nodeId: issue.nodeId } : {}),
    ...(issue.dependencyId !== undefined ? { dependencyId: issue.dependencyId } : {}),
    fieldRefs: [...issue.fieldRefs]
  };
}

function schedulePlanDto(plan: SchedulePlan) {
  return {
    id: plan.id,
    tenantId: plan.tenantId,
    projectId: plan.projectId,
    version: plan.version,
    ...(plan.baselineId !== undefined ? { baselineId: plan.baselineId } : {}),
    status: plan.status,
    wbsNodes: plan.wbsNodes.map((node) => ({
      id: node.id,
      tenantId: node.tenantId,
      projectId: node.projectId,
      ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
      ...(node.taskId !== undefined ? { taskId: node.taskId } : {}),
      ...(node.stageId !== undefined ? { stageId: node.stageId } : {}),
      sortOrder: node.sortOrder,
      ...(node.schedule !== undefined
        ? {
            schedule: {
              ...(node.schedule.plannedStartDate !== undefined ? { plannedStartDate: node.schedule.plannedStartDate } : {}),
              ...(node.schedule.plannedFinishDate !== undefined ? { plannedFinishDate: node.schedule.plannedFinishDate } : {}),
              ...(node.schedule.durationDays !== undefined ? { durationDays: node.schedule.durationDays } : {})
            }
          }
        : {}),
      ...(node.plannedWorkHours !== undefined ? { plannedWorkHours: node.plannedWorkHours } : {}),
      ...(node.progressPercent !== undefined ? { progressPercent: node.progressPercent } : {})
    })),
    dependencies: plan.dependencies.map((dependency) => ({ ...dependency }))
  };
}

function scheduleBaselineDto(baseline: ScheduleBaselineSnapshot) {
  return {
    id: baseline.id,
    tenantId: baseline.tenantId,
    projectId: baseline.projectId,
    schedulePlanId: baseline.schedulePlanId,
    createdBy: baseline.createdBy,
    createdAt: baseline.createdAt,
    taskBaselineValues: baseline.taskBaselineValues.map((value) => ({ ...value }))
  };
}

function scheduleSnapshotDto(snapshot: {
  schedulePlan: SchedulePlan;
  validationIssues: ScheduleValidationIssue[];
  baseline?: ScheduleBaselineSnapshot;
}) {
  return {
    schedulePlan: schedulePlanDto(snapshot.schedulePlan),
    validationIssues: snapshot.validationIssues.map(scheduleValidationIssueDto),
    ...(snapshot.baseline !== undefined ? { baseline: scheduleBaselineDto(snapshot.baseline) } : {})
  };
}

function stageDto(stage: ProjectStage) {
  return {
    id: stage.id,
    tenantId: stage.tenantId,
    projectId: stage.projectId,
    templateId: stage.templateId,
    templateKey: stage.templateKey,
    templateVersion: stage.templateVersion,
    label: stage.label,
    sortOrder: stage.sortOrder,
    status: stage.status,
    ...(stage.startedAt !== undefined ? { startedAt: stage.startedAt } : {}),
    ...(stage.completedAt !== undefined ? { completedAt: stage.completedAt } : {})
  };
}

function projectDto(project: ManagedProject) {
  return {
    id: project.id,
    tenantId: project.tenantId,
    title: project.title,
    lifecycleStatus: project.lifecycleStatus,
    currentStageId: project.currentStageId,
    sourceDraftId: project.sourceDraftId,
    sourceOpportunity: {
      ...project.sourceOpportunity,
      contactIds: [...project.sourceOpportunity.contactIds]
    },
    processTemplateSnapshot: {
      templateId: project.processTemplateSnapshot.templateId,
      key: project.processTemplateSnapshot.key,
      label: project.processTemplateSnapshot.label,
      version: project.processTemplateSnapshot.version,
      active: project.processTemplateSnapshot.active,
      updatedAt: project.processTemplateSnapshot.updatedAt,
      stageTemplates: project.processTemplateSnapshot.stageTemplates.map((stageTemplate) => ({
        ...stageTemplate,
        requiredArtifactTemplates: stageTemplate.requiredArtifactTemplates.map((template) => ({ ...template })),
        approvalTemplates: stageTemplate.approvalTemplates.map((template) => ({ ...template })),
        taskTemplates: stageTemplate.taskTemplates.map((template) => ({
          ...template,
          defaultParticipantRoleKeys: [...template.defaultParticipantRoleKeys]
        }))
      }))
    },
    stages: project.stages.map(stageDto),
    stageHistory: project.stageHistory.map((entry) => ({ ...entry })),
    tasks: project.tasks.map(taskDto),
    taskParticipants: project.taskParticipants.map(taskParticipantDto),
    taskComments: project.taskComments.map(taskCommentDto),
    taskStatusHistory: project.taskStatusHistory.map(taskStatusHistoryDto),
    customFieldValues: project.customFieldValues.map(projectCustomFieldValueDto),
    artifacts: project.artifacts.map(projectArtifactDto),
    approvalRequests: project.approvalRequests.map(approvalRequestDto),
    createdBy: project.createdBy,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    correlationId: project.correlationId
  };
}

function projectCustomFieldValueDto(valueRecord: ProjectCustomFieldValueRecordLike) {
  return {
    id: valueRecord.id,
    tenantId: valueRecord.tenantId,
    projectId: valueRecord.projectId,
    definitionId: valueRecord.definitionId,
    definitionVersion: valueRecord.definitionVersion,
    fieldKey: valueRecord.fieldKey,
    valueType: valueRecord.valueType,
    value: structuredClone(valueRecord.value),
    updatedBy: valueRecord.updatedBy,
    updatedAt: valueRecord.updatedAt,
    correlationId: valueRecord.correlationId,
    ...(valueRecord.auditEventId !== undefined ? { auditEventId: valueRecord.auditEventId } : {})
  };
}

type ProjectCustomFieldValueRecordLike = {
  id: string;
  tenantId: string;
  projectId: string;
  definitionId: string;
  definitionVersion: number;
  fieldKey: string;
  valueType: string;
  value: ProjectCustomFieldValue;
  updatedBy: string;
  updatedAt: string;
  correlationId: string;
  auditEventId?: string;
};

function taskDto(task: Task) {
  return {
    id: task.id,
    tenantId: task.tenantId,
    projectId: task.projectId,
    stageId: task.stageId,
    title: task.title,
    status: task.status,
    dueDate: task.dueDate,
    plannedWorkHours: task.plannedWorkHours,
    sourceTemplate: {
      ...task.sourceTemplate,
      defaultParticipantRoleKeys: [...task.sourceTemplate.defaultParticipantRoleKeys]
    },
    createdBy: task.createdBy,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    correlationId: task.correlationId
  };
}

function myTaskDto(task: Task & { relationRoles: TaskParticipantRole[] }) {
  return {
    ...taskDto(task),
    relationRoles: [...task.relationRoles]
  };
}

function taskParticipantDto(participant: TaskParticipant) {
  return { ...participant };
}

function taskCommentDto(comment: TaskComment) {
  return { ...comment };
}

function taskStatusHistoryDto(entry: TaskStatusHistoryEntry) {
  return { ...entry };
}

function projectArtifactDto(artifact: ProjectArtifact) {
  return { ...artifact };
}

function approvalRequestDto(request: ApprovalRequest) {
  return { ...request };
}

function stageGateBlockerDto(blocker: StageGateBlocker) {
  return { ...blocker };
}

function stageGateLikeBlockerDto(blocker: Record<string, unknown>) {
  return { ...blocker };
}

function transitionErrorDto(error: ProjectLifecycleTransitionError) {
  return {
    code: error.code,
    message: error.message,
    details: { ...error.details },
    ...(error.blockers !== undefined ? { blockers: error.blockers.map(stageGateBlockerDto) } : {})
  };
}

function latestById<T extends { id: string }>(items: T[], id: string | undefined): T | undefined {
  if (id !== undefined) {
    return items.find((item) => item.id === id);
  }

  return items[items.length - 1];
}

function parseTaskParticipantRoles(rawRoles: string | undefined): TaskParticipantRole[] | undefined {
  if (rawRoles === undefined || rawRoles.trim().length === 0) {
    return undefined;
  }
  const roles = rawRoles.split(",").map((role) => role.trim());
  for (const role of roles) {
    if (!["executor", "co_executor", "requester", "controller", "approver", "observer"].includes(role)) {
      throw Object.assign(new Error("validation_error"), { code: "validation_error" });
    }
  }

  return roles as TaskParticipantRole[];
}

function handleRouteError(context: Context, error: unknown) {
  if (error instanceof z.ZodError || (error instanceof Error && error.message === "invalid_json")) {
    return context.json(errorDto("validation_error", "Некорректный запрос"), 400);
  }

  if (error instanceof Error && error.message === "unauthenticated") {
    return context.json(errorDto("unauthenticated", "Требуется тестовый пользователь"), 401);
  }

  if (typeof error === "object" && error !== null && "code" in error && "status" in error) {
    const typedError = error as { code: ApiErrorCode; status: 403 };
    return context.json(errorDto(typedError.code, "Доступ запрещен"), typedError.status);
  }

  if (error instanceof Error && error.name === "TenantConfigModelError" && hasModelErrorCode(error)) {
    const code = error.code === "conflict" ? "conflict" : "validation_error";
    return context.json(
      errorDto(code, code === "conflict" ? "Конфликт версии конфигурации" : "Некорректный запрос"),
      code === "conflict" ? 409 : 400
    );
  }

  if (error instanceof Error && error.name === "AccessControlModelError" && hasModelErrorCode(error)) {
    const code = error.code === "conflict" ? "conflict" : "validation_error";
    return context.json(
      errorDto(code, code === "conflict" ? "Конфликт версии профиля доступа" : "Некорректный запрос"),
      code === "conflict" ? 409 : 400
    );
  }

  if (error instanceof Error && error.name === "KpiEngineError") {
    if ("code" in error && error.code === "tenant_mismatch") {
      return context.json(errorDto("tenant_mismatch", "Доступ запрещен"), 403);
    }
    if ("code" in error && (error.code === "stale_preview" || error.code === "conflict")) {
      return context.json(errorDto("conflict", "Конфликт данных"), 409);
    }

    return context.json(errorDto("validation_error", "Некорректный запрос"), 400);
  }

  if (error instanceof IntegrationDomainError) {
    if (error.code === "tenant_mismatch") {
      return context.json(errorDto("tenant_mismatch", "Доступ запрещен"), 403);
    }
    if (error.code === "stale_preview" || error.code === "import_preview_required") {
      return context.json(errorDto("stale_preview", "Предпросмотр устарел"), 409);
    }
    if (error.code === "idempotency_conflict" || error.code === "mapping_conflict" || error.code === "conflict") {
      return context.json(errorDto("conflict", "Конфликт данных"), 409);
    }
    if (error.code === "adapter_rate_limited") {
      return context.json(errorDto("adapter_rate_limited", "Адаптер временно ограничил запросы"), 429);
    }
    if (error.code === "adapter_unavailable") {
      return context.json(errorDto("adapter_unavailable", "Адаптер недоступен"), 503);
    }
    if (error.code === "adapter_failure") {
      return context.json(errorDto("adapter_failure", "Адаптер вернул ошибку"), 502);
    }

    return context.json(errorDto("validation_error", "Некорректный запрос"), 400);
  }

  if (
    error instanceof Error &&
    (error.name === "CrmCoreModelError" ||
      error.name === "ProjectCoreModelError" ||
      error.name === "ControlSurfaceModelError" ||
      error.name === "RetrospectiveModelError" ||
      error.name === "ResourcePlanningModelError" ||
      error.name === "SchedulingEngineModelError") &&
    hasModelErrorCode(error)
  ) {
    const code = error.code === "conflict" ? "conflict" : "validation_error";
    return context.json(errorDto(code, "Некорректный запрос"), code === "conflict" ? 409 : 400);
  }

  if (error instanceof Error && error.name === "ActionEngineModelError" && hasActionEngineErrorCode(error)) {
    if (error.code === "conflict") {
      return context.json(errorDto("conflict", "Конфликт данных"), 409);
    }
    if (error.code === "precondition_failed") {
      return context.json(errorDto("precondition_failed", "Условия действия не выполнены"), 409);
    }
    if (error.code === "tenant_mismatch") {
      return context.json(errorDto("tenant_mismatch", "Доступ запрещен"), 403);
    }

    return context.json(errorDto("validation_error", "Некорректный запрос"), 400);
  }

  if (typeof error === "object" && error !== null && "code" in error && error.code === "conflict") {
    return context.json(errorDto("conflict", "Конфликт данных"), 409);
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "not_found") {
    return context.json(errorDto("not_found", "Объект не найден"), 404);
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "tenant_mismatch") {
    return context.json(errorDto("tenant_mismatch", "Доступ запрещен"), 403);
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "precondition_failed") {
    return context.json(errorDto("precondition_failed", "Условия действия не выполнены"), 409);
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "dry_run_required") {
    return context.json(errorDto("dry_run_required", "Требуется предварительный просмотр"), 409);
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "stale_preview") {
    return context.json(errorDto("stale_preview", "Предпросмотр устарел"), 409);
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "not_implemented") {
    return context.json(errorDto("not_implemented", "Действие еще не подключено к доменной команде"), 501);
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "validation_error") {
    return context.json(errorDto("validation_error", "Некорректный запрос"), 400);
  }

  return context.json(errorDto("validation_error", "Не удалось обработать запрос"), 400);
}

function resolveDiagnosticsTargetTenantId(
  runtime: Phase2RuntimeState,
  session: Phase2RuntimeSession,
  body: z.infer<typeof permissionDiagnosticsSchema>
): string | undefined {
  if (body.targetEntityType === "tenantIsolationProbe" && body.targetEntityId !== undefined) {
    return runtime.getProbe(body.targetEntityId)?.tenantId;
  }

  return body.targetTenantId ?? session.user.tenantId;
}
