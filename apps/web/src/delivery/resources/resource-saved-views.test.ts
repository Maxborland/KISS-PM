import { describe, expect, it } from "vitest";

import { parseResourceSavedViewPayload, sanitizeResourceSavedViewState } from "./resource-saved-views";

describe("parseResourceSavedViewPayload", () => {
  it("normalizes an unversioned legacy snapshot with defaults and ignores unknown fields", () => {
    expect(parseResourceSavedViewPayload({ gran: "week", onlyOverload: true, legacyUnknown: "ignored" })).toEqual({
      version: 2,
      surface: "resource-matrix",
      state: {
        granularity: "week", monthOffset: 0, collapsedGroupIds: [], onlyOverload: true, hideIdle: false,
        teamFilter: "all", roleFilter: "all", projectFilter: "all", sortBy: "load"
      }
    });
  });

  it("round-trips v2 and deduplicates collapsed groups", () => {
    expect(parseResourceSavedViewPayload({ version: 2, surface: "resource-matrix", state: {
      granularity: "month", monthOffset: 4, collapsedGroupIds: ["team-a", "team-a"], onlyOverload: false,
      hideIdle: true, teamFilter: "team-a", roleFilter: "role-a", projectFilter: "project-a", sortBy: "name"
    } })).toEqual({ version: 2, surface: "resource-matrix", state: {
      granularity: "month", monthOffset: 4, collapsedGroupIds: ["team-a"], onlyOverload: false,
      hideIdle: true, teamFilter: "team-a", roleFilter: "role-a", projectFilter: "project-a", sortBy: "name"
    } });
  });

  it("rejects unknown versions, wrong surfaces and malformed state", () => {
    expect(parseResourceSavedViewPayload({ version: 3 })).toBeNull();
    expect(parseResourceSavedViewPayload({ version: 2, surface: "schedule", state: {} })).toBeNull();
    expect(parseResourceSavedViewPayload({ granularity: "day", monthOffset: -1 })).toBeNull();
  });
});
  it("partially applies stale filters and month offsets while preserving valid state", () => {
    const parsed = parseResourceSavedViewPayload({ gran: "week", monthOffset: 9, teamFilter: "gone", roleFilter: "role-a", projectFilter: "gone", onlyOverload: true });
    expect(parsed).not.toBeNull();
    const result = sanitizeResourceSavedViewState(parsed!.state, {
      teamIds: new Set(["team-a"]), roleIds: new Set(["role-a"]), projectIds: new Set(["project-a"]), monthCount: 2
    });
    expect(result.partial).toBe(true);
    expect(result.state).toMatchObject({
      granularity: "week",
      monthOffset: 1,
      teamFilter: "all",
      roleFilter: "role-a",
      projectFilter: "all",
      onlyOverload: true
    });
  });
