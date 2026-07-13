import { describe, expect, it } from "vitest";

import { parseScheduleSavedViewPayload } from "./schedule-saved-views";

describe("parseScheduleSavedViewPayload", () => {
  it("accepts the complete 11-column WBS snapshot and deduplicates collapsed groups", () => {
    expect(parseScheduleSavedViewPayload({
      version: 1,
      zoom: "day",
      columnWidths: [52, 64, 44, 196, 52, 56, 44, 90, 90, 120, 104],
      collapsedTaskIds: ["summary-a", "summary-a"]
    })).toEqual({
      version: 2,
      surface: "schedule",
      state: {
        zoom: "day",
        columnWidths: [52, 64, 44, 196, 52, 56, 44, 90, 90, 120, 104],
        collapsedTaskIds: ["summary-a"]
      }
    });
  });

  it("rejects malformed, out-of-range and wrong-column-count snapshots", () => {
    expect(parseScheduleSavedViewPayload(null)).toBeNull();
    expect(parseScheduleSavedViewPayload({
      version: 1,
      zoom: "week",
      columnWidths: Array(10).fill(80),
      collapsedTaskIds: []
    })).toBeNull();
    expect(parseScheduleSavedViewPayload({
      version: 1,
      zoom: "week",
      columnWidths: [20, ...Array(10).fill(80)],
      collapsedTaskIds: []
    })).toBeNull();
    expect(parseScheduleSavedViewPayload({
      version: 3,
      zoom: "week",
      columnWidths: Array(11).fill(80),
      collapsedTaskIds: []
    })).toBeNull();
    expect(parseScheduleSavedViewPayload({
      version: 2,
      surface: "resource-matrix",
      state: {
        zoom: "week",
        columnWidths: Array(11).fill(80),
        collapsedTaskIds: []
      }
    })).toBeNull();
  });
});
