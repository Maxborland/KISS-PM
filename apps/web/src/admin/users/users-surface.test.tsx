// @vitest-environment happy-dom

/* ============================================================
   IssueResetTokenAction (users-surface): выдача токена сброса пароля.
   Проверяем честный контракт UI: кнопка доступна только при праве
   tenant.users.manage (через resetTokenDisabledReason), диалог после
   подтверждения показывает токен ИЗ ОТВЕТА API и честный текст про
   одноразовый показ и ввод на /password-reset/confirm.
   ============================================================ */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IssueResetTokenAction } from "./users-surface";
import type { WorkspaceUser } from "@/admin/lib/admin-client";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args)
  }
}));
vi.mock("@/shell/use-session-user", () => ({ useSessionUser: () => null }));
vi.mock("@/admin/lib/use-admin", () => ({ useAdmin: () => ({}) }));
vi.mock("@/admin/lib/admin-runtime", () => ({ useAdminRuntime: () => ({ live: false }) }));
vi.mock("@/admin/ui/admin-frame", () => ({
  AdminFrame: ({ children }: { children?: React.ReactNode }) => <main>{children}</main>
}));
// ConfirmDialog: триггер + кнопка явного подтверждения (radix-оверлей вне скоупа теста).
vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({ children, onConfirm, title, description }: {
    children?: React.ReactNode; onConfirm: () => void | Promise<void>; title: string; description?: React.ReactNode;
  }) => (
    <div>
      {children}
      <span data-testid="confirm-description">{description}</span>
      <button type="button" data-testid="confirm-issue" aria-label={title} onClick={() => void onConfirm()} />
    </div>
  )
}));
// Диалог токена: контролируемый open → простые контейнеры без портала.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="token-dialog">{children}</div> : null,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <div data-testid="token-dialog-description">{children}</div>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DialogTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>
}));

const TOKEN = "0f".repeat(32);
const EXPIRES_AT = "2026-07-19T12:00:00.000Z";

const user: WorkspaceUser = {
  id: "user-ivan",
  tenantId: "tenant-alpha",
  email: "ivan@kiss-pm.dev",
  name: "Иван Менеджер",
  accessProfileId: "role-manager",
  positionId: null,
  positionName: null,
  phone: null,
  telegram: null,
  status: "active",
  theme: "light",
  accentColor: "#0f766e"
};

describe("IssueResetTokenAction", () => {
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

  const triggerButton = () =>
    host.querySelector<HTMLButtonElement>('button[title="Выдать токен сброса пароля"]');

  it("после подтверждения показывает токен из ответа API и честный одноразовый текст", async () => {
    const issue = vi.fn(async () => ({ ok: true as const, data: { resetToken: TOKEN, expiresAt: EXPIRES_AT } }));
    await act(async () => {
      root.render(<IssueResetTokenAction user={user} busy={false} setBusy={vi.fn()} issue={issue} />);
    });

    expect(triggerButton()).not.toBeNull();
    expect(triggerButton()!.disabled).toBe(false);
    expect(host.querySelector('[data-testid="token-dialog"]')).toBeNull();
    // Подтверждение честно предупреждает про одноразовость ДО выдачи.
    expect(host.querySelector('[data-testid="confirm-description"]')!.textContent).toContain("показывается только один раз");

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="confirm-issue"]')!.click());

    expect(issue).toHaveBeenCalledWith("user-ivan");
    const dialog = host.querySelector('[data-testid="token-dialog"]');
    expect(dialog).not.toBeNull();
    expect(host.querySelector('[data-testid="reset-token-value"]')!.textContent).toBe(TOKEN);
    const description = host.querySelector('[data-testid="token-dialog-description"]')!.textContent!;
    expect(description).toContain("показывается один раз");
    expect(description).toContain("/password-reset/confirm");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("блокирует кнопку без права tenant.users.manage и объясняет причину", async () => {
    const issue = vi.fn(async () => ({ ok: false as const, message: "must_not_be_called" }));
    await act(async () => {
      root.render(
        <IssueResetTokenAction
          user={user}
          busy={false}
          setBusy={vi.fn()}
          issue={issue}
          disabledReason="Недостаточно прав для управления пользователями."
        />
      );
    });

    const button = host.querySelector<HTMLButtonElement>('button[title="Недостаточно прав для управления пользователями."]');
    expect(button).not.toBeNull();
    expect(button!.disabled).toBe(true);
    expect(issue).not.toHaveBeenCalled();
  });

  it("при ошибке API показывает toast и НЕ открывает диалог токена", async () => {
    const issue = vi.fn(async () => ({ ok: false as const, code: "user_not_found", message: "user_not_found" }));
    await act(async () => {
      root.render(<IssueResetTokenAction user={user} busy={false} setBusy={vi.fn()} issue={issue} />);
    });

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="confirm-issue"]')!.click());

    expect(host.querySelector('[data-testid="token-dialog"]')).toBeNull();
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
