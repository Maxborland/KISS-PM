import {
  createAccessProfile,
  createPermission,
  createScopeRule,
  evaluatePolicy
} from "@kiss-pm/access-control";
import type {
  AccessProfile,
  Permission,
  PolicyEvaluation,
  PolicyTargetRef,
  ScopeRule
} from "@kiss-pm/access-control";
import {
  createActorContext,
  createAuditEvent,
  createAuditTargetRef
} from "@kiss-pm/domain-core";
import type { AuditEvent, CorrelationId, Tenant, TenantId, TenantIsolationProbe } from "@kiss-pm/domain-core";
import {
  getPhase2FixtureSeed,
  PHASE2_FIXTURE_TIMESTAMP
} from "@kiss-pm/shared-test-fixtures";
import type {
  DemoTenantUser,
  Phase2AccessProfileSeed,
  Phase2TenantLabelSeed
} from "@kiss-pm/shared-test-fixtures";
import {
  createTenantLabelSet,
  updateTenantLabel
} from "@kiss-pm/tenant-config";
import type { TenantLabelSet } from "@kiss-pm/tenant-config";

import { createInMemoryAuditEventStore } from "./auditLog";

export type Phase2RuntimeSession = {
  tenant: Tenant;
  user: DemoTenantUser;
  profile: AccessProfile;
  labelSet: TenantLabelSet;
};

export type Phase2RuntimeState = ReturnType<typeof createPhase2RuntimeState>;

const FIXED_TIMESTAMP = PHASE2_FIXTURE_TIMESTAMP;

const p10RuntimeLabelDefaults: Record<string, string> = {
  "runtime.role.project_manager": "Руководитель проекта",
  "runtime.role.resource_manager": "Ресурсный менеджер",
  "runtime.role.executor": "Исполнитель",
  "runtime.stage.initiation": "Инициация",
  "runtime.stage.delivery": "Поставка",
  "navigation.projects": "Проекты",
  "navigation.portfolio": "Портфель",
  "navigation.resources": "Ресурсы"
};

const phase2PermissionCatalog = [
  createPermission({
    key: "tenant.read",
    description: "Read current tenant summary",
    category: "tenant"
  }),
  createPermission({
    key: "access_profile.read",
    description: "Read tenant access profiles",
    category: "access_control"
  }),
  createPermission({
    key: "access_profile.write",
    description: "Create and update tenant access profiles",
    category: "access_control"
  }),
  createPermission({
    key: "tenant_labels.write",
    description: "Update tenant runtime labels",
    category: "tenant_config"
  }),
  createPermission({
    key: "tenant.config.write",
    description: "Apply governed tenant configuration and template version changes",
    category: "tenant_config"
  }),
  createPermission({
    key: "tenant.config.read",
    description: "Read tenant configuration versions and runtime projections",
    category: "tenant_config"
  }),
  createPermission({
    key: "tenant.config.export",
    description: "Export tenant configuration packages",
    category: "tenant_config"
  }),
  createPermission({
    key: "tenant.config.import",
    description: "Preview and apply tenant configuration imports",
    category: "tenant_config"
  }),
  createPermission({
    key: "custom_field.write",
    description: "Preview, publish, and fill tenant custom project fields",
    category: "tenant_config"
  }),
  createPermission({
    key: "permission.diagnostics.read",
    description: "Run safe permission diagnostics",
    category: "access_control"
  }),
  createPermission({
    key: "tenant_probe.read",
    description: "Read synthetic tenant isolation probes",
    category: "tenant"
  }),
  createPermission({
    key: "audit.read",
    description: "Read tenant audit events",
    category: "audit"
  }),
  createPermission({
    key: "crm.opportunity.read",
    description: "Read CRM intake opportunities",
    category: "crm_intake"
  }),
  createPermission({
    key: "crm.opportunity.write",
    description: "Create CRM intake opportunities",
    category: "crm_intake"
  }),
  createPermission({
    key: "crm.readiness.run",
    description: "Run opportunity readiness checks",
    category: "crm_intake"
  }),
  createPermission({
    key: "crm.template_match.run",
    description: "Run opportunity process-template matching",
    category: "crm_intake"
  }),
  createPermission({
    key: "crm.feasibility.run",
    description: "Run opportunity demand/capacity feasibility",
    category: "crm_intake"
  }),
  createPermission({
    key: "project_draft.create",
    description: "Create a project draft from a qualified opportunity",
    category: "project_intake"
  }),
  createPermission({
    key: "project_draft.read",
    description: "Read project drafts created from CRM intake",
    category: "project_intake"
  }),
  createPermission({
    key: "project.create_from_template",
    description: "Create managed projects from project drafts and process templates",
    category: "project_lifecycle"
  }),
  createPermission({
    key: "project.template.write",
    description: "Preview and publish governed project process-template versions",
    category: "project_lifecycle"
  }),
  createPermission({
    key: "project.read",
    description: "Read managed projects and lifecycle state",
    category: "project_lifecycle"
  }),
  createPermission({
    key: "project.lifecycle.transition",
    description: "Move managed project stages through governed lifecycle transitions",
    category: "project_lifecycle"
  }),
  createPermission({
    key: "project.closure.read",
    description: "Read project closure checklist, readiness, and snapshot links",
    category: "project_lifecycle"
  }),
  createPermission({
    key: "project.close",
    description: "Preview and apply governed project closure commands",
    category: "project_lifecycle"
  }),
  createPermission({
    key: "project.artifact.write",
    description: "Record project stage artifact evidence",
    category: "project_lifecycle"
  }),
  createPermission({
    key: "project.approval.write",
    description: "Record project stage approval evidence",
    category: "project_lifecycle"
  }),
  createPermission({
    key: "task.read",
    description: "Read canonical project tasks and task projections",
    category: "task_work_management"
  }),
  createPermission({
    key: "task.write",
    description: "Create canonical project tasks and participant relations",
    category: "task_work_management"
  }),
  createPermission({
    key: "task.status.write",
    description: "Change canonical task status",
    category: "task_work_management"
  }),
  createPermission({
    key: "task.comment.write",
    description: "Append canonical task comments",
    category: "task_work_management"
  }),
  createPermission({
    key: "resource.read",
    description: "Read resource planning load, reservations, and overloads",
    category: "resource_planning"
  }),
  createPermission({
    key: "resource.write",
    description: "Create reservations and apply governed resource resolution commands",
    category: "resource_planning"
  }),
  createPermission({
    key: "kpi:read",
    description: "Read KPI definitions, evaluations, deviations, and traces",
    category: "kpi_control"
  }),
  createPermission({
    key: "kpi.config:write",
    description: "Create, publish, and retire KPI definitions and threshold versions",
    category: "kpi_control"
  }),
  createPermission({
    key: "kpi.evaluate:execute",
    description: "Run governed KPI evaluations and signal projection commands",
    category: "kpi_control"
  }),
  createPermission({
    key: "control.surface:read",
    description: "Read tenant control surface definitions and operational read models",
    category: "control_surfaces"
  }),
  createPermission({
    key: "control.action:write",
    description: "Preview and execute governed management actions from control surfaces",
    category: "control_surfaces"
  }),
  createPermission({
    key: "risk:accept",
    description: "Accept a visible control risk through a governed action",
    category: "control_surfaces"
  }),
  createPermission({
    key: "retrospective.read",
    description: "Read closed project snapshots and retrospective read models",
    category: "retrospectives"
  }),
  createPermission({
    key: "retrospective.write",
    description: "Write governed retrospective records",
    category: "retrospectives"
  }),
  createPermission({
    key: "retrospective.improvement.write",
    description: "Preview and execute governed template-improvement actions from retrospective insights",
    category: "retrospectives"
  }),
  createPermission({
    key: "schedule:read",
    description: "Open schedule and Gantt drilldowns from control surfaces",
    category: "scheduling"
  })
] satisfies Permission[];

function permission(key: string): Permission {
  const found = phase2PermissionCatalog.find((item) => item.key === key);
  if (!found) {
    throw new Error(`Unknown Phase 2 permission: ${key}`);
  }

  return found;
}

function scopeRule(permissionKey: string, scope: "tenant" | "all"): ScopeRule {
  return createScopeRule({ permissionKey, scope });
}

function createProfile(input: Phase2AccessProfileSeed): AccessProfile {
  const supplementalPermissionsByProfile: Record<string, string[]> = {
    tenant_admin: [
      "crm.opportunity.read",
      "crm.opportunity.write",
      "crm.readiness.run",
      "crm.template_match.run",
      "crm.feasibility.run",
      "audit.read",
      "tenant.config.read",
      "tenant.config.write",
      "tenant.config.export",
      "tenant.config.import",
      "custom_field.write",
      "project.template.write",
      "project_draft.read",
      "project_draft.create",
      "project.create_from_template",
      "project.read",
      "project.lifecycle.transition",
      "project.closure.read",
      "project.close",
      "project.artifact.write",
      "project.approval.write",
      "task.read",
      "task.write",
      "task.status.write",
      "task.comment.write",
      "resource.read",
      "resource.write",
      "kpi:read",
      "kpi.config:write",
      "kpi.evaluate:execute",
      "control.surface:read",
      "control.action:write",
      "risk:accept",
      "retrospective.read",
      "retrospective.write",
      "retrospective.improvement.write",
      "schedule:read"
    ],
    project_manager: [
      "crm.opportunity.read",
      "crm.opportunity.write",
      "crm.readiness.run",
      "crm.template_match.run",
      "crm.feasibility.run",
      "audit.read",
      "tenant.config.read",
      "custom_field.write",
      "project_draft.read",
      "project_draft.create",
      "project.create_from_template",
      "project.read",
      "project.lifecycle.transition",
      "project.closure.read",
      "project.close",
      "project.artifact.write",
      "project.approval.write",
      "task.read",
      "task.write",
      "task.status.write",
      "task.comment.write",
      "resource.read",
      "resource.write",
      "kpi:read",
      "kpi.evaluate:execute",
      "control.surface:read",
      "control.action:write",
      "retrospective.read",
      "retrospective.write",
      "retrospective.improvement.write",
      "schedule:read"
    ],
    resource_manager: [
      "crm.opportunity.read",
      "crm.readiness.run",
      "crm.template_match.run",
      "crm.feasibility.run",
      "project.read",
      "project.closure.read",
      "task.read",
      "resource.read",
      "resource.write",
      "audit.read",
      "tenant.config.read",
      "kpi:read",
      "kpi.evaluate:execute",
      "control.surface:read",
      "retrospective.read",
      "control.action:write",
      "schedule:read"
    ],
    executor: ["project.read", "task.read", "task.status.write", "task.comment.write"],
    readonly_observer: [
      "crm.opportunity.read",
      "project_draft.read",
      "project.read",
      "project.closure.read",
      "task.read",
      "resource.read",
      "kpi:read",
      "retrospective.read",
      "control.surface:read",
      "tenant.config.read"
    ],
    tenant_user: [
      "crm.opportunity.read",
      "project_draft.read",
      "project.read",
      "project.closure.read",
      "task.read",
      "resource.read",
      "kpi:read",
      "retrospective.read",
      "control.surface:read",
      "tenant.config.read"
    ]
  };
  const permissionKeys = [...new Set([...input.permissions, ...(supplementalPermissionsByProfile[input.systemKey] ?? [])])];

  return createAccessProfile({
    id: input.id,
    tenantId: input.tenantId,
    systemKey: input.systemKey,
    label: input.label,
    permissions: permissionKeys.map(permission),
    scopeRules: permissionKeys.map((permissionKey) => scopeRule(permissionKey, input.scope)),
    active: input.active,
    version: input.version,
    updatedAt: input.updatedAt
  });
}

function createLabelSet(seed: Phase2TenantLabelSeed): TenantLabelSet {
  return createTenantLabelSet({
    tenantId: seed.tenantId,
    configurationVersion: seed.configurationVersion,
    labels: { ...p10RuntimeLabelDefaults, ...seed.labels },
    updatedAt: seed.updatedAt
  });
}

function cloneProfile(profile: AccessProfile): AccessProfile {
  return createAccessProfile({
    id: profile.id,
    tenantId: profile.tenantId,
    systemKey: profile.systemKey,
    label: profile.label,
    permissions: profile.permissions.map(permission),
    scopeRules: profile.scopeRules.map((rule) =>
      createScopeRule({
        permissionKey: rule.permissionKey,
        scope: rule.scope,
        ...(rule.constraints ? { constraints: rule.constraints } : {})
      })
    ),
    active: profile.active,
    version: profile.version,
    updatedAt: profile.updatedAt
  });
}

function cloneLabelSet(labelSet: TenantLabelSet): TenantLabelSet {
  return createTenantLabelSet({
    tenantId: labelSet.tenantId,
    configurationVersion: labelSet.configurationVersion,
    labels: labelSet.labels,
    updatedAt: labelSet.updatedAt
  });
}

export function createPhase2RuntimeState() {
  const fixtureSeed = getPhase2FixtureSeed();
  const tenants = new Map<TenantId, Tenant>();
  const users = new Map<string, DemoTenantUser>();
  const probes = new Map<string, TenantIsolationProbe>();
  const profiles = new Map<TenantId, Map<string, AccessProfile>>();
  const labelSets = new Map<TenantId, TenantLabelSet>();
  const auditStore = createInMemoryAuditEventStore();
  let auditCounter = 0;

  for (const demoTenant of fixtureSeed.tenants) {
    tenants.set(demoTenant.id, {
      id: demoTenant.id,
      label: demoTenant.label,
      configurationVersion: demoTenant.configurationVersion
    });
    probes.set(demoTenant.isolationProbe.id, { ...demoTenant.isolationProbe });
    for (const user of demoTenant.users) {
      users.set(user.id, { ...user });
    }
  }

  for (const profileSeed of fixtureSeed.accessProfiles) {
    const tenantProfiles = profiles.get(profileSeed.tenantId) ?? new Map<string, AccessProfile>();
    const profile = createProfile(profileSeed);
    tenantProfiles.set(profile.id, profile);
    profiles.set(profileSeed.tenantId, tenantProfiles);
  }

  for (const labelSetSeed of fixtureSeed.labelSets) {
    labelSets.set(labelSetSeed.tenantId, createLabelSet(labelSetSeed));
  }

  function nextAuditId(): string {
    auditCounter += 1;
    return `audit-phase2-${auditCounter.toString().padStart(4, "0")}`;
  }

  return {
    tenants,
    users,
    probes,
    profiles,
    labelSets,
    auditStore,
    permissionCatalog: [...phase2PermissionCatalog],
    now: () => FIXED_TIMESTAMP,

    resolveSession(testUserId: string | undefined): Phase2RuntimeSession | undefined {
      if (!testUserId) return undefined;

      const user = users.get(testUserId);
      if (!user?.accessProfileId) return undefined;

      const tenant = tenants.get(user.tenantId);
      const tenantProfiles = profiles.get(user.tenantId);
      const profile = tenantProfiles?.get(user.accessProfileId);
      const labelSet = labelSets.get(user.tenantId);
      if (!tenant || !profile || !labelSet) return undefined;

      return {
        tenant: { ...tenant, configurationVersion: labelSet.configurationVersion },
        user: { ...user },
        profile: cloneProfile(profile),
        labelSet: cloneLabelSet(labelSet)
      };
    },

    listProfiles(tenantId: TenantId): AccessProfile[] {
      return [...(profiles.get(tenantId)?.values() ?? [])].map(cloneProfile);
    },

    getProfile(tenantId: TenantId, profileId: string): AccessProfile | undefined {
      const profile = profiles.get(tenantId)?.get(profileId);
      return profile ? cloneProfile(profile) : undefined;
    },

    saveProfile(profile: AccessProfile): AccessProfile {
      const tenantProfiles = profiles.get(profile.tenantId);
      if (!tenantProfiles) {
        throw new Error(`Unknown tenant for profile: ${profile.tenantId}`);
      }

      const storedProfile = cloneProfile(profile);
      tenantProfiles.set(storedProfile.id, storedProfile);
      return cloneProfile(storedProfile);
    },

    updateLabelSet(tenantId: TenantId, input: { key: string; label: string; expectedConfigurationVersion: number }) {
      const current = labelSets.get(tenantId);
      if (!current) {
        throw new Error(`Unknown tenant label set: ${tenantId}`);
      }

      const result = updateTenantLabel(current, {
        ...input,
        updatedAt: FIXED_TIMESTAMP
      });
      labelSets.set(tenantId, result.labelSet);
      return {
        labelSet: cloneLabelSet(result.labelSet),
        trace: result.trace
      };
    },

    replaceLabelSet(labelSet: TenantLabelSet): TenantLabelSet {
      if (!tenants.has(labelSet.tenantId)) {
        throw new Error(`Unknown tenant label set: ${labelSet.tenantId}`);
      }
      const stored = cloneLabelSet(labelSet);
      labelSets.set(labelSet.tenantId, stored);

      return cloneLabelSet(stored);
    },

    getProbe(probeId: string): TenantIsolationProbe | undefined {
      const probe = probes.get(probeId);
      return probe ? { ...probe } : undefined;
    },

    evaluatePolicy(input: {
      session: Phase2RuntimeSession;
      permissionKey: string;
      target: PolicyTargetRef;
      requestedScope?: string;
      contextRefs?: {
        projectIds?: string[];
      };
    }): PolicyEvaluation {
      return evaluatePolicy({
        actor: {
          tenantId: input.session.user.tenantId,
          actorId: input.session.user.id
        },
        profile: input.session.profile,
        permissionKey: input.permissionKey,
        target: input.target,
        ...(input.requestedScope !== undefined ? { requestedScope: input.requestedScope } : {}),
        ...(input.contextRefs !== undefined ? { contextRefs: input.contextRefs } : {})
      });
    },

    appendAuditEvent(input: {
      session: Phase2RuntimeSession;
      id?: string;
      actionKey: string;
      target: { entityType: string; entityId: string };
      correlationId?: CorrelationId;
      details?: AuditEvent["details"];
    }): AuditEvent {
      const auditId = input.id ?? nextAuditId();

      return auditStore.append(
        createAuditEvent({
          id: auditId,
          actor: createActorContext({
            tenantId: input.session.user.tenantId,
            actorId: input.session.user.id,
            accessProfileId: input.session.user.accessProfileId,
            correlationId: input.correlationId ?? `corr-${auditId}`
          }),
          actionKey: input.actionKey,
          target: createAuditTargetRef(input.target),
          result: "success",
          timestamp: FIXED_TIMESTAMP,
          ...(input.details !== undefined ? { details: input.details } : {})
        })
      );
    }
  };
}
