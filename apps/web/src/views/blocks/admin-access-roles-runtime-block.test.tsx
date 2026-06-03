// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { AccessRole } from "@/lib/api/bootstrap";
import { AdminAccessRolesRuntimeBlock } from "@/views/blocks/admin-access-roles-runtime-block";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/views/layout/route-page-intro", () => ({
  RoutePageIntro: ({ lead }: { lead?: string }) => <p>{lead}</p>
}));

describe("AdminAccessRolesRuntimeBlock", () => {
  it("protects the current role and changes project access for another role", async () => {
    const onChangeRolePermission = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <AdminAccessRolesRuntimeBlock
          accessRoles={[
            makeRole({
              id: "access-profile-alpha-admin",
              name: "Администратор",
              permissions: ["tenant.access_profiles.manage", "tenant.projects.read"]
            }),
            makeRole({
              id: "access-profile-alpha-project-team",
              name: "Проектная команда",
              permissions: ["tenant.projects.read", "profile.read"]
            })
          ]}
          currentAccessProfileId="access-profile-alpha-admin"
          onChangeRolePermission={onChangeRolePermission}
        />
      );
    });

    const currentRoleButton = host.querySelector("button[aria-label='Текущая роль Администратор']");
    const projectTeamButton = host.querySelector(
      "button[aria-label='Убрать доступ к проектам для роли Проектная команда']"
    );

    expect(currentRoleButton).toHaveProperty("disabled", true);
    expect(currentRoleButton?.textContent).toBe("Текущая");
    expect(projectTeamButton?.textContent).toBe("Убрать проекты");

    await act(async () => {
      projectTeamButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChangeRolePermission).toHaveBeenCalledWith({
      role: {
        id: "access-profile-alpha-project-team",
        name: "Проектная команда",
        permissions: ["tenant.projects.read", "profile.read"]
      },
      permission: "tenant.projects.read",
      enabled: false
    });

    act(() => root.unmount());
    host.remove();
  });

  it("disables role actions with an explicit reason when manage permission is absent", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <AdminAccessRolesRuntimeBlock
          accessRoles={[
            makeRole({
              id: "access-profile-alpha-project-team",
              name: "Проектная команда",
              permissions: ["tenant.projects.read"]
            })
          ]}
        />
      );
    });

    const button = host.querySelector("button");
    expect(button).toHaveProperty("disabled", true);
    expect(button?.getAttribute("title")).toBe("Нужно право управлять ролями");

    act(() => root.unmount());
    host.remove();
  });
});

function makeRole(input: AccessRole): AccessRole {
  return input;
}
