// @vitest-environment happy-dom

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { Opportunity } from "@/lib/api-types";
import { DealDetailRuntimeBlock } from "@/views/blocks/deal-detail-runtime-block";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/views/layout/route-page-intro", () => ({
  RoutePageIntro: ({ lead }: { lead?: string }) => <p>{lead}</p>
}));

describe("DealDetailRuntimeBlock", () => {
  it("saves the next action only through the provided runtime mutation", async () => {
    const onUpdateNextAction = vi.fn().mockResolvedValue(makeOpportunity({ nextAction: "Созвониться с заказчиком" }));
    const { host, root } = await renderBlock(
      <DealDetailRuntimeBlock
        canUpdateNextAction
        opportunity={makeOpportunity({ nextAction: "Старый шаг" })}
        onUpdateNextAction={onUpdateNextAction}
      />
    );

    const input = host.querySelector<HTMLInputElement>("input[aria-label='Следующее действие по сделке']");
    const saveButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Сохранить");
    expect(input?.value).toBe("Старый шаг");

    await act(async () => {
      setInputValue(input!, "  Созвониться с заказчиком  ");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onUpdateNextAction).toHaveBeenCalledWith("Созвониться с заказчиком");

    act(() => root.unmount());
    host.remove();
  });

  it("shows a disabled reason when the user cannot manage opportunities", async () => {
    const onUpdateNextAction = vi.fn();
    const { host, root } = await renderBlock(
      <DealDetailRuntimeBlock
        opportunity={makeOpportunity({ nextAction: "" })}
        onUpdateNextAction={onUpdateNextAction}
      />
    );

    const input = host.querySelector<HTMLInputElement>("input[aria-label='Следующее действие по сделке']");
    const saveButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Сохранить");

    expect(input).toHaveProperty("disabled", true);
    expect(saveButton).toHaveProperty("disabled", true);
    expect(saveButton?.getAttribute("title")).toBe("Недостаточно прав для изменения сделки.");
    expect(host.textContent).toContain("Недостаточно прав для изменения сделки.");

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onUpdateNextAction).not.toHaveBeenCalled();

    act(() => root.unmount());
    host.remove();
  });
});

async function renderBlock(element: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(element);
  });

  return { host, root };
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
}

function makeOpportunity({ nextAction }: { nextAction: string }): Opportunity {
  return {
    clientId: "client-1",
    clientName: "Гимназия 12",
    contactName: "Анна Петрова",
    contractValue: 12000000,
    createdAt: "2026-06-01T09:00:00.000Z",
    customFieldValues: nextAction ? { next_action: nextAction } : {},
    demand: [],
    description: "Реконструкция учебных пространств",
    feasibilityCheckedAt: null,
    feasibilityResult: null,
    feasibilityStatus: "ready",
    id: "opportunity-runtime",
    ownerUserId: "user-alpha-lead-architect",
    plannedFinish: "2026-09-30T00:00:00.000Z",
    plannedHourlyRate: 6000,
    plannedHours: 2000,
    plannedStart: "2026-06-10T00:00:00.000Z",
    primaryContactId: "contact-1",
    probability: 80,
    projectType: "Общественные интерьеры",
    projectTypeId: "project-type-1",
    stageId: "deal-stage-contract",
    status: "active",
    templateId: null,
    tenantId: "tenant-alpha",
    title: "Реконструкция гимназии",
    updatedAt: "2026-06-01T10:00:00.000Z"
  };
}
