import { spawnSync } from "node:child_process";

const ignoredPathPrefixes = [
  "apps__web>",
  "packages__planning-gantt-ui>"
];
const pnpmExecPath = process.env.npm_execpath;
const command = pnpmExecPath ? process.execPath : "pnpm";
const args = pnpmExecPath
  ? [pnpmExecPath, "audit", "--audit-level", "moderate", "--json"]
  : ["audit", "--audit-level", "moderate", "--json"];
const result = spawnSync(command, args, {
  encoding: "utf8",
  shell: false
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

const rawOutput = result.stdout.trim();
if (!rawOutput) {
  if (result.status === 0) {
    console.log("Backend dependency audit passed");
    process.exit(0);
  }
  console.error(result.stderr.trim() || "Dependency audit failed without JSON output");
  process.exit(result.status ?? 1);
}

let audit;
try {
  audit = JSON.parse(rawOutput);
} catch {
  console.error("Dependency audit returned invalid JSON");
  if (result.stderr.trim()) console.error(result.stderr.trim());
  process.exit(1);
}

const findings = [];
for (const advisory of Object.values(audit.advisories ?? {})) {
  for (const finding of advisory.findings ?? []) {
    const activePaths = (finding.paths ?? []).filter((path) => !isIgnoredPath(path));
    for (const path of activePaths) {
      findings.push({
        moduleName: advisory.module_name,
        severity: advisory.severity,
        title: advisory.title,
        path
      });
    }
  }
}

if (findings.length > 0) {
  console.error("Backend dependency audit failed:");
  for (const finding of findings) {
    console.error(`- ${finding.severity} ${finding.moduleName}: ${finding.title} (${finding.path})`);
  }
  process.exit(1);
}

console.log("Backend dependency audit passed");

function isIgnoredPath(path) {
  return ignoredPathPrefixes.some((prefix) => path.startsWith(prefix));
}
