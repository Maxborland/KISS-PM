CREATE TABLE IF NOT EXISTS call_rooms (
  id text NOT NULL,
  tenant_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  meeting_id text,
  title text NOT NULL,
  media_kind text NOT NULL,
  provider text NOT NULL,
  provider_room_id text NOT NULL,
  status text NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  archived_at timestamp with time zone,
  CONSTRAINT call_rooms_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT call_rooms_tenant_fk
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE cascade,
  CONSTRAINT call_rooms_meeting_fk
    FOREIGN KEY (tenant_id, meeting_id)
    REFERENCES meetings(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT call_rooms_created_by_fk
    FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT call_rooms_entity_type_chk CHECK (entity_type IN ('project', 'task', 'opportunity')),
  CONSTRAINT call_rooms_media_kind_chk CHECK (media_kind IN ('audio', 'video')),
  CONSTRAINT call_rooms_provider_chk CHECK (provider IN ('manual', 'jitsi', 'livekit')),
  CONSTRAINT call_rooms_status_chk CHECK (status IN ('scheduled', 'open', 'active', 'ended', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS call_rooms_tenant_entity_idx
  ON call_rooms(tenant_id, entity_type, entity_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS call_rooms_tenant_provider_room_uidx
  ON call_rooms(tenant_id, provider, provider_room_id);

CREATE TABLE IF NOT EXISTS call_sessions (
  id text NOT NULL,
  tenant_id text NOT NULL,
  room_id text NOT NULL,
  provider_session_id text,
  status text NOT NULL,
  started_by_user_id text NOT NULL,
  started_at timestamp with time zone NOT NULL,
  ended_by_user_id text,
  ended_at timestamp with time zone,
  failure_reason text,
  CONSTRAINT call_sessions_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT call_sessions_room_fk
    FOREIGN KEY (tenant_id, room_id)
    REFERENCES call_rooms(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT call_sessions_started_by_fk
    FOREIGN KEY (tenant_id, started_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT call_sessions_ended_by_fk
    FOREIGN KEY (tenant_id, ended_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT call_sessions_status_chk CHECK (status IN ('active', 'ended', 'failed')),
  CONSTRAINT call_sessions_end_chk CHECK (
    (status = 'active' AND ended_at IS NULL)
    OR
    (status <> 'active' AND ended_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS call_sessions_tenant_room_started_idx
  ON call_sessions(tenant_id, room_id, started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS call_sessions_tenant_room_id_uidx
  ON call_sessions(tenant_id, room_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS call_sessions_one_active_per_room_uidx
  ON call_sessions(tenant_id, room_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS call_participant_states (
  tenant_id text NOT NULL,
  room_id text NOT NULL,
  session_id text NOT NULL,
  user_id text NOT NULL,
  state text NOT NULL,
  joined_at timestamp with time zone,
  left_at timestamp with time zone,
  last_seen_at timestamp with time zone NOT NULL,
  CONSTRAINT call_participant_states_pkey PRIMARY KEY (tenant_id, room_id, session_id, user_id),
  CONSTRAINT call_participant_states_session_fk
    FOREIGN KEY (tenant_id, room_id, session_id)
    REFERENCES call_sessions(tenant_id, room_id, id)
    ON DELETE cascade,
  CONSTRAINT call_participant_states_user_fk
    FOREIGN KEY (tenant_id, user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT call_participant_states_state_chk CHECK (
    state IN ('invited', 'joining', 'joined', 'left', 'removed')
  )
);

CREATE TABLE IF NOT EXISTS call_events (
  id text NOT NULL,
  tenant_id text NOT NULL,
  room_id text NOT NULL,
  session_id text,
  event_type text NOT NULL,
  actor_user_id text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT call_events_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT call_events_room_fk
    FOREIGN KEY (tenant_id, room_id)
    REFERENCES call_rooms(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT call_events_session_fk
    FOREIGN KEY (tenant_id, room_id, session_id)
    REFERENCES call_sessions(tenant_id, room_id, id)
    ON DELETE cascade,
  CONSTRAINT call_events_actor_fk
    FOREIGN KEY (tenant_id, actor_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT call_events_type_chk CHECK (
    event_type IN (
      'room_created',
      'session_started',
      'join_token_issued',
      'participant_joined',
      'participant_left',
      'session_ended',
      'recording_attached'
    )
  )
);

CREATE INDEX IF NOT EXISTS call_events_tenant_room_created_idx
  ON call_events(tenant_id, room_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS call_recordings (
  id text NOT NULL,
  tenant_id text NOT NULL,
  room_id text NOT NULL,
  session_id text,
  attachment_id text NOT NULL,
  title text NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  archived_at timestamp with time zone,
  CONSTRAINT call_recordings_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT call_recordings_room_fk
    FOREIGN KEY (tenant_id, room_id)
    REFERENCES call_rooms(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT call_recordings_session_fk
    FOREIGN KEY (tenant_id, room_id, session_id)
    REFERENCES call_sessions(tenant_id, room_id, id)
    ON DELETE cascade,
  CONSTRAINT call_recordings_attachment_fk
    FOREIGN KEY (tenant_id, attachment_id)
    REFERENCES entity_attachments(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT call_recordings_created_by_fk
    FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict
);

CREATE INDEX IF NOT EXISTS call_recordings_tenant_room_created_idx
  ON call_recordings(tenant_id, room_id, created_at DESC);
