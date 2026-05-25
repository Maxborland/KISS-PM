import type { Server } from "node:http";

export const defaultRequestTimeoutMs = 60_000;
export const defaultHeadersTimeoutMs = 15_000;
export const defaultKeepAliveTimeoutMs = 5_000;
export const defaultMaxHeadersCount = 100;

type HttpServerSecurityOptions = {
  requestTimeoutMs?: number;
  headersTimeoutMs?: number;
  keepAliveTimeoutMs?: number;
  maxHeadersCount?: number;
};

type ConfigurableHttpServer = Pick<
  Server,
  "headersTimeout" | "keepAliveTimeout" | "maxHeadersCount" | "requestTimeout"
>;

export function isConfigurableHttpServer(
  server: unknown
): server is ConfigurableHttpServer {
  return Boolean(
    server &&
      typeof server === "object" &&
      "headersTimeout" in server &&
      "keepAliveTimeout" in server &&
      "maxHeadersCount" in server &&
      "requestTimeout" in server
  );
}

export function configureHttpServerSecurity(
  server: ConfigurableHttpServer,
  options: HttpServerSecurityOptions = {}
): void {
  const requestTimeoutMs = safePositiveInteger(
    options.requestTimeoutMs,
    defaultRequestTimeoutMs
  );
  const headersTimeoutMs = Math.min(
    safePositiveInteger(options.headersTimeoutMs, defaultHeadersTimeoutMs),
    requestTimeoutMs
  );

  server.requestTimeout = requestTimeoutMs;
  server.headersTimeout = headersTimeoutMs;
  server.keepAliveTimeout = safePositiveInteger(
    options.keepAliveTimeoutMs,
    defaultKeepAliveTimeoutMs
  );
  server.maxHeadersCount = safePositiveInteger(
    options.maxHeadersCount,
    defaultMaxHeadersCount
  );
}

function safePositiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : fallback;
}
