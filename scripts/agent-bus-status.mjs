import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const busDir = resolve(process.env.AGENT_BUS_ROOT ?? join(rootDir, ".agent-bus"));
const args = process.argv.slice(2);
const checkMode = args.includes("--check");
const selectedTaskArg = readFlagValue(args, "--task");
const problems = [];

function readFlagValue(values, flag) {
  const index = values.indexOf(flag);
  if (index === -1) return null;
  const next = values[index + 1];
  return next && !next.startsWith("--") ? next : "";
}

function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function readJson(path) {
  const text = readText(path);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return { parseError: error instanceof Error ? error.message : String(error) };
  }
}

function listFiles(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((name) => name !== ".gitkeep")
    .sort()
    .map((name) => join(path, name));
}

function listLockOwners(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((name) => name !== ".gitkeep")
    .sort()
    .map((name) => {
      const lockPath = join(path, name);
      const ownerPath = join(lockPath, "owner.json");
      return {
        name,
        owner: statSync(lockPath).isDirectory() ? readJson(ownerPath) : readJson(lockPath)
      };
    });
}

function printSection(title) {
  console.log(`\n## ${title}`);
}

function addProblem(message) {
  problems.push(message);
}

function normalizePath(value) {
  return String(value ?? "")
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.*]/g, "\\$&");
}

function globToRegex(pattern) {
  const normalized = normalizePath(pattern);
  const parts = normalized.split(/(\*\*)/g);
  const source = parts
    .map((part) => {
      if (part === "**") return ".*";
      return escapeRegex(part).replaceAll("\\*", "[^/]*");
    })
    .join("");
  return new RegExp(`^${source}$`);
}

function matchesPattern(path, pattern) {
  const normalizedPath = normalizePath(path);
  const normalizedPattern = normalizePath(pattern);
  if (!normalizedPattern.includes("*")) {
    return normalizedPath === normalizedPattern;
  }
  return globToRegex(normalizedPattern).test(normalizedPath);
}

function matchesAnyPattern(path, patterns) {
  return Array.isArray(patterns) && patterns.some((pattern) => matchesPattern(path, pattern));
}

function parseDate(value) {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function ageSummary(value, staleHours) {
  const timestamp = parseDate(value);
  if (timestamp === null) return { label: "unknown age", stale: true };
  const ageMs = Date.now() - timestamp;
  if (ageMs < 0) {
    return {
      label: "timestamp is in the future",
      stale: true,
      future: true
    };
  }
  const ageHours = ageMs / (60 * 60 * 1000);
  return {
    label: `${ageHours.toFixed(1)}h old`,
    stale: ageHours > staleHours
  };
}

function relativeToBus(path) {
  return relative(busDir, path).replaceAll("\\", "/");
}

function inferredAliases(taskId) {
  const aliases = [];
  const phaseTask = taskId.match(/^(P\d+-\d+)(?:-|$)/u);
  if (phaseTask) aliases.push(phaseTask[1]);
  return aliases;
}

function taskKeys(task) {
  return [task.id, ...(Array.isArray(task.aliases) ? task.aliases : []), ...inferredAliases(task.id)].filter(Boolean);
}

function taskTimestamp(owner) {
  return owner?.timestamp ?? owner?.created_at ?? owner?.heartbeat_at ?? owner?.claimed_at;
}

function taskKeyLabel(task) {
  const aliases = taskKeys(task).filter((key) => key !== task.id);
  return aliases.length > 0 ? `${task.id} (${aliases.join(", ")})` : task.id;
}

function parseGitStatusPaths(output) {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const path = line.slice(3).trim();
      const renamedPath = path.includes(" -> ") ? path.split(" -> ").at(-1) : path;
      return normalizePath(renamedPath?.replace(/^"|"$/g, ""));
    })
    .filter(Boolean);
}

function lockCoversPath(lock, requiredPath) {
  return (lock.owner?.locked_paths ?? []).some(
    (lockedPath) => matchesPattern(requiredPath, lockedPath) || matchesPattern(lockedPath, requiredPath)
  );
}

console.log(`Agent bus: ${busDir}`);

const current = readText(join(busDir, "state", "CURRENT.md"));
printSection("Current");
const currentSummary = current
  .split(/\r?\n/)
  .filter((line) => line.startsWith("- Latest commit:") || line.startsWith("Phase ") || line.startsWith("Name: "))
  .slice(0, 8);
console.log(currentSummary.length > 0 ? currentSummary.join("\n") : "No current summary found.");

const queue = readJson(join(busDir, "queue.json"));
const staleHours =
  typeof queue?.policy?.default_stale_claim_hours === "number" ? queue.policy.default_stale_claim_hours : 4;
const tasks = Array.isArray(queue?.tasks) ? queue.tasks : [];
const taskByKey = new Map();
for (const task of tasks) {
  for (const key of taskKeys(task)) {
    if (taskByKey.has(key) && taskByKey.get(key)?.id !== task.id) {
      addProblem(`Task key ${key} is used by multiple tasks: ${taskByKey.get(key).id}, ${task.id}`);
    } else {
      taskByKey.set(key, task);
    }
  }
}
const taskIds = new Set(taskByKey.keys());
const doneTaskIds = new Set(tasks.filter((task) => task.status === "done").map((task) => task.id));
for (const task of tasks) {
  if (task.status === "done") {
    for (const key of taskKeys(task)) doneTaskIds.add(key);
  }
}
const selectedTask = selectedTaskArg ? taskByKey.get(selectedTaskArg) : null;

if (selectedTaskArg !== null) {
  printSection("Selected Task");
  if (!selectedTaskArg) {
    console.log("--task was provided without a task id.");
    addProblem("--task requires a task id");
  } else if (!selectedTask) {
    console.log(`Task not found: ${selectedTaskArg}`);
    addProblem(`Selected task not found: ${selectedTaskArg}`);
  } else {
    console.log(`Selected task ${taskKeyLabel(selectedTask)} [${selectedTask.status}]`);
  }
}

printSection("Runnable Queue");
if (queue?.parseError) {
  console.log(`queue.json parse error: ${queue.parseError}`);
  addProblem(`queue.json parse error: ${queue.parseError}`);
} else if (Array.isArray(queue?.tasks)) {
  for (const task of tasks) {
    if (!["runnable", "active"].includes(task.status)) continue;
    console.log(`- ${task.id} [${task.status}] priority=${task.priority ?? "unknown"}`);
    if (Array.isArray(task.depends_on) && task.depends_on.length > 0) {
      console.log(`  depends_on: ${task.depends_on.join(", ")}`);
    }
  }
} else {
  console.log("No queue.json tasks found.");
  addProblem("queue.json has no tasks array");
}

printSection("Queue Checks");
if (tasks.length === 0) {
  console.log("No queue tasks to validate.");
} else {
  let queueIssues = 0;
  for (const task of tasks) {
    for (const dependencyId of task.depends_on ?? []) {
      if (!taskIds.has(dependencyId)) {
        queueIssues += 1;
        addProblem(`Task ${task.id} depends on missing task ${dependencyId}`);
        console.log(`- missing dependency: ${task.id} -> ${dependencyId}`);
      }
    }
    if (["runnable", "active"].includes(task.status)) {
      const incompleteDependencies = (task.depends_on ?? []).filter((dependencyId) => !doneTaskIds.has(dependencyId));
      if (incompleteDependencies.length > 0) {
        queueIssues += 1;
        addProblem(`Task ${task.id} is ${task.status} but dependencies are not done: ${incompleteDependencies.join(", ")}`);
        console.log(`- incomplete dependencies: ${task.id} waits for ${incompleteDependencies.join(", ")}`);
      }
    }
  }
  if (queueIssues === 0) {
    console.log("Queue dependencies look consistent.");
  }
}

printSection("Claims");
const claims = listFiles(join(busDir, "claims")).filter((path) => path.endsWith(".json"));
const claimRecords = [];
if (claims.length === 0) {
  console.log("No claim files.");
} else {
  for (const claimPath of claims) {
    const claim = readJson(claimPath);
    const taskId = claim?.task_id ?? claimPath;
    const canonicalTask = taskByKey.get(taskId);
    const canonicalTaskId = canonicalTask?.id ?? taskId;
    const status = claim?.status ?? "active";
    const age = ageSummary(taskTimestamp(claim), staleHours);
    claimRecords.push({ path: claimPath, claim, taskId, canonicalTask, canonicalTaskId, status, age });
    console.log(
      `- ${taskId} [${status}] claimed_by=${claim?.claimed_by ?? claim?.agent ?? "unknown"} heartbeat=${claim?.heartbeat_at ?? "unknown"} (${age.label}${age.stale ? ", stale" : ""})`
    );
    if (claim?.parseError) {
      addProblem(`Claim ${relativeToBus(claimPath)} parse error: ${claim.parseError}`);
    }
    if (claim?.task_id && !canonicalTask) {
      addProblem(`Claim references task not in queue: ${claim.task_id}`);
    }
    if (status !== "done" && age.stale) {
      addProblem(`Claim is stale: ${taskId}`);
    }
    if (age.future) {
      addProblem(`Claim timestamp is in the future: ${taskId}`);
    }
  }
}

printSection("Locks");
const locks = listLockOwners(join(busDir, "locks"));
if (locks.length === 0) {
  console.log("No locks.");
} else {
  for (const lock of locks) {
    const owner = lock.owner;
    const canonicalTask = taskByKey.get(owner?.task_id);
    const canonicalTaskId = canonicalTask?.id ?? owner?.task_id;
    const age = ageSummary(taskTimestamp(owner), staleHours);
    console.log(
      `- ${lock.name} task=${owner?.task_id ?? "unknown"} agent=${owner?.agent ?? "unknown"} (${age.label}${age.stale ? ", stale" : ""})`
    );
    if (Array.isArray(owner?.locked_paths)) {
      console.log(`  paths: ${owner.locked_paths.join(", ")}`);
    }
    if (owner?.parseError) {
      addProblem(`Lock ${lock.name} owner parse error: ${owner.parseError}`);
    }
    if (!owner) {
      addProblem(`Lock ${lock.name} has no owner metadata`);
    }
    if (owner?.task_id && doneTaskIds.has(canonicalTaskId)) {
      addProblem(`Done task still has a lock: ${owner.task_id} (${lock.name})`);
    }
    if (owner?.task_id && !canonicalTask) {
      addProblem(`Lock ${lock.name} references task not in queue: ${owner.task_id}`);
    }
    if (age.stale) {
      addProblem(`Lock is stale: ${lock.name}`);
    }
    if (age.future) {
      addProblem(`Lock timestamp is in the future: ${lock.name}`);
    }
  }
}

printSection("Latest Handoffs");
const handoffs = listFiles(join(busDir, "handoff"))
  .filter((path) => path.endsWith(".md") && !path.endsWith("TEMPLATE.md"))
  .map((path) => ({ path, mtimeMs: statSync(path).mtimeMs }))
  .sort((left, right) => right.mtimeMs - left.mtimeMs)
  .slice(0, 5);
if (handoffs.length === 0) {
  console.log("No handoff notes.");
} else {
  for (const handoff of handoffs) {
    console.log(`- ${relativeToBus(handoff.path)}`);
  }
}

printSection("Git Status");
const git = spawnSync("git", ["status", "--short"], { cwd: rootDir, encoding: "utf8" });
let gitStatusPaths = [];
if (git.status === 0) {
  const lines = git.stdout.trim().split(/\r?\n/).filter(Boolean);
  gitStatusPaths = parseGitStatusPaths(git.stdout);
  console.log(lines.length > 0 ? lines.slice(0, 40).join("\n") : "Working tree clean.");
  if (lines.length > 40) console.log(`... ${lines.length - 40} more lines`);
} else {
  console.log((git.stderr || "git status failed").trim());
  addProblem("git status failed");
}

if (selectedTask) {
  printSection("Selected Task Checks");
  const activeClaims = claimRecords.filter(
    (record) => record.canonicalTaskId === selectedTask.id && record.status !== "done"
  );
  if (activeClaims.length === 0 && selectedTask.status !== "done") {
    addProblem(`Selected task has no active claim: ${selectedTaskArg}`);
    console.log("- missing active claim");
  }

  const incompleteDependencies = (selectedTask.depends_on ?? []).filter((dependencyId) => !doneTaskIds.has(dependencyId));
  if (incompleteDependencies.length > 0) {
    addProblem(`Selected task dependencies are not done: ${selectedTask.id} waits for ${incompleteDependencies.join(", ")}`);
    console.log(`- incomplete dependencies: ${incompleteDependencies.join(", ")}`);
  }

  let missingLocks = 0;
  for (const requiredPath of selectedTask.required_locks ?? []) {
    const coveringLock = locks.find(
      (lock) => taskByKey.get(lock.owner?.task_id)?.id === selectedTask.id && lockCoversPath(lock, requiredPath)
    );
    if (!coveringLock && selectedTask.status !== "done") {
      missingLocks += 1;
      addProblem(`Selected task is missing required lock: ${selectedTask.id} -> ${requiredPath}`);
      console.log(`- missing lock: ${requiredPath}`);
    }
  }
  if (missingLocks === 0) {
    console.log("Required locks are present.");
  }

  let dirtyBoundaryIssues = 0;
  for (const dirtyPath of gitStatusPaths) {
    if (matchesAnyPattern(dirtyPath, selectedTask.forbidden)) {
      dirtyBoundaryIssues += 1;
      addProblem(`Dirty file is forbidden for task ${selectedTaskArg}: ${dirtyPath}`);
      console.log(`- forbidden dirty file: ${dirtyPath}`);
    } else if (!matchesAnyPattern(dirtyPath, selectedTask.write_scope)) {
      dirtyBoundaryIssues += 1;
      addProblem(`Dirty file is outside write_scope for task ${selectedTaskArg}: ${dirtyPath}`);
      console.log(`- out-of-scope dirty file: ${dirtyPath}`);
    }
  }
  if (dirtyBoundaryIssues === 0) {
    console.log("Dirty files fit selected task boundaries.");
  }
}

printSection("Problems");
if (problems.length === 0) {
  console.log("No agent-bus consistency problems found.");
} else {
  for (const problem of problems) {
    console.log(`- ${problem}`);
  }
  if (checkMode) {
    process.exitCode = 1;
  }
}
