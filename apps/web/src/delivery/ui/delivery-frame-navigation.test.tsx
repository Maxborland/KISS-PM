import type { ReactNode } from "react";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DELIVERY_TABS, DeliveryFrame, type DeliveryTab, type ProjectMeta } from "./delivery-frame";

vi.mock("@/delivery/ui/workspace-shell", () => ({
  WorkspaceShell: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock("@/views/lib/prototype-gate", () => ({ prototypeNotesEnabled: false }));

const PROJECT: ProjectMeta = {
  name: "Project",
  code: "PRJ",
  status: "В работе",
  planVersion: "17",
  deadline: "10.07.2026",
  finish: "12.07.2026"
};

const EXPECTED_TABS = [
  ["Обзор", "overview"],
  ["График", "schedule"],
  ["Ресурсы", "resources"],
  ["Назначения", "assignments"],
  ["Календари", "calendars"],
  ["Сценарии", "scenarios"],
  ["Baseline", "baseline"],
  ["Коммиты", "commits"],
  ["Настройки", "settings"]
] as const satisfies ReadonlyArray<readonly [DeliveryTab, string]>;

function renderFrame(activeTab: DeliveryTab, projectId?: string) {
  const window = new Window();
  window.document.body.innerHTML = renderToStaticMarkup(
    <DeliveryFrame project={PROJECT} {...(projectId === undefined ? {} : { projectId })} activeTab={activeTab}>
      <div>Surface</div>
    </DeliveryFrame>
  );
  return window.document;
}

describe("DeliveryFrame project navigation", () => {
  // DeliveryFrame deliberately has no approval-state input: navigation is identical for A, PR and RR.
  it.each(["A", "PR", "RR"] as const)("renders exact project links for approval state %s", () => {
    const document = renderFrame("Сценарии", "project-42");
    const links = Array.from(document.querySelectorAll("nav a"));

    expect(DELIVERY_TABS).toEqual(EXPECTED_TABS.map(([tab]) => tab));
    expect(links).toHaveLength(EXPECTED_TABS.length);
    EXPECTED_TABS.forEach(([tab, slug], index) => {
      expect(links[index]?.textContent?.trim()).toBe(tab);
      expect(links[index]?.getAttribute("href")).toBe(`/projects/project-42/${slug}`);
      expect(links[index]?.getAttribute("aria-current")).toBe(tab === "Сценарии" ? "page" : null);
    });
  });

  it("sets aria-current only on the selected surface", () => {
    for (const [activeTab] of EXPECTED_TABS) {
      const document = renderFrame(activeTab, "project-42");
      const links = Array.from(document.querySelectorAll("nav a"));

      expect(links.filter((link) => link.getAttribute("aria-current") === "page")).toHaveLength(1);
      EXPECTED_TABS.forEach(([tab], index) => {
        expect(links[index]?.getAttribute("aria-current")).toBe(tab === activeTab ? "page" : null);
      });
    }
  });

  it("keeps the story fallback visibly static without a project id", () => {
    const document = renderFrame("Обзор");
    const nav = document.querySelector("nav");

    expect(nav).not.toBeNull();
    expect(nav?.querySelectorAll("a, button, [role='link'], [tabindex]")).toHaveLength(0);
    expect(Array.from(nav?.children ?? []).map((item) => item.textContent?.trim())).toEqual(DELIVERY_TABS);
    expect(nav?.children[0]?.getAttribute("aria-current")).toBe("page");
  });
});
