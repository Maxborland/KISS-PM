import { describe, expect, it } from "vitest";

import {
  TenantConfigModelError,
  createTenantConfiguration,
  createTenantLabelSet,
  resolveTenantLabel,
  updateTenantLabel
} from "./index";

describe("tenant label configuration", () => {
  it("creates a versioned tenant configuration and label set", () => {
    const configuration = createTenantConfiguration({
      id: "tenant-config-a-v1",
      tenantId: "tenant-a",
      version: 1,
      labelSetVersion: 1,
      status: "active",
      createdBy: "tenant-admin-a",
      createdAt: "2026-05-14T13:20:00+07:00",
      activatedAt: "2026-05-14T13:21:00+07:00"
    });
    const labelSet = createTenantLabelSet({
      tenantId: "tenant-a",
      configurationVersion: configuration.version,
      labels: {
        "navigation.crm_intake": "CRM-приемка",
        "role.project_manager": "Руководитель проекта"
      },
      updatedAt: "2026-05-14T13:21:00+07:00"
    });

    expect(configuration).toEqual({
      id: "tenant-config-a-v1",
      tenantId: "tenant-a",
      version: 1,
      labelSetVersion: 1,
      status: "active",
      createdBy: "tenant-admin-a",
      createdAt: "2026-05-14T13:20:00+07:00",
      activatedAt: "2026-05-14T13:21:00+07:00"
    });
    expect(labelSet.configurationVersion).toBe(1);
    expect(resolveTenantLabel(labelSet, "navigation.crm_intake")).toBe("CRM-приемка");
    expect(resolveTenantLabel(labelSet, "role.project_manager")).toBe("Руководитель проекта");
  });

  it("updates one label with previous/current configuration version and changed value trace", () => {
    const labelSet = createTenantLabelSet({
      tenantId: "tenant-a",
      configurationVersion: 4,
      labels: {
        "navigation.projects": "Проекты",
        "role.project_manager": "Руководитель проекта"
      },
      updatedAt: "2026-05-14T13:22:00+07:00"
    });

    const result = updateTenantLabel(labelSet, {
      key: "navigation.projects",
      label: "Проектный контур",
      expectedConfigurationVersion: 4,
      updatedAt: "2026-05-14T13:23:00+07:00"
    });

    expect(result.labelSet).toEqual({
      tenantId: "tenant-a",
      configurationVersion: 5,
      labels: {
        "navigation.projects": "Проектный контур",
        "role.project_manager": "Руководитель проекта"
      },
      updatedAt: "2026-05-14T13:23:00+07:00"
    });
    expect(result.trace).toEqual({
      tenantId: "tenant-a",
      configurationVersion: 5,
      previousConfigurationVersion: 4,
      changedLabel: {
        key: "navigation.projects",
        beforeLabel: "Проекты",
        afterLabel: "Проектный контур"
      },
      labels: {
        "navigation.projects": "Проектный контур",
        "role.project_manager": "Руководитель проекта"
      }
    });
  });

  it("rejects stale configuration versions and invalid labels without mutating the input", () => {
    const labelSet = createTenantLabelSet({
      tenantId: "tenant-a",
      configurationVersion: 2,
      labels: {
        "navigation.settings": "Настройки"
      },
      updatedAt: "2026-05-14T13:24:00+07:00"
    });

    expect(() =>
      updateTenantLabel(labelSet, {
        key: "navigation.settings",
        label: "Администрирование",
        expectedConfigurationVersion: 1,
        updatedAt: "2026-05-14T13:25:00+07:00"
      })
    ).toThrow("Tenant label configuration version conflict: expected 1, current 2");
    expect(() =>
      updateTenantLabel(labelSet, {
        key: "navigation.settings",
        label: "",
        expectedConfigurationVersion: 2,
        updatedAt: "2026-05-14T13:25:00+07:00"
      })
    ).toThrow("tenantLabel.label is required");
    expect(labelSet.labels["navigation.settings"]).toBe("Настройки");
    expect(labelSet.configurationVersion).toBe(2);
  });

  it("does not silently expose internal label keys when a runtime label is missing", () => {
    const labelSet = createTenantLabelSet({
      tenantId: "tenant-a",
      configurationVersion: 1,
      labels: {
        "navigation.settings": "Настройки"
      },
      updatedAt: "2026-05-14T13:25:00+07:00"
    });

    expect(() => resolveTenantLabel(labelSet, "navigation.unknown")).toThrow(
      "Tenant label is not configured: navigation.unknown"
    );
    expect(resolveTenantLabel(labelSet, "navigation.unknown", "Раздел")).toBe("Раздел");
  });

  it("throws typed tenant-config model errors", () => {
    try {
      createTenantLabelSet({
        tenantId: "",
        configurationVersion: 1,
        labels: { "navigation.settings": "Настройки" },
        updatedAt: "2026-05-14T13:26:00+07:00"
      });
    } catch (error) {
      expect(error).toBeInstanceOf(TenantConfigModelError);
      expect((error as TenantConfigModelError).code).toBe("validation_error");
    }
  });
});
