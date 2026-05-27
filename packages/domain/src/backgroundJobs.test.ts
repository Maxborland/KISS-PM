import { describe, expect, it } from "vitest";

import {
  computeBackgroundJobRetryDelayMs,
  nextBackgroundJobFailureState,
  normalizeBackgroundJobMaxAttempts,
  normalizeBackgroundJobPayload,
  normalizeBackgroundJobPriority,
  parseBackgroundJobKind
} from "./backgroundJobs";

describe("background job domain rules", () => {
  it("accepts only known job kinds", () => {
    expect(parseBackgroundJobKind("storage.asset_cleanup")).toEqual({
      ok: true,
      value: "storage.asset_cleanup"
    });
    expect(parseBackgroundJobKind("shell.exec")).toEqual({
      ok: false,
      error: "background_job_kind_invalid"
    });
  });

  it("normalizes bounded enqueue controls", () => {
    expect(normalizeBackgroundJobPriority(500)).toBe(100);
    expect(normalizeBackgroundJobPriority(-500)).toBe(-100);
    expect(normalizeBackgroundJobPriority("high")).toBe(0);
    expect(normalizeBackgroundJobMaxAttempts(0)).toBe(1);
    expect(normalizeBackgroundJobMaxAttempts(99)).toBe(25);
    expect(normalizeBackgroundJobMaxAttempts("many")).toBe(5);
    expect(normalizeBackgroundJobPayload(["not", "an", "object"])).toEqual({});
    expect(normalizeBackgroundJobPayload({ monthIso: "2026-05" })).toEqual({
      monthIso: "2026-05"
    });
  });

  it("uses deterministic exponential retry delays and marks exhausted jobs dead", () => {
    const failedAt = new Date("2026-05-27T00:00:00.000Z");
    expect(computeBackgroundJobRetryDelayMs(1)).toBe(60_000);
    expect(computeBackgroundJobRetryDelayMs(4)).toBe(480_000);
    expect(nextBackgroundJobFailureState({ attempt: 2, maxAttempts: 3, failedAt }))
      .toEqual({
        status: "queued",
        runAfter: new Date("2026-05-27T00:02:00.000Z")
      });
    expect(nextBackgroundJobFailureState({ attempt: 3, maxAttempts: 3, failedAt }))
      .toEqual({ status: "dead", runAfter: failedAt });
  });
});
