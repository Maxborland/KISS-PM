import type { APIRoute } from "astro";
import { WaitlistSubmission } from "../../lib/waitlist/schema";
import { insertSubmission } from "../../lib/waitlist/db";
import { readEnv } from "../../lib/waitlist/env";
import { notifyTeam } from "../../lib/waitlist/notify";
import { rateLimit } from "../../lib/waitlist/ratelimit";
import { hashIp } from "../../lib/waitlist/hash";

export const prerender = false;

const ALLOWED_ORIGINS = (readEnv("WAITLIST_ALLOWED_ORIGINS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Origin allowlist (only enforced in production-style deployments).
  if (ALLOWED_ORIGINS.length > 0) {
    const origin = request.headers.get("origin") || "";
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return json({ ok: false, error: "origin_not_allowed" }, 403);
    }
  }

  const ip = clientAddress || request.headers.get("x-forwarded-for") || "";
  const rl = rateLimit(`waitlist:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return json(
      { ok: false, error: "rate_limited", retryInMs: rl.retryInMs },
      429,
    );
  }

  let payload: unknown;
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else {
      const form = await request.formData();
      payload = Object.fromEntries(form.entries());
    }
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  const parsed = WaitlistSubmission.safeParse(payload);
  if (!parsed.success) {
    return json(
      {
        ok: false,
        error: "validation_error",
        issues: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const insertion = insertSubmission(parsed.data, {
    ipHash: hashIp(ip),
    userAgent: request.headers.get("user-agent")?.slice(0, 240) ?? null,
  });

  if (insertion.status === "duplicate") {
    // Treat as success so we don't leak which emails are already registered.
    return json({ ok: true, status: "received" });
  }

  // Fire-and-forget; the database insertion is the source of truth.
  // Каналы резолвятся { ok: false } при сбое (не реджектятся) — логируем каждый.
  notifyTeam(parsed.data)
    .then((results) => {
      for (const result of results) {
        if (!result.ok) {
          console.warn("[waitlist] notify failed", {
            channel: result.channel,
            detail: result.detail,
          });
        }
      }
    })
    .catch((err: unknown) => {
      console.warn("[waitlist] notify failed", err);
    });

  return json({ ok: true, status: "received" });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
