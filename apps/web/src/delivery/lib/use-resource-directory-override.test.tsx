/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanningRuntimeProvider } from "./planning-runtime";
import { useResourceDirectory } from "./use-resource-directory";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getResourceDirectory = vi.fn();

vi.mock("./planning-client", () => ({
  createDeliveryPlanningClient: () => ({
    resourceDirectorySeed: () => [],
    getResourceDirectory
  })
}));

function Harness() {
  const directory = useResourceDirectory([{
    id: "plan-resource",
    name: "Ресурс плана",
    positionId: "position-plan",
    positionName: "Планирование",
    teamId: "team-plan",
    teamName: "План",
    capacityMinPerDay: 360
  }]);
  return <div data-testid="resources">{directory.list.map((item) => item.name).join(",")}</div>;
}

afterEach(() => {
  getResourceDirectory.mockReset();
  document.body.replaceChildren();
});

describe("useResourceDirectory mock override", () => {
  it("uses the supplied mock resources without requesting the tenant user directory", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<PlanningRuntimeProvider live={false}><Harness /></PlanningRuntimeProvider>);
      await Promise.resolve();
    });

    expect(document.querySelector("[data-testid='resources']")?.textContent).toBe("Ресурс плана");
    expect(getResourceDirectory).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
