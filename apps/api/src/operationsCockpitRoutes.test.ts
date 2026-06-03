import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { OperationsCockpitReadModel } from "@kiss-pm/persistence";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { ApiTenantDataSource } from "./apiTypes";
import { createApp } from "./app";
import { registerOperationsCockpitRoutes } from "./operationsCockpitRoutes";

const actor = {
  id: "user-alpha",
  tenantId: "tenant-alpha",
  accessProfileId: "profile-alpha"
} as TenantUser;

const readerProfile = {
  id: "profile-alpha",
  permissions: ["tenant.projects.read", "tenant.opportunities.read", "tenant.project_resources.read"]
} as AccessProfile;

describe("operations cockpit routes", () => {
  it("returns workspace-level cockpit read model without requiring projectId", async () => {
    const fixture = createFixture({
      readModel: {
        ...emptyReadModel(),
        indicators: {
          ...emptyReadModel().indicators,
          activeProjects: 1,
          activeTasks: 2,
          overdueTasks: 1,
          openDeals: 1
        },
        attentionItems: [
          {
            id: "task-overdue:task-alpha",
            kind: "task_overdue",
            severity: "critical",
            title: "Подготовить график",
            reason: "Плановая дата завершения задачи уже прошла.",
            entity: {
              type: "task",
              id: "task-alpha",
              title: "Подготовить график"
            },
            projectId: "project-alpha",
            ownerUserId: "user-alpha",
            dueDate: "2026-05-31"
          },
          {
            id: "deal-missing-next-action:deal-alpha",
            kind: "deal_missing_next_action",
            severity: "warning",
            title: "БЦ Север",
            reason: "У сделки не задано следующее действие для клиента.",
            entity: {
              type: "deal",
              id: "deal-alpha",
              title: "БЦ Север"
            },
            projectId: null,
            ownerUserId: "user-alpha",
            dueDate: "2026-06-20"
          }
        ],
        workloadHints: {
          byPerson: [
            {
              userId: "user-alpha",
              name: "Анна",
              positionName: "Руководитель проекта",
              activeTaskCount: 2,
              overdueTaskCount: 1,
              criticalTaskCount: 0,
              plannedWorkHours: 12
            }
          ]
        },
        pipelinePressure: {
          deals: [
            {
              id: "deal-alpha",
              title: "БЦ Север",
              clientName: "ООО Север",
              status: "ready_to_activate",
              probability: 80,
              plannedFinish: "2026-06-20",
              plannedHours: 120,
              contractValue: 600000,
              ownerUserId: "user-alpha",
              feasibilityStatus: "feasible"
            }
          ]
        }
      }
    });
    const app = createRouteApp(fixture);

    const response = await app.request(
      "/api/workspace/operations-cockpit",
      requestOptions()
    );

    expect(response.status).toBe(200);
    expect(fixture.requests).toEqual([
      {
        tenantId: "tenant-alpha",
        now: expect.any(Date),
        includePipelinePressure: true,
        includeWorkloadHints: true
      }
    ]);
    await expect(response.json()).resolves.toMatchObject({
      cockpit: {
        scope: { type: "workspace", tenantId: "tenant-alpha" },
        indicators: {
          activeProjects: 1,
          overdueTasks: 1,
          openDeals: 1
        },
        attentionItems: [
          expect.objectContaining({
            kind: "task_overdue",
            entity: { type: "task", id: "task-alpha", title: "Подготовить график" }
          }),
          expect.objectContaining({
            kind: "deal_missing_next_action",
            entity: { type: "deal", id: "deal-alpha", title: "БЦ Север" },
            reason: "У сделки не задано следующее действие для клиента."
          })
        ],
        agentContext: {
          contextType: "operations_cockpit",
          focus: { type: "workspace", tenantId: "tenant-alpha" }
        }
      }
    });
  });

  it("returns stable empty cockpit when modeled sources have no records", async () => {
    const app = createRouteApp(createFixture());

    const response = await app.request(
      "/api/workspace/operations-cockpit",
      requestOptions()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      cockpit: emptyReadModel()
    });
  });

  it("requires project read permission", async () => {
    const app = createRouteApp(
      createFixture({
        profile: { id: "profile-denied", permissions: [] } as AccessProfile
      })
    );

    const response = await app.request(
      "/api/workspace/operations-cockpit",
      requestOptions()
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
  });

  it("keeps project cockpit readable without opportunity/resource permissions and hides protected sources", async () => {
    const app = createRouteApp(
      createFixture({
        profile: {
          id: "profile-project-reader",
          permissions: ["tenant.projects.read"]
        } as AccessProfile
      })
    );

    const response = await app.request(
      "/api/workspace/operations-cockpit",
      requestOptions()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      cockpit: {
        workloadHints: { byPerson: [] },
        pipelinePressure: { deals: [] },
        agentContext: {
          unavailableSources: [
            expect.objectContaining({
              source: "opportunity_pipeline"
            }),
            expect.objectContaining({
              source: "resource_workload"
            }),
            expect.any(Object),
            expect.any(Object)
          ]
        }
      }
    });
  });

  it("keeps the full app route session protected", async () => {
    const app = createApp();

    const response = await app.request("/api/workspace/operations-cockpit");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "session_required" });
  });
});

function createRouteApp(fixture: ReturnType<typeof createFixture>) {
  const app = new Hono();
  registerOperationsCockpitRoutes(app, {
    dataSource: fixture.dataSource,
    getActorProfile: async () => fixture.profile,
    getSessionActorFromHeaders: async () => actor
  });
  return app;
}

function createFixture(
  options: {
    profile?: AccessProfile;
    readModel?: OperationsCockpitReadModel;
  } = {}
) {
  const requests: Array<{ tenantId: string; now: Date }> = [];
  const dataSource = {
    async listDevUsers() {
      return [actor];
    },
    async findUserById() {
      return actor;
    },
    async findTenantById() {
      return { id: "tenant-alpha", name: "Tenant Alpha" };
    },
    async listUsersByTenantId() {
      return [actor];
    },
    async getOperationsCockpitReadModel(input) {
      requests.push(input);
      if (!input.includePipelinePressure || !input.includeWorkloadHints) {
        const readModel = options.readModel ?? emptyReadModel();
        return {
          ...readModel,
          indicators: {
            ...readModel.indicators,
            openDeals: 0,
            readyToActivateDeals: 0
          },
          workloadHints: input.includeWorkloadHints ? readModel.workloadHints : { byPerson: [] },
          pipelinePressure: input.includePipelinePressure ? readModel.pipelinePressure : { deals: [] },
          agentContext: {
            ...readModel.agentContext,
            unavailableSources: [
              ...(!input.includePipelinePressure
                ? [
                    {
                      source: "opportunity_pipeline",
                      reason: "У пользователя нет права читать сделки; блок pipeline скрыт."
                    }
                  ]
                : []),
              ...(!input.includeWorkloadHints
                ? [
                    {
                      source: "resource_workload",
                      reason: "У пользователя нет права читать загрузку ресурсов; персональные workload hints скрыты."
                    }
                  ]
                : []),
              ...readModel.agentContext.unavailableSources
            ]
          }
        };
      }
      return options.readModel ?? emptyReadModel();
    }
  } satisfies ApiTenantDataSource;

  return {
    dataSource,
    profile: options.profile ?? readerProfile,
    requests
  };
}

function requestOptions() {
  return {
    headers: {
      cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  };
}

function emptyReadModel(): OperationsCockpitReadModel {
  return {
    generatedAt: "2026-06-01T00:00:00.000Z",
    scope: {
      type: "workspace",
      tenantId: "tenant-alpha"
    },
    indicators: {
      activeProjects: 0,
      overdueProjects: 0,
      activeTasks: 0,
      overdueTasks: 0,
      waitingTasks: 0,
      criticalTasks: 0,
      openDeals: 0,
      readyToActivateDeals: 0
    },
    attentionItems: [],
    workloadHints: {
      byPerson: []
    },
    pipelinePressure: {
      deals: []
    },
    agentContext: {
      contextType: "operations_cockpit",
      focus: {
        type: "workspace",
        tenantId: "tenant-alpha"
      },
      generatedAt: "2026-06-01T00:00:00.000Z",
      sourceEntityTypes: ["Project", "Task", "Opportunity", "TenantUser"],
      unavailableSources: [
        {
          source: "explicit_blocker_flag",
          reason: "В текущей модели задач нет отдельного признака blocker; доступен только статус ожидания."
        },
        {
          source: "capacity_overallocation",
          reason: "Workspace-level capacity pressure не смоделирован в этом read endpoint."
        }
      ]
    }
  };
}
