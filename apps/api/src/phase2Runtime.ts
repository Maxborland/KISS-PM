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
import type { AuditEvent, Tenant, TenantId, TenantIsolationProbe } from "@kiss-pm/domain-core";
import { getDemoTenants } from "@kiss-pm/shared-test-fixtures";
import type { DemoTenantUser } from "@kiss-pm/shared-test-fixtures";
import {
  createTenantLabelSet,
  updateTenantLabel
} from "@kiss-pm/tenant-config";
import type { TenantLabelSet } from "@kiss-pm/tenant-config";

import { createInMemoryAuditEventStore } from "./auditLog";

export type Phase2PermissionKey =
  | "tenant.read"
  | "access_profile.read"
  | "access_profile.write"
  | "tenant_labels.write"
  | "permission.diagnostics.read"
  | "tenant_probe.read"
  | "audit.read";

export type Phase2RuntimeSession = {
  tenant: Tenant;
  user: DemoTenantUser;
  profile: AccessProfile;
  labelSet: TenantLabelSet;
};

export type Phase2RuntimeState = ReturnType<typeof createPhase2RuntimeState>;

const FIXED_TIMESTAMP = "2026-05-14T00:00:00.000Z";

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
  })
] satisfies Permission[];

function permission(key: string): Permission {
  const found = phase2PermissionCatalog.find((item) => item.key === key);
  if (!found) {
    throw new Error(`Unknown Phase 2 permission: ${key}`);
  }

  return found;
}

function scopeRule(permissionKey: Phase2PermissionKey, scope: "tenant" | "all"): ScopeRule {
  return createScopeRule({ permissionKey, scope });
}

function createProfile(input: {
  id: string;
  tenantId: TenantId;
  systemKey: string;
  label: string;
  permissions: Phase2PermissionKey[];
  scope: "tenant" | "all";
  active?: boolean;
  version?: number;
  updatedAt?: string;
}): AccessProfile {
  return createAccessProfile({
    id: input.id,
    tenantId: input.tenantId,
    systemKey: input.systemKey,
    label: input.label,
    permissions: input.permissions.map(permission),
    scopeRules: input.permissions.map((permissionKey) => scopeRule(permissionKey, input.scope)),
    active: input.active ?? true,
    version: input.version ?? 1,
    updatedAt: input.updatedAt ?? FIXED_TIMESTAMP
  });
}

function createProfilesForTenantA(): AccessProfile[] {
  return [
    createProfile({
      id: "profile-tenant-admin-a",
      tenantId: "tenant-a",
      systemKey: "tenant_admin",
      label: "Администратор тенанта",
      permissions: [
        "tenant.read",
        "access_profile.read",
        "access_profile.write",
        "tenant_labels.write",
        "permission.diagnostics.read",
        "tenant_probe.read",
        "audit.read"
      ],
      scope: "all"
    }),
    createProfile({
      id: "profile-project-manager-a",
      tenantId: "tenant-a",
      systemKey: "project_manager",
      label: "Руководитель проекта",
      permissions: ["tenant.read", "permission.diagnostics.read", "tenant_probe.read"],
      scope: "tenant"
    }),
    createProfile({
      id: "profile-resource-manager-a",
      tenantId: "tenant-a",
      systemKey: "resource_manager",
      label: "Ресурсный менеджер",
      permissions: ["tenant.read", "permission.diagnostics.read", "tenant_probe.read"],
      scope: "tenant"
    }),
    createProfile({
      id: "profile-executor-a",
      tenantId: "tenant-a",
      systemKey: "executor",
      label: "Исполнитель",
      permissions: ["tenant.read", "tenant_probe.read"],
      scope: "tenant"
    }),
    createProfile({
      id: "profile-readonly-observer-a",
      tenantId: "tenant-a",
      systemKey: "readonly_observer",
      label: "Наблюдатель",
      permissions: ["tenant.read", "tenant_probe.read", "audit.read"],
      scope: "tenant"
    })
  ];
}

function createProfilesForTenantB(): AccessProfile[] {
  return [
    createProfile({
      id: "profile-tenant-admin-b",
      tenantId: "tenant-b",
      systemKey: "tenant_admin",
      label: "Администратор тенанта B",
      permissions: [
        "tenant.read",
        "access_profile.read",
        "access_profile.write",
        "tenant_labels.write",
        "permission.diagnostics.read",
        "tenant_probe.read",
        "audit.read"
      ],
      scope: "all"
    }),
    createProfile({
      id: "profile-tenant-user-b",
      tenantId: "tenant-b",
      systemKey: "tenant_user",
      label: "Пользователь тенанта B",
      permissions: ["tenant.read", "tenant_probe.read"],
      scope: "tenant"
    })
  ];
}

function createLabelSet(tenantId: TenantId, labels: Record<string, string>): TenantLabelSet {
  return createTenantLabelSet({
    tenantId,
    configurationVersion: 1,
    labels,
    updatedAt: FIXED_TIMESTAMP
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
  const tenants = new Map<TenantId, Tenant>();
  const users = new Map<string, DemoTenantUser>();
  const probes = new Map<string, TenantIsolationProbe>();
  const profiles = new Map<TenantId, Map<string, AccessProfile>>();
  const labelSets = new Map<TenantId, TenantLabelSet>();
  const auditStore = createInMemoryAuditEventStore();
  let auditCounter = 0;

  for (const demoTenant of getDemoTenants()) {
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

  profiles.set(
    "tenant-a",
    new Map(createProfilesForTenantA().map((profile) => [profile.id, profile]))
  );
  profiles.set(
    "tenant-b",
    new Map(createProfilesForTenantB().map((profile) => [profile.id, profile]))
  );

  labelSets.set(
    "tenant-a",
    createLabelSet("tenant-a", {
      "navigation.admin": "Администрирование",
      "navigation.audit": "Журнал действий",
      "role.tenant_admin": "Администратор",
      "role.project_manager": "Руководитель проекта",
      "role.resource_manager": "Ресурсный менеджер",
      "role.executor": "Исполнитель",
      "role.readonly_observer": "Наблюдатель"
    })
  );
  labelSets.set(
    "tenant-b",
    createLabelSet("tenant-b", {
      "navigation.admin": "Администрирование B",
      "navigation.audit": "Журнал действий B",
      "role.tenant_admin": "Администратор B",
      "role.tenant_user": "Пользователь B"
    })
  );

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
            correlationId: `corr-${auditId}`
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
