import { describe, expect, it } from "vitest";

import {
  createTenantConfiguration,
  previewTenantConfigurationPublish,
  publishTenantConfigurationPreview
} from "./index";

const activeConfiguration = () =>
  createTenantConfiguration({
    id: "tenant-config-a-v1",
    tenantId: "tenant-a",
    version: 1,
    labelSetVersion: 1,
    status: "active",
    processTemplateVersions: [{ id: "process-template-standard", version: 3 }],
    accessProfileVersions: [{ id: "access-profile-admin", version: 2 }],
    kpiDefinitionVersions: [{ id: "kpi-schedule-variance", version: 4 }],
    controlSurfaceVersions: [{ id: "surface-portfolio-control", version: 5 }],
    actionDefinitionVersions: [{ id: "action-open-gantt", version: 2 }],
    customFieldDefinitionVersions: [{ id: "field-project-priority", version: 1 }],
    savedViewVersions: [{ id: "saved-view-portfolio-default", version: 1 }],
    featureFlagVersions: [{ id: "feature-p10-builders", version: 1 }],
    createdBy: "tenant-admin-a",
    createdAt: "2026-05-17T02:20:00+07:00",
    activatedAt: "2026-05-17T02:21:00+07:00"
  });

const draftConfiguration = () =>
  createTenantConfiguration({
    ...activeConfiguration(),
    id: "tenant-config-a-v2-draft",
    version: 2,
    labelSetVersion: 2,
    status: "draft",
    processTemplateVersions: [{ id: "process-template-standard", version: 4 }],
    createdAt: "2026-05-17T02:25:00+07:00"
  });

describe("tenant configuration version lifecycle", () => {
  it("previews publishing a draft configuration without mutating active or draft state", () => {
    const active = activeConfiguration();
    const draft = draftConfiguration();

    const preview = previewTenantConfigurationPublish(active, draft, {
      id: "preview-tenant-config-a-v2",
      actorId: "tenant-admin-a",
      createdAt: "2026-05-17T02:26:00+07:00"
    });

    expect(preview).toMatchObject({
      id: "preview-tenant-config-a-v2",
      tenantId: "tenant-a",
      actorId: "tenant-admin-a",
      mutatesState: false,
      before: { activeVersion: 1 },
      after: { activeVersion: 2, labelSetVersion: 2 },
      affectedRefs: [
        {
          kind: "label_set",
          beforeVersion: 1,
          afterVersion: 2
        },
        {
          kind: "process_template",
          id: "process-template-standard",
          beforeVersion: 3,
          afterVersion: 4
        }
      ],
      validationIssues: []
    });
    expect(active.status).toBe("active");
    expect(draft.status).toBe("draft");
  });

  it("publishes a validated draft with audit evidence and archives the previous active version", () => {
    const active = activeConfiguration();
    const draft = draftConfiguration();
    const preview = previewTenantConfigurationPublish(active, draft, {
      id: "preview-tenant-config-a-v2",
      actorId: "tenant-admin-a",
      createdAt: "2026-05-17T02:26:00+07:00"
    });

    const result = publishTenantConfigurationPreview(active, draft, {
      preview,
      expectedActiveVersion: 1,
      expectedDraftVersion: 2,
      auditEventId: "audit-tenant-config-v2",
      publishedAt: "2026-05-17T02:27:00+07:00"
    });

    expect(result).toMatchObject({
      previousActive: {
        id: "tenant-config-a-v1",
        status: "archived",
        version: 1
      },
      published: {
        id: "tenant-config-a-v2-draft",
        status: "active",
        version: 2,
        activatedAt: "2026-05-17T02:27:00+07:00"
      },
      audit: {
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        auditEventId: "audit-tenant-config-v2",
        commandType: "tenant_configuration.publish",
        beforeVersion: 1,
        afterVersion: 2,
        publishedAt: "2026-05-17T02:27:00+07:00"
      }
    });
    expect(active.status).toBe("active");
    expect(draft.status).toBe("draft");
  });

  it("rejects stale preview, tenant mismatch, and missing audit evidence", () => {
    const active = activeConfiguration();
    const draft = draftConfiguration();
    const preview = previewTenantConfigurationPublish(active, draft, {
      id: "preview-tenant-config-a-v2",
      actorId: "tenant-admin-a",
      createdAt: "2026-05-17T02:26:00+07:00"
    });

    expect(() =>
      publishTenantConfigurationPreview(active, draft, {
        preview,
        expectedActiveVersion: 2,
        expectedDraftVersion: 2,
        auditEventId: "audit-tenant-config-v2",
        publishedAt: "2026-05-17T02:27:00+07:00"
      })
    ).toThrow("Tenant configuration publish preview is stale");

    const changedDraftWithoutVersionBump = createTenantConfiguration({
      ...draft,
      processTemplateVersions: [{ id: "process-template-standard", version: 5 }]
    });

    expect(() =>
      publishTenantConfigurationPreview(active, changedDraftWithoutVersionBump, {
        preview,
        expectedActiveVersion: 1,
        expectedDraftVersion: 2,
        auditEventId: "audit-tenant-config-v2",
        publishedAt: "2026-05-17T02:27:00+07:00"
      })
    ).toThrow("Tenant configuration publish preview is stale");

    expect(() =>
      publishTenantConfigurationPreview(active, draft, {
        preview,
        expectedActiveVersion: 1,
        expectedDraftVersion: 2,
        auditEventId: "",
        publishedAt: "2026-05-17T02:27:00+07:00"
      })
    ).toThrow("tenantConfigurationPublish.auditEventId is required");

    expect(() =>
      previewTenantConfigurationPublish(active, { ...draft, tenantId: "tenant-b" }, {
        id: "preview-cross-tenant",
        actorId: "tenant-admin-a",
        createdAt: "2026-05-17T02:26:00+07:00"
      })
    ).toThrow("Tenant configuration publish tenant mismatch");
  });

  it("rejects duplicate refs inside a configuration version", () => {
    expect(() =>
      createTenantConfiguration({
        ...activeConfiguration(),
        processTemplateVersions: [
          { id: "process-template-standard", version: 3 },
          { id: "process-template-standard", version: 4 }
        ]
      })
    ).toThrow("Duplicate tenant configuration processTemplateVersions ref: process-template-standard");
  });
});
