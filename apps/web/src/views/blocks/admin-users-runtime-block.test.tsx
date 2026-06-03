// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceUser } from "@/lib/api-types";
import { AdminUsersRuntimeBlock } from "@/views/blocks/admin-users-runtime-block";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/views/layout/route-page-intro", () => ({
  RoutePageIntro: ({ lead }: { lead?: string }) => <p>{lead}</p>
}));

describe("AdminUsersRuntimeBlock", () => {
  it("keeps current user protected and exposes real status actions for other users", async () => {
    const onChangeUserStatus = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <AdminUsersRuntimeBlock
          users={[
            makeUser({ id: "usr-admin", name: "Анна Администратор", status: "active" }),
            makeUser({ id: "usr-architect", name: "Сергей Архитектор", status: "active" }),
            makeUser({ id: "usr-bim", name: "Ольга BIM", status: "inactive" })
          ]}
          currentUserId="usr-admin"
          onChangeUserStatus={onChangeUserStatus}
        />
      );
    });

    const buttons = Array.from(host.querySelectorAll("button"));
    const currentUserButton = buttons.find((button) => button.textContent === "Текущий");
    const deactivateButton = buttons.find(
      (button) => button.getAttribute("aria-label") === "Отключить пользователя Сергей Архитектор"
    );
    const activateButton = buttons.find(
      (button) => button.getAttribute("aria-label") === "Включить пользователя Ольга BIM"
    );

    expect(currentUserButton).toBeTruthy();
    expect(currentUserButton).toHaveProperty("disabled", true);
    expect(deactivateButton?.textContent).toBe("Отключить");
    expect(activateButton?.textContent).toBe("Включить");

    await act(async () => {
      deactivateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      activateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChangeUserStatus).toHaveBeenCalledWith({
      userId: "usr-architect",
      status: "inactive"
    });
    expect(onChangeUserStatus).toHaveBeenCalledWith({
      userId: "usr-bim",
      status: "active"
    });

    act(() => root.unmount());
    host.remove();
  });

  it("disables status actions with an explicit reason when manage permission is absent", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <AdminUsersRuntimeBlock
          users={[makeUser({ id: "usr-architect", name: "Сергей Архитектор", status: "active" })]}
        />
      );
    });

    const button = host.querySelector("button");
    expect(button).toHaveProperty("disabled", true);
    expect(button?.getAttribute("title")).toBe("Нужно право управлять пользователями");

    act(() => root.unmount());
    host.remove();
  });
});

function makeUser(overrides: Pick<WorkspaceUser, "id" | "name" | "status">): WorkspaceUser {
  return {
    accentColor: "blue",
    accessProfileId: "access-profile-alpha-admin",
    email: `${overrides.id}@kiss-pm.local`,
    id: overrides.id,
    name: overrides.name,
    phone: null,
    positionId: null,
    positionName: null,
    status: overrides.status,
    telegram: null,
    tenantId: "tenant-alpha",
    theme: "system"
  };
}
