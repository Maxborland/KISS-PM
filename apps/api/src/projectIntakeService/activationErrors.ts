export function isSingleUseActivationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return (
    error.message === "source_opportunity_already_activated" ||
    error.message.includes("projects_tenant_source_opportunity_uidx")
  );
}
