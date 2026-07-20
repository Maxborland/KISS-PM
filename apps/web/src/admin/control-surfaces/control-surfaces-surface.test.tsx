// @vitest-environment happy-dom

/* ============================================================
   AdminControlSurfacesSurface: операционная поверхность публикации/отката
   control-surfaces на contract-mock транспорте (без AdminRuntimeProvider → mock).
   Проверяем: список с честными статусами, предпросмотр валидации черновика,
   публикацию с квитанцией, блокировку публикации невалидного черновика и откат
   к прошлой версии. ConfirmDialog замокан на прямой вызов onConfirm по триггеру.
   ============================================================ */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Children, cloneElement, isValidElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminControlSurfacesSurface } from "./control-surfaces-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args)
  }
}));
vi.mock("@/admin/ui/admin-frame", () => ({
  AdminFrame: ({ children }: { children?: React.ReactNode }) => <main>{children}</main>
}));
// ConfirmDialog → прямой вызов onConfirm при клике по триггеру (children); диалог/портал не нужен.
vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({ children, onConfirm }: { children: React.ReactNode; onConfirm: () => void | Promise<void> }) => {
    const child = Children.only(children) as ReactElement<{ onClick?: () => void }>;
    return isValidElement(child) ? cloneElement(child, { onClick: () => void onConfirm() }) : child;
  }
}));

describe("AdminControlSurfacesSurface", () => {
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
      root.render(<AdminControlSurfacesSurface />);
    });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
  };

  const rows = () => [...host.querySelectorAll('[data-testid="control-surfaces-table"] tbody tr')];
  const rowByText = (needle: string) => rows().find((row) => row.textContent?.includes(needle));
  const clickOpen = async (needle: string) => {
    const row = rowByText(needle);
    const openButton = [...(row?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Открыть");
    await act(async () => { openButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
  };
  const detail = () => host.querySelector('[data-testid="control-surface-detail"]');
  const clickTestId = async (testId: string) => {
    const el = host.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
    await act(async () => { el?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
  };

  it("показывает список поверхностей с честными статусами и индикатором черновика", async () => {
    await render();
    // 3 seed-поверхности: опубликованная без правок, опубликованная с черновиком, невалидный черновик.
    expect(rows()).toHaveLength(3);
    const kpiRow = rowByText("KPI Deviation Control");
    expect(kpiRow?.textContent).toContain("Опубликована");
    expect(kpiRow?.textContent).toContain("Есть неопубликованные правки");
    const draftRow = rowByText("Черновик без видимых полей");
    expect(draftRow?.textContent).toContain("Черновик");
  });

  it("публикует черновик и показывает квитанцию аудита", async () => {
    await render();
    await clickOpen("KPI Deviation Control");
    // Предпросмотр валидного черновика → готов к публикации.
    expect(detail()?.querySelector('[data-testid="control-surface-preview"]')?.textContent).toContain("Готов к публикации");

    await clickTestId("control-surface-publish");
    expect(toastSuccess).toHaveBeenCalledWith("Поверхность опубликована");
    const receipt = host.querySelector('[data-testid="control-surface-receipt"]');
    expect(receipt?.textContent).toContain("Опубликовано");
    expect(receipt?.textContent).toMatch(/audit-/);
  });

  it("блокирует публикацию невалидного черновика (кнопка недоступна, замечания видны)", async () => {
    await render();
    await clickOpen("Черновик без видимых полей");
    const publishButton = host.querySelector<HTMLButtonElement>('[data-testid="control-surface-publish"]');
    expect(publishButton?.disabled).toBe(true);
    expect(detail()?.querySelector('[data-testid="control-surface-preview"]')?.textContent).toContain("Есть замечания");
  });

  it("откатывает опубликованную поверхность к прошлой версии с квитанцией", async () => {
    await render();
    await clickOpen("CRM Intake Control");
    // История версий v1/v2; активна v2 → откат к v1 доступен.
    const versions = host.querySelector('[data-testid="control-surface-versions"]');
    expect(versions?.textContent).toContain("v1");
    expect(versions?.textContent).toContain("v2");

    await clickTestId("control-surface-rollback-1");
    expect(toastSuccess).toHaveBeenCalledWith("Откат к версии 1 выполнен");
    const receipt = host.querySelector('[data-testid="control-surface-receipt"]');
    expect(receipt?.textContent).toContain("Откат выполнен");
    expect(receipt?.textContent).toMatch(/audit-/);
  });
});
