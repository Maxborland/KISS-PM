import type { WaitlistSubmissionParsed } from "./schema";
import { COMPANY_SIZE_LABELS } from "./schema";

/**
 * Notification side of the waitlist pipeline. Channels are independent:
 * Telegram and Resend fire in parallel when configured; with neither
 * configured we fall back to console logging so local dev never depends
 * on the network. The SQLite insert stays the source of truth.
 */

export interface NotifyResult {
  channel: "resend" | "console" | "telegram";
  ok: boolean;
  detail?: string;
}

export async function notifyTeam(input: WaitlistSubmissionParsed): Promise<NotifyResult[]> {
  const tasks: Array<Promise<NotifyResult>> = [];

  if (telegramConfig()) tasks.push(notifyTelegram(input));
  if (resendConfig()) tasks.push(notifyResend(input));

  if (tasks.length === 0) {
    console.info("[waitlist] new submission (console fallback)", {
      email: input.email,
      fullName: input.fullName,
      company: input.company,
      role: input.role,
      companySize: input.companySize,
    });
    return [{ channel: "console", ok: true }];
  }

  return Promise.all(tasks);
}

/* -------- Telegram -------- */

function telegramConfig(): { token: string; chatId: string } | null {
  const token = process.env["TELEGRAM_BOT_TOKEN"]?.trim();
  const chatId = process.env["TELEGRAM_CHAT_ID"]?.trim();
  return token && chatId ? { token, chatId } : null;
}

async function notifyTelegram(input: WaitlistSubmissionParsed): Promise<NotifyResult> {
  const config = telegramConfig();
  if (!config) return { channel: "telegram", ok: false, detail: "not configured" };

  try {
    const res = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: renderTelegramText(input),
      }),
      signal: AbortSignal.timeout(6000),
    });

    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
    } | null;

    if (!res.ok || json?.ok === false) {
      return {
        channel: "telegram",
        ok: false,
        detail: json?.description ?? `HTTP ${res.status}`,
      };
    }
    return { channel: "telegram", ok: true };
  } catch (err: unknown) {
    return {
      channel: "telegram",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function renderTelegramText(s: WaitlistSubmissionParsed): string {
  return [
    "🆕 Заявка в альфу KISS PM",
    "",
    `Имя: ${s.fullName}`,
    `Email: ${s.email}`,
    `Компания: ${s.company}`,
    `Роль: ${s.role}`,
    `Портфель: ${COMPANY_SIZE_LABELS[s.companySize]}`,
    s.context ? `Контекст: ${s.context}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/* -------- Resend -------- */

function resendConfig(): { key: string; to: string; from: string } | null {
  const key = process.env["RESEND_API_KEY"]?.trim();
  const to = process.env["RESEND_NOTIFY_TO"]?.trim();
  const from = process.env["RESEND_FROM"]?.trim() || "KISS PM <noreply@kiss-pm.app>";
  return key && to ? { key, to, from } : null;
}

async function notifyResend(input: WaitlistSubmissionParsed): Promise<NotifyResult> {
  const config = resendConfig();
  if (!config) return { channel: "resend", ok: false, detail: "not configured" };

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(config.key);
    const result = await resend.emails.send({
      from: config.from,
      to: config.to,
      subject: `KISS PM · заявка в альфу: ${input.fullName}`,
      text: renderText(input),
      html: renderHtml(input),
    });
    if ("error" in result && result.error) {
      return { channel: "resend", ok: false, detail: String(result.error.message ?? result.error) };
    }
    return { channel: "resend", ok: true };
  } catch (err: unknown) {
    return {
      channel: "resend",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function renderText(s: WaitlistSubmissionParsed): string {
  return [
    `Имя: ${s.fullName}`,
    `Email: ${s.email}`,
    `Компания: ${s.company}`,
    `Роль: ${s.role}`,
    `Активных проектов: ${COMPANY_SIZE_LABELS[s.companySize]}`,
    s.context ? `Контекст: ${s.context}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function renderHtml(s: WaitlistSubmissionParsed): string {
  const safe = (v: string) =>
    v.replace(/[&<>"]/g, (c) =>
      c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
    );
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 12px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">${k}</td><td style="padding:6px 12px;color:#0f172a;font-weight:600;">${safe(v)}</td></tr>`;
  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;">
      <table style="background:#fff;border:1px solid #e6e8ee;border-radius:14px;border-collapse:separate;overflow:hidden;">
        <tr><td colspan="2" style="padding:18px 20px;background:linear-gradient(135deg,#2563eb,#6366f1);color:#fff;font-weight:700;font-family:Inter Tight,Inter,sans-serif;">KISS PM · заявка в альфу</td></tr>
        ${row("Имя", s.fullName)}
        ${row("Email", s.email)}
        ${row("Компания", s.company)}
        ${row("Роль", s.role)}
        ${row("Активных проектов", COMPANY_SIZE_LABELS[s.companySize])}
        ${s.context ? row("Контекст", s.context) : ""}
      </table>
    </div>
  `;
}
