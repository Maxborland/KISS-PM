import { describe, expect, it } from "vitest";

import {
  buildAuditChangeSummary,
  buildAuditPreviewRows,
  getAuditActionLabel
} from "./workspaceDashboard";

describe("workspace dashboard", () => {
  it("builds audit preview rows from real audit events newest first", () => {
    const rows = buildAuditPreviewRows(
      [
        {
          id: "audit-old",
          tenantId: "tenant-1",
          actorUserId: "user-2",
          actionType: "workspace.user.created",
          correlationId: "corr-old",
          createdAt: "2026-05-17T10:00:00.000Z"
        },
        {
          id: "audit-new",
          tenantId: "tenant-1",
          actorUserId: "user-1",
          actionType: "workspace.project_template.updated",
          correlationId: "corr-new",
          createdAt: "2026-05-18T10:00:00.000Z"
        }
      ],
      [
        {
          id: "user-1",
          tenantId: "tenant-1",
          email: "admin@kiss-pm.local",
          name: "Анна Администратор",
          accessProfileId: "role-admin",
          positionId: null,
          positionName: null,
          phone: null,
          telegram: null,
          status: "active",
          theme: "light",
          accentColor: "#0f766e"
        }
      ]
    );

    expect(rows).toEqual([
      {
        id: "audit-new",
        actorName: "Анна Администратор",
        actionLabel: "Шаблон проекта обновлен",
        createdAtLabel: "18.05.2026, 10:00"
      },
      {
        id: "audit-old",
        actorName: "Пользователь user-2",
        actionLabel: "Пользователь создан",
        createdAtLabel: "17.05.2026, 10:00"
      }
    ]);
  });

  it("limits audit preview rows for the dashboard", () => {
    const rows = buildAuditPreviewRows(
      Array.from({ length: 8 }, (_, index) => ({
        id: `audit-${index}`,
        tenantId: "tenant-1",
        actorUserId: "user-1",
        actionType: "workspace.user.updated",
        correlationId: `corr-${index}`,
        createdAt: `2026-05-18T10:0${index}:00.000Z`
      })),
      []
    );

    expect(rows).toHaveLength(6);
    expect(rows[0]?.id).toBe("audit-7");
  });

  it("resolves audit action labels without depending on preview limits", () => {
    expect(getAuditActionLabel("workspace.custom_field.updated")).toBe(
      "Пользовательское поле обновлено"
    );
    expect(getAuditActionLabel("opportunity.feasibility_checked")).toBe(
      "Ресурсная проверка сделки выполнена"
    );
    expect(getAuditActionLabel("opportunity.created")).toBe("Сделка создана");
    expect(getAuditActionLabel("opportunity.stage_updated")).toBe(
      "Этап сделки изменен"
    );
    expect(getAuditActionLabel("project.activated")).toBe("Проект активирован");
    expect(getAuditActionLabel("unknown.action")).toBe("unknown.action");
  });

  it("builds readable before and after summaries for config audit events", () => {
    const summary = buildAuditChangeSummary({
      id: "audit-config",
      tenantId: "tenant-1",
      actorUserId: "user-1",
      actionType: "workspace.custom_field.updated",
      correlationId: "corr-config",
      createdAt: "2026-05-18T10:00:00.000Z",
      beforeState: {
        systemKey: "priority",
        tenantLabel: "Приоритет",
        fieldType: "text",
        required: false,
        status: "draft"
      },
      afterState: {
        systemKey: "priority",
        tenantLabel: "Приоритет проекта",
        fieldType: "select",
        required: true,
        status: "active"
      }
    });

    expect(summary).toEqual({
      title: "4 изменения",
      detail:
        "Название: Приоритет -> Приоритет проекта; Тип: text -> select; Обязательное: нет -> да"
    });
  });
});
