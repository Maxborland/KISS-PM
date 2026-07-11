// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectCustomFields } from "./project-custom-fields";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const field = {
  id: "field-wbs-risk", systemKey: "wbs_risk", tenantLabel: "Риск WBS",
  targetEntity: "project", fieldType: "text", required: true, status: "active",
  createdAt: "2026-07-11T00:00:00.000Z", updatedAt: "2026-07-11T00:00:00.000Z"
};

afterEach(() => { document.body.innerHTML = ""; vi.unstubAllGlobals(); });

async function render(canManage: boolean, customFields = [field]) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ customFields }), {
    status: 200, headers: { "content-type": "application/json" }
  })));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(<ProjectCustomFields canManage={canManage} />); });
  await act(async () => { await Promise.resolve(); });
  return host;
}

describe("ProjectCustomFields", () => {
  it("renders real definitions read-only without write controls", async () => {
    const host = await render(false);
    expect(host.textContent).toContain("Риск WBS");
    expect(host.textContent).toContain("Только чтение");
    expect(host.querySelector('[data-testid="custom-field-add"]')).toBeNull();
    expect(host.querySelector('[aria-label^="Изменить поле"]')).toBeNull();
    expect(host.querySelector('[aria-label^="Удалить поле"]')).toBeNull();
  });

  it("renders an explicit empty state from the API", async () => {
    const host = await render(false, []);
    expect(host.querySelector('[data-testid="custom-fields-empty"]')?.textContent).toContain("пока не созданы");
  });

  it("keeps apply unavailable until the admin confirms a preview", async () => {
    const host = await render(true);
    const add = host.querySelector('[data-testid="custom-field-add"]') as HTMLButtonElement;
    await act(async () => add.click());
    expect(host.querySelector('[data-testid="custom-field-editor"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="custom-field-apply"]')).toBeNull();
    expect((host.querySelector('[data-testid="custom-field-open-preview"]') as HTMLButtonElement).disabled).toBe(true);
  });
});
