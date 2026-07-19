// @vitest-environment happy-dom

/* ============================================================
   AdminBackgroundJobsSurface (Н4): read-only обзор прогонов на
   contract-mock транспорте (без AdminRuntimeProvider → mock).
   Проверяем: список прогонов с честными статусами/ошибками,
   фильтр по статусу и диалог событий прогона из ответа API.
   Управляющих контролов (retry/cancel) нет — API их не даёт.
   ============================================================ */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminBackgroundJobsSurface } from "./background-jobs-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn()
  }
}));
vi.mock("@/admin/ui/admin-frame", () => ({
  AdminFrame: ({ children }: { children?: React.ReactNode }) => <main>{children}</main>
}));
// Диалог событий: контролируемый open → простой контейнер без портала.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="events-dialog">{children}</div> : null,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DialogTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>
}));

describe("AdminBackgroundJobsSurface", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    toastError.mockReset();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  const render = async () => {
    await act(async () => {
      root.render(<AdminBackgroundJobsSurface />);
    });
    await act(async () => { await Promise.resolve(); });
  };

  const rows = () => [...host.querySelectorAll('[data-testid="background-jobs-table"] tbody tr')];

  it("показывает прогоны из ответа API: kinds по-русски, честные статусы и lastError", async () => {
    await render();

    expect(host.querySelector('[data-testid="background-jobs-page"]')).not.toBeNull();
    expect(rows()).toHaveLength(3);
    const text = host.querySelector('[data-testid="background-jobs-table"]')!.textContent!;
    expect(text).toContain("Очистка архивных файлов");
    expect(text).toContain("Успешно");
    expect(text).toContain("Провалена");
    expect(text).toContain("В очереди");
    // Ошибка провалившегося прогона показана как есть (честный код, не приукрашенный текст).
    expect(text).toContain("background_job_failed");
    // Read-only: управляющих контролов retry/cancel нет.
    expect(host.textContent).not.toContain("Повторить");
    expect(host.textContent).not.toContain("Отменить");
  });

  it("фильтрует прогоны по статусу через боевой параметр ?status=", async () => {
    await render();

    const select = host.querySelector("select")!;
    select.value = "dead";
    await act(async () => {
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => { await Promise.resolve(); });

    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.textContent).toContain("Санация записей звонков");
    expect(rows()[0]!.textContent).toContain("Провалена");
  });

  it("открывает историю событий прогона из ответа /runs/:runId/events", async () => {
    await render();
    expect(host.querySelector('[data-testid="events-dialog"]')).toBeNull();

    // Первая строка (новейший прогон) — успешная очистка хранилища.
    const eventsButton = rows()[0]!.querySelector<HTMLButtonElement>('button[title="История событий прогона"]');
    expect(eventsButton).not.toBeNull();
    await act(async () => eventsButton!.click());

    const dialog = host.querySelector('[data-testid="events-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain("Поставлена в очередь");
    expect(dialog!.textContent).toContain("Взята воркером");
    expect(dialog!.textContent).toContain("Успешно завершена");
    expect(toastError).not.toHaveBeenCalled();
  });
});
