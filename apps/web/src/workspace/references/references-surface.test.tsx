// @vitest-environment happy-dom

/* ============================================================
   ReferencesTab (Н12): справочники должностей и статусов задач.
   Проверяем честный контракт UI поверх contract-mock'ов:
   - списки из боевых сида-контрактов (positions из admin-mock,
     статусы из workspace-mock);
   - удаление занятой должности → честная ошибка position_assigned
     (RU-текст), а не тихое удаление;
   - системные статусы: архив недоступен (disabled с причиной) —
     контрол не притворяется работающим.
   Диалоги (radix) замоканы прозрачными контейнерами, как в
   users-surface.test.
   ============================================================ */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReferencesTab } from "./references-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args)
  }
}));
// Сессия с правами управления обоими справочниками — контролы активны.
vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({
    id: "user-anna",
    tenantId: "tenant-alpha",
    name: "Анна Администратор",
    permissions: ["tenant.positions.manage", "tenant.task_statuses.manage"]
  })
}));
// ConfirmDialog: триггер + кнопка явного подтверждения (radix-оверлей вне скоупа теста).
vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({ children, onConfirm, title }: {
    children?: React.ReactNode; onConfirm: () => void | Promise<void>; title: string;
  }) => (
    <div>
      {children}
      <button type="button" data-testid="confirm-action" aria-label={`confirm:${title}`} onClick={() => void onConfirm()} />
    </div>
  )
}));
// FormDialog: триггер + поля + кнопка submit (по title), без портала.
vi.mock("@/components/domain/form-dialog", () => ({
  FormDialog: ({ children, trigger, title, onSubmit }: {
    children?: React.ReactNode; trigger?: React.ReactNode; title: string; onSubmit: () => Promise<string | null>;
  }) => (
    <div>
      {trigger}
      {children}
      <button type="button" aria-label={`submit:${title}`} onClick={() => void onSubmit()} />
    </div>
  )
}));

// Контролируемый input: пишем через нативный сеттер прототипа, иначе value-tracker
// React считает значение неизменённым и onChange не срабатывает.
function setNativeInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  toastError.mockReset();
  toastSuccess.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderTab() {
  await act(async () => {
    root.render(<ReferencesTab />);
  });
  for (let i = 0; i < 10 && !(container.textContent?.includes("Инженер") && container.textContent?.includes("Новая")); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

describe("ReferencesTab — справочники должностей и статусов задач (Н12)", () => {
  it("renders positions from the admin contract-mock and statuses from the workspace contract-mock", async () => {
    await renderTab();
    const text = container.textContent ?? "";
    // Должности (сид mock-admin-backend, сортировка по имени).
    expect(text).toContain("Должности");
    expect(text).toContain("Инженер");
    expect(text).toContain("Менеджер проектов");
    expect(text).toContain("Менеджер по продажам");
    // Статусы задач (сид mock-workspace-backend, системные).
    expect(text).toContain("Статусы задач");
    for (const name of ["Новая", "Ожидание", "В работе", "На проверке", "Готово"]) {
      expect(text).toContain(name);
    }
    expect(text).toContain("Системный");
  });

  it("refuses to delete an assigned position with an honest RU error toast (409 position_assigned)", async () => {
    await renderTab();
    const confirm = container.querySelector('[aria-label="confirm:Удалить должность «Менеджер по продажам»?"]') as HTMLButtonElement;
    expect(confirm).not.toBeNull();
    await act(async () => {
      confirm.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(String(toastError.mock.calls[0]?.[0])).toContain("Должность назначена пользователям");
    // Запись осталась в списке — удаление честно не произошло.
    expect(container.textContent).toContain("Менеджер по продажам");
  });

  it("disables archiving for system statuses with an honest reason (no fake control)", async () => {
    await renderTab();
    const archiveNew = container.querySelector('[aria-label="Архивировать статус «Новая»"]') as HTMLButtonElement;
    expect(archiveNew).not.toBeNull();
    expect(archiveNew.disabled).toBe(true);
    expect(archiveNew.title).toBe("Системный статус нельзя архивировать");
  });

  it("edits a position through the dialog and shows the updated name in the table", async () => {
    await renderTab();
    // Диалог правки должности «Инженер»: меняем название через контролируемый input.
    const editTrigger = container.querySelector('[aria-label="Изменить должность «Инженер»"]');
    expect(editTrigger).not.toBeNull();
    const nameInput = Array.from(container.querySelectorAll("input")).find((i) => i.value === "Инженер") as HTMLInputElement;
    expect(nameInput).toBeDefined();
    await act(async () => {
      setNativeInputValue(nameInput, "Ведущий инженер");
    });
    const submit = container.querySelector('[aria-label="submit:Изменить должность"]') as HTMLButtonElement;
    await act(async () => {
      submit.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain("Ведущий инженер");
  });
});
