// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginScreenView } from "@/views/screens/login-screen-view";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("LoginScreenView", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it("calls onSubmit with entered credentials when provided", () => {
    const onSubmit = vi.fn();
    act(() => {
      root.render(<LoginScreenView defaultEmail="admin@kiss-pm.local" onSubmit={onSubmit} />);
    });

    const email = host.querySelector<HTMLInputElement>("input[name='email']")!;
    const password = host.querySelector<HTMLInputElement>("input[name='password']")!;
    const form = host.querySelector<HTMLFormElement>("form")!;

    act(() => {
      email.value = "manager@kiss-pm.local";
      email.dispatchEvent(new Event("input", { bubbles: true }));
      password.value = "secret";
      password.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledWith({
      email: "manager@kiss-pm.local",
      password: "secret"
    });
  });

  it("keeps Storybook/demo submit safe when onSubmit is not provided", () => {
    act(() => {
      root.render(<LoginScreenView />);
    });

    const form = host.querySelector<HTMLFormElement>("form")!;
    const event = new Event("submit", { bubbles: true, cancelable: true });

    act(() => {
      form.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });
});
