import { describe, expect, it } from "vitest";

import { parsePredecessorString } from "./parsePredecessorString";
import { serializePredecessorString } from "./serializePredecessorString";

describe("parsePredecessorString", () => {
  it("parses mixed RU and EN dependency codes with lag", () => {
    const ru = parsePredecessorString("3,5ОН+2д;8НН");
    const en = parsePredecessorString("3,5FS+2d;8SS");
    expect(ru).toEqual({
      ok: true,
      links: [
        { predecessorWbsIndex: 3, dependencyType: "FS", lagMinutes: 2 * 24 * 60 },
        { predecessorWbsIndex: 5, dependencyType: "FS", lagMinutes: 2 * 24 * 60 },
        { predecessorWbsIndex: 8, dependencyType: "SS", lagMinutes: 0 }
      ]
    });
    expect(en).toEqual(ru);
  });

  it("rejects invalid codes and empty malformed segments", () => {
    expect(parsePredecessorString("3XX")).toMatchObject({ ok: false });
    expect(parsePredecessorString("abc")).toMatchObject({ ok: false });
    expect(parsePredecessorString("")).toEqual({ ok: true, links: [] });
  });

  it("serializes to Russian chips only", () => {
    const serialized = serializePredecessorString([
      { predecessorWbsIndex: 3, dependencyType: "FS", lagMinutes: 2 * 24 * 60 },
      { predecessorWbsIndex: 8, dependencyType: "SS", lagMinutes: 0 }
    ]);
    expect(serialized).toBe("3ОН+2д; 8НН");
  });
});
