// @vitest-environment happy-dom

/* ============================================================
   AdminSecuritySurface (Н5): security-честность без псевдо-контролов.
   2FA/SSO не реализованы — вместо вечно-disabled свитчей поверхность
   показывает честный роадмап-текст БЕЗ контролов; поля контракта
   twoFactorRequired/ssoSamlEnabled остаются reserved и уходят в PUT
   без изменений. Реально редактируемые контролы (тайм-аут сессии,
   домен-allowlist) остаются работающими.
   ============================================================ */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminSecuritySurface } from "./security-surface";

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
  AdminFrame: ({ children, actions }: { children?: React.ReactNode; actions?: React.ReactNode }) => (
    <main>
      <div data-testid="frame-actions">{actions}</div>
      {children}
    </main>
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

async function renderSurface() {
  await act(async () => {
    root.render(<AdminSecuritySurface />);
  });
  // useSecurityPolicy: загрузка через contract-mock (fetch → микрозадачи).
  for (let i = 0; i < 10 && !container.textContent?.includes("Тайм-аут сессии"); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

describe("AdminSecuritySurface — честность 2FA/SSO (Н5)", () => {
  it("renders NO switch/checkbox pseudo-controls for 2FA and SSO", async () => {
    await renderSurface();
    expect(container.querySelector('[role="switch"]')).toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    // Старые aria-подписи disabled-свитчей исчезли вместе с контролами.
    expect(container.querySelector('[aria-label*="недоступно в этой версии"]')).toBeNull();
  });

  it("shows an honest roadmap text for 2FA/SSO instead of controls", async () => {
    await renderSurface();
    const text = container.textContent ?? "";
    expect(text).toContain("Двухфакторная аутентификация и единый вход (SSO)");
    expect(text).toContain("не реализованы");
    expect(text).toContain("появятся");
  });

  it("keeps the real controls working: session timeout input and domain allowlist stay", async () => {
    await renderSurface();
    const timeout = container.querySelector('input[type="number"]') as HTMLInputElement | null;
    expect(timeout).not.toBeNull();
    expect(timeout!.value).toBe("12"); // sessionTimeoutHours из contract-mock сида
    expect(container.textContent).toContain("Разрешённые email-домены");
    expect(container.textContent).toContain("kiss-pm.dev");
  });

  it("keeps the save button present but disabled until an editable field changes", async () => {
    await renderSurface();
    const save = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Сохранить"))!;
    expect(save).toBeDefined();
    expect(save.disabled).toBe(true);
    const timeout = container.querySelector('input[type="number"]') as HTMLInputElement;
    await act(async () => {
      setNativeInputValue(timeout, "48");
    });
    expect(save.disabled).toBe(false);
  });
});
