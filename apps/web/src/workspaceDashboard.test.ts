import { describe, expect, it } from "vitest";

import { buildAuditPreviewRows } from "./workspaceDashboard";

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
          actionType: "profile.theme.updated",
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
        actionLabel: "Оформление обновлено",
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
});
