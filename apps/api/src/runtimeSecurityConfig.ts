import { requireSecureRedisUrl } from "./redisSecurity";

export type RuntimeSecurityConfig = {
  production: boolean;
  secureCookies: boolean;
  planningEventsRedisUrl?: string;
};

export function readRuntimeSecurityConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env
): RuntimeSecurityConfig {
  const production = env.NODE_ENV === "production";
  const config: RuntimeSecurityConfig = {
    production,
    secureCookies: readSecureCookiePolicy(env)
  };
  const planningEventsRedisUrl = readSecureRedisPolicy({
      allowInsecure: env.PLANNING_EVENTS_REDIS_ALLOW_INSECURE === "true",
      production,
      url: env.PLANNING_EVENTS_REDIS_URL ?? env.REDIS_URL
  });
  if (planningEventsRedisUrl !== undefined) {
    config.planningEventsRedisUrl = planningEventsRedisUrl;
  }
  return config;
}

export function readSecureCookiePolicy(
  env: Partial<Pick<NodeJS.ProcessEnv, "KISS_PM_SECURE_COOKIES" | "NODE_ENV">> = process.env
): boolean {
  if (env.NODE_ENV === "production" && env.KISS_PM_SECURE_COOKIES === "false") {
    throw new Error("secure_cookies_required_in_production");
  }
  if (env.KISS_PM_SECURE_COOKIES === "true") return true;
  if (env.KISS_PM_SECURE_COOKIES === "false") return false;
  return env.NODE_ENV === "production";
}

export function readSecureRedisPolicy(input: {
  allowInsecure?: boolean;
  production: boolean;
  url: string | undefined;
}): string | undefined {
  if (!input.url) return undefined;
  return requireSecureRedisUrl(input as { allowInsecure?: boolean; production: boolean; url: string });
}
