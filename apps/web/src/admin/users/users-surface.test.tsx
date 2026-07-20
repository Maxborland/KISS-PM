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

import { EditUserDialog, InviteUserDialog, IssueResetTokenAction } from "./users-surface";
import type { AccessProfile, Position, WorkspaceUser } from "@/admin/lib/admin-client";

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
// FormDialog: рендерим триггер + поля + явную кнопку submit (портал-оверлей вне
// скоупа). submit зовёт onSubmit; при null-возврате (успех) — onSuccess.
vi.mock("@/components/domain/form-dialog", () => ({
  FormDialog: ({ children, trigger, onSubmit, onSuccess }: {
    children?: React.ReactNode; trigger?: React.ReactNode;
    onSubmit: () => Promise<string | null>; onSuccess?: () => void;
  }) => (
    <div>
      {trigger}
      {children}
      <button type="button" data-testid="form-submit" onClick={async () => { const e = await onSubmit(); if (e == null) onSuccess?.(); }} />
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

describe("InviteUserDialog", () => {
  let host: HTMLDivElement;
  let root: Root;
  const roles: AccessProfile[] = [{ id: "role-observer", tenantId: "tenant-alpha", name: "Наблюдатель", permissions: [] }];
  const positions: Position[] = [];

  function setInput(el: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  async function fill() {
    const inputs = [...host.querySelectorAll<HTMLInputElement>("input")];
    const email = inputs.find((i) => i.type === "email")!;
    const name = inputs.find((i) => i.type !== "email")!;
    await act(async () => { setInput(email, "invitee@kiss-pm.dev"); });
    await act(async () => { setInput(name, "Приглашённый"); });
  }

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

  it("при delivery:none показывает токен приглашения из ответа API один раз", async () => {
    const invite = vi.fn(async () => ({ ok: true as const, data: {
      user: { ...user, status: "inactive" as const }, delivery: "none" as const, invitationToken: TOKEN, expiresAt: EXPIRES_AT
    } }));
    await act(async () => {
      root.render(<InviteUserDialog roles={roles} positions={positions} busy={false} setBusy={vi.fn()} invite={invite} />);
    });
    await fill();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="form-submit"]')!.click());

    expect(invite).toHaveBeenCalledWith({ email: "invitee@kiss-pm.dev", name: "Приглашённый", accessProfileId: "role-observer", positionId: null });
    expect(host.querySelector('[data-testid="invitation-token-value"]')!.textContent).toBe(TOKEN);
    expect(host.querySelector('[data-testid="token-dialog-description"]')!.textContent).toContain("/invite/accept");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("при delivery:email показывает toast успеха и НЕ показывает токен", async () => {
    const invite = vi.fn(async () => ({ ok: true as const, data: {
      user: { ...user, status: "inactive" as const }, delivery: "email" as const
    } }));
    await act(async () => {
      root.render(<InviteUserDialog roles={roles} positions={positions} busy={false} setBusy={vi.fn()} invite={invite} />);
    });
    await fill();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="form-submit"]')!.click());

    expect(host.querySelector('[data-testid="invitation-token-value"]')).toBeNull();
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  it("при ошибке API возвращает код ошибки и НЕ показывает токен", async () => {
    const invite = vi.fn(async () => ({ ok: false as const, code: "user_email_taken", message: "user_email_taken" }));
    await act(async () => {
      root.render(<InviteUserDialog roles={roles} positions={positions} busy={false} setBusy={vi.fn()} invite={invite} />);
    });
    await fill();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="form-submit"]')!.click());

    expect(host.querySelector('[data-testid="invitation-token-value"]')).toBeNull();
  });
});

describe("EditUserDialog: редактированный каталог (privateFieldsIncluded:false)", () => {
  it("рендерится без краха для redacted-строки (name/email/accessProfileId undefined)", async () => {
    // Роль с админ-правом, но без tenant.users.read читает каталог через
    // project-plan fallback — строки без приватных полей. Диалог не должен падать
    // на name.trim()/accessProfileId.length (ревью #263).
    const redacted = {
      id: "user-x", tenantId: "tenant-alpha",
      email: undefined, name: undefined, accessProfileId: undefined,
      positionId: null, positionName: null, phone: null, telegram: null,
      status: "active", theme: "light", accentColor: "#0f766e"
    } as unknown as WorkspaceUser;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    // Регресс-гвард: до фикса `valid = name.trim()... accessProfileId.length` бросал
    // TypeError прямо в рендере — тогда act() ниже зареджектился бы. Успешный
    // рендер = баг закрыт.
    let renderError: unknown = null;
    await act(async () => {
      try {
        root.render(<EditUserDialog user={redacted} roles={[]} positions={[]} busy={false} setBusy={vi.fn()} update={vi.fn()} />);
      } catch (error) {
        renderError = error;
      }
    });
    expect(renderError).toBeNull();
    await act(async () => { root.unmount(); });
    host.remove();
  });
});
