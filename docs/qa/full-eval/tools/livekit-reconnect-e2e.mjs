import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const baseUrl = process.env.KISS_PM_E2E_BASE_URL ?? "http://127.0.0.1:3180";
const outputDir = path.resolve(
  process.env.KISS_PM_E2E_OUTPUT_DIR ??
    "docs/qa/full-eval/evidence/browser-media-livekit-reconnect-2026-07-10"
);
const marker = `kisspm-livekit-reconnect-${Date.now()}`;
const startedAt = new Date().toISOString();
const screenshots = [];
const observations = [];
const runtimeIssues = [];
let browser;
let adminContext;
let engineerContext;
let adminPage;
let engineerPage;
let roomId = null;
let sessionId = null;
let serverPaused = false;
let verdict = "failed";
let failure = null;

await mkdir(outputDir, { recursive: true });

try {
  browser = await chromium.launch({
    headless: process.env.KISS_PM_E2E_HEADLESS === "1",
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required"
    ]
  });

  adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  engineerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await Promise.all([
    adminContext.grantPermissions(["camera", "microphone"], { origin: baseUrl }),
    engineerContext.grantPermissions(["camera", "microphone"], { origin: baseUrl })
  ]);

  adminPage = await adminContext.newPage();
  engineerPage = await engineerContext.newPage();
  observeRuntime(adminPage, "admin");
  observeRuntime(engineerPage, "engineer");

  await login(adminPage, "admin@kiss-pm.local", "admin12345");
  phaseLog("admin-login-complete");
  await login(engineerPage, "engineer@kiss-pm.local", "engineer12345");
  phaseLog("engineer-login-complete");

  const created = await apiJson(adminPage, "POST", "/api/workspace/call-rooms", {
    entityType: "project",
    entityId: "project-vektor-portal",
    title: `LiveKit reconnect QA ${marker}`,
    mediaKind: "video",
    provider: "livekit",
    providerRoomId: marker
  }, 201);
  roomId = created.callRoom.roomId;
  phaseLog("room-created");

  const started = await apiJson(
    adminPage,
    "POST",
    `/api/workspace/call-rooms/${encodeURIComponent(roomId)}/sessions/start`,
    undefined,
    201
  );
  sessionId = started.session.id;
  phaseLog("session-started");
  observations.push({
    phase: "setup",
    roomId,
    sessionId,
    createStatus: 201,
    startStatus: 201
  });

  const callUrl = `${baseUrl}/calls/${encodeURIComponent(roomId)}`;
  await joinCall(adminPage, callUrl, "admin");
  phaseLog("admin-joined");
  await joinCall(engineerPage, callUrl, "engineer");
  phaseLog("engineer-joined");
  await waitForRemoteParticipant(adminPage, "Игорь Инженер", "admin sees engineer");
  await waitForRemoteParticipant(engineerPage, "Анна Администратор", "engineer sees admin");
  observations.push({
    phase: "baseline",
    admin: await snapshotPage(adminPage),
    engineer: await snapshotPage(engineerPage)
  });
  await capture(adminPage, "baseline-admin.png");
  await capture(engineerPage, "baseline-engineer.png");

  await engineerContext.setOffline(true);
  await waitForPhase(engineerPage, "Переподключение…", "engineer client offline");
  phaseLog("client-reconnecting-observed");
  observations.push({
    phase: "client-offline",
    admin: await snapshotPage(adminPage),
    engineer: await snapshotPage(engineerPage)
  });
  await capture(engineerPage, "client-offline-reconnecting.png");

  await engineerContext.setOffline(false);
  await waitForPhase(engineerPage, "В эфире", "engineer client online recovery", 60_000);
  await waitForRemoteParticipant(adminPage, "Игорь Инженер", "admin sees recovered engineer");
  await waitForRemoteParticipant(engineerPage, "Анна Администратор", "recovered engineer sees admin");
  phaseLog("client-recovered");
  observations.push({
    phase: "client-recovered",
    admin: await snapshotPage(adminPage),
    engineer: await snapshotPage(engineerPage)
  });
  await capture(engineerPage, "client-recovered.png");

  execDocker(["compose", "pause", "livekit"]);
  serverPaused = true;
  await Promise.all([
    waitForPhase(adminPage, "Переподключение…", "admin sees server interruption", 45_000),
    waitForPhase(engineerPage, "Переподключение…", "engineer sees server interruption", 45_000)
  ]);
  phaseLog("server-reconnecting-observed");
  observations.push({
    phase: "server-paused",
    admin: await snapshotPage(adminPage),
    engineer: await snapshotPage(engineerPage)
  });
  await capture(adminPage, "server-paused-admin-reconnecting.png");
  await capture(engineerPage, "server-paused-engineer-reconnecting.png");

  execDocker(["compose", "unpause", "livekit"]);
  serverPaused = false;
  await Promise.all([
    waitForPhase(adminPage, "В эфире", "admin server recovery", 60_000),
    waitForPhase(engineerPage, "В эфире", "engineer server recovery", 60_000)
  ]);
  await waitForRemoteParticipant(adminPage, "Игорь Инженер", "admin sees engineer after server recovery");
  await waitForRemoteParticipant(engineerPage, "Анна Администратор", "engineer sees admin after server recovery");
  phaseLog("server-recovered");
  observations.push({
    phase: "server-recovered",
    admin: await snapshotPage(adminPage),
    engineer: await snapshotPage(engineerPage)
  });
  await capture(adminPage, "server-recovered-admin.png");
  await capture(engineerPage, "server-recovered-engineer.png");

  const detail = await apiJson(
    adminPage,
    "GET",
    `/api/workspace/call-rooms/${encodeURIComponent(roomId)}`,
    undefined,
    200
  );
  const eventSummary = detail.events.map((event) => ({
    type: event.eventType,
    user: event.actorUserId,
    state: event.payload?.state ?? null,
    at: event.createdAt
  }));
  const counts = Object.fromEntries(
    [...new Set(eventSummary.map((event) => `${event.type}:${event.user ?? "none"}`))].map((key) => [
      key,
      eventSummary.filter((event) => `${event.type}:${event.user ?? "none"}` === key).length
    ])
  );
  const invariants = {
    activeSessionStillActive: detail.activeSession?.id === sessionId && detail.activeSession?.status === "active",
    noSessionEndedEvent: !eventSummary.some((event) => event.type === "session_ended"),
    noParticipantLeftDuringTransportRecovery: !eventSummary.some((event) => event.type === "participant_left"),
    oneAdminJoinToken: counts["join_token_issued:user-alpha-admin"] === 1,
    oneEngineerJoinToken: counts["join_token_issued:user-alpha-engineer"] === 1,
    oneAdminJoinedEvent: counts["participant_joined:user-alpha-admin"] === 1,
    oneEngineerJoinedEvent: counts["participant_joined:user-alpha-engineer"] === 1
  };
  const failedInvariant = Object.entries(invariants).find(([, passed]) => !passed);
  if (failedInvariant) {
    throw new Error(`API invariant failed: ${failedInvariant[0]}`);
  }
  observations.push({ phase: "api-readback", eventSummary, counts, invariants });
  verdict = "passed";
} catch (cause) {
  failure = safeError(cause);
  await captureFailure(adminPage, "failure-admin.png");
  await captureFailure(engineerPage, "failure-engineer.png");
} finally {
  if (engineerContext) {
    await engineerContext.setOffline(false).catch(() => undefined);
  }
  if (serverPaused) {
    try {
      execDocker(["compose", "unpause", "livekit"]);
      serverPaused = false;
    } catch (cause) {
      runtimeIssues.push({ actor: "harness", kind: "livekit_unpause_failed", category: safeError(cause) });
    }
  }

  const evidence = {
    id: "RISK-MEDIA-LIVEKIT-RECONNECT-2026-07-10",
    createdAt: new Date().toISOString(),
    startedAt,
    marker,
    roomId,
    sessionId,
    environment: {
      baseUrl,
      browser: "Playwright Chromium with synthetic camera and microphone",
      scenarios: ["engineer context offline/online", "LiveKit container pause/unpause"]
    },
    observations,
    screenshots,
    runtimeIssueSummary: summarizeIssues(runtimeIssues),
    livekitLogSummary: summarizeLiveKitLogs(marker, startedAt),
    verdict: {
      status: verdict,
      failure,
      note:
        verdict === "passed"
          ? "Both transport interruptions visibly entered reconnecting and recovered without a new join token, participant-left event, or ended session."
          : "No scenario is counted as pass unless every UI and API invariant completes."
    },
    redaction:
      "Evidence stores no join tokens, cookies, raw SDP, ICE credentials/candidates, TURN credentials, or URL query strings."
  };

  const evidencePath = path.join(outputDir, "risk-media-livekit-reconnect-2026-07-10.json");
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await Promise.allSettled([
    adminContext?.close(),
    engineerContext?.close(),
    browser?.close()
  ]);
  console.log(JSON.stringify({ verdict, evidencePath, roomId, screenshots }, null, 2));
}

if (verdict !== "passed") process.exitCode = 1;

async function login(page, email, password) {
  page.setDefaultTimeout(15_000);
  const authSurfaceReady = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "GET" &&
      new URL(candidate.url()).pathname === "/api/auth/me",
    { timeout: 15_000 }
  );
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await authSurfaceReady;
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().includes("/api/auth/login"), { timeout: 15_000 }),
    page.getByRole("button", { name: "Войти" }).click()
  ]);
  if (response.status() !== 200) throw new Error(`Login failed for ${email}: ${response.status()}`);
  await poll(
    `session for ${email}`,
    async () => (await page.request.get(`${baseUrl}/api/auth/me`)).status(),
    (status) => status === 200
  );
}

async function apiJson(page, method, pathname, data, expectedStatus) {
  const url = `${baseUrl}${pathname}`;
  const options = {
    headers: { "x-kiss-pm-action": "same-origin" },
    ...(data === undefined ? {} : { data })
  };
  const response = method === "GET"
    ? await page.request.get(url, options)
    : await page.request.post(url, options);
  const body = await response.json().catch(() => ({}));
  if (response.status() !== expectedStatus) {
    throw new Error(`${method} ${pathname} returned ${response.status()} (${String(body.error ?? "unknown")})`);
  }
  return body;
}

async function joinCall(page, callUrl, actor) {
  await page.goto(callUrl, { waitUntil: "domcontentloaded" });
  const join = page.getByRole("button", { name: "Присоединиться" });
  await join.waitFor({ state: "visible", timeout: 30_000 });
  await join.click();
  await poll(
    `${actor} active call`,
    () => page.locator("body").innerText(),
    (body) => body.includes("В эфире") || body.includes("Не удалось подключиться")
  );
  const body = await page.locator("body").innerText();
  if (!body.includes("В эфире")) throw new Error(`${actor} failed to join: ${body.slice(0, 500)}`);
}

async function waitForPhase(page, phase, label, timeout = 30_000) {
  await poll(
    label,
    async () => (await page.locator(".call-stage__phase").textContent())?.trim() ?? "",
    (actual) => actual === phase,
    timeout
  );
}

async function waitForRemoteParticipant(page, name, label) {
  await poll(
    label,
    () => page.locator(".call-tile__name").allTextContents(),
    (names) => names.some((candidate) => candidate.trim() === name),
    45_000
  );
}

async function snapshotPage(page) {
  return {
    url: stripQuery(page.url()),
    phase: (await page.locator(".call-stage__phase").textContent())?.trim() ?? null,
    participants: (await page.locator(".call-tile__name").allTextContents()).map((name) => name.trim()),
    controls: await page.locator(".call-controls__btn").evaluateAll((buttons) =>
      buttons.map((button) => ({
        label: button.getAttribute("aria-label"),
        pressed: button.getAttribute("aria-pressed"),
        disabled: button.hasAttribute("disabled")
      }))
    ),
    videos: await page.locator("video").evaluateAll((videos) =>
      videos.map((video) => ({
        width: video.videoWidth,
        height: video.videoHeight,
        paused: video.paused,
        readyState: video.readyState
      }))
    )
  };
}

async function capture(page, filename) {
  const target = path.join(outputDir, filename);
  await page.screenshot({ path: target, fullPage: true });
  screenshots.push(path.relative(process.cwd(), target).replaceAll("\\", "/"));
}

async function captureFailure(page, filename) {
  if (!page || page.isClosed()) return;
  try {
    await capture(page, filename);
  } catch {
    // The browser may already be gone; the JSON failure remains authoritative.
  }
}

async function poll(label, read, accept, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await read();
      if (accept(last)) return last;
    } catch (cause) {
      last = safeError(cause);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label}; last=${JSON.stringify(last)}`);
}

function observeRuntime(page, actor) {
  page.on("pageerror", () => runtimeIssues.push({ actor, kind: "pageerror", category: "page_error" }));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    runtimeIssues.push({ actor, kind: "console.error", category: classifyRuntimeIssue(message.text()) });
  });
  page.on("requestfailed", (request) => {
    runtimeIssues.push({
      actor,
      kind: "requestfailed",
      category: classifyRuntimeIssue(request.failure()?.errorText ?? "request_failed"),
      resource: request.resourceType(),
      path: safePath(request.url())
    });
  });
}

function classifyRuntimeIssue(value) {
  const text = String(value).toLowerCase();
  if (text.includes("websocket")) return "websocket_error";
  if (text.includes("internet_disconnected") || text.includes("network")) return "network_error";
  if (text.includes("fetch")) return "fetch_error";
  if (text.includes("livekit")) return "livekit_error";
  return "other_error";
}

function summarizeIssues(issues) {
  const counts = {};
  for (const issue of issues) {
    const key = `${issue.actor}:${issue.kind}:${issue.category}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return { counts, samples: issues.slice(0, 30) };
}

function execDocker(args) {
  execFileSync("docker", args, { cwd: process.cwd(), stdio: "pipe", encoding: "utf8" });
}

function phaseLog(phase) {
  console.log(JSON.stringify({ phase, at: new Date().toISOString() }));
}

function summarizeLiveKitLogs(roomMarker, since) {
  const result = spawnSync(
    "docker",
    ["compose", "logs", "--since", since, "--no-color", "livekit"],
    { cwd: process.cwd(), encoding: "utf8" }
  );
  const lines = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.split(/\r?\n/);
  const entries = [];
  for (const original of lines) {
    if (!original.includes(roomMarker)) continue;
    const jsonStart = original.indexOf("{");
    if (jsonStart < 0) continue;
    const line = original.slice(jsonStart);
    try {
      const parsed = JSON.parse(line);
      const composeTimestamp = original.slice(0, jsonStart).match(/\|\s*(\S+)\s*$/)?.[1] ?? null;
      entries.push({
        timestamp: composeTimestamp,
        event: classifyLiveKitLog(parsed),
        room: safeLogScalar(parsed.room ?? parsed.roomName),
        participant: safeLogScalar(parsed.participant ?? parsed.participantIdentity),
        kind: safeLogScalar(parsed.kind),
        mime: safeLogScalar(parsed.mime),
        state: safeLogScalar(parsed.state),
        connectionType: safeLogScalar(parsed.connectionType),
        transport: safeLogScalar(parsed.transport),
        expectedToResume: safeLogScalar(parsed.isExpectedToResume)
      });
    } catch {
      // Never preserve unparsed server lines; they may contain SDP or ICE fields.
    }
  }
  return { exitCode: result.status, entries };
}

function classifyLiveKitLog(entry) {
  if ("selectedNodeID" in entry) return "room_selected";
  if ("participantInit" in entry) return "participant_connected";
  if ("state" in entry) return "participant_state";
  if ("kind" in entry && "trackID" in entry && "mime" in entry) return "media_track";
  if ("connectionType" in entry) return "transport_connected";
  if ("existingPair" in entry || "newPair" in entry) return "ice_pair_changed";
  if ("sendLeave" in entry) return "participant_leave";
  if ("reason" in entry && !("participant" in entry)) return "room_closed";
  return "room_activity";
}

function safeLogScalar(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : null;
}

function safePath(value) {
  try {
    return new URL(value).pathname;
  } catch {
    return "unknown";
  }
}

function stripQuery(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(value).split("?")[0];
  }
}

function safeError(cause) {
  const raw = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
  return raw
    .replace(/([?&](?:access_token|join_request|token)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, "[redacted-jwt]")
    .slice(0, 2_000);
}
