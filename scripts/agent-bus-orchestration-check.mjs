import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const ledgerArg = readFlagValue(args, "--ledger");
const acceptanceMode = args.includes("--acceptance");
const problems = [];
const validStatuses = new Set(["pending", "in_progress", "blocked", "failed", "verified"]);

if (!ledgerArg) {
  console.error("Usage: node scripts/agent-bus-orchestration-check.mjs --ledger <path> [--acceptance]");
  process.exit(2);
}

function readFlagValue(values, flag) {
  const index = values.indexOf(flag);
  if (index === -1) return null;
  const next = values[index + 1];
  return next && !next.startsWith("--") ? next : "";
}

function addProblem(message) {
  problems.push(message);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    addProblem(`cannot read ledger: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function parseDate(value) {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasEvidence(evidence) {
  if (Array.isArray(evidence)) {
    return evidence.some(hasEvidence);
  }
  if (!evidence || typeof evidence !== "object") return false;
  return (
    hasText(evidence.command) ||
    hasText(evidence.artifact) ||
    hasText(evidence.summary) ||
    hasText(evidence.readback) ||
    typeof evidence.exit_code === "number"
  );
}

function agentIds(ledger) {
  return new Set([ledger?.lead_agent?.id, ledger?.worker_agent?.id].filter(Boolean));
}

function checkAgent(agent, expectedRole) {
  if (!agent || typeof agent !== "object") {
    addProblem(`missing ${expectedRole}_agent`);
    return;
  }
  if (!hasText(agent.id)) addProblem(`${expectedRole}_agent is missing id`);
  if (agent.role !== expectedRole) addProblem(`${expectedRole}_agent role must be ${expectedRole}`);
  if (parseDate(agent.heartbeat_at) === null) addProblem(`${expectedRole}_agent is missing valid heartbeat_at`);
}

function checkHeartbeat(label, heartbeatAt, timeoutMinutes, timeoutAction) {
  const timestamp = parseDate(heartbeatAt);
  if (timestamp === null) {
    addProblem(`${label} is missing valid heartbeat_at`);
    return;
  }
  const ageMinutes = (Date.now() - timestamp) / (60 * 1000);
  if (ageMinutes > timeoutMinutes && !hasText(timeoutAction)) {
    addProblem(`${label} heartbeat is stale and missing timeout_action`);
  }
}

function checkBlocked(block) {
  if (!block.blocked || typeof block.blocked !== "object") {
    addProblem(`blocked work block ${block.id} is missing blocked details`);
    return;
  }
  if (!hasText(block.blocked.reason)) {
    addProblem(`blocked work block ${block.id} is missing reason`);
  }
  if (!hasEvidence(block.blocked.evidence)) {
    addProblem(`blocked work block ${block.id} is missing evidence`);
  }
  if (!hasText(block.blocked.action_taken_instead)) {
    addProblem(`blocked work block ${block.id} is missing action_taken_instead`);
  }
}

function checkVerified(block, leadAgentId) {
  if (!block.verification || typeof block.verification !== "object") {
    addProblem(`verified work block ${block.id} is missing verification`);
    return;
  }
  if (block.verification.verified_by !== leadAgentId) {
    addProblem(`verified work block ${block.id} must be verified_by lead agent ${leadAgentId}`);
  }
  if (parseDate(block.verification.verified_at) === null) {
    addProblem(`verified work block ${block.id} is missing valid verified_at`);
  }
  if (!hasEvidence(block.verification.evidence)) {
    addProblem(`verified work block ${block.id} is missing evidence`);
  }
}

const ledgerPath = resolve(ledgerArg);
const ledger = readJson(ledgerPath);

if (ledger) {
  if (ledger.version !== 1) addProblem("ledger version must be 1");
  if (!hasText(ledger.run_id)) addProblem("ledger is missing run_id");
  if (!hasText(ledger.objective)) addProblem("ledger is missing objective");
  checkAgent(ledger.lead_agent, "lead");
  checkAgent(ledger.worker_agent, "worker");

  const ids = agentIds(ledger);
  const timeoutMinutes =
    typeof ledger.timeout_policy?.heartbeat_timeout_minutes === "number"
      ? ledger.timeout_policy.heartbeat_timeout_minutes
      : 30;

  for (const role of ["lead_agent", "worker_agent"]) {
    const agent = ledger[role];
    if (agent) {
      checkHeartbeat(role, agent.heartbeat_at, timeoutMinutes, agent.timeout_action);
    }
  }

  if (!Array.isArray(ledger.work_blocks) || ledger.work_blocks.length === 0) {
    addProblem("ledger must contain at least one work block");
  } else {
    for (const block of ledger.work_blocks) {
      if (!hasText(block.id)) addProblem("work block is missing id");
      if (!hasText(block.title)) addProblem(`work block ${block.id ?? "<unknown>"} is missing title`);
      if (!ids.has(block.owner_agent_id)) {
        addProblem(`work block ${block.id ?? "<unknown>"} owner_agent_id is not a known lead or worker`);
      }
      if (!validStatuses.has(block.status)) {
        addProblem(`work block ${block.id ?? "<unknown>"} has invalid status ${block.status}`);
      }
      if (["pending", "in_progress", "blocked"].includes(block.status)) {
        checkHeartbeat(`work block ${block.id}`, block.heartbeat_at, timeoutMinutes, block.timeout_action);
      }
      if (block.status === "blocked") checkBlocked(block);
      if (block.status === "verified") checkVerified(block, ledger.lead_agent?.id);
    }
  }

  if (Array.isArray(ledger.gates)) {
    for (const gate of ledger.gates) {
      if (!hasText(gate.id)) addProblem("gate is missing id");
      if (!validStatuses.has(gate.status)) addProblem(`gate ${gate.id ?? "<unknown>"} has invalid status ${gate.status}`);
      if (gate.status === "blocked") {
        checkBlocked({ id: gate.id, blocked: gate.blocked });
      }
      if (gate.status === "verified" && !hasEvidence(gate.evidence)) {
        addProblem(`verified gate ${gate.id} is missing evidence`);
      }
    }
  }

  if (acceptanceMode) {
    const unverifiedBlocks = (ledger.work_blocks ?? []).filter((block) => block.status !== "verified");
    if (unverifiedBlocks.length > 0) {
      addProblem(`acceptance requires all work blocks verified: ${unverifiedBlocks.map((block) => block.id).join(", ")}`);
    }
    if (ledger.final_verdict?.status !== "accepted") {
      addProblem("acceptance requires final_verdict.status accepted");
    }
    if (ledger.final_verdict?.decided_by !== ledger.lead_agent?.id) {
      addProblem(`acceptance requires final_verdict.decided_by lead agent ${ledger.lead_agent?.id ?? "<missing>"}`);
    }
    if (parseDate(ledger.final_verdict?.decided_at) === null) {
      addProblem("acceptance requires final_verdict.decided_at");
    }
    if (!hasEvidence(ledger.final_verdict?.evidence)) {
      addProblem("acceptance requires final_verdict.evidence");
    }
  }
}

if (problems.length > 0) {
  console.log("orchestration ledger failed");
  for (const problem of problems) {
    console.log(`- ${problem}`);
  }
  process.exitCode = 1;
} else if (acceptanceMode) {
  console.log("orchestration acceptance ok");
} else {
  console.log("orchestration ledger ok");
}
