import { describe, expect, it } from "vitest";

import {
  parseCreateOpportunityTaskBody,
  parseUpdateOpportunityTaskBody
} from "./opportunityActivityParsers";

describe("opportunity activity parsers", () => {
  it("parses task due dates as strict calendar dates", () => {
    expect(
      parseCreateOpportunityTaskBody({
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
      parseCreateOpportunityTaskBody({
        title: "Подготовить КП",
        dueDate: "2026-02-31"
      })
    ).toEqual({ ok: false, error: "task_due_date_invalid" });

    expect(
      parseCreateOpportunityTaskBody({
        title: "Подготовить КП",
        dueDate: "June 1 2026"
      })
    ).toEqual({ ok: false, error: "task_due_date_invalid" });
  });

  it("accepts only supported task statuses", () => {
    expect(parseUpdateOpportunityTaskBody({ status: "done" })).toEqual({
      ok: true,
      value: { status: "done" }
    });
    expect(parseUpdateOpportunityTaskBody({ status: "blocked" })).toEqual({
      ok: false,
      error: "task_status_invalid"
    });
  });
});
