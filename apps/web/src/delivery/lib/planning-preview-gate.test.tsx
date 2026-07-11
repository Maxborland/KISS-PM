/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { PlanningCommand } from "@kiss-pm/domain";
import type { PlanningPreviewResponse } from "@kiss-pm/planning-client";
import { afterEach, describe, expect, it } from "vitest";

import {
  PlanningPreviewGateProvider,
  usePlanningPreviewGate
} from "./planning-preview-gate";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const command: PlanningCommand = {
  type: "task.update_progress",
  payload: { taskId: "task-1", percentComplete: 50 }
};

function previewWithIssues(
  validationIssues: PlanningPreviewResponse["validationIssues"] = []
): PlanningPreviewResponse {
  return {
    before: {} as PlanningPreviewResponse["before"],
    after: {} as PlanningPreviewResponse["after"],
    planDelta: {
      changedTaskIds: ["task-1"],
      changedAssignmentIds: [],
      changedDependencyIds: []
    },
    validationIssues
  };
}

function Harness({ preview }: { preview: PlanningPreviewResponse }) {
  const { requestConfirmation } = usePlanningPreviewGate();
  return (
    <button
      type="button"
      onClick={() => {
        void requestConfirmation({ commands: [command], preview }).then((confirmed) => {
          document.body.dataset.confirmed = String(confirmed);
        });
      }}
    >
      Open preview
    </button>
  );
}

async function renderGate(preview: PlanningPreviewResponse): Promise<Root> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <PlanningPreviewGateProvider>
        <Harness preview={preview} />
      </PlanningPreviewGateProvider>
    );
  });
  return root;
}

function button(name: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === name
  );
  if (!(match instanceof HTMLButtonElement)) throw new Error("button_not_found:" + name);
  return match;
}

afterEach(() => {
  document.body.replaceChildren();
  delete document.body.dataset.confirmed;
});

describe("PlanningPreviewGateProvider", () => {
  it("keeps apply pending until the user confirms the visible server preview", async () => {
    const root = await renderGate(previewWithIssues());

    await act(async () => button("Open preview").click());

    expect(document.body.textContent).toContain("Предпросмотр изменений");
    expect(document.body.textContent).toContain("Задачи: 1");
    expect(document.body.dataset.confirmed).toBeUndefined();

    await act(async () => button("Применить изменения").click());
    expect(document.body.dataset.confirmed).toBe("true");

    await act(async () => root.unmount());
  });

  it("does not allow confirmation when preview contains blocking validation", async () => {
    const root = await renderGate(
      previewWithIssues([
        {
          code: "planning_command_invalid",
          severity: "error",
          message: "Команда ссылается на неизвестную задачу",
          entity: null
        }
      ])
    );

    await act(async () => button("Open preview").click());

    expect(document.body.textContent).toContain("Команда ссылается на неизвестную задачу");
    expect(button("Применить изменения").disabled).toBe(true);

    await act(async () => button("Отмена").click());
    expect(document.body.dataset.confirmed).toBe("false");

    await act(async () => root.unmount());
  });
});
