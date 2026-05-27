import { createTenantUser } from "@kiss-pm/domain";
import { describe, expect, it } from "vitest";

import type { EntityLookupDataPort } from "./apiDataPorts";
import type { ProjectRecord } from "./apiTypes";
import { resolveEntityAccessContext } from "./entityAccess";
import { tenantAdminProfile } from "./tenantAdminProfile";

describe("entity access module", () => {
  it("resolves project access and source metadata through one shared seam", async () => {
    const actor = createTenantUser({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна",
      accessProfileId: "profile-admin"
    });
    const dataSource: EntityLookupDataPort = {
      listProjects: async () => [projectRecord]
    };

    const result = await resolveEntityAccessContext({
      actor,
      dataSource,
      entityId: "project-alpha",
      entityType: "project",
      profile: tenantAdminProfile
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sourceEntity).toEqual({ type: "Project", id: "project-alpha" });
      expect(result.value.readDecision.allowed).toBe(true);
      expect(result.value.manageDecision.allowed).toBe(true);
    }
  });

  it("allows direct task participants to read task-scoped surfaces without project read", async () => {
    const actor = createTenantUser({
      id: "user-alpha-executor",
      tenantId: "tenant-alpha",
      name: "Егор",
      accessProfileId: "profile-limited"
    });
    const dataSource: EntityLookupDataPort = {
      findTaskById: async () => ({
        actualWork: 0,
        archivedAt: null,
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        description: null,
        durationWorkingDays: 1,
        id: "task-alpha",
        ownerUserId: "user-alpha-owner",
        participants: [{ role: "executor", userId: actor.id }],
        plannedFinish: new Date("2026-05-02T00:00:00.000Z"),
        plannedStart: new Date("2026-05-01T00:00:00.000Z"),
        plannedWork: 8,
        priority: "normal",
        progress: 0,
        projectId: "project-alpha",
        requesterUserId: "user-alpha-requester",
        requiresAcceptance: false,
        source: "manual",
        stageId: null,
        status: "new",
        statusCategory: "new",
        statusId: "task-status-todo",
        statusName: "К выполнению",
        tenantId: actor.tenantId,
        title: "Интервью заказчика",
        updatedAt: new Date("2026-05-01T00:00:00.000Z")
      })
    };

    const result = await resolveEntityAccessContext({
      actor,
      dataSource,
      entityId: "task-alpha",
      entityType: "task",
      profile: { id: "profile-limited", permissions: [] }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.readDecision.allowed).toBe(true);
      expect(result.value.manageDecision.allowed).toBe(false);
    }
  });
});

const projectRecord: ProjectRecord = {
  activatedAt: new Date("2026-05-01T00:00:00.000Z"),
  clientId: "client-alpha",
  clientName: "ООО Альфа",
  closedAt: null,
  contractValue: 100000,
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  demand: [],
  id: "project-alpha",
  plannedFinish: new Date("2026-05-30T00:00:00.000Z"),
  plannedHours: 40,
  plannedStart: new Date("2026-05-01T00:00:00.000Z"),
  projectTypeId: "project-type-implementation",
  sourceOpportunityId: "opportunity-alpha",
  sourceType: "opportunity",
  status: "active",
  templateId: null,
  tenantId: "tenant-alpha",
  title: "Внедрение KISS PM"
};
