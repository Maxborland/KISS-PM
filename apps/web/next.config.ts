import type { NextConfig } from "next";

const apiOrigin = process.env.KISS_PM_API_ORIGIN ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
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
