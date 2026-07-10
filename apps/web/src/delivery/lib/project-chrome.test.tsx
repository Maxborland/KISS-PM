/**
 * @vitest-environment happy-dom
 */

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectMeta } from "@/delivery/ui/delivery-frame";
import { useProjectBase } from "./project-chrome";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let live = true;

vi.mock("@/delivery/lib/planning-runtime", () => ({
  usePlanningRuntime: () => ({ live, fetchImpl: null })
}));

const base: ProjectMeta = {
  name: "Mock project",
  code: "MP",
  status: "Mock status",
  statusTone: "warning",
  planVersion: "v1",
  deadline: "01.01.2026",
  finish: "02.01.2026"
};

beforeEach(() => {
  live = true;
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("useProjectBase", () => {
  it("preserves the supplied identity without a request in mock mode", async () => {
    live = false;
    const view = await renderIdentity("mock-project");

    expect(readIdentity(view.host)).toEqual({
      name: "Mock project",
      code: "MP",
      status: "Mock status",
      tone: "warning"
    });
    expect(fetch).not.toHaveBeenCalled();

    await unmount(view.root);
  });

  it("loads active-project title, initials and status from project detail", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      project: { title: "Космический интегратор", status: "active" }
    }));
    const view = await renderIdentity("identity-active");

    expect(readIdentity(view.host)).toEqual({
      name: "Космический интегратор",
      code: "КИ",
      status: "В работе",
      tone: "info"
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/workspace/projects/identity-active",
      { credentials: "include" }
    );

    await unmount(view.root);
  });

  it("does not reuse the same project id across remounts or a denied response", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({
        project: { title: "Tenant A project", status: "active" }
      }))
      .mockResolvedValueOnce({ ok: false } as Response);

    const first = await renderIdentity("shared-project-id");
    expect(readIdentity(first.host).name).toBe("Tenant A project");
    await unmount(first.root);
    first.host.remove();

    const denied = await renderIdentity("shared-project-id");
    expect(readIdentity(denied.host)).toEqual({
      name: "Проект",
      code: "…",
      status: "—",
      tone: "info"
    });
    expect(fetch).toHaveBeenCalledTimes(2);

    await unmount(denied.root);
  });
  it("never renders the previous project identity while a new project loads", async () => {
    const second = deferred<Response>();
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({
        project: { title: "Альфа проект", status: "active" }
      }))
      .mockImplementationOnce(() => second.promise);

    const view = await renderIdentity("identity-alpha");
    expect(readIdentity(view.host).name).toBe("Альфа проект");

    await act(async () => {
      view.root.render(<Harness projectId="identity-beta" />);
      await Promise.resolve();
    });

    expect(readIdentity(view.host)).toEqual({
      name: "Проект",
      code: "…",
      status: "—",
      tone: "info"
    });
    expect(view.host.textContent).not.toContain("Альфа проект");

    second.resolve(jsonResponse({
      project: { title: "Бета сервис", status: "active" }
    }));
    await act(async () => {
      await second.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(readIdentity(view.host)).toEqual({
      name: "Бета сервис",
      code: "БС",
      status: "В работе",
      tone: "info"
    });

    await unmount(view.root);
  });
});

function Harness({ projectId }: { projectId: string }) {
  const project = useProjectBase(projectId, base);
  return (
    <div
      data-name={project.name}
      data-code={project.code}
      data-status={project.status}
      data-tone={project.statusTone}
    />
  );
}

async function renderIdentity(projectId: string): Promise<{ root: Root; host: HTMLDivElement }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<Harness projectId={projectId} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { root, host };
}

function readIdentity(host: HTMLElement) {
  const node = host.querySelector("div")!;
  return {
    name: node.dataset.name,
    code: node.dataset.code,
    status: node.dataset.status,
    tone: node.dataset.tone
  };
}

function jsonResponse(value: unknown): Response {
  return {
    ok: true,
    json: async () => value
  } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function unmount(root: Root) {
  await act(async () => {
    root.unmount();
  });
}
