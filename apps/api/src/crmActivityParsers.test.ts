import { describe, expect, it } from "vitest";

import {
  parseCreateCrmFileBody,
  parseCreateCrmTaskBody,
  parseCrmActivityEntityType,
  parseUpdateCrmTaskBody
} from "./crmActivityParsers";

describe("CRM activity parsers", () => {
  it("parses task due dates as strict calendar dates", () => {
    expect(
      parseCreateCrmTaskBody({
        title: "Подготовить КП",
        dueDate: "2026-06-01"
      })
    ).toEqual({
      ok: true,
      value: {
        title: "Подготовить КП",
        body: null,
        dueDate: new Date("2026-06-01T00:00:00.000Z"),
        assigneeUserId: null
      }
    });
  });

  it("rejects rolled-over and non-contract task due dates", () => {
    expect(
      parseCreateCrmTaskBody({
        title: "Подготовить КП",
        dueDate: "2026-02-31"
      })
    ).toEqual({ ok: false, error: "task_due_date_invalid" });

    expect(
      parseCreateCrmTaskBody({
        title: "Подготовить КП",
        dueDate: "June 1 2026"
      })
    ).toEqual({ ok: false, error: "task_due_date_invalid" });
  });

  it("accepts only supported task statuses", () => {
    expect(parseUpdateCrmTaskBody({ status: "done" })).toEqual({
      ok: true,
      value: { status: "done" }
    });
    expect(parseUpdateCrmTaskBody({ status: "blocked" })).toEqual({
      ok: false,
      error: "task_status_invalid"
    });
  });

  it("accepts only supported CRM activity entity types", () => {
    expect(parseCrmActivityEntityType("client")).toEqual({
      ok: true,
      value: "client"
    });
    expect(parseCrmActivityEntityType("invoice")).toEqual({
      ok: false,
      error: "crm_entity_type_invalid"
    });
  });

  it("parses file metadata without binary storage fallback", () => {
    expect(
      parseCreateCrmFileBody({
        title: "Бриф клиента",
        body: "Ссылка на внешний файл",
        fileUrl: "https://example.test/brief.pdf",
        fileSizeBytes: 2048,
        mimeType: "application/pdf"
      })
    ).toEqual({
      ok: true,
      value: {
        title: "Бриф клиента",
        body: "Ссылка на внешний файл",
        fileUrl: "https://example.test/brief.pdf",
        fileSizeBytes: 2048,
        mimeType: "application/pdf"
      }
    });
    expect(
      parseCreateCrmFileBody({
        title: "Бриф клиента",
        fileUrl: "https://example.test/brief.pdf",
        fileSizeBytes: -1
      })
    ).toEqual({ ok: false, error: "file_size_invalid" });
  });

  it("rejects unsafe and relative file URLs", () => {
    expect(
      parseCreateCrmFileBody({
        title: "Бриф клиента",
        fileUrl: "javascript:alert(1)"
      })
    ).toEqual({ ok: false, error: "file_url_invalid" });

    expect(
      parseCreateCrmFileBody({
        title: "Бриф клиента",
        fileUrl: "/uploads/brief.pdf"
      })
    ).toEqual({ ok: false, error: "file_url_invalid" });
  });
});
