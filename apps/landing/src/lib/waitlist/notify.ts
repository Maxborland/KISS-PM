import type { WaitlistSubmissionParsed } from "./schema";

/**
 * Notification side of the waitlist pipeline. Falls back to console logging
 * when RESEND_API_KEY is empty so local dev never depends on the network.
 */

export interface NotifyResult {
  channel: "resend" | "console";
  ok: boolean;
  detail?: string;
}

type ResendNotificationPayload = Pick<WaitlistSubmissionParsed, "email" | "fullName" | "role">;

export async function notifyTeam(input: WaitlistSubmissionParsed): Promise<NotifyResult> {
  const key = process.env["RESEND_API_KEY"]?.trim();
  const to = process.env["RESEND_NOTIFY_TO"]?.trim();
  const from = process.env["RESEND_FROM"]?.trim() || "KISS PM <noreply@kiss-pm.app>";

  if (!key || !to) {
    console.info("[waitlist] new submission (console fallback)", {
      email: input.email,
      fullName: input.fullName,
      company: input.company,
      role: input.role,
      companySize: input.companySize,
    });
    return { channel: "console", ok: true };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(key);
    const result = await resend.emails.send({
      from,
      to,
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

function renderText(s: ResendNotificationPayload): string {
  return [
    `Имя: ${s.fullName}`,
    `Email: ${s.email}`,
    `Роль: ${s.role}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function renderHtml(s: ResendNotificationPayload): string {
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
        ${row("Роль", s.role)}
      </table>
    </div>
  `;
}
