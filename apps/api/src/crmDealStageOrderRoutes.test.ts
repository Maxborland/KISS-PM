/* ============================================================
   Регрессия: переупорядочивание стадий воронки.

   Прежний клиент слал N последовательных PATCH /deal-stages/:id (обмен sortOrder
   соседей). Индекс crm_pipeline_stages_tenant_pipeline_sort_order_uidx — immediate,
   поэтому ЛЮБОЙ порядок из двух независимых шагов даёт промежуточный дубль sort_order
   и 23505, который улетал в app.onError как необработанный 500. Фича не работала
   ни для одной воронки с различными sortOrder — включая сид при регистрации.

   Тест бьёт по РЕАЛЬНОМУ пути записи, а не по чистому планировщику: in-memory
   data source воспроизводит immediate-unique (как Postgres) и откатывает транзакцию
   при throw. Поэтому «две последовательные PATCH» здесь падают так же, как в БД.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { createAccessProfile } from "@kiss-pm/access-control";
import { createTenantUser } from "@kiss-pm/domain";
import type { DealStageRecord, PipelineRecord } from "@kiss-pm/persistence";
import { Hono } from "hono";

import type { ApiTenantDataSource, AuditEventListItem, ManagementAuditEventInput } from "./apiTypes";
import { registerCrmRoutes } from "./crmRoutes";

const actor = createTenantUser({
  id: "user-alpha-admin",
  tenantId: "tenant-alpha",
  name: "Alpha Admin",
  accessProfileId: "profile-admin"
});

const adminProfile = createAccessProfile({
  id: "profile-admin",
  permissions: ["tenant.deal_stages.read", "tenant.deal_stages.manage"]
});

const headers = { "content-type": "application/json", cookie: "kiss_pm_session=test" };

describe("Переупорядочивание стадий воронки", () => {
  it("последовательные PATCH /deal-stages/:id ловят конфликт sort_order и отвечают 409, а не 500", async () => {
    // Доказательство механики находки: обмен A(1)<->B(2) двумя запросами невозможен.
    const fixture = createRouteFixture();

    const first = await fixture.app.request("/api/workspace/deal-stages/deal-stage-a", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "Первая", sortOrder: 2, status: "active" })
    });
    expect(first.status).toBe(409);
    expect(await first.json()).toEqual({ error: "deal_stage_sort_order_taken" });

    // Обратный порядок шагов сталкивается ровно так же — безопасной последовательности нет.
    const reversed = await fixture.app.request("/api/workspace/deal-stages/deal-stage-b", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "Вторая", sortOrder: 1, status: "active" })
    });
    expect(reversed.status).toBe(409);

    // Ничего не сдвинулось.
    expect(fixture.stageOrder()).toEqual(["deal-stage-a", "deal-stage-b", "deal-stage-c"]);
  });

  it("PATCH /pipelines/:id/stage-order переставляет соседей одной транзакцией", async () => {
    const fixture = createRouteFixture();

    const response = await fixture.app.request("/api/workspace/pipelines/pipeline-default/stage-order", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ stageIds: ["deal-stage-b", "deal-stage-a", "deal-stage-c"] })
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { dealStages: DealStageRecord[] };
    expect(body.dealStages.map((stage) => stage.id)).toEqual([
      "deal-stage-b",
      "deal-stage-a",
      "deal-stage-c"
    ]);
    // Плотная нумерация 1..N без дыр и дублей.
    expect(body.dealStages.map((stage) => stage.sortOrder)).toEqual([1, 2, 3]);
    expect(fixture.stageOrder()).toEqual(["deal-stage-b", "deal-stage-a", "deal-stage-c"]);
    expect(fixture.auditEvents.map((event) => event.actionType)).toContain("deal_stage.reordered");
  });

  it("переставляет стадию через несколько позиций и переживает разрежённые sortOrder", async () => {
    const fixture = createRouteFixture([
      { id: "deal-stage-a", sortOrder: 10 },
      { id: "deal-stage-b", sortOrder: 20 },
      { id: "deal-stage-c", sortOrder: 30 }
    ]);

    const response = await fixture.app.request("/api/workspace/pipelines/pipeline-default/stage-order", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ stageIds: ["deal-stage-c", "deal-stage-a", "deal-stage-b"] })
    });

    expect(response.status).toBe(200);
    expect(fixture.stageOrder()).toEqual(["deal-stage-c", "deal-stage-a", "deal-stage-b"]);
  });

  it("отвергает неполный порядок, дубли и чужие стадии", async () => {
    const fixture = createRouteFixture();

    for (const stageIds of [
      ["deal-stage-b", "deal-stage-a"], // неполный — оставил бы дыры в нумерации
      ["deal-stage-a", "deal-stage-a", "deal-stage-c"], // дубль
      ["deal-stage-a", "deal-stage-b", "deal-stage-foreign"] // чужая стадия
    ]) {
      const response = await fixture.app.request("/api/workspace/pipelines/pipeline-default/stage-order", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ stageIds })
      });
      expect(response.status).toBe(400);
    }
    expect(fixture.stageOrder()).toEqual(["deal-stage-a", "deal-stage-b", "deal-stage-c"]);
  });

  // Регрессия: снимок стадий снимался ВНЕ транзакции, а updateDealStage переписывает
  // строку целиком (pipeline_id, name, sort_order, status). Параллельный
  // PATCH /deal-stages/:id, закоммиченный между снимком и транзакцией, молча
  // откатывался обратно — 200 без ошибки и без следа в аудите.
  it("не откатывает параллельное переименование стадии", async () => {
    const fixture = createRouteFixture(undefined, adminProfile, (stages) =>
      stages.map((stage) =>
        stage.id === "deal-stage-b"
          ? { ...stage, name: "Переименована админом B", status: "archived" }
          : stage
      )
    );

    const response = await fixture.app.request("/api/workspace/pipelines/pipeline-default/stage-order", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ stageIds: ["deal-stage-c", "deal-stage-a", "deal-stage-b"] })
    });

    expect(response.status).toBe(200);
    expect(fixture.stageOrder()).toEqual(["deal-stage-c", "deal-stage-a", "deal-stage-b"]);
    // Чужие колонки остались чужими: перестановка меняет только sort_order.
    const renamed = fixture.stageById("deal-stage-b");
    expect(renamed?.name).toBe("Переименована админом B");
    expect(renamed?.status).toBe("archived");
  });

  // Состав стадий изменился между снимком и транзакцией: переставлять по устаревшему
  // списку нельзя — фаза 1 освобождает 1..N только для ПОЛНОГО порядка.
  it("отвечает 409 и ничего не пишет, если стадию удалили под нами", async () => {
    const fixture = createRouteFixture(undefined, adminProfile, (stages) =>
      stages.filter((stage) => stage.id !== "deal-stage-c")
    );

    const response = await fixture.app.request("/api/workspace/pipelines/pipeline-default/stage-order", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ stageIds: ["deal-stage-c", "deal-stage-a", "deal-stage-b"] })
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "stage_order_conflict" });
    expect(fixture.stageOrder()).toEqual(["deal-stage-a", "deal-stage-b"]);
    expect(fixture.auditEvents.map((event) => event.actionType)).not.toContain("deal_stage.reordered");
  });

  it("отвечает 404 для неизвестной воронки и 403 без права управления стадиями", async () => {
    const fixture = createRouteFixture();
    const missing = await fixture.app.request("/api/workspace/pipelines/pipeline-missing/stage-order", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ stageIds: ["deal-stage-a"] })
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "pipeline_not_found" });

    const readerFixture = createRouteFixture(undefined, createAccessProfile({
      id: "profile-reader",
      permissions: ["tenant.deal_stages.read"]
    }));
    const denied = await readerFixture.app.request("/api/workspace/pipelines/pipeline-default/stage-order", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ stageIds: ["deal-stage-b", "deal-stage-a", "deal-stage-c"] })
    });
    expect(denied.status).toBe(403);
    expect(readerFixture.stageOrder()).toEqual(["deal-stage-a", "deal-stage-b", "deal-stage-c"]);
  });
});

const now = new Date("2026-07-20T00:00:00.000Z");

function createRouteFixture(
  seed: Array<{ id: string; sortOrder: number }> = [
    { id: "deal-stage-a", sortOrder: 1 },
    { id: "deal-stage-b", sortOrder: 2 },
    { id: "deal-stage-c", sortOrder: 3 }
  ],
  profile = adminProfile,
  // Коммит параллельного администратора: происходит ПОСЛЕ снимка, снятого маршрутом
  // вне транзакции, но ДО её записей. Так воспроизводится гонка двух админов.
  commitConcurrently?: (stages: DealStageRecord[]) => DealStageRecord[]
) {
  const app = new Hono();
  const auditEvents: AuditEventListItem[] = [];
  const pipelines: PipelineRecord[] = [
    {
      id: "pipeline-default",
      tenantId: actor.tenantId,
      name: "Основная воронка",
      description: null,
      isDefault: true,
      sortOrder: 1,
      status: "active",
      createdAt: now,
      updatedAt: now
    }
  ];
  let stages: DealStageRecord[] = seed.map((item) => ({
    id: item.id,
    tenantId: actor.tenantId,
    pipelineId: "pipeline-default",
    name: item.id,
    sortOrder: item.sortOrder,
    status: "active",
    createdAt: now,
    updatedAt: now
  }));

  // Postgres-образная ошибка нарушения уникальности — ровно та, что раньше давала 500.
  function uniqueViolation(constraint: string): Error {
    return Object.assign(new Error(`duplicate key value violates unique constraint "${constraint}"`), {
      code: "23505",
      constraint
    });
  }

  const dataSource: Partial<ApiTenantDataSource> = {
    async findUserById(userId) {
      return userId === actor.id ? actor : undefined;
    },
    async findTenantById(tenantId) {
      return tenantId === actor.tenantId ? { id: tenantId, name: "Alpha" } : undefined;
    },
    async listDealStages(tenantId) {
      return stages.filter((stage) => stage.tenantId === tenantId);
    },
    async findDealStageById(tenantId, stageId) {
      return stages.find((stage) => stage.tenantId === tenantId && stage.id === stageId);
    },
    async listPipelines(tenantId) {
      return pipelines.filter((pipeline) => pipeline.tenantId === tenantId);
    },
    async findPipelineById(tenantId, pipelineId) {
      return pipelines.find((pipeline) => pipeline.tenantId === tenantId && pipeline.id === pipelineId);
    },
    async updateDealStage(input) {
      // Immediate-unique: проверка НА КАЖДЫЙ UPDATE, а не на конец транзакции.
      const collides = stages.some(
        (stage) =>
          stage.id !== input.id &&
          stage.tenantId === input.tenantId &&
          stage.pipelineId === input.pipelineId &&
          stage.sortOrder === input.sortOrder
      );
      if (collides) throw uniqueViolation("crm_pipeline_stages_tenant_pipeline_sort_order_uidx");
      const index = stages.findIndex((stage) => stage.tenantId === input.tenantId && stage.id === input.id);
      if (index < 0) throw new Error("deal_stage_missing");
      const updated = { ...stages[index]!, ...input, updatedAt: now };
      stages[index] = updated;
      return updated;
    },
    async appendAuditEvent(input) {
      auditEvents.push({
        ...input,
        sourceSurfaceId: input.sourceSurfaceId ?? null,
        sourceWorkflow: input.sourceWorkflow ?? null
      });
    },
    async withTransaction(operation) {
      return operation(dataSource as ApiTenantDataSource);
    }
  };

  // Транзакция с откатом: при throw состояние стадий возвращается к снимку — как ROLLBACK.
  async function runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T> {
    // Чужая транзакция уже закоммичена — наш откат её не отменяет.
    if (commitConcurrently) stages = commitConcurrently(stages);
    const snapshot = stages.map((stage) => ({ ...stage }));
    const auditSnapshot = auditEvents.length;
    try {
      return await operation(dataSource as ApiTenantDataSource);
    } catch (error) {
      stages = snapshot;
      auditEvents.length = auditSnapshot;
      throw error;
    }
  }

  const deps = {
    dataSource,
    async getSessionActorFromHeaders(cookie: string | null) {
      return cookie ? actor : undefined;
    },
    async getActorProfile() {
      return profile;
    },
    runDataSourceTransaction,
    async appendManagementAuditEvent(
      input: ManagementAuditEventInput,
      auditDataSource: Partial<ApiTenantDataSource> = dataSource
    ) {
      const auditEventId = input.auditEventId ?? `audit-${auditEvents.length + 1}`;
      await auditDataSource.appendAuditEvent?.({
        id: auditEventId,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actionType: input.actionType,
        sourceSurfaceId: null,
        sourceWorkflow: input.sourceWorkflow,
        sourceEntity: input.sourceEntity,
        input: input.commandInput,
        beforeState: input.beforeState,
        afterState: input.afterState,
        permissionResult: input.permissionResult,
        executionResult: input.executionResult ?? { status: "succeeded" },
        correlationId: "correlation-test",
        createdAt: now
      });
      return auditEventId;
    }
  } as unknown as Parameters<typeof registerCrmRoutes>[1];

  registerCrmRoutes(app, deps);
  return {
    app,
    auditEvents,
    stageById: (stageId: string) => stages.find((stage) => stage.id === stageId),
    stageOrder: () =>
      [...stages].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).map((stage) => stage.id)
  };
}
