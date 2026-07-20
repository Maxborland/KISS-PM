import { describe, expect, it } from "vitest";

import {
  parseCreateProjectBody,
  parseUpdateProjectBody
} from "./projectLifecycleParsers";

const tenantId = "tenant-alpha";

describe("parseCreateProjectBody", () => {
  it("accepts a minimal manual project and defaults optional numeric fields", () => {
    const result = parseCreateProjectBody(
      {
        id: "project-manual",
        title: "Внутренний R&D",
        plannedStart: "2026-07-01",
        plannedFinish: "2026-07-31"
      },
      tenantId
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contractValue).toBe(0);
    expect(result.value.plannedHours).toBe(0);
    expect(result.value.clientName).toBe("Внутренний проект");
    expect(result.value.projectTypeId).toBeNull();
  });

  it("rejects a missing title", () => {
    const result = parseCreateProjectBody(
      { plannedStart: "2026-07-01", plannedFinish: "2026-07-31" },
      tenantId
    );
    expect(result).toEqual({ ok: false, error: "invalid_project_title" });
  });

  it("rejects a finish before start", () => {
    const result = parseCreateProjectBody(
      { title: "X проект", plannedStart: "2026-07-31", plannedFinish: "2026-07-01" },
      tenantId
    );
    expect(result).toEqual({ ok: false, error: "invalid_planned_dates" });
  });

  it("rejects a horizon over 730 days", () => {
    const result = parseCreateProjectBody(
      { title: "X проект", plannedStart: "2026-01-01", plannedFinish: "2028-06-01" },
      tenantId
    );
    expect(result).toEqual({ ok: false, error: "invalid_planned_dates" });
  });

  it("rejects an invalid project type id", () => {
    const result = parseCreateProjectBody(
      {
        title: "X проект",
        projectTypeId: "Bad Id",
        plannedStart: "2026-07-01",
        plannedFinish: "2026-07-31"
      },
      tenantId
    );
    expect(result).toEqual({ ok: false, error: "invalid_project_type_id" });
  });

  it("rejects a non-integer contract value", () => {
    const result = parseCreateProjectBody(
      {
        title: "X проект",
        contractValue: 1.5,
        plannedStart: "2026-07-01",
        plannedFinish: "2026-07-31"
      },
      tenantId
    );
    expect(result).toEqual({ ok: false, error: "invalid_contract_value" });
  });
});

describe("parseUpdateProjectBody", () => {
  it("accepts a partial update of title only", () => {
    const result = parseUpdateProjectBody({ title: "Новое имя" });
    expect(result).toEqual({ ok: true, value: { title: "Новое имя" } });
  });

  it("allows clearing project type and template with null", () => {
    const result = parseUpdateProjectBody({ projectTypeId: null, templateId: null });
    expect(result).toEqual({
      ok: true,
      value: { projectTypeId: null, templateId: null }
    });
  });

  it("keeps calendar id when valid", () => {
    const result = parseUpdateProjectBody({ calendarId: "calendar-default" });
    expect(result).toEqual({ ok: true, value: { calendarId: "calendar-default" } });
  });

  it("rejects an empty update", () => {
    const result = parseUpdateProjectBody({});
    expect(result).toEqual({ ok: false, error: "empty_project_update" });
  });

  it("rejects an empty title", () => {
    const result = parseUpdateProjectBody({ title: "" });
    expect(result).toEqual({ ok: false, error: "invalid_project_title" });
  });

  it("rejects an invalid template id", () => {
    const result = parseUpdateProjectBody({ templateId: "Bad Template" });
    expect(result).toEqual({ ok: false, error: "invalid_template_id" });
  });
});
