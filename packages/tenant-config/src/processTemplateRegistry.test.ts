import { describe, expect, it } from "vitest";

import {
  createProcessTemplateConfigurationRegistry,
  createProcessTemplateConfigurationRef
} from "./index";

describe("process template configuration registry", () => {
  it("registers active versioned process template references for one tenant", () => {
    const templateRef = createProcessTemplateConfigurationRef({
      id: "process-template-tenant-a-implementation",
      tenantId: "tenant-a",
      key: "implementation.standard",
      label: "Стандартное внедрение",
      version: 3,
      active: true
    });
    const registry = createProcessTemplateConfigurationRegistry({
      tenantId: "tenant-a",
      version: 2,
      processTemplates: [templateRef],
      updatedAt: "2026-05-15T02:45:00+07:00"
    });

    expect(registry).toEqual({
      tenantId: "tenant-a",
      version: 2,
      processTemplates: [
        {
          id: "process-template-tenant-a-implementation",
          tenantId: "tenant-a",
          key: "implementation.standard",
          label: "Стандартное внедрение",
          version: 3,
          active: true
        }
      ],
      updatedAt: "2026-05-15T02:45:00+07:00"
    });
  });

  it("rejects duplicate active process template keys in tenant configuration", () => {
    expect(() =>
      createProcessTemplateConfigurationRegistry({
        tenantId: "tenant-a",
        version: 1,
        updatedAt: "2026-05-15T02:46:00+07:00",
        processTemplates: [
          {
            id: "process-template-1",
            tenantId: "tenant-a",
            key: "implementation.standard",
            label: "Стандартное внедрение",
            version: 1,
            active: true
          },
          {
            id: "process-template-2",
            tenantId: "tenant-a",
            key: "implementation.standard",
            label: "Стандартное внедрение v2",
            version: 2,
            active: true
          }
        ]
      })
    ).toThrow("Duplicate active process template key: implementation.standard");
  });

  it("rejects duplicate active process template ids in tenant configuration", () => {
    expect(() =>
      createProcessTemplateConfigurationRegistry({
        tenantId: "tenant-a",
        version: 1,
        updatedAt: "2026-05-15T02:46:00+07:00",
        processTemplates: [
          {
            id: "process-template-same-id",
            tenantId: "tenant-a",
            key: "implementation.standard",
            label: "Стандартное внедрение",
            version: 1,
            active: true
          },
          {
            id: "process-template-same-id",
            tenantId: "tenant-a",
            key: "implementation.quick_start",
            label: "Быстрый старт",
            version: 1,
            active: true
          }
        ]
      })
    ).toThrow("Duplicate active process template id: process-template-same-id");
  });

  it("rejects cross-tenant process template refs before building the registry", () => {
    expect(() =>
      createProcessTemplateConfigurationRegistry({
        tenantId: "tenant-a",
        version: 1,
        updatedAt: "2026-05-15T02:47:00+07:00",
        processTemplates: [
          {
            id: "process-template-b",
            tenantId: "tenant-b",
            key: "implementation.standard",
            label: "Tenant B template",
            version: 1,
            active: true
          }
        ]
      })
    ).toThrow("Process template configuration tenant mismatch: process-template-b");
  });

  it("rejects invalid calendar timestamps instead of accepting Date.parse rollover", () => {
    expect(() =>
      createProcessTemplateConfigurationRegistry({
        tenantId: "tenant-a",
        version: 1,
        updatedAt: "2026-02-30T02:47:00+07:00",
        processTemplates: []
      })
    ).toThrow("processTemplateConfigurationRegistry.updatedAt must be a valid timestamp");
  });
});
