import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([
  ".codegraph",
  ".cursor",
  ".git",
  ".next",
  ".worktrees",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results"
]);
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".md",
  ".mts",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml"
]);

const checks = [
  {
    name: "committed-env-file",
    path: (file) => /(^|\/)\.env(\.|$)/.test(file) && !file.endsWith(".env.example")
  },
  {
    name: "private-key",
    pattern: /-----BEGIN (?:RSA|DSA|EC|OPENSSH|PRIVATE) KEY-----/
  },
  {
    name: "aws-access-key",
    pattern: /AKIA[0-9A-Z]{16}/
  },
  {
    name: "github-token",
    pattern: /ghp_[A-Za-z0-9_]{36,}/
  },
  {
    name: "npm-registry-token",
    pattern: /(?:_authToken\s*=|NPM_TOKEN\s*=)\s*[A-Za-z0-9_./~+-]{16,}/
  },
  {
    name: "slack-token",
    pattern: /xox[baprs]-[A-Za-z0-9-]{20,}/
  },
  {
    name: "openai-token",
    pattern: /\bsk-(?:proj-|svcacct-)[A-Za-z0-9_-]{20,}\b/
  },
  {
    name: "node-inspector-runtime-flag",
    pattern: /(?:^|[\s"'=:])--inspect(?:-brk)?(?:[\s"'=:]|$)/
  },
  {
    name: "server-dangerous-execution",
    runtimePath: /^(apps[\\/]api[\\/]src|packages[\\/][^\\/]+[\\/]src)[\\/]/,
    pattern: /eval\(|new Function|node:child_process|from ["']child_process["']|require\(["']child_process["']\)|shell:\s*true/
  },
  {
    name: "server-insecure-http-parser",
    runtimePath: /^(apps[\\/]api[\\/]src|packages[\\/][^\\/]+[\\/]src)[\\/]/,
    pattern: /insecureHTTPParser\s*:\s*true/
  },
  {
    name: "server-broad-cors",
    runtimePath: /^apps[\\/]api[\\/]src[\\/]/,
    pattern: /Access-Control-Allow-Origin["']?\s*,?\s*["']\*/
  },
  {
    name: "sensitive-console-log",
    runtimePath: /^(apps[\\/]api[\\/]src|packages[\\/][^\\/]+[\\/]src)[\\/]/,
    pattern: /console\.(?:log|debug|info|warn|error)\([^;\n]*(?:process\.env|req\.headers|request\.headers|headers|cookie|authorization|set-cookie|password|secret|token)/i
  }
];

const findings = [];
for (const file of walk(root)) {
  const rel = relative(root, file).split(sep).join("/");
  for (const check of checks) {
    if (check.path?.(rel)) {
      findings.push({ check: check.name, file: rel, line: 1 });
      continue;
    }
    if (check.runtimePath && !check.runtimePath.test(rel)) continue;
    if (!check.pattern) continue;
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (check.pattern.test(line)) {
        findings.push({ check: check.name, file: rel, line: index + 1 });
      }
    });
  }
}

if (findings.length > 0) {
  console.error("Security scan failed:");
  for (const finding of findings) {
    console.error(`- ${finding.check}: ${finding.file}:${finding.line}`);
  }
  process.exit(1);
}

console.log("Security scan passed");

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      yield* walk(fullPath);
      continue;
    }
    if (!stat.isFile()) continue;
    if (entry === "pnpm-lock.yaml") continue;
    if (entry.startsWith(".env")) {
      yield fullPath;
      continue;
    }
    if (textExtensions.has(extname(entry))) {
      yield fullPath;
    }
  }
}
