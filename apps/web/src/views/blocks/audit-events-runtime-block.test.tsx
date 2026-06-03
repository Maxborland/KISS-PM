// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventListItem } from "@/lib/api-types";
import { AuditEventsRuntimeBlock } from "@/views/blocks/audit-events-runtime-block";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/views/layout/route-page-intro", () => ({
  RoutePageIntro: ({ lead }: { lead?: string }) => <p>{lead}</p>
}));

describe("AuditEventsRuntimeBlock", () => {
  it("shows actor, action, entity, permission and execution result for management actions", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <AuditEventsRuntimeBlock
          auditEvents={[
            {
              id: "audit-alpha-role-update",
              tenantId: "tenant-alpha",
              actorUserId: "user-alpha-admin",
              actionType: "tenant.access_profile.updated",
              sourceSurfaceId: null,
              sourceWorkflow: "single_workspace_access_roles",
              sourceEntity: {
                type: "AccessProfile",
                id: "access-profile-alpha-project-team"
              },
              input: {},
              beforeState: null,
              afterState: null,
              permissionResult: { allowed: true },
              executionResult: { status: "succeeded" },
              correlationId: "correlation-alpha",
              createdAt: "2026-06-03T10:00:00.000Z"
            } satisfies AuditEventListItem
          ]}
        />
      );
    });

    expect(host.textContent).toContain("tenant.access_profile.updated");
    expect(host.textContent).toContain("single_workspace_access_roles");
    expect(host.textContent).toContain("AccessProfile:access-profile-alpha-project-team");
    expect(host.textContent).toContain("user-alpha-admin");
    expect(host.textContent).toContain("разрешено");
    expect(host.textContent).toContain("выполнено");

    act(() => root.unmount());
    host.remove();
  });
});
