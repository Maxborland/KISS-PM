import type { ScheduledTask, Task, TaskActivity } from "@/lib/api-types";

import { MOCK_TENANT_ID } from "./users";

export const MOCK_TASKS = [
  {
    id: "MDS-39",
    tenantId: MOCK_TENANT_ID,
    projectId: "PRJ-2026-014",
    stageId: "stage-discovery",
    title: "Новая страница продукта",
    description: "Собрать продуктовый контекст, сверить с CRM полями и подготовить макет.",
    status: "new",
    statusId: "status-new",
    statusName: "Новая",
    statusCategory: "new",
    priority: "critical",
    requesterUserId: "usr-ivanova",
    ownerUserId: "usr-kozlova",
    plannedStart: "2026-05-27T00:00:00.000Z",
    plannedFinish: "2026-05-30T00:00:00.000Z",
    durationWorkingDays: 4,
    plannedWork: 1920,
    actualWork: 420,
    progress: 22,
    requiresAcceptance: true,
    source: "manual",
    createdAt: "2026-05-20T09:00:00.000Z",
    updatedAt: "2026-05-25T08:00:00.000Z",
    archivedAt: null,
    participants: [
      { userId: "usr-kozlova", role: "executor" },
      { userId: "usr-ivanova", role: "controller" }
    ]
  },
  {
    id: "MDS-2",
    tenantId: MOCK_TENANT_ID,
    projectId: "PRJ-2026-014",
    stageId: "stage-implementation",
    title: "Презентация для клиента",
    description: "Сформировать статусный deck по плану, ресурсам и рискам.",
    status: "in_progress",
    statusId: "status-progress",
    statusName: "В работе",
    statusCategory: "in_progress",
    priority: "low",
    requesterUserId: "usr-petrov",
    ownerUserId: "usr-ivanova",
    plannedStart: "2026-05-28T00:00:00.000Z",
    plannedFinish: "2026-05-31T00:00:00.000Z",
    durationWorkingDays: 3,
    plannedWork: 960,
    actualWork: 540,
    progress: 56,
    requiresAcceptance: false,
    source: "manual",
    createdAt: "2026-05-19T09:00:00.000Z",
    updatedAt: "2026-05-24T08:00:00.000Z",
    archivedAt: null,
    participants: [
      { userId: "usr-ivanova", role: "executor" },
      { userId: "usr-petrov", role: "observer" }
    ]
  },
  {
    id: "MDS-40",
    tenantId: MOCK_TENANT_ID,
    projectId: "PRJ-2026-009",
    stageId: "stage-estimate",
    title: "Подготовить смету этапа 2",
    description: "Проверить плановые часы, ставку и demand по должностям.",
    status: "review",
    statusId: "status-review",
    statusName: "На приемке",
    statusCategory: "review",
    priority: "normal",
    requesterUserId: "usr-ivanova",
    ownerUserId: "usr-petrov",
    plannedStart: "2026-06-01T00:00:00.000Z",
    plannedFinish: "2026-06-04T00:00:00.000Z",
    durationWorkingDays: 4,
    plannedWork: 1440,
    actualWork: 1200,
    progress: 83,
    requiresAcceptance: true,
    source: "manual",
    createdAt: "2026-05-18T09:00:00.000Z",
    updatedAt: "2026-05-24T08:00:00.000Z",
    archivedAt: null,
    participants: [
      { userId: "usr-petrov", role: "executor" },
      { userId: "usr-ivanova", role: "approver" }
    ]
  }
] satisfies Task[];

export const MOCK_TASK_ACTIVITIES = [
  {
    id: "tact-1",
    tenantId: MOCK_TENANT_ID,
    taskId: "MDS-39",
    type: "comment",
    body: "Проверить поля карточки сделки против backend contract.",
    title: null,
    fileUrl: null,
    fileSizeBytes: null,
    mimeType: null,
    authorUserId: "usr-ivanova",
    createdAt: "2026-05-24T10:00:00.000Z",
    updatedAt: "2026-05-24T10:00:00.000Z"
  }
] satisfies TaskActivity[];

export const MOCK_SCHEDULED_TASKS = [
  {
    id: "MDS-39",
    title: "Новая страница продукта",
    projectId: "PRJ-2026-014",
    projectTitle: "Внедрение CRM",
    plannedStart: "2026-05-27T00:00:00.000Z",
    plannedFinish: "2026-05-30T00:00:00.000Z",
    workMinutes: 1920,
    createdAt: "2026-05-20T09:00:00.000Z",
    statusId: "status-new"
  },
  {
    id: "MDS-2",
    title: "Презентация для клиента",
    projectId: "PRJ-2026-014",
    projectTitle: "Внедрение CRM",
    plannedStart: "2026-05-28T00:00:00.000Z",
    plannedFinish: "2026-05-31T00:00:00.000Z",
    workMinutes: 960,
    createdAt: "2026-05-19T09:00:00.000Z",
    statusId: "status-progress"
  }
] satisfies ScheduledTask[];
