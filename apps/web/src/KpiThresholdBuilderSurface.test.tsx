import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KpiThresholdBuilderSurface } from "./KpiThresholdBuilderSurface";
import type {
  KpiThresholdAuditDto,
  KpiThresholdBuilderApiClient,
  KpiThresholdPreviewDto,
  KpiThresholdReadModelDto,
  KpiThresholdPublishResultDto
} from "./kpiThresholdBuilderApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";
import { withTestQueryClient } from "./testQueryClient";

function createCurrentTenant(
  permissions = ["tenant.read", "tenant.config.read", "tenant.config.write", "kpi:read", "kpi.config:write", "audit.read"]
): CurrentTenantDto {
  return {
    tenant: { id: "tenant-a", label: "Студия A", configurationVersion: 1 },
    actor: { id: "tenant-admin-a", displayName: "Администратор", accessProfileId: "profile-tenant-admin-a" },
    labels: {},
    permissions
  };
}

function createReadModel(version = 1): KpiThresholdReadModelDto {
  return {
    thresholds: [
      {
        definitionId: "kpi-schedule-variance-a",
        label: "Отклонение трудозатрат",
        thresholdRuleSet: {
          id: "threshold-schedule-variance-a-v1",
          tenantId: "tenant-a",
          version,
          active: true,
          rules: [
            {
              id: "schedule-variance-critical",
              severity: "critical",
              condition: { operator: "lte", value: version === 1 ? -25 : -30 },
              explanation: "Критическое отклонение",
              recommendedActionKeys: ["create_corrective_action"]
            },
            {
              id: "schedule-variance-warning",
              severity: "warning",
              condition: { operator: "lte", value: -10 },
              explanation: "Предупреждение",
              recommendedActionKeys: ["request_explanation"]
            }
          ]
        }
      }
    ],
    latestEvaluation: {
      id: "eval-kpi-schedule-variance-a-1",
      severity: "critical",
      value: -25,
      thresholdRuleSetVersion: 1,
      matchedThresholdRuleId: "schedule-variance-critical"
    }
  };
}

function createPreview(): KpiThresholdPreviewDto {
  return {
    id: "preview-kpi-thresholds-tenant-a-1-1",
    tenantId: "tenant-a",
    actorId: "tenant-admin-a",
    mutatesState: false,
    thresholdRuleSet: createReadModel(2).thresholds[0]!.thresholdRuleSet,
    before: { version: 1, severity: "critical", matchedRuleId: "schedule-variance-critical" },
    after: { version: 2, severity: "warning", matchedRuleId: "schedule-variance-warning" },
    sampleValue: -25,
    affectedRuntimeSurfaces: ["kpi.deviation.control"],
    createdAt: "2026-08-01T00:01:00.000Z"
  };
}

function createAudit(): KpiThresholdAuditDto {
  return {
    events: [
      {
        id: "audit-kpi-thresholds-tenant-a-2",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        actionKey: "kpi_threshold.publish",
        target: { entityType: "kpiThresholdRuleSet", entityId: "threshold-schedule-variance-a-v1" },
        result: "success",
        timestamp: "2026-08-01T00:03:00.000Z",
        correlationId: "kpi-threshold-tenant-a-threshold-schedule-variance-a-v1-1"
      }
    ],
    actionExecutions: [
      {
        id: "action-kpi-threshold-publish",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        commandType: "kpi_threshold.publish",
        requiredPermission: "kpi.config:write",
        status: "succeeded",
        source: { entityType: "kpiDefinition", entityId: "kpi-schedule-variance-a" },
        target: { entityType: "kpiThresholdRuleSet", entityId: "threshold-schedule-variance-a-v1" },
        before: { version: 1 },
        after: { version: 2 },
        timestamp: "2026-08-01T00:03:00.000Z",
        correlationId: "kpi-threshold-tenant-a-threshold-schedule-variance-a-v1-1",
        trace: ["kpi_threshold:preview confirmed"]
      }
    ]
  };
}

function createApiClient(): KpiThresholdBuilderApiClient {
  let published = false;
  let audit: KpiThresholdAuditDto = { events: [], actionExecutions: [] };

  return {
    getThresholds: vi.fn(async () => createReadModel(published ? 2 : 1)),
    previewThresholds: vi.fn(async () => createPreview()),
    publishThresholds: vi.fn(async () => {
      published = true;
      audit = createAudit();
      return {
        result: {
          thresholdRuleSet: createReadModel(2).thresholds[0]!.thresholdRuleSet,
          audit: {
            tenantId: "tenant-a",
            actorId: "tenant-admin-a",
            auditEventId: "audit-kpi-thresholds-tenant-a-2",
            commandType: "kpi_threshold.publish",
            thresholdRuleSetId: "threshold-schedule-variance-a-v1",
            beforeVersion: 1,
            afterVersion: 2,
            publishedAt: "2026-08-01T00:03:00.000Z"
          },
          actionExecution: audit.actionExecutions[0]!
        },
        readback: { thresholdRuleSet: createReadModel(2).thresholds[0]!.thresholdRuleSet }
      } satisfies KpiThresholdPublishResultDto;
    }),
    getAudit: vi.fn(async () => audit)
  };
}

function renderSurface(apiClient = createApiClient(), currentTenant = createCurrentTenant()) {
  render(
    withTestQueryClient(
      <KpiThresholdBuilderSurface apiClient={apiClient} currentTenant={currentTenant} testUser="tenant-admin-a" />
    )
  );
}

describe("KpiThresholdBuilderSurface", () => {
  it("loads KPI thresholds and error state", async () => {
    renderSurface();
    expect(screen.getByTestId("kpi-threshold-status")).toHaveTextContent("Загрузка KPI порогов");
    await waitFor(() => expect(screen.getByTestId("kpi-threshold-readback")).toHaveTextContent("v1"));
    expect(screen.getByTestId("kpi-threshold-impact")).toHaveTextContent("critical");

    cleanup();
    const apiClient = createApiClient();
    vi.mocked(apiClient.getThresholds).mockRejectedValueOnce(new Error("API недоступен"));
    renderSurface(apiClient);
    expect(await screen.findByTestId("kpi-threshold-error")).toHaveTextContent("API недоступен");
  });

  it("previews without mutation, then publishes through API readback and audit", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("kpi-threshold-readback")).toHaveTextContent("v1"));

    fireEvent.change(screen.getByLabelText("Критический порог KPI"), { target: { value: "-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр влияния" }));
    const preview = await screen.findByTestId("kpi-threshold-preview");
    expect(preview).toHaveTextContent("Состояние еще не изменено");
    expect(preview).toHaveTextContent("warning");
    expect(apiClient.publishThresholds).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать пороги" }));
    await waitFor(() => expect(apiClient.publishThresholds).toHaveBeenCalledWith("tenant-admin-a", { previewId: "preview-kpi-thresholds-tenant-a-1-1" }));
    await waitFor(() => expect(apiClient.getThresholds).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("kpi-threshold-readback")).toHaveTextContent("v2");
    expect(screen.getByTestId("kpi-threshold-result")).toHaveTextContent("kpi_threshold.publish");
    expect(screen.getByTestId("kpi-threshold-audit")).toHaveTextContent("audit-kpi-thresholds");
  });

  it("shows read-only state and recovers from stale preview", async () => {
    renderSurface(createApiClient(), createCurrentTenant(["tenant.read", "tenant.config.read", "kpi:read", "audit.read"]));
    await waitFor(() => expect(screen.getByTestId("kpi-threshold-readback")).toHaveTextContent("v1"));
    expect(screen.getByTestId("kpi-threshold-readonly")).toHaveTextContent("kpi.config:write");
    expect(screen.queryByRole("button", { name: "Предпросмотр влияния" })).not.toBeInTheDocument();
    cleanup();

    const apiClient = createApiClient();
    vi.mocked(apiClient.publishThresholds).mockRejectedValueOnce(Object.assign(new Error("Предпросмотр устарел"), { code: "stale_preview" }));
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("kpi-threshold-readback")).toHaveTextContent("v1"));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр влияния" }));
    await screen.findByTestId("kpi-threshold-preview");
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать пороги" }));
    expect(await screen.findByTestId("kpi-threshold-command-error")).toHaveTextContent("Предпросмотр устарел");
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => expect(apiClient.getThresholds).toHaveBeenCalledTimes(2));
  });
});
