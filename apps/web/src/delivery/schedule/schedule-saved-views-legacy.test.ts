import { describe, expect, it } from "vitest";

import { parseScheduleSavedViewPayload } from "./schedule-saved-views";

describe("legacy schedule saved views", () => {
  it("normalizes an unversioned payload into canonical v2 and ignores unknown fields", () => {
    expect(parseScheduleSavedViewPayload({
      zoom: "day",
      columnWidths: [52, 64, 44, 196, 52, 56, 44, 90, 90, 120, 104],
      collapsedTaskIds: ["summary-a"],
      legacyUnknown: "ignored"
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
});
