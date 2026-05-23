import { describe, expect, it } from "vitest";

import { buildDependencyPaths } from "./ganttDependencyPaths";

describe("buildDependencyPaths", () => {
  it("routes FS dependency between distinct bar positions", () => {
    const layouts = new Map([
      ["a", { taskId: "a", rowIndex: 0, left: 40, width: 80 }],
      ["b", { taskId: "b", rowIndex: 1, left: 200, width: 60 }]
    ]);
    const paths = buildDependencyPaths({
      dependencies: [
        {
          id: "dep-1",
          predecessorTaskId: "a",
          successorTaskId: "b",
          type: "FS"
        }
      ],
      layoutsByTaskId: layouts
    });
    expect(paths).toHaveLength(1);
    expect(paths[0]?.d).toContain("M 120");
    expect(paths[0]?.d).toContain("200");
  });
});
