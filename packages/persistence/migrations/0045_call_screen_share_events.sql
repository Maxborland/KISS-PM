ALTER TABLE call_events DROP CONSTRAINT IF EXISTS call_events_type_chk;
--> statement-breakpoint
ALTER TABLE call_events ADD CONSTRAINT call_events_type_chk CHECK (
  event_type IN (
    'room_created',
    'session_started',
    'join_token_issued',
    'participant_invited',
    'participant_joining',
    'participant_joined',
    'participant_left',
    'screen_share_started',
    'screen_share_stopped',
    'session_ended',
    'recording_attached'
  )
);
