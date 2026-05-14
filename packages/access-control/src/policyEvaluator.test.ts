import { describe, expect, it } from "vitest";

import {
  type AccessProfile,
  createAccessProfile,
  createPermission,
  createScopeRule,
  evaluatePolicy
} from "./index";

const tenantRead = createPermission({
  key: "tenant.read",
  description: "Read current tenant",
  category: "tenant_administration"
});
const taskRead = createPermission({
  key: "task.read",
  description: "Read task",
  category: "task"
});
const projectRead = createPermission({
  key: "project.read",
  description: "Read project",
  category: "project"
});
const probeRead = createPermission({
  key: "tenant_probe.read",
  description: "Read tenant isolation probe",
  category: "tenant_administration"
});

function makeProfile() {
  return createAccessProfile({
    id: "profile-project-manager-a",
    tenantId: "tenant-a",
    systemKey: "project_manager",
    label: "Руководитель проекта",
    permissions: [tenantRead, taskRead, projectRead, probeRead],
    scopeRules: [
      createScopeRule({ permissionKey: "tenant.read", scope: "tenant" }),
      createScopeRule({ permissionKey: "task.read", scope: "own" }),
      createScopeRule({ permissionKey: "project.read", scope: "project" }),
      createScopeRule({ permissionKey: "tenant_probe.read", scope: "all" })
    ],
    active: true,
    version: 1,
    updatedAt: "2026-05-14T12:50:00+07:00"
  });
}

describe("policy evaluator", () => {
  it("allows a tenant-scoped permission inside the active tenant with trace output", () => {
    const evaluation = evaluatePolicy({
      actor: { tenantId: "tenant-a", actorId: "project-manager-a" },
      profile: makeProfile(),
      permissionKey: "tenant.read",
      target: { entityType: "tenant", tenantId: "tenant-a" }
    });

    expect(evaluation).toEqual({
      allowed: true,
      reasonCode: "allowed",
      scope: "tenant",
      trace: [
        "policy:start tenant=tenant-a actor=project-manager-a permission=tenant.read targetType=tenant",
        "policy:tenant_match",
        "policy:profile_active version=1",
        "policy:permission_present",
        "policy:scope_rule scope=tenant",
        "policy:allowed scope=tenant"
      ]
    });
  });

  it("denies missing permissions without falling through to scope rules", () => {
    const evaluation = evaluatePolicy({
      actor: { tenantId: "tenant-a", actorId: "project-manager-a" },
      profile: makeProfile(),
      permissionKey: "tenant.write",
      target: { entityType: "tenant", tenantId: "tenant-a" }
    });

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reasonCode).toBe("permission_missing");
    expect(evaluation.trace).toContain("policy:permission_missing");
    expect(evaluation.trace.some((entry) => entry.startsWith("policy:scope_rule"))).toBe(false);
  });

  it("denies tenant mismatch before exposing target identity", () => {
    const evaluation = evaluatePolicy({
      actor: { tenantId: "tenant-a", actorId: "project-manager-a" },
      profile: makeProfile(),
      permissionKey: "tenant_probe.read",
      target: {
        entityType: "tenantIsolationProbe",
        entityId: "probe-b-private",
        tenantId: "tenant-b"
      }
    });

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reasonCode).toBe("tenant_mismatch");
    expect(evaluation.trace).toContain("policy:tenant_mismatch");
    expect(evaluation.trace.join(" ")).not.toContain("probe-b-private");
  });

  it("evaluates own, project, tenant, and all scopes deterministically", () => {
    const profile = makeProfile();
    const actor = { tenantId: "tenant-a", actorId: "project-manager-a" };

    expect(
      evaluatePolicy({
        actor,
        profile,
        permissionKey: "task.read",
        target: {
          entityType: "task",
          entityId: "task-owned",
          tenantId: "tenant-a",
          ownerId: "project-manager-a"
        }
      })
    ).toMatchObject({ allowed: true, reasonCode: "allowed", scope: "own" });

    expect(
      evaluatePolicy({
        actor,
        profile,
        permissionKey: "project.read",
        target: {
          entityType: "project",
          entityId: "project-a",
          tenantId: "tenant-a",
          projectId: "project-a"
        },
        contextRefs: { projectIds: ["project-a"] }
      })
    ).toMatchObject({ allowed: true, reasonCode: "allowed", scope: "project" });

    expect(
      evaluatePolicy({
        actor,
        profile,
        permissionKey: "tenant_probe.read",
        target: { entityType: "tenantIsolationProbe", tenantId: "tenant-a" }
      })
    ).toMatchObject({ allowed: true, reasonCode: "allowed", scope: "all" });
  });

  it("denies own and project scopes when ownership or project context does not match", () => {
    const profile = makeProfile();
    const actor = { tenantId: "tenant-a", actorId: "project-manager-a" };

    expect(
      evaluatePolicy({
        actor,
        profile,
        permissionKey: "task.read",
        target: {
          entityType: "task",
          tenantId: "tenant-a",
          ownerId: "other-user-a"
        }
      })
    ).toMatchObject({ allowed: false, reasonCode: "owner_mismatch", scope: "own" });

    expect(
      evaluatePolicy({
        actor,
        profile,
        permissionKey: "project.read",
        target: {
          entityType: "project",
          tenantId: "tenant-a",
          projectId: "project-b"
        },
        contextRefs: { projectIds: ["project-a"] }
      })
    ).toMatchObject({ allowed: false, reasonCode: "project_scope_mismatch", scope: "project" });
  });

  it("denies unsupported requested scopes instead of throwing", () => {
    const evaluation = evaluatePolicy({
      actor: { tenantId: "tenant-a", actorId: "project-manager-a" },
      profile: makeProfile(),
      permissionKey: "tenant.read",
      requestedScope: "department",
      target: { entityType: "tenant", tenantId: "tenant-a" }
    });

    expect(evaluation).toMatchObject({
      allowed: false,
      reasonCode: "unsupported_scope",
      scope: "department"
    });
    expect(evaluation.trace).toContain("policy:unsupported_scope scope=department");
  });

  it("denies unsupported stored scope rules instead of treating them as project scope", () => {
    const profileWithRawScope: AccessProfile = {
      ...makeProfile(),
      scopeRules: [{ permissionKey: "project.read", scope: "team" as never }]
    };

    const evaluation = evaluatePolicy({
      actor: { tenantId: "tenant-a", actorId: "project-manager-a" },
      profile: profileWithRawScope,
      permissionKey: "project.read",
      target: {
        entityType: "project",
        tenantId: "tenant-a",
        projectId: "project-a"
      },
      contextRefs: { projectIds: ["project-a"] }
    });

    expect(evaluation).toMatchObject({
      allowed: false,
      reasonCode: "unsupported_scope",
      scope: "team"
    });
    expect(evaluation.trace).toContain("policy:unsupported_scope scope=team");
  });

  it("denies inactive profiles and requested scopes that are not granted", () => {
    const inactiveProfile = {
      ...makeProfile(),
      active: false
    };

    expect(
      evaluatePolicy({
        actor: { tenantId: "tenant-a", actorId: "project-manager-a" },
        profile: inactiveProfile,
        permissionKey: "tenant.read",
        target: { entityType: "tenant", tenantId: "tenant-a" }
      })
    ).toMatchObject({ allowed: false, reasonCode: "profile_inactive" });

    expect(
      evaluatePolicy({
        actor: { tenantId: "tenant-a", actorId: "project-manager-a" },
        profile: makeProfile(),
        permissionKey: "tenant.read",
        requestedScope: "own",
        target: { entityType: "tenant", tenantId: "tenant-a" }
      })
    ).toMatchObject({ allowed: false, reasonCode: "scope_not_granted" });
  });
});
