import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiOrigin = process.env.KISS_PM_API_ORIGIN ?? "http://127.0.0.1:4000";
const webDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(webDir, "../..");

// Разрешительный, но осмысленный CSP: Next требует 'unsafe-inline' для стилей и
// 'unsafe-eval'/inline-скриптов рантайма; SSE/fetch к /api того же origin; шрифты и
// картинки как data:/blob:. Цель — заголовки присутствуют, приложение не ломается.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // wss:/https: — сигналинг LiveKit/медиа-плоскость на отдельном хосте (KISS_PM_VIDEO_LIVEKIT_URL);
  // без них room.connect(joinUrl) блокируется CSP. self покрывает SSE/fetch к /api того же origin.
  "connect-src 'self' https: wss:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy }
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  transpilePackages: ["@kiss-pm/domain", "@kiss-pm/planning-client"],
  turbopack: {
    root: repoRoot
  },
  async headers() {
    // Security-заголовки (в т.ч. строгий CSP) — только в production. В dev Next
    // Fast Refresh/overlay/HMR-websocket конфликтуют с CSP и ломают гидрацию
    // (логин-форма не рендерится); e2e гоняется на dev-сервере, поэтому в dev
    // заголовки не навешиваем. Прод-образ (NODE_ENV=production) их отдаёт.
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`
      },
      {
        source: "/health",
        destination: `${apiOrigin}/health`
      }
    ];
  }
};

export default nextConfig;
