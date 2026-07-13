/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyDocumentTheme } from "@/lib/document-theme";
import { Toaster } from "./sonner";

vi.mock("sonner", () => ({
  Toaster: ({ theme }: { theme: string }) => <div data-testid="sonner" data-theme-prop={theme} />
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.documentElement.removeAttribute("data-theme");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Toaster />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.documentElement.removeAttribute("data-theme");
});

describe("Sonner document theme integration", () => {
  it("tracks live data-theme mutations without a second provider", async () => {
    expect(host.querySelector('[data-testid="sonner"]')?.getAttribute("data-theme-prop")).toBe("light");

    await act(async () => {
      applyDocumentTheme({ theme: "dark" });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(host.querySelector('[data-testid="sonner"]')?.getAttribute("data-theme-prop")).toBe("dark");
  });
});
