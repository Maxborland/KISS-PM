export function assertServerRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === "production" && !env.DATABASE_URL) {
    throw new Error("database_url_required_in_production");
  }
}
