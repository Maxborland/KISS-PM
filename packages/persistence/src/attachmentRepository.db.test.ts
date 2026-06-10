import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAttachmentRepository } from "./attachmentRepository";
import {
  createDatabase,
  createPostgresClient,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "./index";

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
      permissions: ["tenant.opportunities.read"]
    }
  ],
  positions: [],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@alpha.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-alpha-admin",
      password: "admin12345"
    }
  ]
};

describe("attachment repository search", () => {
  let client: PostgresClient;
  let repository: ReturnType<typeof createAttachmentRepository>;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    repository = createAttachmentRepository(createDatabase(client));
  });

  beforeEach(async () => {
    await client`TRUNCATE entity_attachments, external_references, file_assets, user_sessions, user_credentials, tenant_users, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      seed,
      new Date("2026-06-10T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client.end();
  });

  it("does not match redacted external reference metadata while preserving visible fields", async () => {
    const reference = await repository.createExternalReference({
      id: "external-reference-alpha",
      tenantId: "tenant-alpha",
      connectorType: "s3",
      externalId: "provider-file-alpha",
      url: "https://files.example.test/customer-visible-brief.pdf",
      title: "Customer Visible Brief",
      metadata: {
        provider: "s3",
        storageKey: "internal/client/secret.pdf",
        storageProvider: "minio"
      },
      createdByUserId: "user-alpha-admin"
    });

    await repository.createEntityAttachment({
      id: "attachment-alpha",
      tenantId: "tenant-alpha",
      entityType: "opportunity",
      entityId: "opportunity-alpha",
      assetId: null,
      externalReferenceId: reference.id,
      relationType: "evidence",
      sourceActivityType: "crm",
      sourceActivityId: null,
      createdByUserId: "user-alpha-admin"
    });

    const visibleMatches = await repository.searchAttachments({
      tenantId: "tenant-alpha",
      query: "Customer Visible",
      limit: 10
    });
    const redactedMatches = await repository.searchAttachments({
      tenantId: "tenant-alpha",
      query: "internal/client/secret.pdf",
      limit: 10
    });

    expect(visibleMatches.map((attachment) => attachment.id)).toEqual([
      "attachment-alpha"
    ]);
    expect(redactedMatches).toEqual([]);
  });
});
