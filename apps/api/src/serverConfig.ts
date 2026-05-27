import { readRuntimeSecurityConfig } from "./runtimeSecurityConfig";

const defaultPort = 4000;
const defaultHostname = "127.0.0.1";

export type PlanningEventsBackend = "memory" | "redis";

export type ServerRuntimeConfig = {
  port: number;
  hostname: string;
  databaseUrl: string | undefined;
  enableDevTenantRoutes: boolean;
  planningEventsBackend: PlanningEventsBackend;
  planningEventsRedisUrl: string | undefined;
  production: boolean;
};

export function assertServerRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  parseServerPort(env.PORT);
  parseServerHostname(env.HOST);
  const planningEventsBackend = parsePlanningEventsBackend(env.PLANNING_EVENTS_BACKEND);
  if (env.NODE_ENV === "production" && !env.DATABASE_URL) {
    throw new Error("database_url_required_in_production");
  }
  if (env.NODE_ENV === "production" && env.KISS_PM_ENABLE_DEV_ROUTES === "true") {
    throw new Error("dev_routes_forbidden_in_production");
  }
  if (planningEventsBackend === "redis" && !planningEventsRedisUrlFromEnv(env)) {
    throw new Error("planning_events_redis_url_required");
  }
  if (planningEventsBackend === "redis") {
    readRuntimeSecurityConfig(env);
  }
}

export function readServerRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): ServerRuntimeConfig {
  assertServerRuntimeConfig(env);
  return {
    port: parseServerPort(env.PORT),
    hostname: parseServerHostname(env.HOST),
    databaseUrl: env.DATABASE_URL,
    enableDevTenantRoutes: env.KISS_PM_ENABLE_DEV_ROUTES === "true",
    planningEventsBackend: parsePlanningEventsBackend(env.PLANNING_EVENTS_BACKEND),
    planningEventsRedisUrl: planningEventsRedisUrlFromEnv(env),
    production: env.NODE_ENV === "production"
  };
}

export function parseServerPort(value: string | undefined): number {
  if (value === undefined) return defaultPort;
  if (!/^[1-9][0-9]{0,4}$/.test(value)) {
    throw new Error("invalid_server_port");
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535) {
    throw new Error("invalid_server_port");
  }
  return port;
}

export function parseServerHostname(value: string | undefined): string {
  if (value === undefined) return defaultHostname;
  if (
    value.length < 1 ||
    value.length > 253 ||
    value.trim() !== value ||
    value.includes("://") ||
    !/^[A-Za-z0-9._:-]+$/.test(value)
  ) {
    throw new Error("invalid_server_host");
  }
  return value;
}

export function parsePlanningEventsBackend(value: string | undefined): PlanningEventsBackend {
  if (value === undefined || value === "") return "memory";
  if (value === "memory" || value === "redis") return value;
  throw new Error("invalid_planning_events_backend");
}

function planningEventsRedisUrlFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  return env.PLANNING_EVENTS_REDIS_URL ?? env.REDIS_URL;
}
