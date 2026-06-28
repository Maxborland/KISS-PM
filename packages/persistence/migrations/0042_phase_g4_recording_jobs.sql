ALTER TABLE background_job_schedules DROP CONSTRAINT IF EXISTS background_job_schedules_kind_chk;
--> statement-breakpoint
ALTER TABLE background_job_schedules
  ADD CONSTRAINT background_job_schedules_kind_chk CHECK (
    kind IN (
      'storage.asset_cleanup',
      'notification.dispatch',
      'connector.sync',
      'search.projection_rebuild',
      'capacity.cache_warmup',
      'calls.recording_janitor',
      'calls.recording_compose'
    )
  );
--> statement-breakpoint
ALTER TABLE background_job_runs DROP CONSTRAINT IF EXISTS background_job_runs_kind_chk;
--> statement-breakpoint
ALTER TABLE background_job_runs
  ADD CONSTRAINT background_job_runs_kind_chk CHECK (
    kind IN (
      'storage.asset_cleanup',
      'notification.dispatch',
      'connector.sync',
      'search.projection_rebuild',
      'capacity.cache_warmup',
      'calls.recording_janitor',
      'calls.recording_compose'
    )
  );
