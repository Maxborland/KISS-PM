import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "@kiss-pm/persistence";

import { createApp } from "./app";
import { createLocalStorageProvider as createApiLocalStorageProvider } from "./storageProvider";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm";

const dataset: SeedTenantDataset = {
  tenants: [
    { id: "tenant-alpha", name: "Альфа Проект" },
    { id: "tenant-beta", name: "Бета Проект" }
  ],
  accessProfiles: [
    {
      id: "access-profile-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      permissions: [
        "tenant.clients.read",
        "tenant.clients.manage",
        "tenant.contacts.read",
        "tenant.contacts.manage",
        "tenant.projects.read",
        "tenant.projects.manage",
        "tenant.tasks.create",
        "tenant.tasks.edit",
        "tenant.project_plan.read",
        "tenant.project_plan.manage",
        "tenant.project_resources.read",
        "tenant.audit_events.read"
      ]
    },
    {
      id: "access-profile-alpha-reader",
      tenantId: "tenant-alpha",
      name: "Наблюдатель",
      permissions: ["tenant.clients.read", "tenant.projects.read"]
    },
    {
      id: "access-profile-alpha-denied",
      tenantId: "tenant-alpha",
      name: "Без доступа",
      permissions: []
    },
    {
      id: "access-profile-beta-admin",
      tenantId: "tenant-beta",
      name: "Администратор",
      permissions: ["tenant.clients.read", "tenant.clients.manage"]
    }
  ],
  positions: [{ id: "position-engineer", tenantId: "tenant-alpha", name: "Инженер" }],
  clients: [
    { id: "client-alpha", tenantId: "tenant-alpha", name: "ООО Альфа" },
    { id: "client-beta", tenantId: "tenant-beta", name: "ООО Бета" }
  ],
  contacts: [
    {
      id: "contact-alpha",
      tenantId: "tenant-alpha",
      clientId: "client-alpha",
      name: "Вера Контакт",
      email: "vera@alpha.test",
      phone: null,
      telegram: null,
      role: "Заказчик"
    }
  ],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-alpha-admin",
      positionId: "position-engineer",
      password: "local-admin-password"
    },
    {
      id: "user-alpha-reader",
      tenantId: "tenant-alpha",
      email: "reader@kiss-pm.local",
      name: "Роман Наблюдатель",
      accessProfileId: "access-profile-alpha-reader",
      password: "local-reader-password"
    },
    {
      id: "user-alpha-denied",
      tenantId: "tenant-alpha",
      email: "denied@kiss-pm.local",
      name: "Дина Без Доступа",
      accessProfileId: "access-profile-alpha-denied",
      password: "local-denied-password"
    },
    {
      id: "user-beta-admin",
      tenantId: "tenant-beta",
      email: "beta@kiss-pm.local",
      name: "Борис Бета",
      accessProfileId: "access-profile-beta-admin",
      password: "local-beta-password"
    }
  ]
};

describe("attachment and unified search API", () => {
  let client: PostgresClient;
  let app: ReturnType<typeof createApp>;
  let storageRoot: string;

  beforeAll(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), "kiss-pm-storage-"));
    client = createPostgresClient(databaseUrl);
    app = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client)),
      storageProvider: createApiLocalStorageProvider({ root: storageRoot }),
      enableDevTenantRoutes: true
    });
  });

  beforeEach(async () => {
    await client`TRUNCATE entity_attachments, external_references, file_assets, audit_events, task_activities, task_participants, tasks, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, products, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      dataset,
      new Date("2026-05-24T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client`TRUNCATE entity_attachments, external_references, file_assets, audit_events, task_activities, task_participants, tasks, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, products, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("attaches external references and exposes them through attachments, CRM feed and search", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "local-admin-password");

    const attach = await app.request("/api/workspace/attachments/external-references", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        entityType: "client",
        entityId: "client-alpha",
        title: "Архитектурный бриф",
        url: "https://example.test/brief.pdf",
        connectorType: "manual_link",
        metadata: { source: "contract" }
      })
    });
    expect(attach.status).toBe(201);
    await expect(attach.json()).resolves.toMatchObject({
      attachment: {
        entityType: "client",
        entityId: "client-alpha",
        kind: "external_reference",
        externalReference: {
          title: "Архитектурный бриф",
          url: "https://example.test/brief.pdf"
        }
      }
    });

    const list = await app.request(
      "/api/workspace/attachments?entityType=client&entityId=client-alpha",
      { headers: { cookie } }
    );
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({
      attachments: [{ externalReference: { title: "Архитектурный бриф" } }]
    });

    const feed = await app.request("/api/workspace/crm/client/client-alpha/activity", {
      headers: { cookie }
    });
    expect(feed.status).toBe(200);
    await expect(feed.json()).resolves.toMatchObject({
      attachmentItems: [{ externalReference: { title: "Архитектурный бриф" } }]
    });

    const search = await app.request("/api/workspace/search?q=бриф", {
      headers: { cookie }
    });
    expect(search.status).toBe(200);
    await expect(search.json()).resolves.toMatchObject({
      results: [
        expect.objectContaining({
          type: "external_reference",
          title: "Архитектурный бриф",
          route: "/clients/client-alpha"
        })
      ]
    });

    const wildcardSearch = await app.request("/api/workspace/search?q=%25%25", {
      headers: { cookie }
    });
    expect(wildcardSearch.status).toBe(200);
    await expect(wildcardSearch.json()).resolves.toEqual({ results: [] });
  });

  it("rejects unsafe external references and records denied audit for missing manage permission", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    const unsafe = await app.request("/api/workspace/attachments/external-references", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        entityType: "client",
        entityId: "client-alpha",
        title: "Локальная ссылка",
        url: "http://127.0.0.1:9000/private.pdf"
      })
    });
    expect(unsafe.status).toBe(400);
    await expect(unsafe.json()).resolves.toEqual({ error: "external_url_private_host" });

    const readerCookie = await loginAs("reader@kiss-pm.local", "local-reader-password");
    const denied = await app.request("/api/workspace/attachments/external-references", {
      method: "POST",
      headers: jsonHeaders(readerCookie),
      body: JSON.stringify({
        entityType: "client",
        entityId: "client-alpha",
        title: "Документ",
        url: "https://example.test/doc.pdf"
      })
    });
    expect(denied.status).toBe(403);

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie }
    });
    const auditPayload = await audit.json() as { auditEvents: Array<{ actionType: string; executionResult: Record<string, unknown> }> };
    expect(auditPayload.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "attachment.denied",
          executionResult: expect.objectContaining({ status: "denied" })
        })
      ])
    );
  });

  it("uploads, downloads and archives local file assets without leaking provider internals", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    const form = new FormData();
    form.set("entityType", "client");
    form.set("entityId", "client-alpha");
    form.set("file", new Blob(["hello"], { type: "text/plain" }), "../brief.txt");

    const upload = await app.request("/api/workspace/attachments/files", {
      method: "POST",
      headers: actionHeaders(cookie),
      body: form
    });
    expect(upload.status).toBe(201);
    const uploadPayload = await upload.json() as { attachment: { id: string; fileAsset: { safeDisplayName: string; status: string; storageKey?: string } } };
    expect(uploadPayload.attachment.fileAsset).toMatchObject({
      safeDisplayName: ".-brief.txt",
      status: "ready"
    });
    expect(uploadPayload.attachment.fileAsset.storageKey).toBeUndefined();

    const download = await app.request(
      `/api/workspace/attachments/${uploadPayload.attachment.id}/download`,
      { headers: { cookie } }
    );
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toBe("text/plain");
    expect(download.headers.get("content-disposition")).toContain(".-brief.txt");
    await expect(download.text()).resolves.toBe("hello");

    const remove = await app.request(
      `/api/workspace/attachments/${uploadPayload.attachment.id}`,
      {
        method: "DELETE",
        headers: actionHeaders(cookie)
      }
    );
    expect(remove.status).toBe(200);

    const afterArchive = await app.request(
      `/api/workspace/attachments/${uploadPayload.attachment.id}/download`,
      { headers: { cookie } }
    );
    expect(afterArchive.status).toBe(404);
  });

  it("omits unreadable attachment metadata from unified search", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    await app.request("/api/workspace/attachments/external-references", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        entityType: "client",
        entityId: "client-alpha",
        title: "Закрытый бриф",
        url: "https://example.test/closed.pdf"
      })
    });

    const deniedCookie = await loginAs("denied@kiss-pm.local", "local-denied-password");
    const search = await app.request("/api/workspace/search?q=закрытый", {
      headers: { cookie: deniedCookie }
    });
    expect(search.status).toBe(200);
    await expect(search.json()).resolves.toEqual({ results: [] });
  });

  it("keeps scanning attachment matches after unreadable candidates are filtered", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    await app.request("/api/workspace/attachments/external-references", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        entityType: "client",
        entityId: "client-alpha",
        title: "Общий ресурсный бриф",
        url: "https://example.test/shared-visible.pdf"
      })
    });
    for (let index = 0; index < 3; index += 1) {
      await app.request("/api/workspace/attachments/external-references", {
        method: "POST",
        headers: jsonHeaders(adminCookie),
        body: JSON.stringify({
          entityType: "contact",
          entityId: "contact-alpha",
          title: `Общий ресурсный бриф скрытый ${index}`,
          url: `https://example.test/shared-hidden-${index}.pdf`
        })
      });
    }

    const readerCookie = await loginAs("reader@kiss-pm.local", "local-reader-password");
    const search = await app.request(
      "/api/workspace/search?q=общий&limit=1&types=external_reference",
      { headers: { cookie: readerCookie } }
    );
    expect(search.status).toBe(200);
    await expect(search.json()).resolves.toMatchObject({
      results: [
        expect.objectContaining({
          title: "Общий ресурсный бриф",
          route: "/clients/client-alpha"
        })
      ]
    });
  });

  async function loginAs(email: string, password: string) {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    expect(response.status).toBe(200);
    return response.headers.get("set-cookie") ?? "";
  }
});

function jsonHeaders(cookie: string) {
  return {
    ...actionHeaders(cookie),
    "content-type": "application/json"
  };
}

function actionHeaders(cookie: string) {
  return {
    cookie,
    "x-kiss-pm-action": "same-origin"
  };
}
