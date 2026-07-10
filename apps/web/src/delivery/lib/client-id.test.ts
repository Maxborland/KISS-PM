import { describe, expect, it } from "vitest";

import { createClientId } from "./client-id";

describe("createClientId", () => {
  it("produces UUID-backed ids that stay unique across repeated calls", () => {
    const ids = Array.from({ length: 100 }, () => createClientId("task"));

    expect(new Set(ids)).toHaveLength(ids.length);
    for (const id of ids) {
      expect(id).toMatch(
        /^task-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    }
  });
});