import { appendFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const taskId = readFlagValue(args, "--task");
const watchMode = args.includes("--watch");
const intervalSeconds = Number(readFlagValue(args, "--interval") ?? 60);
const maxRuns = Number(readFlagValue(args, "--max-runs") ?? (watchMode ? 0 : 1));
const rootDir = process.cwd();
const busDir = resolve(process.env.AGENT_BUS_ROOT ?? join(rootDir, ".agent-bus"));
const scriptDir = dirname(fileURLToPath(import.meta.url));
const statusScript = join(scriptDir, "agent-bus-status.mjs");

if (!taskId) {
  console.error("Usage: node scripts/agent-bus-guard.mjs --task <TASK_ID> [--once|--watch] [--interval seconds]");
  process.exit(2);
}

if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
  console.error("--interval must be a positive number of seconds");
  process.exit(2);
}

if (!Number.isFinite(maxRuns) || maxRuns < 0) {
  console.error("--max-runs must be zero or a positive number");
  process.exit(2);
}

function readFlagValue(values, flag) {
  const index = values.indexOf(flag);
  if (index === -1) return null;
  const next = values[index + 1];
  return next && !next.startsWith("--") ? next : "";
}

function appendEvent(event) {
  const eventsPath = join(busDir, "events", "events.jsonl");
  mkdirSync(dirname(eventsPath), { recursive: true });
  appendFileSync(eventsPath, `${JSON.stringify(event)}\n`);
}

function extractSummary(output) {
  const problemsIndex = output.indexOf("## Problems");
  if (problemsIndex === -1) return "agent-bus-status did not print a Problems section";
  const problems = output
    .slice(problemsIndex)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
  return problems[0] ?? "agent-bus-status failed without a parsed problem";
}

function runOnce() {
  const result = spawnSync("node", [statusScript, "--check", "--task", taskId], {
    cwd: rootDir,
    encoding: "utf8",
    env: process.env
  });
  const ok = result.status === 0;
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const summary = ok ? "selected task passed agent-bus guard checks" : extractSummary(output);
  appendEvent({
    type: ok ? "agent-bus.guard.pass" : "agent-bus.guard.fail",
    timestamp: new Date().toISOString(),
    task_id: taskId,
    cwd: rootDir,
    status_exit_code: result.status,
    summary
  });
  if (ok) {
    console.log(`agent-bus guard ok: ${taskId}`);
  } else {
    console.log(`agent-bus guard failed: ${summary}`);
  }
  return ok;
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

let runCount = 0;
let lastOk = true;
let keepRunning = true;
while (keepRunning) {
  runCount += 1;
  lastOk = runOnce();
  keepRunning = watchMode && (maxRuns === 0 || runCount < maxRuns);
  if (keepRunning) {
    await sleep(intervalSeconds * 1000);
  }
}

if (!lastOk && !watchMode) {
  process.exitCode = 1;
}
