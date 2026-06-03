import { describe, expect, it } from "vitest";

import {
  assertLocalDevDatabase,
  defaultDevDatabaseUrl,
  resetDevDatabaseConfirmation
} from "./reset-dev-db";

describe("reset-dev-db guard", () => {
  it("allows the documented compose development database", () => {
    expect(() => assertLocalDevDatabase(defaultDevDatabaseUrl)).not.toThrow();
  });

  it("rejects another localhost kiss_pm database without explicit confirmation", () => {
    expect(() =>
      assertLocalDevDatabase("postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:5432/kiss_pm")
    ).toThrow("Refusing to reset 127.0.0.1:5432/kiss_pm");
  });

  it("allows an alternate local kiss_pm database only with destructive confirmation", () => {
    expect(() =>
      assertLocalDevDatabase(
        "postgres://kiss_pm:kiss_pm_dev_password@localhost:5432/kiss_pm",
        resetDevDatabaseConfirmation
      )
    ).not.toThrow();
  });

  it("rejects non-local databases even with confirmation", () => {
    expect(() =>
      assertLocalDevDatabase(
        "postgres://kiss_pm:kiss_pm_dev_password@db.example.com:5432/kiss_pm",
        resetDevDatabaseConfirmation
      )
    ).toThrow("Refusing to reset non-local dev database");
  });
});
