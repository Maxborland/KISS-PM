export function isSingleUseActivationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return (
    error.message === "source_opportunity_already_activated" ||
    error.message === "source_opportunity_already_has_project" ||
    error.message === "project_draft_not_activatable" ||
    error.message.includes("projects_tenant_source_opportunity_uidx")
  );
}
