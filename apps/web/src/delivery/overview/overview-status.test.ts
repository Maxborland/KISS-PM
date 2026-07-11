import { describe, expect, it } from "vitest";

import {
  isOverviewDoneStatus,
  isOverviewInProgressStatus,
  overviewTaskStatusCategory
} from "./overview-status";

describe("overview status helpers", () => {
  it("supports mock and live done status ids", () => {
    expect(isOverviewDoneStatus("done")).toBe(true);
    expect(isOverviewDoneStatus("task-status-done")).toBe(true);
    expect(overviewTaskStatusCategory("task-status-done")).toBe("done");
  });

  it("supports mock and live in-progress status ids", () => {
    expect(isOverviewInProgressStatus("in_progress")).toBe(true);
    expect(isOverviewInProgressStatus("task-status-in-progress")).toBe(true);
    expect(overviewTaskStatusCategory("task-status-in-progress")).toBe("in_progress");
  });

  it("keeps other statuses out of done and in-progress counters", () => {
    expect(overviewTaskStatusCategory("task-status-review")).toBe("other");
    expect(isOverviewDoneStatus("task-status-new")).toBe(false);
    expect(isOverviewInProgressStatus("task-status-waiting")).toBe(false);
  });
});
