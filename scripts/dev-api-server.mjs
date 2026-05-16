import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

const outdir = join("/tmp", "kiss-pm-dev-api");
const outfile = join(outdir, "server.mjs");

mkdirSync(outdir, { recursive: true });

await build({
  absWorkingDir: process.cwd(),
  bundle: true,
  entryPoints: ["src/server.ts"],
  format: "esm",
  outfile,
  platform: "node",
  sourcemap: "inline",
  target: "node24"
});

await import(pathToFileURL(outfile).href);
