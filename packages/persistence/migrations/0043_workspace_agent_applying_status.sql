ALTER TABLE "workspace_agent_proposals"
  DROP CONSTRAINT IF EXISTS "workspace_agent_proposals_status_chk";

ALTER TABLE "workspace_agent_proposals"
  ADD CONSTRAINT "workspace_agent_proposals_status_chk"
  CHECK ("status" IN ('proposed', 'applying', 'applied', 'rejected'));
