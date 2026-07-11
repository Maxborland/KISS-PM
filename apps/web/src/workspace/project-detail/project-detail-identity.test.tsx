/**
 * @vitest-environment happy-dom
 */

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectDetailSurface, projectDetailErrorMessage } from "./project-detail-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const push = vi.fn();
const reload = vi.fn();
const useProjectDetail = vi.fn();

let projects = [
  { id: "project-a", title: "Проект Альфа" },
  { id: "project-b", title: "Проект Бета" }
];
let detailState: {
  data: null;
  status: "loading" | "error" | "forbidden";
  error: string | null;
  reload: typeof reload;
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

vi.mock("@/workspace/lib/use-workspace", () => ({
  useProjects: () => ({ data: { projects }, status: "ready", error: null, reload: vi.fn() }),
  useProjectDetail: (projectId: string) => useProjectDetail(projectId),
  useWorkspaceUsers: () => ({ name: (id: string) => id, indexOf: () => -1 })
}));

vi.mock("@/delivery/ui/workspace-shell", () => ({
  WorkspaceShell: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock("@/components/domain/surface-state", () => ({
  SurfaceState: ({
    status,
    error,
    onRetry,
    errorFormat,
    empty,
    children
  }: {
    status: string;
    error?: string | null;
    onRetry?: () => void;
    errorFormat?: (value?: string) => string;
    empty?: { title: string; description: string };
    children: ReactNode;
  }) => (
    <section data-status={status}>
      {status === "ready" ? children : null}
      {status === "empty" ? <><h2>{empty?.title}</h2><p>{empty?.description}</p></> : null}
      {status === "error" ? <><p>{errorFormat?.(error ?? undefined)}</p><button onClick={onRetry}>Повторить</button></> : null}
      {status === "forbidden" ? <p>Доступ ограничен</p> : null}
      {status === "loading" ? <p>Загрузка</p> : null}
    </section>
  )
}));

vi.mock("@/components/domain/bem-avatar", () => ({
  BemAvatar: () => <span />
}));

vi.mock("@/components/ui/chip", () => ({
  Chip: ({ children }: { children: ReactNode }) => <span>{children}</span>
}));

vi.mock("@/components/ui/segmented", () => ({
  Segmented: () => <div />
}));

vi.mock("@/delivery/ui/bento", () => ({
  StatTile: () => <div />
}));

vi.mock("@/views/lib/prototype-gate", () => ({
  prototypeNotesEnabled: false
}));

beforeEach(() => {
  projects = [
    { id: "project-a", title: "Проект Альфа" },
    { id: "project-b", title: "Проект Бета" }
  ];
  detailState = { data: null, status: "loading", error: null, reload };
  push.mockReset();
  reload.mockReset();
  useProjectDetail.mockReset();
  useProjectDetail.mockImplementation(() => detailState);
});

afterEach(() => {
  document.body.replaceChildren();
});

describe("project detail error copy", () => {
  it("localizes known errors and hides raw network messages", () => {
    expect(projectDetailErrorMessage("invalid_json_response")).toBe("Некорректный ответ сервера");
    expect(projectDetailErrorMessage("Failed to fetch internal.example")).toBe("Запрос не выполнен");
  });
});

describe("ProjectDetailSurface identity and states", () => {
  it("switches the canonical URL and detail request together", async () => {
    const view = await renderDetail("project-a");
    const select = view.host.querySelector("select")!;

    await act(async () => {
      select.value = "project-b";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(push).toHaveBeenCalledWith("/projects/project-b");
    expect(useProjectDetail).toHaveBeenLastCalledWith("project-b");
    expect(select.value).toBe("project-b");

    await unmount(view.root);
  });

  it("keeps an unknown URL explicit instead of substituting the first project", async () => {
    detailState = { data: null, status: "error", error: "project_not_found", reload };
    const view = await renderDetail("project-does-not-exist");

    expect(view.host.querySelector("[data-status]")?.getAttribute("data-status")).toBe("empty");
    expect(view.host.querySelector("[data-status] h2")?.textContent).toBe("Проект не найден");
    expect([...view.host.querySelectorAll("[data-status] h2")]).toHaveLength(1);
    expect(useProjectDetail).toHaveBeenCalledWith("project-does-not-exist");
    expect(push).not.toHaveBeenCalled();

    await unmount(view.root);
  });

  it("maps a load error to Russian and retries the same project", async () => {
    detailState = { data: null, status: "error", error: "load_failed", reload };
    const view = await renderDetail("project-a");

    expect(view.host.querySelector("[data-status]")?.getAttribute("data-status")).toBe("error");
    expect(view.host.textContent).toContain("Не удалось загрузить данные");

    await act(async () => {
      view.host.querySelector("button")!.click();
    });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(useProjectDetail).toHaveBeenLastCalledWith("project-a");

    await unmount(view.root);
  });

  it("keeps forbidden distinct from not-found and generic error", async () => {
    detailState = { data: null, status: "forbidden", error: "permission_missing", reload };
    const view = await renderDetail("project-a");

    expect(view.host.querySelector("[data-status]")?.getAttribute("data-status")).toBe("forbidden");
    expect(view.host.textContent).toContain("Доступ ограничен");
    expect(view.host.textContent).not.toContain("Проект не найден");

    await unmount(view.root);
  });
});

async function renderDetail(initialProjectId: string): Promise<{ root: Root; host: HTMLDivElement }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<ProjectDetailSurface initialProjectId={initialProjectId} />);
    await Promise.resolve();
  });
  return { root, host };
}

async function unmount(root: Root) {
  await act(async () => {
    root.unmount();
  });
}
