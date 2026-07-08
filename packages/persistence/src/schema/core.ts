import {
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const accessProfiles = pgTable(
  "access_profiles",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    permissions: jsonb("permissions").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "access_profiles_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("access_profiles_tenant_id_idx").on(table.tenantId),
    uniqueIndex("access_profiles_tenant_id_name_uidx").on(table.tenantId, table.name)
  ]
);

export const positions = pgTable(
  "positions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    index("positions_tenant_id_idx").on(table.tenantId),
    uniqueIndex("positions_tenant_id_id_uidx").on(table.tenantId, table.id),
    uniqueIndex("positions_tenant_id_name_uidx").on(table.tenantId, table.name)
  ]
);

export const tenantUsers = pgTable(
  "tenant_users",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    accessProfileId: text("access_profile_id").notNull(),
    positionId: text("position_id"),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    telegram: text("telegram"),
    status: text("status").notNull().default("active"),
    theme: text("theme").notNull().default("light"),
    accentColor: text("accent_color").notNull().default("#0f766e"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    index("tenant_users_tenant_id_idx").on(table.tenantId),
    uniqueIndex("tenant_users_tenant_id_id_uidx").on(table.tenantId, table.id),
    uniqueIndex("tenant_users_tenant_id_email_uidx").on(table.tenantId, table.email),
    foreignKey({
      name: "tenant_users_access_profile_same_tenant_fk",
      columns: [table.tenantId, table.accessProfileId],
      foreignColumns: [accessProfiles.tenantId, accessProfiles.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "tenant_users_position_same_tenant_fk",
      columns: [table.tenantId, table.positionId],
      foreignColumns: [positions.tenantId, positions.id]
    }).onDelete("restrict")
  ]
);

export const userCredentials = pgTable(
  "user_credentials",
  {
    userId: text("user_id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    uniqueIndex("user_credentials_email_uidx").on(table.email),
    foreignKey({
      name: "user_credentials_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade")
  ]
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    // Метаданные устройства/активности (P3.2 active-sessions). Nullable: старые строки без них.
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("user_sessions_token_hash_uidx").on(table.tokenHash),
    index("user_sessions_user_id_idx").on(table.userId),
    foreignKey({
      name: "user_sessions_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade")
  ]
);

// Одноразовые токены сброса пароля (тенант-скоупленные, с истечением и фактом погашения).

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    requestedIp: text("requested_ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "password_reset_tokens_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "password_reset_tokens_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    uniqueIndex("password_reset_tokens_token_hash_uidx").on(table.tokenHash),
    index("password_reset_tokens_user_id_idx").on(table.tenantId, table.userId)
  ]
);
export const writeFlowIdempotencyKeys = pgTable(
  "write_flow_idempotency_keys",
  {
    tenantId: text("tenant_id").notNull(),
    surface: text("surface").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    clientRequestId: text("client_request_id").notNull(),
    resourceId: text("resource_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "write_flow_idempotency_keys_pkey",
      columns: [table.tenantId, table.surface, table.actorUserId, table.clientRequestId]
    }),
    foreignKey({
      name: "write_flow_idempotency_keys_actor_fk",
      columns: [table.tenantId, table.actorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    index("write_flow_idempotency_keys_tenant_created_idx").on(table.tenantId, table.createdAt)
  ]
);
