import { describe, expect, it } from "vitest";

import {
  ProjectCoreModelError,
  createProcessTemplate,
  createProcessTemplateVersionSnapshot
} from "./index";

describe("process and stage templates", () => {
  it("creates a tenant-owned active process template with deterministic ordered stage templates", () => {
    const template = createProcessTemplate({
      id: "process-template-tenant-a-implementation",
      tenantId: "tenant-a",
      key: "implementation.standard",
      label: "Стандартное внедрение",
      active: true,
      version: 3,
      updatedAt: "2026-05-15T02:40:00+07:00",
      stages: [
        {
          id: "stage-delivery",
          tenantId: "tenant-a",
          key: "delivery",
          label: "Исполнение",
          sortOrder: 20,
          active: true,
          version: 2,
          updatedAt: "2026-05-15T02:39:00+07:00",
          requiredArtifactTemplates: [
            {
              id: "artifact-delivery-plan",
              tenantId: "tenant-a",
              key: "delivery_plan",
              label: "План поставки",
              required: true
            }
          ],
          approvalTemplates: [
            {
              id: "approval-delivery-ready",
              tenantId: "tenant-a",
              key: "delivery_ready",
              label: "Готовность к поставке",
              approverRoleKey: "project_principal",
              required: true
            }
          ],
          taskTemplates: [
            {
              id: "task-delivery-kickoff",
              tenantId: "tenant-a",
              key: "delivery_kickoff",
              label: "Запустить исполнение",
              defaultParticipantRoleKeys: ["executor", "controller"],
              required: true
            }
          ]
        },
        {
          id: "stage-initiation",
          tenantId: "tenant-a",
          key: "initiation",
          label: "Инициация",
          sortOrder: 10,
          active: true,
          version: 1,
          updatedAt: "2026-05-15T02:38:00+07:00",
          requiredArtifactTemplates: [],
          approvalTemplates: [],
          taskTemplates: []
        }
      ]
    });

    expect(template.stages.map((stage) => stage.key)).toEqual(["initiation", "delivery"]);
    expect(template).toMatchObject({
      id: "process-template-tenant-a-implementation",
      tenantId: "tenant-a",
      key: "implementation.standard",
      label: "Стандартное внедрение",
      active: true,
      version: 3
    });
    expect(template.stages[1]?.taskTemplates[0]?.defaultParticipantRoleKeys).toEqual(["executor", "controller"]);
    expect(template.stages[0]).toMatchObject({
      key: "initiation",
      active: true,
      version: 1,
      updatedAt: "2026-05-15T02:38:00+07:00"
    });
  });

  it("creates a version snapshot that is detached from later input mutation", () => {
    const stage = {
      id: "stage-initiation",
      tenantId: "tenant-a",
      key: "initiation",
      label: "Инициация",
      sortOrder: 10,
      active: true,
      version: 4,
      updatedAt: "2026-05-15T02:41:00+07:00",
      requiredArtifactTemplates: [
        {
          id: "artifact-charter",
          tenantId: "tenant-a",
          key: "project_charter",
          label: "Паспорт проекта",
          required: true
        }
      ],
      approvalTemplates: [],
      taskTemplates: []
    };
    const template = createProcessTemplate({
      id: "process-template-tenant-a-implementation",
      tenantId: "tenant-a",
      key: "implementation.standard",
      label: "Стандартное внедрение",
      active: true,
      version: 4,
      updatedAt: "2026-05-15T02:41:00+07:00",
      stages: [stage]
    });

    const snapshot = createProcessTemplateVersionSnapshot(template);
    stage.requiredArtifactTemplates[0]!.label = "Changed outside";

    expect(snapshot).toEqual({
      tenantId: "tenant-a",
      templateId: "process-template-tenant-a-implementation",
      key: "implementation.standard",
      label: "Стандартное внедрение",
      version: 4,
      active: true,
      updatedAt: "2026-05-15T02:41:00+07:00",
      stageTemplates: [
        {
          id: "stage-initiation",
          key: "initiation",
          label: "Инициация",
          sortOrder: 10,
          active: true,
          version: 4,
          updatedAt: "2026-05-15T02:41:00+07:00",
          requiredArtifactTemplates: [
            {
              id: "artifact-charter",
              key: "project_charter",
              label: "Паспорт проекта",
              required: true
            }
          ],
          approvalTemplates: [],
          taskTemplates: []
        }
      ]
    });
  });

  it("rejects duplicate stage ordering and duplicate nested template keys", () => {
    expect(() =>
      createProcessTemplate({
        id: "process-template-duplicates",
        tenantId: "tenant-a",
        key: "implementation.standard",
        label: "Стандартное внедрение",
        active: true,
        version: 1,
        updatedAt: "2026-05-15T02:42:00+07:00",
        stages: [
          {
            id: "stage-1",
            tenantId: "tenant-a",
            key: "initiation",
            label: "Инициация",
            sortOrder: 10,
            active: true,
            version: 1,
            updatedAt: "2026-05-15T02:42:00+07:00",
            requiredArtifactTemplates: [],
            approvalTemplates: [],
            taskTemplates: []
          },
          {
            id: "stage-2",
            tenantId: "tenant-a",
            key: "planning",
            label: "Планирование",
            sortOrder: 10,
            active: true,
            version: 1,
            updatedAt: "2026-05-15T02:42:00+07:00",
            requiredArtifactTemplates: [],
            approvalTemplates: [],
            taskTemplates: []
          }
        ]
      })
    ).toThrow("processTemplate stage sort orders must be unique");

    expect(() =>
      createProcessTemplate({
        id: "process-template-duplicate-artifacts",
        tenantId: "tenant-a",
        key: "implementation.standard",
        label: "Стандартное внедрение",
        active: true,
        version: 1,
        updatedAt: "2026-05-15T02:42:00+07:00",
        stages: [
          {
            id: "stage-1",
            tenantId: "tenant-a",
            key: "initiation",
            label: "Инициация",
            sortOrder: 10,
            active: true,
            version: 1,
            updatedAt: "2026-05-15T02:42:00+07:00",
            requiredArtifactTemplates: [
              { id: "artifact-1", tenantId: "tenant-a", key: "charter", label: "Паспорт", required: true },
              { id: "artifact-2", tenantId: "tenant-a", key: "charter", label: "Паспорт 2", required: true }
            ],
            approvalTemplates: [],
            taskTemplates: []
          }
        ]
      })
    ).toThrow("stageTemplate.requiredArtifactTemplates keys must be unique: initiation");
  });

  it("rejects duplicate stage keys and duplicate default participant role keys", () => {
    expect(() =>
      createProcessTemplate({
        id: "process-template-duplicate-stage-keys",
        tenantId: "tenant-a",
        key: "implementation.standard",
        label: "Стандартное внедрение",
        active: true,
        version: 1,
        updatedAt: "2026-05-15T02:42:00+07:00",
        stages: [
          {
            id: "stage-1",
            tenantId: "tenant-a",
            key: "initiation",
            label: "Инициация",
            sortOrder: 10,
            active: true,
            version: 1,
            updatedAt: "2026-05-15T02:42:00+07:00",
            requiredArtifactTemplates: [],
            approvalTemplates: [],
            taskTemplates: []
          },
          {
            id: "stage-2",
            tenantId: "tenant-a",
            key: "initiation",
            label: "Инициация 2",
            sortOrder: 20,
            active: true,
            version: 1,
            updatedAt: "2026-05-15T02:42:00+07:00",
            requiredArtifactTemplates: [],
            approvalTemplates: [],
            taskTemplates: []
          }
        ]
      })
    ).toThrow("processTemplate stage keys must be unique");

    expect(() =>
      createProcessTemplate({
        id: "process-template-duplicate-role-keys",
        tenantId: "tenant-a",
        key: "implementation.standard",
        label: "Стандартное внедрение",
        active: true,
        version: 1,
        updatedAt: "2026-05-15T02:42:00+07:00",
        stages: [
          {
            id: "stage-1",
            tenantId: "tenant-a",
            key: "initiation",
            label: "Инициация",
            sortOrder: 10,
            active: true,
            version: 1,
            updatedAt: "2026-05-15T02:42:00+07:00",
            requiredArtifactTemplates: [],
            approvalTemplates: [],
            taskTemplates: [
              {
                id: "task-1",
                tenantId: "tenant-a",
                key: "start_project",
                label: "Запустить проект",
                defaultParticipantRoleKeys: ["executor", "executor"],
                required: true
              }
            ]
          }
        ]
      })
    ).toThrow("stageTemplate.taskTemplate default participant role keys must be unique");
  });

  it("rejects tenant mismatches and invalid stable keys in stage-owned templates", () => {
    expect(() =>
      createProcessTemplate({
        id: "process-template-tenant-mismatch",
        tenantId: "tenant-a",
        key: "implementation.standard",
        label: "Стандартное внедрение",
        active: true,
        version: 1,
        updatedAt: "2026-05-15T02:43:00+07:00",
        stages: [
          {
            id: "stage-initiation",
            tenantId: "tenant-b",
            key: "initiation",
            label: "Инициация",
            sortOrder: 10,
            active: true,
            version: 1,
            updatedAt: "2026-05-15T02:43:00+07:00",
            requiredArtifactTemplates: [],
            approvalTemplates: [],
            taskTemplates: []
          }
        ]
      })
    ).toThrow("processTemplate.stageTemplate tenant mismatch: stage-initiation");

    try {
      createProcessTemplate({
        id: "process-template-bad-role",
        tenantId: "tenant-a",
        key: "implementation.standard",
        label: "Стандартное внедрение",
        active: true,
        version: 1,
        updatedAt: "2026-05-15T02:43:00+07:00",
        stages: [
          {
            id: "stage-initiation",
            tenantId: "tenant-a",
            key: "initiation",
            label: "Инициация",
            sortOrder: 10,
            active: true,
            version: 1,
            updatedAt: "2026-05-15T02:43:00+07:00",
            requiredArtifactTemplates: [],
            approvalTemplates: [
              {
                id: "approval-1",
                tenantId: "tenant-a",
                key: "charter_approval",
                label: "Согласовать паспорт",
                approverRoleKey: "Руководитель",
                required: true
              }
            ],
            taskTemplates: []
          }
        ]
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectCoreModelError);
      expect((error as ProjectCoreModelError).code).toBe("validation_error");
      expect((error as Error).message).toBe("stageTemplate.approvalTemplate.approverRoleKey must be a stable system key");
    }
  });

  it("rejects invalid calendar timestamps instead of accepting Date.parse rollover", () => {
    expect(() =>
      createProcessTemplate({
        id: "process-template-invalid-stage-date",
        tenantId: "tenant-a",
        key: "implementation.standard",
        label: "Стандартное внедрение",
        active: true,
        version: 1,
        updatedAt: "2026-05-15T02:43:00+07:00",
        stages: [
          {
            id: "stage-initiation",
            tenantId: "tenant-a",
            key: "initiation",
            label: "Инициация",
            sortOrder: 10,
            active: true,
            version: 1,
            updatedAt: "2026-02-30T02:40:00+07:00",
            requiredArtifactTemplates: [],
            approvalTemplates: [],
            taskTemplates: []
          }
        ]
      })
    ).toThrow("processTemplate.stageTemplate.updatedAt must be a valid timestamp");
  });
});
