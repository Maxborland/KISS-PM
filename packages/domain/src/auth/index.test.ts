import { describe, expect, it } from "vitest";
import {
  PASSWORD_POLICY,
  parsePassword,
  parseRegistrationInput,
  parseResetConfirmInput,
  parseResetRequestInput
} from "./index";

describe("парольная политика", () => {
  it("фиксирует границы длины пароля", () => {
    expect(PASSWORD_POLICY).toEqual({ minLength: 8, maxLength: 1024 });
  });
});

describe("parsePassword", () => {
  it("принимает пароль валидной длины", () => {
    expect(parsePassword("correct horse")).toEqual({
      ok: true,
      value: "correct horse"
    });
  });

  it("отклоняет короткий пароль", () => {
    expect(parsePassword("short")).toEqual({ ok: false, error: "weak_password" });
  });

  it("отклоняет слишком длинный пароль", () => {
    expect(parsePassword("a".repeat(PASSWORD_POLICY.maxLength + 1))).toEqual({
      ok: false,
      error: "weak_password"
    });
  });

  it("отклоняет управляющие символы и нестроки", () => {
    // \t — табуляция (управляющий символ), пароль достаточной длины во всём остальном.
    expect(parsePassword("passwor\td")).toEqual({
      ok: false,
      error: "weak_password"
    });
    expect(parsePassword(12345678)).toEqual({ ok: false, error: "weak_password" });
    expect(parsePassword(undefined)).toEqual({ ok: false, error: "weak_password" });
  });
});

describe("parseRegistrationInput", () => {
  it("нормализует email и имя при успехе", () => {
    expect(
      parseRegistrationInput({
        email: "  Owner@Example.COM ",
        password: "supersecret",
        name: "  Иван Владелец  ",
        workspaceName: "  Бюро Север  "
      })
    ).toEqual({
      ok: true,
      value: {
        email: "owner@example.com",
        password: "supersecret",
        name: "Иван Владелец",
        workspaceName: "Бюро Север"
      }
    });
  });

  it("отклоняет некорректную структуру/email/name до проверки пароля", () => {
    expect(parseRegistrationInput(null)).toEqual({
      ok: false,
      error: "invalid_registration_payload"
    });
    expect(parseRegistrationInput([])).toEqual({
      ok: false,
      error: "invalid_registration_payload"
    });
    expect(
      parseRegistrationInput({ email: "not-an-email", password: "supersecret", name: "Имя" })
    ).toEqual({ ok: false, error: "invalid_registration_payload" });
    // Пустое имя и слабый пароль одновременно — приоритет у структуры (имя).
    expect(
      parseRegistrationInput({ email: "owner@example.com", password: "short", name: "" })
    ).toEqual({ ok: false, error: "invalid_registration_payload" });
    // Управляющий символ в имени → invalid_registration_payload.
    expect(
      parseRegistrationInput({
        email: "owner@example.com",
        password: "supersecret",
        name: "\u0001byte-name"
      })
    ).toEqual({ ok: false, error: "invalid_registration_payload" });
  });

  it("сообщает weak_password при валидной структуре, но слабом пароле", () => {
    expect(
      parseRegistrationInput({ email: "owner@example.com", password: "short", name: "Имя" })
    ).toEqual({ ok: false, error: "weak_password" });
  });
});

describe("parseResetConfirmInput", () => {
  it("принимает hex-подобный токен и валидный пароль", () => {
    expect(
      parseResetConfirmInput({ token: "abcdef0123456789", password: "supersecret" })
    ).toEqual({
      ok: true,
      value: { token: "abcdef0123456789", password: "supersecret" }
    });
  });

  it("отклоняет пустой/слишком длинный/нехекс токен", () => {
    expect(parseResetConfirmInput({ token: "", password: "supersecret" })).toEqual({
      ok: false,
      error: "invalid_reset_confirm_payload"
    });
    expect(
      parseResetConfirmInput({ token: "a".repeat(257), password: "supersecret" })
    ).toEqual({ ok: false, error: "invalid_reset_confirm_payload" });
    expect(
      parseResetConfirmInput({ token: "not a token!", password: "supersecret" })
    ).toEqual({ ok: false, error: "invalid_reset_confirm_payload" });
    expect(parseResetConfirmInput({ password: "supersecret" })).toEqual({
      ok: false,
      error: "invalid_reset_confirm_payload"
    });
  });

  it("сообщает weak_password при валидном токене, но слабом пароле", () => {
    expect(parseResetConfirmInput({ token: "abcdef", password: "short" })).toEqual({
      ok: false,
      error: "weak_password"
    });
  });
});

describe("parseResetRequestInput", () => {
  it("принимает и нормализует email", () => {
    expect(parseResetRequestInput({ email: " User@Example.com " })).toEqual({
      ok: true,
      value: { email: "user@example.com" }
    });
  });

  it("отклоняет некорректный email", () => {
    expect(parseResetRequestInput({ email: "not-an-email" })).toEqual({
      ok: false,
      error: "invalid_email"
    });
    expect(parseResetRequestInput(null)).toEqual({ ok: false, error: "invalid_email" });
    expect(parseResetRequestInput({})).toEqual({ ok: false, error: "invalid_email" });
  });
});
