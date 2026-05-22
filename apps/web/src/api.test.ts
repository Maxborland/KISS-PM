import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCustomField,
  createClient,
  createCrmComment,
  createCrmFile,
  createCrmTask,
  createProjectTask,
  createTaskComment,
  createTaskStatus,
  archiveTask,
  archiveTaskStatus,
  fetchCrmActivity,
  fetchCustomFields,
  fetchMyWork,
  fetchProjectDetail,
  fetchProjectTasks,
  fetchProjectTemplates,
  fetchTaskActivity,
  fetchTaskDetail,
  fetchTaskStatuses,
  updateProjectTask,
  updateProjectTaskStatus,
  updateTaskStatusDefinition,
  updateClient,
  updateContact,
  updateDealStage,
  updateCrmTask,
  updateProjectType,
  updateProjectTemplate,
  encodePathSegment
} from "./api";

describe("web api helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("encodes dynamic path segments before interpolation into API URLs", () => {
    expect(encodePathSegment("role/../positions/x")).toBe("role%2F..%2Fpositions%2Fx");
  });

  it("uses workspace config endpoints with same-origin mutation headers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify({ customFields: [] }), { status: 200 }));

    await fetchCustomFields();
    await createCustomField({
      id: "field-priority",
      systemKey: "priority",
      tenantLabel: "Приоритет",
      targetEntity: "project",
      fieldType: "select",
      required: false,
      status: "draft"
    });
    await fetchProjectTemplates();
    await updateProjectTemplate("template/unsafe", {
      systemKey: "implementation",
      tenantLabel: "Внедрение",
      description: "",
      status: "active"
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/workspace/config/custom-fields",
      expect.objectContaining({ credentials: "same-origin", method: "GET" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/workspace/config/custom-fields",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin"
        }
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/workspace/config/project-templates",
      expect.objectContaining({ credentials: "same-origin", method: "GET" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/workspace/config/project-templates/template%2Funsafe",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("keeps backend error codes for readable form messages", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: "custom_field_system_key_taken" }), {
          status: 409
        })
    );

    await expect(
      createCustomField({
        id: "field-priority",
        systemKey: "priority",
        tenantLabel: "Приоритет",
        targetEntity: "project",
        fieldType: "select",
        required: false,
        status: "draft"
      })
    ).rejects.toMatchObject({
      code: "custom_field_system_key_taken",
      status: 409
    });
  });

  it("uses encoded CRM foundation update endpoints with same-origin mutation headers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify({ client: {} }), { status: 200 }));

    await createClient({
      id: "client-romashka",
      name: "ООО Ромашка",
      description: null
    });
    await updateClient("client/unsafe", {
      name: "ООО Ромашка обновлено",
      description: "Описание",
      status: "active"
    });
    await updateContact("contact/unsafe", {
      clientId: "client-romashka",
      name: "Ирина",
      email: null,
      phone: null,
      telegram: null,
      role: "Заказчик",
      status: "archived"
    });
    await updateProjectType("project-type/unsafe", {
      name: "Внедрение",
      description: null,
      status: "active"
    });
    await updateDealStage("deal-stage/unsafe", {
      name: "Квалификация",
      sortOrder: 20,
      status: "archived"
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/workspace/clients",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/workspace/clients/client%2Funsafe",
      expect.objectContaining({
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin"
        }
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/workspace/contacts/contact%2Funsafe",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/workspace/project-types/project-type%2Funsafe",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/api/workspace/deal-stages/deal-stage%2Funsafe",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("uses encoded project work endpoints and same-origin task mutations", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify({ tasks: [], project: {} }), { status: 200 })
      );

    await fetchProjectDetail("project/unsafe");
    await fetchProjectTasks("project/unsafe");
    await fetchMyWork();
    await createProjectTask("project/unsafe", {
      id: "task-alpha",
      title: "Подготовить план",
      description: "",
      priority: "high",
      plannedStart: "2026-06-02",
      plannedFinish: "2026-06-05",
      plannedWork: 24,
      durationWorkingDays: 4,
      requiresAcceptance: true,
      statusId: "task-status-new",
      participants: [{ userId: "user-alpha-executor", role: "executor" }]
    });
    await updateProjectTaskStatus("project/unsafe", "task/unsafe", {
      statusId: "task-status-in-progress"
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/workspace/projects/project%2Funsafe",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/workspace/projects/project%2Funsafe/tasks",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/workspace/my-work",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/workspace/projects/project%2Funsafe/tasks",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin"
        }
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/api/workspace/projects/project%2Funsafe/tasks/task%2Funsafe/status",
      expect.objectContaining({
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin"
        }
      })
    );
  });

  it("uses task workspace endpoints and same-origin mutation headers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify({ taskStatuses: [], task: {}, activities: [] }), { status: 200 })
      );

    await fetchTaskStatuses();
    await createTaskStatus({
      id: "task-status/custom",
      name: "Ждет клиента",
      category: "waiting",
      sortOrder: 20
    });
    await updateTaskStatusDefinition("task-status/custom", {
      name: "Ждет клиента",
      category: "waiting",
      sortOrder: 30,
      status: "active"
    });
    await archiveTaskStatus("task-status/custom");
    await fetchTaskDetail("task/unsafe");
    await updateProjectTask("task/unsafe", {
      title: "Обновить задачу",
      description: "Новый контекст",
      priority: "normal",
      statusId: "task-status-in-progress",
      plannedStart: "2026-06-02",
      plannedFinish: "2026-06-05",
      plannedWork: 12,
      durationWorkingDays: 3,
      requiresAcceptance: false,
      clientUpdatedAt: "2026-05-21T00:00:00.000Z",
      participants: [{ userId: "user-alpha-executor", role: "executor" }]
    });
    await archiveTask("task/unsafe");
    await fetchTaskActivity("task/unsafe");
    await createTaskComment("task/unsafe", { body: "Проверил контекст задачи." });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/workspace/task-statuses",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/workspace/task-statuses",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/workspace/task-statuses/task-status%2Fcustom",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/workspace/task-statuses/task-status%2Fcustom",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/api/workspace/tasks/task%2Funsafe",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "/api/workspace/tasks/task%2Funsafe",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "/api/workspace/tasks/task%2Funsafe",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      "/api/workspace/tasks/task%2Funsafe/activity",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      9,
      "/api/workspace/tasks/task%2Funsafe/comments",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin"
        }
      })
    );
  });

  it("uses encoded CRM activity endpoints and same-origin mutation headers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify({ activities: [], systemEvents: [] }), { status: 200 })
      );

    await fetchCrmActivity("opportunity", "opportunity/unsafe");
    await createCrmComment("opportunity", "opportunity/unsafe", {
      body: "Комментарий по сделке"
    });
    await createCrmTask("opportunity", "opportunity/unsafe", {
      title: "Позвонить клиенту",
      body: "Уточнить дату старта",
      dueDate: "2026-06-10",
      assigneeUserId: "user-alpha-admin"
    });
    await createCrmFile("client", "client/unsafe", {
      title: "Бриф клиента",
      body: "Ссылка на внешний файл",
      fileUrl: "https://example.test/brief.pdf",
      fileSizeBytes: 2048,
      mimeType: "application/pdf"
    });
    await updateCrmTask("opportunity", "opportunity/unsafe", "activity/unsafe", {
      status: "done"
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/workspace/crm/opportunity/opportunity%2Funsafe/activity",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/workspace/crm/opportunity/opportunity%2Funsafe/comments",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin"
        }
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/workspace/crm/opportunity/opportunity%2Funsafe/tasks",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/workspace/crm/client/client%2Funsafe/files",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/api/workspace/crm/opportunity/opportunity%2Funsafe/tasks/activity%2Funsafe",
      expect.objectContaining({ method: "PATCH" })
    );
  });
});
