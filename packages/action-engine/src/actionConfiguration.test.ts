import { describe, expect, it } from "vitest";

import {
  createActionConfigurationSet,
  previewActionConfigurationPublish,
  publishActionConfigurationPreview,
  type ActionDefinition
} from "./index";

const definitions: ActionDefinition[] = [
  {
    id: "action-accept-risk",
    tenantId: "tenant-a",
    key: "accept_risk",
    label: "Принять риск",
    description: "Фиксирует принятие риска",
    version: 1,
    status: "active",
    targetEntityType: "kpi_signal",
    sourceSurfaceKey: "portfolio.control",
    commandBinding: {
      commandType: "risk.accept",
      handlerKey: "kpi_signal.accept_risk",
      targetEntityType: "kpi_signal",
      resultEntityType: "action_execution"
    },
    requiredPermission: "risk:accept",
    dryRunRequired: true,
    inputSchema: {
      fields: [
        { key: "reason", label: "Причина", valueType: "text", required: true, summary: true },
        { key: "expiresAt", label: "Действует до", valueType: "date", required: false, summary: true }
      ]
    },
    auditPolicy: { required: true, includeInputSummary: true, includeBeforeAfter: true },
    createdAt: "2026-05-16T14:20:00.000Z",
    updatedAt: "2026-05-16T14:20:00.000Z"
  },
  {
    id: "action-escalate-signal",
    tenantId: "tenant-a",
    key: "escalate",
    label: "Эскалировать",
    description: "Фиксирует эскалацию",
    version: 1,
    status: "active",
    targetEntityType: "kpi_signal",
    sourceSurfaceKey: "portfolio.control",
    commandBinding: {
      commandType: "signal.escalate",
      handlerKey: "control_signal.escalate",
      targetEntityType: "kpi_signal",
      resultEntityType: "action_execution"
    },
    requiredPermission: "control.action:write",
    dryRunRequired: true,
    inputSchema: {
      fields: [
        { key: "reason", label: "Причина", valueType: "text", required: true, summary: true },
        { key: "escalationLevel", label: "Уровень", valueType: "text", required: true, summary: true }
      ]
    },
    auditPolicy: { required: true, includeInputSummary: true, includeBeforeAfter: true },
    createdAt: "2026-05-16T14:20:00.000Z",
    updatedAt: "2026-05-16T14:20:00.000Z"
  }
];

describe("action configuration publishing", () => {
  it("previews action disable and safe form defaults without mutating active configuration", () => {
    const current = createActionConfigurationSet({
      tenantId: "tenant-a",
      version: 1,
      actionConfigs: [],
      updatedAt: "2026-08-01T00:00:00.000Z"
    });

    const preview = previewActionConfigurationPublish(current, {
      id: "preview-action-config-1",
      actorId: "tenant-admin-a",
      expectedVersion: 1,
      actionDefinitions: definitions,
      draft: {
        actionConfigs: [
          {
            actionKey: "accept_risk",
            enabled: false,
            formFields: [
              {
                fieldKey: "reason",
                label: "Причина принятия риска",
                defaultValue: "Риск принят до комитета"
              }
            ]
          }
        ],
        affectedRuntimeSurfaces: ["portfolio.control"]
      },
      createdAt: "2026-08-01T00:01:00.000Z"
    });

    expect(preview).toMatchObject({
      mutatesState: false,
      before: { version: 1, disabledActionKeys: [] },
      after: { version: 2, disabledActionKeys: ["accept_risk"] },
      affectedRuntimeSurfaces: ["portfolio.control"]
    });
    expect(current.version).toBe(1);
    expect(current.actionConfigs).toEqual([]);
  });

  it("publishes only from a fresh preview and preserves previous configuration", () => {
    const current = createActionConfigurationSet({
      tenantId: "tenant-a",
      version: 1,
      actionConfigs: [],
      updatedAt: "2026-08-01T00:00:00.000Z"
    });
    const preview = previewActionConfigurationPublish(current, {
      id: "preview-action-config-1",
      actorId: "tenant-admin-a",
      expectedVersion: 1,
      actionDefinitions: definitions,
      draft: {
        actionConfigs: [{ actionKey: "accept_risk", enabled: false, formFields: [] }],
        affectedRuntimeSurfaces: ["portfolio.control"]
      },
      createdAt: "2026-08-01T00:01:00.000Z"
    });

    const result = publishActionConfigurationPreview(current, {
      preview,
      expectedVersion: 1,
      auditEventId: "audit-action-config-1",
      publishedAt: "2026-08-01T00:02:00.000Z"
    });

    expect(result.configuration).toMatchObject({
      tenantId: "tenant-a",
      version: 2,
      actionConfigs: [expect.objectContaining({ actionKey: "accept_risk", enabled: false })]
    });
    expect(result.previousConfiguration).toMatchObject({ version: 1, actionConfigs: [] });
    expect(result.audit).toMatchObject({
      commandType: "action_configuration.publish",
      beforeVersion: 1,
      afterVersion: 2,
      disabledActionKeys: ["accept_risk"]
    });

    expect(() =>
      publishActionConfigurationPreview(current, {
        preview,
        expectedVersion: 2,
        auditEventId: "audit-action-config-stale",
        publishedAt: "2026-08-01T00:03:00.000Z"
      })
    ).toThrow("action configuration preview is stale");
  });

  it("rejects unknown actions and unsafe form defaults without partial mutation", () => {
    const current = createActionConfigurationSet({
      tenantId: "tenant-a",
      version: 1,
      actionConfigs: [],
      updatedAt: "2026-08-01T00:00:00.000Z"
    });

    expect(() =>
      previewActionConfigurationPublish(current, {
        id: "preview-action-config-bad-action",
        actorId: "tenant-admin-a",
        expectedVersion: 1,
        actionDefinitions: definitions,
        draft: {
          actionConfigs: [{ actionKey: "missing_action", enabled: false, formFields: [] }],
          affectedRuntimeSurfaces: ["portfolio.control"]
        },
        createdAt: "2026-08-01T00:01:00.000Z"
      })
    ).toThrow("Unknown action key: missing_action");

    expect(() =>
      previewActionConfigurationPublish(current, {
        id: "preview-action-config-bad-default",
        actorId: "tenant-admin-a",
        expectedVersion: 1,
        actionDefinitions: definitions,
        draft: {
          actionConfigs: [
            {
              actionKey: "accept_risk",
              enabled: true,
              formFields: [{ fieldKey: "expiresAt", defaultValue: "not-a-date" }]
            }
          ],
          affectedRuntimeSurfaces: ["portfolio.control"]
        },
        createdAt: "2026-08-01T00:01:00.000Z"
      })
    ).toThrow("defaultValue for expiresAt must be a valid date");

    expect(current.actionConfigs).toEqual([]);
  });
});
