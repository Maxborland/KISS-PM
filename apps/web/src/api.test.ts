import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCustomField,
  fetchCustomFields,
  fetchProjectTemplates,
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
});
