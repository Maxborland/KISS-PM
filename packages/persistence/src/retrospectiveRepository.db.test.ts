import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type {
  ProjectClosureSnapshot,
  RetrospectiveLesson,
  TemplateImprovementAction
} from "@kiss-pm/domain";

import {
  createDatabase,
  createPostgresClient,
  type PostgresClient
} from "./index";
import { createRetrospectiveRepository } from "./retrospectiveRepository";
import { projectClosureSnapshots, projects } from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

describe("retrospective repository", () => {
  let client: PostgresClient;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
  });

  beforeEach(async () => {
    await truncateRetrospectiveDb(client);
    await seedBaseRows(client);
  });

  afterAll(async () => {
    await truncateRetrospectiveDb(client);
    await client.end();
  });

  it("closes a project once with immutable snapshot, lessons and template improvement action", async () => {
    const repository = createRetrospectiveRepository(createDatabase(client));
    const closedAt = new Date("2026-05-25T09:00:00.000Z");
    const readModel = await repository.closeProject({
      snapshot: createSnapshot({ closedAt }),
      lessons: [createLesson({ createdAt: closedAt })],
      templateImprovementActions: [createTemplateImprovementAction({ createdAt: closedAt })]
    });

    expect(readModel.snapshot).toMatchObject({
      id: "closure-alpha",
      projectId: "project-alpha",
      planVersion: 4,
      auditEventId: "audit-close-alpha"
    });
    expect(readModel.lessons).toHaveLength(1);
    expect(readModel.templateImprovementActions).toHaveLength(1);

    const db = createDatabase(client);
    const [project] = await db.select().from(projects);
    expect(project?.status).toBe("closed");
    expect(project?.closedAt?.toISOString()).toBe(closedAt.toISOString());
    await expect(
      repository.closeProject({
        snapshot: createSnapshot({ id: "closure-alpha-2", closedAt }),
        lessons: [],
        templateImprovementActions: []
      })
    ).rejects.toThrow("project_not_closable");

    const snapshots = await db.select().from(projectClosureSnapshots);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.snapshotPayload).toEqual({
      project: { id: "project-alpha" },
      tasks: []
    });
  });

  it("applies template improvement as a governed one-way action", async () => {
    const repository = createRetrospectiveRepository(createDatabase(client));
    const closedAt = new Date("2026-05-25T09:00:00.000Z");
    await repository.closeProject({
      snapshot: createSnapshot({ closedAt }),
      lessons: [],
      templateImprovementActions: [createTemplateImprovementAction({ createdAt: closedAt })]
    });

    const applied = await repository.applyTemplateImprovementAction({
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      actionId: "template-improvement-alpha",
      actorUserId: "user-alpha-admin",
      auditEventId: "audit-apply-alpha",
      appliedAt: new Date("2026-05-25T10:00:00.000Z")
    });
    const secondApply = await repository.applyTemplateImprovementAction({
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      actionId: "template-improvement-alpha",
      actorUserId: "user-alpha-admin",
      auditEventId: "audit-apply-alpha-2",
      appliedAt: new Date("2026-05-25T10:10:00.000Z")
    });

    expect(applied).toMatchObject({
      id: "template-improvement-alpha",
      status: "applied",
      auditEventId: "audit-apply-alpha",
      appliedByUserId: "user-alpha-admin"
    });
    expect(secondApply).toBeUndefined();
    await expect(
      repository.listTemplateImprovementActions({
        tenantId: "tenant-alpha",
        templateId: "template-alpha",
        status: "applied"
      })
    ).resolves.toEqual([applied]);
    await expect(
      repository.listTemplateImprovementActions({
        tenantId: "tenant-beta",
        templateId: "template-alpha",
        status: "applied"
      })
    ).resolves.toEqual([]);
  });

  it("rejects lessons for snapshots outside the requested tenant/project", async () => {
    const repository = createRetrospectiveRepository(createDatabase(client));
    const closedAt = new Date("2026-05-25T09:00:00.000Z");
    await repository.closeProject({
      snapshot: createSnapshot({ closedAt }),
      lessons: [],
      templateImprovementActions: []
    });

    await expect(
      repository.addRetrospectiveLesson({
        ...createLesson({ createdAt: closedAt }),
        id: "lesson-wrong-project",
        projectId: "project-missing"
      })
    ).rejects.toThrow("closure_snapshot_not_found");
    await expect(
      repository.addRetrospectiveLesson({
        ...createLesson({ createdAt: closedAt }),
        id: "lesson-wrong-tenant",
        tenantId: "tenant-beta"
      })
    ).rejects.toThrow("closure_snapshot_not_found");
  });
});

async function truncateRetrospectiveDb(client: PostgresClient) {
  await client`TRUNCATE template_improvement_actions, retrospective_lessons, project_closure_snapshots, projects, project_templates, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, access_profiles, tenants RESTART IDENTITY CASCADE`;
}

async function seedBaseRows(client: PostgresClient) {
  await client`
    INSERT INTO tenants (id, name, created_at)
    VALUES ('tenant-alpha', 'Альфа', now()), ('tenant-beta', 'Бета', now())
  `;
  await client`
    INSERT INTO access_profiles (id, tenant_id, name, permissions, created_at)
    VALUES
      ('profile-alpha', 'tenant-alpha', 'Администратор', '[]'::jsonb, now()),
      ('profile-beta', 'tenant-beta', 'Администратор', '[]'::jsonb, now())
  `;
  await client`
    INSERT INTO tenant_users (id, tenant_id, access_profile_id, email, name, created_at)
    VALUES
      ('user-alpha-admin', 'tenant-alpha', 'profile-alpha', 'admin@alpha.local', 'Анна', now()),
      ('user-beta-admin', 'tenant-beta', 'profile-beta', 'admin@beta.local', 'Борис', now())
  `;
  await client`
    INSERT INTO project_templates (id, tenant_id, system_key, tenant_label, description, status, created_at, updated_at)
    VALUES ('template-alpha', 'tenant-alpha', 'implementation', 'Внедрение', null, 'active', now(), now())
  `;
  await client`
    INSERT INTO projects (
      id, tenant_id, source_type, source_opportunity_id, client_id, project_type_id,
      title, client_name, status, planned_start, planned_finish, contract_value,
      planned_hours, template_id, created_at, activated_at
    )
    VALUES (
      'project-alpha', 'tenant-alpha', 'manual', null, null, null,
      'Проект Альфа', 'Internal', 'active',
      '2026-05-01T00:00:00.000Z', '2026-05-15T00:00:00.000Z',
      0, 80, 'template-alpha', now(), now()
    )
  `;
}

function createSnapshot(input: {
  id?: string;
  closedAt: Date;
}): Omit<ProjectClosureSnapshot, "closedAt"> & { closedAt: Date } {
  return {
    id: input.id ?? "closure-alpha",
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    projectStatusBefore: "active",
    planVersion: 4,
    snapshotPayload: {
      project: { id: "project-alpha" },
      tasks: []
    },
    planFactSummary: {
      planVersion: 4,
      plannedStart: "2026-05-01",
      plannedFinish: "2026-05-15",
      actualStart: "2026-05-01",
      actualFinish: "2026-05-14",
      plannedWorkMinutes: 4800,
      actualWorkMinutes: 5100,
      workVarianceMinutes: 300,
      scheduleVarianceDays: -1,
      taskCount: 2,
      completedTaskCount: 2,
      openTaskCount: 0,
      baselineId: null
    },
    closedByUserId: "user-alpha-admin",
    closedAt: input.closedAt,
    closeReason: "Работы приняты заказчиком",
    auditEventId: "audit-close-alpha"
  };
}

function createLesson(input: {
  createdAt: Date;
}): Omit<RetrospectiveLesson, "createdAt"> & { createdAt: Date } {
  return {
    id: "lesson-alpha",
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    snapshotId: "closure-alpha",
    category: "schedule",
    title: "Раньше подключать архитектора",
    body: "Архитектурная оценка сократила бы переделки.",
    impact: "negative",
    createdByUserId: "user-alpha-admin",
    createdAt: input.createdAt
  };
}

function createTemplateImprovementAction(input: {
  createdAt: Date;
}): Omit<TemplateImprovementAction, "createdAt" | "appliedAt"> & {
  createdAt: Date;
  appliedAt: Date | null;
} {
  return {
    id: "template-improvement-alpha",
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    snapshotId: "closure-alpha",
    templateId: "template-alpha",
    status: "proposed",
    title: "Уточнить оценку внедрения",
    description: "Добавить 300 минут на архитектурную проверку.",
    impact: {
      plannedWorkDeltaMinutes: 300,
      plannedDurationDeltaDays: -1,
      confidence: "high",
      sourceMetric: "closure_plan_fact"
    },
    createdByUserId: "user-alpha-admin",
    appliedByUserId: null,
    createdAt: input.createdAt,
    appliedAt: null,
    auditEventId: null
  };
}
