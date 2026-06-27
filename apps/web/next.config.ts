import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiOrigin = process.env.KISS_PM_API_ORIGIN ?? "http://127.0.0.1:4000";
const webDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(webDir, "../..");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  transpilePackages: ["@kiss-pm/domain"],
  turbopack: {
    root: repoRoot
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
