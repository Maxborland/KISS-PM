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
      "project_draft.read",
      "project_draft.create"
    ],
    project_manager: [
      "crm.opportunity.read",
      "crm.opportunity.write",
      "crm.readiness.run",
      "crm.template_match.run",
      "crm.feasibility.run",
      "audit.read",
      "project_draft.read",
      "project_draft.create"
    ],
    resource_manager: [
      "crm.opportunity.read",
      "crm.readiness.run",
      "crm.template_match.run",
      "crm.feasibility.run"
    ],
    readonly_observer: ["crm.opportunity.read", "project_draft.read"],
    tenant_user: ["crm.opportunity.read", "project_draft.read"]
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
    labels: seed.labels,
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

    getProbe(probeId: string): TenantIsolationProbe | undefined {
      const probe = probes.get(probeId);
      return probe ? { ...probe } : undefined;
    },

    evaluatePolicy(input: {
      session: Phase2RuntimeSession;
      permissionKey: string;
      target: PolicyTargetRef;
      requestedScope?: string;
    }): PolicyEvaluation {
      return evaluatePolicy({
        actor: {
          tenantId: input.session.user.tenantId,
          actorId: input.session.user.id
        },
        profile: input.session.profile,
        permissionKey: input.permissionKey,
        target: input.target,
        ...(input.requestedScope !== undefined ? { requestedScope: input.requestedScope } : {})
      });
    },

    appendAuditEvent(input: {
      session: Phase2RuntimeSession;
      actionKey: string;
      target: { entityType: string; entityId: string };
      correlationId?: CorrelationId;
      details?: AuditEvent["details"];
    }): AuditEvent {
      const auditId = nextAuditId();

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
