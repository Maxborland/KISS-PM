import { describe, expect, it } from "vitest";

import { appUrl } from "./app-url";

describe("appUrl", () => {
  it("строит auth-ссылки из PUBLIC_APP_URL без localhost и двойных слешей", () => {
    expect(appUrl("/login", "https://app.kiss-pm.example/")).toBe("https://app.kiss-pm.example/login");
    expect(appUrl("/register", "")).toBe("/register");
  });
});
