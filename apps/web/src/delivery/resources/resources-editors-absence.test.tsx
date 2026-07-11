/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Resource } from "@/delivery/lib/planning-demo-data";
import { AbsenceDialog } from "./resources-editors";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RESOURCES: Resource[] = [
  {
    id: "live-one",
    name: "Live One",
    positionId: "engineer",
    positionName: "Engineer",
    teamId: "delivery",
    teamName: "Delivery",
    capacityMinPerDay: 480
  },
  {
    id: "live-two",
    name: "Live Two",
    positionId: "analyst",
    positionName: "Analyst",
    teamId: "delivery",
    teamName: "Delivery",
    capacityMinPerDay: 480
  }
];

function renderDialog(props: {
  initialResourceId: string;
  initialStart: string;
  initialFinish: string;
}, root?: Root) {
  const nextRoot = root ?? createRoot(document.body.appendChild(document.createElement("div")));
  act(() => {
    nextRoot.render(
      <AbsenceDialog
        onSubmit={vi.fn()}
        resources={RESOURCES}
        initialResourceId={props.initialResourceId}
        initialStart={props.initialStart}
        initialFinish={props.initialFinish}
      >
        <button type="button">Исключение</button>
      </AbsenceDialog>
    );
  });
  return nextRoot;
}

function clickButton(label: string) {
  const button = [...document.querySelectorAll("button")]
    .find((candidate) => candidate.textContent === label);
  expect(button).toBeDefined();
  act(() => button!.click());
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("AbsenceDialog calendar defaults", () => {
  it("uses the supplied live resources, selected resource and date range on every open", () => {
    const root = renderDialog({
      initialResourceId: "live-two",
      initialStart: "2026-07-10",
      initialFinish: "2026-07-14"
    });

    clickButton("Исключение");

    const select = document.querySelector<HTMLSelectElement>("select");
    const dates = [...document.querySelectorAll<HTMLInputElement>('input[type="date"]')];
    expect([...select!.options].map((option) => option.value)).toEqual(["live-one", "live-two"]);
    expect(select!.value).toBe("live-two");
    expect(dates.map((input) => input.value)).toEqual(["2026-07-10", "2026-07-14"]);

    clickButton("Отмена");
    renderDialog({
      initialResourceId: "live-one",
      initialStart: "2026-08-01",
      initialFinish: "2026-08-03"
    }, root);
    clickButton("Исключение");

    expect(document.querySelector<HTMLSelectElement>("select")!.value).toBe("live-one");
    expect([...document.querySelectorAll<HTMLInputElement>('input[type="date"]')]
      .map((input) => input.value)).toEqual(["2026-08-01", "2026-08-03"]);
  });
});
