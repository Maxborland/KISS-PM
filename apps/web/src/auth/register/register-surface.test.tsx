// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RegisterSurface } from "./register-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const authMock = vi.hoisted(() => ({
  register: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() })
}));

vi.mock("@/auth/lib/use-auth", () => ({
  useAuth: () => ({
    state: "anonymous",
    user: null,
    register: authMock.register
  })
}));

function setInput(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(selector);
  expect(input).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input?.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("RegisterSurface", () => {
  let root: Root;

  beforeEach(async () => {
    authMock.register.mockReset().mockResolvedValue({ ok: true });
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(<RegisterSurface />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("создаёт новый workspace с отдельными именами workspace и владельца", async () => {
    await act(async () => {
      setInput('input[placeholder="Бюро Север"]', "  Бюро Север  ");
      setInput('input[placeholder="Иван Иванов"]', "  Иван Владелец  ");
      setInput('input[type="email"]', " owner@example.com ");
      setInput('#register-password', "supersecret");
    });

    await act(async () => {
      document.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(authMock.register).toHaveBeenCalledWith({
      workspaceName: "Бюро Север",
      name: "Иван Владелец",
      email: "owner@example.com",
      password: "supersecret"
    });
  });
});
