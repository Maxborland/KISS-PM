/**
 * @vitest-environment happy-dom
 */

import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanningRuntimeProvider } from "./planning-runtime";
import { useResourceDirectory } from "./use-resource-directory";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const directoryMock = vi.hoisted(() => ({
  getResourceDirectory: vi.fn(async () => [
    {
      id: "user-resource",
      name: "Ресурс из API",
      positionId: "position-engineer",
      positionName: "Инженер",
      teamId: "team",
      teamName: "Команда",
      capacityMinPerDay: 480
    }
  ])
}));

vi.mock("./planning-client", () => ({
  createDeliveryPlanningClient: () => ({
    resourceDirectorySeed: () => [],
    getResourceDirectory: directoryMock.getResourceDirectory
  })
}));

function Harness() {
  const directory = useResourceDirectory();
  return <div data-testid="resources">{directory.list.map((item) => item.name).join(",")}</div>;
}

async function renderStrictDirectory(): Promise<Root> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <StrictMode>
        <PlanningRuntimeProvider live>
          <Harness />
        </PlanningRuntimeProvider>
      </StrictMode>
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  return root;
}

afterEach(() => {
  directoryMock.getResourceDirectory.mockClear();
  document.body.replaceChildren();
});

describe("useResourceDirectory live lifecycle", () => {
  it("loads resources after the StrictMode effect cleanup and remount", async () => {
    const root = await renderStrictDirectory();

    expect(document.querySelector("[data-testid='resources']")?.textContent).toBe(
      "Ресурс из API"
    );

    await act(async () => root.unmount());
  });
});
