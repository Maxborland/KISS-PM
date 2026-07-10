/**
 * @vitest-environment happy-dom
 */

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectOverview } from "./overview-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let loadCommitsImpl: () => Promise<unknown>;
const loadCommits = vi.fn(() => loadCommitsImpl());

const readModel = {
  project: { deadline: "2026-07-10" },
  authored: {
    tasks: [{
      id: "task-1",
      wbsCode: "1",
      title: "Critical task",
      durationMinutes: 480,
      workMinutes: 480,
      percentComplete: 50,
      statusId: "in_progress",
      plannedFinish: "2026-07-09",
      customFields: { resLabel: "Engineer" }
    }]
  },
  calculatedPlan: {
    tasks: [{
      id: "task-1",
      calculatedFinish: "2026-07-09",
      isCritical: true,
      totalSlackMinutes: 0
    }],
    projectFinish: "2026-07-12",
    criticalPathTaskIds: ["task-1"]
  },
  resourceLoad: {
    overloads: [{
      granularity: "day",
      resourceId: "resource-1",
      date: "2026-07-10",
      overloadMinutes: 120
    }]
  },
  baselineComparison: {
    tasks: [{ taskId: "task-1", baselineFinish: "2026-07-08" }]
  },
  validationIssues: [],
  planVersion: 9
};

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>
}));

vi.mock("@/components/domain/bem-avatar", () => ({
  BemAvatar: () => <span />
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock("@/components/domain/surface-state", () => ({
  SurfaceState: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock("@/delivery/ui/bento", () => ({
  Bento: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  BentoCard: ({
    title,
    actions,
    children,
    footer
  }: {
    title: string;
    actions?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
  }) => <section><h3>{title}</h3>{actions}{children}{footer}</section>,
  StatTile: ({ label, value }: { label: string; value: ReactNode }) => <span>{label}: {value}</span>
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: ReactNode }) => <main>{children}</main>
}));

vi.mock("@/delivery/lib/project-chrome", () => ({
  PROJECT_FALLBACK: {},
  planningErr: (value: string) => value,
  useProjectBase: () => ({
    name: "Project",
    code: "PRJ",
    status: "В работе",
    statusTone: "info"
  })
}));

vi.mock("@/delivery/lib/use-planning", () => ({
  usePlanning: () => ({
    readModel,
    status: "ready",
    error: null,
    reload: vi.fn(),
    loadCommits
  })
}));

vi.mock("@/delivery/lib/use-resource-directory", () => ({
  useResourceDirectory: () => ({ name: () => "Engineer" })
}));

vi.mock("@/delivery/lib/date-origin", () => ({
  currentPlanDate: () => "2026-07-10",
  isPlanItemOverdue: (finish: string | null | undefined) => finish != null && finish < "2026-07-10"
}));

vi.mock("@/views/lib/prototype-gate", () => ({
  prototypeNotesEnabled: false
}));

beforeEach(() => {
  loadCommitsImpl = async () => ({ commits: [], latestRevert: null });
  loadCommits.mockClear();
});

afterEach(() => {
  document.body.replaceChildren();
});

describe("overview navigation and audit states", () => {
  it("keeps every signal CTA and the commits footer project-specific", async () => {
    const view = await renderOverview("project-a");
    const signalAnchors = [...view.host.querySelectorAll("a")].filter(
      (anchor) => anchor.textContent?.trim() !== "Все"
    );

    expect(signalAnchors.map((anchor) => anchor.textContent?.trim())).toEqual([
      "Открыть График",
      "Открыть Сценарии",
      "Открыть Baseline",
      "Открыть График",
      "Показать путь"
    ]);
    expect(signalAnchors.map((anchor) => anchor.getAttribute("href"))).toEqual([
      "/projects/project-a/schedule",
      "/projects/project-a/scenarios",
      "/projects/project-a/baseline",
      "/projects/project-a/schedule",
      "/projects/project-a/schedule"
    ]);
    expect(anchor(view.host, "Все")?.getAttribute("href")).toBe("/projects/project-a/commits");

    await unmount(view.root);
  });

  it("shows true successful empty history as empty", async () => {
    const view = await renderOverview();

    expect(view.host.textContent).toContain("История пуста.");
    expect(view.host.textContent).not.toContain("Не удалось загрузить историю изменений.");
    expect(view.host.textContent).not.toContain("недостаточно прав");

    await unmount(view.root);
  });

  it("does not mask an audit error as empty", async () => {
    loadCommitsImpl = async () => {
      throw new Error("audit_events_failed");
    };
    const view = await renderOverview();

    expect(view.host.textContent).toContain("Не удалось загрузить историю изменений.");
    expect(view.host.textContent).not.toContain("История пуста.");

    await unmount(view.root);
  });

  it("does not mask a 403 audit response as empty", async () => {
    loadCommitsImpl = async () => {
      throw Object.assign(new Error("forbidden"), { status: 403 });
    };
    const view = await renderOverview();

    expect(view.host.textContent).toContain("История изменений недоступна: недостаточно прав.");
    expect(view.host.textContent).not.toContain("История пуста.");

    await unmount(view.root);
  });
});

async function renderOverview(projectId = "project-a"): Promise<{ root: Root; host: HTMLDivElement }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<ProjectOverview projectId={projectId} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { root, host };
}

async function unmount(root: Root) {
  await act(async () => {
    root.unmount();
  });
}

function anchor(host: HTMLElement, label: string) {
  return [...host.querySelectorAll("a")].find(
    (candidate) => candidate.textContent?.trim() === label
  );
}