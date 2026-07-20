import { ensureCompleteDataSource } from "./dataSourceCompletion";
import type { AccessProfile } from "@kiss-pm/access-control";
import type {
  DecisionLogEntry,
  KnowledgeActionItem,
  KnowledgeDocument,
  KnowledgeDocumentVersion,
  Meeting,
  TenantUser
} from "@kiss-pm/domain";
import type { ProjectRecord, TaskRecord } from "@kiss-pm/persistence";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { ApiTenantDataSource, ManagementAuditEventInput } from "./apiTypes";
import { registerKnowledgeRoutes } from "./knowledgeRoutes";
import type { ApiRouteDeps } from "./routeTypes";

describe("knowledge routes", () => {
  it("creates a project document with an immutable first version and safe audit", async () => {
    const fixture = createKnowledgeFixture();
    fixture.meetings.push(meeting("meeting-1", fixture.project.id));
    const app = createKnowledgeApp(fixture);

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/documents`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          title: "Протокол встречи",
          body: "Полный текст не должен попасть в audit",
          summary: "Короткое резюме",
          documentType: "meeting_minutes",
          sourceMeetingId: "meeting-1",
          changeReason: "Первичная версия"
        })
      }
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      document: {
        title: "Протокол встречи",
        currentVersionId: expect.stringContaining("knowledge-doc-version-")
      },
      version: {
        versionNumber: 1,
        title: "Протокол встречи",
        body: "Полный текст не должен попасть в audit"
      }
    });
    expect(fixture.documents).toHaveLength(1);
    expect(fixture.versions).toHaveLength(1);
    expect(fixture.transactionCount).toBe(1);
    expect(JSON.stringify(fixture.auditEvents[0]?.commandInput)).not.toContain("Полный текст");
  });

  it("creates document versions inside the governed transaction path", async () => {
    const fixture = createKnowledgeFixture();
    const app = createKnowledgeApp(fixture);
    const document = await fixtureDataSource(fixture).createKnowledgeDocument!({
      id: "knowledge-doc-existing",
      tenantId: fixture.actor.tenantId,
      projectId: fixture.project.id,
      title: "Исходный документ",
      summary: null,
      documentType: "general",
      status: "active",
      sourceMeetingId: null,
      approvalStatus: "none",
      approvalRequestedByUserId: null,
      createdByUserId: fixture.actor.id
    });

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/documents/${document.id}/versions`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          title: "Обновленный документ",
          body: "Новая версия",
          changeReason: "Правка после встречи"
        })
      }
    );

    expect(response.status).toBe(201);
    expect(fixture.transactionCount).toBe(1);
    expect(fixture.versions).toHaveLength(1);
    expect(fixture.auditEvents).toEqual([
      expect.objectContaining({ actionType: "knowledge.document_version_created" })
    ]);
  });

  it("returns a stable conflict when concurrent document version numbering collides", async () => {
    const fixture = createKnowledgeFixture();
    const app = createKnowledgeApp(fixture);
    const document = await fixtureDataSource(fixture).createKnowledgeDocument!({
      id: "knowledge-doc-existing",
      tenantId: fixture.actor.tenantId,
      projectId: fixture.project.id,
      title: "Исходный документ",
      summary: null,
      documentType: "general",
      status: "active",
      sourceMeetingId: null,
      approvalStatus: "none",
      approvalRequestedByUserId: null,
      createdByUserId: fixture.actor.id
    });
    fixture.versionConflict = true;

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/documents/${document.id}/versions`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          title: "Обновленный документ",
          body: "Новая версия",
          changeReason: "Правка после встречи"
        })
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "knowledge_version_conflict" });
    expect(fixture.versions).toHaveLength(0);
    expect(fixture.auditEvents).toHaveLength(0);
  });

  it("rejects cross-project meeting links before creating a document", async () => {
    const fixture = createKnowledgeFixture();
    fixture.meetings.push(meeting("meeting-other", "project-other"));
    const app = createKnowledgeApp(fixture);

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/documents`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          title: "Протокол",
          body: "Содержание",
          sourceMeetingId: "meeting-other"
        })
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "knowledge_meeting_not_found" });
    expect(fixture.documents).toHaveLength(0);
  });

  it("returns 501 when document lookup is not configured for document reads", async () => {
    const fixture = createKnowledgeFixture({ omittedMethods: ["findKnowledgeDocument"] });
    fixture.documents.push({
      id: "knowledge-doc-existing",
      tenantId: fixture.actor.tenantId,
      projectId: fixture.project.id,
      title: "Документ",
      summary: null,
      documentType: "general",
      status: "active",
      currentVersionId: null,
      sourceMeetingId: null,
      approvalStatus: "none",
      approvalRequestedByUserId: null,
      createdByUserId: fixture.actor.id,
      createdAt: new Date("2026-05-26T06:00:00.000Z"),
      updatedAt: new Date("2026-05-26T06:00:00.000Z"),
      archivedAt: null
    });
    const app = createKnowledgeApp(fixture);

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/documents/knowledge-doc-existing`,
      { headers: jsonHeaders() }
    );

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({ error: "knowledge_not_configured" });
  });

  it("returns 501 when link validators need unavailable knowledge methods", async () => {
    const fixture = createKnowledgeFixture({ omittedMethods: ["findKnowledgeDocument"] });
    const app = createKnowledgeApp(fixture);

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/decisions`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          title: "Решение",
          decision: "Опираемся на документ",
          documentId: "knowledge-doc-missing-method"
        })
      }
    );

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({ error: "knowledge_not_configured" });
  });

  it("writes denied audit when actor cannot manage project knowledge", async () => {
    const fixture = createKnowledgeFixture({ permissions: ["tenant.projects.read"] });
    const app = createKnowledgeApp(fixture);

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/decisions`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          title: "Решение",
          decision: "Делаем так"
        })
      }
    );

    expect(response.status).toBe(403);
    expect(fixture.auditEvents).toEqual([
      expect.objectContaining({
        actionType: "knowledge.denied",
        executionResult: { status: "denied" }
      })
    ]);
  });

  it("creates and updates decisions and action items for a project", async () => {
    const fixture = createKnowledgeFixture();
    const app = createKnowledgeApp(fixture);

    const decisionResponse = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/decisions`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          title: "Выбор архитектуры",
          decision: "Используем общий knowledge layer",
          rationale: "Меньше дублирования"
        })
      }
    );
    expect(decisionResponse.status).toBe(201);
    const decisionBody = await decisionResponse.json() as { decision: DecisionLogEntry };

    const actionResponse = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/action-items`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          title: "Подготовить ADR",
          ownerUserId: fixture.actor.id,
          dueDate: "2026-05-27",
          decisionId: decisionBody.decision.id
        })
      }
    );
    expect(actionResponse.status).toBe(201);
    const actionBody = await actionResponse.json() as { actionItem: KnowledgeActionItem };

    const updateResponse = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/action-items/${actionBody.actionItem.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({ status: "done" })
      }
    );
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      actionItem: { status: "done" }
    });
  });

  it("rejects action item targets outside the current project scope", async () => {
    const fixture = createKnowledgeFixture();
    fixture.tasks.push(task("task-other", "project-other"));
    const app = createKnowledgeApp(fixture);

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/action-items`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          title: "Проверить задачу",
          ownerUserId: fixture.actor.id,
          targetEntityType: "task",
          targetEntityId: "task-other"
        })
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "knowledge_action_target_not_found"
    });
    expect(fixture.actionItems).toHaveLength(0);
  });

  it("rolls back decision creation when audit persistence fails", async () => {
    const fixture = createKnowledgeFixture();
    fixture.auditFailureActionType = "knowledge.decision_recorded";
    const app = createKnowledgeApp(fixture);

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/decisions`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          title: "Выбор архитектуры",
          decision: "Используем общий knowledge layer",
          rationale: "Меньше дублирования"
        })
      }
    );

    expect(response.status).toBe(500);
    expect(fixture.decisions).toHaveLength(0);
    expect(fixture.auditEvents).toHaveLength(0);
  });

  it("deletes a decision log entry and records a delete audit", async () => {
    const fixture = createKnowledgeFixture();
    const app = createKnowledgeApp(fixture);
    const created = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/decisions`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ title: "Решение", decision: "Делаем так" })
      }
    );
    const decisionId = ((await created.json()) as { decision: DecisionLogEntry }).decision.id;

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/decisions/${decisionId}`,
      { method: "DELETE", headers: jsonHeaders() }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      decision: { id: decisionId, archivedAt: expect.any(String) }
    });
    expect(fixture.decisions.every((decision) => decision.archivedAt)).toBe(true);
    expect(fixture.auditEvents.map((event) => event.actionType)).toContain("knowledge.decision_deleted");
  });

  it("returns 404 when deleting a missing decision", async () => {
    const fixture = createKnowledgeFixture();
    const app = createKnowledgeApp(fixture);

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/decisions/decision-missing`,
      { method: "DELETE", headers: jsonHeaders() }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "knowledge_decision_not_found" });
  });

  it("writes denied audit when deleting a decision without manage rights", async () => {
    const fixture = createKnowledgeFixture({ permissions: ["tenant.projects.read"] });
    const app = createKnowledgeApp(fixture);

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/decisions/decision-any`,
      { method: "DELETE", headers: jsonHeaders() }
    );

    expect(response.status).toBe(403);
    expect(fixture.auditEvents).toEqual([
      expect.objectContaining({
        actionType: "knowledge.denied",
        executionResult: { status: "denied" }
      })
    ]);
  });

  it("deletes an action item and records a delete audit", async () => {
    const fixture = createKnowledgeFixture();
    const app = createKnowledgeApp(fixture);
    const created = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/action-items`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ title: "Подготовить ADR", ownerUserId: fixture.actor.id })
      }
    );
    const actionItemId = ((await created.json()) as { actionItem: KnowledgeActionItem }).actionItem.id;

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/action-items/${actionItemId}`,
      { method: "DELETE", headers: jsonHeaders() }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionItem: { id: actionItemId, archivedAt: expect.any(String) }
    });
    expect(fixture.actionItems.every((actionItem) => actionItem.archivedAt)).toBe(true);
    expect(fixture.auditEvents.map((event) => event.actionType)).toContain("knowledge.action_item_deleted");
  });

  it("returns 404 when deleting a missing action item", async () => {
    const fixture = createKnowledgeFixture();
    const app = createKnowledgeApp(fixture);

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/action-items/action-missing`,
      { method: "DELETE", headers: jsonHeaders() }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "knowledge_action_item_not_found" });
  });

  it("restores a past document version as a new current version without losing history", async () => {
    const fixture = createKnowledgeFixture();
    const dataSource = fixtureDataSource(fixture);
    const document = await dataSource.createKnowledgeDocument!(baseDocumentInput(fixture));
    const first = await dataSource.createKnowledgeDocumentVersion!({
      id: "knowledge-doc-version-1",
      tenantId: fixture.actor.tenantId,
      documentId: document.id,
      title: "Версия 1",
      body: "Тело первой версии",
      summary: "Резюме 1",
      changeReason: "Первая",
      createdByUserId: fixture.actor.id
    });
    await dataSource.createKnowledgeDocumentVersion!({
      id: "knowledge-doc-version-2",
      tenantId: fixture.actor.tenantId,
      documentId: document.id,
      title: "Версия 2",
      body: "Тело второй версии",
      summary: "Резюме 2",
      changeReason: "Вторая",
      createdByUserId: fixture.actor.id
    });
    const app = createKnowledgeApp(fixture);

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/documents/${document.id}/versions/${first.version.id}/restore`,
      { method: "POST", headers: jsonHeaders() }
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      document: KnowledgeDocument;
      version: KnowledgeDocumentVersion;
    };
    expect(body.version.versionNumber).toBe(3);
    expect(body.version.body).toBe("Тело первой версии");
    expect(body.document.currentVersionId).toBe(body.version.id);
    expect(fixture.versions).toHaveLength(3);
    expect(fixture.transactionCount).toBe(1);
    expect(fixture.auditEvents.map((event) => event.actionType)).toContain(
      "knowledge.document_version_restored"
    );
  });

  it("returns 404 when restoring a version that does not exist", async () => {
    const fixture = createKnowledgeFixture();
    const dataSource = fixtureDataSource(fixture);
    const document = await dataSource.createKnowledgeDocument!(baseDocumentInput(fixture));
    const app = createKnowledgeApp(fixture);

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/documents/${document.id}/versions/knowledge-doc-version-missing/restore`,
      { method: "POST", headers: jsonHeaders() }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "knowledge_document_version_not_found" });
    expect(fixture.auditEvents).toHaveLength(0);
  });

  it("returns 404 when restoring a version of a missing document", async () => {
    const fixture = createKnowledgeFixture();
    const app = createKnowledgeApp(fixture);

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/documents/knowledge-doc-missing/versions/knowledge-doc-version-1/restore`,
      { method: "POST", headers: jsonHeaders() }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "knowledge_document_not_found" });
  });

  it("returns a stable conflict when restore collides on version numbering", async () => {
    const fixture = createKnowledgeFixture();
    const dataSource = fixtureDataSource(fixture);
    const document = await dataSource.createKnowledgeDocument!(baseDocumentInput(fixture));
    const first = await dataSource.createKnowledgeDocumentVersion!({
      id: "knowledge-doc-version-1",
      tenantId: fixture.actor.tenantId,
      documentId: document.id,
      title: "Версия 1",
      body: "Тело первой версии",
      summary: "Резюме 1",
      changeReason: "Первая",
      createdByUserId: fixture.actor.id
    });
    fixture.versionConflict = true;
    const app = createKnowledgeApp(fixture);

    const response = await app.request(
      `/api/workspace/projects/${fixture.project.id}/knowledge/documents/${document.id}/versions/${first.version.id}/restore`,
      { method: "POST", headers: jsonHeaders() }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "knowledge_version_conflict" });
    expect(fixture.versions).toHaveLength(1);
    expect(fixture.auditEvents).toHaveLength(0);
  });
});

type KnowledgeFixture = {
  actor: TenantUser;
  profile: AccessProfile;
  project: ProjectRecord;
  tasks: TaskRecord[];
  meetings: Meeting[];
  documents: KnowledgeDocument[];
  versions: KnowledgeDocumentVersion[];
  decisions: DecisionLogEntry[];
  actionItems: KnowledgeActionItem[];
  auditEvents: ManagementAuditEventInput[];
  transactionCount: number;
  auditFailureActionType?: string;
  omittedMethods?: Array<keyof ApiTenantDataSource>;
  versionConflict?: boolean;
};

function createKnowledgeFixture(input: {
  omittedMethods?: Array<keyof ApiTenantDataSource>;
  permissions?: string[];
} = {}): KnowledgeFixture {
  const actor = {
    id: "user-alpha",
    tenantId: "tenant-alpha",
    name: "Анна",
    accessProfileId: "profile-alpha"
  };
  const fixture: KnowledgeFixture = {
    actor,
    profile: {
      id: "profile-alpha",
      permissions: input.permissions ?? ["tenant.projects.read", "tenant.projects.manage"]
    } as AccessProfile,
    project: project("project-alpha"),
    tasks: [],
    meetings: [],
    documents: [],
    versions: [],
    decisions: [],
    actionItems: [],
    auditEvents: [],
    transactionCount: 0
  };
  if (input.omittedMethods) fixture.omittedMethods = input.omittedMethods;
  return fixture;
}

function createKnowledgeApp(fixture: KnowledgeFixture) {
  const app = new Hono();
  app.onError((_error, context) => context.json({ error: "internal_error" }, 500));
  const dataSource = fixtureDataSource(fixture);
  registerKnowledgeRoutes(app, {
    dataSource,
    getSessionActorFromHeaders: async () => fixture.actor,
    getActorProfile: async () => fixture.profile,
    runDataSourceTransaction: async <T>(operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>) => {
      fixture.transactionCount += 1;
      const snapshot = cloneFixtureState(fixture);
      try {
        return await operation(dataSource);
      } catch (error) {
        restoreFixtureState(fixture, snapshot);
        throw error;
      }
    },
    appendManagementAuditEvent: async (input: ManagementAuditEventInput) => {
      if (fixture.auditFailureActionType === input.actionType) {
        throw new Error("audit_failed");
      }
      fixture.auditEvents.push(input);
      return input.auditEventId ?? "audit-test";
    }
  } as unknown as ApiRouteDeps);
  return app;
}

function fixtureDataSource(fixture: KnowledgeFixture): ApiTenantDataSource {
  return createKnowledgeDataSource(fixture);
}

function createKnowledgeDataSource(fixture: KnowledgeFixture): ApiTenantDataSource {
  const dataSource = ensureCompleteDataSource({
    listDevUsers: async () => [fixture.actor],
    findTenantById: async () => ({ id: fixture.actor.tenantId, name: "Tenant" }),
    findUserById: async () => fixture.actor,
    listUsersByTenantId: async () => [fixture.actor],
    listProjects: async () => [fixture.project],
    findTaskById: async (tenantId, taskId) =>
      fixture.tasks.find((task) =>
        task.tenantId === tenantId &&
        task.id === taskId &&
        !task.archivedAt
      ),
    createKnowledgeDocument: async (input) => {
      const now = new Date("2026-05-26T06:00:00.000Z");
      const document: KnowledgeDocument = {
        ...input,
        currentVersionId: null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null
      };
      fixture.documents.push(document);
      return document;
    },
    findKnowledgeDocument: async (input) =>
      fixture.documents.find((document) =>
        document.tenantId === input.tenantId &&
        document.projectId === input.projectId &&
        document.id === input.documentId &&
        !document.archivedAt
      ),
    findKnowledgeDocumentById: async (input) =>
      fixture.documents.find((document) =>
        document.tenantId === input.tenantId &&
        document.id === input.documentId &&
        !document.archivedAt
      ),
    listKnowledgeDocuments: async (input) =>
      fixture.documents.filter((document) =>
        document.tenantId === input.tenantId &&
        document.projectId === input.projectId &&
        !document.archivedAt
      ),
    archiveKnowledgeDocument: async (input) => {
      const document = fixture.documents.find((candidate) =>
        candidate.tenantId === input.tenantId &&
        candidate.projectId === input.projectId &&
        candidate.id === input.documentId
      );
      if (!document) return undefined;
      document.status = "archived";
      document.archivedAt = new Date("2026-05-26T07:00:00.000Z");
      document.updatedAt = document.archivedAt;
      return document;
    },
    createKnowledgeDocumentVersion: async (input) => {
      if (fixture.versionConflict) {
        const error = new Error("duplicate key value violates unique constraint");
        Object.assign(error, {
          code: "23505",
          constraint: "knowledge_document_versions_document_number_uidx"
        });
        throw error;
      }
      const document = fixture.documents.find((candidate) =>
        candidate.tenantId === input.tenantId &&
        candidate.id === input.documentId
      );
      if (!document) throw new Error("document not found");
      const version: KnowledgeDocumentVersion = {
        ...input,
        versionNumber: fixture.versions.filter((item) => item.documentId === input.documentId).length + 1,
        createdAt: new Date("2026-05-26T06:01:00.000Z")
      };
      fixture.versions.push(version);
      document.currentVersionId = version.id;
      document.title = version.title;
      document.summary = version.summary;
      return { document, version };
    },
    restoreKnowledgeDocumentVersion: async (input) => {
      if (fixture.versionConflict) {
        const error = new Error("duplicate key value violates unique constraint");
        Object.assign(error, {
          code: "23505",
          constraint: "knowledge_document_versions_document_number_uidx"
        });
        throw error;
      }
      const document = fixture.documents.find((candidate) =>
        candidate.tenantId === input.tenantId &&
        candidate.projectId === input.projectId &&
        candidate.id === input.documentId &&
        !candidate.archivedAt
      );
      if (!document) return undefined;
      const source = fixture.versions.find((candidate) =>
        candidate.tenantId === input.tenantId &&
        candidate.documentId === input.documentId &&
        candidate.id === input.versionId
      );
      if (!source) return undefined;
      const version: KnowledgeDocumentVersion = {
        id: input.newVersionId,
        tenantId: input.tenantId,
        documentId: input.documentId,
        versionNumber: fixture.versions.filter((item) => item.documentId === input.documentId).length + 1,
        title: source.title,
        body: source.body,
        summary: source.summary,
        changeReason: source.changeReason,
        createdByUserId: input.createdByUserId,
        createdAt: new Date("2026-05-26T06:06:00.000Z")
      };
      fixture.versions.push(version);
      document.currentVersionId = version.id;
      document.title = version.title;
      document.summary = version.summary;
      return { document, version };
    },
    listKnowledgeDocumentVersions: async (input) =>
      fixture.versions.filter((version) =>
        version.tenantId === input.tenantId &&
        version.documentId === input.documentId
      ),
    createDecisionLogEntry: async (input) => {
      const now = new Date("2026-05-26T06:02:00.000Z");
      const decision: DecisionLogEntry = {
        ...input,
        createdAt: now,
        updatedAt: now,
        archivedAt: null
      };
      fixture.decisions.push(decision);
      return decision;
    },
    findDecisionLogEntry: async (input) =>
      fixture.decisions.find((decision) =>
        decision.tenantId === input.tenantId &&
        decision.projectId === input.projectId &&
        decision.id === input.decisionId &&
        !decision.archivedAt
      ),
    updateDecisionLogEntry: async (input) => {
      const decision = fixture.decisions.find((candidate) =>
        candidate.tenantId === input.tenantId &&
        candidate.projectId === input.projectId &&
        candidate.id === input.decisionId
      );
      if (!decision) return undefined;
      Object.assign(decision, input, { updatedAt: new Date("2026-05-26T06:03:00.000Z") });
      return decision;
    },
    deleteKnowledgeDecision: async (input) => {
      const decision = fixture.decisions.find((candidate) =>
        candidate.tenantId === input.tenantId &&
        candidate.projectId === input.projectId &&
        candidate.id === input.decisionId &&
        !candidate.archivedAt
      );
      if (!decision) return undefined;
      decision.archivedAt = new Date("2026-05-26T06:07:00.000Z");
      decision.updatedAt = decision.archivedAt;
      return decision;
    },
    listDecisionLogEntries: async (input) =>
      fixture.decisions.filter((decision) =>
        decision.tenantId === input.tenantId &&
        decision.projectId === input.projectId &&
        !decision.archivedAt
      ),
    createKnowledgeActionItem: async (input) => {
      const now = new Date("2026-05-26T06:04:00.000Z");
      const actionItem: KnowledgeActionItem = {
        ...input,
        createdAt: now,
        updatedAt: now,
        archivedAt: null
      };
      fixture.actionItems.push(actionItem);
      return actionItem;
    },
    findKnowledgeActionItem: async (input) =>
      fixture.actionItems.find((actionItem) =>
        actionItem.tenantId === input.tenantId &&
        actionItem.projectId === input.projectId &&
        actionItem.id === input.actionItemId &&
        !actionItem.archivedAt
      ),
    updateKnowledgeActionItem: async (input) => {
      const actionItem = fixture.actionItems.find((candidate) =>
        candidate.tenantId === input.tenantId &&
        candidate.projectId === input.projectId &&
        candidate.id === input.actionItemId
      );
      if (!actionItem) return undefined;
      Object.assign(actionItem, input, { updatedAt: new Date("2026-05-26T06:05:00.000Z") });
      return actionItem;
    },
    deleteKnowledgeActionItem: async (input) => {
      const actionItem = fixture.actionItems.find((candidate) =>
        candidate.tenantId === input.tenantId &&
        candidate.projectId === input.projectId &&
        candidate.id === input.actionItemId &&
        !candidate.archivedAt
      );
      if (!actionItem) return undefined;
      actionItem.archivedAt = new Date("2026-05-26T06:08:00.000Z");
      actionItem.updatedAt = actionItem.archivedAt;
      return actionItem;
    },
    listKnowledgeActionItems: async (input) =>
      fixture.actionItems.filter((actionItem) =>
        actionItem.tenantId === input.tenantId &&
        actionItem.projectId === input.projectId &&
        !actionItem.archivedAt
      ),
    findProjectMeeting: async (input) =>
      fixture.meetings.find((item) =>
        item.tenantId === input.tenantId &&
        item.entityType === "project" &&
        item.entityId === input.projectId &&
        item.id === input.meetingId &&
        !item.archivedAt
      )
        ? { id: input.meetingId }
        : undefined
  }) as ApiTenantDataSource;

  for (const method of fixture.omittedMethods ?? []) {
    delete (dataSource as Record<string, unknown>)[method];
  }

  return dataSource;
}

function cloneFixtureState(fixture: KnowledgeFixture) {
  return {
    documents: fixture.documents.map((document) => ({ ...document })),
    versions: fixture.versions.map((version) => ({ ...version })),
    decisions: fixture.decisions.map((decision) => ({ ...decision })),
    actionItems: fixture.actionItems.map((actionItem) => ({ ...actionItem })),
    auditEvents: fixture.auditEvents.map((event) => ({ ...event }))
  };
}

function restoreFixtureState(fixture: KnowledgeFixture, snapshot: ReturnType<typeof cloneFixtureState>) {
  fixture.documents.splice(0, fixture.documents.length, ...snapshot.documents);
  fixture.versions.splice(0, fixture.versions.length, ...snapshot.versions);
  fixture.decisions.splice(0, fixture.decisions.length, ...snapshot.decisions);
  fixture.actionItems.splice(0, fixture.actionItems.length, ...snapshot.actionItems);
  fixture.auditEvents.splice(0, fixture.auditEvents.length, ...snapshot.auditEvents);
}

function baseDocumentInput(fixture: KnowledgeFixture) {
  return {
    id: "knowledge-doc-existing",
    tenantId: fixture.actor.tenantId,
    projectId: fixture.project.id,
    title: "Исходный документ",
    summary: null,
    documentType: "general" as const,
    status: "active" as const,
    sourceMeetingId: null,
    approvalStatus: "none" as const,
    approvalRequestedByUserId: null,
    createdByUserId: fixture.actor.id
  };
}

function project(id: string): ProjectRecord {
  return {
    id,
    tenantId: "tenant-alpha",
    sourceType: "manual",
    sourceOpportunityId: null,
    clientId: null,
    projectTypeId: null,
    title: "Проект",
    clientName: "Клиент",
    status: "active",
    plannedStart: new Date("2026-05-26T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-01T00:00:00.000Z"),
    contractValue: 0,
    plannedHours: 0,
    templateId: null,
    createdAt: new Date("2026-05-26T00:00:00.000Z"),
    activatedAt: new Date("2026-05-26T00:00:00.000Z"),
    closedAt: null,
    demand: []
  };
}

function task(id: string, projectId: string): TaskRecord {
  const now = new Date("2026-05-26T00:00:00.000Z");
  return {
    id,
    tenantId: "tenant-alpha",
    projectId,
    stageId: null,
    title: "Задача",
    description: null,
    status: "new",
    statusId: "task-status-new",
    statusName: "Новая",
    statusCategory: "new",
    priority: "normal",
    requesterUserId: "user-alpha",
    ownerUserId: "user-alpha",
    plannedStart: now,
    plannedFinish: now,
    durationWorkingDays: 1,
    plannedWork: 60,
    actualWork: 0,
    progress: 0,
    requiresAcceptance: false,
    source: "manual",
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    participants: []
  };
}

function meeting(id: string, projectId: string): Meeting {
  return {
    id,
    tenantId: "tenant-alpha",
    entityType: "project",
    entityId: projectId,
    title: "Синк",
    agenda: "",
    scheduledStart: new Date("2026-05-26T05:00:00.000Z"),
    scheduledFinish: new Date("2026-05-26T06:00:00.000Z"),
    status: "scheduled",
    createdByUserId: "user-alpha",
    createdAt: new Date("2026-05-26T04:00:00.000Z"),
    archivedAt: null
  };
}

function jsonHeaders() {
  return {
    cookie: "kiss_pm_session=test",
    "content-type": "application/json"
  };
}
