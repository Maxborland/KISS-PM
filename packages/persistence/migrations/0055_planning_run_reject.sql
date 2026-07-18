ALTER TABLE "planning_scenario_runs" ADD COLUMN "rejected_at" timestamptz NULL;
--> statement-breakpoint
ALTER TABLE "planning_scenario_runs" ADD COLUMN "rejected_reason" text NULL;
--> statement-breakpoint
ALTER TABLE "planning_solver_runs" ADD COLUMN "rejected_at" timestamptz NULL;
--> statement-breakpoint
ALTER TABLE "planning_solver_runs" ADD COLUMN "rejected_reason" text NULL;
