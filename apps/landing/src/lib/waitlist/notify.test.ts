import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyTeam } from "./notify";
import type { WaitlistSubmissionParsed } from "./schema";

const SUBMISSION: WaitlistSubmissionParsed = {
  fullName: "Анна Каренина",
  email: "anna@severdev.ru",
  company: "Север Девелопмент",
  role: "PMO Lead",
  companySize: "mid",
  context: undefined,
  consent: true,
  hp: "",
};

function clearChannelEnv(): void {
  for (const key of [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "RESEND_API_KEY",
    "RESEND_NOTIFY_TO",
  ]) {
    vi.stubEnv(key, "");
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("notifyTeam", () => {
  it("falls back to console when no channels configured", async () => {
    clearChannelEnv();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const results = await notifyTeam(SUBMISSION);

    expect(results).toEqual([{ channel: "console", ok: true }]);
    expect(info).toHaveBeenCalledOnce();
  });

  it("posts the submission to Telegram when configured", async () => {
    clearChannelEnv();
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "-100500");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await notifyTeam(SUBMISSION);

    expect(results).toEqual([{ channel: "telegram", ok: true }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendMessage");
    const body = JSON.parse(String(init.body)) as { chat_id: string; text: string };
    expect(body.chat_id).toBe("-100500");
    expect(body.text).toContain("anna@severdev.ru");
    expect(body.text).toContain("30–50 проектов");
  });

  it("reports a Telegram API error as ok:false with detail", async () => {
    clearChannelEnv();
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "42");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ ok: false, description: "Forbidden: bot was blocked" }),
      }),
    );

    const results = await notifyTeam(SUBMISSION);

    expect(results).toEqual([
      { channel: "telegram", ok: false, detail: "Forbidden: bot was blocked" },
    ]);
  });
});
