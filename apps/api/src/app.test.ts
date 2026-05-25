import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import type { ApiTenantDataSource, WorkspaceUserRecord } from "./apiTypes";
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
          expiresAt: new Date("2026-07-01T00:00:00.000Z")
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
        cookie: "kiss_pm_session=stale-token"
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
          expiresAt: new Date("2026-07-01T00:00:00.000Z")
        };
      },
      async listKpiDefinitions() {
        return [];
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/tenant/current/kpi-definitions", {
      headers: { cookie: "kiss_pm_session=control-token" }
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
          expiresAt: new Date("2026-07-01T00:00:00.000Z")
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
        cookie: "kiss_pm_session=control-token"
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
          expiresAt: new Date("2026-07-01T00:00:00.000Z")
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
          cookie: "kiss_pm_session=control-token"
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
          expiresAt: new Date("2026-07-01T00:00:00.000Z")
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
        cookie: "kiss_pm_session=control-token"
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
          expiresAt: new Date("2026-07-01T00:00:00.000Z")
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
        cookie: "kiss_pm_session=control-token"
      },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
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
          expiresAt: new Date("2026-07-01T00:00:00.000Z")
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
        cookie: "kiss_pm_session=control-token"
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
          expiresAt: new Date("2026-07-01T00:00:00.000Z")
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
          cookie: "kiss_pm_session=control-token"
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
          expiresAt: new Date("2026-07-01T00:00:00.000Z")
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
          cookie: "kiss_pm_session=control-token"
        },
        body: JSON.stringify({ clientPlanVersion: 5 })
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(appliedCommand).toBeNull();
    expect(auditActionType).toBe("management_action.denied");
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
          expiresAt: new Date("2026-07-01T00:00:00.000Z")
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
          cookie: "kiss_pm_session=control-token"
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
