import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import node from "@astrojs/node";

// KISS PM Landing — SSR with node adapter so /api/waitlist can write SQLite.
// Static-only pages are still pre-rendered via `export const prerender = true`.
export default defineConfig({
  site: "https://kiss-pm.app",
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react(), mdx()],
  devToolbar: { enabled: false },
  server: { host: "127.0.0.1", port: 4321 },
  vite: {
    optimizeDeps: {
      exclude: ["better-sqlite3"],
    },
    ssr: {
      noExternal: [],
      external: ["better-sqlite3"],
    },
  },
});
