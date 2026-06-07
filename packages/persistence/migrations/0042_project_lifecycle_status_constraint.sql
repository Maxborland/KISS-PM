ALTER TABLE "projects"
  ADD CONSTRAINT "projects_status_chk" CHECK ("status" in ('draft', 'active', 'paused', 'closed', 'cancelled'));
