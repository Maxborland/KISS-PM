const defaultPort = 4000;
const defaultHostname = "127.0.0.1";

export type ServerRuntimeConfig = {
  port: number;
  hostname: string;
  databaseUrl: string | undefined;
  enableDevTenantRoutes: boolean;
  production: boolean;
};

export function assertServerRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  parseServerPort(env.PORT);
  parseServerHostname(env.HOST);
  if (env.NODE_ENV === "production" && !env.DATABASE_URL) {
    throw new Error("database_url_required_in_production");
  }
  if (env.NODE_ENV === "production" && env.KISS_PM_ENABLE_DEV_ROUTES === "true") {
    throw new Error("dev_routes_forbidden_in_production");
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
