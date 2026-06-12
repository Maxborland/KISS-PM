import { describe, expect, it } from "vitest";

import { parseOperationalControlQueueQuery } from "./operationalQueue";

describe("operational control queue application module", () => {
  it("keeps the route query validation contract at the module boundary", () => {
    expect(
      parseOperationalControlQueueQuery({
        asOf: "2026-06-10T00:00:00.000Z",
        limit: "25"
      })
    ).toEqual({
      ok: true,
      value: {
        asOf: new Date("2026-06-10T00:00:00.000Z"),
        limit: 25
      }
    });

    expect(parseOperationalControlQueueQuery({ asOf: "not-a-date", limit: "25" })).toEqual({
      ok: false,
      error: "invalid_operational_queue_as_of"
    });
    expect(parseOperationalControlQueueQuery({ asOf: undefined, limit: "0" })).toEqual({
      ok: false,
      error: "invalid_operational_queue_limit"
    });
  });
});
