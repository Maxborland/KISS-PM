import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  type PostgresClient
} from "./index";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm";

describe("PostgreSQL tenant data source", () => {
  let client: PostgresClient;
  let dataSource: ReturnType<typeof createPostgresTenantDataSource>;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    dataSource = createPostgresTenantDataSource(createDatabase(client));
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("lists users only inside the requested tenant", async () => {
    await client`
      INSERT INTO tenants (id, name, created_at)
      VALUES
        ('tenant-alpha', 'Альфа Проект', now()),
        ('tenant-beta', 'Бета Проект', now())
    `;
    await client`
      INSERT INTO access_profiles (id, tenant_id, name, permissions, created_at)
      VALUES
        ('tenant-admin-alpha', 'tenant-alpha', 'Администратор', '["tenant.users.read"]'::jsonb, now()),
        ('tenant-admin-beta', 'tenant-beta', 'Администратор', '["tenant.users.read"]'::jsonb, now())
    `;
    await client`
      INSERT INTO tenant_users (id, tenant_id, access_profile_id, email, name, created_at)
      VALUES
        ('user-alpha-admin', 'tenant-alpha', 'tenant-admin-alpha', 'admin@kiss-pm.local', 'Анна Администратор', now()),
        ('user-beta-admin', 'tenant-beta', 'tenant-admin-beta', 'beta@kiss-pm.local', 'Борис Администратор', now())
    `;

    await expect(dataSource.listUsersByTenantId("tenant-alpha")).resolves.toEqual([
      {
        id: "user-alpha-admin",
        tenantId: "tenant-alpha",
        name: "Анна Администратор",
        accessProfileId: "tenant-admin-alpha"
      }
    ]);
  });

  it("persists audit events with mandatory trace fields", async () => {
    await client`
      INSERT INTO tenants (id, name, created_at)
      VALUES ('tenant-alpha', 'Альфа Проект', now())
    `;

    await dataSource.appendAuditEvent({
      id: "audit-1",
      tenantId: "tenant-alpha",
      actorUserId: "user-alpha-admin",
      actionType: "tenant.user.listed",
      sourceSurfaceId: null,
      sourceWorkflow: "phase_1_3_test",
      sourceEntity: {
        type: "Tenant",
        id: "tenant-alpha"
      },
      input: {},
      beforeState: null,
      afterState: null,
      permissionResult: {
        allowed: true
      },
      executionResult: {
        status: "succeeded"
      },
      correlationId: "corr-1",
      createdAt: new Date("2026-05-18T00:00:00.000Z")
    });

    const rows = await dataSource.db.execute(sql`
      SELECT tenant_id, actor_user_id, action_type, correlation_id
      FROM audit_events
      WHERE id = 'audit-1'
    `);

    expect(rows).toEqual([
      {
        tenant_id: "tenant-alpha",
        actor_user_id: "user-alpha-admin",
        action_type: "tenant.user.listed",
        correlation_id: "corr-1"
      }
    ]);
  });

  it("creates and reads access profiles inside one tenant", async () => {
    await client`
      INSERT INTO tenants (id, name, created_at)
      VALUES
        ('tenant-alpha', 'Альфа Проект', now()),
        ('tenant-beta', 'Бета Проект', now())
    `;
    await dataSource.createAccessProfile({
      id: "access-profile-alpha-controller",
      tenantId: "tenant-alpha",
      name: "Контролер",
      permissions: ["tenant.users.read"]
    });

    await expect(dataSource.listAccessProfilesByTenantId("tenant-alpha")).resolves.toEqual([
      {
        id: "access-profile-alpha-controller",
        tenantId: "tenant-alpha",
        name: "Контролер",
        permissions: ["tenant.users.read"]
      }
    ]);
    await expect(dataSource.listAccessProfilesByTenantId("tenant-beta")).resolves.toEqual([]);
  });
});
