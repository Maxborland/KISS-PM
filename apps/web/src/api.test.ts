import { describe, expect, it } from "vitest";

import { encodePathSegment } from "./api";

describe("web api helpers", () => {
  it("encodes dynamic path segments before interpolation into API URLs", () => {
    expect(encodePathSegment("role/../positions/x")).toBe("role%2F..%2Fpositions%2Fx");
  });
});
