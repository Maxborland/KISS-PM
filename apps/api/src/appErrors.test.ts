import { describe, expect, it } from "vitest";

import {
  MissingAccessProfileError,
  resolveAppErrorResponse
} from "./appErrors";

describe("API app error responses", () => {
  it("maps missing access profile failures to fail-closed forbidden responses", () => {
    expect(resolveAppErrorResponse(new MissingAccessProfileError())).toEqual({
      body: { error: "access_profile_not_found" },
      status: 403
    });
  });

  it("maps unexpected errors to a generic internal error response", () => {
    expect(resolveAppErrorResponse(new Error("database exploded"))).toEqual({
      body: { error: "internal_error" },
      status: 500
    });
  });
});
