// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

import { applyDocumentTheme, readDocumentTheme, subscribeDocumentTheme } from "./document-theme";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("--accent");
});

describe("document theme", () => {
  it("treats absent and invalid values as light", () => {
    expect(readDocumentTheme()).toBe("light");
    document.documentElement.dataset.theme = "system";
    expect(readDocumentTheme()).toBe("light");
  });

  it("applies only valid profile theme and accent values", () => {
    applyDocumentTheme({ theme: "dark", accentColor: "#5B5BD6" });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#5b5bd6");

    applyDocumentTheme({ theme: "system", accentColor: "red" });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#5b5bd6");
  });

  it("notifies subscribers for external data-theme mutations and unsubscribes cleanly", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDocumentTheme(listener);

    document.documentElement.dataset.theme = "dark";
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));

    unsubscribe();
    document.documentElement.dataset.theme = "light";
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
