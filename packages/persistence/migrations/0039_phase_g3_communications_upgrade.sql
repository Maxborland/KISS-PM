CREATE TABLE IF NOT EXISTS "communication_channels" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "channel_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "scope_entity_type" text,
  "scope_entity_id" text,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "archived_at" timestamp with time zone,
  CONSTRAINT "communication_channels_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "communication_channels_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
  CONSTRAINT "communication_channels_created_by_fk"
    FOREIGN KEY ("tenant_id", "created_by_user_id")
    REFERENCES "tenant_users"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "communication_channels_type_chk"
    CHECK ("channel_type" in ('workspace_general', 'team', 'project_general', 'custom')),
  CONSTRAINT "communication_channels_scope_type_chk"
    CHECK ("scope_entity_type" is null or "scope_entity_type" in ('project', 'org_unit')),
  CONSTRAINT "communication_channels_scope_chk"
    CHECK (
      (
        "channel_type" in ('team', 'project_general')
        and "scope_entity_type" is not null
        and "scope_entity_id" is not null
      )
      or
      ("channel_type" not in ('team', 'project_general'))
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "communication_channels_workspace_general_uidx"
  ON "communication_channels" ("tenant_id", "channel_type")
  WHERE "channel_type" = 'workspace_general' and "archived_at" is null;

CREATE INDEX IF NOT EXISTS "communication_channels_tenant_type_idx"
  ON "communication_channels" ("tenant_id", "channel_type", "created_at");

CREATE TABLE IF NOT EXISTS "communication_channel_members" (
  "tenant_id" text NOT NULL,
  "channel_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "archived_at" timestamp with time zone,
  CONSTRAINT "communication_channel_members_pkey" PRIMARY KEY ("tenant_id", "channel_id", "user_id"),
  CONSTRAINT "communication_channel_members_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
  CONSTRAINT "communication_channel_members_channel_fk"
    FOREIGN KEY ("tenant_id", "channel_id")
    REFERENCES "communication_channels"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "communication_channel_members_user_fk"
    FOREIGN KEY ("tenant_id", "user_id")
    REFERENCES "tenant_users"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "communication_channel_members_created_by_fk"
    FOREIGN KEY ("tenant_id", "created_by_user_id")
    REFERENCES "tenant_users"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "communication_channel_members_role_chk"
    CHECK ("role" in ('owner', 'moderator', 'member'))
);

CREATE INDEX IF NOT EXISTS "communication_channel_members_tenant_user_idx"
  ON "communication_channel_members" ("tenant_id", "user_id");

ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_entity_type_chk";
ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_entity_type_chk"
  CHECK ("entity_type" in ('project', 'task', 'opportunity', 'client', 'contact', 'product', 'communication_channel'));

ALTER TABLE "meetings" DROP CONSTRAINT IF EXISTS "meetings_entity_type_chk";
ALTER TABLE "meetings"
  ADD CONSTRAINT "meetings_entity_type_chk"
  CHECK ("entity_type" in ('project', 'task', 'opportunity', 'client', 'contact', 'product', 'communication_channel'));

ALTER TABLE "call_rooms" DROP CONSTRAINT IF EXISTS "call_rooms_entity_type_chk";
ALTER TABLE "call_rooms"
  ADD CONSTRAINT "call_rooms_entity_type_chk"
  CHECK ("entity_type" in ('project', 'task', 'opportunity', 'client', 'contact', 'product', 'communication_channel'));

CREATE TABLE IF NOT EXISTS "message_reactions" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "message_id" text NOT NULL,
  "user_id" text NOT NULL,
  "emoji" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "archived_at" timestamp with time zone,
  CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "message_reactions_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
  CONSTRAINT "message_reactions_message_fk"
    FOREIGN KEY ("tenant_id", "message_id")
    REFERENCES "discussion_messages"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "message_reactions_user_fk"
    FOREIGN KEY ("tenant_id", "user_id")
    REFERENCES "tenant_users"("tenant_id", "id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "message_reactions_active_uidx"
  ON "message_reactions" ("tenant_id", "message_id", "user_id", "emoji")
  WHERE "archived_at" is null;

CREATE INDEX IF NOT EXISTS "message_reactions_tenant_message_idx"
  ON "message_reactions" ("tenant_id", "message_id");

CREATE TABLE IF NOT EXISTS "sticker_packs" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "source" text NOT NULL,
  "status" text NOT NULL,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "archived_at" timestamp with time zone,
  CONSTRAINT "sticker_packs_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "sticker_packs_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
  CONSTRAINT "sticker_packs_created_by_fk"
    FOREIGN KEY ("tenant_id", "created_by_user_id")
    REFERENCES "tenant_users"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "sticker_packs_source_chk"
    CHECK ("source" in ('manual_upload', 'telegram_export', 'other_import')),
  CONSTRAINT "sticker_packs_status_chk"
    CHECK ("status" in ('ready', 'archived'))
);

CREATE INDEX IF NOT EXISTS "sticker_packs_tenant_created_idx"
  ON "sticker_packs" ("tenant_id", "created_at");

CREATE TABLE IF NOT EXISTS "sticker_assets" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "pack_id" text NOT NULL,
  "file_asset_id" text NOT NULL,
  "emoji" text NOT NULL,
  "title" text NOT NULL,
  "tags" jsonb NOT NULL,
  "mime_type" text NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "size_bytes" integer NOT NULL,
  "checksum_sha256" text NOT NULL,
  "status" text NOT NULL,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "archived_at" timestamp with time zone,
  CONSTRAINT "sticker_assets_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "sticker_assets_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
  CONSTRAINT "sticker_assets_pack_fk"
    FOREIGN KEY ("tenant_id", "pack_id")
    REFERENCES "sticker_packs"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "sticker_assets_file_asset_fk"
    FOREIGN KEY ("tenant_id", "file_asset_id")
    REFERENCES "file_assets"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "sticker_assets_created_by_fk"
    FOREIGN KEY ("tenant_id", "created_by_user_id")
    REFERENCES "tenant_users"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "sticker_assets_mime_chk"
    CHECK ("mime_type" in ('image/png', 'image/webp')),
  CONSTRAINT "sticker_assets_status_chk"
    CHECK ("status" in ('pending', 'ready', 'archived', 'failed')),
  CONSTRAINT "sticker_assets_size_chk"
    CHECK ("size_bytes" > 0 and "size_bytes" <= 2097152),
  CONSTRAINT "sticker_assets_dimensions_chk"
    CHECK ("width" between 64 and 512 and "height" between 64 and 512)
);

CREATE INDEX IF NOT EXISTS "sticker_assets_tenant_pack_idx"
  ON "sticker_assets" ("tenant_id", "pack_id");

CREATE TABLE IF NOT EXISTS "message_stickers" (
  "tenant_id" text NOT NULL,
  "message_id" text NOT NULL,
  "sticker_asset_id" text NOT NULL,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "message_stickers_pkey" PRIMARY KEY ("tenant_id", "message_id"),
  CONSTRAINT "message_stickers_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
  CONSTRAINT "message_stickers_message_fk"
    FOREIGN KEY ("tenant_id", "message_id")
    REFERENCES "discussion_messages"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "message_stickers_sticker_fk"
    FOREIGN KEY ("tenant_id", "sticker_asset_id")
    REFERENCES "sticker_assets"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "message_stickers_created_by_fk"
    FOREIGN KEY ("tenant_id", "created_by_user_id")
    REFERENCES "tenant_users"("tenant_id", "id") ON DELETE restrict
);

CREATE INDEX IF NOT EXISTS "message_stickers_tenant_sticker_idx"
  ON "message_stickers" ("tenant_id", "sticker_asset_id");
