"use client";

import { useSyncExternalStore } from "react";

export type DocumentTheme = "light" | "dark";

type ThemeInput = {
  theme?: unknown;
  accentColor?: unknown;
};

const accentPattern = /^#[0-9a-fA-F]{6}$/;

function documentRoot() {
  return typeof document === "undefined" ? null : document.documentElement;
}

export function readDocumentTheme(root: HTMLElement | null = documentRoot()): DocumentTheme {
  return root?.dataset.theme === "dark" ? "dark" : "light";
}

export function applyDocumentTheme(input: ThemeInput, root: HTMLElement | null = documentRoot()) {
  if (!root) return;
  if (input.theme === "dark" || input.theme === "light") root.dataset.theme = input.theme;
  if (typeof input.accentColor === "string" && accentPattern.test(input.accentColor)) {
    root.style.setProperty("--accent", input.accentColor.toLowerCase());
  }
}

export function subscribeDocumentTheme(
  listener: () => void,
  root: HTMLElement | null = documentRoot()
) {
  if (!root || typeof MutationObserver === "undefined") return () => {};
  const observer = new MutationObserver(listener);
  observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function useDocumentTheme(): DocumentTheme {
  return useSyncExternalStore(
    subscribeDocumentTheme,
    () => readDocumentTheme(),
    () => "light"
  );
}
