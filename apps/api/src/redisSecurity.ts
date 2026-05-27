export function requireSecureRedisUrl(input: {
  allowInsecure?: boolean;
  production?: boolean;
  url: string;
}): string {
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    throw new Error("redis_url_invalid");
  }

  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("redis_url_invalid");
  }
  if (url.protocol === "redis:" && input.production && !input.allowInsecure) {
    throw new Error("redis_url_insecure_in_production");
  }
  return url.toString();
}
