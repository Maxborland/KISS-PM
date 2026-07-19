// @vitest-environment happy-dom

/* ============================================================
   AdminAbsencesSurface (Н3): честная поверхность отсутствий на
   contract-mock транспорте (без AdminRuntimeProvider → mock).
   Проверяем: загрузку списка за дефолтный период (сид мока),
   e2e-совместимые testid (absences-page / absences-table /
   absence-cell-<userId>-<dateFrom>) и удаление ТОЛЬКО через
   подтверждение с честным тостом.
   ============================================================ */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAbsencesSurface } from "./absences-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args)
  }
}));
// Сессия: администратор с правом управления отсутствиями (гейт кнопок мутаций).
vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({
    id: "user-anna", tenantId: "tenant-alpha", name: "Анна Администратор",
    permissions: ["tenant.absences.read", "tenant.absences.manage", "tenant.users.read"]
  })
}));
// Каркас админки вне скоупа: рендерим контент + actions (кнопка создания живёт в actions).
vi.mock("@/admin/ui/admin-frame", () => ({
  AdminFrame: ({ children, actions }: { children?: React.ReactNode; actions?: React.ReactNode }) => (
    <main>{actions}{children}</main>
  )
}));
// ConfirmDialog: триггер + явная кнопка подтверждения (radix-оверлей вне скоупа).
vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({ children, onConfirm, title }: {
    children?: React.ReactNode; onConfirm: () => void | Promise<void>; title: string;
  }) => (
    <div>
      {children}
      <button type="button" data-testid="confirm-delete" aria-label={title} onClick={() => void onConfirm()} />
    </div>
  )
}));
// FormDialog: триггер + children всегда видимы (radix-портал вне скоупа теста).
vi.mock("@/components/domain/form-dialog", () => ({
  FormDialog: ({ children, trigger }: { children?: React.ReactNode; trigger?: React.ReactNode }) => (
    <div>{trigger}{children}</div>
  )
}));

const isoDay = (offsetDays: number): string =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

describe("AdminAbsencesSurface", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
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
      root.render(<AdminAbsencesSurface />);
    });
    // Догружаем цепочку loader → setState (mock-fetch резолвится микротасками).
    await act(async () => { await Promise.resolve(); });
  };

  it("показывает сид отсутствий за дефолтный период с e2e-совместимыми testid", async () => {
    await render();

    expect(host.querySelector('[data-testid="absences-page"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="absences-table"]')).not.toBeNull();
    // Сид мока: отпуск Ивана начинается через 3 дня — ячейка absence-cell-<userId>-<dateFrom>.
    const ivanCell = host.querySelector(`[data-testid="absence-cell-user-ivan-${isoDay(3)}"]`);
    expect(ivanCell).not.toBeNull();
    expect(ivanCell!.textContent).toContain("Иван Менеджер");
    // Кнопка создания (testid карантинной спеки) доступна при tenant.absences.manage.
    const createOpen = host.querySelector<HTMLButtonElement>('[data-testid="absence-create-open"]');
    expect(createOpen).not.toBeNull();
    expect(createOpen!.disabled).toBe(false);
    // Контейнер полей диалога создания несёт e2e-testid.
    expect(host.querySelector('[data-testid="absence-create-dialog"]')).not.toBeNull();
  });

  it("удаляет отсутствие только через подтверждение и подтверждает тостом", async () => {
    await render();

    const ivanCellSelector = `[data-testid="absence-cell-user-ivan-${isoDay(3)}"]`;
    expect(host.querySelector(ivanCellSelector)).not.toBeNull();
    const confirm = host.querySelector<HTMLButtonElement>(`button[aria-label="Удалить отсутствие «Иван Менеджер»?"]`);
    expect(confirm).not.toBeNull();

    await act(async () => confirm!.click());

    expect(host.querySelector(ivanCellSelector)).toBeNull();
    expect(toastSuccess).toHaveBeenCalledWith("Отсутствие удалено");
    expect(toastError).not.toHaveBeenCalled();
  });
});
