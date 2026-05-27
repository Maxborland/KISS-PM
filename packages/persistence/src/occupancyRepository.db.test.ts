import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "./index";
import { createOccupancyRepository } from "./occupancyRepository";
import {
  callParticipantStates,
  callRooms,
  callSessions
} from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

const seed: SeedTenantDataset = {
  tenants: [{ id: "tenant-alpha", name: "Альфа Проект" }],
  accessProfiles: [
    {
      id: "access-profile-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      permissions: ["tenant.project_resources.read", "tenant.project_resources.manage"]
    }
  ],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-alpha-admin",
      positionId: null,
      password: "admin12345"
    },
    {
      id: "user-alpha-engineer",
      tenantId: "tenant-alpha",
      email: "engineer@kiss-pm.local",
      name: "Игорь Инженер",
      accessProfileId: "access-profile-alpha-admin",
      positionId: null,
      password: "engineer12345"
    }
  ]
};

describe("occupancy repository", () => {
  let client: PostgresClient;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
  });

  beforeEach(async () => {
    await client`TRUNCATE call_participant_states, call_events, call_sessions, call_rooms, tenant_users, user_credentials, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(createDatabase(client), seed, new Date("2026-05-26T00:00:00.000Z"));
  });

  afterAll(async () => {
    await client`TRUNCATE call_participant_states, call_events, call_sessions, call_rooms, tenant_users, user_credentials, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("builds call occupancy from participant join and leave timestamps", async () => {
    const db = createDatabase(client);
    const repository = createOccupancyRepository(db);
    const now = new Date("2026-05-26T00:00:00.000Z");

    await db.insert(callRooms).values({
      id: "call-room-alpha",
      tenantId: "tenant-alpha",
      entityType: "project",
      entityId: "project-alpha",
      meetingId: null,
      title: "Плановый созвон",
      mediaKind: "video",
      provider: "manual",
      providerRoomId: "provider-room-alpha",
      status: "ended",
      createdByUserId: "user-alpha-admin",
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    });
    await db.insert(callSessions).values({
      id: "call-session-alpha",
      tenantId: "tenant-alpha",
      roomId: "call-room-alpha",
      providerSessionId: null,
      status: "ended",
      startedByUserId: "user-alpha-admin",
      startedAt: new Date("2026-06-02T09:00:00.000Z"),
      endedByUserId: "user-alpha-admin",
      endedAt: new Date("2026-06-02T11:00:00.000Z"),
      failureReason: null
    });
    await db.insert(callParticipantStates).values({
      tenantId: "tenant-alpha",
      roomId: "call-room-alpha",
      sessionId: "call-session-alpha",
      userId: "user-alpha-engineer",
      state: "left",
      joinedAt: new Date("2026-06-02T09:30:00.000Z"),
      leftAt: new Date("2026-06-02T10:15:00.000Z"),
      lastSeenAt: new Date("2026-06-02T10:15:00.000Z")
    });

    const windows = await repository.listOccupancyWindows({
      tenantId: "tenant-alpha",
      resourceId: "user-alpha-engineer",
      from: new Date("2026-06-02T00:00:00.000Z"),
      to: new Date("2026-06-03T00:00:00.000Z")
    });

    expect(windows).toEqual([
      expect.objectContaining({
        id: "call-session:call-session-alpha:user-alpha-engineer",
        startsAt: "2026-06-02T09:30:00.000Z",
        finishesAt: "2026-06-02T10:15:00.000Z"
      })
    ]);
  });
});
