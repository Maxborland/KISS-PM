// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileContent } from "./profile-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const user = {
  id: "user-alpha",
  tenantId: "tenant-alpha",
  name: "Анна",
  email: "anna@example.com",
  accessProfileId: "profile-alpha",
  accessProfileName: "Владелец",
  workspaceName: "Бюро Север",
  positionId: null,
  positionName: null,
  phone: null,
  telegram: null,
  status: "active" as const,
  theme: "light" as const,
  accentColor: "#0f766e"
};

describe("ProfileContent", () => {
  let root: Root;
  const requestDeactivation = vi.fn();

  beforeEach(async () => {
    requestDeactivation.mockReset().mockResolvedValue({ ok: true });
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(
      <ProfileContent
        user={user}
        permissions={["profile.update"]}
        update={vi.fn()}
        updateTheme={vi.fn()}
        requestDeactivation={requestDeactivation}
      />
    ));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("показывает названия вместо технических идентификаторов", () => {
    expect(document.body.textContent).toContain("Бюро Север");
    expect(document.body.textContent).toContain("Владелец");
    expect(document.body.textContent).not.toContain("tenant-alpha");
    expect(document.body.textContent).not.toContain("profile-alpha");
  });

  it("сворачивает длинный список прав по умолчанию", () => {
    const details = document.querySelector<HTMLDetailsElement>("details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(details?.querySelector("summary")?.textContent).toContain("1");
  });

  it("после подтверждения показывает честную квитанцию запроса деактивации", async () => {
    const trigger = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Запросить деактивацию"));
    expect(trigger).toBeDefined();
    await act(async () => trigger?.click());

    const confirm = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Записать запрос"));
    expect(confirm).toBeDefined();
    await act(async () => confirm?.click());

    expect(requestDeactivation).toHaveBeenCalledOnce();
    expect(document.body.textContent).toContain("Запрос записан в журнале аудита");
    expect(document.body.textContent).toContain("Администратор должен обработать его вручную");
  });
});
