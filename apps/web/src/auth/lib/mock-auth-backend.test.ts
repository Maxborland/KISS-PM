import { describe, it, expect } from "vitest";

import { AuthApiError, createAuthClient } from "./auth-client";
import { createMockAuthFetch } from "./mock-auth-backend";

// Каждый тест — свой мок (изолированная in-memory сессия, как на монтаже).
function client() {
  return createAuthClient({ apiOrigin: "", fetchImpl: createMockAuthFetch() });
}

const ADMIN = "admin@kiss-pm.local";
const ADMIN_PASSWORD = "kiss-pm-admin";

describe("contract-mock Auth backend", () => {
  /* ===== login (БОЕВОЙ) ===== */

  it("logs in with seeded credentials → 200 user + workspace, sets session", async () => {
    const c = client();
    const res = await c.login(ADMIN, ADMIN_PASSWORD);
    expect(res.user.id).toBe("u-admin");
    expect(res.user.tenantId).toBe("tenant-alpha");
    expect(res.workspace.id).toBe("tenant-alpha");
    // login отдаёт усечённый TenantUser — без email-поля.
    expect("email" in res.user).toBe(false);
    // сессия выставлена → me доступен.
    const me = await c.me();
    expect(me.user.id).toBe("u-admin");
  });

  it("returns the SAME 401 invalid_credentials for wrong password and unknown email (anti-enumeration)", async () => {
    const c1 = client();
    await expect(c1.login(ADMIN, "wrong-password")).rejects.toMatchObject({ status: 401, code: "invalid_credentials" });
    const c2 = client();
    await expect(c2.login("ghost@kiss-pm.local", "whatever")).rejects.toMatchObject({ status: 401, code: "invalid_credentials" });
  });

  it("rejects login for an inactive user → 403 user_inactive", async () => {
    const c = client();
    await expect(c.login("inactive@kiss-pm.local", "kiss-pm-inactive")).rejects.toMatchObject({ status: 403, code: "user_inactive" });
  });

  it("rate-limits repeated failures → 429 too_many_login_attempts after N", async () => {
    const c = client();
    // RL_MAX_FAILURES = 3 (демо-окно): 3 неудачи дают 401, 4-я — 429.
    await expect(c.login(ADMIN, "x")).rejects.toMatchObject({ status: 401, code: "invalid_credentials" });
    await expect(c.login(ADMIN, "x")).rejects.toMatchObject({ status: 401, code: "invalid_credentials" });
    await expect(c.login(ADMIN, "x")).rejects.toMatchObject({ status: 401, code: "invalid_credentials" });
    await expect(c.login(ADMIN, "x")).rejects.toMatchObject({ status: 429, code: "too_many_login_attempts" });
  });

  it("rejects a malformed login payload → 400 invalid_login_payload", async () => {
    const c = client();
    await expect(c.login("not-an-email", ADMIN_PASSWORD)).rejects.toMatchObject({ status: 400, code: "invalid_login_payload" });
    await expect(c.login(ADMIN, "")).rejects.toMatchObject({ status: 400, code: "invalid_login_payload" });
  });

  /* ===== me / logout (БОЕВОЙ) ===== */

  it("me without a session → 401 session_required; with a session → 200", async () => {
    const c = client();
    await expect(c.me()).rejects.toMatchObject({ status: 401, code: "session_required" });
    await c.login(ADMIN, ADMIN_PASSWORD);
    const me = await c.me();
    expect("email" in me.user).toBe(true); // me отдаёт полный WorkspaceUser
    expect(me.permissions.length).toBeGreaterThan(0);
    expect(me.workspace.id).toBe("tenant-alpha");
  });

  it("logout → 200 and afterwards me is 401 again", async () => {
    const c = client();
    await c.login(ADMIN, ADMIN_PASSWORD);
    const out = await c.logout();
    expect(out.status).toBe("ok");
    await expect(c.me()).rejects.toMatchObject({ status: 401, code: "session_required" });
  });

  /* ===== профиль: PATCH /api/profile (БОЕВОЙ, name/phone/telegram) ===== */

  it("PATCH /api/profile updates name/phone/telegram → 200 with the updated user", async () => {
    const c = client();
    await c.login(ADMIN, ADMIN_PASSWORD);
    const updated = await c.updateProfile({ name: "Новое имя", phone: "+7 999 111-22-33", telegram: "@new_handle" });
    expect(updated.user.name).toBe("Новое имя");
    expect(updated.user.phone).toBe("+7 999 111-22-33");
    expect(updated.user.telegram).toBe("@new_handle");
    // theme/accentColor этой ручкой НЕ трогаются (остаются сидовыми light / #0f766e).
    expect(updated.user.theme).toBe("light");
    expect(updated.user.accentColor).toBe("#0f766e");
  });

  it("PATCH /api/profile clears phone/telegram with empty string → null", async () => {
    const c = client();
    await c.login(ADMIN, ADMIN_PASSWORD);
    const updated = await c.updateProfile({ phone: "", telegram: "" });
    expect(updated.user.phone).toBeNull();
    expect(updated.user.telegram).toBeNull();
  });

  it("PATCH /api/profile keeps the current name when an empty name is sent", async () => {
    const c = client();
    const before = await c.login(ADMIN, ADMIN_PASSWORD);
    const updated = await c.updateProfile({ name: "   " });
    // пустое после trim → имя не меняется (остаётся сидовым).
    expect(updated.user.name).toBe(before.user.name);
  });

  it("PATCH /api/profile rejects any invalid field with the single 400 invalid_profile_payload", async () => {
    const c = client();
    await c.login(ADMIN, ADMIN_PASSWORD);
    // name 121 символ (> лимит 120) → единый код.
    await expect(c.updateProfile({ name: "x".repeat(121) })).rejects.toMatchObject({ status: 400, code: "invalid_profile_payload" });
    // phone 65 символов (> лимит 64) → единый код.
    await expect(c.updateProfile({ phone: "1".repeat(65) })).rejects.toMatchObject({ status: 400, code: "invalid_profile_payload" });
    // не string → единый код.
    await expect(c.updateProfile({ telegram: 123 as never })).rejects.toMatchObject({ status: 400, code: "invalid_profile_payload" });
  });

  it("PATCH /api/profile without a session → 401 session_required", async () => {
    const anon = client();
    await expect(anon.updateProfile({ name: "Без сессии" })).rejects.toMatchObject({ status: 401, code: "session_required" });
  });

  /* ===== профиль: PATCH /api/profile/theme (БОЕВОЙ, theme/accentColor) ===== */

  it("PATCH /api/profile/theme updates theme/accentColor (accent lowercased)", async () => {
    const c = client();
    await c.login(ADMIN, ADMIN_PASSWORD);
    const updated = await c.updateTheme({ theme: "dark", accentColor: "#123ABC" });
    expect(updated.user.theme).toBe("dark");
    expect(updated.user.accentColor).toBe("#123abc"); // toLowerCase
  });

  it("PATCH /api/profile/theme rejects 'system' theme → 400 invalid_theme", async () => {
    const c = client();
    await c.login(ADMIN, ADMIN_PASSWORD);
    await expect(c.updateTheme({ theme: "system" as never })).rejects.toMatchObject({ status: 400, code: "invalid_theme" });
  });

  it("PATCH /api/profile/theme rejects an invalid accent → 400 invalid_accent_color", async () => {
    const c = client();
    await c.login(ADMIN, ADMIN_PASSWORD);
    await expect(c.updateTheme({ accentColor: "red" })).rejects.toMatchObject({ status: 400, code: "invalid_accent_color" });
  });

  it("PATCH /api/profile/theme keeps current theme/accent when fields are empty/absent", async () => {
    const c = client();
    await c.login(ADMIN, ADMIN_PASSWORD);
    const updated = await c.updateTheme({});
    expect(updated.user.theme).toBe("light");
    expect(updated.user.accentColor).toBe("#0f766e");
  });

  it("PATCH /api/profile/theme without a session → 401 session_required", async () => {
    const anon = client();
    await expect(anon.updateTheme({ theme: "dark" })).rejects.toMatchObject({ status: 401, code: "session_required" });
  });

  /* ===== register (БОЕВОЙ: самрегистрация нового тенанта) ===== */

  it("registers a new user → 201 with a FRESH tenant and auto-login", async () => {
    const c = client();
    const res = await c.register({ email: "new@kiss-pm.local", password: "supersecret", name: "Новый Пользователь" });
    // Самрегистрация создаёт СВЕЖИЙ тенант: workspace.id != фикс TENANT и != тенанта сид-админа.
    expect(res.workspace.id).not.toBe("tenant-alpha");
    expect(res.user.tenantId).toBe(res.workspace.id); // пользователь принадлежит новому тенанту
    expect(res.workspace.id).toMatch(/^tenant-/); // формат боевого нового тенанта
    // авто-логин: me доступен сразу после регистрации, в новом тенанте.
    const me = await c.me();
    expect(me.user.id).toBe(res.user.id);
    expect(me.workspace.id).toBe(res.workspace.id);
  });

  it("rejects register for a taken email → 409 email_taken", async () => {
    const c = client();
    await expect(c.register({ email: ADMIN, password: "supersecret", name: "Дубль" })).rejects.toMatchObject({ status: 409, code: "email_taken" });
  });

  it("rejects register with a weak password → 400 weak_password", async () => {
    const c = client();
    await expect(c.register({ email: "weak@kiss-pm.local", password: "short", name: "Слабый" })).rejects.toMatchObject({ status: 400, code: "weak_password" });
  });

  it("rejects register with an invalid payload → 400 invalid_registration_payload", async () => {
    const c = client();
    await expect(c.register({ email: "not-an-email", password: "supersecret", name: "Имя" })).rejects.toMatchObject({ status: 400, code: "invalid_registration_payload" });
    await expect(c.register({ email: "ok2@kiss-pm.local", password: "supersecret", name: "" })).rejects.toMatchObject({ status: 400, code: "invalid_registration_payload" });
  });

  /* ===== password-reset request (БОЕВОЙ, anti-enumeration) ===== */

  it("reset request always returns 202 ok, even for an unknown email (anti-enumeration)", async () => {
    const c = client();
    const known = await c.requestPasswordReset(ADMIN);
    expect(known.status).toBe("ok");
    const unknown = await c.requestPasswordReset("nobody@kiss-pm.local");
    expect(unknown.status).toBe("ok");
  });

  it("reset request rejects a malformed email → 400 invalid_email", async () => {
    const c = client();
    await expect(c.requestPasswordReset("not-an-email")).rejects.toMatchObject({ status: 400, code: "invalid_email" });
  });

  /* ===== password-reset confirm (БОЕВОЙ) ===== */

  it("confirms a reset with the seeded valid token → 200 ok", async () => {
    const c = client();
    const res = await c.confirmPasswordReset("a".repeat(64), "brand-new-password");
    expect(res.status).toBe("ok");
  });

  it("rejects confirm for invalid / expired / used tokens and a weak password → 400", async () => {
    const c1 = client();
    await expect(c1.confirmPasswordReset("d".repeat(64), "brand-new-password")).rejects.toMatchObject({ status: 400, code: "invalid_reset_token" });
    const c2 = client();
    await expect(c2.confirmPasswordReset("b".repeat(64), "brand-new-password")).rejects.toMatchObject({ status: 400, code: "token_expired" });
    const c3 = client();
    await expect(c3.confirmPasswordReset("c".repeat(64), "brand-new-password")).rejects.toMatchObject({ status: 400, code: "reset_token_used" });
    const c4 = client();
    await expect(c4.confirmPasswordReset("a".repeat(64), "short")).rejects.toMatchObject({ status: 400, code: "weak_password" });
  });

  it("changes the password so the old one fails and the new one logs in", async () => {
    // ОДИН мок (изолированная сессия): смена пароля видна только внутри своего in-memory store.
    const c = client();
    const newPassword = "rotated-password-123";
    await c.confirmPasswordReset("a".repeat(64), newPassword); // u-admin → новый пароль
    await expect(c.login(ADMIN, ADMIN_PASSWORD)).rejects.toMatchObject({ status: 401, code: "invalid_credentials" });
    const ok = await c.login(ADMIN, newPassword);
    expect(ok.user.id).toBe("u-admin");
  });

  it("throws AuthApiError instances carrying status, code and body", async () => {
    const c = client();
    await c.login(ADMIN, "wrong").catch((e: unknown) => {
      expect(e).toBeInstanceOf(AuthApiError);
      expect((e as AuthApiError).status).toBe(401);
      expect((e as AuthApiError).body).toMatchObject({ error: "invalid_credentials" });
    });
  });
});
