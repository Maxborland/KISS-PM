import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { verifyLoginPassword } from "./authRoutes";
import type { ApiTenantDataSource, ProjectRecord, WorkspaceUserRecord } from "./apiTypes";
import type { ControlSignal, KpiDefinition, PlanSnapshot, PlanningCommand } from "@kiss-pm/domain";
import type { TaskRecord, TaskStatusRecord } from "@kiss-pm/persistence";
import { hashPassword } from "@kiss-pm/persistence";

describe("KISS PM API Phase 1 shell", () => {
  it("returns health status", async () => {
    const app = createApp();

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(response.json()).resolves.toEqual({ status: "ok", product: "KISS PM" });
  });

  it("returns liveness status on public and API health routes", async () => {
    const app = createApp();

    const publicResponse = await app.request("/health/live");
    const apiResponse = await app.request("/api/health/live");

    expect(publicResponse.status).toBe(200);
    await expect(publicResponse.json()).resolves.toEqual({
      status: "live",
      product: "KISS PM"
    });
    expect(apiResponse.status).toBe(200);
    await expect(apiResponse.json()).resolves.toEqual({
      status: "live",
      product: "KISS PM"
    });
  });

  it("serves frontend-facing OpenAPI and Scalar API reference", async () => {
    const app = createApp();

    const openApiResponse = await app.request("/api/openapi.json");
    const scalarResponse = await app.request("/api/docs");

    expect(openApiResponse.status).toBe(200);
    const document = await openApiResponse.json();
    expect(document.openapi).toBe("3.1.0");
    expect(document.info.title).toBe("KISS PM Backend API");
    expect(document.paths["/api/auth/login"].post.summary).toBe("Create browser session");
    expect(
      document.paths["/api/auth/login"].post.requestBody.content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/LoginRequest" });
    expect(document.paths["/api/auth/me"].get.responses["200"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/AuthMeResponse"
    });
    expect(
      document.paths["/api/workspace/users"].post.responses["201"].content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/WorkspaceUserResponse" });
    expect(document.components.schemas.WorkspaceUserCreateRequest.required).toContain(
      "password"
    );
    expect(document.paths["/api/workspace/clients"].get.responses["200"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/ClientsResponse"
    });
    expect(
      document.paths["/api/workspace/products"].post.requestBody.content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/ProductWriteRequest" });
    expect(document.components.schemas.ProductWriteRequest.required).toEqual([
      "name",
      "unit",
      "price"
    ]);
    expect(
      document.paths["/api/workspace/config/custom-fields"].post.requestBody.content[
        "application/json"
      ].schema
    ).toEqual({ $ref: "#/components/schemas/CustomFieldWriteRequest" });
    expect(
      document.paths["/api/tenant/current/org-structure"].put.requestBody.content[
        "application/json"
      ].schema
    ).toEqual({ $ref: "#/components/schemas/TenantOrgStructureReplaceRequest" });
    expect(
      document.paths["/api/workspace/opportunities"].post.requestBody.content[
        "application/json"
      ].schema
    ).toEqual({ $ref: "#/components/schemas/OpportunityWriteRequest" });
    expect(
      document.paths["/api/workspace/projects/{projectId}/tasks"].post.requestBody.content[
        "application/json"
      ].schema
    ).toEqual({ $ref: "#/components/schemas/TaskCreateRequest" });
    expect(document.paths["/api/workspace/tasks/{taskId}"].get.responses["200"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/TaskDetailResponse"
    });
    expect(document.components.schemas.TaskUpdateRequest.required).toContain(
      "clientUpdatedAt"
    );
    expect(document.paths["/api/workspace/projects/{projectId}/planning/read-model"].get.summary).toBe(
      "Read planning model"
    );
    expect(
      document.paths["/api/workspace/projects/{projectId}/planning/read-model"].get.responses["200"]
        .content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/PlanningReadModelResponse" });
    expect(
      document.paths["/api/workspace/projects/{projectId}/planning/preview-command"].post
        .requestBody.content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/PlanningCommandEnvelope" });
    expect(document.components.schemas.PlanningCommand.oneOf).toContainEqual({
      $ref: "#/components/schemas/PlanningTaskCreateCommand"
    });
    expect(
      document.paths["/api/workspace/projects/{projectId}/planning/apply-command-batch"].post
        .requestBody.content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/PlanningCommandBatchEnvelope" });
    expect(
      document.paths["/api/workspace/projects/{projectId}/planning/baselines"].get.responses["200"]
        .content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/PlanningBaselinesResponse" });
    expect(
      document.paths["/api/workspace/projects/{projectId}/planning/auto-solver-runs"].post
        .requestBody.content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/PlanningAutoSolverRunCreateRequest" });
    expect(
      document.paths["/api/workspace/attachments"].get.parameters
    ).toContainEqual(
      expect.objectContaining({
        in: "query",
        name: "entityType",
        required: true
      })
    );
    expect(
      document.paths["/api/workspace/attachments/external-references"].post.requestBody
        .content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/ExternalReferenceAttachRequest" });
    expect(
      document.paths["/api/workspace/search"].get.responses["200"].content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/WorkspaceSearchResponse" });
    expect(
      document.paths["/api/workspace/projects/{projectId}/knowledge/documents"].post
        .requestBody.content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/KnowledgeDocumentCreateRequest" });
    expect(
      document.paths["/api/workspace/projects/{projectId}/knowledge/decisions"].post
        .responses["201"].content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/KnowledgeDecisionResponse" });
    expect(
      document.paths["/api/workspace/capacity/tree"].get.responses["200"].content[
        "application/json"
      ].schema
    ).toEqual({ $ref: "#/components/schemas/CapacityTreeResponse" });
    expect(
      document.paths["/api/tenant/current/production-calendar/bulk"].post.requestBody
        .content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/ProductionCalendarBulkRequest" });
    expect(
      document.paths["/api/tenant/current/absences"].post.requestBody.content["application/json"]
        .schema
    ).toEqual({ $ref: "#/components/schemas/ResourceAbsenceCreateRequest" });
    expect(
      document.paths[
        "/api/workspace/resources/{resourceId}/personal-calendar/events"
      ].post.requestBody.content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/PersonalCalendarEventWriteRequest" });
    expect(
      document.paths["/api/tenant/current/kpi-definitions"].post.requestBody.content[
        "application/json"
      ].schema
    ).toEqual({ $ref: "#/components/schemas/KpiDefinitionWriteRequest" });
    expect(
      document.paths["/api/workspace/projects/{projectId}/control/read-model"].get.responses[
        "200"
      ].content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/ControlReadModelResponse" });
    expect(
      document.paths["/api/workspace/projects/{projectId}/closure/close"].post.requestBody
        .content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/ClosureCloseRequest" });
    expect(
      document.paths[
        "/api/tenant/current/project-templates/{templateId}/retrospective-insights"
      ].get.responses["200"].content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/RetrospectiveInsightsResponse" });
    expect(
      document.paths["/api/tenant/current/control-surfaces"].post.requestBody.content[
        "application/json"
      ].schema
    ).toEqual({ $ref: "#/components/schemas/ControlSurfaceDraftSaveRequest" });
    expect(
      document.paths["/api/workspace/tasks/{taskId}/comments"].post.requestBody.content[
        "application/json"
      ].schema
    ).toEqual({ $ref: "#/components/schemas/TaskCommentCreateRequest" });
    expect(
      document.paths["/api/workspace/crm/{entityType}/{entityId}/tasks"].post.requestBody
        .content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/CrmTaskCreateRequest" });
    expect(
      document.paths["/api/workspace/conversations/{conversationId}/messages"].post.requestBody
        .content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/ConversationMessageCreateRequest" });
    expect(
      document.paths["/api/workspace/meetings"].post.responses["201"].content[
        "application/json"
      ].schema
    ).toEqual({ $ref: "#/components/schemas/MeetingCreateResponse" });
    expect(
      document.paths["/api/workspace/communication-channels/{channelId}/members"].post
        .requestBody.content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/CommunicationChannelMemberUpsertRequest" });
    expect(
      document.paths["/api/workspace/sticker-packs/{packId}/import"].post.requestBody
        .content["multipart/form-data"].schema
    ).toEqual({ $ref: "#/components/schemas/StickerImportMultipartRequest" });
    expect(
      document.paths["/api/workspace/call-rooms/{roomId}/sessions/{sessionId}/join-token"]
        .post.responses["200"].content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/CallJoinTokenResponse" });
    expect(
      document.paths["/api/workspace/background-jobs/runs"].post.requestBody.content[
        "application/json"
      ].schema
    ).toEqual({ $ref: "#/components/schemas/BackgroundJobEnqueueRequest" });
    expect(
      document.paths[
        "/api/workspace/projects/{projectId}/planning/auto-solver-runs/{runId}/proposals/{proposalId}/apply"
      ].post.parameters
    ).toContainEqual(
      expect.objectContaining({
        in: "header",
        name: "x-kiss-pm-action",
        required: true
      })
    );

    expect(scalarResponse.status).toBe(200);
    expect(scalarResponse.headers.get("content-type")).toContain("text/html");
    await expect(scalarResponse.text()).resolves.toContain("/api/openapi.json");
  });

  it("returns readiness when dependency checks pass", async () => {
    const app = createApp({
      readinessChecks: {
        database: async () => {},
        storage: async () => {}
      }
    });

    const response = await app.request("/health/ready");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ready",
      product: "KISS PM",
      checks: {
        database: { status: "ok" },
        storage: { status: "ok", provider: "local" }
      }
    });
  });

  it("includes realtime readiness when the check is configured", async () => {
    const app = createApp({
      readinessChecks: {
        database: async () => {},
        realtime: async () => {},
        storage: async () => {}
      }
    });

    const response = await app.request("/health/ready");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ready",
      product: "KISS PM",
      checks: {
        database: { status: "ok" },
        realtime: { status: "ok" },
        storage: { status: "ok", provider: "local" }
      }
    });
  });

  it("returns stable readiness errors without leaking internal exceptions", async () => {
    const app = createApp({
      readinessChecks: {
        database: async () => {
          throw new Error("password=secret internal host");
        },
        storage: async () => {}
      }
    });

    const response = await app.request("/api/health/ready");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "not_ready",
      product: "KISS PM",
      checks: {
        database: { status: "error", error: "database_unavailable" },
        storage: { status: "ok", provider: "local" }
      }
    });
  });

  it("maps unexpected route exceptions to generic API errors", async () => {
    const app = createApp();
    app.get("/api/test/internal-error", () => {
      throw new Error("password=secret internal database failure");
    });

    const response = await app.request("/api/test/internal-error");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "internal_error" });
  });

  it("returns collaboration_not_configured for unconfigured meeting creation storage", async () => {
    const now = new Date("2026-05-26T00:00:00.000Z");
    const actor = {
      id: "user-collab-admin",
      tenantId: "tenant-collab",
      name: "Кира Администратор",
      accessProfileId: "collab-profile"
    };
    const project: ProjectRecord = {
      id: "project-collab",
      tenantId: "tenant-collab",
      sourceType: "manual",
      sourceOpportunityId: null,
      clientId: null,
      projectTypeId: null,
      title: "Проект коммуникаций",
      clientName: "ООО Связь",
      status: "active",
      plannedStart: now,
      plannedFinish: now,
      contractValue: 0,
      plannedHours: 0,
      templateId: null,
      createdAt: now,
      activatedAt: now,
      closedAt: null,
      demand: []
    };
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-collab",
          tenantId: actor.tenantId,
          userId: actor.id,
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async findUserById(userId) {
        return userId === actor.id ? actor : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === actor.tenantId ? { id: tenantId, name: "Collab Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "collab-profile",
          permissions: ["tenant.projects.read", "tenant.projects.manage"]
        };
      },
      async listUsersByTenantId() {
        return [actor];
      },
      async listProjects() {
        return [project];
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/workspace/meetings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      body: JSON.stringify({
        entityType: "project",
        entityId: project.id,
        title: "Планерка",
        agenda: "",
        scheduledStart: "2026-06-02T09:00:00.000Z",
        scheduledFinish: "2026-06-02T09:30:00.000Z",
        participants: [{ userId: actor.id, role: "required" }]
      })
    });

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({ error: "collaboration_not_configured" });
  });

  it("lists deterministic dev users for local Phase 1 login", async () => {
    const app = createApp({ enableDevTenantRoutes: true });

    const response = await app.request("/api/session/dev-users");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      users: [
        {
          id: "user-alpha-admin",
          tenantId: "tenant-alpha",
          name: "Анна Администратор"
        },
        {
          id: "user-beta-admin",
          tenantId: "tenant-beta",
          name: "Борис Администратор"
        }
      ]
    });
  });

  it("returns the current tenant for the dev-session user", async () => {
    const app = createApp({ enableDevTenantRoutes: true });

    const response = await app.request("/api/tenant/current", {
      headers: { "x-user-id": "user-alpha-admin" }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tenant: {
        id: "tenant-alpha",
        name: "Альфа Проект"
      },
      user: {
        id: "user-alpha-admin",
        tenantId: "tenant-alpha",
        name: "Анна Администратор"
      }
    });
  });

  it("denies cross-tenant user reads", async () => {
    const app = createApp({ enableDevTenantRoutes: true });

    const response = await app.request("/api/tenant/tenant-beta/users", {
      headers: { "x-user-id": "user-alpha-admin" }
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "cross_tenant_denied"
    });
  });

  it("rejects malformed dev tenant route identifiers before persistence lookup", async () => {
    const dataSource: Partial<ApiTenantDataSource> = {
      async findUserById() {
        throw new Error("findUserById must not be called for malformed ids");
      }
    };
    const app = createApp({
      enableDevTenantRoutes: true,
      dataSource: dataSource as ApiTenantDataSource
    });

    const invalidLogin = await app.request("/api/session/dev-login?userId=bad%2Fuser");
    expect(invalidLogin.status).toBe(400);
    await expect(invalidLogin.json()).resolves.toEqual({ error: "invalid_user_id" });

    const invalidTenant = await app.request("/api/tenant/bad%2Ftenant/users", {
      headers: { "x-user-id": "user-alpha-admin" }
    });
    expect(invalidTenant.status).toBe(400);
    await expect(invalidTenant.json()).resolves.toEqual({ error: "invalid_tenant_id" });

    const invalidHeaderUser = await app.request("/api/tenant/current", {
      headers: { "x-user-id": "bad/user" }
    });
    expect(invalidHeaderUser.status).toBe(401);
    await expect(invalidHeaderUser.json()).resolves.toEqual({
      error: "dev_session_required"
    });
  });

  it("keeps dev header routes disabled unless explicitly enabled", async () => {
    const app = createApp();

    const devUsers = await app.request("/api/session/dev-users");
    const currentTenant = await app.request("/api/tenant/current", {
      headers: { "x-user-id": "user-alpha-admin" }
    });

    expect(devUsers.status).toBe(404);
    expect(currentTenant.status).toBe(404);
  });

  it("sets no-store cache headers even for early API rejections", async () => {
    const app = createApp();

    const response = await app.request("/api/workspace/opportunities", {
      method: "POST"
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    await expect(response.json()).resolves.toEqual({
      error: "same_origin_action_required"
    });
  });

  it("rejects cross-site browser mutations even with the action header", async () => {
    const app = createApp();

    const response = await app.request("http://127.0.0.1/api/workspace/opportunities", {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
        "x-kiss-pm-action": "same-origin"
      }
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "same_origin_action_required"
    });
  });

  it("rate-limits repeated failed login attempts", async () => {
    const credential = {
      tenantId: "tenant-alpha",
      userId: "user-alpha-admin",
      email: "admin@kiss-pm.local",
      ...hashPassword("admin12345")
    };
    const dataSource: Partial<ApiTenantDataSource> = {
      async findCredentialByEmail(email) {
        return email === credential.email ? credential : undefined;
      },
      async createSession() {
        return;
      },
      async findUserById(userId) {
        if (userId !== credential.userId) return undefined;
        return {
          id: credential.userId,
          tenantId: credential.tenantId,
          name: "Анна Администратор",
          accessProfileId: "tenant-admin"
        };
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: credential.email,
          password: "wrong-password"
        })
      });
      expect(response.status).toBe(401);
    }

    const blocked = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: credential.email,
        password: "wrong-password"
      })
    });

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("900");
    await expect(blocked.json()).resolves.toEqual({
      error: "too_many_login_attempts"
    });
  });

  it("checks login passwords through the same verifier when email is unknown", () => {
    const credential = hashPassword("admin12345");

    expect(verifyLoginPassword("admin12345", credential)).toBe(true);
    expect(verifyLoginPassword("wrong-password", credential)).toBe(false);
    expect(verifyLoginPassword("wrong-password", undefined)).toBe(false);
  });

  it("rejects malformed session cookies before persistence lookup", async () => {
    const dataSource: Partial<ApiTenantDataSource> = {
      async findSessionByTokenHash() {
        throw new Error("session_lookup_should_not_run");
      },
      async deleteSessionByTokenHash() {
        throw new Error("session_delete_should_not_run");
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const me = await app.request("/api/auth/me", {
      headers: { cookie: "kiss_pm_session=not-a-session-token" }
    });
    expect(me.status).toBe(401);
    await expect(me.json()).resolves.toEqual({ error: "session_required" });

    const logout = await app.request("/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `kiss_pm_session=${"z".repeat(64)}`,
        "x-kiss-pm-action": "same-origin"
      }
    });
    expect(logout.status).toBe(200);
    await expect(logout.json()).resolves.toEqual({ status: "ok" });
  });

  it("rejects oversized login JSON before auth work", async () => {
    const dataSource: Partial<ApiTenantDataSource> = {
      async findCredentialByEmail() {
        throw new Error("credential_lookup_should_not_run");
      },
      async createSession() {
        throw new Error("session_create_should_not_run");
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin@kiss-pm.local",
        password: "admin12345",
        padding: "x".repeat(70 * 1024)
      })
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "payload_too_large"
    });
  });

  it("rejects malformed or oversized login credentials before lookup and password KDF", async () => {
    const dataSource: Partial<ApiTenantDataSource> = {
      async findCredentialByEmail() {
        throw new Error("credential_lookup_should_not_run");
      },
      async createSession() {
        throw new Error("session_create_should_not_run");
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const oversizedPassword = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin@kiss-pm.local",
        password: "x".repeat(1025)
      })
    });
    expect(oversizedPassword.status).toBe(400);
    await expect(oversizedPassword.json()).resolves.toEqual({
      error: "invalid_login_payload"
    });

    const oversizedEmail = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `${"a".repeat(250)}@example.local`,
        password: "admin12345"
      })
    });
    expect(oversizedEmail.status).toBe(400);
    await expect(oversizedEmail.json()).resolves.toEqual({
      error: "invalid_login_payload"
    });

    const missingPassword = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin@kiss-pm.local"
      })
    });
    expect(missingPassword.status).toBe(400);
    await expect(missingPassword.json()).resolves.toEqual({
      error: "invalid_login_payload"
    });

    const controlEmail = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin\u0000@kiss-pm.local",
        password: "admin12345"
      })
    });
    expect(controlEmail.status).toBe(400);
    await expect(controlEmail.json()).resolves.toEqual({
      error: "invalid_login_payload"
    });

    const malformedEmail = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "admin12345"
      })
    });
    expect(malformedEmail.status).toBe(400);
    await expect(malformedEmail.json()).resolves.toEqual({
      error: "invalid_login_payload"
    });
  });

  it("can serve tenant users from an injected data source", async () => {
    const app = createApp({
      enableDevTenantRoutes: true,
      dataSource: {
        async listDevUsers() {
          return [
            {
              id: "user-db-admin",
              tenantId: "tenant-db",
              name: "Дарья Администратор",
              accessProfileId: "tenant-admin"
            }
          ];
        },
        async findUserById(userId) {
          if (userId !== "user-db-admin") return undefined;
          return {
            id: "user-db-admin",
            tenantId: "tenant-db",
            name: "Дарья Администратор",
            accessProfileId: "tenant-admin"
          };
        },
        async findTenantById(tenantId) {
          if (tenantId !== "tenant-db") return undefined;
          return {
            id: "tenant-db",
            name: "DB Tenant"
          };
        },
        async listUsersByTenantId(tenantId) {
          if (tenantId !== "tenant-db") return [];
          return [
            {
              id: "user-db-admin",
              tenantId: "tenant-db",
              name: "Дарья Администратор",
              accessProfileId: "tenant-admin"
            }
          ];
        }
      }
    });

    const response = await app.request("/api/tenant/tenant-db/users", {
      headers: { "x-user-id": "user-db-admin" }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      users: [
        {
          id: "user-db-admin",
          tenantId: "tenant-db",
          name: "Дарья Администратор"
        }
      ]
    });
  });

  it("fails closed when an actor access profile is missing", async () => {
    const app = createApp({
      enableDevTenantRoutes: true,
      dataSource: {
        async listDevUsers() {
          return [];
        },
        async findUserById(userId) {
          if (userId !== "user-with-missing-profile") return undefined;
          return {
            id: "user-with-missing-profile",
            tenantId: "tenant-db",
            name: "Пользователь без роли",
            accessProfileId: "missing-profile"
          };
        },
        async findTenantById(tenantId) {
          if (tenantId !== "tenant-db") return undefined;
          return {
            id: "tenant-db",
            name: "DB Tenant"
          };
        },
        async findAccessProfileById() {
          return undefined;
        },
        async listUsersByTenantId() {
          return [];
        }
      }
    });

    const response = await app.request("/api/tenant/tenant-db/users", {
      headers: { "x-user-id": "user-with-missing-profile" }
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "access_profile_not_found"
    });
  });

  it("fails closed when a persisted actor cannot resolve access profile repository", async () => {
    const app = createApp({
      enableDevTenantRoutes: true,
      dataSource: {
        async listDevUsers() {
          return [];
        },
        async findUserById(userId) {
          if (userId !== "user-with-unwired-profile") return undefined;
          return {
            id: "user-with-unwired-profile",
            tenantId: "tenant-db",
            name: "Пользователь без репозитория ролей",
            accessProfileId: "tenant-admin"
          };
        },
        async findTenantById(tenantId) {
          if (tenantId !== "tenant-db") return undefined;
          return {
            id: "tenant-db",
            name: "DB Tenant"
          };
        },
        async listUsersByTenantId() {
          return [];
        },
        async listWorkspaceUsers() {
          return [];
        }
      }
    });

    const response = await app.request("/api/tenant/tenant-db/users", {
      headers: { "x-user-id": "user-with-unwired-profile" }
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "access_profile_not_found"
    });
  });

  it("rechecks task edit permission after acquiring the planning lock", async () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const users: WorkspaceUserRecord[] = [
      {
        id: "user-requester",
        tenantId: "tenant-db",
        name: "Рита Постановщик",
        email: "requester@kiss-pm.local",
        accessProfileId: "reader-profile",
        positionId: null,
        positionName: null,
        phone: null,
        telegram: null,
        status: "active",
        theme: "system",
        accentColor: "blue"
      },
      {
        id: "user-current-requester",
        tenantId: "tenant-db",
        name: "Кирилл Новый Постановщик",
        email: "new-requester@kiss-pm.local",
        accessProfileId: "reader-profile",
        positionId: null,
        positionName: null,
        phone: null,
        telegram: null,
        status: "active",
        theme: "system",
        accentColor: "blue"
      },
      {
        id: "user-executor",
        tenantId: "tenant-db",
        name: "Егор Исполнитель",
        email: "executor@kiss-pm.local",
        accessProfileId: "reader-profile",
        positionId: null,
        positionName: null,
        phone: null,
        telegram: null,
        status: "active",
        theme: "system",
        accentColor: "blue"
      }
    ];
    const status: TaskStatusRecord = {
      id: "task-status-new",
      tenantId: "tenant-db",
      name: "Новая",
      category: "new",
      sortOrder: 10,
      status: "active",
      isSystem: true,
      createdAt: now,
      updatedAt: now
    };
    let task: TaskRecord = {
      id: "task-stale",
      tenantId: "tenant-db",
      projectId: "project-alpha",
      stageId: null,
      title: "Проверить stale-read",
      description: null,
      status: "new",
      statusId: status.id,
      statusName: status.name,
      statusCategory: "new",
      priority: "normal",
      requesterUserId: "user-requester",
      ownerUserId: "user-executor",
      plannedStart: now,
      plannedFinish: now,
      durationWorkingDays: 1,
      plannedWork: 8,
      actualWork: 0,
      progress: 0,
      requiresAcceptance: false,
      source: "manual",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      participants: [
        { userId: "user-requester", role: "requester" },
        { userId: "user-executor", role: "executor" }
      ]
    };
    let applyPlanningCommandCalled = false;
    const dataSource: ApiTenantDataSource = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return users.find((user) => user.id === userId);
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-db" ? { id: tenantId, name: "DB Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return { id: "reader-profile", permissions: ["tenant.projects.read"] };
      },
      async listUsersByTenantId() {
        return users;
      },
      async listWorkspaceUsers() {
        return users;
      },
      async findSessionByTokenHash() {
        return {
          id: "session-stale",
          tenantId: "tenant-db",
          userId: "user-requester",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async findTaskById() {
        return { ...task, participants: [...task.participants] };
      },
      async listTaskStatuses() {
        return [status];
      },
      async withTransaction(operation) {
        return operation(dataSource);
      },
      async lockTenantResourcePlanning() {
        task = {
          ...task,
          requesterUserId: "user-current-requester",
          participants: [
            { userId: "user-current-requester", role: "requester" },
            { userId: "user-executor", role: "executor" }
          ]
        };
      },
      async getPlanSnapshot() {
        throw new Error("stale task should fail before planning preview");
      },
      async applyPlanningCommand() {
        applyPlanningCommandCalled = true;
      },
      async updateTaskMetadata() {
        throw new Error("stale task should fail before metadata update");
      },
      async incrementPlanVersion() {
        return 2;
      },
      async createTaskActivity() {
        throw new Error("stale task should fail before activity creation");
      },
      async appendAuditEvent() {
        throw new Error("stale task should fail before audit");
      }
    };
    const app = createApp({ dataSource });

    const response = await app.request("/api/workspace/tasks/task-stale", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: "kiss_pm_session=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      },
      body: JSON.stringify({
        title: "Попытка изменения",
        description: null,
        priority: "normal",
        statusId: status.id,
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-01",
        durationWorkingDays: 1,
        plannedWork: 8,
        requiresAcceptance: false,
        clientUpdatedAt: now.toISOString(),
        participants: [{ userId: "user-executor", role: "executor" }]
      })
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(applyPlanningCommandCalled).toBe(false);
  });

  it("serves Phase 7 default KPI definitions through the control backend route", async () => {
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: ["tenant.kpi_definitions.read"]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async listKpiDefinitions() {
        return [];
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/tenant/current/kpi-definitions", {
      headers: { cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "project.deadline_delta_days",
          formula: { type: "builtin", key: "deadline_delta_days" }
        }),
        expect.objectContaining({
          code: "project.resource_overload_minutes",
          formula: { type: "builtin", key: "resource_overload_minutes" }
        })
      ])
    );
  });

  it("writes denied audit when KPI definition upsert lacks manage permission", async () => {
    let upsertCalled = false;
    const auditEvents: Array<{
      actionType: string;
      input: unknown;
      permissionResult: unknown;
      executionResult: unknown;
    }> = [];
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: ["tenant.kpi_definitions.read"]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async upsertKpiDefinition(input) {
        upsertCalled = true;
        return input;
      },
      async appendAuditEvent(input) {
        auditEvents.push(input);
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/tenant/current/kpi-definitions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      body: JSON.stringify({
        code: "project.custom",
        label: "Custom",
        formula: { type: "builtin", key: "deadline_delta_days" },
        thresholdRules: [{ severity: "critical", operator: "gt", value: 0 }]
      })
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(upsertCalled).toBe(false);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actionType: "kpi.definition.upsert_denied",
        input: { route: "/api/tenant/current/kpi-definitions" },
        permissionResult: { allowed: false, reason: "permission_missing" },
        executionResult: { status: "denied" }
      })
    ]);
  });

  it("fails closed before KPI definition upsert when audit transaction support is missing", async () => {
    let upsertCalled = false;
    let auditCalled = false;
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: ["tenant.kpi_definitions.manage"]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async upsertKpiDefinition(input) {
        upsertCalled = true;
        return input;
      },
      async appendAuditEvent() {
        auditCalled = true;
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/tenant/current/kpi-definitions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      body: JSON.stringify({
        code: "project.custom",
        label: "Custom",
        formula: { type: "builtin", key: "deadline_delta_days" },
        thresholdRules: [{ severity: "critical", operator: "gt", value: 0 }]
      })
    });

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({ error: "persistence_not_configured" });
    expect(upsertCalled).toBe(false);
    expect(auditCalled).toBe(false);
  });

  it("materializes default KPI definitions before persisting evaluations", async () => {
    const upsertedDefinitionIds = new Set<string>();
    const evaluationDefinitionIds: string[] = [];
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: [
            "tenant.project_plan.read",
            "tenant.control_signals.read",
            "tenant.control_signals.manage"
          ]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async listKpiDefinitions() {
        return [];
      },
      async upsertKpiDefinition(input) {
        upsertedDefinitionIds.add(input.id);
        return input;
      },
      async getPlanSnapshot() {
        return createControlActionSnapshot();
      },
      async createKpiEvaluation(input) {
        if (!upsertedDefinitionIds.has(input.definitionId)) {
          throw new Error("evaluation_definition_was_not_materialized");
        }
        evaluationDefinitionIds.push(input.definitionId);
        return input;
      },
      async upsertControlSignal(input) {
        return input;
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent() {
        return;
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/workspace/projects/project-control/control/evaluate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(200);
    expect(upsertedDefinitionIds).toEqual(
      new Set([
        "kpi-project-deadline-delta",
        "kpi-project-resource-overload",
        "kpi-project-baseline-slip"
      ])
    );
    expect(evaluationDefinitionIds).toEqual([...upsertedDefinitionIds]);
  });

  it("keeps control signal ids stable across repeated evaluations", async () => {
    const definitions: KpiDefinition[] = [];
    const signalIdsByRun: string[][] = [];
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: [
            "tenant.project_plan.read",
            "tenant.control_signals.read",
            "tenant.control_signals.manage"
          ]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async listKpiDefinitions() {
        return definitions;
      },
      async upsertKpiDefinition(input) {
        const existingIndex = definitions.findIndex(
          (definition) => definition.id === input.id || definition.code === input.code
        );
        if (existingIndex >= 0) {
          definitions[existingIndex] = input;
        } else {
          definitions.push(input);
        }
        return input;
      },
      async getPlanSnapshot() {
        const snapshot = createControlActionSnapshot();
        return {
          ...snapshot,
          project: {
            ...snapshot.project,
            deadline: "2026-05-23"
          }
        };
      },
      async createKpiEvaluation(input) {
        return input;
      },
      async upsertControlSignal(input) {
        const currentRun = signalIdsByRun.at(-1);
        if (currentRun) currentRun.push(input.id);
        return input;
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent() {
        return;
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    for (let index = 0; index < 2; index += 1) {
      signalIdsByRun.push([]);
      const response = await app.request("/api/workspace/projects/project-control/control/evaluate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        body: JSON.stringify({})
      });
      expect(response.status).toBe(200);
    }

    expect(signalIdsByRun[0]).toEqual(["signal-project-control-kpi-project-deadline-delta"]);
    expect(signalIdsByRun[1]).toEqual(signalIdsByRun[0]);
  });

  it("keeps control signal ids unique for KPI definitions sharing one metric", async () => {
    const definitions: KpiDefinition[] = [
      {
        id: "kpi-deadline-warning",
        tenantId: "tenant-control",
        entityType: "project",
        code: "project.deadline.warning",
        label: "Сдвиг срока: предупреждение",
        formula: { type: "builtin", key: "deadline_delta_days" },
        unit: "days",
        period: "snapshot",
        thresholdRules: [{ severity: "warning", operator: "gt", value: 0 }],
        ownerRole: "project_manager",
        allowedActions: ["create_corrective_action"],
        version: 1,
        status: "active"
      },
      {
        id: "kpi-deadline-critical",
        tenantId: "tenant-control",
        entityType: "project",
        code: "project.deadline.critical",
        label: "Сдвиг срока: критично",
        formula: { type: "builtin", key: "deadline_delta_days" },
        unit: "days",
        period: "snapshot",
        thresholdRules: [{ severity: "critical", operator: "gt", value: 0 }],
        ownerRole: "project_manager",
        allowedActions: ["apply_planning_delta"],
        version: 1,
        status: "active"
      }
    ];
    const evaluationsById = new Map<string, string>();
    const persistedSignals: ControlSignal[] = [];
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: [
            "tenant.project_plan.read",
            "tenant.control_signals.read",
            "tenant.control_signals.manage"
          ]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async listKpiDefinitions() {
        return definitions;
      },
      async upsertKpiDefinition(input) {
        return input;
      },
      async getPlanSnapshot() {
        const snapshot = createControlActionSnapshot();
        return {
          ...snapshot,
          project: {
            ...snapshot.project,
            deadline: "2026-05-23"
          }
        };
      },
      async createKpiEvaluation(input) {
        evaluationsById.set(input.id, input.definitionId);
        return input;
      },
      async upsertControlSignal(input) {
        persistedSignals.push(input);
        return input;
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent() {
        return;
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/workspace/projects/project-control/control/evaluate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(200);
    expect(persistedSignals.map((signal) => signal.id)).toEqual([
      "signal-project-control-kpi-deadline-warning",
      "signal-project-control-kpi-deadline-critical"
    ]);
    expect(new Set(persistedSignals.map((signal) => signal.id)).size).toBe(2);
    expect(persistedSignals.every((signal) => signal.evaluationId !== null)).toBe(true);
    expect(persistedSignals.map((signal) => evaluationsById.get(signal.evaluationId ?? ""))).toEqual([
      "kpi-deadline-warning",
      "kpi-deadline-critical"
    ]);
  });

  it("requires control-signal manage permission before persisting KPI evaluations", async () => {
    let createEvaluationCalled = false;
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: ["tenant.project_plan.read", "tenant.control_signals.read"]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async listKpiDefinitions() {
        return [];
      },
      async upsertKpiDefinition(input) {
        return input;
      },
      async getPlanSnapshot() {
        return createControlActionSnapshot();
      },
      async createKpiEvaluation(input) {
        createEvaluationCalled = true;
        return input;
      },
      async upsertControlSignal(input) {
        return input;
      },
      async appendAuditEvent() {
        return;
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/workspace/projects/project-control/control/evaluate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(createEvaluationCalled).toBe(false);
  });

  it("fails closed before KPI evaluation writes when audit transaction support is missing", async () => {
    let snapshotLoaded = false;
    let createEvaluationCalled = false;
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: [
            "tenant.project_plan.read",
            "tenant.control_signals.read",
            "tenant.control_signals.manage"
          ]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async listKpiDefinitions() {
        return [];
      },
      async upsertKpiDefinition(input) {
        return input;
      },
      async getPlanSnapshot() {
        snapshotLoaded = true;
        return createControlActionSnapshot();
      },
      async createKpiEvaluation(input) {
        createEvaluationCalled = true;
        return input;
      },
      async upsertControlSignal(input) {
        return input;
      },
      async appendAuditEvent() {
        return;
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/workspace/projects/project-control/control/evaluate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({ error: "persistence_not_configured" });
    expect(snapshotLoaded).toBe(false);
    expect(createEvaluationCalled).toBe(false);
  });

  it("rejects invalid KPI definition versions before persistence", async () => {
    let upsertCalled = false;
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: ["tenant.kpi_definitions.manage"]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async upsertKpiDefinition(input) {
        upsertCalled = true;
        return input;
      },
      async appendAuditEvent() {
        return;
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/tenant/current/kpi-definitions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      body: JSON.stringify({
        code: "project.invalid",
        label: "Invalid",
        formula: { type: "builtin", key: "deadline_delta_days" },
        thresholdRules: [{ severity: "critical", operator: "gt", value: 0 }],
        version: 0
      })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "kpi_definition_invalid" });
    expect(upsertCalled).toBe(false);
  });

  it("requires project plan read permission for the control read model", async () => {
    let readModelLoaded = false;
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: ["tenant.control_signals.read"]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async listKpiDefinitions() {
        readModelLoaded = true;
        return [];
      },
      async listKpiEvaluations() {
        readModelLoaded = true;
        return [];
      },
      async listControlSignals() {
        readModelLoaded = true;
        return [];
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/workspace/projects/project-control/control/read-model", {
      headers: {
        cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(readModelLoaded).toBe(false);
  });

  it("requires KPI definition read permission before exposing control read-model definitions", async () => {
    let readModelLoaded = false;
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: ["tenant.project_plan.read", "tenant.control_signals.read"]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async listKpiDefinitions() {
        readModelLoaded = true;
        return [];
      },
      async listKpiEvaluations() {
        readModelLoaded = true;
        return [];
      },
      async listControlSignals() {
        readModelLoaded = true;
        return [];
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/workspace/projects/project-control/control/read-model", {
      headers: {
        cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(readModelLoaded).toBe(false);
  });

  it("writes denied audit before loading action candidates when execute permission is missing", async () => {
    let listSignalsCalled = false;
    let createExecutionCalled = false;
    const auditEvents: Array<{
      actionType: string;
      input: unknown;
      executionResult: unknown;
    }> = [];
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: ["tenant.control_signals.read"]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async listControlSignals() {
        listSignalsCalled = true;
        return [];
      },
      async createActionExecution(input) {
        createExecutionCalled = true;
        return {
          ...input,
          createdAt: new Date("2026-05-24T00:00:00.000Z")
        };
      },
      async appendAuditEvent(input) {
        auditEvents.push(input);
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const previewResponse = await app.request(
      "/api/workspace/projects/project-control/control/signals/signal-control-1/actions/action-control-1/preview",
      {
        method: "POST",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }
      }
    );
    const applyResponse = await app.request(
      "/api/workspace/projects/project-control/control/signals/signal-control-1/actions/action-control-1/apply",
      {
        method: "POST",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }
      }
    );

    expect(previewResponse.status).toBe(403);
    expect(applyResponse.status).toBe(403);
    await expect(previewResponse.json()).resolves.toEqual({ error: "permission_missing" });
    await expect(applyResponse.json()).resolves.toEqual({ error: "permission_missing" });
    expect(listSignalsCalled).toBe(false);
    expect(createExecutionCalled).toBe(false);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actionType: "management_action.denied",
        input: {
          projectId: "project-control",
          signalId: "signal-control-1",
          actionId: "action-control-1"
        },
        executionResult: { status: "denied", stage: "preview" }
      }),
      expect.objectContaining({
        actionType: "management_action.denied",
        input: {
          projectId: "project-control",
          signalId: "signal-control-1",
          actionId: "action-control-1"
        },
        executionResult: { status: "denied", stage: "apply" }
      })
    ]);
  });

  it("rejects malformed control route identifiers before session and persistence lookup", async () => {
    const app = createApp();

    const badProject = await app.request(
      "/api/workspace/projects/bad..project/control/read-model"
    );
    const badSignal = await app.request(
      "/api/workspace/projects/project-control/control/signals/bad..signal/actions/action-control-1/preview",
      {
        method: "POST",
        headers: { "x-kiss-pm-action": "same-origin" }
      }
    );
    const badAction = await app.request(
      "/api/workspace/projects/project-control/control/signals/signal-control-1/actions/bad..action/apply",
      {
        method: "POST",
        headers: { "x-kiss-pm-action": "same-origin" }
      }
    );
    const badCorrectiveAction = await app.request(
      "/api/workspace/projects/project-control/control/corrective-actions/bad..action",
      {
        method: "PATCH",
        headers: { "x-kiss-pm-action": "same-origin" }
      }
    );

    expect(badProject.status).toBe(400);
    await expect(badProject.json()).resolves.toEqual({ error: "invalid_project_id" });
    expect(badSignal.status).toBe(400);
    await expect(badSignal.json()).resolves.toEqual({ error: "invalid_control_signal_id" });
    expect(badAction.status).toBe(400);
    await expect(badAction.json()).resolves.toEqual({ error: "invalid_management_action_id" });
    expect(badCorrectiveAction.status).toBe(400);
    await expect(badCorrectiveAction.json()).resolves.toEqual({
      error: "invalid_corrective_action_id"
    });
  });

  it("rejects malformed access role route identifiers before session and persistence lookup", async () => {
    const app = createApp();

    const patchResponse = await app.request("/api/workspace/access-roles/bad..role", {
      method: "PATCH",
      headers: { "x-kiss-pm-action": "same-origin" }
    });
    expect(patchResponse.status).toBe(400);
    await expect(patchResponse.json()).resolves.toEqual({ error: "invalid_access_role_id" });

    const deleteResponse = await app.request("/api/workspace/access-roles/bad..role", {
      method: "DELETE",
      headers: { "x-kiss-pm-action": "same-origin" }
    });
    expect(deleteResponse.status).toBe(400);
    await expect(deleteResponse.json()).resolves.toEqual({ error: "invalid_access_role_id" });
  });

  it("rejects malformed workspace user and position route identifiers before session and persistence lookup", async () => {
    const app = createApp();

    const patchUserResponse = await app.request("/api/workspace/users/bad..user", {
      method: "PATCH",
      headers: { "x-kiss-pm-action": "same-origin" }
    });
    expect(patchUserResponse.status).toBe(400);
    await expect(patchUserResponse.json()).resolves.toEqual({ error: "invalid_user_id" });

    const deleteUserResponse = await app.request("/api/workspace/users/bad..user", {
      method: "DELETE",
      headers: { "x-kiss-pm-action": "same-origin" }
    });
    expect(deleteUserResponse.status).toBe(400);
    await expect(deleteUserResponse.json()).resolves.toEqual({ error: "invalid_user_id" });

    const patchPositionResponse = await app.request("/api/workspace/positions/bad..position", {
      method: "PATCH",
      headers: { "x-kiss-pm-action": "same-origin" }
    });
    expect(patchPositionResponse.status).toBe(400);
    await expect(patchPositionResponse.json()).resolves.toEqual({ error: "invalid_position_id" });

    const deletePositionResponse = await app.request("/api/workspace/positions/bad..position", {
      method: "DELETE",
      headers: { "x-kiss-pm-action": "same-origin" }
    });
    expect(deletePositionResponse.status).toBe(400);
    await expect(deletePositionResponse.json()).resolves.toEqual({ error: "invalid_position_id" });
  });

  it("rejects malformed workspace config route identifiers before session and persistence lookup", async () => {
    const app = createApp();

    const patchFieldResponse = await app.request(
      "/api/workspace/config/custom-fields/bad..field",
      {
        method: "PATCH",
        headers: { "x-kiss-pm-action": "same-origin" }
      }
    );
    expect(patchFieldResponse.status).toBe(400);
    await expect(patchFieldResponse.json()).resolves.toEqual({
      error: "invalid_custom_field_id"
    });

    const patchTemplateResponse = await app.request(
      "/api/workspace/config/project-templates/bad..template",
      {
        method: "PATCH",
        headers: { "x-kiss-pm-action": "same-origin" }
      }
    );
    expect(patchTemplateResponse.status).toBe(400);
    await expect(patchTemplateResponse.json()).resolves.toEqual({
      error: "invalid_project_template_id"
    });
  });

  it("writes denied audit for workspace config read and mutation permission failures", async () => {
    const auditEvents: Array<{
      actionType: string;
      sourceWorkflow?: string | null;
      sourceEntity: { type: string; id: string };
      input: Record<string, unknown>;
      permissionResult: Record<string, unknown>;
      executionResult: Record<string, unknown>;
    }> = [];
    const dataSource: Partial<ApiTenantDataSource> = {
      async findSessionByTokenHash() {
        return {
          id: "session-workspace-config",
          tenantId: "tenant-alpha",
          userId: "user-alpha-limited",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async findUserById(userId) {
        return userId === "user-alpha-limited"
          ? {
              id: userId,
              tenantId: "tenant-alpha",
              name: "Лена Ограниченная",
              accessProfileId: "limited-profile"
            }
          : undefined;
      },
      async findAccessProfileById() {
        return { id: "limited-profile", permissions: [] };
      },
      async listUsersByTenantId() {
        return [];
      },
      async listCustomFieldDefinitions() {
        throw new Error("custom field list must not run after denied decision");
      },
      async createCustomFieldDefinition() {
        throw new Error("custom field create must not run after denied decision");
      },
      async updateCustomFieldDefinition() {
        throw new Error("custom field update must not run after denied decision");
      },
      async listProjectTemplates() {
        throw new Error("project template list must not run after denied decision");
      },
      async createProjectTemplate() {
        throw new Error("project template create must not run after denied decision");
      },
      async updateProjectTemplate() {
        throw new Error("project template update must not run after denied decision");
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent(input) {
        auditEvents.push(input);
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });
    const cookie =
      "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    const readFields = await app.request("/api/workspace/config/custom-fields", {
      headers: { cookie }
    });
    const createField = await app.request("/api/workspace/config/custom-fields", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({})
    });
    const readTemplates = await app.request("/api/workspace/config/project-templates", {
      headers: { cookie }
    });
    const updateTemplate = await app.request(
      "/api/workspace/config/project-templates/template-alpha",
      {
        method: "PATCH",
        headers: {
          cookie,
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin"
        },
        body: JSON.stringify({})
      }
    );

    expect(readFields.status).toBe(403);
    expect(createField.status).toBe(403);
    expect(readTemplates.status).toBe(403);
    expect(updateTemplate.status).toBe(403);
    expect(auditEvents.map((event) => event.actionType)).toEqual([
      "workspace.config.read_denied",
      "workspace.custom_field.create_denied",
      "workspace.config.read_denied",
      "workspace.project_template.update_denied"
    ]);
    expect(auditEvents.map((event) => event.executionResult)).toEqual([
      { status: "denied" },
      { status: "denied" },
      { status: "denied" },
      { status: "denied" }
    ]);
    expect(auditEvents[0]).toMatchObject({
      sourceWorkflow: "single_workspace_config",
      sourceEntity: { type: "WorkspaceConfig", id: "custom-fields" },
      input: { resource: "custom-fields" },
      permissionResult: { allowed: false, reason: "permission_missing" }
    });
    expect(auditEvents[3]).toMatchObject({
      sourceWorkflow: "single_workspace_config",
      sourceEntity: { type: "ProjectTemplate", id: "template-alpha" },
      input: { templateId: "template-alpha" },
      permissionResult: { allowed: false, reason: "permission_missing" }
    });
  });

  it("writes denied audit for RBAC, workspace user, and position permission failures", async () => {
    const auditEvents: Array<{
      actionType: string;
      sourceWorkflow?: string | null;
      sourceEntity: { type: string; id: string };
      input: Record<string, unknown>;
      permissionResult: Record<string, unknown>;
      executionResult: Record<string, unknown>;
    }> = [];
    const dataSource: Partial<ApiTenantDataSource> = {
      async findSessionByTokenHash() {
        return {
          id: "session-admin-denied",
          tenantId: "tenant-alpha",
          userId: "user-alpha-limited",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async findUserById(userId) {
        return userId === "user-alpha-limited"
          ? {
              id: userId,
              tenantId: "tenant-alpha",
              name: "Лена Ограниченная",
              accessProfileId: "limited-profile"
            }
          : undefined;
      },
      async findAccessProfileById() {
        return { id: "limited-profile", permissions: [] };
      },
      async listUsersByTenantId() {
        return [];
      },
      async listAccessProfilesByTenantId() {
        throw new Error("access profile list must not run after denied decision");
      },
      async createAccessProfile() {
        throw new Error("access profile create must not run after denied decision");
      },
      async updateAccessProfile() {
        throw new Error("access profile update must not run after denied decision");
      },
      async deleteAccessProfile() {
        throw new Error("access profile delete must not run after denied decision");
      },
      async listWorkspaceUsers() {
        return [
          {
            id: "user-alpha-limited",
            tenantId: "tenant-alpha",
            email: "limited@kiss-pm.local",
            name: "Лена Ограниченная",
            accessProfileId: "limited-profile",
            positionId: null,
            positionName: null,
            phone: null,
            telegram: null,
            status: "active",
            theme: "light",
            accentColor: "teal"
          }
        ];
      },
      async createWorkspaceUser() {
        throw new Error("workspace user create must not run after denied decision");
      },
      async updateWorkspaceUser() {
        throw new Error("workspace user update must not run after denied decision");
      },
      async deleteWorkspaceUser() {
        throw new Error("workspace user delete must not run after denied decision");
      },
      async upsertCredential() {
        throw new Error("credential upsert must not run after denied decision");
      },
      async updateCredentialEmail() {
        throw new Error("credential email update must not run after denied decision");
      },
      async listPositions() {
        throw new Error("position list must not run after denied decision");
      },
      async createPosition() {
        throw new Error("position create must not run after denied decision");
      },
      async updatePosition() {
        throw new Error("position update must not run after denied decision");
      },
      async deletePosition() {
        throw new Error("position delete must not run after denied decision");
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent(input) {
        auditEvents.push(input);
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });
    const cookie =
      "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const mutationHeaders = {
      cookie,
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin"
    };

    const requestCases = [
      {
        label: "read access roles",
        run: () => app.request("/api/workspace/access-roles", { headers: { cookie } })
      },
      {
        label: "create access profile",
        run: () =>
          app.request("/api/tenant/current/access-profiles", {
            method: "POST",
            headers: mutationHeaders,
            body: JSON.stringify({})
          })
      },
      {
        label: "update access role",
        run: () =>
          app.request("/api/workspace/access-roles/access-profile-limited", {
            method: "PATCH",
            headers: mutationHeaders,
            body: JSON.stringify({})
          })
      },
      {
        label: "delete access role",
        run: () =>
          app.request("/api/workspace/access-roles/access-profile-limited", {
            method: "DELETE",
            headers: mutationHeaders
          })
      },
      {
        label: "read users",
        run: () => app.request("/api/workspace/users", { headers: { cookie } })
      },
      {
        label: "create user",
        run: () =>
          app.request("/api/workspace/users", {
            method: "POST",
            headers: mutationHeaders,
            body: JSON.stringify({})
          })
      },
      {
        label: "update user",
        run: () =>
          app.request("/api/workspace/users/user-alpha-target", {
            method: "PATCH",
            headers: mutationHeaders,
            body: JSON.stringify({})
          })
      },
      {
        label: "delete user",
        run: () =>
          app.request("/api/workspace/users/user-alpha-target", {
            method: "DELETE",
            headers: mutationHeaders
          })
      },
      {
        label: "read positions",
        run: () => app.request("/api/workspace/positions", { headers: { cookie } })
      },
      {
        label: "create position",
        run: () =>
          app.request("/api/workspace/positions", {
            method: "POST",
            headers: mutationHeaders,
            body: JSON.stringify({})
          })
      },
      {
        label: "update position",
        run: () =>
          app.request("/api/workspace/positions/position-alpha", {
            method: "PATCH",
            headers: mutationHeaders,
            body: JSON.stringify({})
          })
      },
      {
        label: "delete position",
        run: () =>
          app.request("/api/workspace/positions/position-alpha", {
            method: "DELETE",
            headers: mutationHeaders
          })
      }
    ];

    for (const requestCase of requestCases) {
      const response = await requestCase.run();
      expect(response.status, requestCase.label).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    }
    expect(auditEvents.map((event) => event.actionType)).toEqual([
      "tenant.access_profile.read_denied",
      "tenant.access_profile.create_denied",
      "tenant.access_profile.update_denied",
      "tenant.access_profile.delete_denied",
      "workspace.user.read_denied",
      "workspace.user.create_denied",
      "workspace.user.update_denied",
      "workspace.user.delete_denied",
      "workspace.position.read_denied",
      "workspace.position.create_denied",
      "workspace.position.update_denied",
      "workspace.position.delete_denied"
    ]);
    expect(auditEvents.map((event) => event.executionResult)).toEqual(
      Array.from({ length: 12 }, () => ({ status: "denied" }))
    );
    expect(auditEvents[2]).toMatchObject({
      sourceWorkflow: "single_workspace_access_roles",
      sourceEntity: { type: "AccessProfile", id: "access-profile-limited" },
      input: { roleId: "access-profile-limited" },
      permissionResult: { allowed: false, reason: "permission_missing" }
    });
    expect(auditEvents[6]).toMatchObject({
      sourceWorkflow: "single_workspace_users",
      sourceEntity: { type: "TenantUser", id: "user-alpha-target" },
      input: { userId: "user-alpha-target" },
      permissionResult: { allowed: false, reason: "permission_missing" }
    });
    expect(auditEvents[10]).toMatchObject({
      sourceWorkflow: "single_workspace_positions",
      sourceEntity: { type: "Position", id: "position-alpha" },
      input: { positionId: "position-alpha" },
      permissionResult: { allowed: false, reason: "permission_missing" }
    });
  });

  it("fails closed before user and position mutations when audit transaction support is missing", async () => {
    const mutationCalls: string[] = [];
    const dataSource: Partial<ApiTenantDataSource> = {
      async findSessionByTokenHash() {
        return {
          id: "session-audit-required",
          tenantId: "tenant-alpha",
          userId: "user-alpha-admin",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async findUserById(userId) {
        return userId === "user-alpha-admin"
          ? {
              id: userId,
              tenantId: "tenant-alpha",
              name: "Анна Администратор",
              accessProfileId: "admin-profile"
            }
          : undefined;
      },
      async listWorkspaceUsers() {
        return [
          {
            id: "user-alpha-admin",
            tenantId: "tenant-alpha",
            email: "admin@kiss-pm.local",
            name: "Анна Администратор",
            accessProfileId: "admin-profile",
            positionId: null,
            positionName: null,
            phone: null,
            telegram: null,
            status: "active",
            theme: "light",
            accentColor: "teal"
          },
          {
            id: "user-alpha-target",
            tenantId: "tenant-alpha",
            email: "target@kiss-pm.local",
            name: "Тимур Целевой",
            accessProfileId: "admin-profile",
            positionId: null,
            positionName: null,
            phone: null,
            telegram: null,
            status: "active",
            theme: "light",
            accentColor: "teal"
          }
        ];
      },
      async findAccessProfileById() {
        return {
          id: "admin-profile",
          permissions: [
            "tenant.users.manage",
            "tenant.positions.manage"
          ]
        };
      },
      async listPositions() {
        mutationCalls.push("listPositions");
        return [];
      },
      async deleteWorkspaceUser() {
        mutationCalls.push("deleteWorkspaceUser");
      },
      async createPosition() {
        mutationCalls.push("createPosition");
        throw new Error("createPosition must not run without audit transaction");
      },
      async updatePosition() {
        mutationCalls.push("updatePosition");
        throw new Error("updatePosition must not run without audit transaction");
      },
      async deletePosition() {
        mutationCalls.push("deletePosition");
        throw new Error("deletePosition must not run without audit transaction");
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });
    const cookie =
      "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const mutationHeaders = {
      cookie,
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin"
    };

    const responses = [
      await app.request("/api/workspace/users/user-alpha-target", {
        method: "DELETE",
        headers: { cookie, "x-kiss-pm-action": "same-origin" }
      }),
      await app.request("/api/workspace/positions", {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({
          id: "position-alpha",
          name: "Руководитель проекта"
        })
      }),
      await app.request("/api/workspace/positions/position-alpha", {
        method: "PATCH",
        headers: mutationHeaders,
        body: JSON.stringify({
          name: "Руководитель проекта"
        })
      }),
      await app.request("/api/workspace/positions/position-alpha", {
        method: "DELETE",
        headers: { cookie, "x-kiss-pm-action": "same-origin" }
      })
    ];

    for (const response of responses) {
      expect(response.status).toBe(501);
      await expect(response.json()).resolves.toEqual({
        error: "persistence_not_configured"
      });
    }
    expect(mutationCalls).toEqual([]);
  });

  it("fails closed before profile mutations when audit transaction support is missing", async () => {
    const mutationCalls: string[] = [];
    const dataSource: Partial<ApiTenantDataSource> = {
      async findSessionByTokenHash() {
        return {
          id: "session-profile-audit-required",
          tenantId: "tenant-alpha",
          userId: "user-alpha-admin",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async findUserById(userId) {
        return userId === "user-alpha-admin"
          ? {
              id: userId,
              tenantId: "tenant-alpha",
              name: "Анна Администратор",
              accessProfileId: "admin-profile"
            }
          : undefined;
      },
      async listWorkspaceUsers() {
        return [
          {
            id: "user-alpha-admin",
            tenantId: "tenant-alpha",
            email: "admin@kiss-pm.local",
            name: "Анна Администратор",
            accessProfileId: "admin-profile",
            positionId: null,
            positionName: null,
            phone: null,
            telegram: null,
            status: "active",
            theme: "light",
            accentColor: "teal"
          }
        ];
      },
      async updateWorkspaceUser() {
        mutationCalls.push("updateWorkspaceUser");
        throw new Error("profile update must not run without audit transaction");
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });
    const cookie =
      "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const mutationHeaders = {
      cookie,
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin"
    };

    const profileResponse = await app.request("/api/profile", {
      method: "PATCH",
      headers: mutationHeaders,
      body: JSON.stringify({ name: "Анна Новая" })
    });
    const themeResponse = await app.request("/api/profile/theme", {
      method: "PATCH",
      headers: mutationHeaders,
      body: JSON.stringify({ theme: "dark", accentColor: "#0f766e" })
    });

    for (const response of [profileResponse, themeResponse]) {
      expect(response.status).toBe(501);
      await expect(response.json()).resolves.toEqual({
        error: "persistence_not_configured"
      });
    }
    expect(mutationCalls).toEqual([]);
  });

  it("rejects unsafe profile metadata before mutation or audit", async () => {
    const mutationCalls: string[] = [];
    const auditEvents: unknown[] = [];
    const dataSource: Partial<ApiTenantDataSource> = {
      async findSessionByTokenHash() {
        return {
          id: "session-profile-sanitization",
          tenantId: "tenant-alpha",
          userId: "user-alpha-admin",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async findUserById(userId) {
        return userId === "user-alpha-admin"
          ? {
              id: userId,
              tenantId: "tenant-alpha",
              name: "Анна Администратор",
              accessProfileId: "admin-profile"
            }
          : undefined;
      },
      async findAccessProfileById() {
        return { id: "admin-profile", permissions: ["profile.update"] };
      },
      async listWorkspaceUsers() {
        return [
          {
            id: "user-alpha-admin",
            tenantId: "tenant-alpha",
            email: "admin@kiss-pm.local",
            name: "Анна Администратор",
            accessProfileId: "admin-profile",
            positionId: null,
            positionName: null,
            phone: null,
            telegram: null,
            status: "active",
            theme: "light",
            accentColor: "teal"
          }
        ];
      },
      async updateWorkspaceUser() {
        mutationCalls.push("updateWorkspaceUser");
        throw new Error("unsafe profile metadata must not reach mutation");
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent(input) {
        auditEvents.push(input);
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });
    const cookie =
      "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    const response = await app.request("/api/profile", {
      method: "PATCH",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({ name: "Анна\u0000Администратор" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_profile_payload"
    });
    expect(mutationCalls).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it("rejects malformed CRM route identifiers before session and persistence lookup", async () => {
    const app = createApp();
    const headers = { "x-kiss-pm-action": "same-origin" };

    const badClient = await app.request("/api/workspace/clients/bad..client", {
      method: "PATCH",
      headers
    });
    const badContact = await app.request("/api/workspace/contacts/bad..contact", {
      method: "PATCH",
      headers
    });
    const badProduct = await app.request("/api/workspace/products/bad_product", {
      method: "PATCH",
      headers
    });
    const badProjectType = await app.request(
      "/api/workspace/project-types/bad..project-type",
      {
        method: "PATCH",
        headers
      }
    );
    const badDealStage = await app.request("/api/workspace/deal-stages/bad..stage", {
      method: "PATCH",
      headers
    });

    expect(badClient.status).toBe(400);
    await expect(badClient.json()).resolves.toEqual({ error: "invalid_client_id" });
    expect(badContact.status).toBe(400);
    await expect(badContact.json()).resolves.toEqual({ error: "invalid_contact_id" });
    expect(badProduct.status).toBe(400);
    await expect(badProduct.json()).resolves.toEqual({ error: "invalid_product_id" });
    expect(badProjectType.status).toBe(400);
    await expect(badProjectType.json()).resolves.toEqual({
      error: "invalid_project_type_id"
    });
    expect(badDealStage.status).toBe(400);
    await expect(badDealStage.json()).resolves.toEqual({
      error: "invalid_deal_stage_id"
    });
  });

  it("rejects malformed opportunity route identifiers before session and persistence lookup", async () => {
    const app = createApp();
    const actionHeaders = { "x-kiss-pm-action": "same-origin" };

    const detail = await app.request("/api/workspace/opportunities/bad..opportunity");
    const update = await app.request("/api/workspace/opportunities/bad..opportunity", {
      method: "PATCH",
      headers: actionHeaders
    });
    const stage = await app.request("/api/workspace/opportunities/bad..opportunity/stage", {
      method: "PATCH",
      headers: actionHeaders
    });
    const finalize = await app.request(
      "/api/workspace/opportunities/bad..opportunity/finalize",
      {
        method: "PATCH",
        headers: actionHeaders
      }
    );
    const feasibility = await app.request(
      "/api/workspace/opportunities/bad..opportunity/feasibility",
      {
        method: "POST",
        headers: actionHeaders
      }
    );
    const activate = await app.request(
      "/api/workspace/opportunities/bad..opportunity/activate",
      {
        method: "POST",
        headers: actionHeaders
      }
    );

    for (const response of [detail, update, stage, finalize, feasibility, activate]) {
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "invalid_opportunity_id"
      });
    }
  });

  it("rejects malformed CRM activity route identifiers before session and persistence lookup", async () => {
    const app = createApp();
    const actionHeaders = { "x-kiss-pm-action": "same-origin" };

    const read = await app.request("/api/workspace/crm/client/bad..client/activity");
    const comment = await app.request("/api/workspace/crm/client/bad..client/comments", {
      method: "POST",
      headers: actionHeaders
    });
    const task = await app.request("/api/workspace/crm/client/bad..client/tasks", {
      method: "POST",
      headers: actionHeaders
    });
    const file = await app.request("/api/workspace/crm/client/bad..client/files", {
      method: "POST",
      headers: actionHeaders
    });
    const invalidActivity = await app.request(
      "/api/workspace/crm/client/client-alpha/tasks/bad..activity",
      {
        method: "PATCH",
        headers: actionHeaders
      }
    );
    const invalidEntityType = await app.request(
      "/api/workspace/crm/invoice/client-alpha/activity"
    );

    for (const response of [read, comment, task, file]) {
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "invalid_client_id" });
    }
    expect(invalidActivity.status).toBe(400);
    await expect(invalidActivity.json()).resolves.toEqual({
      error: "invalid_crm_activity_id"
    });
    expect(invalidEntityType.status).toBe(400);
    await expect(invalidEntityType.json()).resolves.toEqual({
      error: "crm_entity_type_invalid"
    });
  });

  it("rejects malformed absence route identifiers before session and persistence lookup", async () => {
    const app = createApp();

    const response = await app.request("/api/tenant/current/absences/bad..absence", {
      method: "DELETE",
      headers: { "x-kiss-pm-action": "same-origin" }
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_absence_id" });
  });

  it("rejects malformed planning route identifiers before session and persistence lookup", async () => {
    const app = createApp();
    const actionHeaders = { "x-kiss-pm-action": "same-origin" };

    const projectRoutes = [
      app.request("/api/workspace/projects/bad..project/planning/read-model"),
      app.request("/api/workspace/projects/bad..project/planning/preview-command", {
        method: "POST",
        headers: actionHeaders
      }),
      app.request("/api/workspace/projects/bad..project/planning/apply-command", {
        method: "POST",
        headers: actionHeaders
      }),
      app.request("/api/workspace/projects/bad..project/planning/apply-command-batch", {
        method: "POST",
        headers: actionHeaders
      }),
      app.request("/api/workspace/projects/bad..project/planning/baselines"),
      app.request("/api/workspace/projects/bad..project/planning/events"),
      app.request("/api/workspace/projects/bad..project/planning/auto-solver-runs", {
        method: "POST",
        headers: actionHeaders
      })
    ];

    for (const responsePromise of projectRoutes) {
      const response = await responsePromise;
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "invalid_project_id" });
    }

    const badScenario = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenarios/bad..scenario/apply",
      {
        method: "POST",
        headers: actionHeaders
      }
    );
    expect(badScenario.status).toBe(400);
    await expect(badScenario.json()).resolves.toEqual({
      error: "invalid_planning_scenario_id"
    });

    const badSolverRun = await app.request(
      "/api/workspace/projects/project-alpha/planning/auto-solver-runs/bad..run"
    );
    expect(badSolverRun.status).toBe(400);
    await expect(badSolverRun.json()).resolves.toEqual({
      error: "invalid_planning_solver_run_id"
    });

    const badSolverProposal = await app.request(
      "/api/workspace/projects/project-alpha/planning/auto-solver-runs/planning-auto-solver-550e8400-e29b-41d4-a716-446655440000/proposals/bad..proposal/apply",
      {
        method: "POST",
        headers: actionHeaders
      }
    );
    expect(badSolverProposal.status).toBe(400);
    await expect(badSolverProposal.json()).resolves.toEqual({
      error: "invalid_planning_solver_proposal_id"
    });

    const badSavedView = await app.request(
      "/api/workspace/projects/project-alpha/planning/saved-views/bad..view",
      {
        method: "DELETE",
        headers: actionHeaders
      }
    );
    expect(badSavedView.status).toBe(400);
    await expect(badSavedView.json()).resolves.toEqual({
      error: "invalid_saved_view_id"
    });
  });

  it("rejects malformed audit query identifiers before session and persistence lookup", async () => {
    const app = createApp();

    const response = await app.request(
      "/api/tenant/current/audit-events?projectId=bad..project"
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_project_id" });

    const invalidLimit = await app.request(
      "/api/tenant/current/audit-events?limit=100.5"
    );
    expect(invalidLimit.status).toBe(400);
    await expect(invalidLimit.json()).resolves.toEqual({ error: "invalid_audit_limit" });
  });

  it("rejects malformed scheduled-task query before session and persistence lookup", async () => {
    const app = createApp();

    const badAssignee = await app.request(
      "/api/tenant/current/scheduled-tasks?assigneeUserId=bad/user&fromDate=2026-06-01&toDate=2026-06-30"
    );
    expect(badAssignee.status).toBe(400);
    await expect(badAssignee.json()).resolves.toEqual({ error: "scheduled_tasks_invalid" });

    const invalidDate = await app.request(
      "/api/tenant/current/scheduled-tasks?assigneeUserId=user-alpha-admin&fromDate=2026-02-31&toDate=2026-06-30"
    );
    expect(invalidDate.status).toBe(400);
    await expect(invalidDate.json()).resolves.toEqual({ error: "scheduled_tasks_invalid" });

    const oversizedRange = await app.request(
      "/api/tenant/current/scheduled-tasks?assigneeUserId=user-alpha-admin&fromDate=2026-01-01&toDate=2027-12-31"
    );
    expect(oversizedRange.status).toBe(400);
    await expect(oversizedRange.json()).resolves.toEqual({ error: "scheduled_tasks_invalid" });
  });

  it("rejects control action preview when action-specific permissions are missing", async () => {
    let createdExecutionStatus: string | null = null;
    let auditActionType: string | null = null;
    const actionCommand: PlanningCommand = {
      type: "task.update_work_model",
      payload: {
        taskId: "task-control-1",
        taskType: "fixed_units",
        effortDriven: false,
        durationMinutes: 420,
        workMinutes: 420
      }
    };
    const signal: ControlSignal = {
      id: "signal-control-1",
      tenantId: "tenant-control",
      projectId: "project-control",
      sourceEntity: { type: "Project", id: "project-control" },
      sourceMetric: "deadline_delta_days",
      evaluationId: "eval-control-1",
      severity: "critical",
      explanation: "Project finish is after deadline",
      ownerUserId: null,
      allowedActions: ["apply_planning_delta"],
      scenarioProposals: [
        {
          id: "action-control-1",
          type: "apply_planning_delta",
          label: "Compress critical task",
          targetEntity: { type: "ControlSignal", id: "signal-control-1" },
          requiredPermissions: ["tenant.project_plan.manage"],
          planDelta: {
            commands: [actionCommand],
            changedTaskIds: ["task-control-1"],
            changedAssignmentIds: [],
            changedDependencyIds: [],
            acceptedRiskIds: []
          },
          input: { taskId: "task-control-1" },
          explainability: {
            reason: "Deadline-first correction",
            deadlineDeltaDays: 0,
            overloadMinutes: 0,
            changedTaskIds: ["task-control-1"],
            changedAssignmentIds: [],
            riskScore: 20,
            cost: 120
          }
        }
      ],
      status: "open",
      createdAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z"
    };
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: ["tenant.control_signals.read", "tenant.management_actions.execute"]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async listControlSignals() {
        return [signal];
      },
      async createActionExecution(input) {
        createdExecutionStatus = input.status;
        return {
          ...input,
          createdAt: new Date("2026-05-24T00:00:00.000Z")
        };
      },
      async appendAuditEvent(input) {
        auditActionType = input.actionType;
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request(
      "/api/workspace/projects/project-control/control/signals/signal-control-1/actions/action-control-1/preview",
      {
        method: "POST",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(createdExecutionStatus).toBe("denied");
    expect(auditActionType).toBe("management_action.denied");
  });

  it("applies Phase 7 action candidates through the governed planning command path", async () => {
    let snapshot = createControlActionSnapshot();
    let appliedCommand: PlanningCommand | null = null;
    let createdExecutionStatus: string | null = null;
    let auditActionType: string | null = null;
    const actionCommand: PlanningCommand = {
      type: "task.update_work_model",
      payload: {
        taskId: "task-control-1",
        taskType: "fixed_units",
        effortDriven: false,
        durationMinutes: 420,
        workMinutes: 420
      }
    };
    const signal: ControlSignal = {
      id: "signal-control-1",
      tenantId: "tenant-control",
      projectId: "project-control",
      sourceEntity: { type: "Project", id: "project-control" },
      sourceMetric: "deadline_delta_days",
      evaluationId: "eval-control-1",
      severity: "critical",
      explanation: "Project finish is after deadline",
      ownerUserId: null,
      allowedActions: ["apply_planning_delta"],
      scenarioProposals: [
        {
          id: "action-control-1",
          type: "apply_planning_delta",
          label: "Compress critical task",
          targetEntity: { type: "ControlSignal", id: "signal-control-1" },
          requiredPermissions: ["tenant.project_plan.manage"],
          planDelta: {
            commands: [actionCommand],
            changedTaskIds: ["task-control-1"],
            changedAssignmentIds: [],
            changedDependencyIds: [],
            acceptedRiskIds: []
          },
          input: { taskId: "task-control-1" },
          explainability: {
            reason: "Deadline-first correction",
            deadlineDeltaDays: 0,
            overloadMinutes: 0,
            changedTaskIds: ["task-control-1"],
            changedAssignmentIds: [],
            riskScore: 20,
            cost: 120
          }
        }
      ],
      status: "open",
      createdAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z"
    };
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: [
            "tenant.control_signals.read",
            "tenant.management_actions.execute",
            "tenant.project_plan.manage"
          ]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async lockTenantResourcePlanning() {
        return;
      },
      async listControlSignals() {
        return [signal];
      },
      async getPlanSnapshot() {
        return snapshot;
      },
      async applyPlanningCommand(input) {
        const command = input.command;
        appliedCommand = command;
        if (command.type === "task.update_work_model") {
          snapshot = {
            ...snapshot,
            tasks: snapshot.tasks.map((task) =>
              task.id === command.payload.taskId
                ? {
                    ...task,
                    durationMinutes: command.payload.durationMinutes,
                    workMinutes: command.payload.workMinutes
                  }
                : task
            )
          };
        }
      },
      async incrementPlanVersion() {
        snapshot = { ...snapshot, planVersion: snapshot.planVersion + 1 };
        return snapshot.planVersion;
      },
      async createActionExecution(input) {
        createdExecutionStatus = input.status;
        return {
          ...input,
          createdAt: new Date("2026-05-24T00:00:00.000Z")
        };
      },
      async appendAuditEvent(input) {
        auditActionType = input.actionType;
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request(
      "/api/workspace/projects/project-control/control/signals/signal-control-1/actions/action-control-1/apply",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        body: JSON.stringify({ clientPlanVersion: 5 })
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(appliedCommand).toEqual(actionCommand);
    expect(createdExecutionStatus).toBe("succeeded");
    expect(auditActionType).toBe("management_action.applied");
    expect(body.newPlanVersion).toBe(6);
    expect(body.applied.changedTaskIds).toEqual(["task-control-1"]);
    expect(body.readModel.planVersion).toBe(6);
  });

  it("rechecks control action permissions after acquiring the planning lock", async () => {
    const snapshot = createControlActionSnapshot();
    let appliedCommand: PlanningCommand | null = null;
    let auditActionType: string | null = null;
    let listControlSignalsCalls = 0;
    const actionCommand: PlanningCommand = {
      type: "task.update_work_model",
      payload: {
        taskId: "task-control-1",
        taskType: "fixed_units",
        effortDriven: false,
        durationMinutes: 420,
        workMinutes: 420
      }
    };
    const baseSignal: ControlSignal = {
      id: "signal-control-1",
      tenantId: "tenant-control",
      projectId: "project-control",
      sourceEntity: { type: "Project", id: "project-control" },
      sourceMetric: "deadline_delta_days",
      evaluationId: "eval-control-1",
      severity: "critical",
      explanation: "Project finish is after deadline",
      ownerUserId: null,
      allowedActions: ["apply_planning_delta"],
      scenarioProposals: [
        {
          id: "action-control-1",
          type: "apply_planning_delta",
          label: "Compress critical task",
          targetEntity: { type: "ControlSignal", id: "signal-control-1" },
          requiredPermissions: ["tenant.project_plan.manage"],
          planDelta: {
            commands: [actionCommand],
            changedTaskIds: ["task-control-1"],
            changedAssignmentIds: [],
            changedDependencyIds: [],
            acceptedRiskIds: []
          },
          input: { taskId: "task-control-1" },
          explainability: {
            reason: "Deadline-first correction",
            deadlineDeltaDays: 0,
            overloadMinutes: 0,
            changedTaskIds: ["task-control-1"],
            changedAssignmentIds: [],
            riskScore: 20,
            cost: 120
          }
        }
      ],
      status: "open",
      createdAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z"
    };
    const lockedSignal: ControlSignal = {
      ...baseSignal,
      scenarioProposals: [
        {
          ...baseSignal.scenarioProposals[0]!,
          requiredPermissions: ["tenant.project_resources.manage"]
        }
      ]
    };
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: [
            "tenant.control_signals.read",
            "tenant.management_actions.execute",
            "tenant.project_plan.manage"
          ]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async lockTenantResourcePlanning() {
        return;
      },
      async listControlSignals() {
        listControlSignalsCalls += 1;
        return listControlSignalsCalls === 1 ? [baseSignal] : [lockedSignal];
      },
      async getPlanSnapshot() {
        return snapshot;
      },
      async applyPlanningCommand(input) {
        appliedCommand = input.command;
      },
      async incrementPlanVersion() {
        return 6;
      },
      async createActionExecution(input) {
        return {
          ...input,
          createdAt: new Date("2026-05-24T00:00:00.000Z")
        };
      },
      async appendAuditEvent(input) {
        auditActionType = input.actionType;
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request(
      "/api/workspace/projects/project-control/control/signals/signal-control-1/actions/action-control-1/apply",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        body: JSON.stringify({ clientPlanVersion: 5 })
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(appliedCommand).toBeNull();
    expect(auditActionType).toBe("management_action.denied");
  });

  it("rechecks control action plan delta after acquiring the planning lock", async () => {
    const snapshot = createControlActionSnapshot();
    let appliedCommand: PlanningCommand | null = null;
    let listControlSignalsCalls = 0;
    const actionCommand: PlanningCommand = {
      type: "task.update_work_model",
      payload: {
        taskId: "task-control-1",
        taskType: "fixed_units",
        effortDriven: false,
        durationMinutes: 420,
        workMinutes: 420
      }
    };
    const baseSignal: ControlSignal = {
      id: "signal-control-1",
      tenantId: "tenant-control",
      projectId: "project-control",
      sourceEntity: { type: "Project", id: "project-control" },
      sourceMetric: "deadline_delta_days",
      evaluationId: "eval-control-1",
      severity: "critical",
      explanation: "Project finish is after deadline",
      ownerUserId: null,
      allowedActions: ["apply_planning_delta"],
      scenarioProposals: [
        {
          id: "action-control-1",
          type: "apply_planning_delta",
          label: "Compress critical task",
          targetEntity: { type: "ControlSignal", id: "signal-control-1" },
          requiredPermissions: ["tenant.project_plan.manage"],
          planDelta: {
            commands: [actionCommand],
            changedTaskIds: ["task-control-1"],
            changedAssignmentIds: [],
            changedDependencyIds: [],
            acceptedRiskIds: []
          },
          input: { taskId: "task-control-1" },
          explainability: {
            reason: "Deadline-first correction",
            deadlineDeltaDays: 0,
            overloadMinutes: 0,
            changedTaskIds: ["task-control-1"],
            changedAssignmentIds: [],
            riskScore: 20,
            cost: 120
          }
        }
      ],
      status: "open",
      createdAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z"
    };
    const lockedSignal: ControlSignal = {
      ...baseSignal,
      scenarioProposals: [
        {
          ...baseSignal.scenarioProposals[0]!,
          planDelta: {
            commands: [],
            changedTaskIds: [],
            changedAssignmentIds: [],
            changedDependencyIds: [],
            acceptedRiskIds: []
          }
        }
      ]
    };
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: [
            "tenant.control_signals.read",
            "tenant.management_actions.execute",
            "tenant.project_plan.manage"
          ]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async lockTenantResourcePlanning() {
        return;
      },
      async listControlSignals() {
        listControlSignalsCalls += 1;
        return listControlSignalsCalls === 1 ? [baseSignal] : [lockedSignal];
      },
      async getPlanSnapshot() {
        return snapshot;
      },
      async applyPlanningCommand(input) {
        appliedCommand = input.command;
      },
      async incrementPlanVersion() {
        return 6;
      },
      async createActionExecution(input) {
        return {
          ...input,
          createdAt: new Date("2026-05-24T00:00:00.000Z")
        };
      },
      async appendAuditEvent() {
        return;
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request(
      "/api/workspace/projects/project-control/control/signals/signal-control-1/actions/action-control-1/apply",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        body: JSON.stringify({ clientPlanVersion: 5 })
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "action_candidate_has_no_plan_delta" });
    expect(appliedCommand).toBeNull();
  });

  it("requires planning-command permissions for control action plan deltas", async () => {
    const snapshot = createControlActionSnapshot();
    let appliedCommand: PlanningCommand | null = null;
    const actionCommand: PlanningCommand = {
      type: "assignment.upsert",
      payload: {
        id: "assignment-control-1",
        taskId: "task-control-1",
        resourceId: "resource-control-1",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 480
      }
    };
    const signal: ControlSignal = {
      id: "signal-control-1",
      tenantId: "tenant-control",
      projectId: "project-control",
      sourceEntity: { type: "Project", id: "project-control" },
      sourceMetric: "resource_overload_minutes",
      evaluationId: "eval-control-1",
      severity: "critical",
      explanation: "Resource overload",
      ownerUserId: null,
      allowedActions: ["apply_planning_delta"],
      scenarioProposals: [
        {
          id: "action-control-1",
          type: "apply_planning_delta",
          label: "Move assignment",
          targetEntity: { type: "ControlSignal", id: "signal-control-1" },
          requiredPermissions: ["tenant.planning_scenarios.apply"],
          planDelta: {
            commands: [actionCommand],
            changedTaskIds: ["task-control-1"],
            changedAssignmentIds: ["assignment-control-1"],
            changedDependencyIds: [],
            acceptedRiskIds: []
          },
          input: { taskId: "task-control-1" },
          explainability: {
            reason: "Resource correction",
            deadlineDeltaDays: 0,
            overloadMinutes: 0,
            changedTaskIds: ["task-control-1"],
            changedAssignmentIds: ["assignment-control-1"],
            riskScore: 30,
            cost: 130
          }
        }
      ],
      status: "open",
      createdAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z"
    };
    const dataSource: Partial<ApiTenantDataSource> = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === "user-control"
          ? {
              id: "user-control",
              tenantId: "tenant-control",
              name: "Ольга Контроль",
              accessProfileId: "control-profile"
            }
          : undefined;
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-control" ? { id: tenantId, name: "Control Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return {
          id: "control-profile",
          permissions: [
            "tenant.control_signals.read",
            "tenant.management_actions.execute",
            "tenant.planning_scenarios.apply"
          ]
        };
      },
      async listUsersByTenantId() {
        return [];
      },
      async findSessionByTokenHash() {
        return {
          id: "session-control",
          tenantId: "tenant-control",
          userId: "user-control",
          tokenHash: "ignored",
          expiresAt: new Date("2099-01-01T00:00:00.000Z")
        };
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async lockTenantResourcePlanning() {
        return;
      },
      async listControlSignals() {
        return [signal];
      },
      async getPlanSnapshot() {
        return snapshot;
      },
      async applyPlanningCommand(input) {
        appliedCommand = input.command;
      },
      async incrementPlanVersion() {
        return 6;
      },
      async createActionExecution(input) {
        return {
          ...input,
          createdAt: new Date("2026-05-24T00:00:00.000Z")
        };
      },
      async appendAuditEvent() {
        return;
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request(
      "/api/workspace/projects/project-control/control/signals/signal-control-1/actions/action-control-1/apply",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        body: JSON.stringify({ clientPlanVersion: 5 })
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(appliedCommand).toBeNull();
  });
});

function createControlActionSnapshot(): PlanSnapshot {
  return {
    tenantId: "tenant-control",
    projectId: "project-control",
    planVersion: 5,
    project: {
      id: "project-control",
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-05-24",
      plannedFinish: "2026-05-26",
      deadline: "2026-05-25",
      calendarId: "calendar-control"
    },
    tasks: [
      {
        id: "task-control-1",
        parentTaskId: null,
        wbsCode: "1",
        title: "Critical control task",
        statusId: "task-status-new",
        schedulingMode: "auto",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStart: "2026-05-24",
        plannedFinish: "2026-05-24",
        durationMinutes: 480,
        workMinutes: 480,
        percentComplete: 0,
        calendarId: "calendar-control",
        constraint: null
      }
    ],
    assignments: [],
    dependencies: [],
    baselines: [],
    calendars: [
      {
        id: "calendar-control",
        workingWeekdays: [0, 1, 2, 3, 4, 5, 6],
        workingMinutesPerDay: 480
      }
    ],
    calendarExceptions: [],
    resources: [],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-24T00:00:00.000Z"
  };
}
