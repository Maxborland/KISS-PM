ALTER TABLE "project_baseline_assignments"
  ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'executor';

ALTER TABLE "project_baseline_assignments"
  ADD COLUMN IF NOT EXISTS "units_permille" integer NOT NULL DEFAULT 1000;

ALTER TABLE "project_baseline_assignments"
  DROP CONSTRAINT IF EXISTS "project_baseline_assignments_role_chk";

ALTER TABLE "project_baseline_assignments"
  ADD CONSTRAINT "project_baseline_assignments_role_chk"
  CHECK("role" in ('executor', 'co_executor', 'controller', 'approver', 'observer'));

ALTER TABLE "project_baseline_assignments"
  DROP CONSTRAINT IF EXISTS "project_baseline_assignments_units_permille_chk";

ALTER TABLE "project_baseline_assignments"
  ADD CONSTRAINT "project_baseline_assignments_units_permille_chk" CHECK("units_permille" > 0);
