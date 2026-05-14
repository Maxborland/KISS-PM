import { getDemoTenants } from "./demoTenants";
import type { DemoTenant } from "./demoTenants";

export const PHASE2_FIXTURE_TIMESTAMP = "2026-05-14T00:00:00.000Z";

export type Phase2PermissionKey =
  | "tenant.read"
  | "access_profile.read"
  | "access_profile.write"
  | "tenant_labels.write"
  | "permission.diagnostics.read"
  | "tenant_probe.read"
  | "audit.read";

export type Phase2AccessProfileSeed = {
  id: string;
  tenantId: string;
  systemKey: string;
  label: string;
  permissions: Phase2PermissionKey[];
  scope: "tenant" | "all";
  active: boolean;
  version: number;
  updatedAt: string;
};

export type Phase2TenantLabelSeed = {
  tenantId: string;
  configurationVersion: number;
  labels: Record<string, string>;
  updatedAt: string;
};

export type Phase2FixtureSeed = {
  generatedAt: string;
  tenants: DemoTenant[];
  accessProfiles: Phase2AccessProfileSeed[];
  labelSets: Phase2TenantLabelSeed[];
  auditEvents: [];
};

const accessProfiles: Phase2AccessProfileSeed[] = [
  {
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
    scope: "all",
    active: true,
    version: 1,
    updatedAt: PHASE2_FIXTURE_TIMESTAMP
  },
  {
    id: "profile-project-manager-a",
    tenantId: "tenant-a",
    systemKey: "project_manager",
    label: "Руководитель проекта",
    permissions: ["tenant.read", "permission.diagnostics.read", "tenant_probe.read"],
    scope: "tenant",
    active: true,
    version: 1,
    updatedAt: PHASE2_FIXTURE_TIMESTAMP
  },
  {
    id: "profile-resource-manager-a",
    tenantId: "tenant-a",
    systemKey: "resource_manager",
    label: "Ресурсный менеджер",
    permissions: ["tenant.read", "permission.diagnostics.read", "tenant_probe.read"],
    scope: "tenant",
    active: true,
    version: 1,
    updatedAt: PHASE2_FIXTURE_TIMESTAMP
  },
  {
    id: "profile-executor-a",
    tenantId: "tenant-a",
    systemKey: "executor",
    label: "Исполнитель",
    permissions: ["tenant.read", "tenant_probe.read"],
    scope: "tenant",
    active: true,
    version: 1,
    updatedAt: PHASE2_FIXTURE_TIMESTAMP
  },
  {
    id: "profile-readonly-observer-a",
    tenantId: "tenant-a",
    systemKey: "readonly_observer",
    label: "Наблюдатель",
    permissions: ["tenant.read", "tenant_probe.read", "audit.read"],
    scope: "tenant",
    active: true,
    version: 1,
    updatedAt: PHASE2_FIXTURE_TIMESTAMP
  },
  {
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
    scope: "all",
    active: true,
    version: 1,
    updatedAt: PHASE2_FIXTURE_TIMESTAMP
  },
  {
    id: "profile-tenant-user-b",
    tenantId: "tenant-b",
    systemKey: "tenant_user",
    label: "Пользователь тенанта B",
    permissions: ["tenant.read", "tenant_probe.read"],
    scope: "tenant",
    active: true,
    version: 1,
    updatedAt: PHASE2_FIXTURE_TIMESTAMP
  }
];

const labelSets: Phase2TenantLabelSeed[] = [
  {
    tenantId: "tenant-a",
    configurationVersion: 1,
    labels: {
      "navigation.admin": "Администрирование",
      "navigation.audit": "Журнал действий",
      "role.tenant_admin": "Администратор",
      "role.project_manager": "Руководитель проекта",
      "role.resource_manager": "Ресурсный менеджер",
      "role.executor": "Исполнитель",
      "role.readonly_observer": "Наблюдатель"
    },
    updatedAt: PHASE2_FIXTURE_TIMESTAMP
  },
  {
    tenantId: "tenant-b",
    configurationVersion: 1,
    labels: {
      "navigation.admin": "Администрирование B",
      "navigation.audit": "Журнал действий B",
      "role.tenant_admin": "Администратор B",
      "role.tenant_user": "Пользователь B"
    },
    updatedAt: PHASE2_FIXTURE_TIMESTAMP
  }
];

function cloneAccessProfile(profile: Phase2AccessProfileSeed): Phase2AccessProfileSeed {
  return {
    ...profile,
    permissions: [...profile.permissions]
  };
}

function cloneLabelSet(labelSet: Phase2TenantLabelSeed): Phase2TenantLabelSeed {
  return {
    ...labelSet,
    labels: { ...labelSet.labels }
  };
}

export function getPhase2FixtureSeed(): Phase2FixtureSeed {
  return {
    generatedAt: PHASE2_FIXTURE_TIMESTAMP,
    tenants: getDemoTenants(),
    accessProfiles: accessProfiles.map(cloneAccessProfile),
    labelSets: labelSets.map(cloneLabelSet),
    auditEvents: []
  };
}

export function getPhase2ProbePairForTenant(tenantId: string): { ownProbeId: string; foreignProbeId: string } {
  const probes = getDemoTenants().map((tenant) => ({
    tenantId: tenant.id,
    probeId: tenant.isolationProbe.id
  }));
  const ownProbe = probes.find((probe) => probe.tenantId === tenantId);
  const foreignProbe = probes.find((probe) => probe.tenantId !== tenantId);

  if (!ownProbe || !foreignProbe) {
    throw new Error(`No deterministic Phase 2 probe pair for tenant: ${tenantId}`);
  }

  return {
    ownProbeId: ownProbe.probeId,
    foreignProbeId: foreignProbe.probeId
  };
}
