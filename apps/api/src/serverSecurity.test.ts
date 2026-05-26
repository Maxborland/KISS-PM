import { describe, expect, it } from "vitest";

import {
  configureHttpServerSecurity,
  defaultHeadersTimeoutMs,
  defaultKeepAliveTimeoutMs,
  defaultMaxHeadersCount,
  defaultRequestTimeoutMs,
  isConfigurableHttpServer
} from "./serverSecurity";

describe("API HTTP server security configuration", () => {
  it("sets bounded request, header, keep-alive and header-count limits", () => {
    const server = mutableServer();

    configureHttpServerSecurity(server);

    expect(server).toEqual({
      requestTimeout: defaultRequestTimeoutMs,
      headersTimeout: defaultHeadersTimeoutMs,
      keepAliveTimeout: defaultKeepAliveTimeoutMs,
      maxHeadersCount: defaultMaxHeadersCount
    });
  });

  it("keeps headers timeout no larger than request timeout", () => {
    const server = mutableServer();

    configureHttpServerSecurity(server, {
      headersTimeoutMs: 120_000,
      requestTimeoutMs: 30_000
    });

    expect(server.requestTimeout).toBe(30_000);
    expect(server.headersTimeout).toBe(30_000);
  });

  it("falls back when provided limits are invalid", () => {
    const server = mutableServer();

    configureHttpServerSecurity(server, {
      headersTimeoutMs: 0,
      keepAliveTimeoutMs: Number.NaN,
      maxHeadersCount: -1,
      requestTimeoutMs: 1.5
    });

    expect(server).toEqual({
      requestTimeout: defaultRequestTimeoutMs,
      headersTimeout: defaultHeadersTimeoutMs,
      keepAliveTimeout: defaultKeepAliveTimeoutMs,
      maxHeadersCount: defaultMaxHeadersCount
    });
  });

  it("detects compatible Node HTTP servers before applying limits", () => {
    expect(isConfigurableHttpServer(mutableServer())).toBe(true);
    expect(isConfigurableHttpServer({})).toBe(false);
    expect(isConfigurableHttpServer(null)).toBe(false);
  });
});

function mutableServer() {
  return {
    headersTimeout: 0,
    keepAliveTimeout: 0,
    maxHeadersCount: 0,
    requestTimeout: 0
  };
}
