CREATE TABLE IF NOT EXISTS conversations (
  id text NOT NULL,
  tenant_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  conversation_type text NOT NULL,
  title text NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  archived_at timestamp with time zone,
  CONSTRAINT conversations_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT conversations_created_by_fk
    FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT conversations_entity_type_chk CHECK (entity_type IN ('project', 'task', 'opportunity')),
  CONSTRAINT conversations_type_chk CHECK (conversation_type IN ('default', 'meeting_followup'))
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_tenant_entity_type_uidx
  ON conversations(tenant_id, entity_type, entity_id, conversation_type);

CREATE INDEX IF NOT EXISTS conversations_tenant_entity_idx
  ON conversations(tenant_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS discussion_messages (
  id text NOT NULL,
  tenant_id text NOT NULL,
  conversation_id text NOT NULL,
  author_user_id text NOT NULL,
  body text NOT NULL,
  metadata jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL,
  edited_at timestamp with time zone,
  archived_at timestamp with time zone,
  pinned_at timestamp with time zone,
  pinned_by_user_id text,
  CONSTRAINT discussion_messages_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT discussion_messages_conversation_fk
    FOREIGN KEY (tenant_id, conversation_id)
    REFERENCES conversations(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT discussion_messages_author_fk
    FOREIGN KEY (tenant_id, author_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT discussion_messages_pinned_by_fk
    FOREIGN KEY (tenant_id, pinned_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict
);

CREATE INDEX IF NOT EXISTS discussion_messages_tenant_conversation_created_idx
  ON discussion_messages(tenant_id, conversation_id, created_at, id);

CREATE TABLE IF NOT EXISTS message_mentions (
  tenant_id text NOT NULL,
  message_id text NOT NULL,
  mentioned_user_id text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT message_mentions_pkey PRIMARY KEY (tenant_id, message_id, mentioned_user_id),
  CONSTRAINT message_mentions_message_fk
    FOREIGN KEY (tenant_id, message_id)
    REFERENCES discussion_messages(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT message_mentions_user_fk
    FOREIGN KEY (tenant_id, mentioned_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict
);

CREATE INDEX IF NOT EXISTS message_mentions_tenant_user_created_idx
  ON message_mentions(tenant_id, mentioned_user_id, created_at);

CREATE TABLE IF NOT EXISTS conversation_read_states (
  tenant_id text NOT NULL,
  conversation_id text NOT NULL,
  user_id text NOT NULL,
  last_read_message_id text,
  last_read_at timestamp with time zone,
  unread_count integer NOT NULL,
  CONSTRAINT conversation_read_states_pkey PRIMARY KEY (tenant_id, conversation_id, user_id),
  CONSTRAINT conversation_read_states_conversation_fk
    FOREIGN KEY (tenant_id, conversation_id)
    REFERENCES conversations(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT conversation_read_states_user_fk
    FOREIGN KEY (tenant_id, user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT conversation_read_states_unread_chk CHECK (unread_count >= 0)
);

CREATE TABLE IF NOT EXISTS user_notifications (
  id text NOT NULL,
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  notification_type text NOT NULL,
  source_entity_type text NOT NULL,
  source_entity_id text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  route text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  read_at timestamp with time zone,
  archived_at timestamp with time zone,
  CONSTRAINT user_notifications_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT user_notifications_user_fk
    FOREIGN KEY (tenant_id, user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT user_notifications_type_chk CHECK (
    notification_type IN (
      'mention',
      'assignment_changed',
      'deadline_risk',
      'control_signal',
      'meeting_invite',
      'meeting_action_item'
    )
  )
);

CREATE INDEX IF NOT EXISTS user_notifications_tenant_user_created_idx
  ON user_notifications(tenant_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_notifications_tenant_user_unread_idx
  ON user_notifications(tenant_id, user_id, read_at)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS notification_preferences (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  channel text NOT NULL,
  notification_type text NOT NULL,
  enabled boolean NOT NULL,
  digest_frequency text NOT NULL,
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (
    tenant_id,
    user_id,
    channel,
    notification_type
  ),
  CONSTRAINT notification_preferences_user_fk
    FOREIGN KEY (tenant_id, user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT notification_preferences_channel_chk CHECK (channel IN ('in_app', 'email', 'digest')),
  CONSTRAINT notification_preferences_type_chk CHECK (
    notification_type IN (
      'mention',
      'assignment_changed',
      'deadline_risk',
      'control_signal',
      'meeting_invite',
      'meeting_action_item'
    )
  ),
  CONSTRAINT notification_preferences_digest_chk CHECK (digest_frequency IN ('none', 'daily', 'weekly'))
);

CREATE TABLE IF NOT EXISTS meetings (
  id text NOT NULL,
  tenant_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  title text NOT NULL,
  agenda text NOT NULL,
  scheduled_start timestamp with time zone NOT NULL,
  scheduled_finish timestamp with time zone NOT NULL,
  status text NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  archived_at timestamp with time zone,
  CONSTRAINT meetings_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT meetings_created_by_fk
    FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT meetings_entity_type_chk CHECK (entity_type IN ('project', 'task', 'opportunity')),
  CONSTRAINT meetings_status_chk CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  CONSTRAINT meetings_schedule_chk CHECK (scheduled_finish > scheduled_start)
);

CREATE INDEX IF NOT EXISTS meetings_tenant_entity_start_idx
  ON meetings(tenant_id, entity_type, entity_id, scheduled_start);

CREATE TABLE IF NOT EXISTS meeting_participants (
  tenant_id text NOT NULL,
  meeting_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL,
  response text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT meeting_participants_pkey PRIMARY KEY (tenant_id, meeting_id, user_id),
  CONSTRAINT meeting_participants_meeting_fk
    FOREIGN KEY (tenant_id, meeting_id)
    REFERENCES meetings(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT meeting_participants_user_fk
    FOREIGN KEY (tenant_id, user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT meeting_participants_role_chk CHECK (role IN ('organizer', 'required', 'optional')),
  CONSTRAINT meeting_participants_response_chk CHECK (response IN ('pending', 'accepted', 'declined'))
);

CREATE TABLE IF NOT EXISTS meeting_external_links (
  id text NOT NULL,
  tenant_id text NOT NULL,
  meeting_id text NOT NULL,
  provider text NOT NULL,
  url text NOT NULL,
  title text NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  archived_at timestamp with time zone,
  CONSTRAINT meeting_external_links_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT meeting_external_links_meeting_fk
    FOREIGN KEY (tenant_id, meeting_id)
    REFERENCES meetings(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT meeting_external_links_created_by_fk
    FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT meeting_external_links_provider_chk CHECK (
    provider IN ('zoom', 'teams', 'google_meet', 'manual_link', 'other')
  )
);

CREATE INDEX IF NOT EXISTS meeting_external_links_tenant_meeting_idx
  ON meeting_external_links(tenant_id, meeting_id);

CREATE TABLE IF NOT EXISTS meeting_notes (
  id text NOT NULL,
  tenant_id text NOT NULL,
  meeting_id text NOT NULL,
  author_user_id text NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  edited_at timestamp with time zone,
  archived_at timestamp with time zone,
  CONSTRAINT meeting_notes_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT meeting_notes_meeting_fk
    FOREIGN KEY (tenant_id, meeting_id)
    REFERENCES meetings(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT meeting_notes_author_fk
    FOREIGN KEY (tenant_id, author_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict
);

CREATE INDEX IF NOT EXISTS meeting_notes_tenant_meeting_created_idx
  ON meeting_notes(tenant_id, meeting_id, created_at);

CREATE TABLE IF NOT EXISTS meeting_action_items (
  id text NOT NULL,
  tenant_id text NOT NULL,
  meeting_id text NOT NULL,
  title text NOT NULL,
  owner_user_id text NOT NULL,
  due_date text,
  target_entity_type text NOT NULL,
  target_entity_id text NOT NULL,
  status text NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  archived_at timestamp with time zone,
  CONSTRAINT meeting_action_items_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT meeting_action_items_meeting_fk
    FOREIGN KEY (tenant_id, meeting_id)
    REFERENCES meetings(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT meeting_action_items_owner_fk
    FOREIGN KEY (tenant_id, owner_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT meeting_action_items_created_by_fk
    FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT meeting_action_items_target_type_chk CHECK (
    target_entity_type IN ('task', 'corrective_action', 'project', 'opportunity')
  ),
  CONSTRAINT meeting_action_items_status_chk CHECK (status IN ('open', 'done', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS meeting_action_items_tenant_meeting_created_idx
  ON meeting_action_items(tenant_id, meeting_id, created_at);
