import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCustomField,
  createClient,
  createOpportunityComment,
  createOpportunityTask,
  createProjectTask,
  fetchOpportunityActivity,
  fetchCustomFields,
  fetchMyWork,
  fetchProjectDetail,
  fetchProjectTasks,
  fetchProjectTemplates,
  updateClient,
  updateContact,
  updateDealStage,
  updateOpportunityTask,
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
      participants: [{ userId: "user-alpha-executor", role: "executor" }]
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
  });

  it("uses encoded opportunity activity endpoints and same-origin mutation headers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify({ activities: [], systemEvents: [] }), { status: 200 })
      );

    await fetchOpportunityActivity("opportunity/unsafe");
    await createOpportunityComment("opportunity/unsafe", {
      body: "Комментарий по сделке"
    });
    await createOpportunityTask("opportunity/unsafe", {
      title: "Позвонить клиенту",
      body: "Уточнить дату старта",
      dueDate: "2026-06-10",
      assigneeUserId: "user-alpha-admin"
    });
    await updateOpportunityTask("opportunity/unsafe", "activity/unsafe", {
      status: "done"
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/workspace/opportunities/opportunity%2Funsafe/activity",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/workspace/opportunities/opportunity%2Funsafe/comments",
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
      "/api/workspace/opportunities/opportunity%2Funsafe/tasks",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/workspace/opportunities/opportunity%2Funsafe/tasks/activity%2Funsafe",
      expect.objectContaining({ method: "PATCH" })
    );
  });
});
