import { describe, expect, it } from "vitest";

import { createRequestJson } from "./domain-client";

describe("createRequestJson", () => {
  it("rejects malformed JSON from a successful response", async () => {
    const requestJson = createRequestJson({
      apiOrigin: "",
      fetchImpl: async () => new Response("{", { status: 200, headers: { "content-type": "application/json" } })
    });

    await expect(requestJson("/api/workspace/projects")).rejects.toMatchObject({
      status: 200,
      code: "invalid_json_response",
      body: { error: "invalid_json_response" }
    });
  });

  it("rejects a non-object JSON envelope from a successful response", async () => {
    const requestJson = createRequestJson({
      apiOrigin: "",
      fetchImpl: async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
    });

    await expect(requestJson("/api/workspace/projects")).rejects.toMatchObject({
      status: 200,
      code: "invalid_json_response"
    });
  });
});