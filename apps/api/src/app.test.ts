import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

describe("API health route", () => {
  it("returns stable health JSON without external services", async () => {
    const app = createApiApp();

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "kiss-pm-api"
    });
  });
});

