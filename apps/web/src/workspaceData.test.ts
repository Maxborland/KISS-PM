import { describe, expect, it } from "vitest";

import { buildWorkspaceData } from "./workspaceData";

const me = {
  id: "user-1",
  tenantId: "tenant-1",
  email: "admin@kiss-pm.local",
  name: "Админ",
  accessProfileId: "role-1",
  positionId: null,
  positionName: null,
  phone: null,
  telegram: null,
  status: "active",
  theme: "light",
  accentColor: "#0f766e"
};

describe("workspace data derivation", () => {
  it("does not expose cached resource data when the current permission is missing", () => {
    const data = buildWorkspaceData({
      apiStatus: "ok",
      me,
      permissions: ["profile.read"],
      users: { users: [{ ...me, id: "stale-user" }] },
      positions: {
        positions: [{ id: "position-1", tenantId: "tenant-1", name: "Stale", description: null }]
      },
      accessRoles: {
        accessRoles: [{ id: "role-1", tenantId: "tenant-1", name: "Stale", permissions: [] }]
      },
      auditEvents: {
        auditEvents: [
          {
            id: "audit-1",
            tenantId: "tenant-1",
            actorUserId: "user-1",
            actionType: "stale",
            correlationId: "corr-1",
            createdAt: "2026-05-18T00:00:00.000Z"
          }
        ]
      },
      clients: {
        clients: [
          {
            id: "client-1",
            tenantId: "tenant-1",
            name: "Stale client",
            description: null,
            status: "active",
            createdAt: "2026-05-18T00:00:00.000Z",
            updatedAt: "2026-05-18T00:00:00.000Z"
          }
        ]
      },
      contacts: {
        contacts: [
          {
            id: "contact-1",
            tenantId: "tenant-1",
            clientId: "client-1",
            name: "Stale contact",
            email: null,
            phone: null,
            telegram: null,
            role: null,
            status: "active",
            createdAt: "2026-05-18T00:00:00.000Z",
            updatedAt: "2026-05-18T00:00:00.000Z"
          }
        ]
      },
      projectTypes: {
        projectTypes: [
          {
            id: "project-type-1",
            tenantId: "tenant-1",
            name: "Stale type",
            description: null,
            status: "active",
            createdAt: "2026-05-18T00:00:00.000Z",
            updatedAt: "2026-05-18T00:00:00.000Z"
          }
        ]
      },
      dealStages: {
        dealStages: [
          {
            id: "deal-stage-1",
            tenantId: "tenant-1",
            name: "Stale stage",
            sortOrder: 10,
            status: "active",
            createdAt: "2026-05-18T00:00:00.000Z",
            updatedAt: "2026-05-18T00:00:00.000Z"
          }
        ]
      },
      customFields: {
        customFields: [
          {
            id: "field-1",
            tenantId: "tenant-1",
            systemKey: "priority",
            tenantLabel: "Приоритет",
            targetEntity: "project",
            fieldType: "select",
            required: false,
            status: "active",
            createdAt: "2026-05-18T00:00:00.000Z",
            updatedAt: "2026-05-18T00:00:00.000Z"
          }
        ]
      },
      projectTemplates: {
        projectTemplates: [
          {
            id: "template-1",
            tenantId: "tenant-1",
            systemKey: "implementation",
            tenantLabel: "Внедрение",
            description: null,
            status: "active",
            createdAt: "2026-05-18T00:00:00.000Z",
            updatedAt: "2026-05-18T00:00:00.000Z"
          }
        ]
      },
      opportunities: {
        opportunities: [
          {
            id: "opportunity-1",
            tenantId: "tenant-1",
            clientId: "client-1",
            primaryContactId: "contact-1",
            projectTypeId: "project-type-1",
            stageId: "deal-stage-1",
            clientName: "Stale",
            contactName: "",
            title: "Stale",
            projectType: "implementation",
            description: null,
            plannedStart: "2026-06-01T00:00:00.000Z",
            plannedFinish: "2026-06-30T00:00:00.000Z",
            contractValue: 600000,
            plannedHourlyRate: 6000,
            plannedHours: 100,
            probability: 70,
            status: "ready_to_activate",
            templateId: null,
            feasibilityStatus: "ok",
            feasibilityResult: null,
            feasibilityCheckedAt: null,
            createdAt: "2026-05-18T00:00:00.000Z",
            updatedAt: "2026-05-18T00:00:00.000Z",
            demand: [],
            customFieldValues: {}
          }
        ]
      },
      projects: {
        projects: [
          {
            id: "project-1",
            tenantId: "tenant-1",
            sourceOpportunityId: "opportunity-1",
            clientId: "client-1",
            projectTypeId: "project-type-1",
            title: "Stale",
            clientName: "Stale",
            status: "active",
            plannedStart: "2026-06-01T00:00:00.000Z",
            plannedFinish: "2026-06-30T00:00:00.000Z",
            contractValue: 600000,
            plannedHours: 100,
            templateId: null,
            createdAt: "2026-05-18T00:00:00.000Z",
            activatedAt: "2026-05-18T00:00:00.000Z",
            demand: []
          }
        ]
      },
      myWork: {
        tasks: [
          {
            id: "task-1",
            tenantId: "tenant-1",
            projectId: "project-1",
            stageId: null,
            title: "Stale task",
            description: null,
            status: "todo",
            priority: "normal",
            plannedStart: "2026-06-01T00:00:00.000Z",
            plannedFinish: "2026-06-02T00:00:00.000Z",
            plannedWork: 8,
            actualWork: 0,
            progress: 0,
            source: "manual",
            createdAt: "2026-05-18T00:00:00.000Z",
            updatedAt: "2026-05-18T00:00:00.000Z",
            participants: [{ userId: "user-1", role: "executor" }]
          }
        ]
      }
    });

    expect(data.users).toEqual([]);
    expect(data.positions).toEqual([]);
    expect(data.accessRoles).toEqual([]);
    expect(data.auditEvents).toEqual([]);
    expect(data.clients).toEqual([]);
    expect(data.contacts).toEqual([]);
    expect(data.projectTypes).toEqual([]);
    expect(data.dealStages).toEqual([]);
    expect(data.customFields).toEqual([]);
    expect(data.projectTemplates).toEqual([]);
    expect(data.opportunities).toEqual([]);
    expect(data.projects).toEqual([]);
    expect(data.myWorkTasks).toEqual([]);
  });
});
