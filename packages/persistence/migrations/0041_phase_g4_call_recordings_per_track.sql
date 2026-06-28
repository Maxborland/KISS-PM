ALTER TABLE call_recordings ALTER COLUMN attachment_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE call_recordings ADD COLUMN IF NOT EXISTS recording_group_id text;
--> statement-breakpoint
ALTER TABLE call_recordings ADD COLUMN IF NOT EXISTS egress_id text;
--> statement-breakpoint
ALTER TABLE call_recordings ADD COLUMN IF NOT EXISTS participant_id text;
--> statement-breakpoint
ALTER TABLE call_recordings ADD COLUMN IF NOT EXISTS track_id text;
--> statement-breakpoint
ALTER TABLE call_recordings ADD COLUMN IF NOT EXISTS kind text;
--> statement-breakpoint
ALTER TABLE call_recordings ADD COLUMN IF NOT EXISTS status text;
--> statement-breakpoint
ALTER TABLE call_recordings ADD COLUMN IF NOT EXISTS duration_seconds integer;
--> statement-breakpoint
ALTER TABLE call_recordings ADD COLUMN IF NOT EXISTS ended_at timestamptz;
--> statement-breakpoint
UPDATE call_recordings
  SET recording_group_id = COALESCE(recording_group_id, id),
      kind = COALESCE(kind, 'composed'),
      status = COALESCE(status, 'ready')
  WHERE recording_group_id IS NULL OR kind IS NULL OR status IS NULL;
--> statement-breakpoint
ALTER TABLE call_recordings ALTER COLUMN recording_group_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE call_recordings ALTER COLUMN kind SET NOT NULL;
--> statement-breakpoint
ALTER TABLE call_recordings ALTER COLUMN status SET NOT NULL;
--> statement-breakpoint
ALTER TABLE call_recordings DROP CONSTRAINT IF EXISTS call_recordings_kind_chk;
--> statement-breakpoint
ALTER TABLE call_recordings ADD CONSTRAINT call_recordings_kind_chk CHECK (kind IN ('audio', 'video', 'composed'));
--> statement-breakpoint
ALTER TABLE call_recordings DROP CONSTRAINT IF EXISTS call_recordings_status_chk;
--> statement-breakpoint
ALTER TABLE call_recordings ADD CONSTRAINT call_recordings_status_chk CHECK (status IN ('starting', 'recording', 'ready', 'failed'));
--> statement-breakpoint
ALTER TABLE call_recordings DROP CONSTRAINT IF EXISTS call_recordings_ready_attachment_chk;
--> statement-breakpoint
ALTER TABLE call_recordings ADD CONSTRAINT call_recordings_ready_attachment_chk CHECK (
  (status = 'ready' AND attachment_id IS NOT NULL) OR (status <> 'ready')
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS call_recordings_tenant_egress_uidx
  ON call_recordings (tenant_id, egress_id) WHERE egress_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS call_recordings_tenant_group_idx
  ON call_recordings (tenant_id, recording_group_id);
--> statement-breakpoint
ALTER TABLE call_events DROP CONSTRAINT IF EXISTS call_events_type_chk;
--> statement-breakpoint
ALTER TABLE call_events
  ADD CONSTRAINT call_events_type_chk CHECK (
    event_type IN (
      'room_created',
      'session_started',
      'join_token_issued',
      'participant_invited',
      'participant_joining',
      'participant_joined',
      'participant_left',
      'session_ended',
      'recording_attached',
      'recording_started',
      'recording_track_completed',
      'recording_completed',
      'recording_failed'
    )
  );
