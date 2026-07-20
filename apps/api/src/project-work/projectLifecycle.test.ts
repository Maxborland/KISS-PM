import { createAccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import { describe, expect, it } from "vitest";

import { ensureCompleteDataSource } from "../dataSourceCompletion";
import { tenantAdminProfile } from "../tenantAdminProfile";
import type {
  ManagementAuditEventInput,
  ProjectRecord
} from "../apiTypes";
import {
  createManualProject,
  transitionProjectStatus,
  updateProjectSettings,
  type ProjectLifecycleDeps
} from "./projectLifecycle";
import type { CreateManualProjectFields } from "./projectLifecycleParsers";

const actor: TenantUser = {
  id: "user-admin",
  tenantId: "tenant-alpha",
  name: "Анна Администратор",
  accessProfileId: "tenant-admin"
};

const restrictedProfile = createAccessProfile({
  id: "restricted",
  permissions: ["tenant.projects.read"]
});

const baseProject = (overrides: Partial<ProjectRecord> = {}): ProjectRecord => ({
  id: "project-alpha",
  tenantId: "tenant-alpha",
  sourceType: "manual",
  sourceOpportunityId: null,
  clientId: null,
  projectTypeId: "project-type-alpha",
  title: "Внутренний проект",
  clientName: "Внутренний проект",
  status: "active",
  plannedStart: new Date("2026-06-01T00:00:00.000Z"),
  plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
  contractValue: 0,
  plannedHours: 0,
  templateId: null,
  createdAt: new Date("2026-05-20T00:00:00.000Z"),
  activatedAt: new Date("2026-05-20T00:00:00.000Z"),
  closedAt: null,
  demand: [],
  ...overrides
});

const createFields: CreateManualProjectFields = {
  id: "project-manual",
  title: "Внутренний R&D",
  clientName: "Внутренний проект",
  projectTypeId: "project-type-alpha",
  templateId: null,
  calendarId: null,
  plannedStart: new Date("2026-07-01T00:00:00.000Z"),
  plannedFinish: new Date("2026-07-31T00:00:00.000Z"),
  contractValue: 0,
  plannedHours: 0
};

type MockStore = {
  projects: ProjectRecord[];
  audits: ManagementAuditEventInput[];
};

function makeDeps(
  store: MockStore,
  options?: { profile?: ReturnType<typeof createAccessProfile> }
): ProjectLifecycleDeps {
  const dataSource = ensureCompleteDataSource({
    async withTransaction(operation) {
      return operation({} as never);
    },
    async appendAuditEvent() {
      return undefined;
    },
    async findProjectById(tenantId, projectId) {
      return store.projects.find(
        (project) => project.tenantId === tenantId && project.id === projectId
      );
    },
    async createManualProject(input) {
      const created = baseProject({
        id: input.id,
        title: input.title,
        clientName: input.clientName,
        projectTypeId: input.projectTypeId,
        templateId: input.templateId,
        plannedStart: input.plannedStart,
        plannedFinish: input.plannedFinish,
        contractValue: input.contractValue,
        plannedHours: input.plannedHours,
        demand: input.demand
      });
      store.projects.push(created);
      return created;
    },
    async updateProjectSettings(input) {
      const project = store.projects.find(
        (candidate) => candidate.tenantId === input.tenantId && candidate.id === input.projectId
      );
      if (!project) return undefined;
      if (input.title !== undefined) project.title = input.title;
      if (input.projectTypeId !== undefined) project.projectTypeId = input.projectTypeId;
      if (input.templateId !== undefined) project.templateId = input.templateId;
      return project;
    },
    async updateProjectStatus(input) {
      const project = store.projects.find(
        (candidate) => candidate.tenantId === input.tenantId && candidate.id === input.projectId
      );
      if (!project) return undefined;
      if (!input.expectedStatuses.includes(project.status)) return undefined;
      project.status = input.status;
      project.closedAt = input.status === "closed" ? new Date() : null;
      return project;
    }
  });

  return {
    dataSource,
    async getActorProfile() {
      return options?.profile ?? tenantAdminProfile;
    },
    async runDataSourceTransaction(operation) {
      return operation(dataSource);
    },
    async appendManagementAuditEvent(input) {
      store.audits.push(input);
      return input.auditEventId ?? "audit-management";
    }
  };
}

describe("project lifecycle service", () => {
  it("creates a manual project without an opportunity and audits it", async () => {
    const store: MockStore = { projects: [], audits: [] };
    const deps = makeDeps(store);

    const result = await createManualProject(deps, { actor, fields: createFields });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe(201);
    expect(result.project.sourceType).toBe("manual");
    expect(result.project.sourceOpportunityId).toBeNull();
    expect(result.project.status).toBe("active");
    expect(store.audits.map((event) => event.actionType)).toContain("project.created");
  });

  it("denies creation without projects.manage and records a denied audit", async () => {
    const store: MockStore = { projects: [], audits: [] };
    const deps = makeDeps(store, { profile: restrictedProfile });

    const result = await createManualProject(deps, { actor, fields: createFields });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
    expect(store.projects).toHaveLength(0);
    expect(store.audits.map((event) => event.actionType)).toContain("project.created_denied");
  });

  it("updates editable project settings", async () => {
    const store: MockStore = { projects: [baseProject()], audits: [] };
    const deps = makeDeps(store);

    const result = await updateProjectSettings(deps, {
      actor,
      projectId: "project-alpha",
      fields: { title: "Переименованный проект", templateId: "template-beta" }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.title).toBe("Переименованный проект");
    expect(result.project.templateId).toBe("template-beta");
    expect(store.audits.map((event) => event.actionType)).toContain("project.settings_updated");
  });

  it("returns 404 when updating a missing project", async () => {
    const store: MockStore = { projects: [], audits: [] };
    const deps = makeDeps(store);

    const result = await updateProjectSettings(deps, {
      actor,
      projectId: "project-missing",
      fields: { title: "Ghost" }
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });

  it("reopens a closed project (reverts an erroneous closure)", async () => {
    const store: MockStore = {
      projects: [baseProject({ status: "closed", closedAt: new Date() })],
      audits: []
    };
    const deps = makeDeps(store);

    const result = await transitionProjectStatus(deps, {
      actor,
      projectId: "project-alpha",
      action: "reopen"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.status).toBe("active");
    expect(result.project.closedAt).toBeNull();
    expect(store.audits.map((event) => event.actionType)).toContain("project.reopened");
  });

  it("pauses an active project and resumes a paused one", async () => {
    const store: MockStore = { projects: [baseProject({ status: "active" })], audits: [] };
    const deps = makeDeps(store);

    const paused = await transitionProjectStatus(deps, {
      actor,
      projectId: "project-alpha",
      action: "pause"
    });
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(paused.project.status).toBe("paused");

    const resumed = await transitionProjectStatus(deps, {
      actor,
      projectId: "project-alpha",
      action: "resume"
    });
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.project.status).toBe("active");
  });

  it("rejects an illegal transition (pause on a closed project)", async () => {
    const store: MockStore = { projects: [baseProject({ status: "closed" })], audits: [] };
    const deps = makeDeps(store);

    const result = await transitionProjectStatus(deps, {
      actor,
      projectId: "project-alpha",
      action: "pause"
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(result.error).toBe("project_status_transition_not_allowed");
  });
});
