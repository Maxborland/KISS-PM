/**
 * @vitest-environment happy-dom
 */

import { act, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectRecord } from "@/workspace/lib/workspace-client";
import { ProjectsListSurface } from "./projects-list-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const harness = vi.hoisted(() => ({
  data: null as { projects: ProjectRecord[] } | null,
  status: "loading" as "loading" | "ready" | "error" | "forbidden",
  error: null as string | null
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

vi.mock("@/delivery/ui/workspace-shell", () => ({
  WorkspaceShell: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock("@/components/domain/bem-avatar", () => ({
  BemAvatar: () => <span aria-hidden="true" />
}));

vi.mock("@/views/lib/prototype-gate", () => ({ prototypeNotesEnabled: false }));

vi.mock("@/workspace/lib/use-workspace", () => ({
  useProjects: () => ({
    data: harness.data,
    status: harness.status,
    error: harness.error,
    reload: vi.fn(),
    createProject: vi.fn(async () => ({ ok: true })),
    updateProject: vi.fn(async () => ({ ok: true })),
    setProjectStatus: vi.fn(async () => ({ ok: true }))
  }),
  useWorkspaceUsers: () => ({ indexOf: () => -1 })
}));

const project = (id: string, title: string): ProjectRecord => ({
  id,
  tenantId: "tenant-alpha",
  sourceType: "opportunity",
  sourceOpportunityId: null,
  clientId: `client-${id}`,
  projectTypeId: null,
  title,
  clientName: `Client ${id}`,
  status: "active",
  plannedStart: "2026-07-01",
  plannedFinish: "2026-07-31",
  contractValue: 1_000_000,
  plannedHours: 120,
  templateId: null,
  demand: [],
  createdAt: "2026-07-01T00:00:00.000Z",
  activatedAt: "2026-07-01T00:00:00.000Z",
  closedAt: null
});

const nonReadyStates: Array<{
  status: "loading" | "ready" | "error";
  data: { projects: ProjectRecord[] } | null;
  error: string | null;
  expectedText: string;
}> = [
  { status: "loading", data: null, error: null, expectedText: "Загрузка проектов" },
  { status: "error", data: null, error: "load_failed", expectedText: "Не удалось загрузить проекты" },
  { status: "ready", data: { projects: [] }, error: null, expectedText: "Нет активных проектов" }
];

let root: Root | null = null;

async function renderSurface() {
  const container = document.body.appendChild(document.createElement("div"));
  root = createRoot(container);
  await act(async () => root!.render(<ProjectsListSurface />));
}

beforeEach(() => {
  harness.data = null;
  harness.status = "loading";
  harness.error = null;
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  document.body.replaceChildren();
});

describe("projects list navigation", () => {
  it("offers a manual project creation trigger even when projects already exist", async () => {
    harness.data = { projects: [project("project-alpha", "Alpha project")] };
    harness.status = "ready";

    await renderSurface();

    // Создание — реальная мутация через диалог (кнопка), а не ссылка на CRM.
    const createButton = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Новый проект");
    expect(createButton).toBeInstanceOf(HTMLButtonElement);
    expect(document.querySelector('a[href="/crm/deals"]')).toBeNull();
  });

  it("gives every available project title a native, keyboard-focusable detail link", async () => {
    harness.data = {
      projects: [
        project("project-alpha", "Alpha project"),
        project("project-beta", "Beta project")
      ]
    };
    harness.status = "ready";

    await renderSurface();

    const rows = [...document.querySelectorAll<HTMLTableRowElement>("tbody tr")];
    expect(rows).toHaveLength(2);

    const links = rows.map((row) => row.querySelector<HTMLAnchorElement>("a"));
    expect(links.map((link) => link?.textContent)).toEqual(["Alpha project", "Beta project"]);
    expect(links.map((link) => link?.getAttribute("href"))).toEqual([
      "/projects/project-alpha",
      "/projects/project-beta"
    ]);

    for (const [index, link] of links.entries()) {
      expect(link).toBeInstanceOf(HTMLAnchorElement);
      expect(link?.hasAttribute("tabindex")).toBe(false);
      link?.focus();
      expect(document.activeElement).toBe(link);
      expect(rows[index]?.hasAttribute("role")).toBe(false);
      expect(rows[index]?.hasAttribute("tabindex")).toBe(false);
    }
  });

  it.each(nonReadyStates)(
    "keeps the $status state free of project detail links",
    async ({ status, data, error, expectedText }) => {
      harness.status = status;
      harness.data = data;
      harness.error = error;

      await renderSurface();

      expect(document.body.textContent).toContain(expectedText);
      expect(document.querySelector('a[href^="/projects/"]')).toBeNull();
    }
  );
});
