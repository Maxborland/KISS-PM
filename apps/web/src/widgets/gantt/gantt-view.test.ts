import { describe, expect, it } from "vitest";

import { resolveEndpointPointerAction } from "./gantt-view";
import type { GanttLinkSession } from "./types";

const link: GanttLinkSession = {
  fromId: "a",
  fromEndpoint: "finish",
  pointerX: 0,
  pointerY: 0
};

describe("resolveEndpointPointerAction", () => {
  it("starts a link when no link session exists", () => {
    expect(resolveEndpointPointerAction(null, "a", "finish")).toEqual({
      type: "start",
      rowId: "a",
      endpoint: "finish"
    });
  });

  it("completes an existing link session on a different row endpoint", () => {
    expect(resolveEndpointPointerAction(link, "b", "start")).toEqual({
      type: "complete",
      rowId: "b",
      endpoint: "start"
    });
  });

  it("does not restart a link session from the source row", () => {
    expect(resolveEndpointPointerAction(link, "a", "start")).toEqual({ type: "ignore" });
  });
});
