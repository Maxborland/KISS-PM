import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { betaRuntimeRoutes } from "./beta-runtime-routes.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const selectedRoutes = resolveSelectedRoutes(readOption("routes") ?? "beta");
const routes = selectedRoutes.map((route) => route.path).join(",");
const manifestPath = resolve(repoRoot, "test-results", "beta-runtime-screenshots-manifest.json");

console.log(`[qa:screenshots] Capturing runtime screenshots for routes=${routes}`);

const result = run("pnpm", [
  "exec",
  "playwright",
  "test",
  "--config",
  "playwright.config.ts",
  "e2e/runtime/runtime-foundation.spec.ts",
  "--grep",
  "authenticated beta runtime routes open"
]);

if (result.status === 0) {
  const manifest = writeScreenshotManifest(selectedRoutes);
  console.log(`[qa:screenshots] OK. Manifest: ${manifest.manifestPath}`);
} else {
  console.error("[qa:screenshots] Failed.");
}

process.exit(result.status ?? 1);

function readOption(name) {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (inline) return inline;

  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function normalizeRoutes(value) {
  return value
    .split(/[\s,]+/)
    .map((route) => route.trim())
    .filter(Boolean)
    .join(",");
}

function resolveSelectedRoutes(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "beta" || normalized === "all") return betaRuntimeRoutes;

  const requestedPaths = normalizeRoutes(value).split(",").filter(Boolean);
  const byPath = new Map(betaRuntimeRoutes.map((route) => [route.path, route]));
  const unsupported = requestedPaths.filter((path) => !byPath.has(path));
  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported qa:screenshots route(s): ${unsupported.join(", ")}. Use beta or one of: ${betaRuntimeRoutes
        .map((route) => route.path)
        .join(", ")}`
    );
  }
  return requestedPaths.map((path) => {
    const route = byPath.get(path);
    if (!route) throw new Error(`Unsupported qa:screenshots route: ${path}`);
    return route;
  });
}

function writeScreenshotManifest(selected) {
  const captures = selected.flatMap((route) => {
    const slug = route.path.slice(1).replaceAll("/", "-");
    return ["desktop", "narrow"].map((viewport) => {
      const fileName = `runtime-${slug}-${viewport}.png`;
      const filePath = findLatestFile(resolve(repoRoot, "test-results"), fileName);
      const size = filePath ? statSync(filePath).size : 0;
      const minimumSize = viewport === "desktop" ? 8_000 : 4_000;
      return {
        fileName,
        filePath,
        marker: route.marker,
        minimumSize,
        pass: Boolean(filePath && size > minimumSize),
        route: route.path,
        size,
        viewport
      };
    });
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    manifestPath,
    routes: selected.map((route) => route.path),
    allPass: captures.every((capture) => capture.pass),
    captures
  };

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  if (!manifest.allPass) {
    const missing = captures
      .filter((capture) => !capture.pass)
      .map((capture) => `${capture.route}:${capture.viewport}`)
      .join(", ");
    throw new Error(`qa:screenshots missing or tiny screenshot artifact(s): ${missing}`);
  }

  return manifest;
}

function findLatestFile(root, fileName) {
  if (!existsSync(root)) return null;
  const matches = [];
  walk(root, (filePath) => {
    if (filePath.endsWith(fileName)) matches.push(filePath);
  });
  matches.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return matches[0] ?? null;
}

function walk(dir, onFile) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath, onFile);
    } else if (entry.isFile()) {
      onFile(entryPath);
    }
  }
}

function run(command, commandArgs) {
  const env = { ...process.env, KISS_PM_FAST_ROUTES: routes };

  if (process.platform !== "win32") {
    return spawnSync(command, commandArgs, {
      cwd: repoRoot,
      env,
      stdio: "inherit"
    });
  }

  const result = spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command, ...commandArgs], {
    cwd: repoRoot,
    env,
    stdio: "inherit"
  });

  if (result.error) console.error(result.error);
  return result;
}
